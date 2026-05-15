#!/usr/bin/env tsx
/**
 * Re-ingest knowledge nodes with embeddings
 * Reads from backup file and re-adds nodes with proper embeddings
 * Usage: pnpm tsx scripts/reingest-knowledge-nodes.ts <backup-file.json>
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { knowledgeNodes } from "../../../lib/db/src/schema/knowledge-nodes.js";
import { embedTexts } from "../src/brain/embeddings.js";
import { readFileSync } from "fs";
import { logger } from "../src/lib/logger.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable not set");
  process.exit(1);
}

const BACKUP_FILE = process.argv[2];
if (!BACKUP_FILE) {
  console.error(
    "❌ Usage: pnpm tsx scripts/reingest-knowledge-nodes.ts <backup-file.json>",
  );
  console.error(
    "   Example: pnpm tsx scripts/reingest-knowledge-nodes.ts knowledge-nodes-backup-1234567890.json",
  );
  process.exit(1);
}

interface BackupNode {
  id: number;
  clerkId: string | null;
  content: string;
  type: string;
  tags: string[];
  source: string;
  confidence: number;
  timesAccessed: number;
  timesConfirmed: number;
  tfidfVector: Record<string, number>;
  tokens: string[];
  hasEmbedding: boolean;
  embedding: number[] | null;
  createdAt: string;
  updatedAt: string;
}

async function main() {
  console.log(`📥 Re-ingesting knowledge nodes from: ${BACKUP_FILE}`);
  console.log("");

  // Read backup file
  let backup: { nodes: BackupNode[] };
  try {
    const raw = readFileSync(BACKUP_FILE, "utf-8");
    backup = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ Failed to read backup file: ${err}`);
    process.exit(1);
  }

  const nodesToReingest = backup.nodes.filter((n) => !n.hasEmbedding);
  const nodesWithEmbeddings = backup.nodes.filter((n) => n.hasEmbedding);

  console.log(`📊 Total nodes in backup: ${backup.nodes.length}`);
  console.log(
    `📊 Nodes already with embeddings: ${nodesWithEmbeddings.length} (skipping)`,
  );
  console.log(`📊 Nodes to re-ingest: ${nodesToReingest.length}`);
  console.log("");

  if (nodesToReingest.length === 0) {
    console.log("✅ All nodes already have embeddings. Nothing to re-ingest.");
    return;
  }

  const db = drizzle(DATABASE_URL);

  // Process in batches of 10 to avoid overwhelming the embedding model
  const BATCH_SIZE = 10;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < nodesToReingest.length; i += BATCH_SIZE) {
    const batch = nodesToReingest.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(nodesToReingest.length / BATCH_SIZE);

    console.log(
      `🔄 Processing batch ${batchNum}/${totalBatches} (${batch.length} nodes)...`,
    );

    // Generate embeddings for this batch
    const texts = batch.map((n) => n.content);
    let embeddings: number[][];

    try {
      embeddings = await embedTexts(texts);
    } catch (err) {
      console.error(
        `❌ Failed to generate embeddings for batch ${batchNum}:`,
        err,
      );
      failed += batch.length;
      continue;
    }

    // Insert nodes with embeddings
    for (let j = 0; j < batch.length; j++) {
      const node = batch[j];
      const embedding = embeddings[j];

      try {
        await db.insert(knowledgeNodes).values({
          clerkId: node.clerkId,
          content: node.content,
          type: node.type,
          tags: node.tags,
          source: node.source,
          confidence: node.confidence,
          timesAccessed: node.timesAccessed,
          timesConfirmed: node.timesConfirmed,
          tfidfVector: node.tfidfVector,
          tokens: node.tokens,
          embedding: embedding,
        });
        inserted++;

        if (inserted % 20 === 0) {
          console.log(
            `   ✓ Inserted ${inserted}/${nodesToReingest.length} nodes...`,
          );
        }
      } catch (err) {
        console.error(`❌ Failed to insert node ${node.id}:`, err);
        failed++;
      }
    }
  }

  console.log("");
  console.log("✅ Re-ingestion complete!");
  console.log(`   • Inserted: ${inserted}`);
  console.log(`   • Failed: ${failed}`);
  console.log(`   • Already had embeddings: ${nodesWithEmbeddings.length}`);
  console.log(`   • Total in DB: ${inserted + nodesWithEmbeddings.length}`);
}

main().catch((err) => {
  console.error("❌ Re-ingestion failed:", err);
  process.exit(1);
});
