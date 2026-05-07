import { db } from "@workspace/db";
import { networkNeurons, networkSynapses, networkAgents, networkPulses } from "@workspace/db/schema";
import { eq, desc, sql, and, count, sum, avg, max } from "drizzle-orm";
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
  return inter / new Set([...setA, ...setB]).size;
}

// ─── Agent management ─────────────────────────────────────────────────────────

async function touchAgent(name: string, endpoint?: string): Promise<void> {
  await db.insert(networkAgents).values({
    name,
    endpoint: endpoint ?? null,
    isSelf: name === "self",
    lastActiveAt: new Date(),
  }).onConflictDoUpdate({
    target: networkAgents.name,
    set: { lastActiveAt: new Date() },
  });
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

// ─── Core: contribute neurons ─────────────────────────────────────────────────

export async function contributeNeurons(
  items: Array<{ content: string; type?: string; tags?: string[] }>,
  agentName = "self",
  agentEndpoint?: string
): Promise<{ added: number; reinforced: number; synapses: number }> {
  if (!items.length) return { added: 0, reinforced: 0, synapses: 0 };

  await touchAgent(agentName, agentEndpoint);

  // SAFEGUARD: Content moderation for shared network
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
      }).returning({ id: networkNeurons.id });
      batchIds.push(neu.id);
      added++;
      recent.push({ id: neu.id, tokens: tok }); // prevent re-dedup in same batch
    }
  }

  // Hebbian synapse formation: pair up co-contributed neurons
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

  // Check for newly emerged core neurons
  const newCores = await db.select({ id: networkNeurons.id })
    .from(networkNeurons)
    .where(sql`weight >= 5.0 AND is_core = false`);
  if (newCores.length > 0) {
    await db.execute(sql`UPDATE network_neurons SET is_core = true WHERE weight >= 5.0 AND is_core = false`);
    await db.insert(networkPulses).values({
      agentName,
      eventType: "emerge",
      neuronsAffected: newCores.length,
      synapsesAffected: 0,
      details: `${newCores.length} neuron${newCores.length > 1 ? "s" : ""} reached core status`,
    });
  }

  // Log contribution pulse
  if (added + reinforced > 0) {
    await db.insert(networkPulses).values({
      agentName,
      eventType: "contribute",
      neuronsAffected: added + reinforced,
      synapsesAffected: synapseCount,
      details: `+${added} new · ${reinforced} reinforced · ${synapseCount} synapses formed`,
    });
  }

  // Update agent totals
  await db.update(networkAgents).set({
    totalContributions: sql`${networkAgents.totalContributions} + ${added}`,
    totalReinforcements: sql`${networkAgents.totalReinforcements} + ${reinforced}`,
    lastActiveAt: new Date(),
  }).where(eq(networkAgents.name, agentName));

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
  const all = await db.select({
    id: networkNeurons.id,
    content: networkNeurons.content,
    type: networkNeurons.type,
    weight: networkNeurons.weight,
    tokens: networkNeurons.tokens,
  }).from(networkNeurons).orderBy(desc(networkNeurons.weight)).limit(500);

  const scored = all
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
    // Reinforce synapses between top 3
    const topIds = scored.slice(0, 3).map(n => n.id);
    for (let i = 0; i < topIds.length; i++) {
      for (let j = i + 1; j < topIds.length; j++) {
        const srcId = Math.min(topIds[i], topIds[j]);
        const tgtId = Math.max(topIds[i], topIds[j]);
        await db.update(networkSynapses).set({
          weight: sql`LEAST(5.0, weight + 0.08)`,
          activationCount: sql`activation_count + 1`,
          lastActivatedAt: new Date(),
          updatedAt: new Date(),
        }).where(and(eq(networkSynapses.sourceId, srcId), eq(networkSynapses.targetId, tgtId)));
      }
    }
    await db.insert(networkPulses).values({
      agentName,
      eventType: "query",
      neuronsAffected: scored.length,
      synapsesAffected: 0,
      details: `"${text.slice(0, 80)}"`,
    });
  }

  return scored.map(n => ({
    id: n.id, content: n.content, type: n.type, weight: n.weight, similarity: n.similarity,
  }));
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

  const [synapseRow] = await db.select({ total: count() }).from(networkSynapses);
  const [agentRow] = await db.select({ total: count() }).from(networkAgents);

  const neurons = Number(neuronRow?.total ?? 0);
  const synapses = Number(synapseRow?.total ?? 0);
  const coreNeurons = Number(coreRow?.coreCount ?? 0);
  const totalWeight = parseFloat(Number(neuronRow?.totalWeight ?? 0).toFixed(1));
  const avgWeight = parseFloat(Number(neuronRow?.avgWeight ?? 0).toFixed(2));
  const maxWeight = parseFloat(Number(neuronRow?.maxWeight ?? 0).toFixed(2));
  const health = Math.min(100, Math.round(
    (neurons * 0.3 + synapses * 0.2 + coreNeurons * 10 + totalWeight * 0.1) / 5
  ));

  return {
    neurons, synapses, coreNeurons, totalWeight, avgWeight, maxWeight,
    agents: Number(agentRow?.total ?? 0),
    health,
  };
}
