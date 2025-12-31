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

/**
 * Get the current working URL for a server by its clientIdentifier.
 * This fetches fresh connection info from Plex to handle IP changes.
 */
export async function getCurrentServerUrl(
  clientIdentifier: string
): Promise<{ uri: string; token: string } | null> {
  try {
    const servers = await getPlexServers();
    const server = servers.find((s) => s.clientIdentifier === clientIdentifier);

    if (!server) {
      console.error(`Server with ID ${clientIdentifier} not found`);
      return null;
    }

    return await findWorkingConnection(server);
  } catch (error) {
    console.error("Error getting current server URL:", error);
    return null;
  }
}

// Types for library items
export interface PlexMediaItem {
  ratingKey: string;
  key: string;
  type: "movie" | "show";
  title: string;
  year?: number;
  summary?: string;
  thumb?: string;
  // Metadata
  genres: string[];
  directors: string[];
  actors: string[];
  studio?: string;
  contentRating?: string;
  rating?: number;
  audienceRating?: number;
  duration?: number;
  addedAt?: number;
  // For TV shows
  childCount?: number; // number of seasons
  leafCount?: number; // number of episodes
}

interface PlexApiGenre {
  tag: string;
}

interface PlexApiDirector {
  tag: string;
}

interface PlexApiRole {
  tag: string;
}

interface PlexApiMediaItem {
  ratingKey: string;
  key: string;
  type: string;
  title: string;
  year?: number;
  summary?: string;
  thumb?: string;
  Genre?: PlexApiGenre[];
  Director?: PlexApiDirector[];
  Role?: PlexApiRole[];
  studio?: string;
  contentRating?: string;
  rating?: number;
  audienceRating?: number;
  duration?: number;
  addedAt?: number;
  childCount?: number;
  leafCount?: number;
}

/**
 * Fetch all items from a library with metadata.
 * Uses pagination for large libraries.
 */
export async function getLibraryItems(
  serverUri: string,
  accessToken: string,
  libraryKey: string,
  onProgress?: (fetched: number, total: number) => void
): Promise<PlexMediaItem[]> {
  const PAGE_SIZE = 100;
  const items: PlexMediaItem[] = [];
  let offset = 0;
  let totalSize = 0;

  // First request to get total count
  const initialResponse = await fetch(
    `${serverUri}/library/sections/${libraryKey}/all?X-Plex-Container-Start=0&X-Plex-Container-Size=${PAGE_SIZE}`,
    {
      headers: {
        Accept: "application/json",
        "X-Plex-Token": accessToken,
      },
    }
  );

  if (!initialResponse.ok) {
    throw new Error(`Failed to fetch library items: ${initialResponse.statusText}`);
  }

  const initialData = await initialResponse.json();
  totalSize = initialData.MediaContainer?.totalSize || 0;
  const initialItems = initialData.MediaContainer?.Metadata || [];

  items.push(...initialItems.map(parseMediaItem));
  onProgress?.(items.length, totalSize);

  // Fetch remaining pages
  offset = PAGE_SIZE;
  while (offset < totalSize) {
    const response = await fetch(
      `${serverUri}/library/sections/${libraryKey}/all?X-Plex-Container-Start=${offset}&X-Plex-Container-Size=${PAGE_SIZE}`,
      {
        headers: {
          Accept: "application/json",
          "X-Plex-Token": accessToken,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch library items at offset ${offset}: ${response.statusText}`);
    }

    const data = await response.json();
    const pageItems = data.MediaContainer?.Metadata || [];
    items.push(...pageItems.map(parseMediaItem));

    onProgress?.(items.length, totalSize);
    offset += PAGE_SIZE;
  }

  return items;
}

/**
 * Parse a Plex API media item into our format.
 */
function parseMediaItem(item: PlexApiMediaItem): PlexMediaItem {
  return {
    ratingKey: item.ratingKey,
    key: item.key,
    type: item.type as "movie" | "show",
    title: item.title,
    year: item.year,
    summary: item.summary,
    thumb: item.thumb,
    genres: item.Genre?.map((g) => g.tag) || [],
    directors: item.Director?.map((d) => d.tag) || [],
    actors: item.Role?.map((r) => r.tag).slice(0, 10) || [], // Limit to top 10 actors
    studio: item.studio,
    contentRating: item.contentRating,
    rating: item.rating,
    audienceRating: item.audienceRating,
    duration: item.duration,
    addedAt: item.addedAt,
    childCount: item.childCount,
    leafCount: item.leafCount,
  };
}

/**
 * Existing Plex collection info.
 */
export interface PlexCollection {
  ratingKey: string;
  title: string;
  childCount?: number;
}

/**
 * Fetch all existing collections from a Plex library section.
 */
export async function getExistingCollections(
  serverUri: string,
  accessToken: string,
  sectionId: string
): Promise<PlexCollection[]> {
  const url = `${serverUri}/library/sections/${sectionId}/collections`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Plex-Token": accessToken,
    },
  });

  if (!response.ok) {
    console.error("Failed to fetch collections:", response.statusText);
    return [];
  }

  const data = await response.json();
  const collections = data.MediaContainer?.Metadata || [];

  return collections.map((c: { ratingKey: string; title: string; childCount?: number }) => ({
    ratingKey: c.ratingKey,
    title: c.title,
    childCount: c.childCount,
  }));
}

/**
 * Item in a Plex collection.
 */
export interface CollectionItem {
  ratingKey: string;
  title: string;
  year?: number;
}

/**
 * Fetch items in a specific collection.
 */
export async function getCollectionItems(
  serverUri: string,
  accessToken: string,
  collectionKey: string
): Promise<CollectionItem[]> {
  const url = `${serverUri}/library/collections/${collectionKey}/children`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Plex-Token": accessToken,
    },
  });

  if (!response.ok) {
    console.error("Failed to fetch collection items:", response.statusText);
    return [];
  }

  const data = await response.json();
  const items = data.MediaContainer?.Metadata || [];

  return items.map((item: { ratingKey: string; title: string; year?: number }) => ({
    ratingKey: item.ratingKey,
    title: item.title,
    year: item.year,
  }));
}
