/**
 * Cluster Manager - Production Ready
 * Handles cluster formation, fusion, and persistence
 * 
 * Changes from in-memory version:
 * - Uses PostgreSQL for persistent cluster state
 * - Survives server restarts
 * - Real database-backed cluster formation
 */

import { db } from "@workspace/db";
import { networkClusters, networkGhostNodes, networkRoutingTables } from "@workspace/db/schema";
import { eq, sql, and, gt, lt, isNull } from "drizzle-orm";
import { Cluster, FusionProposal, GhostNode, NetworkTier, calculateTier } from "./types.js";
import { logger } from "../../lib/logger.js";

export class ClusterManager {
  private discoveryRadiusKm: number = 50;

  /** Register a new node and attempt clustering */
  async registerNode(node: GhostNode): Promise<void> {
    try {
      // Insert node into database
      await db.insert(networkGhostNodes).values({
        id: node.id,
        name: node.name,
        endpoint: node.endpoint,
        secretKey: node.secretKey,
        region: node.region,
        locationLat: node.location.lat,
        locationLng: node.location.lng,
        tier: 1, // Start as individual node
        status: "online",
        capacity: node.capacity || 100,
        metadata: {
          version: "0.1.0",
          synthesizer: "local",
          languages: ["en"],
        },
        joinedAt: new Date(),
        lastSeen: new Date(),
      });

      logger.info({ nodeId: node.id, region: node.region }, "Node registered");

      // Attempt to cluster with nearby nodes
      await this.attemptClusterFormation(node);
    } catch (err) {
      logger.error({ err, nodeId: node.id }, "Failed to register node");
      throw err;
    }
  }

  /** Attempt to form a cluster with nearby nodes */
  private async attemptClusterFormation(node: GhostNode): Promise<void> {
    try {
      // Find nearby unclustered nodes using Haversine distance
      const nearbyNodes = await this.findNearbyNodes(node, this.discoveryRadiusKm);

      if (nearbyNodes.length >= 49) {
        // 49 + this node = 50 → Tier 2 cluster
        const clusterId = await this.createCluster(
          [...nearbyNodes, node],
          this.discoveryRadiusKm,
        );

        logger.info(
          { clusterId, nodeCount: nearbyNodes.length + 1 },
          "Cluster formed",
        );
      } else {
        // Not enough nodes for cluster yet
        logger.debug(
          { nodeId: node.id, nearbyCount: nearbyNodes.length, threshold: 49 },
          "Not enough nearby nodes for cluster formation",
        );
      }
    } catch (err) {
      logger.error({ err, nodeId: node.id }, "Cluster formation failed");
    }
  }

  /** Find unclustered nodes within radius using Haversine formula */
  private async findNearbyNodes(
    node: GhostNode,
    radiusKm: number,
  ): Promise<GhostNode[]> {
    try {
      // Query nodes within radius using database
      // Haversine formula in SQL
      const radiusDegrees = radiusKm / 111; // Approximate km per degree

      const nearbyNodes = await db
        .select()
        .from(networkGhostNodes)
        .where(
          and(
            // Different node
            lt(networkGhostNodes.id, node.id),
            // Not already in cluster
            isNull(networkGhostNodes.clusterId),
            // Online status
            eq(networkGhostNodes.status, "online"),
            // Within latitude range
            gt(
              networkGhostNodes.locationLat,
              node.location.lat - radiusDegrees,
            ),
            lt(
              networkGhostNodes.locationLat,
              node.location.lat + radiusDegrees,
            ),
            // Within longitude range
            gt(
              networkGhostNodes.locationLng,
              node.location.lng - radiusDegrees,
            ),
            lt(
              networkGhostNodes.locationLng,
              node.location.lng + radiusDegrees,
            ),
          ),
        )
        .limit(100);

      // Filter by exact Haversine distance in JS
      const filtered = nearbyNodes.filter((n) => {
        const distance = this.haversineDistance(
          { lat: n.locationLat, lng: n.locationLng },
          node.location,
        );
        return distance <= radiusKm;
      });

      // Convert to GhostNode format
      return filtered.map((n) => ({
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
      }));
    } catch (err) {
      logger.error({ err }, "Failed to find nearby nodes");
      return [];
    }
  }

