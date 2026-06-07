import { db, movieEmbeddings } from "@/lib/db";
import { inArray } from "drizzle-orm";
import crypto from "crypto";

// Dynamic import for @xenova/transformers (ESM module)
let pipeline: typeof import("@xenova/transformers").pipeline;
let extractor: Awaited<ReturnType<typeof pipeline>> | null = null;
let modelLoading: Promise<Awaited<ReturnType<typeof pipeline>>> | null = null;

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
const MODEL_VERSION = "v1"; // Increment to invalidate all cached embeddings
const SQLITE_PARAMETER_BATCH_SIZE = 500;

export type EmbeddingType = "title" | "summary" | "creator";

export interface MovieForEmbedding {
  ratingKey: string;
  title: string;
  year?: number;
  genres?: string[];
  summary?: string;
  directors?: string[];
  actors?: string[];
  studio?: string;
}

/**
 * Get the embedding extractor (lazy load).
 */
async function getExtractor() {
  if (extractor) return extractor;

  if (!modelLoading) {
    modelLoading = (async () => {
      // Dynamic import for ESM compatibility
      const transformers = await import("@xenova/transformers");
      pipeline = transformers.pipeline;

      console.log(`Loading embedding model: ${MODEL_NAME}...`);
      const ext = await pipeline("feature-extraction", MODEL_NAME, {
        quantized: true, // Use quantized model for smaller size
      });
      console.log("Embedding model loaded");
      return ext;
    })();
  }

  extractor = await modelLoading;
  return extractor;
}

/**
 * Generate text to embed based on type.
 */
function getTextForEmbedding(movie: MovieForEmbedding, type: EmbeddingType): string {
  switch (type) {
    case "title":
      // Strip subtitles/colons for franchise matching
      // "Star Wars: A New Hope" -> "Star Wars"
      // "Die Hard 2" -> "Die Hard"
      let title = movie.title;
      // Remove colon-separated subtitles
      if (title.includes(":")) {
        title = title.split(":")[0].trim();
      }
      // Remove number suffixes like "2", "II", "Part 2"
      title = title.replace(/\s+(\d+|II|III|IV|V|VI|VII|VIII|IX|X|Part\s+\d+)$/i, "");
      return title;

    case "summary":
      // Full summary + genres for thematic grouping
      const parts = [
        movie.summary || "",
        movie.genres?.join(", ") || "",
      ].filter(Boolean);
      return parts.join(" | ");

    case "creator":
      // Director + studio for filmography grouping
      const creatorParts = [
        movie.directors?.join(", ") || "",
        movie.studio || "",
      ].filter(Boolean);
      return creatorParts.join(" | ");
  }
}

/**
 * Compute hash of movie metadata for cache invalidation.
 */
function computeMetadataHash(movie: MovieForEmbedding): string {
  const key = JSON.stringify({
    title: movie.title,
    year: movie.year,
    genres: movie.genres,
    summary: movie.summary?.slice(0, 100), // First 100 chars of summary
    directors: movie.directors,
    studio: movie.studio,
  });
  return crypto.createHash("md5").update(key).digest("hex");
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Get cached embeddings for movies.
 */
async function getCachedEmbeddings(
  movieIds: string[],
  type: EmbeddingType
): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();
  if (movieIds.length === 0) return result;

  const cached = (
    await Promise.all(
      chunkArray(movieIds, SQLITE_PARAMETER_BATCH_SIZE).map((batch) =>
        db
          .select()
          .from(movieEmbeddings)
          .where(inArray(movieEmbeddings.movieId, batch))
      )
    )
  ).flat();

  for (const row of cached) {
    // Check model version
    if (row.modelVersion !== MODEL_VERSION) continue;

    let embeddingJson: string | null = null;
    switch (type) {
      case "title":
        embeddingJson = row.titleEmbedding;
        break;
      case "summary":
        embeddingJson = row.summaryEmbedding;
        break;
      case "creator":
        embeddingJson = row.creatorEmbedding;
        break;
    }

    if (embeddingJson) {
      try {
        result.set(row.movieId, JSON.parse(embeddingJson));
      } catch {
        // Invalid JSON, skip
      }
    }
  }

  return result;
}

/**
 * Save embeddings to cache.
 */
