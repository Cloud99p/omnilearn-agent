-- Phase 2: Knowledge Sync and Proposal Tracking
-- Fixes type mismatch: network_ghost_nodes.id is TEXT, not INTEGER

-- 1. Knowledge Sync Log (tracks knowledge sharing between nodes)
CREATE TABLE IF NOT EXISTS knowledge_sync_log (
  id SERIAL PRIMARY KEY,
  node_id TEXT NOT NULL, -- Matches network_ghost_nodes.id (TEXT)
  knowledge_node_id INTEGER REFERENCES knowledge_nodes(id),
  sync_direction VARCHAR(10) NOT NULL, -- 'inbound' | 'outbound'
  sync_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'synced' | 'rejected' | 'conflict'
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  cluster_id TEXT,
  error_message TEXT,
  source_node_id TEXT, -- Node that sent the knowledge (for inbound syncs)
  
  CONSTRAINT valid_sync_direction CHECK (sync_direction IN ('inbound', 'outbound')),
  CONSTRAINT valid_sync_status CHECK (sync_status IN ('pending', 'synced', 'rejected', 'conflict', 'failed'))
);

CREATE INDEX idx_sync_log_node ON knowledge_sync_log(node_id);
CREATE INDEX idx_sync_log_status ON knowledge_sync_log(sync_status);
CREATE INDEX idx_sync_log_cluster ON knowledge_sync_log(cluster_id);
CREATE INDEX idx_sync_log_synced_at ON knowledge_sync_log(synced_at);

-- 2. Knowledge Proposals (cluster validation system)
CREATE TABLE IF NOT EXISTS knowledge_proposals (
  id SERIAL PRIMARY KEY,
  knowledge_node_id INTEGER REFERENCES knowledge_nodes(id),
  proposed_by_node_id TEXT NOT NULL, -- Matches network_ghost_nodes.id (TEXT)
  proposal_type VARCHAR(20) NOT NULL, -- 'new' | 'update' | 'delete'
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'ratified' | 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  cluster_id TEXT NOT NULL,
  
  CONSTRAINT valid_proposal_type CHECK (proposal_type IN ('new', 'update', 'delete')),
  CONSTRAINT valid_proposal_status CHECK (status IN ('pending', 'ratified', 'rejected'))
);

CREATE INDEX idx_proposals_status ON knowledge_proposals(status);
CREATE INDEX idx_proposals_cluster ON knowledge_proposals(cluster_id);
CREATE INDEX idx_proposals_created_at ON knowledge_proposals(created_at);

-- 3. Add share_level to knowledge_nodes (privacy controls)
ALTER TABLE knowledge_nodes 
ADD COLUMN IF NOT EXISTS share_level VARCHAR(20) DEFAULT 'private',
ADD COLUMN IF NOT EXISTS shared_by_user BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ratified_by_cluster BOOLEAN DEFAULT false;

-- Add check constraint for share_level
ALTER TABLE knowledge_nodes 
ADD CONSTRAINT valid_share_level CHECK (share_level IN ('private', 'cluster', 'metro', 'regional', 'global'));

-- 4. Add cluster communication fields to network_ghost_nodes
ALTER TABLE network_ghost_nodes
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS total_syncs INTEGER DEFAULT 0;

COMMENT ON TABLE knowledge_sync_log IS 'Tracks knowledge synchronization between nodes in the mesh network';
COMMENT ON TABLE knowledge_proposals IS 'Cluster validation system for new knowledge before ratification';
COMMENT ON COLUMN knowledge_nodes.share_level IS 'Privacy level: private, cluster, metro, regional, or global';
COMMENT ON COLUMN knowledge_nodes.shared_by_user IS 'User explicitly opted-in to share this knowledge';
COMMENT ON COLUMN knowledge_nodes.ratified_by_cluster IS 'Cluster has validated this knowledge (51% consensus)';
