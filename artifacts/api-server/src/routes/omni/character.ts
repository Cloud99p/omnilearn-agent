import { Router } from "express";
import { getOrCreateCharacter } from "../../brain/index.js";
import { db } from "@workspace/db";
import { characterState } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/omni/character
router.get("/", async (req, res) => {
  const character = await getOrCreateCharacter(null);
  res.json(character);
});

export default router;