async function saveEmbeddings(
  embeddings: Map<string, number[]>,
  movies: Map<string, MovieForEmbedding>,
  type: EmbeddingType
): Promise<void> {
  for (const [movieId, embedding] of embeddings) {
    const movie = movies.get(movieId);
    if (!movie) continue;

    const metadataHash = computeMetadataHash(movie);
    const embeddingJson = JSON.stringify(embedding);

    const updateData: Partial<typeof movieEmbeddings.$inferInsert> = {
      metadataHash,
      modelVersion: MODEL_VERSION,
    };
    switch (type) {
      case "title":
        updateData.titleEmbedding = embeddingJson;
        break;
      case "summary":
        updateData.summaryEmbedding = embeddingJson;
        break;
      case "creator":
        updateData.creatorEmbedding = embeddingJson;
        break;
    }

    await db
      .insert(movieEmbeddings)
      .values({
        movieId,
        metadataHash,
        modelVersion: MODEL_VERSION,
        titleEmbedding: type === "title" ? embeddingJson : null,
        summaryEmbedding: type === "summary" ? embeddingJson : null,
        creatorEmbedding: type === "creator" ? embeddingJson : null,
      })
      .onConflictDoUpdate({
        target: movieEmbeddings.movieId,
        set: updateData,
      });
  }
}

/**
 * Compute embeddings for texts using the model.
 */
async function computeEmbeddings(texts: string[]): Promise<number[][]> {
  const ext = await getExtractor();
  const results: number[][] = [];

  // Process in batches
  const batchSize = 32;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    // Generate embeddings (type assertion needed for @xenova/transformers)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output = await (ext as any)(batch, {
      pooling: "mean",
      normalize: true,
    });

    // Extract embeddings from tensor
    for (let j = 0; j < batch.length; j++) {
      // output.data is a flat Float32Array, need to slice for each embedding
      const dims = output.dims;
      const embeddingSize = dims[dims.length - 1]; // Usually 384
      const start = j * embeddingSize;
      const embedding = Array.from(output.data.slice(start, start + embeddingSize)) as number[];
      results.push(embedding);
    }
  }

  return results;
}

/**
 * EmbeddingService - generates and caches movie embeddings.
 */
export class EmbeddingService {
  /**
   * Get embeddings for movies, using cache when available.
   */
  async getEmbeddings(
    movies: MovieForEmbedding[],
    type: EmbeddingType,
    onProgress?: (computed: number, total: number) => void
  ): Promise<Map<string, number[]>> {
    const movieMap = new Map(movies.map((m) => [m.ratingKey, m]));
    const movieIds = movies.map((m) => m.ratingKey);

    // Check cache
    const cached = await getCachedEmbeddings(movieIds, type);
    const needsCompute: MovieForEmbedding[] = [];

    for (const movie of movies) {
      if (!cached.has(movie.ratingKey)) {
        needsCompute.push(movie);
      }
    }

    if (needsCompute.length === 0) {
      console.log(`All ${movies.length} embeddings loaded from cache (${type})`);
      return cached;
    }

    console.log(
      `Computing ${needsCompute.length}/${movies.length} embeddings (${type})`
    );

    // Generate texts for embedding
    const texts = needsCompute.map((m) => getTextForEmbedding(m, type));

    // Compute embeddings
    const newEmbeddings = await computeEmbeddings(texts);

    // Build result map
    const computedMap = new Map<string, number[]>();
    needsCompute.forEach((movie, idx) => {
      computedMap.set(movie.ratingKey, newEmbeddings[idx]);
      onProgress?.(idx + 1, needsCompute.length);
    });

    // Save to cache
    await saveEmbeddings(computedMap, movieMap, type);

    // Merge with cached
    const result = new Map(cached);
    for (const [id, embedding] of computedMap) {
      result.set(id, embedding);
    }

    return result;
  }

  /**
   * Invalidate cached embeddings for specific movies.
   */
  async invalidate(movieIds: string[]): Promise<void> {
    if (movieIds.length === 0) return;

    for (const batch of chunkArray(movieIds, SQLITE_PARAMETER_BATCH_SIZE)) {
      await db
        .delete(movieEmbeddings)
        .where(inArray(movieEmbeddings.movieId, batch));
    }
  }

  /**
   * Invalidate all cached embeddings.
   */
  async invalidateAll(): Promise<void> {
    await db.delete(movieEmbeddings);
  }

