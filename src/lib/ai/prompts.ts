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

Handling existing collections (IMPORTANT):
- You will be given a list of collections that already exist in Plex
- For existing collections: Check if there are MORE items in the library that belong but aren't included yet. If so, suggest adding them using the EXACT same collection name
- For new collections: Only suggest if the idea is genuinely different from existing collections
- It's valuable to suggest additions to existing collections - don't skip them!

You MUST respond with valid JSON only. No markdown, no explanations outside JSON.`;

/**
 * Existing Plex collection info.
 */
export interface ExistingCollection {
  ratingKey: string;
  title: string;
  childCount?: number;
}

/**
 * Previously suggested collection info (from database).
 */
export interface PreviousSuggestion {
  collectionName: string;
  itemCount: number;
}

/**
 * User prompt for collection analysis.
 */
export function createCollectionAnalysisPrompt(
  movies: PlexMediaItem[],
  shows: PlexMediaItem[],
  existingCollections?: ExistingCollection[],
  previousSuggestions?: PreviousSuggestion[]
): string {
  const parts: string[] = [];

  // Include existing collections to avoid duplicates
  if (existingCollections && existingCollections.length > 0) {
    const existingNames = existingCollections.map((c) => `- "${c.title}" (${c.childCount || 0} items)`).join("\n");
    parts.push(`## EXISTING PLEX COLLECTIONS (DO NOT DUPLICATE)\n${existingNames}`);
  }

  // Include previously suggested collections (from our app) to avoid re-suggesting
  if (previousSuggestions && previousSuggestions.length > 0) {
    const previousNames = previousSuggestions.map((s) => `- "${s.collectionName}" (${s.itemCount} items)`).join("\n");
    parts.push(`## PREVIOUSLY SUGGESTED COLLECTIONS (DO NOT RE-SUGGEST)\nThese collections have already been suggested by previous analysis runs. Do not suggest these again:\n${previousNames}`);
  }

  if (movies.length > 0) {
    parts.push(`## Movies (${movies.length} items)\n${formatMediaForAI(movies)}`);
  }

  if (shows.length > 0) {
    parts.push(`## TV Shows (${shows.length} items)\n${formatMediaForAI(shows)}`);
  }

  const existingWarning = existingCollections && existingCollections.length > 0
    ? `- Review existing collections above - if you find items that SHOULD be in one but aren't, suggest adding them (use exact same name)
- For new collection ideas, make sure they're genuinely different from existing ones`
    : "";

  const previousWarning = previousSuggestions && previousSuggestions.length > 0
    ? `- DO NOT re-suggest collections listed in "PREVIOUSLY SUGGESTED COLLECTIONS" - those have already been analyzed`
    : "";

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
- Each collection needs at least 2 items
${existingWarning}
${previousWarning}`;
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

/**
 * System prompt for custom collection analysis.
 */
export const CUSTOM_ANALYSIS_SYSTEM_PROMPT = `You are an expert media librarian helping users find specific content in their Plex media library.

Your task is to analyze a list of movies and/or TV shows and find items that match the user's specific criteria.

Guidelines:
- Focus ONLY on what the user is asking for - don't suggest unrelated collections
- Group matching items into logical collections
- Each collection should have at least 2 items (preferably 3+)
- If you find matching items, explain WHY they match the criteria
- Be creative in interpreting the user's request
- If the criteria is too specific and no items match, suggest the closest alternatives
- IMPORTANT: Do NOT suggest collections that already exist in Plex (you will be given a list)
- If a collection already exists with a similar name, suggest adding items to it instead of creating a duplicate

