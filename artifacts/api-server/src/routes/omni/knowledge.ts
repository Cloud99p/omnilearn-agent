import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeNodes, knowledgeEdges, learningLog } from "@workspace/db/schema";
import { eq, desc, sql, like, or } from "drizzle-orm";
import { retrieveRelevantNodes, addDirectFact, seedIfEmpty } from "../../brain/index.js";
import { tokenize } from "../../brain/tfidf.js";

const router = Router();

// GET /api/omni/knowledge — list knowledge nodes with optional search
router.get("/", async (req, res) => {
  await seedIfEmpty();

  const { search, type, limit = "50", offset = "0" } = req.query as Record<string, string>;

  if (search?.trim()) {
    const nodes = await retrieveRelevantNodes(search.trim(), null, 30);
    res.json(nodes.filter(n => n.similarity > 0.05).slice(0, Number(limit)));
    return;
  }

  let query = db.select().from(knowledgeNodes).orderBy(desc(knowledgeNodes.createdAt));

  const rows = await db
    .select()
    .from(knowledgeNodes)
    .orderBy(desc(knowledgeNodes.updatedAt))
    .limit(Number(limit))
    .offset(Number(offset));

  let result = rows;
  if (type) {
    result = rows.filter(r => r.type === type);
  }

  res.json(result);
});

// GET /api/omni/knowledge/stats
router.get("/stats", async (req, res) => {
  const [{ nodeCount }] = await db.select({ nodeCount: sql<number>`count(*)` }).from(knowledgeNodes);
  const [{ edgeCount }] = await db.select({ edgeCount: sql<number>`count(*)` }).from(knowledgeEdges);
  const [{ logCount }] = await db.select({ logCount: sql<number>`count(*)` }).from(learningLog);

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
  const [node] = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.id, id));
  if (!node) { res.status(404).json({ error: "Not found" }); return; }

  const edges = await db
    .select()
    .from(knowledgeEdges)
    .where(
      or(eq(knowledgeEdges.fromId, id), eq(knowledgeEdges.toId, id))
    );

  res.json({ ...node, edges });
});

// POST /api/omni/knowledge — add a fact directly
router.post("/", async (req, res) => {
  const { content, type = "fact", tags = [], confidence = 0.85 } = req.body as {
    content: string;
    type?: string;
    tags?: string[];
    confidence?: number;
  };

  if (!content?.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const node = await addDirectFact(content.trim(), type, tags, confidence, null);
  res.status(201).json(node);
});

// DELETE /api/omni/knowledge/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(knowledgeNodes).where(eq(knowledgeNodes.id, id));
  await db.delete(knowledgeEdges).where(
    or(eq(knowledgeEdges.fromId, id), eq(knowledgeEdges.toId, id))
  );
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
