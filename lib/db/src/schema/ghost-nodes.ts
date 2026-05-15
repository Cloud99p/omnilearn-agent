import {
  pgTable,
  serial,
  text,
  real,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ghostNodes = pgTable("ghost_nodes", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id"),
  name: text("name").notNull(),
  endpoint: text("endpoint").notNull(),
  secretKey: text("secret_key").notNull(),
  region: text("region").notNull().default("unknown"),
  status: text("status").notNull().default("unknown"),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  tasksProcessed: integer("tasks_processed").notNull().default(0),
  tasksFailed: integer("tasks_failed").notNull().default(0),
  avgResponseMs: real("avg_response_ms"),
  isSelf: boolean("is_self").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const insertGhostNodeSchema = createInsertSchema(ghostNodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type GhostNode = typeof ghostNodes.$inferSelect;
export type InsertGhostNode = z.infer<typeof insertGhostNodeSchema>;
