import { NextResponse } from "next/server";
import { db, settings } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/plex/libraries/saved
 * Check if user has saved library selections.
 */
export async function GET() {
  try {
    const result = await db.select().from(settings).limit(1);

    if (result.length === 0) {
      return NextResponse.json({
        success: true,
        hasSavedSelection: false,
        serverUrl: null,
        serverId: null,
        serverName: null,
        libraries: [],
      });
    }

    const { plexServerUrl, plexServerId, plexServerName, selectedLibraries } = result[0];

    // Check if libraries have been saved
    const hasSavedSelection = !!(
      plexServerUrl &&
      plexServerId &&
      selectedLibraries
    );

    let libraries = [];
    if (selectedLibraries) {
      try {
        libraries = JSON.parse(selectedLibraries);
      } catch {
        libraries = [];
      }
    }

    return NextResponse.json({
      success: true,
      hasSavedSelection,
      serverUrl: plexServerUrl,
      serverId: plexServerId,
      serverName: plexServerName,
      libraries,
    });
  } catch (error) {
    console.error("Error checking saved libraries:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check saved libraries",
      },
      { status: 500 }
    );
  }
}
