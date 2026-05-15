import {
  pgTable,
  serial,
  text,
  real,
  integer,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  // Ratification tracking (quorum-based validation)
  isRatified: boolean("is_ratified").notNull().default(false),
  ratifiedAt: timestamp("ratified_at", { withTimezone: true }),
  ratificationQuorum: integer("ratification_quorum").notNull().default(0),

  // Voting system (weighted by agent reputation)
  positiveVotes: integer("positive_votes").notNull().default(0),
  negativeVotes: integer("negative_votes").notNull().default(0),
  voteScore: real("vote_score").notNull().default(0.0),
  weightedVoteScore: real("weighted_vote_score").notNull().default(0.0),
});

export const networkSynapses = pgTable(
  "network_synapses",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => networkNeurons.id, { onDelete: "cascade" }),
    targetId: integer("target_id")
      .notNull()
      .references(() => networkNeurons.id, { onDelete: "cascade" }),
    weight: real("weight").notNull().default(0.5),
    synapseType: text("synapse_type").notNull().default("co-occurs"),
    activationCount: integer("activation_count").notNull().default(1),
    lastActivatedAt: timestamp("last_activated_at", {
      withTimezone: true,
    }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    uniquePair: unique("net_synapse_pair").on(t.sourceId, t.targetId),
  }),
);

// Reputation-based trust system with sybil resistance
// Trust is earned through real work over time, not just calendar days

export const networkAgents = pgTable("network_agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  endpoint: text("endpoint"),

  // Trust score (0.0 - 1.0) - calculated from component scores
  trustScore: real("trust_score").notNull().default(0.0),

  // Phase tracking (Observer → Probationary → Voting Member)
  phase: text("phase").notNull().default("observer"), // observer, probationary, voting_member
  phaseStartedAt: timestamp("phase_started_at", {
    withTimezone: true,
  }).defaultNow(),

  // Domain diversity score (x0.40 weight)
  uniqueDomains: integer("unique_domains").notNull().default(0),
  domainScore: real("domain_score").notNull().default(0.0),

  // Accuracy score (x0.40 weight) - ratified vs submitted
  submissionsCount: integer("submissions_count").notNull().default(0),
  ratifiedCount: integer("ratified_count").notNull().default(0),
  accuracyScore: real("accuracy_score").notNull().default(0.0),

  // Topology diversity score (x0.20 weight)
  uniqueRelayPaths: integer("unique_relay_paths").notNull().default(0),
  topologyScore: real("topology_score").notNull().default(0.0),

  // Age multiplier (calendar days active / 90)
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow(),
  ageMultiplier: real("age_multiplier").notNull().default(0.0),

  // Activity tracking
  totalContributions: integer("total_contributions").notNull().default(0),
  totalReinforcements: integer("total_reinforcements").notNull().default(0),
  daysActive: integer("days_active").notNull().default(0),

  isSelf: boolean("is_self").notNull().default(false),
  lastActiveAt: timestamp("last_active_at", {
    withTimezone: true,
  }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const networkPulses = pgTable("network_pulses", {
  id: serial("id").primaryKey(),
  agentName: text("agent_name").notNull().default("self"),
  eventType: text("event_type").notNull(),
  neuronsAffected: integer("neurons_affected").notNull().default(0),
  synapsesAffected: integer("synapses_affected").notNull().default(0),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Track individual votes on neurons (for weighted voting)
export const networkVotes = pgTable(
  "network_votes",
  {
    id: serial("id").primaryKey(),
    neuronId: integer("neuron_id")
      .notNull()
      .references(() => networkNeurons.id, { onDelete: "cascade" }),
    agentName: text("agent_name")
      .notNull()
      .references(() => networkAgents.name, { onDelete: "cascade" }),
    vote: text("vote").notNull(), // "up" or "down"
    weight: real("weight").notNull().default(1.0), // Agent's voting weight at time of vote
    agentTrustScore: real("agent_trust_score").notNull().default(0.0),
    agentPhase: text("agent_phase").notNull().default("observer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    uniqueVote: unique("net_vote_unique").on(t.neuronId, t.agentName),
  }),
);

// Track domain diversity per agent (for sybil resistance)
export const agentDomains = pgTable(
  "agent_domains",
  {
    id: serial("id").primaryKey(),
    agentName: text("agent_name")
      .notNull()
      .references(() => networkAgents.name, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    contributionCount: integer("contribution_count").notNull().default(1),
  },
  (t) => ({
    uniqueDomain: unique("agent_domain_unique").on(t.agentName, t.domain),
  }),
);

// Track relay paths (topology diversity)
export const agentRelayPaths = pgTable(
  "agent_relay_paths",
  {
    id: serial("id").primaryKey(),
    agentName: text("agent_name")
      .notNull()
      .references(() => networkAgents.name, { onDelete: "cascade" }),
    relayPath: text("relay_path").notNull(), // e.g., "AS12345->AS67890->AS11111"
    asnCount: integer("asn_count").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    uniquePath: unique("agent_relay_unique").on(t.agentName, t.relayPath),
  }),
);

export type NetworkNeuron = typeof networkNeurons.$inferSelect;
export type NetworkSynapse = typeof networkSynapses.$inferSelect;
export type NetworkAgent = typeof networkAgents.$inferSelect;
export type NetworkPulse = typeof networkPulses.$inferSelect;
