import { Router } from "express";
import { getOrCreateCharacter } from "../../brain/index.js";
import { db } from "@workspace/db";
import { learningLog } from "@workspace/db/schema";
import { desc } from "drizzle-orm";
import { optionalAuth, AuthenticatedRequest } from "../../middlewares/optionalAuth.js";

const router = Router();

// GET /api/omni/character - User-specific character stats
router.get("/", optionalAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const character = await getOrCreateCharacter(authReq.clerkId);
  res.json(character);
});

// GET /api/omni/character/events - User-specific learning events (or global for anonymous)
router.get("/events", optionalAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const clerkId = authReq.clerkId;
  const agentWhere = clerkId ? { agentId: clerkId } : { agentId: null };
  const events = await db
    .select()
    .from(learningLog)
    .where(agentWhere)
    .orderBy(desc(learningLog.createdAt))
    .limit(100);
  res.json(events);
});

export default router;
