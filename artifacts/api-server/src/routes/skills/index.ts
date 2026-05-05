import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../lib/db.js";
import { skills } from "@workspace/db";
import { CreateSkillBody, DeleteSkillParams } from "@workspace/api-zod";

const router = Router();

// List all skills
router.get("/", async (req, res) => {
  try {
    const list = await db.select().from(skills).orderBy(skills.createdAt);
    res.json(list);
  } catch (err) {
    req.log.error({ err }, "Failed to list skills");
    res.status(500).json({ error: "Failed to list skills" });
    return;
  }
});

// Create / install a skill
router.post("/", async (req, res) => {
  const parsed = CreateSkillBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error });
    return;
  }
  try {
    const [skill] = await db
      .insert(skills)
      .values({
        name: parsed.data.name,
        description: parsed.data.description,
        icon: parsed.data.icon ?? "Wrench",
        systemPrompt: parsed.data.systemPrompt,
        category: parsed.data.category,
        isBuiltIn: parsed.data.isBuiltIn ?? false,
        isInstalled: parsed.data.isInstalled ?? true,
      })
      .returning();
    res.status(201).json(skill);
    return;
  } catch (err) {
    req.log.error({ err }, "Failed to create skill");
    res.status(500).json({ error: "Failed to create skill" });
  }
});

// Uninstall / delete a skill
router.delete("/:skillId", async (req, res) => {
  const params = DeleteSkillParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  try {
    await db.delete(skills).where(eq(skills.id, params.data.skillId));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete skill");
    res.status(500).json({ error: "Failed to delete skill" });
  }
});

export default router;
