/**
 * Specialized prompts for each analysis pass.
 */

import { Cluster } from "./clustering-service";

export interface MovieInfo {
  ratingKey: string;
  title: string;
  year?: number;
  genres?: string[];
  summary?: string;
  directors?: string[];
  studio?: string;
}

// =============================================================================
// PASS 1: Franchise Detection
// =============================================================================

export const FRANCHISE_SYSTEM_PROMPT = `You are validating whether a group of movies belongs to the same franchise or series.

A franchise includes:
- Direct sequels/prequels (Die Hard, Die Hard 2)
- Same universe (MCU movies)
- Remakes that share the franchise (multiple Batman films)
- Spin-offs (Rogue One for Star Wars)

NOT a franchise:
- Movies by the same director (those go in director filmographies)
- Movies with similar themes (those are thematic collections)
- Movies with the same actor but different franchises

You MUST respond with valid JSON only.`;

export function createFranchisePrompt(
  cluster: Cluster,
  movies: Map<string, MovieInfo>
): string {
  const movieList = cluster.movieIds
    .map((id) => {
      const m = movies.get(id);
      if (!m) return null;
      return `- [${m.ratingKey}] ${m.title} (${m.year || "N/A"})`;
    })
    .filter(Boolean)
    .join("\n");

  return `These movies were grouped by title similarity. Determine if they belong to the same franchise.

Movies in cluster:
${movieList}

Respond with JSON:
{
  "isFranchise": true/false,
  "collectionName": "Suggested name if franchise (e.g., 'Star Wars Saga', 'Die Hard Collection')",
  "reasoning": "Brief explanation",
  "excludeIds": ["ratingKey of any movie that doesn't belong"]
}

If NOT a franchise, set isFranchise to false and collectionName to null.`;
}

export interface FranchiseResult {
  isFranchise: boolean;
  collectionName: string | null;
  reasoning: string;
  excludeIds: string[];
}

export function parseFranchiseResponse(response: string): FranchiseResult {
  let jsonStr = response.trim();
  if (jsonStr.startsWith("```")) {
    const lines = jsonStr.split("\n");
    jsonStr = lines.slice(1, -1).join("\n");
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      isFranchise: !!parsed.isFranchise,
      collectionName: parsed.collectionName || null,
      reasoning: parsed.reasoning || "",
      excludeIds: Array.isArray(parsed.excludeIds)
        ? parsed.excludeIds.map(String)
        : [],
    };
  } catch {
    return {
      isFranchise: false,
      collectionName: null,
      reasoning: "Failed to parse response",
      excludeIds: [],
    };
  }
}

// =============================================================================
// PASS 2: Creator Filmographies
// =============================================================================

export const CREATOR_SYSTEM_PROMPT = `You are validating whether a group of movies represents a coherent filmography collection.

A filmography includes:
- Movies directed by the same person (Christopher Nolan Films)
- Movies from the same studio/production company (Pixar Collection)
- Movies produced by a notable producer (Jerry Bruckheimer Films)

Requirements:
- At least 3 films by the same creator
- The creator should be notable enough to warrant a collection
- All films should be primarily associated with that creator

You MUST respond with valid JSON only.`;

export function createCreatorPrompt(
  cluster: Cluster,
  movies: Map<string, MovieInfo>
): string {
  const movieList = cluster.movieIds
    .map((id) => {
      const m = movies.get(id);
      if (!m) return null;
      return `- [${m.ratingKey}] ${m.title} (${m.year || "N/A"}) - Director: ${m.directors?.join(", ") || "Unknown"} | Studio: ${m.studio || "Unknown"}`;
    })
    .filter(Boolean)
    .join("\n");

  return `These movies were grouped by creator similarity. Determine if they represent a coherent filmography.

Movies in cluster:
${movieList}

Respond with JSON:
{
  "isFilmography": true/false,
  "collectionName": "Suggested name (e.g., 'Christopher Nolan Films', 'Pixar Collection')",
  "creatorType": "director" | "studio" | "producer" | null,
  "reasoning": "Brief explanation",
  "excludeIds": ["ratingKey of any movie that doesn't belong"]
}

If NOT a coherent filmography, set isFilmography to false.`;
}

