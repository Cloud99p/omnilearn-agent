import crypto from "crypto";
import { db } from "@workspace/db";
import { hebbianProposals, knowledgeNodes, knowledgeEdges } from "@workspace/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

export type EdgeRelationship = "co-occurs" | "related-to" | "causes" | "contradicts" | "supports";

// ── Proof construction ────────────────────────────────────────────────────────

export function buildEvidenceHash(evidenceText: string): string {
  return crypto.createHash("sha256").update(evidenceText, "utf8").digest("hex");
}

export function buildProposalProof(
  nodeAId: number,
  edgeType: string,
  nodeBId: number,
  evidenceHash: string,
  isoTimestamp: string,
): string {
  const input = [nodeAId, edgeType, nodeBId, evidenceHash, isoTimestamp].join("|");
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

// ── Proposal creation ─────────────────────────────────────────────────────────

export async function proposeHebbianDelta(opts: {
  proposerId: string;
  nodeAId: number;
  nodeBId: number;
  edgeType: EdgeRelationship;
  evidenceText: string;
  deltaWeight: number;
}): Promise<number> {
  const { proposerId, nodeAId, nodeBId, edgeType, evidenceText, deltaWeight } = opts;
  const isoTimestamp = new Date().toISOString();
  const evidenceHash = buildEvidenceHash(evidenceText);
  const proposalProof = buildProposalProof(nodeAId, edgeType, nodeBId, evidenceHash, isoTimestamp);

  const [row] = await db.insert(hebbianProposals).values({
    proposerId,
    nodeAId,
    nodeBId,
    edgeType,
    evidenceText,
    evidenceHash,
    proposalProof,
    deltaWeight,
  }).returning({ id: hebbianProposals.id });

  logger.info({ proposalId: row.id, nodeAId, nodeBId, edgeType }, "Hebbian proposal created");
  return row.id;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  steps: {
    evidenceHashMatch: boolean;
    proofMatch: boolean;
    semanticOverlap: boolean;
    freshnessOk: boolean;
  };
  reason?: string;
}

export async function validateProposal(proposalId: number): Promise<ValidationResult> {
  const [proposal] = await db
    .select()
    .from(hebbianProposals)
    .where(eq(hebbianProposals.id, proposalId));

  if (!proposal) {
    return { valid: false, steps: { evidenceHashMatch: false, proofMatch: false, semanticOverlap: false, freshnessOk: false }, reason: "Proposal not found" };
  }

  const steps = {
    evidenceHashMatch: false,
    proofMatch: false,
    semanticOverlap: false,
    freshnessOk: false,
  };

  // 1. Re-derive evidence hash from stored text
  const recomputedEvidenceHash = buildEvidenceHash(proposal.evidenceText);
  steps.evidenceHashMatch = recomputedEvidenceHash === proposal.evidenceHash;

  // 2. Reconstruct and compare the proposal proof
  // We need the original timestamp — it is embedded in the proof payload.
  // We store the proof but not the raw timestamp. So we verify by checking
  // the proof can be re-derived from stored inputs + the creation timestamp.
  const isoTimestamp = proposal.createdAt.toISOString();
  const recomputedProof = buildProposalProof(
    proposal.nodeAId,
    proposal.edgeType,
    proposal.nodeBId,
    proposal.evidenceHash,
    isoTimestamp,
  );
  steps.proofMatch = recomputedProof === proposal.proposalProof;

  // 3. Semantic overlap — evidenceText must contain tokens from both node contents
  const [nodeA] = await db.select({ content: knowledgeNodes.content }).from(knowledgeNodes).where(eq(knowledgeNodes.id, proposal.nodeAId));
  const [nodeB] = await db.select({ content: knowledgeNodes.content }).from(knowledgeNodes).where(eq(knowledgeNodes.id, proposal.nodeBId));

  if (nodeA && nodeB) {
    const evidence = proposal.evidenceText.toLowerCase();
    const tokensA = nodeA.content.toLowerCase().split(/\W+/).filter(t => t.length > 3);
    const tokensB = nodeB.content.toLowerCase().split(/\W+/).filter(t => t.length > 3);
    const overlapA = tokensA.some(t => evidence.includes(t));
    const overlapB = tokensB.some(t => evidence.includes(t));
    steps.semanticOverlap = overlapA && overlapB;
  }

  // 4. Freshness — proposal must be less than 72 hours old
  const ageMs = Date.now() - new Date(proposal.createdAt).getTime();
  steps.freshnessOk = ageMs < 72 * 60 * 60 * 1000;

  const valid = steps.evidenceHashMatch && steps.proofMatch && steps.freshnessOk;

  if (valid) {
    await db
      .update(hebbianProposals)
      .set({
        validationCount: sql`validation_count + 1`,
        status: sql`CASE WHEN validation_count + 1 >= 1 THEN 'validated' ELSE status END`,
      })
      .where(eq(hebbianProposals.id, proposalId));
  } else {
    await db
      .update(hebbianProposals)
      .set({ rejectionCount: sql`rejection_count + 1`, status: "rejected" })
      .where(eq(hebbianProposals.id, proposalId));
  }

  return { valid, steps, reason: valid ? undefined : buildFailureReason(steps) };
}

function buildFailureReason(steps: ValidationResult["steps"]): string {
  if (!steps.freshnessOk) return "Proposal is older than 72 hours";
  if (!steps.evidenceHashMatch) return "Evidence hash mismatch — text was tampered";
  if (!steps.proofMatch) return "Proof mismatch — triple does not match claimed evidence";
  if (!steps.semanticOverlap) return "Evidence text does not semantically support both nodes";
  return "Validation failed";
}

// ── Application ───────────────────────────────────────────────────────────────

export async function applyValidatedProposals(): Promise<number> {
  const proposals = await db
    .select()
    .from(hebbianProposals)
    .where(and(
      eq(hebbianProposals.status, "validated"),
    ));

  let applied = 0;
  for (const p of proposals) {
    try {
      // Check if edge already exists
      const [existing] = await db
        .select()
        .from(knowledgeEdges)
        .where(and(
          eq(knowledgeEdges.fromId, p.nodeAId),
          eq(knowledgeEdges.toId, p.nodeBId),
          eq(knowledgeEdges.relationship, p.edgeType),
        ));

      if (existing) {
        // Strengthen existing edge
        const newWeight = Math.min(1.0, existing.weight + p.deltaWeight);
        await db
          .update(knowledgeEdges)
          .set({ weight: newWeight })
          .where(eq(knowledgeEdges.id, existing.id));
      } else {
        // Create new edge
        await db.insert(knowledgeEdges).values({
          fromId: p.nodeAId,
          toId: p.nodeBId,
          relationship: p.edgeType,
          weight: Math.min(1.0, p.deltaWeight),
        });
      }

      await db
        .update(hebbianProposals)
        .set({ status: "applied", appliedAt: new Date() })
        .where(eq(hebbianProposals.id, p.id));

      applied++;
    } catch (err) {
      logger.warn({ err, proposalId: p.id }, "Failed to apply Hebbian proposal");
    }
  }

  logger.info({ applied }, "Applied Hebbian proposals to knowledge graph");
  return applied;
}
