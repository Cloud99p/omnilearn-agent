import { integer, pgTable, serial, text, timestamp, boolean, jsonb, real, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * ChatPattern - Stores conversation patterns for weekly analysis
 * Captures context, not just individual queries
 */
export const chatPatterns = pgTable("chat_patterns", {
  id: serial("id").primaryKey(),
  
  // Conversation metadata
  conversationId: integer("conversation_id").notNull(),
  
  // Turn tracking
  turnNumber: integer("turn_number").notNull(), // Which turn in the conversation
  
  // Query context
  query: text("query").notNull(),
  queryType: varchar("query_type", { enum: ["question", "statement", "command", "greeting", "casual"] }).default("question"),
  
  // Context window (last N turns before this query)
  precedingContext: jsonb("preceding_context").$type<Array<{ role: string; content: string }>>(),
  
  // Retrieval metadata
  nodesRetrieved: integer("nodes_retrieved").default(0),
  avgSimilarity: real("avg_similarity"),
  topNodeContent: text("top_node_content"),
  
  // Response metadata
  responseLength: integer("response_length").default(0),
  nodesUsed: integer("nodes_used").default(0),
  newNodesAdded: integer("new_nodes_added").default(0),
  useLLM: boolean("use_llm").default(false),
  
  // Engagement signals
  userReplied: boolean("user_replied").default(false),
  timeToNextQueryMs: integer("time_to_next_query_ms"), // Will be populated when next query arrives
  conversationEnd: boolean("conversation_end").default(false),
  
  // Pattern classification (populated by weekly analysis)
  patternType: varchar("pattern_type"), // "learning", "casual", "informational", "follow_up"
  confidence: real("confidence"), // Analysis confidence score
  
  // Timestamp
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertChatPatternSchema = createInsertSchema(chatPatterns).omit({
  id: true,
  createdAt: true,
});

export type ChatPattern = typeof chatPatterns.$inferSelect;
export type InsertChatPattern = z.infer<typeof insertChatPatternSchema>;

/**
 * ConversationSummary - Weekly aggregated conversation summaries
 */
export const conversationSummaries = pgTable("conversation_summaries", {
  id: serial("id").primaryKey(),
  
  // Analysis period
  weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
  weekEnd: timestamp("week_end", { withTimezone: true }).notNull(),
  
  // Conversation stats
  totalConversations: integer("total_conversations").notNull(),
  totalTurns: integer("total_turns").notNull(),
  avgTurnsPerConversation: real("avg_turns_per_conversation"),
  
  // Query type distribution
  questionCount: integer("question_count").default(0),
  statementCount: integer("statement_count").default(0),
  commandCount: integer("command_count").default(0),
  greetingCount: integer("greeting_count").default(0),
  casualCount: integer("casual_count").default(0),
  
  // Knowledge engagement
  avgNodesRetrieved: real("avg_nodes_retrieved"),
  avgSimilarity: real("avg_similarity"),
  totalNewNodes: integer("total_new_nodes").default(0),
  
  // Response quality signals
  llmFallbackRate: real("llm_fallback_rate"), // % of responses that used LLM
  avgResponseLength: real("avg_response_length"),
  
  // Pattern insights (populated by analysis)
  topPatterns: jsonb("top_patterns").$type<Array<{ type: string; count: number; examples: string[] }>>(),
  knowledgeGaps: jsonb("knowledge_gaps").$type<Array<{ topic: string; queryCount: number; sampleQueries: string[] }>>(),
  
  // Character state evolution
  avgCuriosity: real("avg_curiosity"),
  avgConfidence: real("avg_confidence"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertConversationSummarySchema = createInsertSchema(conversationSummaries).omit({
  id: true,
  createdAt: true,
});

export type ConversationSummary = typeof conversationSummaries.$inferSelect;
export type InsertConversationSummary = z.infer<typeof insertConversationSummarySchema>;
