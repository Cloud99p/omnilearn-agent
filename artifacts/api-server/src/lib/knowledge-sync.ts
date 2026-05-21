/**
 * Knowledge Sync - Simple cluster broadcasting
 * Broadcasts shareable knowledge to cluster via WebSocket
 */

import { discoveryServer } from "./discovery-server.js";
import type { KnowledgeNode } from "@workspace/db/schema";
import { logger } from "./logger.js";

export interface KnowledgeBroadcastMessage {
  type: 'KNOWLEDGE_UPDATE';
  fromNodeId: string;
  timestamp: Date;
  data: {
    node: KnowledgeNode;
    clusterId: string;
  };
}

/**
 * Broadcast knowledge node to cluster
 * Only broadcasts if share_level is not 'private'
 */
export async function broadcastKnowledgeToCluster(
  node: KnowledgeNode & { shareLevel?: string },
  clusterId: string,
  fromNodeId: string
): Promise<void> {
  // Don't broadcast private knowledge
  if (!node.shareLevel || node.shareLevel === 'private') {
    logger.debug(
      { nodeId: node.id, shareLevel: node.shareLevel },
      "Skipping private knowledge broadcast"
    );
    return;
  }

  try {
    const message: KnowledgeBroadcastMessage = {
      type: 'KNOWLEDGE_UPDATE',
      fromNodeId,
      timestamp: new Date(),
      data: {
        node: {
          id: node.id,
          content: node.content,
          type: node.type,
          tags: node.tags,
          clusterId: node.clusterId,
          shareLevel: node.shareLevel,
        },
        clusterId,
      },
    };

    // Broadcast to all nodes via WebSocket discovery server
    discoveryServer.broadcast(message);

    logger.info(
      { 
        nodeId: node.id, 
        clusterId, 
        shareLevel: node.shareLevel,
        content: node.content.slice(0, 100)
      },
      "Knowledge broadcast to cluster"
    );
  } catch (err) {
    logger.error(
      { err, nodeId: node.id, clusterId },
      "Knowledge broadcast failed"
    );
    throw err;
  }
}

/**
 * Handle incoming knowledge update from cluster
 * Called when receiving KNOWLEDGE_UPDATE message
 */
export async function handleIncomingKnowledge(
  message: KnowledgeBroadcastMessage,
  receivingNodeId: string
): Promise<void> {
  const { node, clusterId, timestamp } = message.payload;

  try {
    // TODO: Add to local knowledge graph
    // For now, just log it
    logger.info(
      {
        nodeId: node.id,
        clusterId,
        receivingNodeId,
        timestamp,
        content: node.content.slice(0, 100),
      },
      "Received knowledge from cluster"
    );

    // Future: Insert into local knowledge graph
    // await db.insert(knowledgeNodes).values({
    //   ...node,
    //   receivedFrom: message.payload.nodeId,
    //   receivedAt: new Date(timestamp),
    // });
  } catch (err) {
    logger.error(
      { err, nodeId: node.id, receivingNodeId },
      "Failed to process incoming knowledge"
    );
  }
}
