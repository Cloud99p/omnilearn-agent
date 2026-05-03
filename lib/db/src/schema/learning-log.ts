import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const learningLog = pgTable("learning_log", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id"),
  event: text("event").notNull(),
  details: text("details").notNull().default(""),
  nodesAdded: real("nodes_added").notNull().default(0),
  source: text("source").notNull().default("conversation"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertLearningLogSchema = createInsertSchema(learningLog).omit({
  id: true, createdAt: true,
});
export type LearningLog = typeof learningLog.$inferSelect;
export type InsertLearningLog = z.infer<typeof insertLearningLogSchema>;
