import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hebbianProposals = pgTable("hebbian_proposals", {
  id: serial("id").primaryKey(),

  proposerId: text("proposer_id").notNull().default("local"),

  nodeAId: integer("node_a_id").notNull(),
  nodeBId: integer("node_b_id").notNull(),
  edgeType: text("edge_type").notNull(),

  evidenceText: text("evidence_text").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  proposalProof: text("proposal_proof").notNull(),

  deltaWeight: real("delta_weight").notNull().default(0.1),

  status: text("status").notNull().default("pending"),
  validationCount: integer("validation_count").notNull().default(0),
  rejectionCount: integer("rejection_count").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
});

export const insertHebbianProposalSchema = createInsertSchema(hebbianProposals).omit({
  id: true, createdAt: true, appliedAt: true, validationCount: true, rejectionCount: true, status: true,
});
export type HebbianProposal = typeof hebbianProposals.$inferSelect;
export type InsertHebbianProposal = z.infer<typeof insertHebbianProposalSchema>;
