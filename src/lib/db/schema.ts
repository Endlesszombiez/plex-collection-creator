import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Settings table - stores user configuration
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Plex authentication
  plexToken: text("plex_token"), // Encrypted
  plexServerUrl: text("plex_server_url"),
  plexServerId: text("plex_server_id"),
  plexServerName: text("plex_server_name"),
  // AI provider configuration
  aiProvider: text("ai_provider"), // anthropic | bedrock | vertex | openai
  aiCredentials: text("ai_credentials"), // Encrypted JSON
  // Selected libraries for scanning
  selectedLibraries: text("selected_libraries"), // JSON array
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Scans table - tracks library scan history
export const scans = sqliteTable("scans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").notNull().default("pending"), // pending | running | completed | failed
  libraryCount: integer("library_count"),
  itemCount: integer("item_count"),
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Suggestions table - AI-generated collection suggestions
export const suggestions = sqliteTable("suggestions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scanId: integer("scan_id").references(() => scans.id),
  collectionName: text("collection_name").notNull(),
  reasoning: text("reasoning"), // AI's explanation for the suggestion
  items: text("items").notNull(), // JSON array of Plex rating keys
  itemCount: integer("item_count").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected | applied
  // Custom prompt that generated this (null for auto-scan)
  customPrompt: text("custom_prompt"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Applied collections table - tracks collections created in Plex
export const appliedCollections = sqliteTable("applied_collections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  suggestionId: integer("suggestion_id").references(() => suggestions.id),
  plexCollectionKey: text("plex_collection_key").notNull(),
  collectionName: text("collection_name").notNull(),
  itemCount: integer("item_count").notNull(),
  appliedAt: integer("applied_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Movie embeddings table - caches vector embeddings for clustering
export const movieEmbeddings = sqliteTable("movie_embeddings", {
  movieId: text("movie_id").primaryKey(), // Plex ratingKey
  titleEmbedding: text("title_embedding"), // JSON array of 384 floats
  summaryEmbedding: text("summary_embedding"), // JSON array of 384 floats
  creatorEmbedding: text("creator_embedding"), // JSON array of 384 floats
  metadataHash: text("metadata_hash"), // Hash to detect changes
  modelVersion: text("model_version"), // Track model version for invalidation
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

// Type exports for use in application code
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;

export type Scan = typeof scans.$inferSelect;
export type NewScan = typeof scans.$inferInsert;

export type Suggestion = typeof suggestions.$inferSelect;
export type NewSuggestion = typeof suggestions.$inferInsert;

export type AppliedCollection = typeof appliedCollections.$inferSelect;
export type NewAppliedCollection = typeof appliedCollections.$inferInsert;

export type MovieEmbedding = typeof movieEmbeddings.$inferSelect;
export type NewMovieEmbedding = typeof movieEmbeddings.$inferInsert;
