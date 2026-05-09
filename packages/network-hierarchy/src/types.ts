/**
 * OmniLearn 7-Tier Hierarchical Network Architecture
 * Self-organizing mesh network from local clusters to planetary intelligence
 */

// ─── Network Tiers ──────────────────────────────────────────────────────────

export enum NetworkTier {
  INDIVIDUAL = 1,      // Single Ghost Node
  LOCAL_CLUSTER = 2,   // 50 nodes in 50km radius (city)
  METRO = 3,          // 5 clusters (250 nodes) in 200km (metro area)
  REGIONAL = 4,       // 10 metros (2.5K nodes) in 1000km (state/country)
  CONTINENTAL = 5,    // 20 regions (50K nodes) in 5000km (continent)
  GLOBAL = 6,         // 4 continents (200K+ nodes)
  PLANETARY = 7,      // Emergent planetary intelligence
}

export interface TierThreshold {
  tier: NetworkTier;
  minUnits: number;
  radiusKm: number;
  maxLatencyMs: number;
  bandwidthGbps: number;
  name: string;
  description: string;
}

export const TIER_THRESHOLDS: TierThreshold[] = [
  { tier: NetworkTier.INDIVIDUAL, minUnits: 1, radiusKm: 0, maxLatencyMs: 1, bandwidthGbps: 10, name: "Individual Node", description: "Single Ghost Node" },
  { tier: NetworkTier.LOCAL_CLUSTER, minUnits: 50, radiusKm: 50, maxLatencyMs: 10, bandwidthGbps: 1, name: "Local Cluster", description: "City-wide cluster" },
  { tier: NetworkTier.METRO, minUnits: 250, radiusKm: 200, maxLatencyMs: 50, bandwidthGbps: 10, name: "Metro Network", description: "Greater metropolitan" },
  { tier: NetworkTier.REGIONAL, minUnits: 2500, radiusKm: 1000, maxLatencyMs: 100, bandwidthGbps: 100, name: "Regional Network", description: "State/national" },
  { tier: NetworkTier.CONTINENTAL, minUnits: 50000, radiusKm: 5000, maxLatencyMs: 200, bandwidthGbps: 1000, name: "Continental Backbone", description: "Entire continent" },
  { tier: NetworkTier.GLOBAL, minUnits: 200000, radiusKm: 20000, maxLatencyMs: 500, bandwidthGbps: 10000, name: "Global Mesh", description: "Planetary network" },
  { tier: NetworkTier.PLANETARY, minUnits: 0, radiusKm: 40000, maxLatencyMs: 0, bandwidthGbps: 0, name: "Planetary Intelligence", description: "Emergent consciousness" },
];

// ─── Node & Cluster Types ───────────────────────────────────────────────────

export interface GeoLocation {
  lat: number;
  lng: number;
  city?: string;
  region?: string;
  country?: string;
  continent?: string;
}

export interface GhostNode {
  id: string;
  publicKey: string;
  location: GeoLocation;
  capacity: number;
  status: 'online' | 'offline' | 'degraded';
  uptime: number;
  clusterId?: string;
  metadata?: { version: string; synthesizer: string; languages: string[] };
  lastSeen: Date;
  joinedAt: Date;
}

export interface Cluster {
  id: string;
  tier: NetworkTier;
  name: string;
  location: GeoLocation;
  radiusKm: number;
  parentId?: string;
  childIds: string[];
  nodeIds: string[];
  leaderId?: string;
  leaderTermEnds?: Date;
  totalNodes: number;
  onlineNodes: number;
  capacity: number;
  load: number;
  knowledgeIndex: string[];
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Discovery & Fusion ─────────────────────────────────────────────────────

export interface DiscoveryMessage {
  type: 'hello' | 'heartbeat' | 'goodbye' | 'fusion_request' | 'fusion_accept';
  fromNodeId: string;
  timestamp: Date;
  location: GeoLocation;
  capacity: number;
}

export interface FusionProposal {
  id: string;
  proposerClusterId: string;
  targetClusterIds: string[];
  proposedTier: NetworkTier;
  proposedName: string;
  totalNodes: number;
  timestamp: Date;
  status: 'pending' | 'accepted' | 'rejected' | 'timeout';
  votes: Record<string, boolean>;
}

// ─── Routing & Query ────────────────────────────────────────────────────────

export interface RoutingTable {
  clusterId: string;
  routes: {
    local: string[];
    regional: string[];
    continental: string[];
    global: string[];
  };
  latencyMap: Map<string, number>;
  lastUpdated: Date;
}

export interface Query {
  id: string;
  text: string;
  originNodeId: string;
  originClusterId: string;
  scope: 'local' | 'metro' | 'regional' | 'continental' | 'global';
  timestamp: Date;
  ttl: number;
  hops: number;
}

export interface QueryResponse {
  queryId: string;
  nodeId: string;
  clusterId: string;
  answer: string;
  confidence: number;
  sources: string[];
  timestamp: Date;
  latencyMs: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Haversine distance in km */
export function haversineDistance(loc1: GeoLocation, loc2: GeoLocation): number {
  const R = 6371;
  const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const dLon = ((loc2.lng - loc1.lng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((loc1.lat * Math.PI) / 180) * Math.cos((loc2.lat * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Calculate tier based on node count and radius */
export function calculateTier(nodeCount: number, radiusKm: number): NetworkTier {
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    const tier = TIER_THRESHOLDS[i];
    if (nodeCount >= tier.minUnits && radiusKm <= tier.radiusKm) {
      return tier.tier;
    }
  }
  return NetworkTier.INDIVIDUAL;
}
