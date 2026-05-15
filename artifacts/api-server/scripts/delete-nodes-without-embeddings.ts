#!/usr/bin/env tsx
/**
 * Delete all knowledge nodes WITHOUT embeddings
 * ⚠️  RUN backup-knowledge-nodes.ts FIRST!
 * Usage: pnpm tsx scripts/delete-nodes-without-embeddings.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { knowledgeNodes } from "../../../lib/db/src/schema/knowledge-nodes.js";
import { eq, or, isNull, not } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable not set");
  process.exit(1);
}

async function main() {
  console.log(
    "⚠️  WARNING: This will DELETE all knowledge nodes WITHOUT embeddings!",
  );
  console.log("   Make sure you ran backup-knowledge-nodes.ts first!");
  console.log("");

  const db = drizzle(DATABASE_URL);

  // Count nodes without embeddings
  const allNodes = await db.select().from(knowledgeNodes);
  const withoutEmbeddings = allNodes.filter(
    (n) =>
      !n.embedding || !Array.isArray(n.embedding) || n.embedding.length === 0,
  );

  console.log(`📊 Total nodes: ${allNodes.length}`);
  console.log(`📊 Nodes WITHOUT embeddings: ${withoutEmbeddings.length}`);
  console.log(
    `📊 Nodes WITH embeddings: ${allNodes.length - withoutEmbeddings.length}`,
  );
  console.log("");

  if (withoutEmbeddings.length === 0) {
    console.log("✅ All nodes already have embeddings. Nothing to delete.");
    return;
  }

  console.log("🗑️  Deleting nodes without embeddings...");

  // Delete nodes where embedding is NULL or empty array
  const result = await db
    .delete(knowledgeNodes)
    .where(
      or(isNull(knowledgeNodes.embedding), eq(knowledgeNodes.embedding, [])),
    );

  console.log(`✅ Deleted ${withoutEmbeddings.length} nodes`);
  console.log("");

  // Verify remaining nodes
  const remaining = await db.select().from(knowledgeNodes);
  const remainingWithEmbeddings = remaining.filter(
    (n) => n.embedding && Array.isArray(n.embedding) && n.embedding.length > 0,
  );

  console.log(`📊 Remaining nodes: ${remaining.length}`);
  console.log(
    `📊 All remaining have embeddings: ${remainingWithEmbeddings.length === remaining.length ? "✅ YES" : "❌ NO"}`,
  );
}

main().catch((err) => {
  console.error("❌ Delete failed:", err);
  process.exit(1);
});
