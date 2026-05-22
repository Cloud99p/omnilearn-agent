/**
 * Weekly Chat Pattern Analysis
 * Analyzes conversation patterns to identify:
 * - Common query types and topics
 * - Knowledge gaps
 * - Successful response patterns
 * - Character state evolution
 */

import { db } from "@workspace/db";
import { chatPatterns, conversationSummaries } from "@workspace/db/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { extractContext, filterByContext } from "./context-awareness.js";

export async function runWeeklyAnalysis() {
  logger.info("Starting weekly chat pattern analysis...");

  try {
    // Get last 7 days of data
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const patterns = await db
      .select()
      .from(chatPatterns)
      .where(gte(chatPatterns.createdAt, weekAgo))
      .orderBy(desc(chatPatterns.createdAt));

    if (patterns.length === 0) {
      logger.info("No chat patterns found for analysis period");
      return null;
    }

    logger.info(`Analyzing ${patterns.length} chat patterns...`);

    // Aggregate statistics
    const stats = aggregatePatterns(patterns);
    
    // Identify patterns
    const patternInsights = identifyPatterns(patterns);
    
    // Detect knowledge gaps
    const knowledgeGaps = detectKnowledgeGaps(patterns);

    // Create summary
    const summary = {
      weekStart: weekAgo,
      weekEnd: new Date(),
      totalConversations: stats.totalConversations,
      totalTurns: patterns.length,
      avgTurnsPerConversation: stats.avgTurnsPerConversation,
      questionCount: stats.questionCount,
      statementCount: stats.statementCount,
      commandCount: stats.commandCount,
      greetingCount: stats.greetingCount,
      casualCount: stats.casualCount,
      avgNodesRetrieved: stats.avgNodesRetrieved,
      avgSimilarity: stats.avgSimilarity,
      totalNewNodes: stats.totalNewNodes,
      llmFallbackRate: stats.llmFallbackRate,
      avgResponseLength: stats.avgResponseLength,
      topPatterns: patternInsights.topPatterns,
      knowledgeGaps: knowledgeGaps,
      avgCuriosity: stats.avgCuriosity,
      avgConfidence: stats.avgConfidence,
    };

    // Store summary
    const [created] = await db
      .insert(conversationSummaries)
      .values(summary)
      .returning();

    logger.info(`Weekly analysis complete. Summary ID: ${created.id}`);
    logger.info(`Conversations: ${summary.totalConversations}, Turns: ${summary.totalTurns}`);
    logger.info(`Query types: ${summary.questionCount} questions, ${summary.greetingCount} greetings, ${summary.casualCount} casual`);
    logger.info(`Knowledge gaps detected: ${summary.knowledgeGaps?.length || 0}`);

    return summary;
  } catch (err) {
    logger.error({ err }, "Weekly analysis failed");
    throw err;
  }
}

function aggregatePatterns(patterns: Array<typeof chatPatterns.$inferSelect>) {
  const conversations = new Set<number>();
  const queryTypes: Record<string, number> = {};
  let totalNodesRetrieved = 0;
  let totalSimilarity = 0;
  let totalNewNodes = 0;
  let totalLLM = 0;
  let totalResponseLength = 0;
  let totalCuriosity = 0;
  let totalConfidence = 0;

  for (const pattern of patterns) {
    conversations.add(pattern.conversationId);
    
    // Query type counts
    queryTypes[pattern.queryType || "question"] = (queryTypes[pattern.queryType || "question"] || 0) + 1;
    
    // Retrieval stats
    totalNodesRetrieved += pattern.nodesRetrieved || 0;
    if (pattern.avgSimilarity) totalSimilarity += pattern.avgSimilarity;
    
    // Learning stats
    totalNewNodes += pattern.newNodesAdded || 0;
    
    // Response stats
    if (pattern.useLLM) totalLLM++;
    totalResponseLength += pattern.responseLength || 0;
  }

  const totalConversations = conversations.size;
  const totalTurns = patterns.length;

  // Character state from chat patterns (would need to be stored in the pattern table)
  // For now, we'll use placeholder values
  const avgCuriosity = 50;
  const avgConfidence = 50;

  return {
    totalConversations,
    avgTurnsPerConversation: totalConversations > 0 ? totalTurns / totalConversations : 0,
    questionCount: queryTypes["question"] || 0,
    statementCount: queryTypes["statement"] || 0,
    commandCount: queryTypes["command"] || 0,
    greetingCount: queryTypes["greeting"] || 0,
    casualCount: queryTypes["casual"] || 0,
    avgNodesRetrieved: totalConversations > 0 ? totalNodesRetrieved / totalConversations : 0,
    avgSimilarity: totalSimilarity / totalTurns,
    totalNewNodes,
    llmFallbackRate: totalTurns > 0 ? totalLLM / totalTurns : 0,
    avgResponseLength: totalTurns > 0 ? totalResponseLength / totalTurns : 0,
    avgCuriosity,
    avgConfidence,
  };
}

function identifyPatterns(patterns: Array<typeof chatPatterns.$inferSelect>) {
  // Group patterns by query type and preceding context
  const patternGroups: Record<string, Array<typeof patterns[0]>> = {};

  for (const pattern of patterns) {
    let key = pattern.queryType || "question";
    
    // Add context-based grouping
    if (pattern.precedingContext && pattern.precedingContext.length > 0) {
      const lastContext = pattern.precedingContext[pattern.precedingContext.length - 1];
      if (lastContext.role === "assistant") {
        key += "_follow_up";
      }
    }

    if (!patternGroups[key]) {
      patternGroups[key] = [];
    }
    patternGroups[key].push(pattern);
  }

  // Extract top patterns
  const topPatterns = Object.entries(patternGroups)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([type, group]) => ({
      type,
      count: group.length,
      examples: group.slice(0, 3).map(p => p.query.slice(0, 100)),
    }));

  return { topPatterns };
}

function detectKnowledgeGaps(patterns: Array<typeof chatPatterns.$inferSelect>) {
  // Find queries where retrieval returned low similarity or no nodes
  const lowSimilarityQueries = patterns.filter(
    p => (p.avgSimilarity || 0) < 0.15 || p.nodesRetrieved === 0
  );

  // Group by topic (simple keyword extraction)
  const topicGroups: Record<string, Array<typeof patterns[0]>> = {};

  for (const pattern of lowSimilarityQueries) {
    // Extract keywords from query
    const keywords = pattern.query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4)
      .slice(0, 3)
      .join("_");

    if (!topicGroups[keywords]) {
      topicGroups[keywords] = [];
    }
    topicGroups[keywords].push(pattern);
  }

  // Convert to knowledge gaps
  const knowledgeGaps = Object.entries(topicGroups)
    .filter(([, group]) => group.length >= 2) // Only gaps with multiple queries
    .map(([topic, group]) => ({
      topic,
      queryCount: group.length,
      sampleQueries: group.slice(0, 5).map(p => p.query),
    }))
    .sort((a, b) => b.queryCount - a.queryCount)
    .slice(0, 10); // Top 10 knowledge gaps

  return knowledgeGaps;
}

export default runWeeklyAnalysis;
