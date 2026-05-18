-- Export chat logs for training analysis
-- Run this in your Supabase SQL editor or psql

-- Get recent conversations with their messages
WITH recent_conversations AS (
  SELECT id, created_at
  FROM conversations
  ORDER BY created_at DESC
  LIMIT 50
)

SELECT 
  rc.id as conversation_id,
  rc.created_at as conversation_date,
  m.role,
  m.content,
  m.created_at as message_time
FROM recent_conversations rc
JOIN messages m ON m.conversation_id = rc.id
ORDER BY rc.created_at DESC, m.created_at ASC;
