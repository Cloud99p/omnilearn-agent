import { Router } from "express";
import { getOrCreateCharacter } from "../../brain/index.js";
import { db } from "@workspace/db";
import { learningLog } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

const router = Router();

// GET /api/omni/character
router.get("/", async (req, res) => {
  const character = await getOrCreateCharacter(null);
  res.json(character);
});

// GET /api/omni/character/events
router.get("/events", async (req, res) => {
  const events = await db
    .select()
    .from(learningLog)
    .orderBy(desc(learningLog.createdAt))
    .limit(100);
  res.json(events);
});

export default router;
