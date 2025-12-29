import { NextRequest, NextResponse } from "next/server";
import {
  startPlexAuth,
  disconnectPlex,
} from "@/lib/plex/auth";

// Force dynamic rendering (no static pre-rendering during build)
export const dynamic = "force-dynamic";

/**
 * GET /api/plex/auth
 * Start the Plex OAuth flow. Returns a login URL and PIN ID.
 */
export async function GET(request: NextRequest) {
  try {
    // Get the callback URL from the request
    const searchParams = request.nextUrl.searchParams;
    const callbackUrl =
      searchParams.get("callback") ||
      `${request.nextUrl.origin}/api/plex/auth/callback`;

    const { loginUrl, pinId } = await startPlexAuth(callbackUrl);

    return NextResponse.json({
      success: true,
      loginUrl,
      pinId,
    });
  } catch (error) {
    console.error("Error starting Plex auth:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to start authentication",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/plex/auth
 * Disconnect Plex by removing the stored token.
 */
export async function DELETE() {
  try {
    await disconnectPlex();

    return NextResponse.json({
      success: true,
      message: "Plex disconnected successfully",
    });
  } catch (error) {
    console.error("Error disconnecting Plex:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to disconnect",
      },
      { status: 500 }
    );
  }
}
