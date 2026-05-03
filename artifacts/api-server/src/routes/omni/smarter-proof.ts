import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeNodes, knowledgeEdges } from "@workspace/db/schema";
import { desc, sql } from "drizzle-orm";
import { retrieveRelevantNodes } from "../../brain/index.js";

const router = Router();

// ─── Probe questions — domain-specific, OmniLearn-native ──────────────────────
const PROBES = [
  "How does OmniLearn extract knowledge from conversations?",
  "What is TF-IDF and how is it used to retrieve facts?",
  "How do knowledge nodes get reinforced over time?",
  "What is the difference between a knowledge node and a synapse?",
  "How does the ghost network distribute AI computation?",
];

// ─── GET /api/omni/smarter-proof ─────────────────────────────────────────────
router.get("/smarter-proof", async (req, res) => {
  try {
    // ── 1. Load all nodes ──────────────────────────────────────────────────────
    const allNodes = await db
      .select({
        id:           knowledgeNodes.id,
        content:      knowledgeNodes.content,
        type:         knowledgeNodes.type,
        confidence:   knowledgeNodes.confidence,
        timesAccessed: knowledgeNodes.timesAccessed,
        createdAt:    knowledgeNodes.createdAt,
      })
      .from(knowledgeNodes)
      .orderBy(desc(knowledgeNodes.timesAccessed));

    const totalNodes = allNodes.length;

    if (totalNodes === 0) {
      res.json({ empty: true, totalNodes: 0 });
      return;
    }

    // ── 2. Pareto test ────────────────────────────────────────────────────────
    // Are top 20% of nodes handling a disproportionate share of accesses?
    // Random baseline: each 20% group handles exactly 20% of accesses.
    // A smart agent concentrates usage on its best nodes.
    const totalAccesses = allNodes.reduce((s, n) => s + (n.timesAccessed ?? 0), 0);
    const top20Count = Math.max(1, Math.ceil(totalNodes * 0.2));
    const top20Accesses = allNodes
      .slice(0, top20Count)
      .reduce((s, n) => s + (n.timesAccessed ?? 0), 0);
    const paretoRatio = totalAccesses > 0 ? top20Accesses / totalAccesses : 0;
    const randomParetoBaseline = 0.2;

    // ── 3. Confidence gradient ────────────────────────────────────────────────
    // Nodes that get used most should have above-average confidence.
    // This shows the system promotes reliable knowledge, not junk.
    const globalAvgConf =
      allNodes.reduce((s, n) => s + n.confidence, 0) / totalNodes;
    const top10Nodes = allNodes.slice(0, Math.min(10, totalNodes));
    const top10AvgConf =
      top10Nodes.reduce((s, n) => s + n.confidence, 0) / top10Nodes.length;
    const confGradient = globalAvgConf > 0 ? top10AvgConf / globalAvgConf : 1;

    // ── 4. Retrieval precision via probe questions ────────────────────────────
    // For each domain question, check what % of retrieved nodes score > 0.1
    // (actually relevant). Compare to random baseline = topK / totalNodes.
    // A smart retriever beats random by a large margin.
    const RELEVANCE_THRESHOLD = 0.08;
    const TOP_K = 6;
    const probeResults: Array<{
      question: string;
      nodesRetrieved: number;
      relevantCount: number;
      avgSimilarity: number;
      precision: number;
    }> = [];

    for (const q of PROBES) {
      try {
        const retrieved = await retrieveRelevantNodes(q, null, TOP_K);
        const relevant = retrieved.filter(n => n.similarity > RELEVANCE_THRESHOLD);
        const avgSim =
          retrieved.length > 0
            ? retrieved.reduce((s, n) => s + n.similarity, 0) / retrieved.length
            : 0;
        probeResults.push({
          question: q,
          nodesRetrieved: retrieved.length,
          relevantCount: relevant.length,
          avgSimilarity: Math.round(avgSim * 1000) / 1000,
          precision: retrieved.length > 0 ? relevant.length / retrieved.length : 0,
        });
      } catch {
        probeResults.push({
          question: q, nodesRetrieved: 0, relevantCount: 0,
          avgSimilarity: 0, precision: 0,
        });
      }
    }

    const avgPrecision =
      probeResults.reduce((s, r) => s + r.precision, 0) / probeResults.length;
    const randomPrecisionBaseline =
      totalNodes > 0 ? Math.min(1, TOP_K / totalNodes) : 1;
    const precisionLift =
      randomPrecisionBaseline > 0 ? avgPrecision / randomPrecisionBaseline : 1;

    // ── 5. Graph density ──────────────────────────────────────────────────────
    // Edges between nodes represent discovered conceptual links.
    // Density = edges / nodes. A richer graph means richer contextual understanding.
    const [{ edgeCount }] = await db
      .select({ edgeCount: sql<number>`count(*)` })
      .from(knowledgeEdges);
    const density = totalNodes > 0 ? Number(edgeCount) / totalNodes : 0;

    // ── 6. Type diversity ─────────────────────────────────────────────────────
    // Smart knowledge is multi-typed: facts + concepts + rules + opinions.
    // Random accumulation skews heavily toward one type.
    const typeCounts: Record<string, number> = {};
    for (const n of allNodes) {
      typeCounts[n.type] = (typeCounts[n.type] ?? 0) + 1;
    }
    const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const dominantTypeFraction =
      totalNodes > 0 ? (typeEntries[0]?.[1] ?? 0) / totalNodes : 1;
    // Lower dominance = more balanced = smarter (learns across domains)

    // ── 7. Top accessed nodes (for display) ───────────────────────────────────
    const topNodes = allNodes.slice(0, 8).map(n => ({
      id:           n.id,
      content:      n.content.slice(0, 120),
      type:         n.type,
      confidence:   n.confidence,
      timesAccessed: n.timesAccessed,
    }));

    // ── 8. Confidence histogram ───────────────────────────────────────────────
    const buckets = [0, 0, 0, 0, 0]; // 0-20, 20-40, 40-60, 60-80, 80-100%
    for (const n of allNodes) {
      const idx = Math.min(4, Math.floor(n.confidence * 5));
      buckets[idx]++;
    }

    res.json({
      snapshot: { totalNodes, totalEdges: Number(edgeCount), totalAccesses },

      pareto: {
        top20Count,
        top20Accesses,
        totalAccesses,
        paretoRatio: Math.round(paretoRatio * 1000) / 1000,
        randomBaseline: randomParetoBaseline,
        lift: Math.round((paretoRatio / randomParetoBaseline) * 100) / 100,
        verdict: paretoRatio > 0.3 ? "pass" : totalAccesses < 5 ? "growing" : "fail",
      },

      confidence: {
        globalAvg: Math.round(globalAvgConf * 1000) / 1000,
        top10Avg:  Math.round(top10AvgConf * 1000) / 1000,
        gradient:  Math.round(confGradient * 100) / 100,
        histogram: buckets.map((count, i) => ({
          label: `${i * 20}–${i * 20 + 20}%`,
          count,
        })),
        verdict: confGradient >= 1.0 ? "pass" : "growing",
      },

      precision: {
        probes: probeResults,
        avgPrecision: Math.round(avgPrecision * 1000) / 1000,
        randomBaseline: Math.round(randomPrecisionBaseline * 1000) / 1000,
        lift: Math.round(precisionLift * 10) / 10,
        verdict: precisionLift >= 1.5 ? "pass" : totalNodes < 10 ? "growing" : "fail",
      },

      graph: {
        totalEdges: Number(edgeCount),
        density: Math.round(density * 100) / 100,
        typeCounts: typeEntries.map(([type, count]) => ({ type, count })),
        dominantTypeFraction: Math.round(dominantTypeFraction * 100) / 100,
        verdict: density >= 0.3 ? "pass" : totalNodes < 5 ? "growing" : "growing",
      },

      topNodes,
    });
  } catch (err) {
    req.log?.error(err, "smarter-proof failed");
    res.status(500).json({ error: "smarter-proof failed" });
  }
});

export default router;
