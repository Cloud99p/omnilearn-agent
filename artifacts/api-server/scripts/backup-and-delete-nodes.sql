-- ============================================
-- BACKUP KNOWLEDGE NODES
-- Run this in Supabase SQL Editor before deletion
-- ============================================

-- Export all nodes to JSON (copy result and save locally)
SELECT 
  json_agg(row_to_json(t)) as backup
FROM (
  SELECT 
    id, clerk_id, content, type, tags, source, confidence,
    times_accessed, times_confirmed, tfidf_vector, tokens,
    embedding, created_at, updated_at
  FROM knowledge_nodes
  ORDER BY created_at DESC
) t;

-- ============================================
-- DELETE NODES WITHOUT EMBEDDINGS
-- ⚠️  RUN BACKUP FIRST!
-- ============================================

-- Count nodes without embeddings
SELECT 
  COUNT(*) as total_nodes,
  COUNT(*) FILTER (WHERE embedding IS NULL OR jsonb_array_length(embedding) = 0) as without_embeddings,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL AND jsonb_array_length(embedding) > 0) as with_embeddings
FROM knowledge_nodes;

-- Delete nodes without embeddings
DELETE FROM knowledge_nodes
WHERE embedding IS NULL 
   OR jsonb_array_length(embedding) = 0;

-- Verify deletion
SELECT 
  COUNT(*) as remaining_nodes,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL AND jsonb_array_length(embedding) > 0) as with_embeddings
FROM knowledge_nodes;
