import { db, settings, scans, suggestions } from "@/lib/db";
import { getLibraryItems, PlexMediaItem, getExistingCollections, PlexCollection } from "@/lib/plex/client";
import { getPlexToken } from "@/lib/plex/auth";
import { getConfiguredAIModel } from "@/lib/ai/provider";
import { createMultiPassAnalyzer } from "@/lib/embeddings/multi-pass-analyzer";
import { EnrichedItem, buildMediaLookup } from "@/lib/suggestion-utils";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Allow up to 2 minutes for AI analysis

interface SavedLibrary {
  key: string;
  title: string;
  type: "movie" | "show";
  uuid: string;
}

interface AnalysisProgress {
  type: "progress" | "complete" | "error";
  phase: "loading" | "analyzing" | "saving" | "complete";
  message?: string;
  totalItems?: number;
  suggestionsCount?: number;
  suggestionIds?: number[];
  error?: string;
  pass?: number;
  totalPasses?: number;
}

/**
 * Enrich rating keys with title and year from lookup.
 */
function enrichItems(
  ratingKeys: string[],
  lookup: Map<string, { title: string; year?: number }>
): EnrichedItem[] {
  return ratingKeys.map((key) => {
    const info = lookup.get(key);
    return {
      ratingKey: key,
      title: info?.title || `Unknown (${key})`,
      year: info?.year,
    };
  });
}

/**
 * GET /api/suggestions/generate
 * Generate AI collection suggestions via SSE.
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const { searchParams } = new URL(request.url);
  const scanIdParam = searchParams.get("scanId");

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: AnalysisProgress) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Get AI model
        send({ type: "progress", phase: "loading", message: "Loading AI configuration..." });

        const model = await getConfiguredAIModel();
        if (!model) {
          send({ type: "error", phase: "loading", error: "AI not configured" });
          controller.close();
          return;
        }

        // Get saved settings
        const settingsResult = await db.select().from(settings).limit(1);
        if (settingsResult.length === 0) {
          send({ type: "error", phase: "loading", error: "No settings found" });
          controller.close();
          return;
        }

        const { plexServerUrl, selectedLibraries } = settingsResult[0];

        if (!plexServerUrl) {
          send({ type: "error", phase: "loading", error: "No Plex server configured" });
          controller.close();
          return;
        }

        const token = await getPlexToken();
        if (!token) {
          send({ type: "error", phase: "loading", error: "No Plex token available" });
          controller.close();
          return;
        }

        // Parse libraries
        let libraries: SavedLibrary[] = [];
        if (selectedLibraries) {
          try {
            libraries = JSON.parse(selectedLibraries);
          } catch {
            send({ type: "error", phase: "loading", error: "Invalid library configuration" });
            controller.close();
            return;
          }
        }

        if (libraries.length === 0) {
          send({ type: "error", phase: "loading", error: "No libraries selected" });
          controller.close();
          return;
        }

        // Determine scanId - use provided or get latest
        let scanId: number;
        if (scanIdParam) {
          scanId = parseInt(scanIdParam, 10);
        } else {
          // Get latest completed scan
          const latestScan = await db
            .select()
            .from(scans)
            .where(eq(scans.status, "completed"))
            .orderBy(desc(scans.completedAt))
            .limit(1);

          if (latestScan.length === 0) {
            send({ type: "error", phase: "loading", error: "No completed scans found. Please scan your library first." });
            controller.close();
            return;
          }
          scanId = latestScan[0].id;
        }

        send({ type: "progress", phase: "loading", message: "Fetching library data..." });

        // Fetch all items from libraries
        const allMovies: PlexMediaItem[] = [];
        const allShows: PlexMediaItem[] = [];

        for (const library of libraries) {
          try {
            const items = await getLibraryItems(plexServerUrl, token, library.key);
            if (library.type === "movie") {
              allMovies.push(...items);
            } else {
              allShows.push(...items);
            }
          } catch (error) {
            console.error(`Error fetching library ${library.title}:`, error);
          }
        }

        const totalItems = allMovies.length + allShows.length;

        if (totalItems === 0) {
          send({ type: "error", phase: "loading", error: "No items found in libraries" });
          controller.close();
          return;
        }

        // Fetch existing collections to avoid duplicates
        send({
          type: "progress",
          phase: "loading",
          message: "Checking existing Plex collections...",
        });

        let existingCollections: PlexCollection[] = [];
        for (const library of libraries) {
          try {
            const collections = await getExistingCollections(plexServerUrl, token, library.key);
            existingCollections.push(...collections);
          } catch (error) {
            console.error(`Error fetching collections for library ${library.title}:`, error);
          }
        }

        // Deduplicate collections by title (case-insensitive)
        const seenTitles = new Set<string>();
        existingCollections = existingCollections.filter((c) => {
          const normalized = c.title.toLowerCase().trim();
          if (seenTitles.has(normalized)) return false;
          seenTitles.add(normalized);
          return true;
        });

        const allLibraryItems = [...allMovies, ...allShows];

        // =====================================================================
        // MULTI-PASS ANALYSIS
        // =====================================================================
        send({
          type: "progress",
          phase: "analyzing",
          message: "Starting multi-pass analysis...",
          totalItems,
        });

        const analyzer = createMultiPassAnalyzer((progress) => {
          send({
            type: "progress",
            phase: "analyzing",
            message: `[Pass ${progress.pass}/5] ${progress.passName}: ${progress.message}`,
            totalItems,
            pass: progress.pass,
            totalPasses: 5,
          });
        });

        const result = await analyzer.analyze(allLibraryItems, existingCollections);
        const validatedCollections = result.collections;

        console.log("Multi-pass analysis complete:", result.passes);

        if (validatedCollections.length === 0) {
          send({
            type: "complete",
            phase: "complete",
            message: existingCollections.length > 0
              ? `No new collections found. You already have ${existingCollections.length} collections in Plex.`
              : "AI couldn't identify meaningful collection patterns in your library.",
            suggestionsCount: 0,
            suggestionIds: [],
          });
          controller.close();
          return;
        }

        send({
          type: "progress",
          phase: "saving",
          message: `Saving ${validatedCollections.length} suggestions...`,
        });

        // Build lookup map for enriching items with titles
        const mediaLookup = buildMediaLookup([...allMovies, ...allShows]);

        // Save suggestions to database with enriched items
        const suggestionIds: number[] = [];

        for (const collection of validatedCollections) {
          // Enrich items with title and year
          const enrichedItems = enrichItems(collection.items, mediaLookup);

          const result = await db
            .insert(suggestions)
            .values({
              scanId,
              collectionName: collection.name,
              items: JSON.stringify(enrichedItems),
              itemCount: enrichedItems.length,
              reasoning: collection.reasoning,
              status: "pending",
            })
            .returning();

          suggestionIds.push(result[0].id);
        }

        // Send completion
        send({
          type: "complete",
          phase: "complete",
          message: `Generated ${validatedCollections.length} collection suggestions`,
          suggestionsCount: validatedCollections.length,
          suggestionIds,
        });

        controller.close();
      } catch (error) {
        console.error("Analysis error:", error);
        send({
          type: "error",
          phase: "analyzing",
          error: error instanceof Error ? error.message : "Analysis failed",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
