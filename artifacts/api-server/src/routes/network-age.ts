import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeNodes, characterState } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const router = Router();

// GET /api/network/age - Get average knowledge age
router.get("/age", async (req, res) => {
  try {
    const [{ avgAge }] = await db
      .select({
        avgAge: sql<number>`AVG(EXTRACT(EPOCH FROM (NOW() - ${knowledgeNodes.createdAt})) / 3600)`,
      })
      .from(knowledgeNodes);
    
    res.json({
      avgAgeHours: avgAge || 0,
      totalNodes: await db.select({ count: sql<number>`count(*)` }).from(knowledgeNodes)[0]?.count || 0,
    });
  } catch (err) {
    req.log.error(err, "network age error");
    res.status(500).json({ error: "Failed to get network age" });
  }
});

export default router;
