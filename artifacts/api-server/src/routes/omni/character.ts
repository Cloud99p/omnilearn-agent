import { Router } from "express";
import { getOrCreateCharacter } from "../../brain/index.js";
import { db } from "@workspace/db";
import { learningLog } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

const router = Router();

// GET /api/omni/character
router.get("/", async (req, res) => {
  // Get userId from query param (defaults to null for global view)
  const userId = req.query.userId as string | undefined || null;
  const character = await getOrCreateCharacter(userId);
  res.json(character);
});

// GET /api/omni/character/events
router.get("/events", async (req, res) => {
  // Get userId from query param (defaults to null for global view)
  const userId = req.query.userId as string | undefined || null;
  const query: any = {};
  if (userId) {
    query.agentId = userId;
  }
  const events = await db
    .select()
    .from(learningLog)
    .where(query)
    .orderBy(desc(learningLog.createdAt))
    .limit(100);
  res.json(events);
});

export default router;
