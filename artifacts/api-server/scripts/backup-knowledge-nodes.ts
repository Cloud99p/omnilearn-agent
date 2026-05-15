#!/usr/bin/env tsx
/**
 * Backup all knowledge nodes to JSON before deletion
 * Usage: pnpm tsx scripts/backup-knowledge-nodes.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { knowledgeNodes } from "../../../lib/db/src/schema/knowledge-nodes.js";
import { desc } from "drizzle-orm";
import { writeFileSync } from "fs";
import { join } from "path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable not set");
  process.exit(1);
}

async function main() {
  console.log("📦 Backing up knowledge nodes...");

  const db = drizzle(DATABASE_URL);

  // Fetch all nodes
  const allNodes = await db
    .select()
    .from(knowledgeNodes)
    .orderBy(desc(knowledgeNodes.createdAt));

  console.log(`📊 Found ${allNodes.length} total nodes`);

  // Categorize by embedding status
  const withEmbeddings = allNodes.filter(
    (n) => n.embedding && Array.isArray(n.embedding) && n.embedding.length > 0,
  );
  const withoutEmbeddings = allNodes.filter(
    (n) =>
      !n.embedding || !Array.isArray(n.embedding) || n.embedding.length === 0,
  );

  console.log(`   • With embeddings: ${withEmbeddings.length}`);
  console.log(`   • Without embeddings: ${withoutEmbeddings.length}`);

  // Create backup object
  const backup = {
    timestamp: new Date().toISOString(),
    totalNodes: allNodes.length,
    withEmbeddings: withEmbeddings.length,
    withoutEmbeddings: withoutEmbeddings.length,
    nodes: allNodes.map((n) => ({
      id: n.id,
      clerkId: n.clerkId,
      content: n.content,
      type: n.type,
      tags: n.tags,
      source: n.source,
      confidence: n.confidence,
      timesAccessed: n.timesAccessed,
      timesConfirmed: n.timesConfirmed,
      tfidfVector: n.tfidfVector,
      tokens: n.tokens,
      hasEmbedding: !!(
        n.embedding &&
        Array.isArray(n.embedding) &&
        n.embedding.length > 0
      ),
      embedding: n.embedding,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })),
  };

  // Write backup file
  const backupPath = join(
    process.cwd(),
    `knowledge-nodes-backup-${Date.now()}.json`,
  );
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  console.log(`✅ Backup saved to: ${backupPath}`);
  console.log(
    `📁 File size: ${(Buffer.byteLength(JSON.stringify(backup), "utf8") / 1024).toFixed(2)} KB`,
  );

  // Also save nodes without embeddings separately for re-ingestion
  const nodesToReingest = withoutEmbeddings.map((n) => ({
    content: n.content,
    type: n.type,
    tags: n.tags,
    source: n.source,
    confidence: n.confidence,
    originalId: n.id,
  }));

  const reingestPath = join(
    process.cwd(),
    `nodes-to-reingest-${Date.now()}.json`,
  );
  writeFileSync(reingestPath, JSON.stringify(nodesToReingest, null, 2));

  console.log(`✅ Re-ingestion list saved to: ${reingestPath}`);
}

main().catch((err) => {
  console.error("❌ Backup failed:", err);
  process.exit(1);
});
