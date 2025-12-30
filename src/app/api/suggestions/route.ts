import { NextResponse } from "next/server";
import { db, suggestions, settings, appliedCollections } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { getCurrentServerUrl, getExistingCollections } from "@/lib/plex/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/suggestions
 * Fetch all suggestions, optionally filtered by status.
 * For "applied" suggestions, includes existsInPlex flag.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let results;
    if (status) {
      results = await db
        .select()
        .from(suggestions)
        .where(eq(suggestions.status, status))
        .orderBy(desc(suggestions.createdAt));
    } else {
      results = await db.select().from(suggestions).orderBy(desc(suggestions.createdAt));
    }

    // Check Plex sync status for applied suggestions and revert orphaned ones
    const { keys: plexCollectionKeys, success: plexCheckSucceeded } = await getPlexCollectionKeys();
    const appliedCollectionsMap = await getAppliedCollectionsMap();

    // Only check for orphans if we successfully connected to Plex
    const orphanedIds: number[] = [];
    if (plexCheckSucceeded) {
      for (const s of results) {
        if (s.status === "applied") {
          const appliedRecord = appliedCollectionsMap.get(s.id);
          const existsInPlex = appliedRecord
            ? plexCollectionKeys.has(appliedRecord.plexCollectionKey)
            : false;
          if (!existsInPlex) {
            orphanedIds.push(s.id);
          }
        }
      }

      // Revert orphaned suggestions back to "approved" status
      if (orphanedIds.length > 0) {
        for (const id of orphanedIds) {
          await db
            .update(suggestions)
            .set({ status: "approved" })
            .where(eq(suggestions.id, id));
        }
      }
    }

    // Parse items JSON - update status in memory for orphaned ones
    const parsed = results.map((s) => ({
      ...s,
      status: orphanedIds.includes(s.id) ? "approved" : s.status,
      items: JSON.parse(s.items),
    }));

    return NextResponse.json({
      success: true,
      suggestions: parsed,
    });
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch suggestions",
      },
      { status: 500 }
    );
  }
}

/**
 * Get set of Plex collection keys that currently exist.
 * Returns { keys, success } - only revert orphaned if success is true.
 */
async function getPlexCollectionKeys(): Promise<{ keys: Set<string>; success: boolean }> {
  try {
    const settingsResult = await db.select().from(settings).limit(1);
    if (settingsResult.length === 0) {
      // No settings - can't check, don't revert
      return { keys: new Set(), success: false };
    }

    const { plexServerId, selectedLibraries } = settingsResult[0];
    if (!plexServerId || !selectedLibraries) {
      // Not configured - can't check, don't revert
      return { keys: new Set(), success: false };
    }

    const serverConnection = await getCurrentServerUrl(plexServerId);
    if (!serverConnection) {
      // Can't connect to Plex - don't revert (might be temporary)
      return { keys: new Set(), success: false };
    }

    const { uri: serverUrl, token } = serverConnection;

    const libraries = JSON.parse(selectedLibraries);
    if (libraries.length === 0) {
      return { keys: new Set(), success: false };
    }

    const plexCollections = await getExistingCollections(serverUrl, token, libraries[0].key);
    return { keys: new Set(plexCollections.map((c) => c.ratingKey)), success: true };
  } catch (error) {
    console.error("Error fetching Plex collections:", error);
    // API error - don't revert (might be temporary)
    return { keys: new Set(), success: false };
  }
}

/**
 * Get map of suggestionId -> appliedCollection record.
 */
async function getAppliedCollectionsMap(): Promise<Map<number, { plexCollectionKey: string }>> {
  const records = await db.select().from(appliedCollections);
  const map = new Map<number, { plexCollectionKey: string }>();
  for (const record of records) {
    if (record.suggestionId) {
      map.set(record.suggestionId, { plexCollectionKey: record.plexCollectionKey });
    }
  }
  return map;
}

/**
 * PATCH /api/suggestions
 * Update suggestion status (approve/reject).
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "Missing id or status" },
        { status: 400 }
      );
    }

    if (!["pending", "approved", "rejected", "applied"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 }
      );
    }

    await db
      .update(suggestions)
      .set({ status })
      .where(eq(suggestions.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating suggestion:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update suggestion",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/suggestions
 * Delete a suggestion and its associated applied_collections record.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing id" },
        { status: 400 }
      );
    }

    const suggestionId = parseInt(id, 10);

    // Delete associated applied_collections record first (FK constraint)
    await db.delete(appliedCollections).where(eq(appliedCollections.suggestionId, suggestionId));

    // Then delete the suggestion
    await db.delete(suggestions).where(eq(suggestions.id, suggestionId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting suggestion:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete suggestion",
      },
      { status: 500 }
    );
  }
}
