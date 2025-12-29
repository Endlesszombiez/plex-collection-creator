import { PlexMediaItem } from "@/lib/plex/client";

/**
 * Format media items for AI analysis.
 * Reduces token usage by only including relevant metadata.
 */
export function formatMediaForAI(items: PlexMediaItem[]): string {
  return items
    .map((item) => {
      const parts = [
        `[${item.ratingKey}] ${item.title}`,
        item.year ? `(${item.year})` : "",
        item.genres.length > 0 ? `Genres: ${item.genres.join(", ")}` : "",
        item.directors.length > 0 ? `Director: ${item.directors.join(", ")}` : "",
        item.actors.length > 0 ? `Cast: ${item.actors.slice(0, 5).join(", ")}` : "",
        item.studio ? `Studio: ${item.studio}` : "",
      ];
      return parts.filter(Boolean).join(" | ");
    })
    .join("\n");
}

/**
 * System prompt for collection analysis.
 */
export const COLLECTION_ANALYSIS_SYSTEM_PROMPT = `You are an expert media librarian helping organize a Plex media library into meaningful collections.

Your task is to analyze a list of movies and/or TV shows and suggest logical collections that would help users discover and enjoy related content.

Guidelines for creating collections:
- Focus on meaningful groupings that users would actually want to browse
- Prioritize: Franchises, Director filmographies, Shared universes, Thematic connections, Decades/Eras
- Each collection should have at least 2 items (preferably 3+)
- Avoid overly broad categories (e.g., "Action Movies" with 50 items)
- Avoid single-item "collections"
- Be specific with naming (e.g., "Quentin Tarantino Films" not "Tarantino")

You MUST respond with valid JSON only. No markdown, no explanations outside JSON.`;

/**
 * User prompt for collection analysis.
 */
export function createCollectionAnalysisPrompt(
  movies: PlexMediaItem[],
  shows: PlexMediaItem[]
): string {
  const parts: string[] = [];

  if (movies.length > 0) {
    parts.push(`## Movies (${movies.length} items)\n${formatMediaForAI(movies)}`);
  }

  if (shows.length > 0) {
    parts.push(`## TV Shows (${shows.length} items)\n${formatMediaForAI(shows)}`);
  }

  return `Analyze this media library and suggest collections.

${parts.join("\n\n")}

Respond with JSON in this exact format:
{
  "collections": [
    {
      "name": "Collection Name",
      "items": ["ratingKey1", "ratingKey2", "ratingKey3"],
      "reasoning": "Brief explanation of why these items belong together"
    }
  ]
}

Important:
- Use the exact ratingKey values from the input (the numbers in brackets like [12345])
- Only include items that actually exist in the input
- Create 5-15 collections depending on library size
- Each collection needs at least 2 items`;
}

/**
 * Parse AI response into collection suggestions.
 */
export interface ParsedCollection {
  name: string;
  items: string[];
  reasoning: string;
}

export function parseAIResponse(response: string): ParsedCollection[] {
  // Try to extract JSON from response (handle markdown code blocks)
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith("```")) {
    const lines = jsonStr.split("\n");
    // Remove first line (```json) and last line (```)
    jsonStr = lines.slice(1, -1).join("\n");
  }

  try {
    const parsed = JSON.parse(jsonStr);

    if (!parsed.collections || !Array.isArray(parsed.collections)) {
      throw new Error("Response missing 'collections' array");
    }

    return parsed.collections.map((c: ParsedCollection) => ({
      name: c.name || "Unnamed Collection",
      items: Array.isArray(c.items) ? c.items.map(String) : [],
      reasoning: c.reasoning || "",
    }));
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    console.error("Raw response:", response);
    throw new Error("Failed to parse AI response as JSON");
  }
}

/**
 * Validate that suggested items exist in the original library.
 */
export function validateCollections(
  collections: ParsedCollection[],
  validRatingKeys: Set<string>
): ParsedCollection[] {
  return collections
    .map((collection) => ({
      ...collection,
      items: collection.items.filter((key) => validRatingKeys.has(key)),
    }))
    .filter((collection) => collection.items.length >= 2); // Require at least 2 items
}
