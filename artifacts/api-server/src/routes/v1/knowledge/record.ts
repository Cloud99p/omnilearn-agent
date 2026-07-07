/**
 * V1 Knowledge API - Record Endpoint
 * POST /api/v1/knowledge/record
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeNodes } from "@workspace/db/schema";
import { contributeNeurons } from "../../../brain/network.js";
import { optionalAuth, AuthenticatedRequest } from "../../../middlewares/optionalAuth.js";
import { logger } from "../../../lib/logger.js";

const router = Router();

/**
 * POST /api/v1/knowledge/record
 */
router.post("/record", optionalAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const clerkId = authReq.clerkId;
    
    const { type, data, metadata = {} } = req.body;

    if (!type || typeof type !== "string") {
      res.status(400).json({ success: false, error: "type is required" });
      return;
    }

    if (!data || typeof data !== "object") {
      res.status(400).json({ success: false, error: "data is required" });
      return;
    }

    const content = JSON.stringify({ type, data, metadata });
    const tags = [type];

    const [node] = await db
      .insert(knowledgeNodes)
      .values({
        content,
        type,
        tags,
        confidence: 0.85,
        clerkId: clerkId || null,
        source: "sdk-v1",
        tokens: tokenizeContent(content),
      })
      .returning();

    logger.info({ nodeId: node.id, type, clerkId }, "Knowledge recorded via v1 API");

    contributeNeurons([{ content, type, tags }], "v1-api").catch(() => {});

    const hash = generateHash(`${node.id}-${node.createdAt}`);

    res.status(201).json({
      success: true,
      nodeId: node.id,
      hash,
      timestamp: node.createdAt.toISOString(),
    });
  } catch (error) {
    logger.error({ error }, "Failed to record knowledge");
    res.status(500).json({ success: false, error: "Failed to record knowledge" });
  }
});

function tokenizeContent(content: string): string[] {
  return content
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function generateHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export default router;
