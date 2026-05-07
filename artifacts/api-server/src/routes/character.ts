import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { characterState } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { rebalanceTraits, needsRebalancing } from "../brain/character.js";
import { requireAuth } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

async function getOrCreateCharacterState(clerkId: string) {
  const [existing] = await db
    .select()
    .from(characterState)
    .where(eq(characterState.clerkId, clerkId))
    .limit(1);
  
  if (existing) return existing;
  
  const [created] = await db
    .insert(characterState)
    .values({
      clerkId,
      curiosity: 50,
      caution: 50,
      confidence: 50,
      verbosity: 50,
      technical: 50,
      empathy: 50,
      creativity: 50,
      totalInteractions: 0,
      totalKnowledgeNodes: 0,
    })
    .returning();
  
  return created;
}

const router = Router();

// ─── Get Current Character ───────────────────────────────────────────────────

router.get("/", requireAuth, async (req, res) => {
  try {
    const clerkId = req.auth.userId;
    const character = await getOrCreateCharacterState(clerkId);
    
    res.json({
      success: true,
      character: {
        curiosity: character.curiosity,
        caution: character.caution,
        confidence: character.confidence,
        verbosity: character.verbosity,
        technical: character.technical,
        empathy: character.empathy,
        creativity: character.creativity,
        totalInteractions: character.totalInteractions,
        totalKnowledgeNodes: character.totalKnowledgeNodes,
      },
      needsRebalancing: needsRebalancing(character),
    });
  } catch (error) {
    logger.error({ error }, "Failed to get character");
    res.status(500).json({
      success: false,
      message: "Failed to get character state",
    });
  }
});

// ─── Rebalance Traits ────────────────────────────────────────────────────────

const rebalanceSchema = z.object({
  force: z.boolean().optional().default(false),
  decayFactor: z.number().min(0.01).max(0.5).optional().default(0.1),
});

router.post("/rebalance", requireAuth, async (req, res) => {
  try {
    const clerkId = req.auth.userId;
    const { force, decayFactor } = rebalanceSchema.parse(req.body);
    
    const character = await getOrCreateCharacterState(clerkId);
    
    // Check if rebalancing is needed (or force it)
    if (!force && !needsRebalancing(character)) {
      return res.json({
        success: true,
        message: "Character traits are already balanced",
        character: {
          curiosity: character.curiosity,
          caution: character.caution,
          confidence: character.confidence,
          verbosity: character.verbosity,
          technical: character.technical,
          empathy: character.empathy,
          creativity: character.creativity,
        },
        rebalanced: false,
      });
    }
    
    // Calculate rebalancing delta
    const rebalance = rebalanceTraits(character, decayFactor);
    
    // Apply rebalancing
    const updated = await db.update(characterState)
      .set({
        curiosity: Math.round(Math.max(0, Math.min(100, character.curiosity + (rebalance.curiosity ?? 0)))),
        caution: Math.round(Math.max(0, Math.min(100, character.caution + (rebalance.caution ?? 0)))),
        confidence: Math.round(Math.max(0, Math.min(100, character.confidence + (rebalance.confidence ?? 0)))),
        verbosity: Math.round(Math.max(0, Math.min(100, character.verbosity + (rebalance.verbosity ?? 0)))),
        technical: Math.round(Math.max(0, Math.min(100, character.technical + (rebalance.technical ?? 0)))),
        empathy: Math.round(Math.max(0, Math.min(100, character.empathy + (rebalance.empathy ?? 0)))),
        creativity: Math.round(Math.max(0, Math.min(100, character.creativity + (rebalance.creativity ?? 0)))),
        updatedAt: new Date(),
      })
      .where(eq(characterState.clerkId, clerkId))
      .returning();
    
    const updatedCharacter = updated[0];
    
    logger.info(
      { clerkId, rebalance, decayFactor, force },
      "Character traits rebalanced"
    );
    
    res.json({
      success: true,
      message: "Character traits rebalanced toward center (50)",
      before: {
        curiosity: character.curiosity,
        caution: character.caution,
        confidence: character.confidence,
        verbosity: character.verbosity,
        technical: character.technical,
        empathy: character.empathy,
        creativity: character.creativity,
      },
      after: {
        curiosity: updatedCharacter.curiosity,
        caution: updatedCharacter.caution,
        confidence: updatedCharacter.confidence,
        verbosity: updatedCharacter.verbosity,
        technical: updatedCharacter.technical,
        empathy: updatedCharacter.empathy,
        creativity: updatedCharacter.creativity,
      },
      rebalanced: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
        errors: error.errors,
      });
    }
    
    logger.error({ error }, "Failed to rebalance character");
    res.status(500).json({
      success: false,
      message: "Failed to rebalance character",
    });
  }
});

// ─── Reset Character (Nuclear Option) ────────────────────────────────────────

router.post("/reset", requireAuth, async (req, res) => {
  try {
    const clerkId = req.auth.userId;
    
    // Reset to defaults
    await db.update(characterState)
      .set({
        curiosity: 50,
        caution: 50,
        confidence: 50,
        verbosity: 50,
        technical: 50,
        empathy: 50,
        creativity: 50,
        totalInteractions: 0,
        totalKnowledgeNodes: 0,
        updatedAt: new Date(),
      })
      .where(eq(characterState.clerkId, clerkId));
    
    logger.info({ clerkId }, "Character reset to defaults");
    
    res.json({
      success: true,
      message: "Character reset to default values (all traits = 50)",
      character: {
        curiosity: 50,
        caution: 50,
        confidence: 50,
        verbosity: 50,
        technical: 50,
        empathy: 50,
        creativity: 50,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to reset character");
    res.status(500).json({
      success: false,
      message: "Failed to reset character",
    });
  }
});

export { router as characterRouter };
