import { db } from "@workspace/db";
import { 
  networkNeurons, 
  networkSynapses, 
  networkAgents, 
  networkPulses,
  networkVotes,
  agentDomains,
  agentRelayPaths
} from "@workspace/db/schema";
import { eq, desc, sql, and, count, sum, avg, max, inArray } from "drizzle-orm";
import { moderateBatch, logModerationAudit } from "../lib/moderation.js";
import { logger } from "../lib/logger.js";

// ─── Token helpers ─────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(t => t.length > 3);
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  return inter / new Set([...a, ...b]).size;
}

// ─── Reputation Score Calculation ──────────────────────────────────────────────

/**
 * Calculate domain diversity score (x0.40 weight)
 * Formula: min(1.0, (unique_domains / 50)^0.7 × category_spread)
 */
export async function calculateDomainScore(agentName: string): Promise<{ score: number; uniqueDomains: number }> {
  const uniqueDomains = await db.select({ domain: agentDomains.domain })
    .from(agentDomains)
    .where(eq(agentDomains.agentName, agentName));
  
  const domainCount = uniqueDomains.length;
  // Base score: (domains / 50)^0.7, capped at 1.0
  const baseScore = Math.min(1.0, Math.pow(domainCount / 50, 0.7));
  
  return { score: baseScore, uniqueDomains: domainCount };
}

/**
 * Calculate accuracy score (x0.40 weight)
 * Formula: ratified_count / total_submitted (min 30 required for meaningful score)
 */
export async function calculateAccuracyScore(agentName: string): Promise<{ score: number; submissions: number; ratified: number }> {
  const agent = await db.select({
    submissionsCount: networkAgents.submissionsCount,
    ratifiedCount: networkAgents.ratifiedCount,
  }).from(networkAgents).where(eq(networkAgents.name, agentName)).limit(1);
  
  const submissions = agent[0]?.submissionsCount ?? 0;
  const ratified = agent[0]?.ratifiedCount ?? 0;
  
  // Need at least 30 submissions for meaningful accuracy score
  if (submissions < 30) {
    return { score: 0, submissions, ratified };
  }
  
  const score = ratified / submissions;
  return { score, submissions, ratified };
}

/**
 * Calculate topology diversity score (x0.20 weight)
 * Formula: min(1.0, unique_relay_paths / 10)
 */
export async function calculateTopologyScore(agentName: string): Promise<{ score: number; paths: number }> {
  const paths = await db.select({ path: agentRelayPaths.relayPath })
    .from(agentRelayPaths)
    .where(eq(agentRelayPaths.agentName, agentName));
  
  const pathCount = paths.length;
  const score = Math.min(1.0, pathCount / 10);
  
  return { score, paths: pathCount };
}

/**
 * Calculate age multiplier
 * Formula: min(1.0, days_active / 90)
 */
export function calculateAgeMultiplier(firstSeenAt: Date | null): number {
  if (!firstSeenAt) return 0;
  
  const daysActive = Math.floor(
    (Date.now() - new Date(firstSeenAt).getTime()) / (24 * 60 * 60 * 1000)
  );
  
  const multiplier = Math.min(1.0, daysActive / 90);
  return multiplier;
}

/**
 * Calculate overall trust score
 * Formula: (domain_score × 0.40) + (accuracy_score × 0.40) + (topology_score × 0.20) × age_multiplier
 */
export function calculateTrustScore(domainScore: number, accuracyScore: number, topologyScore: number, ageMultiplier: number): number {
  const componentScore = (domainScore * 0.40) + (accuracyScore * 0.40) + (topologyScore * 0.20);
  const trustScore = componentScore * ageMultiplier;
  return Math.max(0, Math.min(1.0, trustScore));
}

/**
 * Determine agent phase based on trust score and days active
 * - Observer: Day 0-30, trust < 0.3
 * - Probationary: Day 31-90, trust 0.3-0.7
 * - Voting Member: Day 91+, trust > 0.7
 */
