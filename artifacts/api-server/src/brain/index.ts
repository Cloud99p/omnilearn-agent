import { db } from "@workspace/db";
import {
  knowledgeNodes, knowledgeEdges, characterState, learningLog,
  type KnowledgeNode, type CharacterState,
} from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { tokenize, queryScore, buildTfidfVector, computeIdfFromVectors } from "./tfidf.js";
import { extractFacts, detectQueryType, extractKeyTerms } from "./extractor.js";
import {
  applyDeltas, computeTraitDeltaFromLearning,
  detectTechnicalContent, detectEmotionalContent,
} from "./character.js";
import {
  synthesizeResponse, synthesizeLearningAck, synthesizeStatusResponse,
  type RetrievedNode,
} from "./synthesizer.js";
import { SEED_KNOWLEDGE } from "./seed.js";
import { logger } from "../lib/logger.js";

// ──────────────────────────────────────────────────────────────────────────────
// Character state (per clerkId or global)
// ──────────────────────────────────────────────────────────────────────────────

export async function getOrCreateCharacter(clerkId: string | null): Promise<CharacterState> {
  const [existing] = await db
    .select()
    .from(characterState)
    .where(clerkId ? eq(characterState.clerkId, clerkId) : sql`clerk_id IS NULL`)
    .limit(1);

  if (existing) return existing;

  const [created] = await db.insert(characterState).values({ clerkId }).returning();
  return created;
}

async function updateCharacter(id: number, updates: Partial<CharacterState>): Promise<void> {
  await db
    .update(characterState)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(characterState.id, id));
}

// ──────────────────────────────────────────────────────────────────────────────
// Knowledge retrieval
// ──────────────────────────────────────────────────────────────────────────────

async function getAllNodes(clerkId: string | null): Promise<KnowledgeNode[]> {
  // Return global seed nodes + any clerkId-specific nodes
  return db.select().from(knowledgeNodes);
}

