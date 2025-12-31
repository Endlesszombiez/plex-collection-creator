/**
 * Shared utilities for suggestion generation routes.
 */

import type { PlexMediaItem } from "./plex/client";

/**
 * Enriched item with rating key for Plex collection creation.
 */
export interface EnrichedItem {
  ratingKey: string;
  title: string;
  year?: number;
}

/**
 * Build a lookup map from rating keys to media info.
 */
export function buildMediaLookup(items: PlexMediaItem[]): Map<string, { title: string; year?: number }> {
  const lookup = new Map<string, { title: string; year?: number }>();
  for (const item of items) {
    lookup.set(item.ratingKey, { title: item.title, year: item.year });
  }
  return lookup;
}
