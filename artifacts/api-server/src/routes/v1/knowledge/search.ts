/**
 * V1 Knowledge API - Search Endpoint
 * POST /api/v1/knowledge/search
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeNodes } from "@workspace/db/schema";
import { like, desc } from "drizzle-orm";
import { retrieveRelevantNodes } from "../../../brain/index.js";
import { optionalAuth, AuthenticatedRequest } from "../../../middlewares/optionalAuth.js";
import { logger } from "../../../lib/logger.js";

const router = Router();

router.post("/search", optionalAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const clerkId = authReq.clerkId;
    
    const { query, limit = 20, offset = 0, type, timeRange } = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({ success: false, error: "query is required" });
      return;
    }

    logger.info({ query, limit, type }, "Knowledge search via v1 API");

    let results: any[] = [];
    
    if (query.trim().length > 3) {
      const tfidfResults = await retrieveRelevantNodes(query, clerkId, limit * 2);
      
      results = tfidfResults
        .filter((node) => {
          if (node.similarity <= 0.05) return false;
          if (type && node.type !== type) return false;
          if (timeRange) {
            const nodeDate = new Date(node.createdAt);
            if (timeRange.start && nodeDate < new Date(timeRange.start)) return false;
            if (timeRange.end && nodeDate > new Date(timeRange.end)) return false;
          }
          return true;
        })
        .slice(offset, offset + limit)
        .map((node) => formatSearchResult(node));
    } else {
      const rows = await db
        .select()
        .from(knowledgeNodes)
        .where(like(knowledgeNodes.content, `%${query}%`))
        .orderBy(desc(knowledgeNodes.createdAt))
        .limit(limit)
        .offset(offset);
      
      results = rows.map((node) => ({ ...formatSearchResult(node), similarity: 1.0 }));
    }

    res.json({ success: true, results, total: results.length, query });
  } catch (error) {
    logger.error({ error }, "Failed to search knowledge");
    res.status(500).json({ success: false, error: "Failed to search knowledge" });
  }
});

function formatSearchResult(node: any) {
  try {
    const parsed = JSON.parse(node.content);
    return {
      id: node.id,
      type: node.type,
      data: parsed.data || {},
      metadata: parsed.metadata || {},
      similarity: node.similarity || 1.0,
    };
  } catch {
    return {
      id: node.id,
      type: node.type,
      data: { content: node.content },
      metadata: {},
      similarity: node.similarity || 1.0,
    };
  }
}

export default router;
