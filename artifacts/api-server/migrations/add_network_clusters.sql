-- Network Clusters Table
-- Stores cluster state persistently (survives restarts)
CREATE TABLE IF NOT EXISTS network_clusters (
  id TEXT PRIMARY KEY,
  tier INTEGER NOT NULL,
  name TEXT NOT NULL,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  radius_km DOUBLE PRECISION NOT NULL,
  parent_id TEXT REFERENCES network_clusters(id),
  child_ids TEXT[] DEFAULT '{}',
  node_ids TEXT[] DEFAULT '{}',
  total_nodes INTEGER DEFAULT 0,
  online_nodes INTEGER DEFAULT 0,
  capacity INTEGER DEFAULT 0,
  load INTEGER DEFAULT 0,
  knowledge_index JSONB DEFAULT '[]',
  last_sync TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Network Ghost Nodes Table
-- Stores registered nodes with persistent state
CREATE TABLE IF NOT EXISTS network_ghost_nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  region TEXT NOT NULL,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  cluster_id TEXT REFERENCES network_clusters(id),
  tier INTEGER DEFAULT 1,
  status TEXT DEFAULT 'online',
  capacity INTEGER DEFAULT 100,
  load INTEGER DEFAULT 0,
  tasks_processed INTEGER DEFAULT 0,
  avg_response_ms INTEGER DEFAULT 0,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Network Heartbeats Table
-- Tracks node heartbeat history for monitoring
CREATE TABLE IF NOT EXISTS network_heartbeats (
  id BIGSERIAL PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES network_ghost_nodes(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL,
  load INTEGER,
  latency_ms INTEGER
);

-- Network Routing Tables
-- Stores routing information for clusters
CREATE TABLE IF NOT EXISTS network_routing_tables (
  cluster_id TEXT PRIMARY KEY REFERENCES network_clusters(id),
  routes JSONB NOT NULL DEFAULT '{}',
  latency_map JSONB NOT NULL DEFAULT '{}',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_clusters_tier ON network_clusters(tier);
CREATE INDEX IF NOT EXISTS idx_clusters_location ON network_clusters USING gist (
  ll_to_earth(location_lat, location_lng)
);
CREATE INDEX IF NOT EXISTS idx_nodes_cluster ON network_ghost_nodes(cluster_id);
CREATE INDEX IF NOT EXISTS idx_nodes_region ON network_ghost_nodes(region);
CREATE INDEX IF NOT EXISTS idx_nodes_location ON network_ghost_nodes USING gist (
  ll_to_earth(location_lat, location_lng)
);
CREATE INDEX IF NOT EXISTS idx_heartbeats_node ON network_heartbeats(node_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_timestamp ON network_heartbeats(timestamp DESC);

-- Add comments for documentation
COMMENT ON TABLE network_clusters IS 'Persistent cluster state for 7-tier mesh network';
COMMENT ON TABLE network_ghost_nodes IS 'Registered ghost nodes with location and cluster assignment';
COMMENT ON TABLE network_heartbeats IS 'Node heartbeat history for monitoring and uptime tracking';
COMMENT ON TABLE network_routing_tables IS 'Routing tables for hierarchical query routing';
