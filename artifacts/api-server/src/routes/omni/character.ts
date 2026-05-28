import { Router } from "express";
import { getOrCreateCharacter } from "../../brain/index.js";
import { db } from "@workspace/db";
import { learningLog } from "@workspace/db/schema";
import { desc } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../../middlewares/requireAuth.js";

const router = Router();

// GET /api/omni/character - User-specific character stats
router.get("/", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const character = await getOrCreateCharacter(authReq.clerkId);
  res.json(character);
});

// GET /api/omni/character/events - User-specific learning events
router.get("/events", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const events = await db
    .select()
    .from(learningLog)
    .where({ agentId: authReq.clerkId })
    .orderBy(desc(learningLog.createdAt))
    .limit(100);
  res.json(events);
});

export default router;
