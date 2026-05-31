import { pgTable, serial, text, integer, timestamp, } from "drizzle-orm/pg-core";
export const knowledgeSyncLog = pgTable("knowledge_sync_log", {
    id: serial("id").primaryKey(),
    nodeId: text("node_id").notNull(),
    knowledgeNodeId: integer("knowledge_node_id").references(() => require("./knowledge-nodes").knowledgeNodes.id),
    syncDirection: text("sync_direction").notNull(), // 'inbound' | 'outbound'
    syncStatus: text("sync_status").notNull().default("pending"), // 'pending' | 'synced' | 'rejected' | 'conflict' | 'failed'
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow(),
    clusterId: text("cluster_id"),
    errorMessage: text("error_message"),
    sourceNodeId: text("source_node_id"),
});
