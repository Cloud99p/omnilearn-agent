/**
 * Network Hierarchy Integration
 * Wires the 7-tier mesh network into the API server
 */

import { ClusterManager } from "@omnilearn/network-hierarchy";
import { db } from "./lib/db.js";
import { ghostNodes } from "@workspace/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { logger } from "./lib/logger.js";

// Singleton cluster manager
export const clusterManager = new ClusterManager();

/**
 * Initialize cluster manager with existing ghost nodes
 */
export async function initializeClusterManager(): Promise<void> {
  try {
    const nodes = await db.select().from(ghostNodes);
    
    for (const node of nodes) {
      // Convert DB node to ClusterManager GhostNode format
      const ghostNode: any = {
        id: node.id.toString(),
        name: node.name,
        endpoint: node.endpoint,
        secretKey: node.secretKey,
        region: node.region,
        status: node.status,
        lastSeen: node.lastSeen ? new Date(node.lastSeen) : undefined,
        tasksProcessed: node.tasksProcessed,
        tasksFailed: node.tasksFailed,
        avgResponseMs: node.avgResponseMs,
        isSelf: node.isSelf,
        notes: node.notes,
        // Location data (defaults to region center if not provided)
        location: node.location || {
          lat: getRegionCenter(node.region).lat,
          lng: getRegionCenter(node.region).lng,
        },
        clusterId: node.clusterId || null,
        tier: node.tier || 1,
        joinedAt: node.createdAt,
        capacity: 100,
        metadata: {
          version: "0.1.0",
          synthesizer: "local",
          languages: ["en"],
        },
      };
      
      clusterManager.registerNode(ghostNode);
      logger.info({ nodeId: node.id, clusterId: ghostNode.clusterId }, 
        "Cluster manager initialized with ghost node");
    }
    
    logger.info({ initialized: nodes.length }, 
      "Cluster manager initialized successfully");
  } catch (err) {
    logger.error(err, "Failed to initialize cluster manager");
  }
}

/**
 * Get region center coordinates
 */
function getRegionCenter(region: string): { lat: number; lng: number } {
  const centers: Record<string, { lat: number; lng: number }> = {
    "nigeria": { lat: 9.0820, lng: 8.6753 },
    "lagos": { lat: 6.5244, lng: 3.3792 },
    "abuja": { lat: 9.0765, lng: 7.3986 },
    "usa": { lat: 37.0902, lng: -95.7129 },
    "new york": { lat: 40.7128, lng: -74.0060 },
    "london": { lat: 51.5074, lng: -0.1278 },
    "germany": { lat: 51.1657, lng: 10.4515 },
    "france": { lat: 46.2276, lng: 2.2137 },
    "australia": { lat: -25.2744, lng: 133.7751 },
    "japan": { lat: 36.2048, lng: 138.2529 },
    "india": { lat: 20.5937, lng: 78.9629 },
    "brazil": { lat: -14.2350, lng: -51.9253 },
    "canada": { lat: 56.1304, lng: -106.3468 },
    "unknown": { lat: 0, lng: 0 },
  };
  
  const lower = region.toLowerCase();
  for (const [key, center] of Object.entries(centers)) {
    if (lower.includes(key)) return center;
  }
  
  // Default: random location for new regions
  return {
    lat: (Math.random() - 0.5) * 180,
    lng: (Math.random() - 0.5) * 360,
  };
}

/**
 * Update node location in cluster manager
 */
export function updateNodeLocation(nodeId: string, location: { lat: number; lng: number }): void {
  const node = clusterManager["nodes"].get(nodeId);
  if (node) {
    node.location = location;
    // Re-attempt clustering with new location
    clusterManager.attemptClusterFormation(node);
  }
}

/**
 * Get cluster information for a node
 */
export function getNodeCluster(nodeId: string): any | null {
  const node = clusterManager["nodes"].get(nodeId);
  if (!node || !node.clusterId) return null;
  
  return clusterManager["clusters"].get(node.clusterId) || null;
}

/**
 * Get all clusters
 */
export function getAllClusters(): any[] {
  return Array.from(clusterManager["clusters"].values());
}

/**
 * Get network hierarchy stats
 */
export function getNetworkHierarchyStats(): {
  totalNodes: number;
  clusters: number;
  nodesPerTier: Record<number, number>;
  largestClusterSize: number;
  avgClusterSize: number;
} {
  const nodes = Array.from(clusterManager["nodes"].values());
  const clusters = Array.from(clusterManager["clusters"].values());
  
  const nodesPerTier: Record<number, number> = {};
  for (const node of nodes) {
    const tier = node.tier || 1;
    nodesPerTier[tier] = (nodesPerTier[tier] || 0) + 1;
  }
  
  const clusterSizes = clusters.map(c => c.totalNodes);
  const largestClusterSize = Math.max(...clusterSizes, 0);
  const avgClusterSize = clusters.length > 0 
    ? clusterSizes.reduce((a, b) => a + b, 0) / clusters.length 
    : 0;
  
  return {
    totalNodes: nodes.length,
    clusters: clusters.length,
    nodesPerTier,
    largestClusterSize,
    avgClusterSize,
  };
}
