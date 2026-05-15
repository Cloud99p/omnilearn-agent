/**
 * Hierarchical Routing Manager
 * Routes queries through appropriate network tiers
 */

import {
  RoutingTable,
  Query,
  QueryResponse,
  NetworkTier,
  Cluster,
  GhostNode,
  TIER_THRESHOLDS,
} from "./types.js";

export class RoutingManager {
  private routingTables: Map<string, RoutingTable> = new Map();
  private clusters: Map<string, Cluster> = new Map();
  private nodes: Map<string, GhostNode> = new Map();

  /** Add cluster to routing system */
  addCluster(cluster: Cluster): void {
    this.clusters.set(cluster.id, cluster);
    this.updateRoutingTable(cluster.id);
  }

  /** Add node to routing system */
  addNode(node: GhostNode): void {
    this.nodes.set(node.id, node);
    if (node.clusterId) {
      this.updateRoutingTable(node.clusterId);
    }
  }

  /** Update routing table for a cluster */
  private updateRoutingTable(clusterId: string): void {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) return;

    const routingTable: RoutingTable = {
      clusterId,
      routes: {
        local: [],
        regional: [],
        continental: [],
        global: [],
      },
      latencyMap: new Map(),
      lastUpdated: new Date(),
    };

    // Find nodes in same cluster (local)
    if (cluster.tier > NetworkTier.INDIVIDUAL) {
      routingTable.routes.local = cluster.nodeIds;
      cluster.nodeIds.forEach((nodeId) => {
        routingTable.latencyMap.set(nodeId, 5); // ~5ms local latency
      });
    }

    // Find parent cluster (regional)
    if (cluster.parentId) {
      const parent = this.clusters.get(cluster.parentId);
      if (parent) {
        routingTable.routes.regional = parent.nodeIds;
      }
    }

    // Find continental backbone
    if (cluster.tier === NetworkTier.REGIONAL) {
      // Find other regions in same continent
      const continentalNodes = Array.from(this.clusters.values())
        .filter(
          (c) =>
            c.tier === NetworkTier.REGIONAL &&
            this.getContinentFromLocation(c.location) ===
              this.getContinentFromLocation(cluster.location),
        )
        .flatMap((c) => c.nodeIds);

      routingTable.routes.continental = continentalNodes;
      continentalNodes.forEach((nodeId) => {
        routingTable.latencyMap.set(nodeId, 150); // ~150ms continental latency
      });
    }

    // Find global backbone
    if (cluster.tier >= NetworkTier.CONTINENTAL) {
      const globalNodes = Array.from(this.clusters.values())
        .filter((c) => c.tier >= NetworkTier.CONTINENTAL)
        .flatMap((c) => c.nodeIds);

      routingTable.routes.global = globalNodes;
      globalNodes.forEach((nodeId) => {
        routingTable.latencyMap.set(nodeId, 400); // ~400ms global latency
      });
    }

