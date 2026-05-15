import { Router } from "express";
import { db } from "@workspace/db";
import { hebbianProposals, knowledgeNodes } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  proposeHebbianDelta,
  validateProposal,
  applyValidatedProposals,
  autoValidateAndApplyProposal,
} from "../../brain/hebbian.js";

const router = Router();

// GET /api/brain/proposals — list proposals (optionally filtered by status)
router.get("/proposals", async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    const rows = await db
      .select()
      .from(hebbianProposals)
      .where(status ? eq(hebbianProposals.status, status) : undefined)
      .orderBy(desc(hebbianProposals.createdAt))
      .limit(100);

    // Enrich with node content for display
    const enriched = await Promise.all(
      rows.map(async (p) => {
        const [nodeA] = await db
          .select({ id: knowledgeNodes.id, content: knowledgeNodes.content })
          .from(knowledgeNodes)
          .where(eq(knowledgeNodes.id, p.nodeAId));
        const [nodeB] = await db
          .select({ id: knowledgeNodes.id, content: knowledgeNodes.content })
          .from(knowledgeNodes)
          .where(eq(knowledgeNodes.id, p.nodeBId));
        return { ...p, nodeA: nodeA ?? null, nodeB: nodeB ?? null };
      }),
    );

    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to list Hebbian proposals");
    res.status(500).json({ error: "Failed to list proposals" });
  }
});

// POST /api/brain/proposals — submit a new proposal manually
router.post("/proposals", async (req, res) => {
  const { nodeAId, nodeBId, edgeType, evidenceText, deltaWeight, proposerId } =
    req.body as {
      nodeAId: number;
      nodeBId: number;
      edgeType: string;
      evidenceText: string;
      deltaWeight?: number;
      proposerId?: string;
    };

  if (!nodeAId || !nodeBId || !edgeType || !evidenceText) {
    res
      .status(400)
      .json({ error: "nodeAId, nodeBId, edgeType, evidenceText are required" });
    return;
  }

  try {
    const id = await proposeHebbianDelta({
      proposerId: proposerId ?? "local",
      nodeAId,
      nodeBId,
      edgeType: edgeType as "co-occurs",
      evidenceText,
      deltaWeight: deltaWeight ?? 0.1,
    });
    const [proposal] = await db
      .select()
      .from(hebbianProposals)
      .where(eq(hebbianProposals.id, id));
    const result = await autoValidateAndApplyProposal(id);
    const [updated] = await db
      .select()
      .from(hebbianProposals)
      .where(eq(hebbianProposals.id, id));
    res.status(201).json({ proposal: updated ?? proposal, ...result });
  } catch (err) {
    req.log.error({ err }, "Failed to create Hebbian proposal");
    res.status(500).json({ error: "Failed to create proposal" });
  }
});

// POST /api/brain/proposals/:id/validate — run local proof verification and vote
router.post("/proposals/:id/validate", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid proposal id" });
    return;
  }

  try {
    const result = await validateProposal(id);
    const [updated] = await db
      .select()
      .from(hebbianProposals)
      .where(eq(hebbianProposals.id, id));
    res.json({ ...result, proposal: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to validate Hebbian proposal");
    res.status(500).json({ error: "Failed to validate proposal" });
  }
});

// POST /api/brain/proposals/:id/reject — explicitly reject a proposal
router.post("/proposals/:id/reject", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid proposal id" });
    return;
  }

  try {
    await db
      .update(hebbianProposals)
      .set({ status: "rejected", rejectionCount: sql`rejection_count + 1` })
      .where(eq(hebbianProposals.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reject Hebbian proposal");
    res.status(500).json({ error: "Failed to reject proposal" });
  }
});

// POST /api/brain/proposals/apply — apply all validated proposals to the edge graph
router.post("/proposals/apply", async (req, res) => {
  try {
    const applied = await applyValidatedProposals();
    res.json({ applied });
  } catch (err) {
    req.log.error({ err }, "Failed to apply Hebbian proposals");
    res.status(500).json({ error: "Failed to apply proposals" });
  }
});

export default router;
