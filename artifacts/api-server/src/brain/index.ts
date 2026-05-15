import { db } from "@workspace/db";
import {
  knowledgeNodes,
  knowledgeEdges,
  characterState,
  learningLog,
  type KnowledgeNode,
  type CharacterState,
} from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { proposeHebbianDelta, type EdgeRelationship } from "./hebbian.js";
import {
  tokenize,
  queryScore,
  buildTfidfVector,
  computeIdfFromVectors,
} from "./tfidf.js";
import { extractFacts, detectQueryType, extractKeyTerms } from "./extractor.js";
import { embedText, cosineSimilarity } from "./embeddings.js";
import {
  applyDeltas,
  computeTraitDeltaFromLearning,
  rebalanceTraits,
  needsRebalancing,
  detectTechnicalContent,
  detectEmotionalContent,
} from "./character.js";
import {
  synthesizeLearningAck,
  synthesizeStatusResponse,
  type RetrievedNode,
  type ActivityCallback,
} from "./synthesizer.js";
import { synthesizeNative } from "./native-synthesizer.js";
import { SEED_KNOWLEDGE } from "./seed.js";
import { moderateContent, logModerationAudit } from "../lib/moderation.js";
import { logger } from "../lib/logger.js";
import { hasKnowledgeQuality } from "./extractor.js";

// ──────────────────────────────────────────────────────────────────────────────
// Character state (per clerkId or global)
// ──────────────────────────────────────────────────────────────────────────────

