/**
 * ontology.ts — self-reflection engine for the knowledge graph
 *
 * Runs as a slow background process. Each cycle scans the graph for structural
 * problems and emits OntologyProposals. Approved proposals are then executed by
 * executeOntologyProposal(id).
 *
 * Operations:
 *   new-edge-type  — register a previously ad-hoc edge label as a first-class vocab entry
 *   split-node     — break a node that covers too many unrelated concepts into two
 *   merge-nodes    — collapse two nodes that are near-identical into one
 *   demote-rule    — lower node.type from "rule" to "fact" when confidence has eroded
 */

import crypto from "crypto";
import { db } from "@workspace/db";
import {
  knowledgeNodes, knowledgeEdges,
  ontologyNodes, ontologyProposals,
  type KnowledgeNode,
} from "@workspace/db/schema";
import { eq, sql, and, ne, desc, lt, inArray } from "drizzle-orm";
import { logger } from "../lib/logger.js";

// ── Proof helpers ─────────────────────────────────────────────────────────────

function hashText(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function buildOntologyProof(
  opType: string,
  targetNodeId: number | null,
  targetNodeBId: number | null,
  rationaleHash: string,
  isoTimestamp: string,
): string {
  const input = [opType, targetNodeId ?? "null", targetNodeBId ?? "null", rationaleHash, isoTimestamp].join("|");
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

async function createOntologyProposal(opts: {
  opType: string;
  targetNodeId?: number | null;
  targetNodeBId?: number | null;
  proposedEdgeType?: string;
  proposedContent?: string;
  rationale: string;
}): Promise<number> {
  const { opType, targetNodeId, targetNodeBId, proposedEdgeType, proposedContent, rationale } = opts;
  const isoTimestamp = new Date().toISOString();
  const rationaleHash = hashText(rationale);
  const proposalProof = buildOntologyProof(opType, targetNodeId ?? null, targetNodeBId ?? null, rationaleHash, isoTimestamp);

  const [row] = await db.insert(ontologyProposals).values({
    opType,
    targetNodeId: targetNodeId ?? null,
    targetNodeBId: targetNodeBId ?? null,
    proposedEdgeType: proposedEdgeType ?? null,
    proposedContent: proposedContent ?? null,
    rationale,
    rationaleHash,
    proposalProof,
  }).returning({ id: ontologyProposals.id });

  logger.info({ proposalId: row.id, opType }, "Ontology proposal created");
  return row.id;
}

// ── Re-validate a proposal's proof ───────────────────────────────────────────

export async function validateOntologyProposal(proposalId: number): Promise<{
  valid: boolean;
  steps: { rationaleHashMatch: boolean; proofMatch: boolean; freshnessOk: boolean };
  reason?: string;
}> {
  const [p] = await db.select().from(ontologyProposals).where(eq(ontologyProposals.id, proposalId));
  if (!p) return { valid: false, steps: { rationaleHashMatch: false, proofMatch: false, freshnessOk: false }, reason: "Not found" };

  const rationaleHashMatch = hashText(p.rationale) === p.rationaleHash;
  const recomputedProof = buildOntologyProof(p.opType, p.targetNodeId, p.targetNodeBId, p.rationaleHash, p.createdAt.toISOString());
  const proofMatch = recomputedProof === p.proposalProof;
  const ageMs = Date.now() - new Date(p.createdAt).getTime();
  const freshnessOk = ageMs < 7 * 24 * 60 * 60 * 1000; // 7 days for slow background work

  const valid = rationaleHashMatch && proofMatch && freshnessOk;
  if (!valid) {
    const reason = !freshnessOk ? "Proposal older than 7 days"
      : !rationaleHashMatch ? "Rationale hash mismatch"
      : "Proof mismatch";
    return { valid, steps: { rationaleHashMatch, proofMatch, freshnessOk }, reason };
  }
  return { valid, steps: { rationaleHashMatch, proofMatch, freshnessOk } };
}

// ── Execute an approved ontology proposal ─────────────────────────────────────

export async function executeOntologyProposal(proposalId: number): Promise<{
  ok: boolean;
  summary: string;
}> {
  const [p] = await db.select().from(ontologyProposals).where(eq(ontologyProposals.id, proposalId));
  if (!p) return { ok: false, summary: "Proposal not found" };
  if (p.status !== "approved") return { ok: false, summary: "Proposal must be approved before execution" };

  try {
    let summary = "";

    if (p.opType === "new-edge-type" && p.proposedEdgeType) {
      // Register as a vocabulary OntologyNode
      const existing = await db.select().from(ontologyNodes)
        .where(eq(ontologyNodes.name, p.proposedEdgeType));
      if (existing.length === 0) {
        await db.insert(ontologyNodes).values({
          name: p.proposedEdgeType,
          description: p.rationale,
          nodeType: "edge-vocab",
          payload: { source: "reflection" },
          active: true,
        });
      }
      summary = `Registered new edge type: "${p.proposedEdgeType}"`;

    } else if (p.opType === "demote-rule" && p.targetNodeId) {
      const [target] = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.id, p.targetNodeId));
      if (target && target.type === "rule") {
        await db.update(knowledgeNodes).set({
          type: "fact",
          confidence: Math.max(0.1, target.confidence - 0.2),
          updatedAt: new Date(),
        }).where(eq(knowledgeNodes.id, p.targetNodeId));
        summary = `Demoted rule→fact: "${target.content.slice(0, 60)}"`;
      } else {
        summary = "Target node not found or already demoted";
      }

    } else if (p.opType === "merge-nodes" && p.targetNodeId && p.targetNodeBId) {
      const [nodeA] = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.id, p.targetNodeId));
      const [nodeB] = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.id, p.targetNodeBId));
      if (!nodeA || !nodeB) {
        return { ok: false, summary: "One or both merge targets not found" };
      }

      // Create merged node
      const mergedContent = `${nodeA.content} [merged: ${nodeB.content}]`.slice(0, 500);
      const mergedTags = [...new Set([...nodeA.tags, ...nodeB.tags])];
      const mergedConfidence = (nodeA.confidence + nodeB.confidence) / 2;

      const [merged] = await db.insert(knowledgeNodes).values({
        content: mergedContent,
        type: "concept",
        tags: mergedTags,
        confidence: mergedConfidence,
        source: "ontology-merge",
        clerkId: nodeA.clerkId,
        tfidfVector: {},
        tokens: [],
      }).returning();

      // Re-point edges from both old nodes to the merged node
      await db.update(knowledgeEdges).set({ fromId: merged.id }).where(eq(knowledgeEdges.fromId, nodeA.id));
      await db.update(knowledgeEdges).set({ toId:   merged.id }).where(eq(knowledgeEdges.toId,   nodeA.id));
      await db.update(knowledgeEdges).set({ fromId: merged.id }).where(eq(knowledgeEdges.fromId, nodeB.id));
      await db.update(knowledgeEdges).set({ toId:   merged.id }).where(eq(knowledgeEdges.toId,   nodeB.id));

      // Mark originals as deprecated by tagging them
      await db.update(knowledgeNodes).set({
        tags: [...nodeA.tags, "__deprecated__"],
        confidence: 0.0,
        updatedAt: new Date(),
      }).where(eq(knowledgeNodes.id, nodeA.id));
      await db.update(knowledgeNodes).set({
        tags: [...nodeB.tags, "__deprecated__"],
        confidence: 0.0,
        updatedAt: new Date(),
      }).where(eq(knowledgeNodes.id, nodeB.id));

      summary = `Merged node#${nodeA.id} + node#${nodeB.id} → node#${merged.id}`;

    } else if (p.opType === "split-node" && p.targetNodeId && p.proposedContent) {
      const [target] = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.id, p.targetNodeId));
      if (!target) return { ok: false, summary: "Split target not found" };

      // Parse the proposed split contents — stored as JSON array in proposedContent
      let parts: string[] = [];
      try { parts = JSON.parse(p.proposedContent); } catch { parts = [p.proposedContent]; }
      if (parts.length < 2) parts = [target.content + " (aspect A)", target.content + " (aspect B)"];

      const newNodes: KnowledgeNode[] = [];
      for (const part of parts.slice(0, 3)) {
        const [n] = await db.insert(knowledgeNodes).values({
          content: part.slice(0, 500),
          type: target.type,
          tags: [...target.tags, "__split__"],
          confidence: target.confidence * 0.9,
          source: "ontology-split",
          clerkId: target.clerkId,
          tfidfVector: {},
          tokens: [],
        }).returning();
        newNodes.push(n);
      }

      // Connect split nodes to each other with a "split-from" relationship
      for (let i = 0; i < newNodes.length; i++) {
        for (let j = i + 1; j < newNodes.length; j++) {
          await db.insert(knowledgeEdges).values({
            fromId: newNodes[i].id,
            toId: newNodes[j].id,
            relationship: "related-to",
            weight: 0.8,
          }).onConflictDoNothing?.();
        }
      }

      // Re-point existing edges to the first split node (best approximation)
      if (newNodes[0]) {
        await db.update(knowledgeEdges).set({ fromId: newNodes[0].id }).where(eq(knowledgeEdges.fromId, target.id));
        await db.update(knowledgeEdges).set({ toId:   newNodes[0].id }).where(eq(knowledgeEdges.toId,   target.id));
      }

      // Deprecate original
      await db.update(knowledgeNodes).set({
        tags: [...target.tags, "__deprecated__", "__split__"],
        confidence: 0.0,
        updatedAt: new Date(),
      }).where(eq(knowledgeNodes.id, target.id));

      summary = `Split node#${target.id} into ${newNodes.map(n => `node#${n.id}`).join(", ")}`;
    } else {
      return { ok: false, summary: `Unknown opType or missing fields: ${p.opType}` };
    }

    await db.update(ontologyProposals).set({ status: "executed", executedAt: new Date() })
      .where(eq(ontologyProposals.id, proposalId));

    logger.info({ proposalId, opType: p.opType, summary }, "Ontology proposal executed");
    return { ok: true, summary };

  } catch (err) {
    logger.error({ err, proposalId }, "Ontology proposal execution failed");
    return { ok: false, summary: `Execution error: ${String(err)}` };
  }
}

