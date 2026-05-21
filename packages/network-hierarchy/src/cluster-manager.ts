/**
 * Cluster Manager - Handles cluster formation, fusion, and maintenance
 * Pure in-memory implementation (persistence handled by API server)
 */

import { Cluster, FusionProposal, GhostNode, NetworkTier, calculateTier } from "./types.js";

export class ClusterManager {
  private clusters: Map<string, Cluster> = new Map();
  private nodes: Map<string, GhostNode> = new Map();
  private discoveryRadiusKm: number = 50;

  /** Register a new node */
  registerNode(node: GhostNode): void {
    this.nodes.set(node.id, node);
    node.joinedAt = new Date();
    node.lastSeen = new Date();
    node.status = "online";
    node.uptime = 100;
    node.capacity = node.capacity || 100;
    node.metadata = {
      version: "0.1.0",
      synthesizer: "local",
      languages: ["en"],
    };

    // Attempt to cluster
    this.attemptClusterFormation(node);
  }

  /** Attempt to form a cluster with nearby nodes */
  private attemptClusterFormation(node: GhostNode): void {
    const nearbyNodes = this.findNearbyNodes(node, this.discoveryRadiusKm);

    if (nearbyNodes.length >= 49) {
      // 49 + this node = 50 → Tier 2 cluster
      const clusterId = this.createCluster(
        [...nearbyNodes, node],
        this.discoveryRadiusKm,
      );

      // Assign nodes to cluster
      nearbyNodes.forEach((n) => {
        n.clusterId = clusterId;
        n.lastSeen = new Date();
      });
      node.clusterId = clusterId;
      node.lastSeen = new Date();
    }
  }

  /** Find nodes within radius using Haversine distance */
  private findNearbyNodes(node: GhostNode, radiusKm: number): GhostNode[] {
    return Array.from(this.nodes.values()).filter((n) => {
      if (n.id === node.id) return false;
      if (n.status !== "online") return false;
      if (n.clusterId) return false; // Already in a cluster

      const distance = this.haversineDistance(
        { lat: n.location.lat, lng: n.location.lng },
        { lat: node.location.lat, lng: node.location.lng },
      );
      return distance <= radiusKm;
    });
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
  private createCluster(nodes: GhostNode[], radiusKm: number): string {
    const clusterId = `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate center location
    const centerLat =
      nodes.reduce((sum, n) => sum + n.location.lat, 0) / nodes.length;
    const centerLng =
      nodes.reduce((sum, n) => sum + n.location.lng, 0) / nodes.length;

    // Determine tier
    const tier = calculateTier(nodes.length, radiusKm);

    const cluster: Cluster = {
      id: clusterId,
      tier,
      name: this.generateClusterName(tier, centerLat, centerLng),
      location: { lat: centerLat, lng: centerLng },
      radiusKm,
      childIds: [],
      nodeIds: nodes.map((n) => n.id),
      totalNodes: nodes.length,
      onlineNodes: nodes.filter((n) => n.status === "online").length,
      capacity: nodes.reduce((sum, n) => sum + (n.capacity || 100), 0),
      load: 0,
      knowledgeIndex: [],
      lastSync: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.clusters.set(clusterId, cluster);
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

    let region = "Unknown";
    if (lat > 0) {
      region = lng < 0 ? "Americas" : lng < 60 ? "Africa/Europe" : "Asia/Pacific";
    } else {
      region = lng < 0 ? "South Americas" : lng < 60 ? "Africa" : "Oceania";
    }

    return `${tierNames[tier]} ${region} ${Date.now()}`;
  }

  /** Get cluster by ID */
  getCluster(clusterId: string): Cluster | undefined {
    return this.clusters.get(clusterId);
  }

  /** Get all clusters */
  getAllClusters(): Cluster[] {
    return Array.from(this.clusters.values());
  }

  /** Get node by ID */
  getNode(nodeId: string): GhostNode | undefined {
    return this.nodes.get(nodeId);
  }

  /** Get all nodes */
  getAllNodes(): GhostNode[] {
    return Array.from(this.nodes.values());
  }

  /** Update node location */
  updateNodeLocation(nodeId: string, location: { lat: number; lng: number }): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.location = location;
      node.lastSeen = new Date();

      // Check if node needs to change clusters
      if (node.clusterId) {
        const cluster = this.clusters.get(node.clusterId);
        if (cluster) {
          const distance = this.haversineDistance(location, cluster.location);
          if (distance > cluster.radiusKm) {
            // Node moved outside cluster
            this.removeNodeFromCluster(nodeId, node.clusterId);
          }
        }
      }
    }
  }

  /** Remove node from cluster */
  private removeNodeFromCluster(nodeId: string, clusterId: string): void {
    const node = this.nodes.get(nodeId);
    const cluster = this.clusters.get(clusterId);

    if (node && cluster) {
      node.clusterId = undefined;
      cluster.nodeIds = cluster.nodeIds.filter((id) => id !== nodeId);
      cluster.totalNodes = cluster.nodeIds.length;
      cluster.updatedAt = new Date();
    }
  }

  /** Get hierarchy stats */
  getHierarchyStats(): {
    totalNodes: number;
    totalClusters: number;
    nodesPerTier: Record<number, number>;
    largestClusterSize: number;
    avgClusterSize: number;
  } {
    const nodes = this.getAllNodes();
    const clusters = this.getAllClusters();

    const nodesPerTier: Record<number, number> = {};
    nodes.forEach((node) => {
      const tier = node.tier || 1;
      nodesPerTier[tier] = (nodesPerTier[tier] || 0) + 1;
    });

    const clusterSizes = clusters.map((c) => c.totalNodes);
    const largestClusterSize = Math.max(...clusterSizes, 0);
    const avgClusterSize =
      clusterSizes.length > 0
        ? Math.round(clusterSizes.reduce((a, b) => a + b, 0) / clusterSizes.length)
        : 0;

    return {
      totalNodes: nodes.length,
      totalClusters: clusters.length,
      nodesPerTier,
      largestClusterSize,
      avgClusterSize,
    };
  }
}
