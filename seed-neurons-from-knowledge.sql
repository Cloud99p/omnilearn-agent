-- Seed network_neurons from existing knowledge_nodes
-- Run this in Supabase SQL Editor

-- Insert all knowledge nodes as network neurons with default weights
INSERT INTO network_neurons (
  content,
  type,
  tags,
  weight,
  source_agent,
  tokens,
  is_core,
  is_ratified,
  ratification_quorum,
  positive_votes,
  negative_votes,
  vote_score,
  weighted_vote_score,
  created_at,
  updated_at
)
SELECT 
  kn.content,
  kn.type,
  COALESCE(kn.tags, '{}') as tags,
  1.0 as weight,
  'self' as source_agent,
  -- Empty tokens array (will be populated on first access)
  '{}'::text[] as tokens,
  false as is_core,
  false as is_ratified,
  0 as ratification_quorum,
  0 as positive_votes,
  0 as negative_votes,
  0.0 as vote_score,
  0.0 as weighted_vote_score,
  kn.created_at,
  NOW() as updated_at
FROM knowledge_nodes kn
LEFT JOIN network_neurons nn ON nn.content = kn.content
WHERE nn.id IS NULL;  -- Skip if already exists

-- Update core status for high-weight nodes (optional, based on your criteria)
UPDATE network_neurons 
SET is_core = true 
WHERE weight >= 5.0;

-- Show results
SELECT 
  COUNT(*) as total_neurons,
  COUNT(*) FILTER (WHERE is_core = true) as core_neurons,
  AVG(weight) as avg_weight,
  MAX(weight) as max_weight
FROM network_neurons;
