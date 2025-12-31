/**
 * Multi-pass analyzer for collection suggestions.
 * Orchestrates embeddings, clustering, and AI validation across 5 passes.
 */

import { PlexMediaItem, PlexCollection } from "@/lib/plex/client";
import { embeddingService, MovieForEmbedding } from "./embedding-service";
import { clusteringService } from "./clustering-service";
import {
  MovieInfo,
  FRANCHISE_SYSTEM_PROMPT,
  createFranchisePrompt,
  parseFranchiseResponse,
  CREATOR_SYSTEM_PROMPT,
  createCreatorPrompt,
  parseCreatorResponse,
  THEMATIC_SYSTEM_PROMPT,
  createThematicPrompt,
  parseThematicResponse,
  COMPLETENESS_SYSTEM_PROMPT,
  createCompletenessPrompt,
  parseCompletenessResponse,
} from "./pass-prompts";
import {
  VALIDATION_SYSTEM_PROMPT,
  createValidationPrompt,
  parseValidationResponse,
  ParsedCollection,
} from "@/lib/ai/prompts";
import { getConfiguredAIModel, getFastAIModel } from "@/lib/ai/provider";
import { generateText } from "ai";

export interface AnalysisProgress {
  pass: number;
  passName: string;
  message: string;
  collectionsFound?: number;
}

export interface AnalysisResult {
  collections: ParsedCollection[];
  passes: {
    franchises: number;
    filmographies: number;
    thematic: number;
    completeness: number;
    validated: number;
  };
}

/**
 * Convert PlexMediaItem to MovieForEmbedding.
 */
function toEmbeddingMovie(item: PlexMediaItem): MovieForEmbedding {
  return {
    ratingKey: item.ratingKey,
    title: item.title,
    year: item.year,
    genres: item.genres,
    summary: item.summary,
    directors: item.directors,
    actors: item.actors,
    studio: item.studio,
  };
}

/**
 * Convert PlexMediaItem to MovieInfo for prompts.
 */
function toMovieInfo(item: PlexMediaItem): MovieInfo {
  return {
    ratingKey: item.ratingKey,
    title: item.title,
    year: item.year,
    genres: item.genres,
    summary: item.summary,
    directors: item.directors,
    studio: item.studio,
  };
}

/**
 * MultiPassAnalyzer - orchestrates the 5-pass collection analysis.
 */
export class MultiPassAnalyzer {
  private onProgress?: (progress: AnalysisProgress) => void;

  constructor(onProgress?: (progress: AnalysisProgress) => void) {
    this.onProgress = onProgress;
  }

  private emit(pass: number, passName: string, message: string, collectionsFound?: number) {
    this.onProgress?.({ pass, passName, message, collectionsFound });
  }

