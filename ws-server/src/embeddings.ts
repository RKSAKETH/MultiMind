// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pipeline, env } = require("@xenova/transformers");

// Allow remote model downloads
env.allowRemoteModels = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embeddingPipeline: any = null;

/**
 * Lazily initializes the feature-extraction pipeline.
 * On first call, downloads the model (~90MB) to local cache.
 * Subsequent calls reuse the cached model.
 */
async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log("[Embeddings] Loading all-MiniLM-L6-v2 model...");
    embeddingPipeline = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
    console.log("[Embeddings] Model loaded.");
  }
  return embeddingPipeline;
}

/**
 * Generates a 384-dimensional embedding vector for the given text.
 * Uses mean pooling and L2 normalization.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const extractor = await getEmbeddingPipeline();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: any = await extractor(text, { pooling: "mean", normalize: true });
  // output.data is a Float32Array — convert to plain number[]
  return Array.from(output.data as Float32Array) as number[];
}
