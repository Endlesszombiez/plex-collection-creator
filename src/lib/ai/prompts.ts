import { PlexMediaItem } from "@/lib/plex/client";

/**
 * Format media items for AI analysis.
 * Includes summary to help AI understand plot/setting for better collection matching.
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
      const mainLine = parts.filter(Boolean).join(" | ");

      // Add summary on new line if available - helps AI understand plot/setting
      if (item.summary) {
        return `${mainLine}\nSummary: ${item.summary}`;
      }
      return mainLine;
    })
    .join("\n\n");
}

/**
 * Item within a Plex collection.
 */
export interface CollectionItemInfo {
  ratingKey: string;
  title: string;
  year?: number;
}

/**
 * Existing Plex collection info.
 */
export interface ExistingCollection {
  ratingKey: string;
  title: string;
  childCount?: number;
  items?: CollectionItemInfo[];
}

/**
 * Previously suggested collection info (from database).
 */
export interface PreviousSuggestion {
  collectionName: string;
  itemCount: number;
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

// =============================================================================
// TWO-CALL ARCHITECTURE: Audit + New Suggestions
// =============================================================================

/**
 * System prompt for auditing existing collections for missing items.
 * This is CALL 1 of the two-call architecture.
 */
export const AUDIT_SYSTEM_PROMPT = `You are an expert media librarian auditing Plex collections for missing items.

Your ONLY task: Find items in the library that belong in existing collections but are missing.

For each existing collection:
1. Look at its current items
2. Search the library for related items: sequels, prequels, remakes, same franchise, same series, spinoffs
3. If you find missing items, include them in your response

IMPORTANT:
- Use the EXACT collection name from the input
- Only include items that are MISSING (not already in the collection)
- A collection with no missing items should NOT appear in your output
- Even finding ONE missing item is valuable
- Look carefully for numbered sequels (Part 2, II, 2, etc.) and related titles

You MUST respond with valid JSON only. No markdown, no explanations outside JSON.`;

/**
 * Create prompt for auditing existing collections.
 */
export function createAuditPrompt(
  existingCollections: ExistingCollection[],
  libraryItems: PlexMediaItem[]
): string {
  // Format existing collections with their items
  const collectionsSection = existingCollections.map((c) => {
    const itemList = c.items && c.items.length > 0
      ? c.items.map(i => `  - ${i.title}${i.year ? ` (${i.year})` : ""}`).join("\n")
      : "  (no items)";
    return `"${c.title}":\n${itemList}`;
  }).join("\n\n");

  // Format library items
  const librarySection = formatMediaForAI(libraryItems);

  return `## EXISTING COLLECTIONS TO AUDIT

${collectionsSection}

## LIBRARY ITEMS (search here for missing items)

${librarySection}

## YOUR TASK

For each existing collection above, check if any library items should be added to it.
Look for: sequels, prequels, spinoffs, remakes, same franchise, same series.

Respond with JSON:
{
  "additions": [
    {
      "name": "Exact Collection Name",
      "items": ["ratingKey1", "ratingKey2"],
      "reasoning": "Why these items belong in this collection"
    }
  ]
}

Important:
- Use the EXACT collection name from the existing collections list
- Use the exact ratingKey values (numbers in brackets like [12345])
- Only include items that are MISSING from the collection
- If no items are missing from any collection, return: { "additions": [] }`;
}

/**
 * Parse audit response into collection additions.
 */
export function parseAuditResponse(response: string): ParsedCollection[] {
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith("```")) {
    const lines = jsonStr.split("\n");
    jsonStr = lines.slice(1, -1).join("\n");
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Handle "additions" key (audit format)
    const additions = parsed.additions || [];
    if (!Array.isArray(additions)) {
      return [];
    }

    return additions.map((a: ParsedCollection) => ({
      name: a.name || "Unnamed Collection",
      items: Array.isArray(a.items) ? a.items.map(String) : [],
      reasoning: a.reasoning || "Adding missing items to existing collection",
    }));
  } catch (error) {
    console.error("Failed to parse audit response:", error);
    console.error("Raw response:", response);
    return [];
  }
}

/**
 * System prompt for suggesting new collections.
 * This is CALL 2 of the two-call architecture.
 */
