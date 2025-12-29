import { NextRequest, NextResponse } from "next/server";
import {
  getServerLibraries,
  filterMediaLibraries,
  PlexLibrary,
} from "@/lib/plex/client";
import { isPlexConnected } from "@/lib/plex/auth";
import { db, settings } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export interface LibraryInfo {
  key: string;
  title: string;
  type: "movie" | "show";
  uuid: string;
  itemCount?: number;
}

/**
 * GET /api/plex/libraries?serverUri=...&accessToken=...
 * Fetch libraries from a specific Plex server.
 */
export async function GET(request: NextRequest) {
  try {
    // Check if user is connected to Plex
    const connected = await isPlexConnected();
    if (!connected) {
      return NextResponse.json(
        { success: false, error: "Not connected to Plex" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const serverUri = searchParams.get("serverUri");
    const accessToken = searchParams.get("accessToken");

    if (!serverUri || !accessToken) {
      return NextResponse.json(
        { success: false, error: "Server URI and access token are required" },
        { status: 400 }
      );
    }

    // Fetch libraries
    const allLibraries = await getServerLibraries(serverUri, accessToken);

    // Filter to only Movies and TV Shows
    const mediaLibraries = filterMediaLibraries(allLibraries);

    // Map to simplified format
    const libraries: LibraryInfo[] = mediaLibraries.map((lib: PlexLibrary) => ({
      key: lib.key,
      title: lib.title,
      type: lib.type as "movie" | "show",
      uuid: lib.uuid,
    }));

    return NextResponse.json({
      success: true,
      libraries,
    });
  } catch (error) {
    console.error("Error fetching Plex libraries:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch libraries",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/plex/libraries
 * Save selected server and libraries to settings.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serverUri, serverId, serverName, libraries } = body;

    if (!serverUri || !serverId) {
      return NextResponse.json(
        { success: false, error: "Server URI and ID are required" },
        { status: 400 }
      );
    }

    // Update settings with selected server and libraries
    const existing = await db.select().from(settings).limit(1);

    if (existing.length > 0) {
      await db
        .update(settings)
        .set({
          plexServerUrl: serverUri,
          plexServerId: serverId,
          plexServerName: serverName || null,
          selectedLibraries: libraries ? JSON.stringify(libraries) : null,
          updatedAt: new Date(),
        })
        .where(eq(settings.id, existing[0].id));
    } else {
      await db.insert(settings).values({
        plexServerUrl: serverUri,
        plexServerId: serverId,
        plexServerName: serverName || null,
        selectedLibraries: libraries ? JSON.stringify(libraries) : null,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Settings saved successfully",
    });
  } catch (error) {
    console.error("Error saving library settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save settings",
      },
      { status: 500 }
    );
  }
}