export function determinePhase(trustScore: number, daysActive: number): { phase: string; weight: number } {
  if (daysActive >= 91 && trustScore >= 0.7) {
    return { phase: "voting_member", weight: 1.0 };
  }
  
  if (daysActive >= 31 && trustScore >= 0.3) {
    // Probationary: weight scales with trust (0.1 - 0.7)
    const weight = Math.max(0.1, Math.min(0.7, trustScore * 1.2));
    return { phase: "probationary", weight };
  }
  
  // Observer: no voting weight
  return { phase: "observer", weight: 0 };
}

// ─── Agent Management ──────────────────────────────────────────────────────────

async function touchAgent(
  name: string, 
  endpoint?: string,
  relayPath?: string
): Promise<void> {
  const now = new Date();
  
  // Update or insert agent
  const [agent] = await db.insert(networkAgents).values({
    name,
    endpoint: endpoint ?? null,
    isSelf: name === "self",
    lastActiveAt: now,
  }).onConflictDoUpdate({
    target: networkAgents.name,
    set: { 
      lastActiveAt: now,
      endpoint: endpoint ?? networkAgents.endpoint,
    },
  }).returning();
  
  // Track relay path for topology diversity
  if (relayPath && name !== "self") {
    await db.insert(agentRelayPaths).values({
      agentName: name,
      relayPath,
      asnCount: relayPath.split("->").length,
    }).onConflictDoNothing();
  }
}

