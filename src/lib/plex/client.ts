import { getPlexToken } from "./auth";

const PLEX_TV_API = "https://plex.tv/api/v2";
const CLIENT_IDENTIFIER = process.env.PLEX_CLIENT_ID || "plex-collection-creator";

type PlexHeaders = Record<string, string>;

/**
 * Get headers for Plex API requests.
 */
async function getPlexHeaders(): Promise<PlexHeaders> {
  const token = await getPlexToken();
  if (!token) {
    throw new Error("No Plex token available");
  }

  return {
    Accept: "application/json",
    "X-Plex-Token": token,
    "X-Plex-Client-Identifier": CLIENT_IDENTIFIER,
    "X-Plex-Product": "Plex Collection Creator",
    "X-Plex-Version": "1.0.0",
    "X-Plex-Platform": "Web",
  };
}

// Types for Plex API responses
export interface PlexServer {
  name: string;
  clientIdentifier: string;
  provides: string;
  owned: boolean;
  publicAddress: string;
  accessToken: string;
  connections: PlexConnection[];
}

export interface PlexConnection {
  protocol: string;
  address: string;
  port: number;
  uri: string;
  local: boolean;
  relay: boolean;
}

export interface PlexLibrary {
  key: string;
  type: "movie" | "show" | "artist" | "photo";
  title: string;
  agent: string;
  scanner: string;
  language: string;
  uuid: string;
  updatedAt: number;
  scannedAt: number;
  contentChangedAt: number;
  hidden: boolean;
  location: { id: number; path: string }[];
}

/**
 * Fetch all Plex servers the user has access to.
 */
export async function getPlexServers(): Promise<PlexServer[]> {
  const headers = await getPlexHeaders();

  const response = await fetch(`${PLEX_TV_API}/resources?includeHttps=1&includeRelay=1`, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Plex servers: ${response.statusText}`);
  }

  const data = await response.json();

  // Filter to only server devices (not players, etc.)
  return data.filter((resource: PlexServer) => resource.provides === "server");
}

/**
 * Get the best connection URL for a server.
 * Prefers local connections over relay.
 */
export function getBestConnection(server: PlexServer): PlexConnection | null {
  if (!server.connections || server.connections.length === 0) {
    return null;
  }

  // Sort connections: local first, then non-relay, then relay
  const sorted = [...server.connections].sort((a, b) => {
    if (a.local !== b.local) return a.local ? -1 : 1;
    if (a.relay !== b.relay) return a.relay ? 1 : -1;
    return 0;
  });

  return sorted[0];
}

/**
 * Test if a server connection is reachable.
 */
export async function testServerConnection(
  connectionUri: string,
  accessToken: string
): Promise<boolean> {
  try {
    const response = await fetch(`${connectionUri}/identity`, {
      headers: {
        Accept: "application/json",
        "X-Plex-Token": accessToken,
      },
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Find the best working connection for a server.
 */
export async function findWorkingConnection(
  server: PlexServer
): Promise<{ uri: string; token: string } | null> {
  if (!server.connections || server.connections.length === 0) {
    return null;
  }

  // Sort connections by preference
  const sorted = [...server.connections].sort((a, b) => {
    if (a.local !== b.local) return a.local ? -1 : 1;
    if (a.relay !== b.relay) return a.relay ? 1 : -1;
    return 0;
  });

  // Try each connection until one works
  for (const connection of sorted) {
    const isReachable = await testServerConnection(connection.uri, server.accessToken);
    if (isReachable) {
      return { uri: connection.uri, token: server.accessToken };
    }
  }

  return null;
}

/**
 * Fetch libraries from a Plex server.
 */
export async function getServerLibraries(
  serverUri: string,
  accessToken: string
): Promise<PlexLibrary[]> {
  const response = await fetch(`${serverUri}/library/sections`, {
    headers: {
      Accept: "application/json",
      "X-Plex-Token": accessToken,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch libraries: ${response.statusText}`);
  }

  const data = await response.json();
  return data.MediaContainer?.Directory || [];
}

/**
 * Filter libraries to only Movies and TV Shows.
 */
export function filterMediaLibraries(libraries: PlexLibrary[]): PlexLibrary[] {
  return libraries.filter((lib) => lib.type === "movie" || lib.type === "show");
}
