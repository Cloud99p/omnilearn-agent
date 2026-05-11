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
  const { neurons, agentName = "self", agentEndpoint } = req.body as {
    neurons: Array<{ content: string; type?: string; tags?: string[] }>;
    agentName?: string;
    agentEndpoint?: string;
  };
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
  
  const { knowledge, agentName, agentEndpoint, relayPath } = req.body as {
    knowledge: Array<{ content: string; type?: string; tags?: string[] }>;
    agentName: string;
    agentEndpoint?: string;
    relayPath?: string;
  };
  if (!Array.isArray(knowledge) || !agentName) {
    res.status(400).json({ error: "knowledge array and agentName are required" });
    return;
  }
  try {
    const result = await contributeNeurons(knowledge, agentName, agentEndpoint, relayPath);
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

router.post("/network/vote/:id", async (req, res) => {
  const GHOST_SECRET = process.env.GHOST_SECRET;
  const providedSecret = req.headers["x-ghost-secret"] as string | undefined;
  
  if (GHOST_SECRET && providedSecret !== GHOST_SECRET) {
    res.status(401).json({ error: "Unauthorized: valid X-Ghost-Secret header required" });
    return;
  }
  
  const id = Number(req.params.id);
  const { vote, relayPath } = req.body as { vote: "up" | "down"; relayPath?: string };
  
  if (!vote || (vote !== "up" && vote !== "down")) {
    res.status(400).json({ error: "vote must be 'up' or 'down'" });
    return;
  }
  
  try {
    const { success, neuronId, vote: voted, weight } = await voteOnNeuron(id, req.body.agentName || "self", vote, relayPath);
    
    if (!success) {
      res.status(403).json({ 
        error: "Cannot vote - agent not yet eligible (Observer phase, no voting weight)",
        reason: "Wait for agent to progress through Observer → Probationary → Voting Member phases",
      });
      return;
    }
    
    res.json({ success: true, neuronId, vote: voted, weight });
  } catch (err) {
    req.log.error(err, "network vote error");
    res.status(500).json({ error: "Failed to vote" });
  }
});

// POST /api/network/ratify/:id — ratify a neuron (requires GHOST_SECRET)
router.post("/network/ratify/:id", async (req, res) => {
  const GHOST_SECRET = process.env.GHOST_SECRET;
  const providedSecret = req.headers["x-ghost-secret"] as string | undefined;
  
  if (GHOST_SECRET && providedSecret !== GHOST_SECRET) {
    res.status(401).json({ error: "Unauthorized: valid X-Ghost-Secret header required" });
    return;
  }
  
  const id = Number(req.params.id);
  const { quorumSize } = req.body as { quorumSize?: number };
  
  try {
    const { success, ratified, quorum } = await ratifyNeuron(id, req.body.agentName || "self", quorumSize || 3);
    
    res.json({ success, ratified, quorum });
  } catch (err) {
    req.log.error(err, "network ratify error");
    res.status(500).json({ error: "Failed to ratify" });
  }
});

// GET /api/network/probation — list neurons waiting for ratification
router.get("/network/probation", async (req, res) => {
  try {
    const now = new Date();
    const probationNeurons = await db.select({
      id: networkNeurons.id,
      content: networkNeurons.content,
      sourceAgent: networkNeurons.sourceAgent,
      createdAt: networkNeurons.createdAt,
      ratificationQuorum: networkNeurons.ratificationQuorum,
      isRatified: networkNeurons.isRatified,
    }).from(networkNeurons)
      .where(and(
        eq(networkNeurons.isRatified, false),
        eq(networkNeurons.sourceAgent, "!="), // Will be filtered by agent
      ))
      .orderBy(networkNeurons.createdAt)
      .limit(100);
    
    // Get ratification progress for each neuron
    const result = await Promise.all(probationNeurons.map(async (n) => {
      const ratifications = await db.select({ agentName: networkVotes.agentName })
        .from(networkVotes)
        .where(eq(networkVotes.neuronId, n.id));
      
      return {
        id: n.id,
        content: n.content,
        sourceAgent: n.sourceAgent,
        createdAt: n.createdAt,
        ratificationQuorum: n.ratificationQuorum ?? 0,
        ratifications: ratifications.length,
        ratificationsBy: ratifications.map(r => r.agentName),
        daysSinceSubmitted: Math.floor((now.getTime() - new Date(n.createdAt).getTime()) / (24 * 60 * 60 * 1000)),
      };
    }));
    
    res.json(result);
  } catch (err) {
    req.log.error(err, "network probation list error");
    res.status(500).json({ error: "Failed to list probation neurons" });
  }
});

// GET /api/network/agents — list all agents with their reputation
router.get("/network/agents", async (req, res) => {
  try {
    const agents = await db.select().from(networkAgents)
      .orderBy(desc(networkAgents.trustScore))
      .limit(200);
    
    const result = await Promise.all(agents.map(async (a) => {
      const domainStats = await calculateDomainScore(a.name);
      const accuracyStats = await calculateAccuracyScore(a.name);
      const topologyStats = await calculateTopologyScore(a.name);
      const ageMultiplier = calculateAgeMultiplier(a.firstSeenAt ?? null);
      const { phase, weight } = determinePhase(a.trustScore, a.daysActive ?? 0);
      
      return {
        ...a,
        phase,
        weight,
        domainScore: domainStats.score,
        accuracyScore: accuracyStats.score,
        topologyScore: topologyStats.score,
        uniqueDomains: domainStats.uniqueDomains,
        uniqueRelayPaths: topologyStats.paths,
        submissions: accuracyStats.submissions,
        ratified: accuracyStats.ratified,
        daysActive: a.daysActive ?? 0,
      };
    }));
    
    res.json(result);
  } catch (err) {
    req.log.error(err, "network agents list error");
    res.status(500).json({ error: "Failed to list agents" });
  }
});

// GET /api/network/agent/:name — get specific agent stats
router.get("/network/agent/:name", async (req, res) => {
  try {
    const agentName = req.params.name;
    const agent = await db.select().from(networkAgents).where(eq(networkAgents.name, agentName)).limit(1);
    
    if (!agent[0]) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    
    const domainStats = await calculateDomainScore(agentName);
    const accuracyStats = await calculateAccuracyScore(agentName);
    const topologyStats = await calculateTopologyScore(agentName);
    const ageMultiplier = calculateAgeMultiplier(agent[0].firstSeenAt ?? null);
    const { phase, weight } = determinePhase(agent[0].trustScore, agent[0].daysActive ?? 0);
    
    res.json({
      ...agent[0],
      phase,
      weight,
      domainScore: domainStats.score,
      accuracyScore: accuracyStats.score,
      topologyScore: topologyStats.score,
      uniqueDomains: domainStats.uniqueDomains,
      uniqueRelayPaths: topologyStats.paths,
      submissions: accuracyStats.submissions,
      ratified: accuracyStats.ratified,
      daysActive: agent[0].daysActive ?? 0,
      ageMultiplier,
    });
  } catch (err) {
    req.log.error(err, "network agent stats error");
    res.status(500).json({ error: "Failed to get agent stats" });
  }
});

export default router;
