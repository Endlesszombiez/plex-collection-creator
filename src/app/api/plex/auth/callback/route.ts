import { NextRequest, NextResponse } from "next/server";
import { checkPlexAuth } from "@/lib/plex/auth";

// Force dynamic rendering (no static pre-rendering during build)
export const dynamic = "force-dynamic";

/**
 * GET /api/plex/auth/callback
 * Handle the OAuth callback after user authenticates with Plex.
 * This is called by Plex after the user logs in.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pinId = searchParams.get("pinId");

  // If no pinId, this might be the redirect from Plex
  // In that case, we need to redirect to the frontend to complete the flow
  if (!pinId) {
    // Redirect to frontend to complete authentication
    return NextResponse.redirect(new URL("/setup?plex=pending", request.url));
  }

  return handleCallback(parseInt(pinId, 10));
}

/**
 * POST /api/plex/auth/callback
 * Check if authentication is complete for a given PIN ID.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pinId } = body;

    if (!pinId || typeof pinId !== "number") {
      return NextResponse.json(
        { success: false, error: "PIN ID is required" },
        { status: 400 }
      );
    }

    return handleCallback(pinId);
  } catch (error) {
    console.error("Error in callback:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 }
    );
  }
}

async function handleCallback(pinId: number) {
  try {
    const result = await checkPlexAuth(pinId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Authentication successful",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error || "Authentication not complete",
        pending: result.error === "Authentication not yet complete",
      },
      { status: result.error === "Authentication not yet complete" ? 202 : 400 }
    );
  } catch (error) {
    console.error("Error checking auth:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check authentication",
      },
      { status: 500 }
    );
  }
}
