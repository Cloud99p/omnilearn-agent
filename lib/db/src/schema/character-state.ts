import { pgTable, serial, text, real, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const characterState = pgTable("character_state", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id"),
  curiosity: real("curiosity").notNull().default(50),
  caution: real("caution").notNull().default(40),
  confidence: real("confidence").notNull().default(45),
  verbosity: real("verbosity").notNull().default(50),
  technical: real("technical").notNull().default(55),
  empathy: real("empathy").notNull().default(50),
  creativity: real("creativity").notNull().default(45),
  totalInteractions: integer("total_interactions").notNull().default(0),
  totalKnowledgeNodes: integer("total_knowledge_nodes").notNull().default(0),
  evolutionLog: jsonb("evolution_log").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCharacterStateSchema = createInsertSchema(characterState).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type CharacterState = typeof characterState.$inferSelect;
export type InsertCharacterState = z.infer<typeof insertCharacterStateSchema>;
