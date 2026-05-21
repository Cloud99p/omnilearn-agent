/**
 * Knowledge Sync Routes
 * GET  /api/sync/log      - Get sync history
 * GET  /api/sync/stats    - Get sync statistics
 * GET  /api/sync/proposals - Get pending proposals
 * POST /api/sync/vote     - Vote on a proposal
 */

import { Router } from "express";
import {
  getNodeSyncHistory,
  getSyncStats,
  getPendingProposals,
  voteOnProposal,
  getProposalStats,
} from "../lib/knowledge-sync.js";
import { logger } from "../lib/logger.js";

const router = Router();

// GET /api/sync/log/:nodeId - Get sync history for a node
router.get("/log/:nodeId", async (req, res) => {
  const { nodeId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;

  try {
    const logs = await getNodeSyncHistory(nodeId, limit);
    res.json({ logs, count: logs.length });
  } catch (err) {
    logger.error({ err, nodeId }, "Failed to get sync history");
    res.status(500).json({ error: "Failed to get sync history" });
  }
});

// GET /api/sync/stats/:nodeId - Get sync statistics
router.get("/stats/:nodeId", async (req, res) => {
  const { nodeId } = req.params;

  try {
    const stats = await getSyncStats(nodeId);
    res.json(stats);
  } catch (err) {
    logger.error({ err, nodeId }, "Failed to get sync stats");
    res.status(500).json({ error: "Failed to get sync stats" });
  }
});

// GET /api/sync/proposals/:clusterId - Get pending proposals for cluster
router.get("/proposals/:clusterId", async (req, res) => {
  const { clusterId } = req.params;

  try {
    const proposals = await getPendingProposals(clusterId);
    const proposalStats = await getProposalStats(clusterId);
    res.json({
      proposals,
      stats: proposalStats,
      count: proposals.length,
    });
  } catch (err) {
    logger.error({ err, clusterId }, "Failed to get pending proposals");
    res.status(500).json({ error: "Failed to get pending proposals" });
  }
});

// POST /api/sync/vote - Vote on a knowledge proposal
router.post("/vote", async (req, res) => {
  const { proposalId, voterNodeId, voteFor } = req.body as {
    proposalId: number;
    voterNodeId: string;
    voteFor: boolean;
  };

  if (!proposalId || !voterNodeId || voteFor === undefined) {
    res.status(400).json({ error: "proposalId, voterNodeId, and voteFor are required" });
    return;
  }

  try {
    await voteOnProposal(proposalId, voterNodeId, voteFor);
    res.json({ success: true, proposalId, vote: voteFor ? 'for' : 'against' });
  } catch (err) {
    logger.error({ err, proposalId, voterNodeId }, "Failed to cast vote");
    res.status(500).json({ error: "Failed to cast vote" });
  }
});

export default router;
