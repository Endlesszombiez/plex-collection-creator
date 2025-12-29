import { NextResponse } from "next/server";
import { db, settings, suggestions, appliedCollections } from "@/lib/db";
import { getPlexToken } from "@/lib/plex/auth";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/plex/collections
 * Create a collection in Plex from a suggestion.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { suggestionId, collectionName, items } = body;

    if (!suggestionId || !collectionName || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get server URL and token
    const settingsResult = await db.select().from(settings).limit(1);
    if (settingsResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "No settings configured" },
        { status: 400 }
      );
    }

    const { plexServerUrl, selectedLibraries } = settingsResult[0];
    if (!plexServerUrl) {
      return NextResponse.json(
        { success: false, error: "No Plex server configured" },
        { status: 400 }
      );
    }

    const token = await getPlexToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: "No Plex token available" },
        { status: 401 }
      );
    }

    // Get the library section key from the first item
    // We need to determine which library the items belong to
    let sectionId: string | null = null;

    // Parse selected libraries to get section IDs
    if (selectedLibraries) {
      const libraries = JSON.parse(selectedLibraries);
      if (libraries.length > 0) {
        sectionId = libraries[0].key;
      }
    }

    if (!sectionId) {
      return NextResponse.json(
        { success: false, error: "No library section found" },
        { status: 400 }
      );
    }

    // Create collection in Plex
    // First, create the collection with the first item
    const createUrl = new URL(`${plexServerUrl}/library/collections`);
    createUrl.searchParams.set("type", "1"); // 1 for movies, 2 for shows
    createUrl.searchParams.set("title", collectionName);
    createUrl.searchParams.set("smart", "0"); // Not a smart collection
    createUrl.searchParams.set("sectionId", sectionId);
    createUrl.searchParams.set("uri", `server://localhost/com.plexapp.plugins.library/library/metadata/${items[0]}`);

    const createResponse = await fetch(createUrl.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "X-Plex-Token": token,
      },
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Failed to create collection:", errorText);
      return NextResponse.json(
        { success: false, error: `Failed to create collection: ${createResponse.statusText}` },
        { status: 500 }
      );
    }

    const createData = await createResponse.json();
    const collectionKey = createData.MediaContainer?.Metadata?.[0]?.ratingKey;

    if (!collectionKey) {
      return NextResponse.json(
        { success: false, error: "Failed to get collection key from Plex" },
        { status: 500 }
      );
    }

    // Add remaining items to the collection
    if (items.length > 1) {
      for (let i = 1; i < items.length; i++) {
        const addUrl = new URL(`${plexServerUrl}/library/collections/${collectionKey}/items`);
        addUrl.searchParams.set("uri", `server://localhost/com.plexapp.plugins.library/library/metadata/${items[i]}`);

        const addResponse = await fetch(addUrl.toString(), {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "X-Plex-Token": token,
          },
        });

        if (!addResponse.ok) {
          console.warn(`Failed to add item ${items[i]} to collection:`, addResponse.statusText);
          // Continue with other items
        }
      }
    }

    // Update suggestion status to applied
    await db
      .update(suggestions)
      .set({ status: "applied" })
      .where(eq(suggestions.id, suggestionId));

    // Record the applied collection
    await db.insert(appliedCollections).values({
      suggestionId,
      plexCollectionKey: collectionKey,
      collectionName,
      itemCount: items.length,
    });

    return NextResponse.json({
      success: true,
      collectionKey,
      message: `Created collection "${collectionName}" with ${items.length} items`,
    });
  } catch (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create collection",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/plex/collections
 * Fetch applied collections.
 */
export async function GET() {
  try {
    const results = await db.select().from(appliedCollections);

    return NextResponse.json({
      success: true,
      collections: results,
    });
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch collections",
      },
      { status: 500 }
    );
  }
}
