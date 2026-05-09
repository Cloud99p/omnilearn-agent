/**
 * Cluster Manager - Handles cluster formation, maintenance, and fusion
 */

import { Cluster, GhostNode, NetworkTier, calculateTier } from './types.js';

export class ClusterManager {
  private clusters: Map<string, Cluster> = new Map();
  private nodes: Map<string, GhostNode> = new Map();
  private discoveryRadiusKm: number = 50;

  /** Register a new node */
  registerNode(node: GhostNode): void {
    this.nodes.set(node.id, node);
    node.joinedAt = new Date();
    node.lastSeen = new Date();
    node.status = 'online';
    node.uptime = 100;
    node.capacity = 100; // Default capacity
    node.metadata = {
      version: '0.1.0',
      synthesizer: 'local',
      languages: ['en'],
    };

    // Attempt to cluster
    this.attemptClusterFormation(node);
  }

  /** Attempt to form a cluster with nearby nodes */
  private attemptClusterFormation(node: GhostNode): void {
    const nearbyNodes = this.findNearbyNodes(node, this.discoveryRadiusKm);
    
    if (nearbyNodes.length >= 49) { // 49 + this node = 50
      const clusterId = this.createCluster([...nearbyNodes, node], this.discoveryRadiusKm);
      
      // Assign nodes to cluster
      nearbyNodes.forEach(n => {
        n.clusterId = clusterId;
        n.lastSeen = new Date();
      });
      node.clusterId = clusterId;
      node.lastSeen = new Date();
    }
  }

  /** Find nodes within radius */
  findNearbyNodes(node: GhostNode, radiusKm: number): GhostNode[] {
    return Array.from(this.nodes.values()).filter(n => {
      if (n.id === node.id) return false;
      if (n.status !== 'online') return false;
      if (n.clusterId) return false; // Already in a cluster
      
      // Simple distance check (in production, use spatial index)
      const latDiff = Math.abs(n.location.lat - node.location.lat) * 111; // km per degree lat
      const lngDiff = Math.abs(n.location.lng - node.location.lng) * 
        Math.cos((node.location.lat * Math.PI) / 180) * 111; // km per degree lng
      
      const distance = Math.sqrt(latDiff ** 2 + lngDiff ** 2);
      return distance <= radiusKm;
    });
  }

  /** Create a new cluster */
  private createCluster(nodes: GhostNode[], radiusKm: number): string {
    const clusterId = `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate center location
    const centerLat = nodes.reduce((sum, n) => sum + n.location.lat, 0) / nodes.length;
    const centerLng = nodes.reduce((sum, n) => sum + n.location.lng, 0) / nodes.length;
    
    // Determine tier
    const tier = calculateTier(nodes.length, radiusKm);
    
    const cluster: Cluster = {
      id: clusterId,
      tier,
      name: this.generateClusterName(tier, centerLat, centerLng),
      location: { lat: centerLat, lng: centerLng },
      radiusKm,
      childIds: [],
      nodeIds: nodes.map(n => n.id),
      totalNodes: nodes.length,
      onlineNodes: nodes.filter(n => n.status === 'online').length,
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

  /** Generate cluster name based on tier and location */
  private generateClusterName(tier: NetworkTier, lat: number, lng: number): string {
    if (tier === NetworkTier.LOCAL_CLUSTER) {
      return `Local_${Math.floor(lat)}_${Math.floor(lng)}`;
    }
    if (tier === NetworkTier.METRO) {
      return `Metro_${Math.floor(lat / 5)}_${Math.floor(lng / 5)}`;
    }
    if (tier === NetworkTier.REGIONAL) {
      return `Regional_${Math.floor(lat / 10)}_${Math.floor(lng / 10)}`;
    }
    return `Cluster_${tier}`;
  }

  /** Check if cluster should fuse with nearby clusters */
  checkFusion(clusterId: string): FusionProposal | null {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) return null;

    const nearbyClusters = this.findNearbyClusters(cluster, cluster.radiusKm * 2);
    if (nearbyClusters.length >= 4) { // 4 + this = 5 clusters = metro tier
      return {
        id: `fusion_${Date.now()}`,
        proposerClusterId: clusterId,
        targetClusterIds: nearbyClusters.map(c => c.id),
        proposedTier: NetworkTier.METRO,
        proposedName: `Metro_${Math.floor(cluster.location.lat / 5)}_${Math.floor(cluster.location.lng / 5)}`,
        totalNodes: cluster.totalNodes + nearbyClusters.reduce((sum, c) => sum + c.totalNodes, 0),
        timestamp: new Date(),
        status: 'pending',
        votes: {},
      };
    }
    return null;
  }

  /** Find nearby clusters */
  private findNearbyClusters(cluster: Cluster, radiusKm: number): Cluster[] {
    return Array.from(this.clusters.values()).filter(c => {
      if (c.id === cluster.id) return false;
      
      const latDiff = Math.abs(c.location.lat - cluster.location.lat) * 111;
      const lngDiff = Math.abs(c.location.lng - cluster.location.lng) * 
        Math.cos((cluster.location.lat * Math.PI) / 180) * 111;
      
      const distance = Math.sqrt(latDiff ** 2 + lngDiff ** 2);
      return distance <= radiusKm;
    });
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
}

/** Fusion proposal management */
export class FusionManager {
  private proposals: Map<string, any> = new Map();

  createProposal(proposal: any): void {
    this.proposals.set(proposal.id, proposal);
  }

  vote(proposalId: string, clusterId: string, voted: boolean): void {
    const proposal = this.proposals.get(proposalId);
    if (proposal) {
      proposal.votes[clusterId] = voted;
      
      // Check if we have enough votes
      const totalClusters = 1 + proposal.targetClusterIds.length;
      const voteCount = Object.keys(proposal.votes).length;
      
      if (voteCount === totalClusters) {
        const allVoted = Object.values(proposal.votes).every(v => v);
        proposal.status = allVoted ? 'accepted' : 'rejected';
      }
    }
  }

  getProposal(id: string): any | undefined {
    return this.proposals.get(id);
  }

  getAllProposals(): any[] {
    return Array.from(this.proposals.values());
  }
}