You MUST respond with valid JSON only. No markdown, no explanations outside JSON.`;

/**
 * User prompt for custom collection analysis.
 */
export function createCustomAnalysisPrompt(
  movies: PlexMediaItem[],
  shows: PlexMediaItem[],
  customPrompt: string,
  existingCollections?: ExistingCollection[],
  previousSuggestions?: PreviousSuggestion[]
): string {
  const parts: string[] = [];

  // Include existing collections to avoid duplicates
  if (existingCollections && existingCollections.length > 0) {
    const existingNames = existingCollections.map((c) => `- "${c.title}" (${c.childCount || 0} items)`).join("\n");
    parts.push(`## EXISTING PLEX COLLECTIONS (DO NOT DUPLICATE)\n${existingNames}`);
  }

  // Include previously suggested collections (from our app) to avoid re-suggesting
  if (previousSuggestions && previousSuggestions.length > 0) {
    const previousNames = previousSuggestions.map((s) => `- "${s.collectionName}" (${s.itemCount} items)`).join("\n");
    parts.push(`## PREVIOUSLY SUGGESTED COLLECTIONS (DO NOT RE-SUGGEST)\nThese collections have already been suggested by previous analysis runs. Do not suggest these again:\n${previousNames}`);
  }

  if (movies.length > 0) {
    parts.push(`## Movies (${movies.length} items)\n${formatMediaForAI(movies)}`);
  }

  if (shows.length > 0) {
    parts.push(`## TV Shows (${shows.length} items)\n${formatMediaForAI(shows)}`);
  }

  const existingWarning = existingCollections && existingCollections.length > 0
    ? `- Do NOT create collections with names similar to the existing collections listed above
- If you want to suggest adding items to an existing collection, use the EXACT same name`
    : "";

  const previousWarning = previousSuggestions && previousSuggestions.length > 0
    ? `- DO NOT re-suggest collections listed in "PREVIOUSLY SUGGESTED COLLECTIONS" - those have already been analyzed`
    : "";

  return `User's request: "${customPrompt}"

Search through this media library and find items that match the user's criteria.

${parts.join("\n\n")}

Respond with JSON in this exact format:
{
  "collections": [
    {
      "name": "Collection Name (based on what was found)",
      "items": ["ratingKey1", "ratingKey2", "ratingKey3"],
      "reasoning": "Explanation of why these items match the user's criteria"
    }
  ]
}

Important:
- Use the exact ratingKey values from the input (the numbers in brackets like [12345])
- Only include items that actually exist in the input
- Create collections that directly address what the user asked for
- If the user's criteria results in multiple distinct groups, create separate collections
- Each collection needs at least 2 items
- If nothing matches exactly, include the closest matches and explain in the reasoning
${existingWarning}
${previousWarning}`;
}

/**
 * System prompt for deduplication analysis.
 */
export const DEDUPLICATION_SYSTEM_PROMPT = `You are a helpful assistant that identifies duplicate or semantically equivalent collection names.

Given a list of EXISTING collections and SUGGESTED collections, identify which suggestions are duplicates of existing collections.

Two collections are duplicates if:
- They have the same or very similar names (e.g., "John Wick" = "John Wick Series")
- They refer to the same franchise/grouping (e.g., "MCU" = "Marvel Cinematic Universe")
- One is a subset concept of the other (e.g., "Star Wars" encompasses "Star Wars Original Trilogy")

Return ONLY the suggested collection names that are duplicates.

You MUST respond with valid JSON only. No markdown, no explanations outside JSON.`;

/**
 * Create prompt for deduplication analysis.
 */
export function createDeduplicationPrompt(
  existingCollections: { title: string; childCount: number }[],
  suggestedCollections: { name: string; itemCount: number }[]
): string {
  const existing = existingCollections
    .map((c) => `- "${c.title}" (${c.childCount} items)`)
    .join("\n");

  const suggested = suggestedCollections
    .map((c) => `- "${c.name}" (${c.itemCount} items)`)
    .join("\n");

  return `## EXISTING PLEX COLLECTIONS
${existing}

## SUGGESTED NEW COLLECTIONS
${suggested}

Analyze which suggested collections are duplicates of existing collections.
Only flag a suggestion as duplicate if:
1. It's semantically the same collection (similar names, same franchise)
2. AND it doesn't have MORE items than the existing collection

Respond with JSON:
{
  "duplicates": [
    {
      "suggested": "Name of duplicate suggestion",
      "existingMatch": "Name of existing collection it matches",
      "reason": "Brief explanation"
    }
  ]
}

If no duplicates found, return: { "duplicates": [] }`;
}

/**
 * Parse deduplication response.
 */
export interface DuplicateMatch {
  suggested: string;
  existingMatch: string;
  reason: string;
}

export function parseDeduplicationResponse(response: string): DuplicateMatch[] {
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith("```")) {
    const lines = jsonStr.split("\n");
    jsonStr = lines.slice(1, -1).join("\n");
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed.duplicates) ? parsed.duplicates : [];
  } catch (error) {
    console.error("Failed to parse deduplication response:", error);
    return [];
  }
}
