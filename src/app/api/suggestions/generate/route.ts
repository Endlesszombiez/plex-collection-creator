import { db, settings, scans, suggestions } from "@/lib/db";
import { getLibraryItems, PlexMediaItem } from "@/lib/plex/client";
import { getPlexToken } from "@/lib/plex/auth";
import { getConfiguredAIModel } from "@/lib/ai/provider";
import {
  COLLECTION_ANALYSIS_SYSTEM_PROMPT,
  createCollectionAnalysisPrompt,
  parseAIResponse,
  validateCollections,
} from "@/lib/ai/prompts";
import { generateText } from "ai";
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

        send({
          type: "progress",
          phase: "analyzing",
          message: `Analyzing ${allMovies.length} movies and ${allShows.length} TV shows...`,
          totalItems,
        });

        // Create prompt and call AI
        const prompt = createCollectionAnalysisPrompt(allMovies, allShows);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { text: aiResponse } = await generateText({
          model: model as any,
          system: COLLECTION_ANALYSIS_SYSTEM_PROMPT,
          prompt,
        });

        send({
          type: "progress",
          phase: "saving",
          message: "Processing AI suggestions...",
        });

        // Parse and validate response
        const parsedCollections = parseAIResponse(aiResponse);

        // Build set of valid rating keys
        const validKeys = new Set<string>();
        [...allMovies, ...allShows].forEach((item) => validKeys.add(item.ratingKey));

        const validatedCollections = validateCollections(parsedCollections, validKeys);

        if (validatedCollections.length === 0) {
          send({ type: "error", phase: "saving", error: "AI did not generate any valid collections" });
          controller.close();
          return;
        }

        send({
          type: "progress",
          phase: "saving",
          message: `Saving ${validatedCollections.length} suggestions...`,
        });

        // Save suggestions to database
        const suggestionIds: number[] = [];

        for (const collection of validatedCollections) {
          const result = await db
            .insert(suggestions)
            .values({
              scanId,
              collectionName: collection.name,
              items: JSON.stringify(collection.items),
              itemCount: collection.items.length,
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
