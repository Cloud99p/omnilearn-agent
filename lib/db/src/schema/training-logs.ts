import { integer, pgTable, serial, text, timestamp, boolean, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trainingLogs = pgTable("training_logs", {
  id: serial("id").primaryKey(),
  // Query and context
  query: text("query").notNull(),
  retrievedNodes: jsonb("retrieved_nodes").$type<Array<{ content: string; similarity: number }>>(),
  
  // Response data
  responseType: text("response_type").notNull(), // 'native', 'llm', 'hybrid'
  nativeResponse: text("native_response"),
  llmResponse: text("llm_response"),
  finalResponse: text("final_response").notNull(),
  
  // Metadata
  nodesUsed: integer("nodes_used").default(0),
  avgSimilarity: real("avg_similarity"),
  characterState: jsonb("character_state").$type<{ curiosity: number; confidence: number; technical: number; empathy: number; creativity: number; verbosity: number }>(),
  
  // User engagement tracking
  conversationId: integer("conversation_id"),
  userReplied: boolean("user_replied").default(false),
  followUpQuery: text("follow_up_query"),
  conversationTurns: integer("conversation_turns").default(1),
  
  // Quality signals
  llmScore: real("llm_score"), // LLM self-score 1-10 if requested
  
  // Timestamp (must be at top level, not nested)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertTrainingLogSchema = createInsertSchema(trainingLogs).omit({
  id: true,
  createdAt: true,
});

export type TrainingLog = typeof trainingLogs.$inferSelect;
export type InsertTrainingLog = z.infer<typeof insertTrainingLogSchema>;