export interface CreatorResult {
  isFilmography: boolean;
  collectionName: string | null;
  creatorType: "director" | "studio" | "producer" | null;
  reasoning: string;
  excludeIds: string[];
}

export function parseCreatorResponse(response: string): CreatorResult {
  let jsonStr = response.trim();
  if (jsonStr.startsWith("```")) {
    const lines = jsonStr.split("\n");
    jsonStr = lines.slice(1, -1).join("\n");
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      isFilmography: !!parsed.isFilmography,
      collectionName: parsed.collectionName || null,
      creatorType: parsed.creatorType || null,
      reasoning: parsed.reasoning || "",
      excludeIds: Array.isArray(parsed.excludeIds)
        ? parsed.excludeIds.map(String)
        : [],
    };
  } catch {
    return {
      isFilmography: false,
      collectionName: null,
      creatorType: null,
      reasoning: "Failed to parse response",
      excludeIds: [],
    };
  }
}

// =============================================================================
// PASS 3: Thematic Discovery
// =============================================================================

export const THEMATIC_SYSTEM_PROMPT = `You are naming and validating thematic movie collections.

Thematic collections group movies by:
- Genre combinations (Sci-Fi Horror)
- Time period settings (80s Nostalgia)
- Subject matter (Space Exploration, Heist Films)
- Mood/tone (Feel-Good Movies, Mind-Bending Thrillers)
- Awards/recognition (Oscar Winners)

Good thematic collections:
- Have a clear, specific theme
- Are interesting to browse
- Aren't too broad ("Drama" is too broad)
- Connect movies in unexpected ways

You MUST respond with valid JSON only.`;

export function createThematicPrompt(
  cluster: Cluster,
  movies: Map<string, MovieInfo>
): string {
  const movieList = cluster.movieIds
    .slice(0, 15) // Limit to prevent huge prompts
    .map((id) => {
      const m = movies.get(id);
      if (!m) return null;
      const summary = m.summary ? m.summary.slice(0, 150) + "..." : "No summary";
      return `- [${m.ratingKey}] ${m.title} (${m.year || "N/A"})
  Genres: ${m.genres?.join(", ") || "Unknown"}
  Summary: ${summary}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const additionalCount = cluster.movieIds.length - 15;
  const additionalNote =
    additionalCount > 0 ? `\n\n(+ ${additionalCount} more movies in this cluster)` : "";

  return `These movies were grouped by thematic similarity based on their summaries and genres.

Movies in cluster:
${movieList}${additionalNote}

Determine:
1. What theme connects these movies?
2. Is it specific enough to make a good collection?
3. What should it be called?

Respond with JSON:
{
  "isValidTheme": true/false,
  "collectionName": "Suggested name (e.g., 'Mind-Bending Thrillers', 'Coming-of-Age Stories')",
  "theme": "Brief description of the connecting theme",
  "reasoning": "Why these movies belong together",
  "excludeIds": ["ratingKey of any movie that doesn't fit the theme"]
}

If no clear theme connects these movies, set isValidTheme to false.`;
}

export interface ThematicResult {
  isValidTheme: boolean;
  collectionName: string | null;
  theme: string;
  reasoning: string;
  excludeIds: string[];
}

export function parseThematicResponse(response: string): ThematicResult {
  let jsonStr = response.trim();
  if (jsonStr.startsWith("```")) {
    const lines = jsonStr.split("\n");
    jsonStr = lines.slice(1, -1).join("\n");
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      isValidTheme: !!parsed.isValidTheme,
      collectionName: parsed.collectionName || null,
      theme: parsed.theme || "",
      reasoning: parsed.reasoning || "",
      excludeIds: Array.isArray(parsed.excludeIds)
        ? parsed.excludeIds.map(String)
        : [],
    };
  } catch {
    return {
      isValidTheme: false,
      collectionName: null,
      theme: "",
      reasoning: "Failed to parse response",
      excludeIds: [],
    };
  }
}

// =============================================================================
// PASS 4: Completeness Audit
// =============================================================================

export const COMPLETENESS_SYSTEM_PROMPT = `You are auditing suggested collections for completeness and finding any missed collections.

Your tasks:
1. For each suggested collection, identify any library items that should be added
2. Identify any obvious collections that were completely missed
3. Be thorough - this is the final check before suggestions go to the user

You MUST respond with valid JSON only.`;

