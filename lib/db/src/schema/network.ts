import { pgTable, serial, text, real, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";

export const networkNeurons = pgTable("network_neurons", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  type: text("type").notNull().default("fact"),
  tags: text("tags").array().notNull().default([]),
  weight: real("weight").notNull().default(1.0),
  reinforcementCount: integer("reinforcement_count").notNull().default(0),
  decayCount: integer("decay_count").notNull().default(0),
  accessCount: integer("access_count").notNull().default(0),
  isCore: boolean("is_core").notNull().default(false),
  sourceAgent: text("source_agent").notNull().default("self"),
  tokens: text("tokens").array().notNull().default([]),
  lastReinforcedAt: timestamp("last_reinforced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  
  // Probation period for new neurons from external agents
  probationUntil: timestamp("probation_until", { withTimezone: true }),
  isProbation: boolean("is_probation").notNull().default(true),
  
  // Voting system
  positiveVotes: integer("positive_votes").notNull().default(0),
  negativeVotes: integer("negative_votes").notNull().default(0),
  voteScore: real("vote_score").notNull().default(0.0),
});

export const networkSynapses = pgTable("network_synapses", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull().references(() => networkNeurons.id, { onDelete: "cascade" }),
  targetId: integer("target_id").notNull().references(() => networkNeurons.id, { onDelete: "cascade" }),
  weight: real("weight").notNull().default(0.5),
  synapseType: text("synapse_type").notNull().default("co-occurs"),
  activationCount: integer("activation_count").notNull().default(1),
  lastActivatedAt: timestamp("last_activated_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniquePair: unique("net_synapse_pair").on(t.sourceId, t.targetId),
}));

export const networkAgents = pgTable("network_agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  endpoint: text("endpoint"),
  trustScore: real("trust_score").notNull().default(0.5),
  totalContributions: integer("total_contributions").notNull().default(0),
  totalReinforcements: integer("total_reinforcements").notNull().default(0),
  isSelf: boolean("is_self").notNull().default(false),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const networkPulses = pgTable("network_pulses", {
  id: serial("id").primaryKey(),
  agentName: text("agent_name").notNull().default("self"),
  eventType: text("event_type").notNull(),
  neuronsAffected: integer("neurons_affected").notNull().default(0),
  synapsesAffected: integer("synapses_affected").notNull().default(0),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type NetworkNeuron = typeof networkNeurons.$inferSelect;
export type NetworkSynapse = typeof networkSynapses.$inferSelect;
export type NetworkAgent = typeof networkAgents.$inferSelect;
export type NetworkPulse = typeof networkPulses.$inferSelect;
