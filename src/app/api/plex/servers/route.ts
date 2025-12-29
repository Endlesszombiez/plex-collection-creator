import { NextResponse } from "next/server";
import {
  getPlexServers,
  findWorkingConnection,
  PlexServer,
} from "@/lib/plex/client";
import { isPlexConnected } from "@/lib/plex/auth";

export const dynamic = "force-dynamic";

export interface ServerInfo {
  name: string;
  clientIdentifier: string;
  owned: boolean;
  uri: string | null;
  accessToken: string;
  online: boolean;
}

/**
 * GET /api/plex/servers
 * Fetch all Plex servers the user has access to.
 */
export async function GET() {
  try {
    // Check if user is connected to Plex
    const connected = await isPlexConnected();
    if (!connected) {
      return NextResponse.json(
        { success: false, error: "Not connected to Plex" },
        { status: 401 }
      );
    }

    // Fetch servers from plex.tv
    const servers = await getPlexServers();

    // Process each server to find working connections
    const serverInfoPromises = servers.map(async (server: PlexServer): Promise<ServerInfo> => {
      const connection = await findWorkingConnection(server);
      return {
        name: server.name,
        clientIdentifier: server.clientIdentifier,
        owned: server.owned,
        uri: connection?.uri || null,
        accessToken: server.accessToken,
        online: connection !== null,
      };
    });

    const serverInfo = await Promise.all(serverInfoPromises);

    return NextResponse.json({
      success: true,
      servers: serverInfo,
    });
  } catch (error) {
    console.error("Error fetching Plex servers:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch servers",
      },
      { status: 500 }
    );
  }
}
