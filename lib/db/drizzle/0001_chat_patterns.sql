-- Chat Patterns Schema
-- Stores conversation patterns for weekly analysis

CREATE TABLE IF NOT EXISTS chat_patterns (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    turn_number INTEGER NOT NULL,
    query TEXT NOT NULL,
    query_type VARCHAR(20) DEFAULT 'question',
    preceding_context JSONB,
    nodes_retrieved INTEGER DEFAULT 0,
    avg_similarity REAL,
    top_node_content TEXT,
    response_length INTEGER DEFAULT 0,
    nodes_used INTEGER DEFAULT 0,
    new_nodes_added INTEGER DEFAULT 0,
    use_llm BOOLEAN DEFAULT false,
    user_replied BOOLEAN DEFAULT false,
    time_to_next_query_ms INTEGER,
    conversation_end BOOLEAN DEFAULT false,
    pattern_type VARCHAR(50),
    confidence REAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_patterns_conversation_id ON chat_patterns(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_patterns_turn_number ON chat_patterns(conversation_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_chat_patterns_query_type ON chat_patterns(query_type);
CREATE INDEX IF NOT EXISTS idx_chat_patterns_created_at ON chat_patterns(created_at);

-- Conversation Summaries Schema
-- Weekly aggregated conversation analytics

CREATE TABLE IF NOT EXISTS conversation_summaries (
    id SERIAL PRIMARY KEY,
    week_start TIMESTAMP WITH TIME ZONE NOT NULL,
    week_end TIMESTAMP WITH TIME ZONE NOT NULL,
    total_conversations INTEGER NOT NULL,
    total_turns INTEGER NOT NULL,
    avg_turns_per_conversation REAL,
    question_count INTEGER DEFAULT 0,
    statement_count INTEGER DEFAULT 0,
    command_count INTEGER DEFAULT 0,
    greeting_count INTEGER DEFAULT 0,
    casual_count INTEGER DEFAULT 0,
    avg_nodes_retrieved REAL,
    avg_similarity REAL,
    total_new_nodes INTEGER DEFAULT 0,
    llm_fallback_rate REAL,
    avg_response_length REAL,
    top_patterns JSONB,
    knowledge_gaps JSONB,
    avg_curiosity REAL,
    avg_confidence REAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_week_start ON conversation_summaries(week_start);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_week_end ON conversation_summaries(week_end);
