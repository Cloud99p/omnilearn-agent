import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeNodes, characterState, networkNeurons, networkSynapses, networkAgents, networkPulses } from "@workspace/db/schema";
import { sql, desc, eq } from "drizzle-orm";
import { getNetworkStats } from "../brain/network.js";

const router = Router();

// GET /api/network/stats - Get network statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await getNetworkStats();
    res.json(stats);
  } catch (err) {
    req.log.error(err, "network stats error");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// GET /api/network/pulse - Get network pulse/activity
router.get("/pulse", async (req, res) => {
  try {
    const [{ totalInteractions }] = await db
      .select({ totalInteractions: sql<number>`count(*)` })
      .from(characterState);
    
    const [{ totalNodes }] = await db
      .select({ totalNodes: sql<number>`count(*)` })
      .from(knowledgeNodes);
    
    res.json({
      totalInteractions: totalInteractions || 0,
      totalNodes: totalNodes || 0,
      activeNodes: Math.floor((totalInteractions || 0) / 10),
    });
  } catch (err) {
    req.log.error(err, "network pulse error");
    res.status(500).json({ error: "Failed to get pulse" });
  }
});

// GET /api/network/age - Get average knowledge age
router.get("/age", async (req, res) => {
  try {
    const [{ avgAge }] = await db
      .select({
        avgAge: sql<number>`AVG(EXTRACT(EPOCH FROM (NOW() - ${knowledgeNodes.createdAt})) / 3600)`,
      })
      .from(knowledgeNodes);
    
    res.json({
      avgAgeHours: avgAge || 0,
      totalNodes: await db.select({ count: sql<number>`count(*)` }).from(knowledgeNodes)[0]?.count || 0,
    });
  } catch (err) {
    req.log.error(err, "network age error");
    res.status(500).json({ error: "Failed to get network age" });
  }
});

// GET /api/network/neurons - Get knowledge nodes
router.get("/neurons", async (req, res) => {
  try {
    const limit = Math.min(200, Number(req.query.limit ?? 50));
    const rows = await db
      .select({
        id: networkNeurons.id,
        content: networkNeurons.content,
        type: networkNeurons.type,
        tags: networkNeurons.tags,
        weight: networkNeurons.weight,
        reinforcementCount: networkNeurons.reinforcementCount,
        createdAt: networkNeurons.createdAt,
      })
      .from(networkNeurons)
      .orderBy(networkNeurons.weight, "desc")
      .limit(limit);
    res.json(rows);
  } catch (err) {
    req.log.error(err, "network neurons error");
    res.status(500).json({ error: "Failed to get neurons" });
  }
});

// GET /api/network/synapses - Get connection patterns
router.get("/synapses", async (req, res) => {
  try {
    const limit = Math.min(200, Number(req.query.limit ?? 100));
    const rows = await db
      .select({
        id: networkSynapses.id,
        source: networkSynapses.source,
        target: networkSynapses.target,
        weight: networkSynapses.weight,
        createdAt: networkSynapses.createdAt,
      })
      .from(networkSynapses)
      .orderBy(networkSynapses.weight, "desc")
      .limit(limit);
    res.json(rows);
  } catch (err) {
    req.log.error(err, "network synapses error");
    res.status(500).json({ error: "Failed to get synapses" });
  }
});

// GET /api/network/agents - Get network agents
router.get("/agents", async (req, res) => {
  try {
    const limit = Math.min(200, Number(req.query.limit ?? 50));
    const rows = await db
      .select({
        id: networkAgents.id,
        name: networkAgents.name,
        endpoint: networkAgents.endpoint,
        status: networkAgents.status,
        region: networkAgents.region,
        tasksProcessed: networkAgents.tasksProcessed,
        createdAt: networkAgents.createdAt,
      })
      .from(networkAgents)
      .orderBy(desc(networkAgents.createdAt))
      .limit(limit);
    res.json(rows);
  } catch (err) {
    req.log.error(err, "network agents error");
    res.status(500).json({ error: "Failed to get agents" });
  }
});

// GET /api/network/pulses - Get activity pulses
router.get("/pulses", async (req, res) => {
  try {
    const limit = Math.min(100, Number(req.query.limit ?? 30));
    const rows = await db
      .select({
        id: networkPulses.id,
        type: networkPulses.type,
        payload: networkPulses.payload,
        createdAt: networkPulses.createdAt,
      })
      .from(networkPulses)
      .orderBy(desc(networkPulses.createdAt))
      .limit(limit);
    res.json(rows);
  } catch (err) {
    req.log.error(err, "network pulses error");
    res.status(500).json({ error: "Failed to get pulses" });
  }
});

export default router;
