-- Create training_logs table for A/B testing native vs LLM responses
CREATE TABLE IF NOT EXISTS training_logs (
  id SERIAL PRIMARY KEY,
  
  -- Query and context
  query TEXT NOT NULL,
  retrieved_nodes JSONB,
  
  -- Response data
  response_type TEXT NOT NULL, -- 'native', 'llm', 'hybrid'
  native_response TEXT,
  llm_response TEXT,
  final_response TEXT NOT NULL,
  
  -- Metadata
  nodes_used INTEGER DEFAULT 0,
  avg_similarity REAL,
  character_state JSONB,
  
  -- User engagement tracking
  conversation_id INTEGER,
  user_replied BOOLEAN DEFAULT FALSE,
  follow_up_query TEXT,
  conversation_turns INTEGER DEFAULT 1,
  
  -- Quality signals
  llm_score REAL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_training_logs_response_type ON training_logs(response_type);
CREATE INDEX IF NOT EXISTS idx_training_logs_created_at ON training_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_logs_conversation_id ON training_logs(conversation_id);

-- Grant permissions (adjust as needed)
GRANT SELECT, INSERT ON training_logs TO postgres;
