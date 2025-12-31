import { NextResponse } from "next/server";
import { db, settings, suggestions, appliedCollections } from "@/lib/db";
import { getCurrentServerUrl } from "@/lib/plex/client";
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

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Plex-Token": token,
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      console.error("Failed to fetch collections:", response.statusText);
      return [];
    }

    const data = await response.json();
    return data.MediaContainer?.Metadata || [];
  } catch (error) {
    console.error("Error connecting to Plex server:", error);
    throw new Error("Cannot connect to Plex server. Please check your connection in Settings.");
  }
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

interface PlexMediaItem {
  ratingKey: string;
  title: string;
  year?: number;
  thumb?: string;
  type: string;
}

/**
 * Get items currently in a collection (rating keys only).
 */
async function getCollectionItemKeys(
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
 * Get full item details for a collection.
 */
async function getCollectionItemsFull(
  serverUrl: string,
  token: string,
  collectionKey: string
): Promise<PlexMediaItem[]> {
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
  return items.map((item: { ratingKey: string; title: string; year?: number; thumb?: string; type: string }) => ({
    ratingKey: item.ratingKey,
    title: item.title,
    year: item.year,
    thumb: item.thumb,
    type: item.type,
  }));
}

/**
 * Delete a collection from Plex.
 */
async function deleteCollection(
  serverUrl: string,
  token: string,
  collectionKey: string
): Promise<boolean> {
  const url = `${serverUrl}/library/collections/${collectionKey}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      "X-Plex-Token": token,
    },
  });

  return response.ok;
}

/**
 * Remove an item from a collection.
 */
async function removeItemFromCollection(
  serverUrl: string,
  token: string,
  collectionKey: string,
  itemKey: string
): Promise<boolean> {
  const url = `${serverUrl}/library/collections/${collectionKey}/items/${itemKey}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      "X-Plex-Token": token,
    },
  });

  return response.ok;
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

    const { plexServerId, selectedLibraries } = settingsResult[0];

    if (!plexServerId) {
      return NextResponse.json(
        { success: false, error: "No Plex server configured. Please reconnect to your server." },
        { status: 400 }
      );
    }

    // Get current working server URL (handles IP changes)
    const serverConnection = await getCurrentServerUrl(plexServerId);
    if (!serverConnection) {
      return NextResponse.json(
        { success: false, error: "Cannot connect to Plex server. Server may be offline." },
        { status: 503 }
      );
    }

    const { uri: plexServerUrl, token } = serverConnection;

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
      const currentItems = await getCollectionItemKeys(plexServerUrl, token, collectionKey);
      const currentItemsSet = new Set(currentItems);

      // Only add items not already in the collection
      itemsToAdd = items.filter((item: string) => !currentItemsSet.has(item));

      if (itemsToAdd.length === 0) {
        // All items already in collection - mark as applied
        await db
          .update(suggestions)
          .set({ status: "applied" })
          .where(eq(suggestions.id, suggestionId));

        // Create appliedCollections record if it doesn't exist (for orphan detection)
        const existingRecord = await db
          .select()
          .from(appliedCollections)
          .where(eq(appliedCollections.suggestionId, suggestionId))
          .limit(1);

        if (existingRecord.length === 0) {
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

    // Always mark as "applied" when successfully adding to Plex
    // This ensures the UI updates correctly for both new and existing collections
    await db
      .update(suggestions)
      .set({ status: "applied" })
      .where(eq(suggestions.id, suggestionId));

    // Track the applied collection - required for orphan detection to work correctly
    // Insert for new collections, or if no record exists for this suggestion yet
    const existingRecord = await db
      .select()
      .from(appliedCollections)
      .where(eq(appliedCollections.suggestionId, suggestionId))
      .limit(1);

    if (existingRecord.length === 0) {
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
 * If ?collectionKey=X is provided, returns items for that collection.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionKey = searchParams.get("collectionKey");

    // Get settings for Plex connection
    const settingsResult = await db.select().from(settings).limit(1);
    if (settingsResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "No settings configured" },
        { status: 400 }
      );
    }

    const { plexServerId, selectedLibraries } = settingsResult[0];

    if (!plexServerId) {
      return NextResponse.json(
        { success: false, error: "No Plex server configured" },
        { status: 401 }
      );
    }

    // Get current working server URL (handles IP changes)
    const serverConnection = await getCurrentServerUrl(plexServerId);
    if (!serverConnection) {
      return NextResponse.json(
        { success: false, error: "Cannot connect to Plex server. Server may be offline." },
        { status: 503 }
      );
    }

    const { uri: serverUrl, token } = serverConnection;

    // If collectionKey provided, return items for that collection
    if (collectionKey) {
      const items = await getCollectionItemsFull(serverUrl, token, collectionKey);
      return NextResponse.json({
        success: true,
        items,
      });
    }

    // Otherwise, return all collections
    let plexCollections: PlexCollection[] = [];

    if (selectedLibraries) {
      const libraries = JSON.parse(selectedLibraries);
      if (libraries.length > 0) {
        plexCollections = await getExistingCollections(
          serverUrl,
          token,
          libraries[0].key
        );
      }
    }

    // Get applied collections from database
    const appliedResults = await db.select().from(appliedCollections);

    // Build set of actual Plex collection keys for quick lookup
    const plexCollectionKeys = new Set(plexCollections.map((c) => c.ratingKey));

    // Add sync status to each applied collection (instead of auto-deleting)
    const appliedWithSyncStatus = appliedResults.map((ac) => ({
      ...ac,
      existsInPlex: plexCollectionKeys.has(ac.plexCollectionKey),
    }));

    return NextResponse.json({
      success: true,
      appliedCollections: appliedWithSyncStatus,
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

/**
 * DELETE /api/plex/collections
 * Delete a collection or remove an item from a collection.
 * Query params:
 *   - collectionKey: Required. The collection to delete or modify.
 *   - itemKey: Optional. If provided, removes this item from the collection.
 *              If not provided, deletes the entire collection.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const collectionKey = searchParams.get("collectionKey");
    const itemKey = searchParams.get("itemKey");

    if (!collectionKey) {
      return NextResponse.json(
        { success: false, error: "collectionKey is required" },
        { status: 400 }
      );
    }

    // Get settings for Plex connection
    const settingsResult = await db.select().from(settings).limit(1);
    if (settingsResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "No settings configured" },
        { status: 400 }
      );
    }

    const { plexServerId } = settingsResult[0];

    if (!plexServerId) {
      return NextResponse.json(
        { success: false, error: "No Plex server configured" },
        { status: 401 }
      );
    }

    // Get current working server URL (handles IP changes)
    const serverConnection = await getCurrentServerUrl(plexServerId);
    if (!serverConnection) {
      return NextResponse.json(
        { success: false, error: "Cannot connect to Plex server. Server may be offline." },
        { status: 503 }
      );
    }

    const { uri: serverUrl, token } = serverConnection;

    if (itemKey) {
      // Remove specific item from collection
      const success = await removeItemFromCollection(serverUrl, token, collectionKey, itemKey);
      if (!success) {
        return NextResponse.json(
          { success: false, error: "Failed to remove item from collection" },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "Item removed from collection",
      });
    } else {
      // Delete entire collection
      const success = await deleteCollection(serverUrl, token, collectionKey);
      if (!success) {
        return NextResponse.json(
          { success: false, error: "Failed to delete collection" },
          { status: 500 }
        );
      }

      // Also remove from our appliedCollections table if it exists there
      await db
        .delete(appliedCollections)
        .where(eq(appliedCollections.plexCollectionKey, collectionKey));

      return NextResponse.json({
        success: true,
        message: "Collection deleted",
      });
    }
  } catch (error) {
    console.error("Error deleting collection:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete",
      },
      { status: 500 }
    );
  }
}
