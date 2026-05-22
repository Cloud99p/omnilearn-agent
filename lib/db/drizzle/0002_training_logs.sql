-- Training Logs Schema
-- Stores detailed training data from chat interactions

CREATE TABLE IF NOT EXISTS "training_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"retrieved_nodes" jsonb,
	"response_type" text NOT NULL,
	"native_response" text,
	"llm_response" text,
	"final_response" text NOT NULL,
	"nodes_used" integer DEFAULT 0,
	"avg_similarity" real,
	"character_state" jsonb,
	"conversation_id" integer,
	"user_replied" boolean DEFAULT false,
	"follow_up_query" text,
	"conversation_turns" integer DEFAULT 1,
	"llm_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_training_logs_conversation_id" ON "training_logs" ("conversation_id");
CREATE INDEX IF NOT EXISTS "idx_training_logs_created_at" ON "training_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_training_logs_response_type" ON "training_logs" ("response_type");
