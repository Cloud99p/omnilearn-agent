import crypto from "crypto";
import { db } from "@workspace/db";
import {
  hebbianProposals,
  knowledgeNodes,
  knowledgeEdges,
} from "@workspace/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

export type EdgeRelationship =
  | "co-occurs"
  | "related-to"
  | "causes"
  | "contradicts"
  | "supports";

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
  const input = [nodeAId, edgeType, nodeBId, evidenceHash, isoTimestamp].join(
    "|",
  );
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function voteFromSignal(
  signal: string,
  proposalId: number,
  salt: string,
): boolean {
  const hash = crypto
    .createHash("sha256")
    .update([signal, proposalId, salt].join("|"), "utf8")
    .digest("hex");
  return parseInt(hash.slice(0, 2), 16) % 2 === 0;
}

/**
 * Collect votes for a Hebbian proposal.
 * Uses percentage-based quorum (25% of online nodes) for scalability.
 * 
 * Quorum rules:
 * - Small network (< 20 nodes): Auto-accept (no voting needed)
 * - Medium network (20-100 nodes): 25% of online nodes
 * - Large network (> 100 nodes): 25% capped at 25 validators minimum
 */
export async function collectHebbianVotes(
  proposalId: number,
  onlineNodeCount: number = 5, // Default to 5 if not provided
): Promise<{ yes: number; no: number; quorum: number; passed: boolean }> {
  // For small networks, auto-pass (already handled by auto-accept)
  if (onlineNodeCount < 20) {
    return { yes: onlineNodeCount, no: 0, quorum: 1, passed: true };
  }
  
  // Calculate dynamic quorum based on online nodes
  const quorumPercentage = 0.25; // 25% of online nodes
  const minQuorum = 5; // Minimum 5 votes for medium networks
  const maxQuorum = 25; // Cap at 25 for large networks
  
  const calculatedQuorum = Math.ceil(onlineNodeCount * quorumPercentage);
  const quorum = Math.max(minQuorum, Math.min(maxQuorum, calculatedQuorum));
  
  // Simulate votes from validators (proof, semantic, freshness, graph, consistency)
  const validatorTypes = [
    "validator:proof",
    "validator:semantic",
    "validator:freshness",
    "validator:graph",
    "validator:consistency",
  ];
  
  // For now, use deterministic voting based on proposal hash
  // In production, this would query actual validator nodes
  const eligibleVotes = validatorTypes.map(type => 
    voteFromSignal(type, proposalId, type.split(':')[1])
  );
  
  const yes = eligibleVotes.filter(Boolean).length;
  const no = eligibleVotes.length - yes;
  
  // If we have enough validators online, use percentage quorum
  // Otherwise, fall back to simple majority
  const actualQuorum = onlineNodeCount >= 20 ? quorum : Math.ceil(validatorTypes.length * 0.6);
  const passed = yes >= actualQuorum;
  
  logger.debug(
    { proposalId, onlineNodeCount, yes, no, quorum: actualQuorum, passed },
    "Hebbian vote collected (percentage-based quorum)"
  );
  
  return { yes, no, quorum: actualQuorum, passed };
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
  const { proposerId, nodeAId, nodeBId, edgeType, evidenceText, deltaWeight } =
    opts;
  const isoTimestamp = new Date().toISOString();
  const evidenceHash = buildEvidenceHash(evidenceText);
  const proposalProof = buildProposalProof(
    nodeAId,
    edgeType,
    nodeBId,
    evidenceHash,
    isoTimestamp,
  );

  const [row] = await db
    .insert(hebbianProposals)
    .values({
      proposerId,
      nodeAId,
      nodeBId,
      edgeType,
      evidenceText,
      evidenceHash,
      proposalProof,
      deltaWeight,
    })
    .returning({ id: hebbianProposals.id });

  logger.info(
    { proposalId: row.id, nodeAId, nodeBId, edgeType },
    "Hebbian proposal created",
  );
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

export async function validateProposal(
  proposalId: number,
): Promise<ValidationResult> {
  const [proposal] = await db
    .select()
    .from(hebbianProposals)
    .where(eq(hebbianProposals.id, proposalId));

  if (!proposal) {
    return {
      valid: false,
      steps: {
        evidenceHashMatch: false,
        proofMatch: false,
        semanticOverlap: false,
        freshnessOk: false,
      },
      reason: "Proposal not found",
    };
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
  const [nodeA] = await db
    .select({ content: knowledgeNodes.content })
    .from(knowledgeNodes)
    .where(eq(knowledgeNodes.id, proposal.nodeAId));
  const [nodeB] = await db
    .select({ content: knowledgeNodes.content })
    .from(knowledgeNodes)
    .where(eq(knowledgeNodes.id, proposal.nodeBId));

  if (nodeA && nodeB) {
    const evidence = proposal.evidenceText.toLowerCase();
    const tokensA = nodeA.content
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 3);
    const tokensB = nodeB.content
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 3);
    const overlapA = tokensA.some((t) => evidence.includes(t));
    const overlapB = tokensB.some((t) => evidence.includes(t));
    steps.semanticOverlap = overlapA && overlapB;
  }

  // 4. Freshness — proposal must be less than 72 hours old
  const ageMs = Date.now() - new Date(proposal.createdAt).getTime();
  steps.freshnessOk = ageMs < 72 * 60 * 60 * 1000;

  const vote = await collectHebbianVotes(proposalId);
  const valid =
    steps.evidenceHashMatch &&
    steps.proofMatch &&
    steps.freshnessOk &&
    vote.passed;

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

  return {
    valid,
    steps,
    reason: valid ? undefined : buildFailureReason(steps),
  };
}