async function updateAgentReputation(name: string): Promise<void> {
  if (name === "self") return; // Self always has full trust
  
  const agent = await db.select({
    firstSeenAt: networkAgents.firstSeenAt,
  }).from(networkAgents).where(eq(networkAgents.name, name)).limit(1);
  
  const domainStats = await calculateDomainScore(name);
  const accuracyStats = await calculateAccuracyScore(name);
  const topologyStats = await calculateTopologyScore(name);
  const ageMultiplier = calculateAgeMultiplier(agent[0]?.firstSeenAt ?? null);
  
  const trustScore = calculateTrustScore(
    domainStats.score,
    accuracyStats.score,
    topologyStats.score,
    ageMultiplier
  );
  
  const { phase, weight } = determinePhase(trustScore, domainStats.uniqueDomains);
  
  // Calculate days active
  const daysActive = agent[0]?.firstSeenAt 
    ? Math.floor((Date.now() - new Date(agent[0].firstSeenAt).getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  
  // Update agent with reputation data
  await db.update(networkAgents).set({
    trustScore,
    phase,
    phaseStartedAt: phase === "observer" ? networkAgents.phaseStartedAt : now,
    uniqueDomains: domainStats.uniqueDomains,
    domainScore: domainStats.score,
    submissionsCount: accuracyStats.submissions,
    ratifiedCount: accuracyStats.ratified,
    accuracyScore: accuracyStats.score,
    uniqueRelayPaths: topologyStats.paths,
    topologyScore: topologyStats.score,
    ageMultiplier,
    daysActive,
  }).where(eq(networkAgents.name, name));
}

// ─── Decay ────────────────────────────────────────────────────────────────────

async function needsDecay(): Promise<boolean> {
  const rows = await db.select({ createdAt: networkPulses.createdAt })
    .from(networkPulses)
    .where(eq(networkPulses.eventType, "decay"))
    .orderBy(desc(networkPulses.createdAt))
    .limit(1);
  if (!rows.length) return true;
  return Date.now() - new Date(rows[0].createdAt).getTime() > 30 * 60 * 1000;
}

export async function runDecay(): Promise<void> {
  // Decay all neuron weights
  await db.update(networkNeurons).set({
    weight: sql`GREATEST(0.1, ${networkNeurons.weight} - 0.05)`,
    decayCount: sql`${networkNeurons.decayCount} + 1`,
    isCore: sql`(${networkNeurons.weight} - 0.05) >= 5.0`,
    updatedAt: new Date(),
  });

  // Decay all synapse weights
  await db.update(networkSynapses).set({
    weight: sql`GREATEST(0.05, ${networkSynapses.weight} - 0.02)`,
    updatedAt: new Date(),
  });

  // Count weakened nodes for pulse log
  const [dnRow] = await db.select({ n: count() })
    .from(networkNeurons)
    .where(sql`${networkNeurons.weight} <= 0.15`);
  const [dsRow] = await db.select({ s: count() })
    .from(networkSynapses)
    .where(sql`${networkSynapses.weight} <= 0.07`);

  await db.insert(networkPulses).values({
    agentName: "system",
    eventType: "decay",
    neuronsAffected: Number(dnRow?.n ?? 0),
    synapsesAffected: Number(dsRow?.s ?? 0),
    details: "Hebbian synaptic decay cycle",
  });
}

// ─── Core: contribute neurons ──────────────────────────────────────────────────

export async function contributeNeurons(
  items: Array<{ content: string; type?: string; tags?: string[] }>,
  agentName = "self",
  agentEndpoint?: string,
  relayPath?: string
): Promise<{ added: number; reinforced: number; synapses: number }> {
  if (!items.length) return { added: 0, reinforced: 0, synapses: 0 };

  // Track relay path for topology diversity
  await touchAgent(agentName, agentEndpoint, relayPath);

  // SAFEGUARD: Content moderation
  const { approved, rejected } = moderateBatch(items);
  
  if (rejected.length > 0) {
    logModerationAudit({
      timestamp: new Date().toISOString(),
      userId: agentName,
      action: "reject",
      contentType: "network_neuron",
      reason: `${rejected.length} items blocked by moderation`,
    });
    logger.warn(
      { agent: agentName, rejected: rejected.length, total: items.length },
      "Network contribution: content moderation blocked items"
    );
  }
  
  // Only process approved items
  items = approved;
  if (!items.length) {
    return { added: 0, reinforced: 0, synapses: 0 };
  }

  // Load recent neurons for dedup
  const recent = await db.select({
    id: networkNeurons.id,
    tokens: networkNeurons.tokens,
  }).from(networkNeurons).orderBy(desc(networkNeurons.updatedAt)).limit(2000);

  let added = 0;
  let reinforced = 0;
  const batchIds: number[] = [];

  for (const item of items) {
    if (!item.content?.trim()) continue;
    const tok = tokenize(item.content);

    // Find duplicate via Jaccard
    let bestId: number | null = null;
    let bestScore = 0;
    for (const r of recent) {
      const s = jaccard(tok, r.tokens as string[]);
      if (s > 0.55 && s > bestScore) { bestId = r.id; bestScore = s; }
    }

    if (bestId !== null) {
      await db.update(networkNeurons).set({
        weight: sql`LEAST(10.0, weight + 0.2)`,
        reinforcementCount: sql`reinforcement_count + 1`,
        isCore: sql`(weight + 0.2) >= 5.0`,
        lastReinforcedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(networkNeurons.id, bestId));
      batchIds.push(bestId);
      reinforced++;
    } else {
      const [neu] = await db.insert(networkNeurons).values({
        content: item.content.trim(),
        type: item.type ?? "fact",
        tags: item.tags ?? [],
        weight: 1.0,
        sourceAgent: agentName,
        tokens: tok,
        isRatified: false,
        ratificationQuorum: 0,
        positiveVotes: 0,
        negativeVotes: 0,
        voteScore: 0.0,
        weightedVoteScore: 0.0,
      }).returning({ id: networkNeurons.id });
      batchIds.push(neu.id);
      added++;
      recent.push({ id: neu.id, tokens: tok });
      
      // Track domain from content for agent reputation
      const urlMatch = item.content.match(/https?:\/\/([^\/]+)/);
      if (urlMatch && agentName !== "self") {
        await db.insert(agentDomains).values({
          agentName,
          domain: urlMatch[1],
          contributionCount: 1,
        }).onConflictDoUpdate({
          target: [agentDomains.agentName, agentDomains.domain],
          set: { contributionCount: sql`${agentDomains.contributionCount} + 1` },
        });
      }
    }
  }

  // Hebbian synapse formation
  let synapseCount = 0;
  const cap = Math.min(batchIds.length, 8);
  for (let i = 0; i < cap; i++) {
    for (let j = i + 1; j < cap; j++) {
      const srcId = Math.min(batchIds[i], batchIds[j]);
      const tgtId = Math.max(batchIds[i], batchIds[j]);
      if (srcId === tgtId) continue;
      try {
        await db.insert(networkSynapses).values({
          sourceId: srcId,
          targetId: tgtId,
          weight: 0.5,
          activationCount: 1,
          lastActivatedAt: new Date(),
        }).onConflictDoUpdate({
          target: [networkSynapses.sourceId, networkSynapses.targetId],
          set: {
            weight: sql`LEAST(5.0, network_synapses.weight + 0.15)`,
            activationCount: sql`network_synapses.activation_count + 1`,
            lastActivatedAt: new Date(),
            updatedAt: new Date(),
          },
        });
        synapseCount++;
      } catch { /* ignore duplicate violations */ }
    }
  }

  // Update agent totals
  await db.update(networkAgents).set({
    totalContributions: sql`${networkAgents.totalContributions} + ${added}`,
    totalReinforcements: sql`${networkAgents.totalReinforcements} + ${reinforced}`,
    submissionsCount: sql`${networkAgents.submissionsCount} + ${added}`,
    lastActiveAt: new Date(),
  }).where(eq(networkAgents.name, agentName));

  // Update agent reputation
  await updateAgentReputation(agentName);

  // Auto-decay if due
  if (await needsDecay()) runDecay().catch(() => {});

  return { added, reinforced, synapses: synapseCount };
}

// ─── Query ────────────────────────────────────────────────────────────────────

export async function queryNetwork(
  text: string,
  agentName = "self",
  limit = 20
): Promise<Array<{ id: number; content: string; type: string; weight: number; similarity: number }>> {
  const tokens = tokenize(text);
  
  // Filter out non-ratified neurons from external agents
  const now = new Date();
  const all = await db.select({
    id: networkNeurons.id,
    content: networkNeurons.content,
    type: networkNeurons.type,
    weight: networkNeurons.weight,
    tokens: networkNeurons.tokens,
    sourceAgent: networkNeurons.sourceAgent,
    isRatified: networkNeurons.isRatified,
    createdAt: networkNeurons.createdAt,
  }).from(networkNeurons).orderBy(desc(networkNeurons.weight)).limit(500);
  
  // Filter: only show ratified neurons, or neurons from "self", or neurons < 30 days old (for self)
  const eligible = all.filter(n => {
    if (n.sourceAgent === "self") return true;
    if (n.isRatified) return true;
    const ageMs = now.getTime() - new Date(n.createdAt).getTime();
    return ageMs < 30 * 24 * 60 * 60 * 1000; // 30 days
  });

  const scored = eligible
    .map(n => ({ ...n, similarity: jaccard(tokens, n.tokens as string[]) }))
    .filter(n => n.similarity > 0.05 || n.weight > 3)
    .sort((a, b) => (b.weight * 0.4 + b.similarity * 0.6) - (a.weight * 0.4 + a.similarity * 0.6))
    .slice(0, limit);

  if (scored.length > 0) {
    // Reinforce top accessed neurons
    for (const n of scored.slice(0, 5)) {
      await db.update(networkNeurons).set({
        accessCount: sql`access_count + 1`,
        weight: sql`LEAST(10.0, weight + 0.08)`,
        updatedAt: new Date(),
      }).where(eq(networkNeurons.id, n.id));
    }
  }

  return scored.map(n => ({
    id: n.id, content: n.content, type: n.type, weight: n.weight, similarity: n.similarity,
  }));
}

// ─── Voting System ─────────────────────────────────────────────────────────────

export async function voteOnNeuron(
  neuronId: number,
  agentName: string,
  vote: "up" | "down",
  relayPath?: string
): Promise<{ success: boolean; neuronId: number; vote: string; weight: number }> {
  if (agentName === "self") {
    // Self always has full voting weight
    const [neuron] = await db.select().from(networkNeurons).where(eq(networkNeurons.id, neuronId));
    if (!neuron) return { success: false, neuronId, vote, weight: 0 };
    
    await db.update(networkNeurons).set({
      positiveVotes: vote === "up" ? sql`positive_votes + 1` : networkNeurons.positiveVotes,
      negativeVotes: vote === "down" ? sql`negative_votes + 1` : networkNeurons.negativeVotes,
      voteScore: sql`vote_score + ${vote === "up" ? 1 : -1}`,
      weight: vote === "up" 
        ? sql`LEAST(10.0, weight + 0.1)` 
        : sql`GREATEST(0.1, weight - 0.1)`,
      updatedAt: new Date(),
    }).where(eq(networkNeurons.id, neuronId));
    
    return { success: true, neuronId, vote, weight: 1.0 };
  }
  
  // External agent: check reputation and phase
  const agent = await db.select({
    trustScore: networkAgents.trustScore,
    phase: networkAgents.phase,
    uniqueDomains: networkAgents.uniqueDomains,
    submissionsCount: networkAgents.submissionsCount,
    ratifiedCount: networkAgents.ratifiedCount,
  }).from(networkAgents).where(eq(networkAgents.name, agentName)).limit(1);
  
  if (!agent[0]) {
    return { success: false, neuronId, vote, weight: 0 };
  }
  
  const { trustScore, phase, uniqueDomains, submissionsCount, ratifiedCount } = agent[0];
  
  // Phase 1 (Observer): No voting
  if (phase === "observer") {
    return { success: false, neuronId, vote, weight: 0 };
  }
  
  // Calculate voting weight based on phase
  let votingWeight = 0;
  if (phase === "probationary") {
    // Probationary: weight scales with trust (0.1 - 0.7)
    votingWeight = Math.max(0.1, Math.min(0.7, trustScore * 1.2));
  } else if (phase === "voting_member") {
    // Voting Member: full weight (0-1.0 based on trust)
    votingWeight = trustScore;
  }
  
  if (votingWeight <= 0) {
    return { success: false, neuronId, vote, weight: 0 };
  }
  
  // Track the vote
  await db.insert(networkVotes).values({
    neuronId,
    agentName,
    vote,
    weight: votingWeight,
    agentTrustScore: trustScore,
    agentPhase: phase,
  }).onConflictDoNothing();
  
  // Update neuron vote scores (weighted)
  const voteDelta = vote === "up" ? votingWeight : -votingWeight;
  await db.update(networkNeurons).set({
    positiveVotes: vote === "up" ? sql`positive_votes + 1` : networkNeurons.positiveVotes,
    negativeVotes: vote === "down" ? sql`negative_votes + 1` : networkNeurons.negativeVotes,
    voteScore: sql`vote_score + ${voteDelta}`,
    weightedVoteScore: sql`weighted_vote_score + ${voteDelta}`,
    updatedAt: new Date(),
  }).where(eq(networkNeurons.id, neuronId));
  
  // Track relay path
  if (relayPath) {
    await touchAgent(agentName, undefined, relayPath);
  }
  
  return { success: true, neuronId, vote, weight: votingWeight };
}

// ─── Ratification ──────────────────────────────────────────────────────────────

export async function ratifyNeuron(
  neuronId: number,
  agentName: string,
  quorumSize: number = 3
): Promise<{ success: boolean; ratified: boolean; quorum: number }> {
  const [neuron] = await db.select().from(networkNeurons).where(eq(networkNeurons.id, neuronId));
  if (!neuron) return { success: false, ratified: false, quorum: 0 };
  
  // Already ratified?
  if (neuron.isRatified) return { success: true, ratified: false, quorum: neuron.ratificationQuorum };
  
  // Increment quorum
  const newQuorum = (neuron.ratificationQuorum ?? 0) + 1;
  const isRatified = newQuorum >= quorumSize;
  
  await db.update(networkNeurons).set({
    isRatified,
    ratificationQuorum: newQuorum,
    ratifiedAt: isRatified ? new Date() : neuron.ratifiedAt,
    updatedAt: new Date(),
  }).where(eq(networkNeurons.id, neuronId));
  
  // If ratified, update agent's ratified count
  if (isRatified && agentName !== "self") {
    await db.update(networkAgents).set({
      ratifiedCount: sql`${networkAgents.ratifiedCount} + 1`,
    }).where(eq(networkAgents.name, agentName));
    
    await updateAgentReputation(agentName);
  }
  
  return { success: true, ratified: isRatified, quorum: newQuorum };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getNetworkStats() {
  const [neuronRow] = await db.select({
    total: count(),
    totalWeight: sum(networkNeurons.weight),
    avgWeight: avg(networkNeurons.weight),
    maxWeight: max(networkNeurons.weight),
  }).from(networkNeurons);

  const [coreRow] = await db.select({ coreCount: count() })
    .from(networkNeurons)
    .where(eq(networkNeurons.isCore, true));

  const [ratifiedRow] = await db.select({ 
    total: count(),
    percentage: avg(sql`${networkNeurons.isRatified}::int`),
  })
    .from(networkNeurons);

  const [agentRow] = await db.select({
    totalAgents: count(),
    votingMembers: count().filterWhere(eq(networkAgents.phase, "voting_member")),
    probationary: count().filterWhere(eq(networkAgents.phase, "probationary")),
    observers: count().filterWhere(eq(networkAgents.phase, "observer")),
  })
    .from(networkAgents);

  return {
    neurons: {
      total: Number(neuronRow?.total ?? 0),
      totalWeight: Number(neuronRow?.totalWeight ?? 0),
      avgWeight: Number(neuronRow?.avgWeight ?? 0),
      maxWeight: Number(neuronRow?.maxWeight ?? 0),
      core: Number(coreRow?.coreCount ?? 0),
      ratified: Number(ratifiedRow?.total ?? 0),
      ratifiedPercentage: Number(ratifiedRow?.percentage ?? 0) * 100,
    },
    agents: {
      total: Number(agentRow?.totalAgents ?? 0),
      votingMembers: Number(agentRow?.votingMembers ?? 0),
      probationary: Number(agentRow?.probationary ?? 0),
      observers: Number(agentRow?.observers ?? 0),
    },
  };
}

export async function getAgentStats(agentName: string) {
  const agent = await db.select().from(networkAgents).where(eq(networkAgents.name, agentName)).limit(1);
  if (!agent[0]) return null;
  
  const domainStats = await calculateDomainScore(agentName);
  const accuracyStats = await calculateAccuracyScore(agentName);
  const topologyStats = await calculateTopologyScore(agentName);
  
  return {
    ...agent[0],
    domainScore: domainStats.score,
    accuracyScore: accuracyStats.score,
    topologyScore: topologyStats.score,
    uniqueDomains: domainStats.uniqueDomains,
    submissions: accuracyStats.submissions,
    ratified: accuracyStats.ratified,
    relayPaths: topologyStats.paths,
    phase,
    weight: determinePhase(agent[0].trustScore, agent[0].daysActive).weight,
  };
}