export async function retrieveRelevantNodes(
  query: string,
  clerkId: string | null,
  topK = 6,
): Promise<RetrievedNode[]> {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const allNodes = await getAllNodes(clerkId);
  if (allNodes.length === 0) return [];

  const allVectors = allNodes.map(n => n.tfidfVector as Record<string, number>);

  const scored: RetrievedNode[] = allNodes
    .map(node => {
      const nodeVec = node.tfidfVector as Record<string, number>;
      const nodeTokens = node.tokens as string[];
      const similarity = queryScore(queryTokens, nodeTokens, nodeVec, allVectors);
      return { ...node, similarity };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  // Bump access count for top results
  const topIds = scored.filter(n => n.similarity > 0.1).map(n => n.id);
  if (topIds.length > 0) {
    await Promise.all(
      topIds.map(id =>
        db.update(knowledgeNodes)
          .set({ timesAccessed: sql`times_accessed + 1` })
          .where(eq(knowledgeNodes.id, id))
      )
    );
  }

  return scored;
}

// ──────────────────────────────────────────────────────────────────────────────
// Knowledge insertion
// ──────────────────────────────────────────────────────────────────────────────

async function insertNode(
  content: string,
  type: string,
  tags: string[],
  confidence: number,
  source: string,
  clerkId: string | null,
): Promise<KnowledgeNode> {
  const tokens = tokenize(content);

  // Get existing vectors for IDF
  const existing = await db.select({ vec: knowledgeNodes.tfidfVector }).from(knowledgeNodes);
  const existingVecs = existing.map(r => r.vec as Record<string, number>);

  const idf = computeIdfFromVectors(existingVecs);
  const tfidfVector = buildTfidfVector(tokens, idf);

  const [node] = await db.insert(knowledgeNodes).values({
    content,
    type,
    tags,
    source,
    confidence,
    tokens,
    tfidfVector,
    clerkId,
  }).returning();

  return node;
}

// ──────────────────────────────────────────────────────────────────────────────
// Seeding
// ──────────────────────────────────────────────────────────────────────────────

export async function seedIfEmpty(): Promise<void> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(knowledgeNodes);
  if (Number(count) > 0) return;

  logger.info("Seeding OmniLearn knowledge base with initial facts...");
  for (const fact of SEED_KNOWLEDGE) {
    await insertNode(fact.content, fact.type, fact.tags, fact.confidence, "seed", null);
  }
  logger.info(`Seeded ${SEED_KNOWLEDGE.length} initial knowledge nodes.`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Main brain: process a message
// ──────────────────────────────────────────────────────────────────────────────

export interface BrainResponse {
  text: string;
  nodesUsed: number;
  newNodesAdded: number;
  character: CharacterState;
}

export async function processMessage(
  userMessage: string,
  clerkId: string | null,
  history: Array<{ role: string; content: string }>,
): Promise<BrainResponse> {
  const character = await getOrCreateCharacter(clerkId);

  // Detect special commands
  const lower = userMessage.trim().toLowerCase();
  if (lower === "status" || lower === "system status" || lower === "/status") {
    const [{ nc }] = await db.select({ nc: sql<number>`count(*)` }).from(knowledgeNodes);
    const [{ ec }] = await db.select({ ec: sql<number>`count(*)` }).from(knowledgeEdges);
    const text = synthesizeStatusResponse(Number(nc), Number(ec), character);
    return { text, nodesUsed: 0, newNodesAdded: 0, character };
  }

  // 1. Extract new knowledge from the user's message
  const extractedFacts = extractFacts(userMessage);
  let newNodesAdded = 0;
  const isTechnical = detectTechnicalContent(userMessage);
  const isEmotional = detectEmotionalContent(userMessage);

  for (const fact of extractedFacts) {
    try {
      // Avoid near-duplicate nodes
      const existing = await retrieveRelevantNodes(fact.content, clerkId, 1);
      if (existing.length > 0 && existing[0].similarity > 0.85) continue;

      await insertNode(fact.content, fact.type, fact.tags, fact.confidence, "conversation", clerkId);
      newNodesAdded++;
    } catch { /* skip duplicate insertions */ }
  }

  // 2. Retrieve relevant knowledge for the query
  const queryType = detectQueryType(userMessage);
  const keyTerms = extractKeyTerms(userMessage);
  const searchQuery = [userMessage, ...keyTerms].join(" ");

  const retrieved = await retrieveRelevantNodes(searchQuery, clerkId, 6);

  // 3. Determine if this is primarily a "teach me" statement vs a question
  const isTeaching = queryType === "statement" && newNodesAdded > 0 && retrieved[0]?.similarity < 0.25;

  let text: string;
  if (isTeaching) {
    const mainTopic = keyTerms[0] ?? extractKeyTerms(userMessage)[0] ?? "this topic";
    text = synthesizeLearningAck(newNodesAdded, mainTopic, character);
  } else {
    text = synthesizeResponse({
      query: userMessage,
      queryType,
      nodes: retrieved,
      character,
      history,
    });
  }

  // 4. Update character traits based on the interaction
  const hadConflict = false; // Future: detect contradictions
  const delta = computeTraitDeltaFromLearning(newNodesAdded, hadConflict, isTechnical, isEmotional);
  const updatedTraits = applyDeltas(character, delta);
  await updateCharacter(character.id, {
    ...updatedTraits,
    totalInteractions: character.totalInteractions + 1,
    totalKnowledgeNodes: character.totalKnowledgeNodes + newNodesAdded,
  });

  // 5. Log the learning event
  if (newNodesAdded > 0) {
    await db.insert(learningLog).values({
      clerkId,
      event: "conversation_learning",
      details: `Extracted ${newNodesAdded} fact(s) from user message`,
      nodesAdded: newNodesAdded,
      source: "conversation",
    });
  }

  const refreshedCharacter = await getOrCreateCharacter(clerkId);
  return { text, nodesUsed: retrieved.filter(n => n.similarity > 0.1).length, newNodesAdded, character: refreshedCharacter };
}

// ──────────────────────────────────────────────────────────────────────────────
// Training: add knowledge directly
// ──────────────────────────────────────────────────────────────────────────────

export async function trainOnText(
  text: string,
  source: string,
  clerkId: string | null,
): Promise<{ added: number; skipped: number; nodes: KnowledgeNode[] }> {
  const facts = extractFacts(text);
  let added = 0;
  let skipped = 0;
  const insertedNodes: KnowledgeNode[] = [];

  for (const fact of facts) {
    const existing = await retrieveRelevantNodes(fact.content, clerkId, 1);
    if (existing.length > 0 && existing[0].similarity > 0.85) {
      skipped++;
      continue;
    }
    const node = await insertNode(fact.content, fact.type, fact.tags, fact.confidence, source, clerkId);
    insertedNodes.push(node);
    added++;
  }

  // Also insert the raw text as a knowledge node if substantial
  if (text.length > 60 && text.length < 500) {
    const existing = await retrieveRelevantNodes(text, clerkId, 1);
    if (existing.length === 0 || existing[0].similarity < 0.7) {
      const node = await insertNode(text.trim(), "fact", extractKeyTerms(text), 0.8, source, clerkId);
      insertedNodes.push(node);
      added++;
    }
  }

  // Create co-occurrence edges between nodes inserted from the same batch
  if (insertedNodes.length >= 2) {
    for (let i = 0; i < insertedNodes.length; i++) {
      for (let j = i + 1; j < Math.min(insertedNodes.length, i + 4); j++) {
        try {
          await db.insert(knowledgeEdges).values({
            fromId: insertedNodes[i].id,
            toId: insertedNodes[j].id,
            relationship: "co-occurs",
            weight: 0.7,
          });
        } catch { /* skip duplicate edges */ }
      }
    }
  }

  // For each new node, link to the most similar existing node (if any)
  for (const node of insertedNodes) {
    const similar = await retrieveRelevantNodes(node.content, clerkId, 3);
    const closeMatch = similar.find(s => s.id !== node.id && s.similarity > 0.2);
    if (closeMatch) {
      try {
        await db.insert(knowledgeEdges).values({
          fromId: node.id,
          toId: closeMatch.id,
          relationship: "related-to",
          weight: closeMatch.similarity,
        });
      } catch { /* skip */ }
    }
  }

  if (added > 0) {
    const character = await getOrCreateCharacter(clerkId);
    await db.insert(learningLog).values({
      clerkId,
      event: "manual_training",
      details: `Ingested ${added} facts from ${source}`,
      nodesAdded: added,
      source,
    });
    await updateCharacter(character.id, {
      totalKnowledgeNodes: character.totalKnowledgeNodes + added,
      curiosity: Math.min(100, character.curiosity + added * 0.3),
    });
  }

  return { added, skipped, nodes: insertedNodes };
}

export async function addDirectFact(
  content: string,
  type: string,
  tags: string[],
  confidence: number,
  clerkId: string | null,
): Promise<KnowledgeNode> {
  const node = await insertNode(content, type, tags, confidence, "manual", clerkId);

  // Link to similar existing nodes to build the knowledge graph
  const similar = await retrieveRelevantNodes(content, clerkId, 3);
  for (const match of similar) {
    if (match.id !== node.id && match.similarity > 0.15) {
      try {
        await db.insert(knowledgeEdges).values({
          fromId: node.id,
          toId: match.id,
          relationship: match.similarity > 0.5 ? "related-to" : "co-occurs",
          weight: Math.round(match.similarity * 100) / 100,
        });
      } catch { /* skip duplicate edges */ }
    }
  }

  const character = await getOrCreateCharacter(clerkId);
  await updateCharacter(character.id, {
    totalKnowledgeNodes: character.totalKnowledgeNodes + 1,
  });
  await db.insert(learningLog).values({
    clerkId,
    event: "direct_fact",
    details: `Manually added: ${content.slice(0, 80)}`,
    nodesAdded: 1,
    source: "manual",
  });

  return node;
}

export { knowledgeNodes, knowledgeEdges, characterState, learningLog };
