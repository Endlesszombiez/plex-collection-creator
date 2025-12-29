import { NextResponse } from "next/server";
import { getPlexStatus } from "@/lib/plex/auth";

// Force dynamic rendering (no static pre-rendering during build)
export const dynamic = "force-dynamic";

/**
 * GET /api/plex/status
 * Get the current Plex connection status.
 */
export async function GET() {
  try {
    const status = await getPlexStatus();

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error("Error getting Plex status:", error);
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: error instanceof Error ? error.message : "Failed to get status",
      },
      { status: 500 }
    );
  }
}
