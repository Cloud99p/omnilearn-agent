/**
 * Network Service - Database-backed network management
 * Bridges ClusterManager (algorithms) with PostgreSQL (persistence)
 */

import { db } from "@workspace/db";
import {
  networkClusters,
  ghostNodes,
  networkHeartbeats,
  networkRoutingTables,
} from "@workspace/db/schema";
import { eq, sql, and, lt, gt, isNull } from "drizzle-orm";
import { ClusterManager } from "@omnilearn/network-hierarchy";
import type { GhostNode } from "@omnilearn/network-hierarchy";
import { logger } from "./logger.js";

export class NetworkService {
  private clusterManager: ClusterManager;

  constructor() {
    this.clusterManager = new ClusterManager();
  }

  /** Initialize from database (on startup) */
  async initialize(): Promise<void> {
    try {
      logger.info("Initializing network service from database...");

      // Load clusters
      const clusters = await db.select().from(networkClusters);
      clusters.forEach((c) => {
        this.clusterManager.getCluster(c.id); // Will be populated by sync
      });

      // Load nodes
      const nodes = await db.select().from(ghostNodes);
      nodes.forEach((n) => {
        const ghostNode: GhostNode = {
          id: n.id,
          name: n.name,
          endpoint: n.endpoint,
          secretKey: n.secretKey,
          region: n.region,
          location: { lat: n.locationLat, lng: n.locationLng },
          status: n.status as "online" | "offline",
          capacity: n.capacity || 100,
          load: n.load || 0,
          clusterId: n.clusterId || undefined,
          tier: n.tier || 1,
          joinedAt: n.joinedAt || new Date(),
          lastSeen: n.lastSeen || new Date(),
          metadata: n.metadata as any,
        };
        this.clusterManager.registerNode(ghostNode);
      });

      logger.info(
        {
          clusters: clusters.length,
          nodes: nodes.length,
        },
        "Network service initialized",
      );
    } catch (err) {
      logger.error({ err }, "Failed to initialize network service");
    }
  }

  /** Register a new node */
  async registerNode(
    node: GhostNode,
  ): Promise<{ success: boolean; nodeId?: string; error?: string }> {
    try {
      // Insert into database
      await db.insert(ghostNodes).values({
        id: node.id,
        name: node.name,
        endpoint: node.endpoint,
        secretKey: node.secretKey,
        region: node.region,
        locationLat: node.location.lat,
        locationLng: node.location.lng,
        tier: 1,
        status: "online",
        capacity: node.capacity || 100,
        metadata: node.metadata,
        joinedAt: new Date(),
        lastSeen: new Date(),
      });

      // Register with cluster manager
      this.clusterManager.registerNode(node);

      // Sync to database (cluster formation)
      await this.syncClusterState();

      logger.info({ nodeId: node.id }, "Node registered");
      return { success: true, nodeId: node.id };
    } catch (err) {
      logger.error({ err, nodeId: node.id }, "Failed to register node");
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  /** Sync cluster state to database */
  private async syncClusterState(): Promise<void> {
    try {
      const clusters = this.clusterManager.getAllClusters();

      for (const cluster of clusters) {
        await db
          .insert(networkClusters)
          .values({
            id: cluster.id,
            tier: cluster.tier,
            name: cluster.name,
            locationLat: cluster.location.lat,
            locationLng: cluster.location.lng,
            radiusKm: cluster.radiusKm,
            nodeIds: cluster.nodeIds,
            totalNodes: cluster.totalNodes,
            onlineNodes: cluster.onlineNodes,
            capacity: cluster.capacity,
            load: cluster.load,
            knowledgeIndex: cluster.knowledgeIndex,
            lastSync: cluster.lastSync,
            createdAt: cluster.createdAt,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: networkClusters.id,
            set: {
              tier: cluster.tier,
              name: cluster.name,
              locationLat: cluster.location.lat,
              locationLng: cluster.location.lng,
              radiusKm: cluster.radiusKm,
              nodeIds: cluster.nodeIds,
              totalNodes: cluster.totalNodes,
              onlineNodes: cluster.onlineNodes,
              capacity: cluster.capacity,
              load: cluster.load,
              knowledgeIndex: cluster.knowledgeIndex,
              lastSync: cluster.lastSync,
              updatedAt: new Date(),
            },
          });
      }

      // Update node cluster assignments
      const nodes = this.clusterManager.getAllNodes();
      for (const node of nodes) {
        await db
          .update(ghostNodes)
          .set({
            clusterId: node.clusterId || null,
            tier: node.tier,
            lastSeen: node.lastSeen,
            updatedAt: new Date(),
          })
          .where(eq(ghostNodes.id, node.id));
      }
    } catch (err) {
      logger.error({ err }, "Failed to sync cluster state");
    }
  }

  /** Record heartbeat */
  async recordHeartbeat(
    nodeId: string,
    status: string,
    load?: number,
    latencyMs?: number,
  ): Promise<void> {
    try {
      await db.insert(networkHeartbeats).values({
        nodeId,
        timestamp: new Date(),
        status,
        load: load || null,
        latencyMs: latencyMs || null,
      });

      // Update node lastSeen
      await db
        .update(ghostNodes)
        .set({
          lastSeen: new Date(),
          status,
          load: load || null,
        })
        .where(eq(ghostNodes.id, nodeId));
    } catch (err) {
      logger.error({ err, nodeId }, "Failed to record heartbeat");
    }
  }

  /** Get all clusters */
  async getClusters() {
    return this.clusterManager.getAllClusters();
  }

  /** Get hierarchy stats */
  async getHierarchyStats() {
    return this.clusterManager.getHierarchyStats();
  }

  /** Get node by ID */
  async getNode(nodeId: string) {
    return this.clusterManager.getNode(nodeId);
  }

  /** Get all nodes */
  async getNodes() {
    return this.clusterManager.getAllNodes();
  }
}
