import { Router } from "express";
import { db } from "@workspace/db";
import { networkNeurons, networkSynapses, networkAgents, networkPulses } from "@workspace/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { contributeNeurons, queryNetwork, getNetworkStats, runDecay } from "../brain/network.js";

const router = Router();

router.get("/network/stats", async (req, res) => {
  try {
    res.json(await getNetworkStats());
  } catch (err) {
    req.log.error(err, "network stats error");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

router.get("/network/neurons", async (req, res) => {
  try {
    const limit = Math.min(200, Number(req.query.limit ?? 50));
    const sort = String(req.query.sort ?? "weight");
    const order = sort === "recent" ? desc(networkNeurons.createdAt) : desc(networkNeurons.weight);
    const rows = await db.select({
      id: networkNeurons.id,
      content: networkNeurons.content,
      type: networkNeurons.type,
      tags: networkNeurons.tags,
      weight: networkNeurons.weight,
      reinforcementCount: networkNeurons.reinforcementCount,
      accessCount: networkNeurons.accessCount,
      isCore: networkNeurons.isCore,
      sourceAgent: networkNeurons.sourceAgent,
      createdAt: networkNeurons.createdAt,
    }).from(networkNeurons).orderBy(order).limit(limit);
    res.json(rows);
  } catch (err) {
    req.log.error(err, "network neurons error");
    res.status(500).json({ error: "Failed to list neurons" });
  }
});

router.get("/network/synapses", async (req, res) => {
  try {
    const limit = Math.min(300, Number(req.query.limit ?? 150));
    const rows = await db.select({
      id: networkSynapses.id,
      sourceId: networkSynapses.sourceId,
      targetId: networkSynapses.targetId,
      weight: networkSynapses.weight,
      activationCount: networkSynapses.activationCount,
    }).from(networkSynapses).orderBy(desc(networkSynapses.weight)).limit(limit);
    res.json(rows);
  } catch (err) {
    req.log.error(err, "network synapses error");
    res.status(500).json({ error: "Failed to list synapses" });
  }
});

router.get("/network/agents", async (req, res) => {
  try {
    const rows = await db.select().from(networkAgents).orderBy(desc(networkAgents.totalContributions));
    res.json(rows);
  } catch (err) {
    req.log.error(err, "network agents error");
    res.status(500).json({ error: "Failed to list agents" });
  }
});

router.get("/network/pulses", async (req, res) => {
  try {
    const limit = Math.min(100, Number(req.query.limit ?? 40));
    const rows = await db.select().from(networkPulses)
      .orderBy(desc(networkPulses.createdAt)).limit(limit);
    res.json(rows);
  } catch (err) {
    req.log.error(err, "network pulses error");
    res.status(500).json({ error: "Failed to list pulses" });
  }
});

router.post("/network/contribute", async (req, res) => {
  const GHOST_SECRET = process.env.GHOST_SECRET;
  
  // SECURITY: Require ghost secret header for contribute operations (optional for self)
  const providedSecret = req.headers["x-ghost-secret"] as string | undefined;
  const agentName = req.body.agentName as string | undefined;
  
  // If contributing as external agent (not "self"), require secret
  if (agentName && agentName !== "self" && GHOST_SECRET && providedSecret !== GHOST_SECRET) {
    req.log.warn(
      { agentName, agentEndpoint: req.body.agentEndpoint },
      "Unauthorized network contribute attempt - invalid or missing ghost secret"
    );
    res.status(401).json({ error: "Unauthorized: valid X-Ghost-Secret header required for external agents" });
    return;
  }
  
  if (!Array.isArray(neurons) || !neurons.length) {
    res.status(400).json({ error: "neurons array is required" });
    return;
  }
  try {
    const result = await contributeNeurons(neurons, agentName ?? "self", agentEndpoint);
    res.json(result);
  } catch (err) {
    req.log.error(err, "network contribute error");
    res.status(500).json({ error: "Failed to contribute" });
  }
});

router.post("/network/query", async (req, res) => {
  const { text, limit = 20 } = req.body as { text: string; limit?: number };
  if (!text?.trim()) { res.status(400).json({ error: "text is required" }); return; }
  try {
    const results = await queryNetwork(text.trim(), "self", Number(limit));
    res.json(results);
  } catch (err) {
    req.log.error(err, "network query error");
    res.status(500).json({ error: "Failed to query network" });
  }
});

router.post("/network/reinforce/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.update(networkNeurons).set({
      weight: sql`LEAST(10.0, weight + 0.3)`,
      reinforcementCount: sql`reinforcement_count + 1`,
      isCore: sql`(weight + 0.3) >= 5.0`,
      lastReinforcedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(networkNeurons.id, id));
    await db.insert(networkPulses).values({
      agentName: "self",
      eventType: "reinforce",
      neuronsAffected: 1,
      details: `Manual reinforce neuron #${id}`,
    });
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "network reinforce error");
    res.status(500).json({ error: "Failed to reinforce" });
  }
});

router.post("/network/decay", async (req, res) => {
  try {
    await runDecay();
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "network decay error");
    res.status(500).json({ error: "Failed to run decay" });
  }
});

router.post("/network/sync", async (req, res) => {
  const GHOST_SECRET = process.env.GHOST_SECRET;
  
  // SECURITY: Require ghost secret header for sync operations
  const providedSecret = req.headers["x-ghost-secret"] as string | undefined;
  if (GHOST_SECRET && providedSecret !== GHOST_SECRET) {
    req.log.warn(
      { agentName: req.body.agentName, agentEndpoint: req.body.agentEndpoint },
      "Unauthorized network sync attempt - invalid or missing ghost secret"
    );
    res.status(401).json({ error: "Unauthorized: valid X-Ghost-Secret header required" });
    return;
  }
  
  const { knowledge, agentName, agentEndpoint } = req.body as {
    knowledge: Array<{ content: string; type?: string; tags?: string[] }>;
    agentName: string;
    agentEndpoint?: string;
  };
  if (!Array.isArray(knowledge) || !agentName) {
    res.status(400).json({ error: "knowledge array and agentName are required" });
    return;
  }
  try {
    const result = await contributeNeurons(knowledge, agentName, agentEndpoint);
    await db.insert(networkPulses).values({
      agentName,
      eventType: "sync",
      neuronsAffected: result.added + result.reinforced,
      synapsesAffected: result.synapses,
      details: `Ghost sync: +${result.added} new, ${result.reinforced} reinforced`,
    });
    res.json(result);
  } catch (err) {
    req.log.error(err, "network sync error");
    res.status(500).json({ error: "Failed to sync" });
  }
});

export default router;