export async function getOrCreateCharacter(
  clerkId: string | null,
): Promise<CharacterState> {
  const [existing] = await db
    .select()
    .from(characterState)
    .where(
      clerkId ? eq(characterState.clerkId, clerkId) : sql`clerk_id IS NULL`,
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(characterState)
    .values({ clerkId })
    .returning();
  return created;
}

async function updateCharacter(
  id: number,
  updates: Partial<CharacterState>,
): Promise<void> {
  const [current] = await db
    .select()
    .from(characterState)
    .where(eq(characterState.id, id))
    .limit(1);
  if (current) {
    const merged = { ...current, ...updates };
    const snapshot = {
      at: new Date().toISOString(),
      curiosity: merged.curiosity,
      caution: merged.caution,
      confidence: merged.confidence,
      verbosity: merged.verbosity,
      technical: merged.technical,
      empathy: merged.empathy,
      creativity: merged.creativity,
      n: merged.totalInteractions,
    };
    const existing = Array.isArray(current.evolutionLog)
      ? (current.evolutionLog as unknown[])
      : [];
    const newLog = [...existing, snapshot].slice(-200);
    await db
      .update(characterState)
      .set({ ...updates, evolutionLog: newLog, updatedAt: new Date() })
      .where(eq(characterState.id, id));
  } else {
    await db
      .update(characterState)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(characterState.id, id));
  }
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

  // FILTER: Identity facts are user-specific - only include if they belong to this user
  const filteredNodes = allNodes.filter((node) => {
    if (node.type === "identity") {
      // Identity facts must match clerkId (or be null for backwards compatibility)
      return node.clerkId === clerkId || node.clerkId === null;
    }
    return true;
  });

  if (filteredNodes.length === 0) return [];

  const allVectors = filteredNodes.map(
    (n) => n.tfidfVector as Record<string, number>,
  );

  // HYBRID RETRIEVAL: Combine semantic embeddings + TF-IDF
  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await embedText(query);
  } catch (err) {
    logger.warn({ err }, "Embedding generation failed, using TF-IDF only");
  }

  // Score nodes using both methods
  const scored: RetrievedNode[] = filteredNodes
    .map((node) => {
      // TF-IDF score
      const nodeVec = node.tfidfVector as Record<string, number>;
      const nodeTokens = node.tokens as string[];
      const tfidfScore = queryScore(
        queryTokens,
        nodeTokens,
        nodeVec,
        allVectors,
      );

      // Embedding score (if available)
      let embeddingScore = 0;
      if (
        queryEmbedding &&
        node.embedding &&
        Array.isArray(node.embedding) &&
        node.embedding.length > 0
      ) {
        embeddingScore = cosineSimilarity(queryEmbedding, node.embedding);
      }

      // Hybrid score: 70% embeddings + 30% TF-IDF (when embeddings available)
      const similarity =
        queryEmbedding && embeddingScore > 0
          ? 0.7 * embeddingScore + 0.3 * tfidfScore
          : tfidfScore;

      return { ...node, similarity };
    })
    .sort((a, b) => b.similarity - a.similarity);

  // Filter by similarity threshold AND exclude low-quality matches
  const semanticResults = scored
    .filter((n) => {
      if (n.similarity <= 0.15) return false;
      if (n.type === "rule" && queryType !== "command") return false;
      return true;
    })
    .slice(0, topK);

  if (semanticResults.length === 0) {
    // Fallback: direct keyword/content match
    const queryLower = query.toLowerCase();
    const keywordResults = filteredNodes
      .map((node) => {
        // Check if query keywords appear in content
        const contentLower = node.content.toLowerCase();
        const hasKeywordMatch = queryTokens.some((token) =>
          contentLower.includes(token),
        );

        // Check if query appears in content (for exact phrases)
        const hasExactMatch = contentLower.includes(queryLower);

        let similarity = 0;
        if (hasExactMatch) similarity = 0.9;
        else if (hasKeywordMatch) similarity = 0.3;

        return { ...node, similarity };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    // Use keyword results if they're better than semantic
    if (keywordResults.length > 0 && keywordResults[0].similarity > 0.1) {
      // Bump access count
      const topIds = keywordResults
        .filter((n) => n.similarity > 0.1)
        .map((n) => n.id);
      if (topIds.length > 0) {
        await Promise.all(
          topIds.map((id) =>
            db
              .update(knowledgeNodes)
              .set({ timesAccessed: sql`times_accessed + 1` })
              .where(eq(knowledgeNodes.id, id)),
          ),
        );
      }
      return keywordResults;
    }
  }

  // 3. Bump access count for top results
  const topIds = semanticResults
    .filter((n) => n.similarity > 0.1)
    .map((n) => n.id);
  if (topIds.length > 0) {
    await Promise.all(
      topIds.map((id) =>
        db
          .update(knowledgeNodes)
          .set({ timesAccessed: sql`times_accessed + 1` })
          .where(eq(knowledgeNodes.id, id)),
      ),
    );
  }

  return semanticResults;
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
  userIdentity: boolean = false,
): Promise<KnowledgeNode> {
  const tokens = tokenize(content);

  // Get existing vectors for IDF
  const existing = await db
    .select({ vec: knowledgeNodes.tfidfVector })
    .from(knowledgeNodes);
  const existingVecs = existing.map((r) => r.vec as Record<string, number>);

  const idf = computeIdfFromVectors(existingVecs);
  const tfidfVector = buildTfidfVector(tokens, idf);

  const [node] = await db
    .insert(knowledgeNodes)
    .values({
      content,
      type,
      tags,
      source,
      confidence,
      tokens,
      tfidfVector,
      clerkId: userIdentity ? clerkId : clerkId, // Identity facts MUST have clerkId
    })
    .returning();

  return node;
}

// ──────────────────────────────────────────────────────────────────────────────
// Seeding
// ──────────────────────────────────────────────────────────────────────────────

export async function seedIfEmpty(): Promise<void> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(knowledgeNodes);
  if (Number(count) > 0) return;

  logger.info("Seeding OmniLearn knowledge base with initial facts...");
  for (const fact of SEED_KNOWLEDGE) {
    await insertNode(
      fact.content,
      fact.type,
      fact.tags,
      fact.confidence,
      "seed",
      null,
    );
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
  onActivity?: ActivityCallback,
): Promise<BrainResponse> {
  const character = await getOrCreateCharacter(clerkId);

  // Detect special commands
  const lower = userMessage.trim().toLowerCase();
  if (lower === "status" || lower === "system status" || lower === "/status") {
    const [{ nc }] = await db
      .select({ nc: sql<number>`count(*)` })
      .from(knowledgeNodes);
    const [{ ec }] = await db
      .select({ ec: sql<number>`count(*)` })
      .from(knowledgeEdges);
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
      // SPECIAL HANDLING: Identity facts require clerkId and are user-specific
      if (fact.type === "identity" || fact.userIdentity) {
        if (!clerkId) {
          // Anonymous user - skip identity fact (can't store without user ID)
          logger.warn({ fact }, "Skipping identity fact from anonymous user");
          continue;
        }
        // Check for duplicate identity facts for THIS user only
        const existing = await retrieveRelevantNodes(fact.content, clerkId, 1);
        if (existing.length > 0 && existing[0].similarity > 0.9) continue;

        await insertNode(
          fact.content,
          fact.type,
          fact.tags,
          fact.confidence,
          "conversation",
          clerkId,
          true,
        );
        newNodesAdded++;
        logger.info({ clerkId, fact }, "Stored user identity fact");
      } else {
        // Regular facts - avoid near-duplicate nodes
        const existing = await retrieveRelevantNodes(fact.content, clerkId, 1);
        if (existing.length > 0 && existing[0].similarity > 0.85) continue;

        await insertNode(
          fact.content,
          fact.type,
          fact.tags,
          fact.confidence,
          "conversation",
          clerkId,
        );
        newNodesAdded++;
      }
    } catch (err) {
      logger.warn({ err, fact }, "Failed to insert fact");
    }
  }

  // 2. Retrieve relevant knowledge for the query
  const queryType = detectQueryType(userMessage);
  const keyTerms = extractKeyTerms(userMessage);
  const searchQuery = [userMessage, ...keyTerms].join(" ");

  const retrieved = await retrieveRelevantNodes(searchQuery, clerkId, 6);

  // 3. Determine if this is primarily a "teach me" statement vs a question
  // Always show learning confirmation when new nodes are added
  const isTeaching = queryType === "statement" && newNodesAdded > 0;

  let text: string;
  let learnedFacts: Array<{ content: string; type: string; tags: string[] }> =
    [];

  if (isTeaching) {
    const mainTopic =
      keyTerms[0] ?? extractKeyTerms(userMessage)[0] ?? "this topic";
    text = synthesizeLearningAck(newNodesAdded, mainTopic, character);
  } else {
    // Use native synthesis — no external LLM, learns from knowledge graph
    const result = await synthesizeNative({
      query: userMessage,
      queryType,
      nodes: retrieved,
      character,
      history,
      onActivity,
    });
    text = result.text;
    learnedFacts = result.learnedFacts || [];

    // Save learned facts to knowledge graph (with validation + moderation)
    for (const fact of learnedFacts) {
      try {
        // SAFEGUARD 1: Skip meta-text (system messages)
        const metaPatterns = [
          /i've learned[:\s]/i,
          /that connects to what/i,
          /is there more/i,
          /would you like/i,
          /based on what/i,
          /from my knowledge/i,
          /i've added this/i,
        ];
        if (metaPatterns.some((p) => p.test(fact.content))) {
          logger.warn({ fact }, "Skipping meta-text from learning");
          continue;
        }

        // SAFEGUARD 2: Content moderation (harmful, illegal, PII)
        const moderationResult = moderateContent(fact.content);
        if (!moderationResult.approved) {
          logModerationAudit({
            timestamp: new Date().toISOString(),
            userId: clerkId || "unknown",
            action: "reject",
            contentType: "knowledge_node",
            reason: moderationResult.reason,
          });
          logger.warn(
            {
              category: moderationResult.category,
              severity: moderationResult.severity,
            },
            "Content moderation: blocked from learning",
          );
          continue;
        }

        // SAFEGUARD 3: Skip duplicates
        const existing = await retrieveRelevantNodes(fact.content, clerkId, 1);
        if (existing.length > 0 && existing[0].similarity > 0.85) continue;

        await insertNode(
          fact.content,
          fact.type,
          fact.tags,
          0.7,
          "conversation",
          clerkId,
        );
        newNodesAdded++;
      } catch (err) {
        logger.warn({ err, fact }, "Failed to insert fact");
      }
    }
  }

  // 4. Update character traits based on the interaction
  const hadConflict = false; // Future: detect contradictions
  let delta = computeTraitDeltaFromLearning(
    newNodesAdded,
    hadConflict,
    isTechnical,
    isEmotional,
  );

  // Check if rebalancing is needed (traits too extreme)
  if (needsRebalancing(character)) {
    const rebalance = rebalanceTraits(character, 0.03); // 3% decay toward center
    // Merge rebalancing with learning delta
    delta = {
      curiosity: (delta.curiosity ?? 0) + (rebalance.curiosity ?? 0),
      caution: (delta.caution ?? 0) + (rebalance.caution ?? 0),
      confidence: (delta.confidence ?? 0) + (rebalance.confidence ?? 0),
      verbosity: (delta.verbosity ?? 0) + (rebalance.verbosity ?? 0),
      technical: (delta.technical ?? 0) + (rebalance.technical ?? 0),
      empathy: (delta.empathy ?? 0) + (rebalance.empathy ?? 0),
      creativity: (delta.creativity ?? 0) + (rebalance.creativity ?? 0),
    };
    logger.info({ rebalance }, "Character traits rebalanced toward center");
  }

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
  return {
    text,
    nodesUsed: retrieved.filter((n) => n.similarity > 0.1).length,
    newNodesAdded,
    character: refreshedCharacter,
  };
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
    // QUALITY CHECK: Skip low-quality facts
    if (!hasKnowledgeQuality(fact.content)) {
      logger.debug(
        { fact: fact.content.slice(0, 100) },
        "Skipping low-quality fact from batch training",
      );
      skipped++;
      continue;
    }

    const existing = await retrieveRelevantNodes(fact.content, clerkId, 1);
    if (existing.length > 0 && existing[0].similarity > 0.85) {
      skipped++;
      continue;
    }
    const node = await insertNode(
      fact.content,
      fact.type,
      fact.tags,
      fact.confidence,
      source,
      clerkId,
    );
    insertedNodes.push(node);
    added++;
  }

  // Also insert the raw text as a knowledge node if substantial AND high-quality
  if (text.length > 60 && text.length < 500) {
    const existing = await retrieveRelevantNodes(text, clerkId, 1);
    if (
      (existing.length === 0 || existing[0].similarity < 0.7) &&
      hasKnowledgeQuality(text)
    ) {
      const node = await insertNode(
        text.trim(),
        "fact",
        extractKeyTerms(text),
        0.8,
        source,
        clerkId,
      );
      insertedNodes.push(node);
      added++;
    } else if (!hasKnowledgeQuality(text)) {
      logger.debug(
        { text: text.slice(0, 100) },
        "Skipping low-quality raw text from batch training",
      );
    }
  }

  // Propose co-occurrence Hebbian deltas between nodes from the same batch
  if (insertedNodes.length >= 2) {
    for (let i = 0; i < insertedNodes.length; i++) {
      for (let j = i + 1; j < Math.min(insertedNodes.length, i + 4); j++) {
        const a = insertedNodes[i];
        const b = insertedNodes[j];
        const evidence = `${a.content} and ${b.content} were observed together in source: ${source}`;
        try {
          await proposeHebbianDelta({
            proposerId: "local",
            nodeAId: a.id,
            nodeBId: b.id,
            edgeType: "co-occurs",
            evidenceText: evidence,
            deltaWeight: 0.7,
          });
        } catch {
          /* skip */
        }
      }
    }
  }

  // Propose related-to deltas for each new node's nearest semantic neighbour
  for (const node of insertedNodes) {
    const similar = await retrieveRelevantNodes(node.content, clerkId, 3);
    const closeMatch = similar.find(
      (s) => s.id !== node.id && s.similarity > 0.2,
    );
    if (closeMatch) {
      const evidence = `"${node.content}" is semantically similar to "${closeMatch.content}" (similarity ${closeMatch.similarity.toFixed(2)}) observed in source: ${source}`;
      try {
        await proposeHebbianDelta({
          proposerId: "local",
          nodeAId: node.id,
          nodeBId: closeMatch.id,
          edgeType: "related-to",
          evidenceText: evidence,
          deltaWeight: Math.round(closeMatch.similarity * 100) / 100,
        });
      } catch {
        /* skip */
      }
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
  const node = await insertNode(
    content,
    type,
    tags,
    confidence,
    "manual",
    clerkId,
  );

  // Propose Hebbian deltas to link similar existing nodes
  const similar = await retrieveRelevantNodes(content, clerkId, 3);
  for (const match of similar) {
    if (match.id !== node.id && match.similarity > 0.15) {
      const edgeType = match.similarity > 0.5 ? "related-to" : "co-occurs";
      const evidence = `"${content}" (manually added) has semantic similarity ${match.similarity.toFixed(2)} with existing node "${match.content}"`;
      try {
        await proposeHebbianDelta({
          proposerId: "local",
          nodeAId: node.id,
          nodeBId: match.id,
          edgeType: edgeType as EdgeRelationship,
          evidenceText: evidence,
          deltaWeight: Math.round(match.similarity * 100) / 100,
        });
      } catch {
        /* skip */
      }
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
