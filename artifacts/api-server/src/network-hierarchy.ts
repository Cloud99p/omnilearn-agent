/**
 * Network Hierarchy Helper
 * Provides convenient access to network service for routes
 */

import { NetworkService } from "./lib/network-service.js";

// Singleton instance
let networkService: NetworkService | null = null;

/**
 * Get or create network service instance
 */
export function getNetworkService(): NetworkService {
  if (!networkService) {
    networkService = new NetworkService();
  }
  return networkService;
}

/**
 * Initialize network service (call once on startup)
 */
export async function initializeNetworkService(): Promise<void> {
  if (!networkService) {
    networkService = new NetworkService();
    await networkService.initialize();
  }
}

/**
 * Get cluster manager stats (for API responses)
 */
export async function getHierarchyStats(): Promise<{
  totalNodes: number;
  totalClusters: number;
  nodesPerTier: Record<number, number>;
  largestClusterSize: number;
  avgClusterSize: number;
}> {
  const service = getNetworkService();
  return service.getHierarchyStats();
}

/**
 * Get all clusters (for API responses)
 */
export async function getAllClusters() {
  const service = getNetworkService();
  return service.getClusters();
}
