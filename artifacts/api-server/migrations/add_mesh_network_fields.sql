-- Migration: Add 7-tier mesh network fields to ghost_nodes
-- Date: 2026-05-20

ALTER TABLE ghost_nodes 
ADD COLUMN IF NOT EXISTS cluster_id TEXT,
ADD COLUMN IF NOT EXISTS tier INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 100;

-- Add index for cluster lookups
CREATE INDEX IF NOT EXISTS idx_ghost_nodes_cluster_id ON ghost_nodes(cluster_id);
CREATE INDEX IF NOT EXISTS idx_ghost_nodes_tier ON ghost_nodes(tier);

-- Add comments
COMMENT ON COLUMN ghost_nodes.cluster_id IS 'Cluster ID in the 7-tier mesh network';
COMMENT ON COLUMN ghost_nodes.tier IS 'Tier level (1-7) in the hierarchical network';
COMMENT ON COLUMN ghost_nodes.location IS 'JSON location data: {lat: number, lng: number}';
COMMENT ON COLUMN ghost_nodes.joined_at IS 'When the node joined the cluster';
COMMENT ON COLUMN ghost_nodes.capacity IS 'Node capacity for task distribution';