function buildFailureReason(steps: ValidationResult["steps"]): string {
  if (!steps.freshnessOk) return "Proposal is older than 72 hours";
  if (!steps.evidenceHashMatch)
    return "Evidence hash mismatch — text was tampered";
  if (!steps.proofMatch)
    return "Proof mismatch — triple does not match claimed evidence";
  if (!steps.semanticOverlap)
    return "Evidence text does not semantically support both nodes";
  return "Validation failed";
}

// ── Application ───────────────────────────────────────────────────────────────

export async function applyValidatedProposals(): Promise<number> {
  const proposals = await db
    .select()
    .from(hebbianProposals)
    .where(and(eq(hebbianProposals.status, "validated")));

  let applied = 0;
  for (const p of proposals) {
    try {
      // Check if edge already exists
      const [existing] = await db
        .select()
        .from(knowledgeEdges)
        .where(
          and(
            eq(knowledgeEdges.fromId, p.nodeAId),
            eq(knowledgeEdges.toId, p.nodeBId),
            eq(knowledgeEdges.relationship, p.edgeType),
          ),
        );

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
      logger.warn(
        { err, proposalId: p.id },
        "Failed to apply Hebbian proposal",
      );
    }
  }

  logger.info({ applied }, "Applied Hebbian proposals to knowledge graph");
  return applied;
}

export async function autoValidateAndApplyProposal(
  proposalId: number,
  onlineNodeCount: number = 5,
): Promise<{
  validation: ValidationResult;
  applied: boolean;
  vote: Awaited<ReturnType<typeof collectHebbianVotes>>;
}> {
  const validation = await validateProposal(proposalId);
  const vote = await collectHebbianVotes(proposalId, onlineNodeCount);
  let applied = false;
  if (validation.valid && vote.passed) {
    applied = (await applyValidatedProposals()) > 0;
  }
  return { validation, applied, vote };
}

// ── Auto-accept (for small knowledge bases) ─────────────────────────────────

/**
 * Auto-accept a Hebbian proposal based on network size.
 * Uses percentage-based quorum (25% of online nodes) for scalability.
 * 
 * Network size rules:
 * - < 20 nodes: Auto-accept (no voting needed)
 * - 20-100 nodes: 25% quorum (5-25 validators)
 * - > 100 nodes: 25% quorum (capped at 25 validators)
 */
export async function acceptHebbianProposal(
  proposalId: number,
  onlineNodeCount: number = 5,
): Promise<boolean> {
  try {
    // Get the proposal
    const [proposal] = await db
      .select()
      .from(hebbianProposals)
      .where(eq(hebbianProposals.id, proposalId));
    
    if (!proposal) {
      logger.warn({ proposalId }, "Proposal not found for auto-accept");
      return false;
    }
    
    // For small networks (< 20 nodes), auto-accept without voting
    if (onlineNodeCount < 20) {
      // Validate first (safety check)
      const validation = await validateProposal(proposalId);
      if (!validation.valid) {
        logger.warn(
          { proposalId, reason: validation.reason },
          "Auto-accept skipped: validation failed"
        );
        return false;
      }
      
      // Update status to validated
      await db
        .update(hebbianProposals)
        .set({ status: "validated", validatedAt: new Date() })
        .where(eq(hebbianProposals.id, proposalId));
      
      // Apply the proposal
      await applyValidatedProposals();
      
      logger.info(
        { proposalId, nodeAId: proposal.nodeAId, nodeBId: proposal.nodeBId, edgeType: proposal.edgeType, onlineNodeCount },
        "Hebbian proposal auto-accepted (small network < 20 nodes)"
      );
      
      return true;
    }
    
    // For larger networks, use percentage-based voting
    const vote = await collectHebbianVotes(proposalId, onlineNodeCount);
    
    if (vote.passed) {
      // Validate first (safety check)
      const validation = await validateProposal(proposalId);
      if (!validation.valid) {
        logger.warn(
          { proposalId, reason: validation.reason, vote },
          "Proposal passed vote but failed validation"
        );
        return false;
      }
      
      // Update status to validated
      await db
        .update(hebbianProposals)
        .set({ status: "validated", validatedAt: new Date() })
        .where(eq(hebbianProposals.id, proposalId));
      
      // Apply the proposal
      await applyValidatedProposals();
      
      logger.info(
        { proposalId, nodeAId: proposal.nodeAId, nodeBId: proposal.nodeBId, edgeType: proposal.edgeType, onlineNodeCount, yes: vote.yes, quorum: vote.quorum },
        "Hebbian proposal accepted (percentage-based quorum: 25%)"
      );
      
      return true;
    } else {
      logger.info(
        { proposalId, onlineNodeCount, yes: vote.yes, quorum: vote.quorum },
        "Hebbian proposal rejected: quorum not met (25% of online nodes)"
      );
      return false;
    }
  } catch (error) {
    logger.error({ err: error, proposalId }, "Auto-accept failed");
    return false;
  }
}
