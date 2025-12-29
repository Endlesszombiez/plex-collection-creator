import { NextResponse } from "next/server";
import { db, settings, suggestions, appliedCollections } from "@/lib/db";
import { getPlexToken } from "@/lib/plex/auth";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface PlexCollection {
  ratingKey: string;
  key: string;
  title: string;
  childCount?: number;
}

/**
 * Get all existing collections from a Plex library section.
 */
async function getExistingCollections(
  serverUrl: string,
  token: string,
  sectionId: string
): Promise<PlexCollection[]> {
  const url = `${serverUrl}/library/sections/${sectionId}/collections`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Plex-Token": token,
    },
  });

  if (!response.ok) {
    console.error("Failed to fetch collections:", response.statusText);
    return [];
  }

  const data = await response.json();
  return data.MediaContainer?.Metadata || [];
}

/**
 * Find a collection by name (case-insensitive).
 */
function findCollectionByName(
  collections: PlexCollection[],
  name: string
): PlexCollection | undefined {
  const normalizedName = name.toLowerCase().trim();
  return collections.find(
    (c) => c.title.toLowerCase().trim() === normalizedName
  );
}

/**
 * Get items currently in a collection.
 */
async function getCollectionItems(
  serverUrl: string,
  token: string,
  collectionKey: string
): Promise<string[]> {
  const url = `${serverUrl}/library/collections/${collectionKey}/children`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Plex-Token": token,
    },
  });

  if (!response.ok) {
    console.error("Failed to fetch collection items:", response.statusText);
    return [];
  }

  const data = await response.json();
  const items = data.MediaContainer?.Metadata || [];
  return items.map((item: { ratingKey: string }) => item.ratingKey);
}

/**
 * Add items to an existing collection using the machine identifier format.
 */
async function addItemsToCollection(
  serverUrl: string,
  token: string,
  machineId: string,
  collectionKey: string,
  itemRatingKeys: string[]
): Promise<{ success: boolean; added: number; errors: number }> {
  let added = 0;
  let errors = 0;

  for (const ratingKey of itemRatingKeys) {
    // Use the proper URI format with machine identifier
    const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${ratingKey}`;
    const url = new URL(`${serverUrl}/library/collections/${collectionKey}/items`);
    url.searchParams.set("uri", uri);

    try {
      const response = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "X-Plex-Token": token,
        },
      });

      if (response.ok) {
        added++;
      } else {
        console.warn(`Failed to add item ${ratingKey}:`, response.statusText);
        errors++;
      }
    } catch (error) {
      console.error(`Error adding item ${ratingKey}:`, error);
      errors++;
    }
  }

  return { success: errors === 0, added, errors };
}

/**
 * Create a new collection in Plex.
 */
async function createCollection(
  serverUrl: string,
  token: string,
  machineId: string,
  sectionId: string,
  title: string,
  firstItemRatingKey: string
): Promise<string | null> {
  // Create collection with the first item using proper URI format
  const uri = `server://${machineId}/com.plexapp.plugins.library/library/metadata/${firstItemRatingKey}`;
  const url = new URL(`${serverUrl}/library/collections`);
  url.searchParams.set("type", "1"); // 1 for movies
  url.searchParams.set("title", title);
  url.searchParams.set("smart", "0");
  url.searchParams.set("sectionId", sectionId);
  url.searchParams.set("uri", uri);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "X-Plex-Token": token,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to create collection:", errorText);
    return null;
  }

  const data = await response.json();
  return data.MediaContainer?.Metadata?.[0]?.ratingKey || null;
}

/**
 * Extract rating keys from items array.
 */
function extractRatingKeys(items: { ratingKey: string }[]): string[] {
  return items.map((item) => item.ratingKey);
}

