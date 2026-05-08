/**
 * Cleanup script for confused identity facts
 * 
 * This script identifies and removes identity-related knowledge nodes that
 * were stored without proper user attribution (clerkId), which causes the
 * AI to confuse different users' identities.
 * 
 * Run with: pnpm tsx scripts/cleanup-identity-facts.ts
 */

import { db } from "@workspace/db";
import { knowledgeNodes } from "@workspace/db/schema";
import { sql, eq, or } from "drizzle-orm";

// Patterns that indicate identity confusion
const IDENTITY_PATTERNS = [
  /i am (omni|the assistant|the ai|a|i)/i,
  /i'm (omni|the assistant|the ai|a|i)/i,
  /my name is (omni|assistant|ai)/i,
  /i am emmanuel/i,  // User identity stored as general knowledge
  /i'm emmanuel/i,
];

async function cleanup() {
  console.log("🔍 Scanning for confused identity facts...\n");

  // Get all nodes
  const allNodes = await db.select().from(knowledgeNodes);
  
  const confusedNodes = allNodes.filter(node => {
    // Check if content matches identity confusion patterns
    const matchesPattern = IDENTITY_PATTERNS.some(pattern => pattern.test(node.content));
    
    // Check if it's an identity-type node without clerkId (orphaned)
    const isOrphanedIdentity = node.type === "identity" && !node.clerkId;
    
    return matchesPattern || isOrphanedIdentity;
  });

  if (confusedNodes.length === 0) {
    console.log("✅ No confused identity facts found!");
    return;
  }

  console.log(`⚠️  Found ${confusedNodes.length} confused identity facts:\n`);
  
  confusedNodes.forEach((node, i) => {
    console.log(`${i + 1}. [${node.type}] ${node.content.slice(0, 100)}${node.content.length > 100 ? "..." : ""}`);
    console.log(`   ID: ${node.id} | clerkId: ${node.clerkId || "NULL"} | similarity: ${(node as any).similarity || "N/A"}`);
    console.log();
  });

  console.log("\n🗑️  Deleting confused identity facts...\n");
  
  const idsToDelete = confusedNodes.map(n => n.id);
  
  if (idsToDelete.length > 0) {
    await db.delete(knowledgeNodes).where(
      or(...idsToDelete.map(id => eq(knowledgeNodes.id, id)))
    );
    
    console.log(`✅ Deleted ${idsToDelete.length} confused identity facts`);
  }

  // Also update any remaining identity-type nodes without clerkId to be marked for review
  const remainingOrphans = await db.select().from(knowledgeNodes)
    .where(eq(knowledgeNodes.type, "identity"));
  
  if (remainingOrphans.length > 0 && remainingOrphans.some(n => !n.clerkId)) {
    console.log(`\n⚠️  Found ${remainingOrphans.filter(n => !n.clerkId).length} orphaned identity nodes without clerkId`);
    console.log("   These should be reviewed manually or assigned to appropriate users");
  }

  console.log("\n✅ Cleanup complete!");
}

cleanup().catch(err => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
