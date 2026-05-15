import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── OntologyNode — describes the graph's own structure ─────────────────────
// nodeType:
//   "edge-vocab"       vocabulary entry — a named, recognised edge relationship
//   "structural-rule"  a constraint on how nodes may connect
//   "constraint"       a hard invariant (e.g. "a node cannot be both X and Y")

export const ontologyNodes = pgTable("ontology_nodes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  nodeType: text("node_type").notNull().default("edge-vocab"),
  payload: jsonb("payload").notNull().default({}),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const insertOntologyNodeSchema = createInsertSchema(ontologyNodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type OntologyNode = typeof ontologyNodes.$inferSelect;
export type InsertOntologyNode = z.infer<typeof insertOntologyNodeSchema>;

// ── OntologyProposal — a meta-operation on the graph's structure ────────────
// opType:
//   "new-edge-type"  register a previously-unknown edge relationship
//   "split-node"     split one concept into two more specific nodes
//   "merge-nodes"    merge two near-identical nodes into one
//   "demote-rule"    lower node.type from "rule" to "fact"

export const ontologyProposals = pgTable("ontology_proposals", {
  id: serial("id").primaryKey(),
  opType: text("op_type").notNull(),

  targetNodeId: integer("target_node_id"),
  targetNodeBId: integer("target_node_b_id"),

  proposedEdgeType: text("proposed_edge_type"),
  proposedContent: text("proposed_content"),

  rationale: text("rationale").notNull(),
  rationaleHash: text("rationale_hash").notNull(),
  proposalProof: text("proposal_proof").notNull(),

  status: text("status").notNull().default("pending"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const insertOntologyProposalSchema = createInsertSchema(
  ontologyProposals,
).omit({
  id: true,
  createdAt: true,
  executedAt: true,
  status: true,
});
export type OntologyProposal = typeof ontologyProposals.$inferSelect;
export type InsertOntologyProposal = z.infer<
  typeof insertOntologyProposalSchema
>;
