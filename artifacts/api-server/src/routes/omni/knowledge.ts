import { Router } from "express";
import { db } from "@workspace/db";
import {
  knowledgeNodes,
  knowledgeEdges,
  learningLog,
} from "@workspace/db/schema";
import { eq, desc, sql, like, or } from "drizzle-orm";
import {
  retrieveRelevantNodes,
  addDirectFact,
  seedIfEmpty,
} from "../../brain/index.js";
import { tokenize } from "../../brain/tfidf.js";
import { contributeNeurons } from "../../brain/network.js";

const router = Router();

// GET /api/omni/knowledge — list knowledge nodes with optional search
router.get("/", async (req, res) => {
  await seedIfEmpty();

  const {
    search,
    type,
    limit = "50",
    offset = "0",
  } = req.query as Record<string, string>;

  if (search?.trim()) {
    const nodes = await retrieveRelevantNodes(search.trim(), null, 30);
    res.json(nodes.filter((n) => n.similarity > 0.05).slice(0, Number(limit)));
    return;
  }

  let query = db
    .select()
    .from(knowledgeNodes)
    .orderBy(desc(knowledgeNodes.createdAt));

  const rows = await db
    .select()
    .from(knowledgeNodes)
    .orderBy(desc(knowledgeNodes.updatedAt))
    .limit(Number(limit))
    .offset(Number(offset));

  let result = rows;
  if (type) {
    result = rows.filter((r) => r.type === type);
  }

  res.json(result);
});

// GET /api/omni/knowledge/stats
router.get("/stats", async (req, res) => {
  const [{ nodeCount }] = await db
    .select({ nodeCount: sql<number>`count(*)` })
    .from(knowledgeNodes);
  const [{ edgeCount }] = await db
    .select({ edgeCount: sql<number>`count(*)` })
    .from(knowledgeEdges);
  const [{ logCount }] = await db
    .select({ logCount: sql<number>`count(*)` })
    .from(learningLog);

  const typeCounts = await db
    .select({ type: knowledgeNodes.type, count: sql<number>`count(*)` })
    .from(knowledgeNodes)
    .groupBy(knowledgeNodes.type);

  const recentLog = await db
    .select()
    .from(learningLog)
    .orderBy(desc(learningLog.createdAt))
    .limit(10);

  res.json({
    nodeCount: Number(nodeCount),
    edgeCount: Number(edgeCount),
    logCount: Number(logCount),
    typeCounts,
    recentLog,
  });
});

// GET /api/omni/knowledge/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [node] = await db
    .select()
    .from(knowledgeNodes)
    .where(eq(knowledgeNodes.id, id));
  if (!node) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const edges = await db
    .select()
    .from(knowledgeEdges)
    .where(or(eq(knowledgeEdges.fromId, id), eq(knowledgeEdges.toId, id)));

  res.json({ ...node, edges });
});

// POST /api/omni/knowledge — add a fact directly
router.post("/", async (req, res) => {
  const {
    content,
    type = "fact",
    tags = [],
    confidence = 0.85,
  } = req.body as {
    content: string;
    type?: string;
    tags?: string[];
    confidence?: number;
  };

  if (!content?.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const node = await addDirectFact(
    content.trim(),
    type,
    tags,
    confidence,
    null,
  );

  // Feed into shared network brain (fire-and-forget)
  contributeNeurons([{ content: content.trim(), type, tags }], "self").catch(
    () => {},
  );

  res.status(201).json(node);
});

// POST /api/omni/knowledge/rebuild-edges — backfill edges for all existing nodes
router.post("/rebuild-edges", async (req, res) => {
  const allNodes = await db.select().from(knowledgeNodes);
  let created = 0;

  for (let i = 0; i < allNodes.length; i++) {
    const node = allNodes[i];
    const tokens = node.tokens as string[];
    if (tokens.length === 0) continue;

    // Find up to 3 most similar other nodes using TF-IDF scores
    const similar = await retrieveRelevantNodes(node.content, null, 5);
    const closeMatches = similar
      .filter((s) => s.id !== node.id && s.similarity > 0.15)
      .slice(0, 3);

    for (const match of closeMatches) {
      // Only create edge if the from_id < to_id to avoid both directions being created for every pair
      const fromId = Math.min(node.id, match.id);
      const toId = Math.max(node.id, match.id);
      try {
        await db.insert(knowledgeEdges).values({
          fromId,
          toId,
          relationship: match.similarity > 0.45 ? "related-to" : "co-occurs",
          weight: Math.round(match.similarity * 100) / 100,
        });
        created++;
      } catch {
        /* skip duplicate */
      }
    }
  }

  res.json({
    success: true,
    edgesCreated: created,
    nodesScanned: allNodes.length,
  });
});

// DELETE /api/omni/knowledge/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(knowledgeNodes).where(eq(knowledgeNodes.id, id));
  await db
    .delete(knowledgeEdges)
    .where(or(eq(knowledgeEdges.fromId, id), eq(knowledgeEdges.toId, id)));
  res.json({ success: true });
});

// GET /api/omni/knowledge/log
router.get("/events/log", async (req, res) => {
  const log = await db
    .select()
    .from(learningLog)
    .orderBy(desc(learningLog.createdAt))
    .limit(50);
  res.json(log);
});

export default router;
