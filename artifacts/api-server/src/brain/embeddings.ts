// Semantic embeddings for OmniLearn knowledge retrieval
// Uses @xenova/transformers with all-MiniLM-L6-v2 (384-dim, fast, no GPU needed)

import { pipeline } from "@xenova/transformers";
import { logger } from "../lib/logger.js";

let embedder: any = null;
let embedderPromise: Promise<any> | null = null;

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const EMBEDDING_DIM = 384;

async function getEmbedder(): Promise<any> {
  if (embedder) return embedder;

  if (!embedderPromise) {
    embedderPromise = (async () => {
      try {
        logger.info({ model: MODEL_ID }, "Loading embedding model...");
        const start = Date.now();
        
        // Throttle progress logging to avoid rate limits
        const throttleMs = 500;
        let lastLogTime = 0;
        let lastLoggedProgress = -1;
        
        embedder = await pipeline("feature-extraction", MODEL_ID, {
          quantized: true,
          progress_callback: (progress: any) => {
            if (progress.status === "progress") {
              const now = Date.now();
              const currentProgress = Math.round(progress.progress);
              
              // Only log if enough time passed OR significant progress made
              const timeSinceLastLog = now - lastLogTime;
              const progressChanged = currentProgress - lastLoggedProgress >= 10;
              
              if (timeSinceLastLog >= throttleMs || progressChanged) {
                logger.info(
                  {
                    model: MODEL_ID,
                    progress: `${currentProgress}%`,
                    elapsed: now - start,
                  },
                  "Embedding model loading",
                );
                lastLogTime = now;
                lastLoggedProgress = currentProgress;
              }
            }
          },
        });
        logger.info(
          { model: MODEL_ID, loadTime: Date.now() - start },
          "Embedding model loaded",
        );
        return embedder;
      } catch (err) {
        logger.error({ err }, "Failed to load embedding model");
        embedderPromise = null;
        throw err;
      }
    })();
  }

  return embedderPromise;
}

export async function embedText(text: string): Promise<number[]> {
  try {
    const model = await getEmbedder();
    const output = await model(text, { pooling: "mean", normalize: true });
    const embedding = Array.from(output.data) as number[];
    if (embedding.length !== EMBEDDING_DIM) {
      logger.warn(
        { expected: EMBEDDING_DIM, got: embedding.length },
        "Unexpected embedding dimension",
      );
    }
    return embedding;
  } catch (err) {
    logger.error(
      { err, textLength: text.length },
      "Embedding generation failed",
    );
    throw err;
  }
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  try {
    const model = await getEmbedder();
    const BATCH_SIZE = 8;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const output = await model(batch, { pooling: "mean", normalize: true });
      const batchEmbeddings = [];
      for (let j = 0; j < batch.length; j++) {
        const start = j * EMBEDDING_DIM;
        const end = start + EMBEDDING_DIM;
        batchEmbeddings.push(
          Array.from(output.data.slice(start, end)) as number[],
        );
      }
      allEmbeddings.push(...batchEmbeddings);
    }
    return allEmbeddings;
  } catch (err) {
    logger.error({ err, textCount: texts.length }, "Batch embedding failed");
    throw err;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length)
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  let dotProduct = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

export function findSimilarEmbeddings<T>(
  queryEmbedding: number[],
  candidates: Array<{ id: number | string; embedding: number[]; metadata?: T }>,
  k: number = 10,
): Array<{ id: number | string; similarity: number; metadata?: T }> {
  const scored = candidates.map((candidate) => ({
    id: candidate.id,
    similarity: cosineSimilarity(queryEmbedding, candidate.embedding),
    metadata: candidate.metadata,
  }));
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}

logger.info("Embeddings module loaded (will load model on first use)");
