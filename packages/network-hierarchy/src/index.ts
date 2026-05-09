/**
 * OmniLearn Network Hierarchy
 * 7-tier self-organizing mesh network
 */

export * from './types.js';
export * from './cluster-manager.js';
export * from './discovery.js';
export * from './routing.js';

/**
 * Network Hierarchy Overview:
 * 
 * Tier 1: Individual Node (1 node)
 *   └─ Tier 2: Local Cluster (50 nodes in 50km)
 *       └─ Tier 3: Metro Network (5 clusters in 200km)
 *           └─ Tier 4: Regional Network (10 metros in 1000km)
 *               └─ Tier 5: Continental Backbone (20 regions in 5000km)
 *                   └─ Tier 6: Global Mesh (4 continents in 20000km)
 *                       └─ Tier 7: Planetary Intelligence (emergent)
 * 
 * Key Features:
 * - Self-organizing: Nodes automatically cluster based on proximity
 * - Self-healing: Network routes around failures
 * - Scalable: Handles 1 to 1M+ nodes
 * - Hierarchical routing: Queries routed through appropriate tier
 * - Knowledge aggregation: Insights flow up the hierarchy
 */
