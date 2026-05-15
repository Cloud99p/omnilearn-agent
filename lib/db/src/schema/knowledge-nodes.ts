import {
  pgTable,
  serial,
  text,
  real,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const knowledgeNodes = pgTable("knowledge_nodes", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id"),
  content: text("content").notNull(),
  type: text("type").notNull().default("fact"),
  tags: text("tags").array().notNull().default([]),
  source: text("source").notNull().default("conversation"),
  confidence: real("confidence").notNull().default(0.7),
  timesAccessed: integer("times_accessed").notNull().default(0),
  timesConfirmed: integer("times_confirmed").notNull().default(0),
  tfidfVector: jsonb("tfidf_vector").notNull().default({}),
  tokens: text("tokens").array().notNull().default([]),
  embedding: jsonb("embedding").$type<number[]>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const insertKnowledgeNodeSchema = createInsertSchema(
  knowledgeNodes,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type KnowledgeNode = typeof knowledgeNodes.$inferSelect;
export type InsertKnowledgeNode = z.infer<typeof insertKnowledgeNodeSchema>;
