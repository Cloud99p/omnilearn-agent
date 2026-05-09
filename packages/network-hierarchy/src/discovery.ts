/**
 * Network Discovery Service
 * Handles node discovery, heartbeats, and network topology maintenance
 */

import { GhostNode, DiscoveryMessage, Cluster } from './types.js';

export interface DiscoveryConfig {
  heartbeatIntervalMs: number;
  discoveryRadiusKm: number;
  ttl: number;
}

export class DiscoveryService {
  private nodes: Map<string, GhostNode> = new Map();
  private clusters: Map<string, Cluster> = new Map();
  private config: DiscoveryConfig;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(config: Partial<DiscoveryConfig> = {}) {
    this.config = {
      heartbeatIntervalMs: 30000, // 30 seconds
      discoveryRadiusKm: 50,
      ttl: 10,
      ...config,
    };
  }

  /** Start discovery service */
  start(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeats();
    }, this.config.heartbeatIntervalMs);
  }

  /** Stop discovery service */
  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  }

  /** Register a node */
  registerNode(node: GhostNode): void {
    this.nodes.set(node.id, node);
    this.broadcast({
      type: 'hello',
      fromNodeId: node.id,
      timestamp: new Date(),
      location: node.location,
      capacity: node.capacity,
    });
  }

  /** Send heartbeat to all known nodes */
  private sendHeartbeats(): void {
    const now = new Date();
    
    // Update node status
    this.nodes.forEach(node => {
      node.lastSeen = now;
      
      // Remove if offline for too long
      if (now.getTime() - node.lastSeen.getTime() > 300000) { // 5 minutes
        node.status = 'offline';
      }
    });

    // Broadcast heartbeat
    this.broadcast({
      type: 'heartbeat',
      fromNodeId: 'discovery-service',
      timestamp: now,
      location: { lat: 0, lng: 0 },
      capacity: 0,
    });
  }

  /** Broadcast message to all nodes */
  broadcast(message: DiscoveryMessage): void {
    // In production, this would use actual network transport
    // For now, just store for simulation
    console.log(`[Discovery] Broadcasting: ${message.type} from ${message.fromNodeId}`);
  }

  /** Process incoming discovery message */
  processMessage(message: DiscoveryMessage): void {
    switch (message.type) {
      case 'hello':
        this.handleHello(message);
        break;
      case 'heartbeat':
        this.handleHeartbeat(message);
        break;
      case 'goodbye':
        this.handleGoodbye(message);
        break;
    }
  }

  /** Handle hello message */
  private handleHello(message: DiscoveryMessage): void {
    const existingNode = this.nodes.get(message.fromNodeId);
    
    if (existingNode) {
      // Update existing node
      existingNode.lastSeen = message.timestamp;
      existingNode.capacity = message.capacity;
    } else {
      // Create new node entry
      const newNode: GhostNode = {
        id: message.fromNodeId,
        publicKey: '',
        location: message.location,
        capacity: message.capacity,
        status: 'online',
        uptime: 100,
        lastSeen: message.timestamp,
        joinedAt: message.timestamp,
      };
      this.nodes.set(message.fromNodeId, newNode);
    }
  }

  /** Handle heartbeat message */
  private handleHeartbeat(message: DiscoveryMessage): void {
    const node = this.nodes.get(message.fromNodeId);
    if (node) {
      node.lastSeen = message.timestamp;
      node.status = 'online';
    }
  }

  /** Handle goodbye message */
  private handleGoodbye(message: DiscoveryMessage): void {
    const node = this.nodes.get(message.fromNodeId);
    if (node) {
      node.status = 'offline';
      node.lastSeen = message.timestamp;
    }
  }

  /** Find nearby nodes */
  findNearbyNodes(center: { lat: number; lng: number }, radiusKm: number): GhostNode[] {
    return Array.from(this.nodes.values()).filter(node => {
      if (node.status !== 'online') return false;
      
      const latDiff = Math.abs(node.location.lat - center.lat) * 111;
      const lngDiff = Math.abs(node.location.lng - center.lng) * 
        Math.cos((center.lat * Math.PI) / 180) * 111;
      
      const distance = Math.sqrt(latDiff ** 2 + lngDiff ** 2);
      return distance <= radiusKm;
    });
  }

  /** Get all online nodes */
  getOnlineNodes(): GhostNode[] {
    return Array.from(this.nodes.values()).filter(n => n.status === 'online');
  }

  /** Get node count by tier */
  getNodeCountByTier(): Record<number, number> {
    const counts: Record<number, number> = {};
    
    this.nodes.forEach(node => {
      if (node.clusterId) {
        const cluster = this.clusters.get(node.clusterId);
        if (cluster) {
          const tier = cluster.tier;
          counts[tier] = (counts[tier] || 0) + 1;
        }
      } else {
        counts[1] = (counts[1] || 0) + 1;
      }
    });
    
    return counts;
  }

  /** Register a cluster */
  registerCluster(cluster: Cluster): void {
    this.clusters.set(cluster.id, cluster);
  }

  /** Get cluster count */
  getClusterCount(): number {
    return this.clusters.size;
  }

  /** Get total node count */
  getTotalNodeCount(): number {
    return this.nodes.size;
  }
}
