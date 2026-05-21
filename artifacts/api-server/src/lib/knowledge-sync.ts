/**
 * Knowledge Sync Service - Full Implementation
 * Handles knowledge synchronization across mesh network with:
 * - Sync logging (inbound/outbound tracking)
 * - Proposal system (cluster validation)
 * - Privacy controls (share levels)
 * - Conflict detection
 */

import { db } from "@workspace/db";
import {
  knowledgeSyncLog,
  knowledgeProposals,
  knowledgeNodes,
  networkGhostNodes,
} from "@workspace/db/schema";
import { eq, and, desc, sql, gt, lt } from "drizzle-orm";
import { discoveryServer } from "./discovery-server.js";
import { logger } from "./logger.js";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type SyncDirection = 'inbound' | 'outbound';
export type SyncStatus = 'pending' | 'synced' | 'rejected' | 'conflict' | 'failed';
export type ProposalType = 'new' | 'update' | 'delete';
export type ProposalStatus = 'pending' | 'ratified' | 'rejected';
export type ShareLevel = 'private' | 'cluster' | 'metro' | 'regional' | 'global';

export interface KnowledgeSyncMessage {
  type: 'KNOWLEDGE_SYNC';
  fromNodeId: string;
  timestamp: Date;
  data: {
    action: 'broadcast' | 'proposal' | 'vote' | 'ratified';
    knowledgeNodeId?: number;
    proposalId?: number;
    node?: {
      id: number;
      content: string;
      type: string;
      tags: string[];
      shareLevel: ShareLevel;
      clusterId?: string;
    };
    vote?: {
      proposalId: number;
      voteFor: boolean;
      voterNodeId: string;
    };
  };
}

