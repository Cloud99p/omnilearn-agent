/**
 * V1 Knowledge API - Batch Record Endpoint
 * POST /api/v1/knowledge/batch
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeNodes } from "@workspace/db/schema";
import { optionalAuth, AuthenticatedRequest } from "../../../middlewares/optionalAuth.js";
import { logger } from "../../../lib/logger.js";
import { contributeNeurons } from "../../../brain/network.js";

const router = Router();

router.post("/batch", optionalAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const clerkId = authReq.clerkId;
    
    const { records = [], metadata = {} } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ success: false, error: "records array is required" });
      return;
    }

    if (records.length > 100) {
      res.status(400).json({ success: false, error: "Maximum 100 records per batch" });
      return;
    }

    logger.info({ count: records.length, clerkId }, "Batch knowledge record via v1 API");

    const nodeIds: number[] = [];
    let failed = 0;

    for (const record of records) {
      try {
        const { type, data } = record;
        if (!type || !data) { failed++; continue; }

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
            source: "sdk-v1-batch",
            tokens: tokenizeContent(content),
          })
          .returning();

        nodeIds.push(node.id);
      } catch {
        failed++;
      }
    }

    const batchData = records
      .filter((r: any) => r.type && r.data)
      .map((r: any) => ({
        content: JSON.stringify({ type: r.type, data: r.data }),
        type: r.type,
        tags: [r.type],
      }));
    
    if (batchData.length > 0) {
      contributeNeurons(batchData, "v1-batch").catch(() => {});
    }

    res.status(201).json({ success: true, recorded: nodeIds.length, failed, nodeIds });
  } catch (error) {
    logger.error({ error }, "Failed to process batch");
    res.status(500).json({ success: false, error: "Failed to process batch" });
  }
});

function tokenizeContent(content: string): string[] {
  return content
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

export default router;
