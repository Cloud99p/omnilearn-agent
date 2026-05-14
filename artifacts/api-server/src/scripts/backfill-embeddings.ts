// Script to backfill embeddings for existing knowledge nodes
// Run with: pnpm --filter @workspace/api-server run backfill-embeddings

import { db } from "@workspace/db";
import { knowledgeNodes } from "@workspace/db/schema";
import { embedTexts } from "../brain/embeddings.js";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const BATCH_SIZE = 10;
const DELAY_MS = 200;

async function backfillEmbeddings() {
  logger.info("Starting embedding backfill...");
  const allNodes = await db.select().from(knowledgeNodes);
  const nodesWithoutEmbedding = allNodes.filter((n) => !n.embedding || n.embedding.length === 0);
  logger.info({ total: allNodes.length, withoutEmbedding: nodesWithoutEmbedding.length }, "Node counts");
  if (nodesWithoutEmbedding.length === 0) { logger.info("All nodes already have embeddings!"); return; }
  
  let processed = 0;
  const errors: Array<{ id: number; error: string }> = [];
  
  for (let i = 0; i < nodesWithoutEmbedding.length; i += BATCH_SIZE) {
    const batch = nodesWithoutEmbedding.slice(i, i + BATCH_SIZE);
    logger.info({ batch: Math.floor(i / BATCH_SIZE) + 1 }, "Processing batch");
    const contents = batch.map((n) => n.content);
    try {
      const embeddings = await embedTexts(contents);
      for (let j = 0; j < batch.length; j++) {
        const node = batch[j];
        const embedding = embeddings[j];
        if (!embedding) { errors.push({ id: node.id, error: "No embedding generated" }); continue; }
        await db.update(knowledgeNodes).set({ embedding, updatedAt: new Date() }).where(eq(knowledgeNodes.id, node.id));
        processed++;
        if (processed % 10 === 0) logger.info({ processed }, "Progress");
      }
    } catch (err) {
      logger.error({ err, batchStart: i }, "Batch failed");
      batch.forEach((n) => errors.push({ id: n.id, error: err instanceof Error ? err.message : String(err) }));
    }
    if (i + BATCH_SIZE < nodesWithoutEmbedding.length) await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }
  logger.info({ processed, errors: errors.length, total: allNodes.length }, "Backfill complete");
}

backfillEmbeddings().then(() => { logger.info("Done!"); process.exit(0); }).catch((err) => { logger.error({ err }, "Backfill failed"); process.exit(1); });