export function createCompletenessPrompt(
  suggestedCollections: Array<{ name: string; movieIds: string[]; reasoning: string }>,
  allMovies: Map<string, MovieInfo>,
  existingPlexCollections: string[],
  options?: {
    libraryItemOffset?: number;
    libraryItemLimit?: number;
    totalLibraryItems?: number;
  }
): string {
  // Format suggested collections
  const suggestedSection = suggestedCollections
    .map((c) => {
      const movies = c.movieIds
        .slice(0, 5)
        .map((id) => {
          const m = allMovies.get(id);
          return m ? `${m.title} (${m.year || "N/A"})` : id;
        })
        .join(", ");
      const more = c.movieIds.length > 5 ? ` + ${c.movieIds.length - 5} more` : "";
      return `- "${c.name}": ${movies}${more}`;
    })
    .join("\n");

  // Format all library items (limited)
  const libraryItemOffset = options?.libraryItemOffset || 0;
  const libraryItemLimit = options?.libraryItemLimit || 100;
  const allMovieValues = Array.from(allMovies.values());
  const totalLibraryItems = options?.totalLibraryItems || allMovieValues.length;
  const visibleMovies = allMovieValues.slice(
    libraryItemOffset,
    libraryItemOffset + libraryItemLimit
  );

  const allMoviesSection = visibleMovies
    .map((m) => `[${m.ratingKey}] ${m.title} (${m.year || "N/A"}) - ${m.genres?.slice(0, 2).join(", ") || ""}`)
    .join("\n");

  const skippedBefore =
    libraryItemOffset > 0 ? `\n(+ ${libraryItemOffset} earlier library items not shown in this page)` : "";
  const skippedAfter = libraryItemOffset + visibleMovies.length < totalLibraryItems
    ? `\n(+ ${totalLibraryItems - libraryItemOffset - visibleMovies.length} later library items not shown in this page)`
    : "";

  // Existing collections
  const existingSection =
    existingPlexCollections.length > 0
      ? `## Existing Plex Collections (DO NOT DUPLICATE)\n${existingPlexCollections.map((n) => `- "${n}"`).join("\n")}`
      : "";

  return `## Suggested Collections So Far
${suggestedSection}

${existingSection}

## Library Items
${allMoviesSection}${skippedBefore}${skippedAfter}

## Your Tasks

1. **Find Missing Items**: For each suggested collection above, are there movies in the library that should be added?

2. **Find Missed Collections**: Are there obvious franchises, filmographies, or themes we completely missed?

Respond with JSON:
{
  "additions": [
    {
      "collectionName": "Exact name of existing suggestion",
      "addMovieIds": ["ratingKey1", "ratingKey2"],
      "reasoning": "Why these should be added"
    }
  ],
  "newCollections": [
    {
      "name": "New Collection Name",
      "movieIds": ["ratingKey1", "ratingKey2", "ratingKey3"],
      "reasoning": "Why this collection was missed and should exist"
    }
  ]
}

If nothing to add or no new collections, use empty arrays.`;
}

export interface CompletenessResult {
  additions: Array<{
    collectionName: string;
    addMovieIds: string[];
    reasoning: string;
  }>;
  newCollections: Array<{
    name: string;
    movieIds: string[];
    reasoning: string;
  }>;
}

export function parseCompletenessResponse(response: string): CompletenessResult {
  let jsonStr = response.trim();
  if (jsonStr.startsWith("```")) {
    const lines = jsonStr.split("\n");
    jsonStr = lines.slice(1, -1).join("\n");
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      additions: Array.isArray(parsed.additions)
        ? parsed.additions.map((a: CompletenessResult["additions"][0]) => ({
            collectionName: a.collectionName || "",
            addMovieIds: Array.isArray(a.addMovieIds)
              ? a.addMovieIds.map(String)
              : [],
            reasoning: a.reasoning || "",
          }))
        : [],
      newCollections: Array.isArray(parsed.newCollections)
        ? parsed.newCollections.map((c: CompletenessResult["newCollections"][0]) => ({
            name: c.name || "",
            movieIds: Array.isArray(c.movieIds) ? c.movieIds.map(String) : [],
            reasoning: c.reasoning || "",
          }))
        : [],
    };
  } catch {
    return {
      additions: [],
      newCollections: [],
    };
  }
}