// ── Reflection cycle ──────────────────────────────────────────────────────────

const REFLECTION_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes between full cycles
let lastReflectionAt = 0;

export async function runOntologyReflection(): Promise<{
  proposed: number;
  checks: string[];
}> {
  const now = Date.now();
  if (now - lastReflectionAt < REFLECTION_COOLDOWN_MS) {
    return { proposed: 0, checks: ["cooldown — skipped"] };
  }
  lastReflectionAt = now;
  logger.info("Ontology reflection cycle starting");

  const proposed: number[] = [];
  const checks: string[] = [];

  // ── 1. Seed core edge-vocab if empty ────────────────────────────────────────
  const existingVocab = await db.select().from(ontologyNodes).where(eq(ontologyNodes.nodeType, "edge-vocab"));
  const registeredEdgeTypes = new Set(existingVocab.map(n => n.name));
  const coreEdgeTypes = [
    { name: "co-occurs",   description: "Two concepts frequently appear together in observations." },
    { name: "related-to",  description: "Semantic similarity relationship between two concepts." },
    { name: "causes",      description: "One concept is a cause or antecedent of another." },
    { name: "contradicts", description: "Two concepts are mutually exclusive or in tension." },
    { name: "supports",    description: "One concept provides evidence or backing for another." },
  ];
  for (const et of coreEdgeTypes) {
    if (!registeredEdgeTypes.has(et.name)) {
      await db.insert(ontologyNodes).values({
        name: et.name,
        description: et.description,
        nodeType: "edge-vocab",
        payload: { source: "core-seed" },
        active: true,
      });
      registeredEdgeTypes.add(et.name);
    }
  }
  checks.push(`edge-vocab: ${registeredEdgeTypes.size} types registered`);

  // ── 2. Discover novel edge types from Hebbian proposals ─────────────────────
  const edges = await db.select({ relationship: knowledgeEdges.relationship }).from(knowledgeEdges);
  const usedRelationships = new Set(edges.map(e => e.relationship));
  for (const rel of usedRelationships) {
    if (!registeredEdgeTypes.has(rel)) {
      const alreadyProposed = await db.select().from(ontologyProposals)
        .where(and(eq(ontologyProposals.opType, "new-edge-type"), eq(ontologyProposals.proposedEdgeType, rel)));
      if (alreadyProposed.length === 0) {
        const id = await createOntologyProposal({
          opType: "new-edge-type",
          proposedEdgeType: rel,
          rationale: `Edge type "${rel}" is used in the graph but not registered in the ontology vocabulary. Registering it formalises its meaning.`,
        });
        proposed.push(id);
      }
    }
  }
  checks.push(`novel-edge-types: ${proposed.length} new proposals`);

  // ── 3. Demote low-confidence rule nodes ─────────────────────────────────────
  const lowConfidenceRules = await db.select().from(knowledgeNodes)
    .where(and(eq(knowledgeNodes.type, "rule"), lt(knowledgeNodes.confidence, 0.4)))
    .limit(20);

  let demoteCount = 0;
  for (const node of lowConfidenceRules) {
    const alreadyProposed = await db.select().from(ontologyProposals)
      .where(and(eq(ontologyProposals.opType, "demote-rule"), eq(ontologyProposals.targetNodeId, node.id),
        ne(ontologyProposals.status, "rejected")));
    if (alreadyProposed.length === 0) {
      await createOntologyProposal({
        opType: "demote-rule",
        targetNodeId: node.id,
        rationale: `Rule node "${node.content.slice(0, 120)}" has confidence ${node.confidence.toFixed(2)} < 0.4 and has been confirmed only ${node.timesConfirmed} times. New evidence suggests it should be reclassified as a fact rather than a governing rule.`,
      });
      demoteCount++;
    }
  }
  checks.push(`demote-rule: ${demoteCount} proposed`);

  // ── 4. Propose merges for near-duplicate concept nodes ───────────────────────
  // Find concept pairs that share many edge neighbours (Jaccard similarity on neighbours)
  const conceptNodes = await db.select().from(knowledgeNodes)
    .where(eq(knowledgeNodes.type, "concept")).limit(200);

  const allEdges = await db.select().from(knowledgeEdges);
  const neighbourSet = (nodeId: number) => {
    const ids = new Set<number>();
    for (const e of allEdges) {
      if (e.fromId === nodeId) ids.add(e.toId);
      if (e.toId   === nodeId) ids.add(e.fromId);
    }
    return ids;
  };

  let mergeCount = 0;
  const alreadyPairedForMerge = new Set<string>();
  for (let i = 0; i < conceptNodes.length && mergeCount < 5; i++) {
    const a = conceptNodes[i];
    const nA = neighbourSet(a.id);
    if (nA.size < 2) continue;
    for (let j = i + 1; j < conceptNodes.length && mergeCount < 5; j++) {
      const b = conceptNodes[j];
      const pairKey = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
      if (alreadyPairedForMerge.has(pairKey)) continue;

      // Token overlap of content
      const tokA = new Set(a.content.toLowerCase().split(/\W+/).filter(t => t.length > 3));
      const tokB = new Set(b.content.toLowerCase().split(/\W+/).filter(t => t.length > 3));
      const inter = [...tokA].filter(t => tokB.has(t)).length;
      const union = new Set([...tokA, ...tokB]).size;
      const tokenJaccard = union > 0 ? inter / union : 0;
      if (tokenJaccard < 0.6) continue;

      // Neighbour structural overlap
      const nB = neighbourSet(b.id);
      const nInter = [...nA].filter(id => nB.has(id)).length;
      const nUnion = new Set([...nA, ...nB]).size;
      const neighbourJaccard = nUnion > 0 ? nInter / nUnion : 0;
      if (neighbourJaccard < 0.4) continue;

      alreadyPairedForMerge.add(pairKey);
      const existing = await db.select().from(ontologyProposals)
        .where(and(
          eq(ontologyProposals.opType, "merge-nodes"),
          eq(ontologyProposals.targetNodeId, a.id),
          eq(ontologyProposals.targetNodeBId, b.id),
          ne(ontologyProposals.status, "rejected"),
        ));
      if (existing.length === 0) {
        await createOntologyProposal({
          opType: "merge-nodes",
          targetNodeId: a.id,
          targetNodeBId: b.id,
          rationale: `Nodes #${a.id} ("${a.content.slice(0, 60)}") and #${b.id} ("${b.content.slice(0, 60)}") have token Jaccard ${tokenJaccard.toFixed(2)} and neighbour Jaccard ${neighbourJaccard.toFixed(2)}, suggesting they represent the same concept. Merging will reduce redundancy.`,
        });
        mergeCount++;
      }
    }
  }
  checks.push(`merge-nodes: ${mergeCount} proposed`);

  // ── 5. Propose splits for over-broad nodes ────────────────────────────────────
  // Nodes that appear in edges with many different relationship types are likely
  // covering multiple distinct sub-concepts.
  const nodeEdgeCounts = new Map<number, Set<string>>();
  for (const e of allEdges) {
    if (!nodeEdgeCounts.has(e.fromId)) nodeEdgeCounts.set(e.fromId, new Set());
    nodeEdgeCounts.get(e.fromId)!.add(e.relationship);
  }

  let splitCount = 0;
  for (const [nodeId, relSet] of nodeEdgeCounts) {
    if (relSet.size < 4 || splitCount >= 3) continue;
    const [node] = conceptNodes.filter(n => n.id === nodeId);
    if (!node) continue;
    const words = node.content.split(/\s+/);
    if (words.length < 6) continue; // likely a short, precise concept — skip

    const alreadySplitProposed = await db.select().from(ontologyProposals)
      .where(and(eq(ontologyProposals.opType, "split-node"), eq(ontologyProposals.targetNodeId, nodeId),
        ne(ontologyProposals.status, "rejected")));
    if (alreadySplitProposed.length > 0) continue;

    // Simple heuristic split: first half of content / second half as separate aspects
    const midword = Math.floor(words.length / 2);
    const partA = words.slice(0, midword).join(" ");
    const partB = words.slice(midword).join(" ");

    await createOntologyProposal({
      opType: "split-node",
      targetNodeId: nodeId,
      proposedContent: JSON.stringify([partA, partB]),
      rationale: `Node #${nodeId} ("${node.content.slice(0, 80)}") participates in ${relSet.size} distinct relationship types (${[...relSet].slice(0, 4).join(", ")}), suggesting it covers multiple sub-concepts. Splitting will increase graph precision.`,
    });
    splitCount++;
  }
  checks.push(`split-node: ${splitCount} proposed`);

  const totalProposed = proposed.length + demoteCount + mergeCount + splitCount;
  logger.info({ totalProposed, checks }, "Ontology reflection cycle complete");
  return { proposed: totalProposed, checks };
}