export const NEW_COLLECTIONS_SYSTEM_PROMPT = `You are an expert media librarian suggesting new Plex collections.

Your ONLY task: Suggest NEW collection ideas for items that could be better organized.

Guidelines:
- Focus on: Franchises, Director filmographies, Shared universes, Thematic groupings
- Each collection needs at least 2 items (3+ preferred)
- Avoid overly broad categories ("Action Movies", "Comedy Films")
- Be specific with naming ("Quentin Tarantino Films" not "Tarantino")
- Do NOT suggest collections that already exist (you'll be given the list)
- Do NOT re-suggest previously rejected collections

You MUST respond with valid JSON only. No markdown, no explanations outside JSON.`;

/**
 * Create prompt for suggesting new collections.
 */
export function createNewCollectionsPrompt(
  libraryItems: PlexMediaItem[],
  existingCollectionNames: string[],
  previousSuggestions: PreviousSuggestion[]
): string {
  const parts: string[] = [];

  // List existing collection names to avoid
  if (existingCollectionNames.length > 0) {
    const namesList = existingCollectionNames.map(n => `- "${n}"`).join("\n");
    parts.push(`## EXISTING COLLECTIONS (DO NOT DUPLICATE)\nThese collections already exist in Plex:\n${namesList}`);
  }

  // List previously suggested collections to avoid
  if (previousSuggestions.length > 0) {
    const previousList = previousSuggestions.map(s => `- "${s.collectionName}"`).join("\n");
    parts.push(`## PREVIOUSLY SUGGESTED (DO NOT RE-SUGGEST)\nThese have already been suggested:\n${previousList}`);
  }

  // Add library items
  parts.push(`## LIBRARY ITEMS\n${formatMediaForAI(libraryItems)}`);

  return `${parts.join("\n\n")}

## YOUR TASK

Suggest NEW collections for items in the library. Look for:
- Movie franchises (trilogies, series)
- Director filmographies (3+ films by same director)
- Shared universes (MCU, DCEU, etc.)
- Thematic connections (heist films, time travel movies, etc.)

Respond with JSON:
{
  "collections": [
    {
      "name": "Collection Name",
      "items": ["ratingKey1", "ratingKey2", "ratingKey3"],
      "reasoning": "Why these items belong together"
    }
  ]
}

Important:
- Use the exact ratingKey values (numbers in brackets like [12345])
- Each collection needs at least 2 items
- Suggest 5-15 collections depending on library size
- Do NOT duplicate existing or previously suggested collections`;
}

// =============================================================================
// CUSTOM SEARCH: Two-Call Architecture
// =============================================================================

/**
 * System prompt for custom search - auditing existing collections.
 */
export const CUSTOM_AUDIT_SYSTEM_PROMPT = `You are an expert media librarian auditing Plex collections based on a user's specific search criteria.

Your ONLY task: Find items in the library that match the user's criteria AND belong in existing collections but are missing.

IMPORTANT:
- Only consider items that match the user's search criteria
- Use the EXACT collection name from the input
- Only include items that are MISSING (not already in the collection)
- A collection with no missing matching items should NOT appear in your output

You MUST respond with valid JSON only. No markdown, no explanations outside JSON.`;

/**
 * Create prompt for custom search - auditing existing collections.
 */
export function createCustomAuditPrompt(
  existingCollections: ExistingCollection[],
  libraryItems: PlexMediaItem[],
  customPrompt: string
): string {
  // Format existing collections with their items
  const collectionsSection = existingCollections.map((c) => {
    const itemList = c.items && c.items.length > 0
      ? c.items.map(i => `  - ${i.title}${i.year ? ` (${i.year})` : ""}`).join("\n")
      : "  (no items)";
    return `"${c.title}":\n${itemList}`;
  }).join("\n\n");

  // Format library items
  const librarySection = formatMediaForAI(libraryItems);

  return `## USER'S SEARCH CRITERIA
"${customPrompt}"

## EXISTING COLLECTIONS TO CHECK
${collectionsSection}

## LIBRARY ITEMS
${librarySection}

## YOUR TASK

Find items that:
1. Match the user's search criteria ("${customPrompt}")
2. Should be in one of the existing collections but are missing

Respond with JSON:
{
  "additions": [
    {
      "name": "Exact Collection Name",
      "items": ["ratingKey1"],
      "reasoning": "Why this item matches the criteria and belongs in this collection"
    }
  ]
}

Important:
- Use the EXACT collection name from the existing collections list
- Use the exact ratingKey values (numbers in brackets like [12345])
- Only include items that match the user's criteria AND are missing from collections
- If no matching items are missing, return: { "additions": [] }`;
}