    this.routingTables.set(clusterId, routingTable);
  }

  /** Get continent from location (simplified) */
  private getContinentFromLocation(location: {
    lat: number;
    lng: number;
  }): string {
    if (location.lat >= 0 && location.lng >= -20 && location.lng <= 55)
      return "Africa";
    if (location.lat >= 0 && location.lng > 55 && location.lng <= 180)
      return "Asia";
    if (location.lat >= 0 && location.lng < -20) return "Americas";
    if (location.lat < 0 && location.lng > -20 && location.lng <= 55)
      return "Europe";
    return "Unknown";
  }

  /** Route a query through the network */
  async routeQuery(query: Query): Promise<QueryResponse[]> {
    const responses: QueryResponse[] = [];
    const routingTable = this.routingTables.get(query.originClusterId);

    if (!routingTable) {
      return [
        {
          queryId: query.id,
          nodeId: "unknown",
          clusterId: query.originClusterId,
          answer: "Routing table not found",
          confidence: 0,
          sources: [],
          timestamp: new Date(),
          latencyMs: 0,
        },
      ];
    }

    // Route based on query scope
    const targetNodes = this.getTargetNodes(query.scope, routingTable);

    // Simulate querying nodes (in production, this would be actual network calls)
    for (const nodeId of targetNodes) {
      const latency = routingTable.latencyMap.get(nodeId) || 100;

      responses.push({
        queryId: query.id,
        nodeId,
        clusterId: this.getNodeCluster(nodeId),
        answer: this.generateSimulatedAnswer(query.text, nodeId),
        confidence: Math.random() * 0.5 + 0.5,
        sources: [`node_${nodeId}`, `cluster_${this.getNodeCluster(nodeId)}`],
        timestamp: new Date(),
        latencyMs: latency,
      });
    }

    // Aggregate responses
    const aggregated = this.aggregateResponses(query.id, responses);
    return [aggregated];
  }

  /** Get target nodes based on query scope */
  private getTargetNodes(scope: string, routingTable: RoutingTable): string[] {
    switch (scope) {
      case "local":
        return routingTable.routes.local.slice(0, 5); // Top 5 local nodes
      case "metro":
        return [
          ...routingTable.routes.local,
          ...routingTable.routes.regional,
        ].slice(0, 20);
      case "regional":
        return [
          ...routingTable.routes.regional,
          ...routingTable.routes.continental,
        ].slice(0, 50);
      case "continental":
        return routingTable.routes.continental.slice(0, 100);
      case "global":
        return routingTable.routes.global.slice(0, 200);
      default:
        return routingTable.routes.local;
    }
  }

  /** Get cluster ID for a node */
  private getNodeCluster(nodeId: string): string {
    const node = this.nodes.get(nodeId);
    return node?.clusterId || "unknown";
  }

  /** Generate simulated answer (for demo) */
  private generateSimulatedAnswer(query: string, nodeId: string): string {
    return `Simulated response from node ${nodeId}: "${query}" processed with confidence 0.85`;
  }

  /** Aggregate multiple responses */
  private aggregateResponses(
    queryId: string,
    responses: QueryResponse[],
  ): QueryResponse {
    if (responses.length === 0) {
      return {
        queryId,
        nodeId: "aggregate",
        clusterId: "system",
        answer: "No responses received",
        confidence: 0,
        sources: [],
        timestamp: new Date(),
        latencyMs: 0,
      };
    }

    // Average confidence
    const avgConfidence =
      responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;

    // Average latency
    const avgLatency =
      responses.reduce((sum, r) => sum + r.latencyMs, 0) / responses.length;

    // Combine sources
    const allSources = new Set(responses.flatMap((r) => r.sources));

    return {
      queryId,
      nodeId: "aggregate",
      clusterId: "system",
      answer: `Aggregated response from ${responses.length} sources`,
      confidence: avgConfidence,
      sources: Array.from(allSources),
      timestamp: new Date(),
      latencyMs: avgLatency,
    };
  }

  /** Get routing table for cluster */
  getRoutingTable(clusterId: string): RoutingTable | undefined {
    return this.routingTables.get(clusterId);
  }

  /** Get network statistics */
  getNetworkStats(): {
    totalNodes: number;
    totalClusters: number;
    nodesByTier: Record<number, number>;
    avgLatencyByTier: Record<number, number>;
  } {
    const nodesByTier: Record<number, number> = {};
    const latencySums: Record<number, number> = {};
    const latencyCounts: Record<number, number> = {};

    this.nodes.forEach((node) => {
      if (node.clusterId) {
        const cluster = this.clusters.get(node.clusterId);
        if (cluster) {
          const tier = cluster.tier;
          nodesByTier[tier] = (nodesByTier[tier] || 0) + 1;
        }
      } else {
        nodesByTier[1] = (nodesByTier[1] || 0) + 1;
      }
    });

    this.routingTables.forEach((table) => {
      const tier = table.clusterId.startsWith("cluster_")
        ? NetworkTier.LOCAL_CLUSTER
        : NetworkTier.INDIVIDUAL;

      table.latencyMap.forEach((latency, nodeId) => {
        latencySums[tier] = (latencySums[tier] || 0) + latency;
        latencyCounts[tier] = (latencyCounts[tier] || 0) + 1;
      });
    });

    const avgLatencyByTier: Record<number, number> = {};
    Object.keys(latencySums).forEach((tier) => {
      const t = parseInt(tier);
      avgLatencyByTier[t] = latencySums[t] / latencyCounts[t];
    });

    return {
      totalNodes: this.nodes.size,
      totalClusters: this.clusters.size,
      nodesByTier,
      avgLatencyByTier,
    };
  }
}
