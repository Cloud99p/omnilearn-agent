import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeNodes } from "@workspace/db/schema";
import { eq, desc, sql, like, or, and } from "drizzle-orm";
import { clerkMiddleware } from "@clerk/express";

const router = Router();

// Apply Clerk auth to all routes
router.use(clerkMiddleware());

// GET /api/knowledge/nodes - List all knowledge nodes
router.get("/nodes", async (req, res) => {
  try {
    const limit = Math.min(500, Number(req.query.limit ?? 100));
    const offset = Number(req.query.offset ?? 0);
    const type = req.query.type as string | undefined;
    const search = req.query.search as string | undefined;

    let query = db.select().from(knowledgeNodes);

    if (type) {
      query = db
        .select()
        .from(knowledgeNodes)
        .where(eq(knowledgeNodes.type, type));
    }

    if (search) {
      query = db
        .select()
        .from(knowledgeNodes)
        .where(
          or(
            like(knowledgeNodes.content, `%${search}%`),
            like(knowledgeNodes.tags[0], `%${search}%`),
          ),
        );
    }

    const nodes = await query
      .orderBy(desc(knowledgeNodes.confidence))
      .limit(limit)
      .offset(offset);

    res.json({
      nodes,
      total: nodes.length,
      limit,
      offset,
    });
  } catch (err) {
    req.log.error(err, "Failed to list knowledge nodes");
    res.status(500).json({ error: "Failed to list knowledge nodes" });
  }
});

// GET /api/knowledge/nodes/:id - Get specific node
router.get("/nodes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [node] = await db
      .select()
      .from(knowledgeNodes)
      .where(eq(knowledgeNodes.id, id));

    if (!node) {
      res.status(404).json({ error: "Node not found" });
      return;
    }

    res.json(node);
  } catch (err) {
    req.log.error(err, "Failed to get knowledge node");
    res.status(500).json({ error: "Failed to get node" });
  }
});

// POST /api/knowledge/nodes - Create new knowledge node
router.post("/nodes", async (req, res) => {
  try {
    const {
      content,
      type = "fact",
      tags = [],
      source = "manual",
      confidence = 0.7,
    } = req.body;

    if (!content?.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const contentTrimmed = content.trim();
    const tokens = contentTrimmed
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3);

    // DUPLICATE DETECTION: Check for similar existing nodes
    const existingNodes = await db
      .select({
        id: knowledgeNodes.id,
        content: knowledgeNodes.content,
        confidence: knowledgeNodes.confidence,
      })
      .from(knowledgeNodes)
      .limit(100);

    // Simple Jaccard similarity check
    const contentTokens = new Set(tokens);
    const duplicate = existingNodes.find((node) => {
      const nodeTokens = new Set(
        node.content
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((t) => t.length > 3),
      );

      // Calculate Jaccard similarity
      const intersection = [...contentTokens].filter((t) =>
        nodeTokens.has(t),
      ).length;
      const union = new Set([...contentTokens, ...nodeTokens]).size;
      const similarity = union > 0 ? intersection / union : 0;

      return similarity > 0.7; // 70% similarity = duplicate
    });

    if (duplicate) {
      res.status(409).json({
        error: "Duplicate knowledge detected",
        existingNode: {
          id: duplicate.id,
          content: duplicate.content.slice(0, 100) + "...",
          confidence: duplicate.confidence,
        },
        message:
          "This knowledge already exists. Consider reinforcing the existing node instead.",
      });
      return;
    }

    const [node] = await db
      .insert(knowledgeNodes)
      .values({
        content: contentTrimmed,
        type,
        tags,
        source,
        confidence,
        tokens,
        clerkId: req.auth.userId ?? null,
      })
      .returning();

    res.status(201).json(node);
  } catch (err) {
    req.log.error(err, "Failed to create knowledge node");
    res.status(500).json({ error: "Failed to create node" });
  }
});

// PUT /api/knowledge/nodes/:id - Update node
router.put("/nodes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { content, type, tags, confidence } = req.body;

    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (content !== undefined) updates.content = content.trim();
    if (type !== undefined) updates.type = type;
    if (tags !== undefined) updates.tags = tags;
    if (confidence !== undefined) updates.confidence = confidence;

    const [node] = await db
      .update(knowledgeNodes)
      .set(updates)
      .where(eq(knowledgeNodes.id, id))
      .returning();

    if (!node) {
      res.status(404).json({ error: "Node not found" });
      return;
    }

    res.json(node);
  } catch (err) {
    req.log.error(err, "Failed to update knowledge node");
    res.status(500).json({ error: "Failed to update node" });
  }
});

// DELETE /api/knowledge/nodes/:id - Delete node
router.delete("/nodes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(knowledgeNodes).where(eq(knowledgeNodes.id, id));

    res.json({ success: true, deletedId: id });
  } catch (err) {
    req.log.error(err, "Failed to delete knowledge node");
    res.status(500).json({ error: "Failed to delete node" });
  }
});

// GET /api/knowledge/search - Search nodes
router.get("/search", async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || typeof q !== "string") {
      res.status(400).json({ error: "search query 'q' is required" });
      return;
    }

    const tokens = q
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3);

    // Simple TF-IDF-like search
    const nodes = await db
      .select()
      .from(knowledgeNodes)
      .where(like(knowledgeNodes.content, `%${q}%`))
      .orderBy(desc(knowledgeNodes.confidence))
      .limit(Number(limit));

    res.json({
      query: q,
      results: nodes,
      total: nodes.length,
    });
  } catch (err) {
    req.log.error(err, "Failed to search knowledge nodes");
    res.status(500).json({ error: "Failed to search" });
  }
});

// GET /api/knowledge/stats - Knowledge graph statistics
router.get("/stats", async (req, res) => {
  try {
    const [totalRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(knowledgeNodes);

    const [typeBreakdown] = await db
      .select({
        fact: sql<number>`count(*) filter (where type = 'fact')`,
        concept: sql<number>`count(*) filter (where type = 'concept')`,
        opinion: sql<number>`count(*) filter (where type = 'opinion')`,
        rule: sql<number>`count(*) filter (where type = 'rule')`,
      })
      .from(knowledgeNodes);

    const [avgConfidence] = await db
      .select({
        avg: sql<number>`avg(confidence)`,
      })
      .from(knowledgeNodes);

    res.json({
      totalNodes: Number(totalRow?.count ?? 0),
      byType: {
        fact: Number(typeBreakdown?.fact ?? 0),
        concept: Number(typeBreakdown?.concept ?? 0),
        opinion: Number(typeBreakdown?.opinion ?? 0),
        rule: Number(typeBreakdown?.rule ?? 0),
      },
      avgConfidence: Number(avgConfidence?.avg ?? 0),
    });
  } catch (err) {
    req.log.error(err, "Failed to get knowledge stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export default router;
