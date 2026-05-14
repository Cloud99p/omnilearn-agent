CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" text,
	"title" text NOT NULL,
	"mode" text DEFAULT 'local' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" text,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT 'Wrench' NOT NULL,
	"system_prompt" text NOT NULL,
	"category" text NOT NULL,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"is_installed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"clerk_id" text PRIMARY KEY NOT NULL,
	"email" text,
	"display_name" text,
	"avatar_url" text,
	"github_username" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"repo_full_name" text NOT NULL,
	"description" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"language" text,
	"html_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" text,
	"content" text NOT NULL,
	"type" text DEFAULT 'fact' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"source" text DEFAULT 'conversation' NOT NULL,
	"confidence" real DEFAULT 0.7 NOT NULL,
	"times_accessed" integer DEFAULT 0 NOT NULL,
	"times_confirmed" integer DEFAULT 0 NOT NULL,
	"tfidf_vector" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tokens" text[] DEFAULT '{}' NOT NULL,
	"embedding" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_id" integer NOT NULL,
	"to_id" integer NOT NULL,
	"relationship" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" text,
	"curiosity" real DEFAULT 50 NOT NULL,
	"caution" real DEFAULT 40 NOT NULL,
	"confidence" real DEFAULT 45 NOT NULL,
	"verbosity" real DEFAULT 50 NOT NULL,
	"technical" real DEFAULT 55 NOT NULL,
	"empathy" real DEFAULT 50 NOT NULL,
	"creativity" real DEFAULT 45 NOT NULL,
	"total_interactions" integer DEFAULT 0 NOT NULL,
	"total_knowledge_nodes" integer DEFAULT 0 NOT NULL,
	"evolution_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" text,
	"event" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"nodes_added" real DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'conversation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghost_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" text,
	"name" text NOT NULL,
	"endpoint" text NOT NULL,
	"secret_key" text NOT NULL,
	"region" text DEFAULT 'unknown' NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"last_seen" timestamp with time zone,
	"tasks_processed" integer DEFAULT 0 NOT NULL,
	"tasks_failed" integer DEFAULT 0 NOT NULL,
	"avg_response_ms" real,
	"is_self" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghost_invite_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"max_uses" integer DEFAULT 100 NOT NULL,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ghost_invite_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "ghost_worker_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"worker_id" text NOT NULL,
	"worker_secret" text NOT NULL,
	"name" text NOT NULL,
	"invite_token" text,
	"status" text DEFAULT 'idle' NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"tasks_processed" integer DEFAULT 0 NOT NULL,
	"tasks_failed" integer DEFAULT 0 NOT NULL,
	"avg_response_ms" real,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ghost_worker_sessions_worker_id_unique" UNIQUE("worker_id")
);
--> statement-breakpoint
CREATE TABLE "ghost_worker_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" text NOT NULL,
	"worker_id" text,
	"result" text,
	"assigned_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"timeout_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ghost_worker_tasks_task_id_unique" UNIQUE("task_id")
);
--> statement-breakpoint
CREATE TABLE "agent_domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_name" text NOT NULL,
	"domain" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"contribution_count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "agent_domain_unique" UNIQUE("agent_name","domain")
);
--> statement-breakpoint
CREATE TABLE "agent_relay_paths" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_name" text NOT NULL,
	"relay_path" text NOT NULL,
	"asn_count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_relay_unique" UNIQUE("agent_name","relay_path")
);
--> statement-breakpoint
CREATE TABLE "network_agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"endpoint" text,
	"trust_score" real DEFAULT 0 NOT NULL,
	"phase" text DEFAULT 'observer' NOT NULL,
	"phase_started_at" timestamp with time zone DEFAULT now(),
	"unique_domains" integer DEFAULT 0 NOT NULL,
	"domain_score" real DEFAULT 0 NOT NULL,
	"submissions_count" integer DEFAULT 0 NOT NULL,
	"ratified_count" integer DEFAULT 0 NOT NULL,
	"accuracy_score" real DEFAULT 0 NOT NULL,
	"unique_relay_paths" integer DEFAULT 0 NOT NULL,
	"topology_score" real DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now(),
	"age_multiplier" real DEFAULT 0 NOT NULL,
	"total_contributions" integer DEFAULT 0 NOT NULL,
	"total_reinforcements" integer DEFAULT 0 NOT NULL,
	"days_active" integer DEFAULT 0 NOT NULL,
	"is_self" boolean DEFAULT false NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "network_agents_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "network_neurons" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'fact' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"reinforcement_count" integer DEFAULT 0 NOT NULL,
	"decay_count" integer DEFAULT 0 NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"is_core" boolean DEFAULT false NOT NULL,
	"source_agent" text DEFAULT 'self' NOT NULL,
	"tokens" text[] DEFAULT '{}' NOT NULL,
	"last_reinforced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_ratified" boolean DEFAULT false NOT NULL,
	"ratified_at" timestamp with time zone,
	"ratification_quorum" integer DEFAULT 0 NOT NULL,
	"positive_votes" integer DEFAULT 0 NOT NULL,
	"negative_votes" integer DEFAULT 0 NOT NULL,
	"vote_score" real DEFAULT 0 NOT NULL,
	"weighted_vote_score" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "network_pulses" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_name" text DEFAULT 'self' NOT NULL,
	"event_type" text NOT NULL,
	"neurons_affected" integer DEFAULT 0 NOT NULL,
	"synapses_affected" integer DEFAULT 0 NOT NULL,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "network_synapses" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"weight" real DEFAULT 0.5 NOT NULL,
	"synapse_type" text DEFAULT 'co-occurs' NOT NULL,
	"activation_count" integer DEFAULT 1 NOT NULL,
	"last_activated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "net_synapse_pair" UNIQUE("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "network_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"neuron_id" integer NOT NULL,
	"agent_name" text NOT NULL,
	"vote" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"agent_trust_score" real DEFAULT 0 NOT NULL,
	"agent_phase" text DEFAULT 'observer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "net_vote_unique" UNIQUE("neuron_id","agent_name")
);
--> statement-breakpoint
CREATE TABLE "hebbian_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposer_id" text DEFAULT 'local' NOT NULL,
	"node_a_id" integer NOT NULL,
	"node_b_id" integer NOT NULL,
	"edge_type" text NOT NULL,
	"evidence_text" text NOT NULL,
	"evidence_hash" text NOT NULL,
	"proposal_proof" text NOT NULL,
	"delta_weight" real DEFAULT 0.1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"validation_count" integer DEFAULT 0 NOT NULL,
	"rejection_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ontology_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"node_type" text DEFAULT 'edge-vocab' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ontology_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"op_type" text NOT NULL,
	"target_node_id" integer,
	"target_node_b_id" integer,
	"proposed_edge_type" text,
	"proposed_content" text,
	"rationale" text NOT NULL,
	"rationale_hash" text NOT NULL,
	"proposal_proof" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_domains" ADD CONSTRAINT "agent_domains_agent_name_network_agents_name_fk" FOREIGN KEY ("agent_name") REFERENCES "public"."network_agents"("name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_relay_paths" ADD CONSTRAINT "agent_relay_paths_agent_name_network_agents_name_fk" FOREIGN KEY ("agent_name") REFERENCES "public"."network_agents"("name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_synapses" ADD CONSTRAINT "network_synapses_source_id_network_neurons_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."network_neurons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_synapses" ADD CONSTRAINT "network_synapses_target_id_network_neurons_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."network_neurons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_votes" ADD CONSTRAINT "network_votes_neuron_id_network_neurons_id_fk" FOREIGN KEY ("neuron_id") REFERENCES "public"."network_neurons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_votes" ADD CONSTRAINT "network_votes_agent_name_network_agents_name_fk" FOREIGN KEY ("agent_name") REFERENCES "public"."network_agents"("name") ON DELETE cascade ON UPDATE no action;