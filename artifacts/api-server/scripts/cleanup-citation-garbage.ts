#!/usr/bin/env tsx
/**
 * Cleanup script: Remove knowledge nodes with citation marker garbage
 * 
 * These were created when web search was broken and storing content like:
 * "Ghengis Khan[a] (born Temüjin; [b] c" 
 * 
 * Run with: pnpm tsx scripts/cleanup-citation-garbage.ts
 */

import { db } from "@workspace/db";
import { knowledgeNodes } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

// Patterns that indicate citation marker garbage
const GARBAGE_PATTERNS = [
  /\[a\]/i,
  /\[b\]/i,
  /\[c\]/i,
  /\[\^[0-9]+\]/, // Wikipedia citation markers like [^1], [^2]
  /\[Open navigation\]/i,
  /\[Close navigation\]/i,
  /\[Jump to content\]/i,
  /\[Main menu\]/i,
  /\[x\].*\(\)/, // Empty links like [x] [](url)
];

async function main() {
  console.log("🔍 Scanning for knowledge nodes with citation garbage...\n");

  // Get all nodes
  const allNodes = await db.select().from(knowledgeNodes);
  
  const nodesToDelete: number[] = [];
  
  for (const node of allNodes) {
    const content = node.content;
    
    // Check if content matches any garbage pattern
    const isGarbage = GARBAGE_PATTERNS.some((pattern) => pattern.test(content));
    
    if (isGarbage) {
      nodesToDelete.push(node.id);
      console.log(`🗑️  [ID:${node.id}] ${content.slice(0, 80)}...`);
    }
  }

  if (nodesToDelete.length === 0) {
    console.log("✅ No garbage nodes found. Database is clean!");
    return;
  }

  console.log(`\n⚠️  Found ${nodesToDelete.length} nodes with citation garbage\n`);
  console.log("Press Ctrl+C to cancel, or wait 3 seconds to delete...\n");
  
  // Give a moment to cancel
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Delete the garbage nodes
  console.log("🗑️  Deleting garbage nodes...\n");
  
  const result = await db
    .delete(knowledgeNodes)
    .where(sql`id IN (${sql.join(nodesToDelete, sql`, `)})`);

  console.log(`✅ Deleted ${result.rowCount} garbage nodes!`);
  console.log("\n💡 Tip: Run this script again after deployment to catch any new garbage nodes.\n");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
