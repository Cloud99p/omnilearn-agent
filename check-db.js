import { db } from "./src/db/index.js";
import { knowledgeNodes } from "./src/db/schema.js";
import { eq, sql } from "drizzle-orm";

async function checkKnowledgeGraph() {
  console.log("=== KNOWLEDGE GRAPH STATUS ===\n");
  
  // Count total nodes
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(knowledgeNodes);
  
  console.log(`Total nodes: ${count}`);
  
  // Get first 10 nodes
  const nodes = await db.select().from(knowledgeNodes).limit(10);
  
  console.log("\nFirst 10 nodes:");
  nodes.forEach((node, i) => {
    console.log(`\n${i + 1}. [${node.type}] ${node.content.slice(0, 100)}...`);
    console.log(`   Tags: ${node.tags.join(", ")}`);
    console.log(`   Similarity: N/A`);
  });
  
  // Search for octopus
  const octopusNodes = await db
    .select()
    .from(knowledgeNodes)
    .where(sql`content ILIKE '%octopus%'`);
  
  console.log(`\n\nOctopus nodes: ${octopusNodes.length}`);
  octopusNodes.forEach((node, i) => {
    console.log(`${i + 1}. ${node.content.slice(0, 150)}`);
  });
  
  // Check recent insertions
  const recentNodes = await db
    .select()
    .from(knowledgeNodes)
    .orderBy(sql`${knowledgeNodes.createdAt} DESC`)
    .limit(5);
  
  console.log("\n\nMost recent nodes:");
  recentNodes.forEach((node, i) => {
    console.log(`${i + 1}. [${node.source}] ${node.content.slice(0, 100)}...`);
  });
  
  await db.$disconnect();
}

checkKnowledgeGraph().catch(console.error);
