import { Router } from "express";
import { db } from "@workspace/db";
import { ontologyNodes, ontologyProposals, knowledgeNodes } from "@workspace/db/schema";
import { eq, desc, and, ne } from "drizzle-orm";
import {
  runOntologyReflection,
  executeOntologyProposal,
  validateOntologyProposal,
} from "../../brain/ontology.js";

const router = Router();

// GET /api/brain/ontology/nodes — list ontology nodes (vocabulary, rules, constraints)
router.get("/ontology/nodes", async (req, res) => {
  try {
    const rows = await db.select().from(ontologyNodes).orderBy(desc(ontologyNodes.createdAt)).limit(200);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list ontology nodes");
    res.status(500).json({ error: "Failed to list ontology nodes" });
  }
});

// GET /api/brain/ontology/proposals — list ontology proposals
router.get("/ontology/proposals", async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    const rows = await db
      .select()
      .from(ontologyProposals)
      .where(status ? eq(ontologyProposals.status, status) : undefined)
      .orderBy(desc(ontologyProposals.createdAt))
      .limit(100);

    // Enrich with node content
    const enriched = await Promise.all(rows.map(async (p) => {
      const nodeA = p.targetNodeId
        ? (await db.select({ id: knowledgeNodes.id, content: knowledgeNodes.content, type: knowledgeNodes.type })
            .from(knowledgeNodes).where(eq(knowledgeNodes.id, p.targetNodeId)))[0] ?? null
        : null;
      const nodeB = p.targetNodeBId
        ? (await db.select({ id: knowledgeNodes.id, content: knowledgeNodes.content, type: knowledgeNodes.type })
            .from(knowledgeNodes).where(eq(knowledgeNodes.id, p.targetNodeBId)))[0] ?? null
        : null;
      return { ...p, nodeA, nodeB };
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to list ontology proposals");
    res.status(500).json({ error: "Failed to list ontology proposals" });
  }
});

// POST /api/brain/ontology/reflect — trigger a reflection cycle immediately
router.post("/ontology/reflect", async (req, res) => {
  try {
    const result = await runOntologyReflection();
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Ontology reflection failed");
    res.status(500).json({ error: "Reflection failed" });
  }
});

// POST /api/brain/ontology/proposals/:id/validate — verify proof
router.post("/ontology/proposals/:id/validate", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const result = await validateOntologyProposal(id);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to validate ontology proposal");
    res.status(500).json({ error: "Validation failed" });
  }
});

// POST /api/brain/ontology/proposals/:id/approve — mark as approved for execution
router.post("/ontology/proposals/:id/approve", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const validation = await validateOntologyProposal(id);
    if (!validation.valid) {
      res.status(422).json({ error: `Cannot approve: ${validation.reason}` });
      return;
    }
    await db.update(ontologyProposals).set({ status: "approved" }).where(eq(ontologyProposals.id, id));
    const [updated] = await db.select().from(ontologyProposals).where(eq(ontologyProposals.id, id));
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to approve ontology proposal");
    res.status(500).json({ error: "Approval failed" });
  }
});

// POST /api/brain/ontology/proposals/:id/reject
router.post("/ontology/proposals/:id/reject", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.update(ontologyProposals).set({ status: "rejected" }).where(eq(ontologyProposals.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reject ontology proposal");
    res.status(500).json({ error: "Rejection failed" });
  }
});

// POST /api/brain/ontology/proposals/:id/execute — apply an approved proposal
router.post("/ontology/proposals/:id/execute", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const result = await executeOntologyProposal(id);
    if (!result.ok) { res.status(422).json({ error: result.summary }); return; }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to execute ontology proposal");
    res.status(500).json({ error: "Execution failed" });
  }
});

export default router;