  /**
   * Pre-warm the model (useful during Docker build).
   */
  async warmup(): Promise<void> {
    await getExtractor();
  }
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface SimilarMovie {
  ratingKey: string;
  similarity: number;
  embeddingType: EmbeddingType;
}

/**
 * EmbeddingQueryService - semantic search for movies using embeddings.
 */
export class EmbeddingQueryService {
  private service: EmbeddingService;

  constructor(service: EmbeddingService) {
    this.service = service;
  }

  /**
   * Embed a query string.
   */
  async embedQuery(query: string): Promise<number[]> {
    const embeddings = await computeEmbeddings([query]);
    return embeddings[0];
  }

  /**
   * Detect which embedding type(s) to use based on query content.
   * Returns ordered by relevance.
   */
  detectEmbeddingTypes(query: string): EmbeddingType[] {
    const q = query.toLowerCase();
    const types: EmbeddingType[] = [];

    // Creator signals: director, actor, producer, studio names
    const creatorPatterns = [
      /\b(directed|director|filmmaker|by)\b/,
      /\b(starring|actor|actress|with)\b.*\b(hanks|pitt|jolie|dicaprio|streep|cruise)\b/,
      /\b(studio|produced|production)\b/,
      /\b(nolan|spielberg|scorsese|tarantino|kubrick|coppola|fincher|villeneuve|anderson|coen)\b/,
    ];
    if (creatorPatterns.some((p) => p.test(q))) {
      types.push("creator");
    }

    // Title/franchise signals: specific movie/series names
    const titlePatterns = [
      /\b(sequel|trilogy|franchise|series|saga|part|episode)\b/,
      /\b(star wars|marvel|dc|harry potter|lord of the rings|james bond|fast and furious|mission impossible)\b/,
    ];
    if (titlePatterns.some((p) => p.test(q))) {
      types.push("title");
    }

    // Summary/theme signals: descriptive words about content
    const summaryPatterns = [
      /\b(about|theme|story|plot|involves?|featuring?)\b/,
      /\b(time travel|heist|romance|horror|comedy|action|thriller|mystery)\b/,
      /\b(emotional|funny|scary|dark|uplifting|sad)\b/,
      /\b(holiday|christmas|halloween|war|space|ocean|apocalypse)\b/,
    ];
    if (summaryPatterns.some((p) => p.test(q))) {
      types.push("summary");
    }

    // Default: use summary (most general) if no patterns matched
    if (types.length === 0) {
      types.push("summary");
    }

    // Always include summary as fallback if not already included
    if (!types.includes("summary") && types.length < 2) {
      types.push("summary");
    }

    return types;
  }

  /**
   * Find movies similar to a query using semantic search.
   * @param query The search query
   * @param movies The movies to search through
   * @param topK Maximum number of results
   * @param threshold Minimum similarity score (0-1)
   * @param types Embedding types to search (auto-detected if not provided)
   */
  async findSimilar(
    query: string,
    movies: MovieForEmbedding[],
    topK: number = 50,
    threshold: number = 0.3,
    types?: EmbeddingType[]
  ): Promise<SimilarMovie[]> {
    // Detect types if not provided
    const embeddingTypes = types || this.detectEmbeddingTypes(query);
    console.log(`Semantic search using embedding types: ${embeddingTypes.join(", ")}`);

    // Embed the query
    const queryEmbedding = await this.embedQuery(query);

    // Search across all specified embedding types
    const allResults: SimilarMovie[] = [];
    const seenKeys = new Set<string>();

    for (const type of embeddingTypes) {
      // Get embeddings for this type (uses cache)
      const movieEmbeddings = await this.service.getEmbeddings(movies, type);

      // Compute similarities
      for (const [ratingKey, embedding] of movieEmbeddings) {
        if (seenKeys.has(ratingKey)) continue; // Skip if already found via another type

        const similarity = cosineSimilarity(queryEmbedding, embedding);
        if (similarity >= threshold) {
          allResults.push({ ratingKey, similarity, embeddingType: type });
          seenKeys.add(ratingKey);
        }
      }
    }

    // Sort by similarity descending and take top K
    allResults.sort((a, b) => b.similarity - a.similarity);
    return allResults.slice(0, topK);
  }
}

// Singleton instances
export const embeddingService = new EmbeddingService();
export const embeddingQueryService = new EmbeddingQueryService(embeddingService);
