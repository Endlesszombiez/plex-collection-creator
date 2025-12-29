import { db, settings, scans } from "@/lib/db";
import { getLibraryItems, PlexMediaItem } from "@/lib/plex/client";
import { getPlexToken } from "@/lib/plex/auth";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface SavedLibrary {
  key: string;
  title: string;
  type: "movie" | "show";
  uuid: string;
}

interface ScanProgress {
  type: "progress" | "complete" | "error";
  phase: "init" | "scanning" | "complete";
  library?: string;
  libraryIndex?: number;
  totalLibraries?: number;
  itemsFetched?: number;
  totalItems?: number;
  message?: string;
  // Final result
  scanId?: number;
  movies?: PlexMediaItem[];
  shows?: PlexMediaItem[];
  totalMovies?: number;
  totalShows?: number;
  error?: string;
}

/**
 * GET /api/plex/scan
 * Scan all selected libraries and return metadata via SSE.
 */
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: ScanProgress) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Get saved settings
        const result = await db.select().from(settings).limit(1);
        if (result.length === 0) {
          send({ type: "error", phase: "init", error: "No settings found" });
          controller.close();
          return;
        }

        const { plexServerUrl, selectedLibraries } = result[0];

        if (!plexServerUrl) {
          send({ type: "error", phase: "init", error: "No Plex server configured" });
          controller.close();
          return;
        }

        const token = await getPlexToken();
        if (!token) {
          send({ type: "error", phase: "init", error: "No Plex token available" });
          controller.close();
          return;
        }

        let libraries: SavedLibrary[] = [];
        if (selectedLibraries) {
          try {
            libraries = JSON.parse(selectedLibraries);
          } catch {
            send({ type: "error", phase: "init", error: "Invalid library configuration" });
            controller.close();
            return;
          }
        }

        if (libraries.length === 0) {
          send({ type: "error", phase: "init", error: "No libraries selected" });
          controller.close();
          return;
        }

        // Create scan record
        const scanResult = await db.insert(scans).values({
          status: "running",
          libraryCount: libraries.length,
          startedAt: new Date(),
        }).returning();
        const scanId = scanResult[0].id;

        send({
          type: "progress",
          phase: "init",
          message: `Starting scan of ${libraries.length} libraries`,
          totalLibraries: libraries.length,
        });

        const allMovies: PlexMediaItem[] = [];
        const allShows: PlexMediaItem[] = [];

        // Scan each library
        for (let i = 0; i < libraries.length; i++) {
          const library = libraries[i];
          send({
            type: "progress",
            phase: "scanning",
            library: library.title,
            libraryIndex: i,
            totalLibraries: libraries.length,
            itemsFetched: 0,
            message: `Scanning ${library.title}...`,
          });

          try {
            const items = await getLibraryItems(
              plexServerUrl,
              token,
              library.key,
              (fetched, total) => {
                send({
                  type: "progress",
                  phase: "scanning",
                  library: library.title,
                  libraryIndex: i,
                  totalLibraries: libraries.length,
                  itemsFetched: fetched,
                  totalItems: total,
                  message: `Scanning ${library.title}: ${fetched}/${total} items`,
                });
              }
            );

            if (library.type === "movie") {
              allMovies.push(...items);
            } else {
              allShows.push(...items);
            }
          } catch (error) {
            console.error(`Error scanning library ${library.title}:`, error);
            // Continue with other libraries
          }
        }

        // Update scan record
        await db
          .update(scans)
          .set({
            status: "completed",
            itemCount: allMovies.length + allShows.length,
            completedAt: new Date(),
          })
          .where(eq(scans.id, scanId));

        // Send final result
        send({
          type: "complete",
          phase: "complete",
          scanId,
          movies: allMovies,
          shows: allShows,
          totalMovies: allMovies.length,
          totalShows: allShows.length,
          message: `Scan complete: ${allMovies.length} movies, ${allShows.length} shows`,
        });

        controller.close();
      } catch (error) {
        console.error("Scan error:", error);
        send({
          type: "error",
          phase: "scanning",
          error: error instanceof Error ? error.message : "Scan failed",
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
