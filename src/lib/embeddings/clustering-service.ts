/**
 * Clustering service for grouping movies by embedding similarity.
 * Uses K-means algorithm from ml-kmeans library.
 */

// Type for ml-kmeans result
interface KMeansResult {
  clusters: number[];
  centroids: number[][];
  iterations: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let kmeansModule: any = null;

async function getKMeans(): Promise<(data: number[][], k: number, options?: Record<string, unknown>) => KMeansResult> {
  if (!kmeansModule) {
    kmeansModule = await import("ml-kmeans");
  }
  return kmeansModule.kmeans;
}

export interface Cluster {
  id: number;
  movieIds: string[];
}

export interface ClusterOptions {
  /** Target number of clusters. If not provided, auto-calculated. */
  k?: number;
  /** Minimum cluster size to include. Default: 2 */
  minSize?: number;
  /** Maximum cluster size (splits larger clusters). Default: no limit */
  maxSize?: number;
  /** For auto K: minimum items per cluster target. Default: 3 */
  minItemsPerCluster?: number;
  /** For auto K: maximum items per cluster target. Default: 15 */
  maxItemsPerCluster?: number;
}

/**
 * Estimate optimal K based on dataset size and target cluster sizes.
 */
function estimateK(
  itemCount: number,
  minItemsPerCluster: number,
  maxItemsPerCluster: number
): number {
  // Target average cluster size
  const avgTarget = (minItemsPerCluster + maxItemsPerCluster) / 2;
  const k = Math.ceil(itemCount / avgTarget);

  // Clamp to reasonable bounds
  return Math.max(2, Math.min(k, Math.floor(itemCount / 2)));
}

/**
 * ClusteringService - groups movies by embedding similarity.
 */
export class ClusteringService {
  /**
   * Cluster movies based on their embeddings.
   * @param embeddings Map of movieId -> embedding vector
   * @param options Clustering options
   */
  async cluster(
    embeddings: Map<string, number[]>,
    options: ClusterOptions = {}
  ): Promise<Cluster[]> {
    const {
      minSize = 2,
      minItemsPerCluster = 3,
      maxItemsPerCluster = 15,
    } = options;

    // Convert to arrays
    const movieIds = Array.from(embeddings.keys());
    const embeddingArrays = movieIds.map((id) => embeddings.get(id)!);

    if (movieIds.length < 2) {
      return []; // Need at least 2 items to cluster
    }

    // Determine K
    let k = options.k;
    if (!k) {
      k = estimateK(movieIds.length, minItemsPerCluster, maxItemsPerCluster);
    }

    // Ensure k doesn't exceed data points
    k = Math.min(k, movieIds.length);

    // Run K-means
    const kmeansFunc = await getKMeans();
    const result = kmeansFunc(embeddingArrays, k, {
      initialization: "kmeans++",
      maxIterations: 100,
    });

    // Group movies by cluster
    const clusterGroups = new Map<number, string[]>();
    result.clusters.forEach((clusterId, idx) => {
      if (!clusterGroups.has(clusterId)) {
        clusterGroups.set(clusterId, []);
      }
      clusterGroups.get(clusterId)!.push(movieIds[idx]);
    });

    // Build cluster objects
    const clusters: Cluster[] = [];
    for (const [clusterId, clusterMovieIds] of clusterGroups) {
      // Skip small clusters
      if (clusterMovieIds.length < minSize) continue;

      clusters.push({
        id: clusterId,
        movieIds: clusterMovieIds,
      });
    }

    // Sort by cluster size (largest first)
    return clusters.sort((a, b) => b.movieIds.length - a.movieIds.length);
  }
}

// Singleton instance
export const clusteringService = new ClusteringService();