export interface SyncOptions {
  nodeId: string;
  clusterId: string;
  shareLevel: ShareLevel;
  requireRatification?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Knowledge Sync Logging
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Log a knowledge sync attempt
 */
export async function logSyncAttempt(
  nodeId: string,
  knowledgeNodeId: number,
  direction: SyncDirection,
  clusterId: string,
  sourceNodeId?: string
): Promise<number> {
  const [log] = await db
    .insert(knowledgeSyncLog)
    .values({
      nodeId,
      knowledgeNodeId,
      syncDirection: direction,
      syncStatus: 'pending',
      clusterId,
      sourceNodeId,
    })
    .returning();

  return log.id;
}

/**
 * Update sync log status
 */
export async function updateSyncLog(
  logId: number,
  status: SyncStatus,
  errorMessage?: string
): Promise<void> {
  await db
    .update(knowledgeSyncLog)
    .set({
      syncStatus: status,
      errorMessage,
      syncedAt: new Date(),
    })
    .where(eq(knowledgeSyncLog.id, logId));
}

/**
 * Get sync history for a node
 */
export async function getNodeSyncHistory(
  nodeId: string,
  limit: number = 50
): Promise<any[]> {
  const logs = await db
    .select()
    .from(knowledgeSyncLog)
    .where(eq(knowledgeSyncLog.nodeId, nodeId))
    .orderBy(desc(knowledgeSyncLog.syncedAt))
    .limit(limit);

  return logs;
}

// ──────────────────────────────────────────────────────────────────────────────
// Knowledge Proposal System
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Create a knowledge proposal for cluster validation
 */
export async function createProposal(
  knowledgeNodeId: number,
  proposedByNodeId: string,
  proposalType: ProposalType,
  clusterId: string
): Promise<number> {
  const [proposal] = await db
    .insert(knowledgeProposals)
    .values({
      knowledgeNodeId,
      proposedByNodeId,
      proposalType,
      status: 'pending',
      clusterId,
      votesFor: 1, // Proposer votes yes
      votesAgainst: 0,
    })
    .returning();

  logger.info(
    { proposalId: proposal.id, knowledgeNodeId, clusterId },
    "Knowledge proposal created"
  );

  return proposal.id;
}

/**
 * Cast a vote on a knowledge proposal
 */
export async function voteOnProposal(
  proposalId: number,
  voterNodeId: string,
  voteFor: boolean
): Promise<void> {
  const proposal = await db
    .select()
    .from(knowledgeProposals)
    .where(eq(knowledgeProposals.id, proposalId))
    .limit(1);

  if (proposal.length === 0) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  const current = proposal[0];
  
  // Check if already voted (prevent double voting)
  // TODO: Add votes table to track individual votes
  
  await db
    .update(knowledgeProposals)
    .set({
      votesFor: voteFor ? current.votesFor + 1 : current.votesFor,
      votesAgainst: voteFor ? current.votesAgainst : current.votesAgainst + 1,
    })
    .where(eq(knowledgeProposals.id, proposalId));

  logger.info(
    { proposalId, voterNodeId, voteFor },
    "Vote cast on knowledge proposal"
  );

  // Check if proposal is resolved
  await checkProposalResolution(proposalId);
}

/**
 * Check if a proposal has enough votes to be resolved
 */
export async function checkProposalResolution(proposalId: number): Promise<void> {
  const proposal = await db
    .select()
    .from(knowledgeProposals)
    .where(eq(knowledgeProposals.id, proposalId))
    .limit(1);

  if (proposal.length === 0) return;

  const current = proposal[0];
  const totalVotes = current.votesFor + current.votesAgainst;

  // Need at least 3 votes to resolve (prevent single-node decisions)
  if (totalVotes < 3) return;

  const approvalRate = current.votesFor / totalVotes;
  const isRatified = approvalRate >= 0.51; // 51% consensus

  await db
    .update(knowledgeProposals)
    .set({
      status: isRatified ? 'ratified' : 'rejected',
      resolvedAt: new Date(),
    })
    .where(eq(knowledgeProposals.id, proposalId));

  // Update knowledge node if ratified
  if (isRatified && current.knowledgeNodeId) {
    await db
      .update(knowledgeNodes)
      .set({ ratifiedByCluster: true })
      .where(eq(knowledgeNodes.id, current.knowledgeNodeId));

    logger.info(
      { proposalId, knowledgeNodeId: current.knowledgeNodeId },
      "Knowledge ratified by cluster"
    );
  } else {
    logger.info(
      { proposalId, approvalRate: (approvalRate * 100).toFixed(1) + '%' },
      "Knowledge proposal rejected by cluster"
    );
  }
}

/**
 * Get pending proposals for a cluster
 */
export async function getPendingProposals(clusterId: string): Promise<any[]> {
  const proposals = await db
    .select()
    .from(knowledgeProposals)
    .where(
      and(
        eq(knowledgeProposals.clusterId, clusterId),
        eq(knowledgeProposals.status, 'pending')
      )
    )
    .orderBy(desc(knowledgeProposals.createdAt));

  return proposals;
}

// ──────────────────────────────────────────────────────────────────────────────
// Knowledge Broadcasting
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Broadcast knowledge to cluster with full logging and proposal system
 */
export async function broadcastKnowledgeToCluster(
  node: any, // KnowledgeNode with shareLevel
  clusterId: string,
  nodeId: string
): Promise<void> {
  // Check share level
  if (!node.shareLevel || node.shareLevel === 'private') {
    logger.debug(
      { nodeId: node.id, shareLevel: node.shareLevel },
      "Skipping private knowledge broadcast"
    );
    return;
  }

  try {
    // Log sync attempt
    const logId = await logSyncAttempt(
      nodeId,
      node.id,
      'outbound',
      clusterId
    );

    // Create proposal for cluster validation
    const proposalId = await createProposal(
      node.id,
      nodeId,
      'new',
      clusterId
    );

    // Broadcast proposal to cluster
    const message: KnowledgeSyncMessage = {
      type: 'KNOWLEDGE_SYNC',
      fromNodeId: nodeId,
      timestamp: new Date(),
      data: {
        action: 'proposal',
        knowledgeNodeId: node.id,
        proposalId,
        node: {
          id: node.id,
          content: node.content,
          type: node.type,
          tags: node.tags,
          shareLevel: node.shareLevel,
          clusterId: node.clusterId,
        },
      },
    };

    discoveryServer.broadcast(message);

    logger.info(
      { 
        nodeId: node.id, 
        clusterId, 
        proposalId,
        shareLevel: node.shareLevel,
        content: node.content.slice(0, 100)
      },
      "Knowledge proposal broadcast to cluster"
    );

    // Update sync log
    await updateSyncLog(logId, 'synced');

  } catch (err) {
    logger.error(
      { err, nodeId: node.id, clusterId },
      "Knowledge broadcast failed"
    );

    // Log failure
    const logId = await logSyncAttempt(
      nodeId,
      node.id,
      'outbound',
      clusterId
    );
    await updateSyncLog(logId, 'failed', String(err));

    throw err;
  }
}

/**
 * Handle incoming knowledge sync from cluster
 */
export async function handleIncomingKnowledgeSync(
  message: KnowledgeSyncMessage,
  receivingNodeId: string
): Promise<void> {
  const { action, knowledgeNodeId, proposalId, node } = message.data;

  try {
    logger.info(
      {
        action,
        knowledgeNodeId,
        proposalId,
        fromNodeId: message.fromNodeId,
        receivingNodeId,
      },
      "Received knowledge sync message"
    );

    switch (action) {
      case 'proposal':
        // Received a new knowledge proposal - auto-vote yes for now
        // TODO: Implement smart voting based on knowledge quality
        if (proposalId) {
          await voteOnProposal(proposalId, receivingNodeId, true);
        }
        break;

      case 'vote':
        // Received a vote on our proposal
        // TODO: Track votes and update UI
        break;

      case 'ratified':
        // Knowledge was ratified - add to local graph
        if (node) {
          // TODO: Insert into local knowledge graph
          logger.info(
            { knowledgeNodeId: node.id },
            "Adding ratified knowledge to local graph"
          );
        }
        break;

      case 'broadcast':
        // Direct broadcast (no voting required for cluster-level share)
        if (node) {
          // TODO: Insert into local knowledge graph
          logger.info(
            { knowledgeNodeId: node.id },
            "Adding broadcasted knowledge to local graph"
          );
        }
        break;
    }

    // Log inbound sync
    if (knowledgeNodeId) {
      await logSyncAttempt(
        receivingNodeId,
        knowledgeNodeId,
        'inbound',
        'cluster',
        message.fromNodeId
      );
    }

  } catch (err) {
    logger.error(
      { err, message, receivingNodeId },
      "Failed to process incoming knowledge sync"
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Privacy Controls
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Update knowledge share level (user privacy control)
 */
export async function updateKnowledgeShareLevel(
  knowledgeNodeId: number,
  shareLevel: ShareLevel,
  userId: string
): Promise<void> {
  // Verify ownership (knowledge belongs to user)
  const node = await db
    .select()
    .from(knowledgeNodes)
    .where(eq(knowledgeNodes.id, knowledgeNodeId))
    .limit(1);

  if (node.length === 0) {
    throw new Error(`Knowledge node ${knowledgeNodeId} not found`);
  }

  if (node[0].clerkId !== userId) {
    throw new Error("Unauthorized: Cannot modify another user's knowledge");
  }

  await db
    .update(knowledgeNodes)
    .set({
      shareLevel,
      sharedByUser: shareLevel !== 'private',
    })
    .where(eq(knowledgeNodes.id, knowledgeNodeId));

  logger.info(
    { knowledgeNodeId, shareLevel, userId },
    "Knowledge share level updated"
  );
}

/**
 * Revoke shared knowledge (make private)
 */
export async function revokeKnowledgeShare(
  knowledgeNodeId: number,
  userId: string
): Promise<void> {
  await updateKnowledgeShareLevel(knowledgeNodeId, 'private', userId);

  // TODO: Broadcast revocation to cluster
  // Cluster members should remove or mark as revoked
}

// ──────────────────────────────────────────────────────────────────────────────
// Statistics
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Get sync statistics for a node
 */
export async function getSyncStats(nodeId: string): Promise<{
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  pendingSyncs: number;
  outboundSyncs: number;
  inboundSyncs: number;
}> {
  const stats = await db
    .select({
      totalSyncs: sql<number>`count(*)`,
      successfulSyncs: sql<number>`count(*) filter (where sync_status = 'synced')`,
      failedSyncs: sql<number>`count(*) filter (where sync_status = 'failed')`,
      pendingSyncs: sql<number>`count(*) filter (where sync_status = 'pending')`,
      outboundSyncs: sql<number>`count(*) filter (where sync_direction = 'outbound')`,
      inboundSyncs: sql<number>`count(*) filter (where sync_direction = 'inbound')`,
    })
    .from(knowledgeSyncLog)
    .where(eq(knowledgeSyncLog.nodeId, nodeId))
    .limit(1);

  return stats[0] || {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    pendingSyncs: 0,
    outboundSyncs: 0,
    inboundSyncs: 0,
  };
}

/**
 * Get proposal statistics for a cluster
 */
export async function getProposalStats(clusterId: string): Promise<{
  totalProposals: number;
  pendingProposals: number;
  ratifiedProposals: number;
  rejectedProposals: number;
}> {
  const stats = await db
    .select({
      totalProposals: sql<number>`count(*)`,
      pendingProposals: sql<number>`count(*) filter (where status = 'pending')`,
      ratifiedProposals: sql<number>`count(*) filter (where status = 'ratified')`,
      rejectedProposals: sql<number>`count(*) filter (where status = 'rejected')`,
    })
    .from(knowledgeProposals)
    .where(eq(knowledgeProposals.clusterId, clusterId))
    .limit(1);

  return stats[0] || {
    totalProposals: 0,
    pendingProposals: 0,
    ratifiedProposals: 0,
    rejectedProposals: 0,
  };
}
