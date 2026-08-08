/**
 * V1 Knowledge API - Search Endpoint
 * POST /api/v1/knowledge/search
 *
 * Extended with `metadataFilter` so clients can scope results to a specific
 * context (e.g. a meetingId for MeetPlay games). All filters are additive:
 * query (optional when metadataFilter is present) · type · timeRange ·
 * metadataFilter (object of key → value, matched against stored metadata).
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeNodes } from "@workspace/db/schema";
import { like, desc } from "drizzle-orm";
import { retrieveRelevantNodes } from "../../../brain/index.js";
import { optionalAuth, AuthenticatedRequest } from "../../../middlewares/optionalAuth.js";
import { logger } from "../../../lib/logger.js";

const router = Router();

function matchesMetadataFilter(node: any, filter: Record<string, unknown> | undefined): boolean {
  if (!filter || typeof filter !== "object") return true;
  const metadata = node.metadata || {};
  return Object.entries(filter).every(([key, value]) => metadata[key] === value);
}

router.post("/search", optionalAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const clerkId = authReq.clerkId;
    const service = authReq.service;

    const { query, limit = 20, offset = 0, type, timeRange, metadataFilter } = req.body;

    const hasQuery = typeof query === "string" && query.trim().length > 0;

    // A search without a query is only valid when scoping by metadata (or type/timeRange)
    if (!hasQuery && !metadataFilter && !type && !timeRange) {
      res.status(400).json({ success: false, error: "query is required (or provide metadataFilter/type/timeRange)" });
      return;
    }

    logger.info({ query, limit, type, metadataFilter, service: service?.name ?? null }, "Knowledge search via v1 API");

    let results: any[] = [];

    if (hasQuery && query.trim().length > 3) {
      // Semantic search — metadataFilter applied after retrieval
      const tfidfResults = await retrieveRelevantNodes(query, clerkId, limit * 2);

      results = tfidfResults
        .map((node) => ({ ...node, metadata: extractMetadata(node) }))
        .filter((node) => {
          if (node.similarity <= 0.05) return false;
          if (service && node.serviceId !== service.id) return false;
          if (type && node.type !== type) return false;
          if (!matchesMetadataFilter(node, metadataFilter)) return false;
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
      // Literal / scoped search — fetch a generous window, then filter in JS
      // (metadata lives inside the content JSON blob, so post-filtering is required)
      const fetchLimit = Math.max(Number(limit), 500);
      const rows = await db
        .select()
        .from(knowledgeNodes)
        .where(
          hasQuery
            ? like(knowledgeNodes.content, `%${query}%`)
            : sql`TRUE`
        )
        .orderBy(desc(knowledgeNodes.createdAt))
        .limit(fetchLimit);

      results = rows
        .map((node) => ({ ...node, metadata: extractMetadata(node) }))
        .filter((node) => {
          if (service && node.serviceId !== service.id) return false;
          if (type && node.type !== type) return false;
          if (!matchesMetadataFilter(node, metadataFilter)) return false;
          if (timeRange) {
            const nodeDate = new Date(node.createdAt);
            if (timeRange.start && nodeDate < new Date(timeRange.start)) return false;
            if (timeRange.end && nodeDate > new Date(timeRange.end)) return false;
          }
          return true;
        })
        .slice(offset, offset + limit)
        .map((node) => ({ ...formatSearchResult(node), similarity: 1.0 }));
    }

    res.json({ success: true, results, total: results.length, query: query ?? "" });
  } catch (error) {
    logger.error({ error }, "Failed to search knowledge");
    res.status(500).json({ success: false, error: "Failed to search knowledge" });
  }
});

function extractMetadata(node: any): Record<string, unknown> {
  try {
    const parsed = JSON.parse(node.content);
    return parsed.metadata || {};
  } catch {
    return {};
  }
}

function formatSearchResult(node: any) {
  try {
    const parsed = JSON.parse(node.content);
    return {
      id: node.id,
      type: node.type,
      data: parsed.data || {},
      metadata: parsed.metadata || {},
      similarity: node.similarity || 1.0,
      createdAt: node.createdAt,
    };
  } catch {
    return {
      id: node.id,
      type: node.type,
      data: { content: node.content },
      metadata: {},
      similarity: node.similarity || 1.0,
      createdAt: node.createdAt,
    };
  }
}

import { sql } from "drizzle-orm";

export default router;