  /**
   * Run full multi-pass analysis.
   */
  async analyze(
    movies: PlexMediaItem[],
    existingCollections: PlexCollection[]
  ): Promise<AnalysisResult> {
    const model = await getConfiguredAIModel();
    const fastModel = await getFastAIModel();

    if (!model) {
      throw new Error("AI not configured");
    }

    // Convert to internal formats
    const embeddingMovies = movies.map(toEmbeddingMovie);
    const movieInfoMap = new Map(movies.map((m) => [m.ratingKey, toMovieInfo(m)]));
    const existingNames = existingCollections.map((c) => c.title);

    // Track results
    const allCollections: ParsedCollection[] = [];
    const passStats = {
      franchises: 0,
      filmographies: 0,
      thematic: 0,
      completeness: 0,
      validated: 0,
    };

    // ==========================================================================
    // PASS 1: Franchise Detection
    // ==========================================================================
    this.emit(1, "Franchise Detection", "Generating title embeddings...");

    const titleEmbeddings = await embeddingService.getEmbeddings(
      embeddingMovies,
      "title"
    );

    this.emit(1, "Franchise Detection", "Clustering by title similarity...");

    const franchiseClusters = await clusteringService.cluster(titleEmbeddings, {
      minItemsPerCluster: 2,
      maxItemsPerCluster: 10,
      minSize: 2,
    });

    this.emit(
      1,
      "Franchise Detection",
      `Validating ${franchiseClusters.length} potential franchises...`
    );

    for (const cluster of franchiseClusters) {
      const prompt = createFranchisePrompt(cluster, movieInfoMap);
      try {
        const { text } = await generateText({
          model: (fastModel || model) as Parameters<typeof generateText>[0]["model"],
          system: FRANCHISE_SYSTEM_PROMPT,
          prompt,
        });

        const result = parseFranchiseResponse(text);
        if (result.isFranchise && result.collectionName) {
          // Filter excluded items
          const validIds = cluster.movieIds.filter(
            (id) => !result.excludeIds.includes(id)
          );

          if (validIds.length >= 2) {
            allCollections.push({
              name: result.collectionName,
              items: validIds,
              reasoning: result.reasoning,
            });
            passStats.franchises++;
          }
        }
      } catch (error) {
        console.error("Franchise validation error:", error);
      }
    }

    this.emit(1, "Franchise Detection", `Found ${passStats.franchises} franchises`, passStats.franchises);

    // ==========================================================================
    // PASS 2: Creator Filmographies
    // ==========================================================================
    this.emit(2, "Creator Filmographies", "Generating creator embeddings...");

    const creatorEmbeddings = await embeddingService.getEmbeddings(
      embeddingMovies,
      "creator"
    );

    this.emit(2, "Creator Filmographies", "Clustering by creator similarity...");

    const creatorClusters = await clusteringService.cluster(creatorEmbeddings, {
      minItemsPerCluster: 3,
      maxItemsPerCluster: 20,
      minSize: 3,
    });

    this.emit(
      2,
      "Creator Filmographies",
      `Validating ${creatorClusters.length} potential filmographies...`
    );

    for (const cluster of creatorClusters) {
      const prompt = createCreatorPrompt(cluster, movieInfoMap);
      try {
        const { text } = await generateText({
          model: (fastModel || model) as Parameters<typeof generateText>[0]["model"],
          system: CREATOR_SYSTEM_PROMPT,
          prompt,
        });

        const result = parseCreatorResponse(text);
        if (result.isFilmography && result.collectionName) {
          const validIds = cluster.movieIds.filter(
            (id) => !result.excludeIds.includes(id)
          );

          if (validIds.length >= 3) {
            allCollections.push({
              name: result.collectionName,
              items: validIds,
              reasoning: result.reasoning,
            });
            passStats.filmographies++;
          }
        }
      } catch (error) {
        console.error("Creator validation error:", error);
      }
    }

    this.emit(2, "Creator Filmographies", `Found ${passStats.filmographies} filmographies`, passStats.filmographies);

    // ==========================================================================
    // PASS 3: Thematic Discovery
    // ==========================================================================
    this.emit(3, "Thematic Discovery", "Generating summary embeddings...");

    const summaryEmbeddings = await embeddingService.getEmbeddings(
      embeddingMovies,
      "summary"
    );

    this.emit(3, "Thematic Discovery", "Clustering by thematic similarity...");

    const thematicClusters = await clusteringService.cluster(summaryEmbeddings, {
      minItemsPerCluster: 5,
      maxItemsPerCluster: 20,
      minSize: 3,
    });

    this.emit(
      3,
      "Thematic Discovery",
      `Naming ${thematicClusters.length} potential themes...`
    );

    for (const cluster of thematicClusters) {
      const prompt = createThematicPrompt(cluster, movieInfoMap);
      try {
        const { text } = await generateText({
          model: model as Parameters<typeof generateText>[0]["model"],
          system: THEMATIC_SYSTEM_PROMPT,
          prompt,
        });

        const result = parseThematicResponse(text);
        if (result.isValidTheme && result.collectionName) {
          const validIds = cluster.movieIds.filter(
            (id) => !result.excludeIds.includes(id)
          );

          if (validIds.length >= 3) {
            allCollections.push({
              name: result.collectionName,
              items: validIds,
              reasoning: result.reasoning,
            });
            passStats.thematic++;
          }
        }
      } catch (error) {
        console.error("Thematic validation error:", error);
      }
    }

    this.emit(3, "Thematic Discovery", `Found ${passStats.thematic} thematic collections`, passStats.thematic);

    // ==========================================================================
    // PASS 4: Completeness Audit
    // ==========================================================================
    this.emit(4, "Completeness Audit", "Checking for missing items and collections...");

    const suggestionsForAudit = allCollections.map((c) => ({
      name: c.name,
      movieIds: c.items,
      reasoning: c.reasoning,
    }));

    const completenessPrompt = createCompletenessPrompt(
      suggestionsForAudit,
      movieInfoMap,
      existingNames
    );

    try {
      const { text } = await generateText({
        model: model as Parameters<typeof generateText>[0]["model"],
        system: COMPLETENESS_SYSTEM_PROMPT,
        prompt: completenessPrompt,
      });

      const result = parseCompletenessResponse(text);

      // Apply additions to existing collections
      for (const addition of result.additions) {
        const existingCollection = allCollections.find(
          (c) => c.name.toLowerCase() === addition.collectionName.toLowerCase()
        );
        if (existingCollection) {
          // Add new movie IDs (avoid duplicates)
          const existingSet = new Set(existingCollection.items);
          for (const id of addition.addMovieIds) {
            if (!existingSet.has(id) && movieInfoMap.has(id)) {
              existingCollection.items.push(id);
              passStats.completeness++;
            }
          }
        }
      }

      // Add new collections
      for (const newCollection of result.newCollections) {
        // Validate IDs exist
        const validIds = newCollection.movieIds.filter((id) =>
          movieInfoMap.has(id)
        );
        if (validIds.length >= 2) {
          allCollections.push({
            name: newCollection.name,
            items: validIds,
            reasoning: newCollection.reasoning,
          });
          passStats.completeness++;
        }
      }
    } catch (error) {
      console.error("Completeness audit error:", error);
    }

    this.emit(4, "Completeness Audit", `Added ${passStats.completeness} items/collections`);

    // ==========================================================================
    // PASS 5: Final Validation
    // ==========================================================================
    this.emit(5, "Final Validation", "Validating all suggestions...");

    const validatedCollections: ParsedCollection[] = [];

    for (const collection of allCollections) {
      // Skip validation for small collections
      if (collection.items.length <= 2) {
        validatedCollections.push(collection);
        passStats.validated++;
        continue;
      }

      // Get item details for validation
      const itemDetails = collection.items.map((id) => {
        const m = movieInfoMap.get(id);
        return {
          ratingKey: id,
          title: m?.title || "Unknown",
          year: m?.year,
          summary: m?.summary,
        };
      });

      try {
        const validationPrompt = createValidationPrompt(
          collection.name,
          collection.reasoning,
          itemDetails
        );

        const { text } = await generateText({
          model: (fastModel || model) as Parameters<typeof generateText>[0]["model"],
          system: VALIDATION_SYSTEM_PROMPT,
          prompt: validationPrompt,
        });

        const validKeys = parseValidationResponse(text);
        const validatedItems = collection.items.filter((id) =>
          validKeys.has(id)
        );

        if (validatedItems.length >= 2) {
          validatedCollections.push({
            ...collection,
            items: validatedItems,
          });
          passStats.validated++;
        }
      } catch (error) {
        console.error("Validation error:", error);
        // Keep collection on error
        validatedCollections.push(collection);
        passStats.validated++;
      }
    }

    this.emit(5, "Final Validation", `Validated ${passStats.validated} collections`, passStats.validated);

    // Deduplicate by name (case-insensitive)
    const seenNames = new Set<string>();
    const deduped = validatedCollections.filter((c) => {
      const normalized = c.name.toLowerCase().trim();
      if (seenNames.has(normalized)) return false;
      seenNames.add(normalized);
      return true;
    });

    // Filter out collections that match existing Plex collections
    const existingNamesLower = new Set(existingNames.map((n) => n.toLowerCase().trim()));
    const final = deduped.filter(
      (c) => !existingNamesLower.has(c.name.toLowerCase().trim())
    );

    return {
      collections: final,
      passes: passStats,
    };
  }
}

/**
 * Create a multi-pass analyzer with progress callback.
 */
export function createMultiPassAnalyzer(
  onProgress?: (progress: AnalysisProgress) => void
): MultiPassAnalyzer {
  return new MultiPassAnalyzer(onProgress);
}
