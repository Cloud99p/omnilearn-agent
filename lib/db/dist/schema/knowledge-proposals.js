import { pgTable, serial, text, integer, timestamp, } from "drizzle-orm/pg-core";
export const knowledgeProposals = pgTable("knowledge_proposals", {
    id: serial("id").primaryKey(),
    knowledgeNodeId: integer("knowledge_node_id").references(() => require("./knowledge-nodes").knowledgeNodes.id),
    proposedByNodeId: text("proposed_by_node_id").notNull(),
    proposalType: text("proposal_type").notNull(), // 'new' | 'update' | 'delete'
    votesFor: integer("votes_for").default(0),
    votesAgainst: integer("votes_against").default(0),
    status: text("status").default("pending"), // 'pending' | 'ratified' | 'rejected'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    clusterId: text("cluster_id").notNull(),
});