/**
 * System prompt for custom search - suggesting new collections.
 */
export const CUSTOM_NEW_COLLECTIONS_SYSTEM_PROMPT = `You are an expert media librarian helping users find specific content in their Plex media library.

Your ONLY task: Find items matching the user's criteria and group them into meaningful collections.

Guidelines:
- Focus ONLY on what the user is asking for
- Group matching items into logical collections
- Each collection should have at least 2 items (preferably 3+)
- Explain WHY items match the criteria
- Do NOT suggest collections that already exist

You MUST respond with valid JSON only. No markdown, no explanations outside JSON.`;

/**
 * Create prompt for custom search - suggesting new collections.
 */
export function createCustomNewCollectionsPrompt(
  libraryItems: PlexMediaItem[],
  customPrompt: string,
  existingCollectionNames: string[],
  previousSuggestions: PreviousSuggestion[]
): string {
  const parts: string[] = [];

  // List existing collection names to avoid
  if (existingCollectionNames.length > 0) {
    const namesList = existingCollectionNames.map(n => `- "${n}"`).join("\n");
    parts.push(`## EXISTING COLLECTIONS (DO NOT DUPLICATE)\n${namesList}`);
  }

  // List previously suggested collections to avoid
  if (previousSuggestions.length > 0) {
    const previousList = previousSuggestions.map(s => `- "${s.collectionName}"`).join("\n");
    parts.push(`## PREVIOUSLY SUGGESTED (DO NOT RE-SUGGEST)\n${previousList}`);
  }

  // Add library items
  parts.push(`## LIBRARY ITEMS\n${formatMediaForAI(libraryItems)}`);

  return `## USER'S REQUEST
"${customPrompt}"

${parts.join("\n\n")}

## YOUR TASK

Find items that match the user's request and group them into collections.

Respond with JSON:
{
  "collections": [
    {
      "name": "Collection Name (based on what was found)",
      "items": ["ratingKey1", "ratingKey2", "ratingKey3"],
      "reasoning": "Why these items match the user's criteria"
    }
  ]
}

Important:
- Use the exact ratingKey values (numbers in brackets like [12345])
- Only include items that match the user's criteria
- Each collection needs at least 2 items
- If the user's criteria results in multiple groups, create separate collections
- Do NOT duplicate existing collections`;
}

// =============================================================================
// VALIDATION PROMPTS - Verify items belong in suggested collections
// =============================================================================

/**
 * System prompt for validating collection items.
 */
export const VALIDATION_SYSTEM_PROMPT = `You are validating whether media items belong in a collection.
For each item, determine if it truly fits the collection theme based on its summary and metadata.
Be strict - only say YES if the item clearly and unambiguously matches the collection theme.

Consider:
- Does the plot/setting match the collection theme?
- Is this a thematic fit or just a superficial connection?
- Would a user expect to find this item in this collection?`;

/**
 * Item info for validation.
 */
export interface ValidationItem {
  ratingKey: string;
  title: string;
  year?: number;
  summary?: string;
}

/**
 * Create a prompt to validate items in a collection.
 */
export function createValidationPrompt(
  collectionName: string,
  collectionReasoning: string,
  items: ValidationItem[]
): string {
  const itemsList = items
    .map(
      (i) =>
        `[${i.ratingKey}] ${i.title} (${i.year || "N/A"})\nSummary: ${i.summary || "No summary available"}`
    )
    .join("\n\n");

  return `Collection: "${collectionName}"
Theme: ${collectionReasoning || "No specific theme provided"}

For each item below, determine if it belongs in this collection.
Respond with the ratingKey followed by YES or NO.

${itemsList}

Response format (one per line):
[ratingKey] YES
[ratingKey] NO`;
}

/**
 * Parse validation response to get set of valid rating keys.
 */
export function parseValidationResponse(response: string): Set<string> {
  const validKeys = new Set<string>();
  const lines = response.split("\n");
  for (const line of lines) {
    const match = line.match(/\[(\d+)\]\s*YES/i);
    if (match) {
      validKeys.add(match[1]);
    }
  }
  return validKeys;
}