  /** Calculate Haversine distance between two points */
  private haversineDistance(
    coords1: { lat: number; lng: number },
    coords2: { lat: number; lng: number },
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((coords2.lat - coords1.lat) * Math.PI) / 180;
    const dLng = ((coords2.lng - coords1.lng) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((coords1.lat * Math.PI) / 180) *
        Math.cos((coords2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /** Create a new cluster */
  private async createCluster(
    nodes: GhostNode[],
    radiusKm: number,
  ): Promise<string> {
    const clusterId = `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate center location
    const centerLat =
      nodes.reduce((sum, n) => sum + n.location.lat, 0) / nodes.length;
    const centerLng =
      nodes.reduce((sum, n) => sum + n.location.lng, 0) / nodes.length;

    // Determine tier
    const tier = calculateTier(nodes.length, radiusKm);

    // Insert cluster into database
    await db.insert(networkClusters).values({
      id: clusterId,
      tier,
      name: this.generateClusterName(tier, centerLat, centerLng),
      locationLat: centerLat,
      locationLng: centerLng,
      radiusKm,
      nodeIds: nodes.map((n) => n.id),
      totalNodes: nodes.length,
      onlineNodes: nodes.filter((n) => n.status === "online").length,
      capacity: nodes.reduce((sum, n) => sum + (n.capacity || 100), 0),
      load: 0,
      knowledgeIndex: [],
      lastSync: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update nodes with cluster assignment
    await db
      .update(networkGhostNodes)
      .set({
        clusterId,
        tier,
        updatedAt: new Date(),
      })
      .where(
        eq(networkGhostNodes.id, sql`${nodes.map((n) => n.id).join("','")}`),
      );

    // Initialize routing table for cluster
    await db.insert(networkRoutingTables).values({
      clusterId,
      routes: {
        local: nodes.map((n) => n.id),
        regional: [],
        continental: [],
        global: [],
      },
      latencyMap: {},
      lastUpdated: new Date(),
    });

    logger.info(
      {
        clusterId,
        tier,
        nodeCount: nodes.length,
        location: { lat: centerLat, lng: centerLng },
      },
      "Cluster created",
    );

    return clusterId;
  }

  /** Generate cluster name based on location and tier */
  private generateClusterName(
    tier: NetworkTier,
    lat: number,
    lng: number,
  ): string {
    const tierNames = [
      "Individual",
      "Local Cluster",
      "Metro Network",
      "Regional Network",
      "Continental Backbone",
      "Global Mesh",
      "Planetary Intelligence",
    ];

    // Simple reverse geocoding (in production, use actual geocoding service)
    let region = "Unknown";
    if (lat > 0) {
      region = lng < 0 ? "Americas" : lng < 60 ? "Africa/Europe" : "Asia/Pacific";
    } else {
      region = lng < 0 ? "South Americas" : lng < 60 ? "Africa" : "Oceania";
    }

    return `${tierNames[tier]} ${region} ${Date.now()}`;
  }

  /** Get cluster by ID */
  async getCluster(clusterId: string): Promise<Cluster | null> {
    try {
      const [cluster] = await db
        .select()
        .from(networkClusters)
        .where(eq(networkClusters.id, clusterId))
        .limit(1);

      if (!cluster) return null;

      return {
        id: cluster.id,
        tier: cluster.tier,
        name: cluster.name,
        location: { lat: cluster.locationLat, lng: cluster.locationLng },
        radiusKm: cluster.radiusKm,
        parentId: cluster.parentId || undefined,
        childIds: cluster.childIds || [],
        nodeIds: cluster.nodeIds || [],
        totalNodes: cluster.totalNodes || 0,
        onlineNodes: cluster.onlineNodes || 0,
        capacity: cluster.capacity || 0,
        load: cluster.load || 0,
        knowledgeIndex: cluster.knowledgeIndex as any[],
        lastSync: cluster.lastSync || new Date(),
        createdAt: cluster.createdAt || new Date(),
        updatedAt: cluster.updatedAt || new Date(),
      };
    } catch (err) {
      logger.error({ err, clusterId }, "Failed to get cluster");
      return null;
    }
  }

  /** Get all clusters */
  async getAllClusters(): Promise<Cluster[]> {
    try {
      const clusters = await db.select().from(networkClusters);

      return clusters.map((c) => ({
        id: c.id,
        tier: c.tier,
        name: c.name,
        location: { lat: c.locationLat, lng: c.locationLng },
        radiusKm: c.radiusKm,
        parentId: c.parentId || undefined,
        childIds: c.childIds || [],
        nodeIds: c.nodeIds || [],
        totalNodes: c.totalNodes || 0,
        onlineNodes: c.onlineNodes || 0,
        capacity: c.capacity || 0,
        load: c.load || 0,
        knowledgeIndex: c.knowledgeIndex as any[],
        lastSync: c.lastSync || new Date(),
        createdAt: c.createdAt || new Date(),
        updatedAt: c.updatedAt || new Date(),
      }));
    } catch (err) {
      logger.error({ err }, "Failed to get all clusters");
      return [];
    }
  }

  /** Update node location and re-cluster if needed */
  async updateNodeLocation(
    nodeId: string,
    location: { lat: number; lng: number },
  ): Promise<void> {
    try {
      // Update location
      await db
        .update(networkGhostNodes)
        .set({
          locationLat: location.lat,
          locationLng: location.lng,
          updatedAt: new Date(),
        })
        .where(eq(networkGhostNodes.id, nodeId));

      // Check if node needs to change clusters
      const [node] = await db
        .select()
        .from(networkGhostNodes)
        .where(eq(networkGhostNodes.id, nodeId))
        .limit(1);

      if (node && node.clusterId) {
        // Check if still within cluster radius
        const cluster = await this.getCluster(node.clusterId);
        if (cluster) {
          const distance = this.haversineDistance(
            location,
            cluster.location,
          );
          if (distance > cluster.radiusKm) {
            // Node moved outside cluster - remove from cluster
            await this.removeNodeFromCluster(nodeId, node.clusterId);
            // Attempt to join new cluster
            await this.attemptClusterFormation({
              ...node,
              location,
            });
          }
        }
      }
    } catch (err) {
      logger.error({ err, nodeId }, "Failed to update node location");
    }
  }

  /** Remove node from cluster */
  private async removeNodeFromCluster(
    nodeId: string,
    clusterId: string,
  ): Promise<void> {
    try {
      // Remove node from cluster
      await db
        .update(networkGhostNodes)
        .set({
          clusterId: null,
          tier: 1,
          updatedAt: new Date(),
        })
        .where(eq(networkGhostNodes.id, nodeId));

      // Update cluster node list
      const cluster = await this.getCluster(clusterId);
      if (cluster) {
        const newNodeIds = cluster.nodeIds.filter((id) => id !== nodeId);
        await db
          .update(networkClusters)
          .set({
            nodeIds: newNodeIds,
            totalNodes: newNodeIds.length,
            onlineNodes: newNodeIds.length, // Simplified
            updatedAt: new Date(),
          })
          .where(eq(networkClusters.id, clusterId));
      }
    } catch (err) {
      logger.error({ err, nodeId, clusterId }, "Failed to remove node from cluster");
    }
  }

  /** Get network hierarchy stats */
  async getHierarchyStats(): Promise<{
    totalNodes: number;
    totalClusters: number;
    nodesPerTier: Record<number, number>;
    largestClusterSize: number;
    avgClusterSize: number;
  }> {
    try {
      // Get node count per tier
      const nodeStats = await db
        .select({
          tier: networkGhostNodes.tier,
          count: sql<number>`count(*)`,
        })
        .from(networkGhostNodes)
        .groupBy(networkGhostNodes.tier);

      const nodesPerTier: Record<number, number> = {};
      nodeStats.forEach((stat) => {
        nodesPerTier[stat.tier] = Number(stat.count);
      });

      // Get cluster stats
      const clusters = await db.select().from(networkClusters);
      const totalClusters = clusters.length;
      const clusterSizes = clusters.map((c) => c.totalNodes || 0);
      const largestClusterSize = Math.max(...clusterSizes, 0);
      const avgClusterSize =
        clusterSizes.length > 0
          ? Math.round(clusterSizes.reduce((a, b) => a + b, 0) / clusterSizes.length)
          : 0;

      // Get total nodes
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)` })
        .from(networkGhostNodes);

      return {
        totalNodes: Number(total) || 0,
        totalClusters,
        nodesPerTier,
        largestClusterSize,
        avgClusterSize,
      };
    } catch (err) {
      logger.error({ err }, "Failed to get hierarchy stats");
      return {
        totalNodes: 0,
        totalClusters: 0,
        nodesPerTier: {},
        largestClusterSize: 0,
        avgClusterSize: 0,
      };
    }
  }
}
