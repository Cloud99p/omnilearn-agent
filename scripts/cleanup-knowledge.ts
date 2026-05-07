#!/usr/bin/env tsx
/**
 * Cleanup corrupted knowledge nodes
 * 
 * Removes nodes that contain meta-text from buggy responses:
 * - "That connects to what I've learned"
 * - "I've learned:"
 * - "Is there more you'd like to share"
 * - etc.
 * 
 * Usage: pnpm tsx scripts/cleanup-knowledge.ts
 */

import { db } from "@workspace/db";
import { knowledgeNodes } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

// Meta-phrases that indicate corrupted nodes
const META_PHRASES = [
  "that connects to what i've learned",
  "i've learned:",
  "is there more you'd like to share",
  "would you like me to remember",
  "based on what i've learned",
  "from my knowledge",
  "i've added this to my knowledge base",
  "thanks for sharing. i've learned",
];

async function cleanupKnowledge() {
  console.log("🧹 Starting knowledge cleanup...\n");

  // Get all nodes
  const allNodes = await db.select().from(knowledgeNodes);
  console.log(`Total nodes: ${allNodes.length}`);

  // Find corrupted nodes
  const corruptedNodes = allNodes.filter(node => {
    const content = node.content.toLowerCase();
    return META_PHRASES.some(phrase => content.includes(phrase));
  });

  console.log(`Corrupted nodes found: ${corruptedNodes.length}\n`);

  if (corruptedNodes.length === 0) {
    console.log("✅ No corrupted nodes found. Knowledge graph is clean!");
    return;
  }

  // Show corrupted nodes
  console.log("Corrupted nodes to delete:");
  corruptedNodes.forEach((node, i) => {
    console.log(`\n${i + 1}. [ID: ${node.id}]`);
    console.log(`   Content: "${node.content.slice(0, 100)}..."`);
    console.log(`   Created: ${node.createdAt}`);
  });

  // Confirm deletion
  console.log("\n⚠️  About to delete these nodes.");
  console.log("Press Ctrl+C to cancel, or wait 3 seconds to continue...\n");
  
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Delete corrupted nodes
  const deletedIds = corruptedNodes.map(n => n.id);
  
  await db.delete(knowledgeNodes).where(
    sql`id IN (${deletedIds})`
  );

  console.log(`✅ Deleted ${deletedIds.length} corrupted nodes.`);
  console.log(`\nRemaining nodes: ${allNodes.length - deletedIds.length}`);
  console.log("\n✨ Knowledge graph cleanup complete!\n");
}

// Run cleanup
cleanupKnowledge().catch(err => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