/**
 * POST /api/plex/collections
 * Create or update a collection in Plex from a suggestion.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { suggestionId, collectionName, items: rawItems } = body;

    if (!suggestionId || !collectionName || !rawItems || !Array.isArray(rawItems)) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Normalize items to rating keys (handles both old and new formats)
    const items = extractRatingKeys(rawItems);

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: "No items to add to collection" },
        { status: 400 }
      );
    }

    // Get server URL, token, and machine ID
    const settingsResult = await db.select().from(settings).limit(1);
    if (settingsResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "No settings configured" },
        { status: 400 }
      );
    }

    const { plexServerUrl, plexServerId, selectedLibraries } = settingsResult[0];

    if (!plexServerUrl) {
      return NextResponse.json(
        { success: false, error: "No Plex server configured" },
        { status: 400 }
      );
    }

    if (!plexServerId) {
      return NextResponse.json(
        { success: false, error: "No Plex server ID configured. Please reconnect to your server." },
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

    // Get the library section ID
    let sectionId: string | null = null;
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

    // Check for existing collections
    const existingCollections = await getExistingCollections(plexServerUrl, token, sectionId);
    const existingCollection = findCollectionByName(existingCollections, collectionName);

    let collectionKey: string;
    let isNewCollection = false;
    let itemsToAdd = items;

    if (existingCollection) {
      // Collection exists - get current items to avoid duplicates
      collectionKey = existingCollection.ratingKey;
      const currentItems = await getCollectionItems(plexServerUrl, token, collectionKey);
      const currentItemsSet = new Set(currentItems);

      // Only add items not already in the collection
      itemsToAdd = items.filter((item: string) => !currentItemsSet.has(item));

      if (itemsToAdd.length === 0) {
        // All items already in collection
        await db
          .update(suggestions)
          .set({ status: "applied" })
          .where(eq(suggestions.id, suggestionId));

        return NextResponse.json({
          success: true,
          collectionKey,
          message: `Collection "${collectionName}" already exists with all items`,
          added: 0,
          existing: items.length,
        });
      }

      console.log(`Adding ${itemsToAdd.length} new items to existing collection "${collectionName}"`);
    } else {
      // Create new collection with first item
      const newCollectionKey = await createCollection(
        plexServerUrl,
        token,
        plexServerId,
        sectionId,
        collectionName,
        items[0]
      );

      if (!newCollectionKey) {
        return NextResponse.json(
          { success: false, error: "Failed to create collection in Plex" },
          { status: 500 }
        );
      }

      collectionKey = newCollectionKey;
      isNewCollection = true;
      // First item already added during creation
      itemsToAdd = items.slice(1);
      console.log(`Created new collection "${collectionName}" with key ${collectionKey}`);
    }

    // Add remaining items to the collection
    const addResult = { success: true, added: isNewCollection ? 1 : 0, errors: 0 };

    if (itemsToAdd.length > 0) {
      const result = await addItemsToCollection(
        plexServerUrl,
        token,
        plexServerId,
        collectionKey,
        itemsToAdd
      );
      addResult.added += result.added;
      addResult.errors = result.errors;
    }

    // Update suggestion status to applied
    await db
      .update(suggestions)
      .set({ status: "applied" })
      .where(eq(suggestions.id, suggestionId));

    // Record the applied collection (only for new collections)
    if (isNewCollection) {
      await db.insert(appliedCollections).values({
        suggestionId,
        plexCollectionKey: collectionKey,
        collectionName,
        itemCount: items.length,
      });
    }

    return NextResponse.json({
      success: true,
      collectionKey,
      message: isNewCollection
        ? `Created collection "${collectionName}" with ${addResult.added} items`
        : `Added ${addResult.added} items to existing collection "${collectionName}"`,
      added: addResult.added,
      errors: addResult.errors,
      isNewCollection,
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
 * Fetch existing Plex collections and applied collections.
 */
export async function GET() {
  try {
    // Get applied collections from our database
    const appliedResults = await db.select().from(appliedCollections);

    // Also try to fetch current Plex collections
    const settingsResult = await db.select().from(settings).limit(1);
    let plexCollections: PlexCollection[] = [];

    if (settingsResult.length > 0) {
      const { plexServerUrl, selectedLibraries } = settingsResult[0];
      const token = await getPlexToken();

      if (plexServerUrl && token && selectedLibraries) {
        const libraries = JSON.parse(selectedLibraries);
        if (libraries.length > 0) {
          plexCollections = await getExistingCollections(
            plexServerUrl,
            token,
            libraries[0].key
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      appliedCollections: appliedResults,
      plexCollections: plexCollections.map((c) => ({
        ratingKey: c.ratingKey,
        title: c.title,
        childCount: c.childCount,
      })),
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
