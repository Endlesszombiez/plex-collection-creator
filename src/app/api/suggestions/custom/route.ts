import { db, settings, scans, suggestions } from "@/lib/db";
import { getLibraryItems, PlexMediaItem, getExistingCollections, getCollectionItems, PlexCollection } from "@/lib/plex/client";
import { getPlexToken } from "@/lib/plex/auth";
import { getConfiguredAIModel, getFastAIModel } from "@/lib/ai/provider";
import {
  CUSTOM_AUDIT_SYSTEM_PROMPT,
  createCustomAuditPrompt,
  parseAuditResponse,
  CUSTOM_NEW_COLLECTIONS_SYSTEM_PROMPT,
  createCustomNewCollectionsPrompt,
  parseAIResponse,
  validateCollections,
  PreviousSuggestion,
  ParsedCollection,
  DEDUPLICATION_SYSTEM_PROMPT,
  createDeduplicationPrompt,
  parseDeduplicationResponse,
  VALIDATION_SYSTEM_PROMPT,
  createValidationPrompt,
  parseValidationResponse,
} from "@/lib/ai/prompts";
import { EnrichedItem, buildMediaLookup } from "@/lib/suggestion-utils";
import { generateText } from "ai";
import { eq, desc, inArray, and } from "drizzle-orm";
import { embeddingQueryService, MovieForEmbedding } from "@/lib/embeddings/embedding-service";

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
 * GET /api/suggestions/custom
 * Generate AI collection suggestions based on a custom prompt via SSE.
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const { searchParams } = new URL(request.url);
  const scanIdParam = searchParams.get("scanId");
  const customPrompt = searchParams.get("prompt");

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: AnalysisProgress) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Validate custom prompt
        if (!customPrompt || customPrompt.trim().length === 0) {
          send({ type: "error", phase: "loading", error: "Custom prompt is required" });
          controller.close();
          return;
        }

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

        // Fetch items for each existing collection so AI can suggest additions
        send({
          type: "progress",
          phase: "loading",
          message: `Fetching contents of ${existingCollections.length} collections...`,
        });

        const collectionsWithItems = await Promise.all(
          existingCollections.map(async (collection) => {
            const items = await getCollectionItems(plexServerUrl, token, collection.ratingKey);
            return { ...collection, items };
          })
        );

        // Fetch previously suggested collections to avoid re-suggesting them
        // 1. Current scan's pending/approved (don't duplicate what's already in queue)
        const currentScanSuggestions = await db
          .select({
            collectionName: suggestions.collectionName,
            itemCount: suggestions.itemCount,
          })
          .from(suggestions)
          .where(
            and(
              eq(suggestions.scanId, scanId),
              inArray(suggestions.status, ["pending", "approved"])
            )
          );

        // 2. ALL rejected suggestions across ALL scans (respect user's rejections)
        const rejectedSuggestions = await db
          .select({
            collectionName: suggestions.collectionName,
            itemCount: suggestions.itemCount,
          })
          .from(suggestions)
          .where(eq(suggestions.status, "rejected"));

        // Combine and deduplicate by collection name
        const seenNames = new Set<string>();
        const previousSuggestions: PreviousSuggestion[] = [];

        for (const s of [...currentScanSuggestions, ...rejectedSuggestions]) {
          const normalized = s.collectionName.toLowerCase().trim();
          if (!seenNames.has(normalized)) {
            seenNames.add(normalized);
            previousSuggestions.push({
              collectionName: s.collectionName,
              itemCount: s.itemCount,
            });
          }
        }

        const allLibraryItems = [...allMovies, ...allShows];

        // =====================================================================
        // SEMANTIC PRE-FILTERING WITH EMBEDDINGS
        // =====================================================================
        // Use embeddings to find semantically similar items first, then only
        // send those candidates to the AI. This dramatically reduces token usage.

        send({
          type: "progress",
          phase: "analyzing",
          message: "Finding semantically similar items...",
          totalItems,
        });

        // Convert to embedding format (movies only for now - embeddings work on metadata)
        const moviesForEmbedding: MovieForEmbedding[] = allMovies.map((item) => ({
          ratingKey: item.ratingKey,
          title: item.title,
          year: item.year,
          genres: item.genres,
          summary: item.summary,
          directors: item.directors,
          actors: item.actors,
          studio: item.studio,
        }));

        // Find top candidates using semantic search
        // Use higher topK for custom search to ensure good coverage
        let candidateItems = allLibraryItems;

        if (moviesForEmbedding.length > 0) {
          try {
            const similarMovies = await embeddingQueryService.findSimilar(
              customPrompt,
              moviesForEmbedding,
              150, // top 150 candidates
              0.25 // lower threshold for broader coverage
            );

            if (similarMovies.length > 0) {
              const candidateKeys = new Set(similarMovies.map((m) => m.ratingKey));

              // Filter to only candidate items for AI processing
              // Always include shows since we don't have embeddings for them yet
              candidateItems = allLibraryItems.filter(
                (item) => candidateKeys.has(item.ratingKey) || !allMovies.includes(item)
              );

              console.log(
                `Semantic search: ${similarMovies.length} candidates from ${allMovies.length} movies (threshold 0.25)`
              );
              console.log(
                `Top 5 matches: ${similarMovies.slice(0, 5).map((m) => {
                  const movie = allMovies.find((i) => i.ratingKey === m.ratingKey);
                  return `${movie?.title} (${m.similarity.toFixed(3)})`;
                }).join(", ")}`
              );
            }
          } catch (err) {
            // If embedding search fails, fall back to all items
            console.error("Semantic search failed, using all items:", err);
          }
        }

        // =====================================================================
        // TWO-CALL ARCHITECTURE FOR CUSTOM SEARCH
        // =====================================================================

        // CALL 1: Audit existing collections for items matching user's criteria
        send({
          type: "progress",
          phase: "analyzing",
          message: `Checking existing collections for items matching "${customPrompt.slice(0, 30)}${customPrompt.length > 30 ? "..." : ""}"...`,
          totalItems: candidateItems.length,
        });

        let auditResults: ParsedCollection[] = [];
        if (collectionsWithItems.length > 0) {
          // Use candidateItems for more focused AI analysis
          const auditPrompt = createCustomAuditPrompt(collectionsWithItems, candidateItems, customPrompt);
          const { text: auditResponse } = await generateText({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            model: model as any,
            system: CUSTOM_AUDIT_SYSTEM_PROMPT,
            prompt: auditPrompt,
          });
          auditResults = parseAuditResponse(auditResponse);
        }

        // CALL 2: Find new collections matching user's criteria
        send({
          type: "progress",
          phase: "analyzing",
          message: `Analyzing ${candidateItems.length} candidate items...`,
          totalItems: candidateItems.length,
        });

        // Use candidateItems for focused AI analysis (pre-filtered by semantic search)
        const newCollectionsPrompt = createCustomNewCollectionsPrompt(
          candidateItems,
          customPrompt,
          existingCollections.map((c) => c.title),
          previousSuggestions
        );
        const { text: newCollectionsResponse } = await generateText({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model: model as any,
          system: CUSTOM_NEW_COLLECTIONS_SYSTEM_PROMPT,
          prompt: newCollectionsPrompt,
        });
        const newResults = parseAIResponse(newCollectionsResponse);

        send({
          type: "progress",
          phase: "saving",
          message: "Processing AI results...",
        });

        // Build set of valid rating keys
        const validKeys = new Set<string>();
        allLibraryItems.forEach((item) => validKeys.add(item.ratingKey));

        // Build lookup: collection name -> Set of rating keys already in it
        // This allows us to programmatically filter out items the AI suggests
        // that are already in the collection (AI sometimes misses this)
        const collectionItemKeys = new Map<string, Set<string>>();
        for (const collection of collectionsWithItems) {
          const keys = new Set(collection.items?.map((i) => i.ratingKey) || []);
          collectionItemKeys.set(collection.title.toLowerCase().trim(), keys);
        }

        // Validate audit results, filtering out items ALREADY in the collection
        // This ensures we only suggest genuinely missing items
        const validatedAuditResults = auditResults
          .map((collection) => {
            const existingKeys =
              collectionItemKeys.get(collection.name.toLowerCase().trim()) || new Set<string>();
            return {
              ...collection,
              items: collection.items.filter(
                (key) => validKeys.has(key) && !existingKeys.has(key)
              ),
            };
          })
          .filter((collection) => collection.items.length >= 1);

        // Validate new collection results (2+ items required for new collections)
        let validatedNewResults = validateCollections(newResults, validKeys);

        // Use AI to detect semantic duplicates ONLY for new collections (not audit additions)
        // Audit additions SHOULD match existing collection names - that's intentional
        if (validatedNewResults.length > 0 && existingCollections.length > 0) {
          send({
            type: "progress",
            phase: "saving",
            message: "Checking for duplicate collections...",
          });

          const fastModel = await getFastAIModel();
          if (fastModel) {
            const dedupePrompt = createDeduplicationPrompt(
              existingCollections.map((c) => ({ title: c.title, childCount: c.childCount || 0 })),
              validatedNewResults.map((c) => ({ name: c.name, itemCount: c.items.length }))
            );

            try {
              const { text: dedupeResponse } = await generateText({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                model: fastModel as any,
                system: DEDUPLICATION_SYSTEM_PROMPT,
                prompt: dedupePrompt,
              });

              const duplicates = parseDeduplicationResponse(dedupeResponse);
              if (duplicates.length > 0) {
                const duplicateNames = new Set(
                  duplicates.map((d) => d.suggested.toLowerCase().trim())
                );
                const beforeCount = validatedNewResults.length;
                validatedNewResults = validatedNewResults.filter(
                  (c) => !duplicateNames.has(c.name.toLowerCase().trim())
                );
                const filteredCount = beforeCount - validatedNewResults.length;
                if (filteredCount > 0) {
                  console.log(`Filtered ${filteredCount} duplicate new suggestions:`, duplicates);
                }
              }
            } catch (error) {
              // If deduplication fails, continue without filtering
              console.error("Deduplication check failed:", error);
            }
          }
        }

        // Merge: audit results (additions to existing) + deduped new collections
        let validatedCollections = [...validatedAuditResults, ...validatedNewResults];

        // =====================================================================
        // VALIDATION STEP: Verify each item belongs in its collection
        // =====================================================================
        if (validatedCollections.length > 0) {
          send({
            type: "progress",
            phase: "saving",
            message: `Validating ${validatedCollections.length} collection suggestions...`,
          });

          const validationModel = await getFastAIModel();
          if (validationModel) {
            const finalCollections: ParsedCollection[] = [];

            for (const collection of validatedCollections) {
              // Get full item details for validation
              const itemDetails = collection.items.map((key) => {
                const item = allLibraryItems.find((i) => i.ratingKey === key);
                return {
                  ratingKey: key,
                  title: item?.title || "Unknown",
                  year: item?.year,
                  summary: item?.summary,
                };
              });

              // Skip validation for very small collections (trust AI judgment)
              if (collection.items.length <= 2) {
                finalCollections.push(collection);
                continue;
              }

              try {
                // Validate items belong in collection
                const validationPrompt = createValidationPrompt(
                  collection.name,
                  collection.reasoning || "",
                  itemDetails
                );

                const { text: validationResponse } = await generateText({
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  model: validationModel as any,
                  system: VALIDATION_SYSTEM_PROMPT,
                  prompt: validationPrompt,
                });

                const validKeys = parseValidationResponse(validationResponse);

                // Filter to only validated items
                const validatedItems = collection.items.filter((key) =>
                  validKeys.has(key)
                );

                // Keep collection if it still has enough items (2+ for new, 1+ for audit)
                const isAuditAddition = validatedAuditResults.some(
                  (a) => a.name === collection.name
                );
                const minItems = isAuditAddition ? 1 : 2;

                if (validatedItems.length >= minItems) {
                  finalCollections.push({
                    ...collection,
                    items: validatedItems,
                  });
                  console.log(
                    `Validation: "${collection.name}" kept ${validatedItems.length}/${collection.items.length} items`
                  );
                } else {
                  console.log(
                    `Validation: "${collection.name}" filtered out (${validatedItems.length}/${collection.items.length} items passed)`
                  );
                }
              } catch (error) {
                // If validation fails, keep the collection as-is
                console.error(`Validation failed for "${collection.name}":`, error);
                finalCollections.push(collection);
              }
            }

            validatedCollections = finalCollections;
          }
        }

        if (validatedCollections.length === 0) {
          send({ type: "error", phase: "saving", error: "No items matching your criteria were found" });
          controller.close();
          return;
        }

        send({
          type: "progress",
          phase: "saving",
          message: `Saving ${validatedCollections.length} results...`,
        });

        // Build lookup map for enriching items with titles
        const mediaLookup = buildMediaLookup([...allMovies, ...allShows]);

        // Save suggestions to database with enriched items and custom prompt reference
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
              customPrompt: customPrompt.trim(),
            })
            .returning();

          suggestionIds.push(result[0].id);
        }

        // Send completion
        send({
          type: "complete",
          phase: "complete",
          message: `Found ${validatedCollections.length} collections matching your criteria`,
          suggestionsCount: validatedCollections.length,
          suggestionIds,
        });

        controller.close();
      } catch (error) {
        console.error("Custom analysis error:", error);
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
