/**
 * V1 Services API - Stats Endpoint
 * GET /api/v1/services/me/stats
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeNodes } from "@workspace/db/schema";
import { sql, desc } from "drizzle-orm";
import { optionalAuth, AuthenticatedRequest } from "../../../middlewares/optionalAuth.js";
import { logger } from "../../../lib/logger.js";

const router = Router();

router.get("/stats", optionalAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const clerkId = authReq.clerkId;
    
    logger.info({ clerkId }, "Service stats request via v1 API");

    const nodeWhere = clerkId 
      ? sql`${knowledgeNodes.clerkId} = ${clerkId}`
      : sql`${knowledgeNodes.clerkId} IS NULL`;

    const [{ nodeCount }] = await db
      .select({ nodeCount: sql<number>`count(*)` })
      .from(knowledgeNodes)
      .where(nodeWhere);

    const typeCounts = await db
      .select({ type: knowledgeNodes.type, count: sql<number>`count(*)` })
      .from(knowledgeNodes)
      .where(nodeWhere)
      .groupBy(knowledgeNodes.type)
      .orderBy(desc(sql`count(*)`));

    const serviceName = req.query.serviceName as string || "unknown";
    const serviceVersion = req.query.serviceVersion as string || "1.0.0";

    res.json({
      success: true,
      stats: {
        totalNodes: Number(nodeCount),
        totalEdges: 0,
        totalRecords: 0,
        nodesByType: typeCounts.map((t) => ({ type: t.type, count: Number(t.count) })),
        recentActivity: [],
        serviceInfo: { name: serviceName, version: serviceVersion, domain: "general" },
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get service stats");
    res.status(500).json({ success: false, error: "Failed to get service stats" });
  }
});

export default router;
