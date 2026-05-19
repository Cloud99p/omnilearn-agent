/**
 * Context Awareness Module
 * Uses conversation history to maintain coherence in long conversations
 * Prevents going off-topic, repeating info, or giving irrelevant responses
 */

import { logger } from "../lib/logger.js";

export interface ConversationContext {
  currentTopic: string | null;
  topicTurns: number; // How long we've been on this topic
  recentQueries: string[]; // Last 5 queries
  mentionedEntities: Set<string>; // People, places, things discussed
  lastResponseType: "casual" | "factual" | "emotional" | "safety";
  hasFollowUp: boolean; // Is current query a follow-up to previous?
  contextRelevance: number; // 0-1 score of how related current query is to history
}

/**
 * Extract context from conversation history
 */
export function extractContext(
  query: string,
  history: Array<{ role: string; content: string }>,
): ConversationContext {
  const last5UserMessages = history
    .filter((m) => m.role === "user")
    .slice(-5)
    .map((m) => m.content.toLowerCase());

  const last5AiMessages = history
    .filter((m) => m.role === "assistant")
    .slice(-5)
    .map((m) => m.content.toLowerCase());

  // Detect if this is a follow-up question
  const followUpIndicators = [
    /^and /,
    /^what about /,
    /^how about /,
    /^but /,
    /^so /,
    /^then /,
    /^also /,
    /^actually /,
    /^wait /,
    /^really\??$/i,
    /^why\??$/i,
    /^how come\??$/i,
    /^tell me more/i,
    /^explain/i,
    /^what (else|other)/i,
    /^any (other|more)/i,
  ];

  const isFollowUp = followUpIndicators.some((p) => p.test(query.toLowerCase()));

  // Extract entities (simple: proper nouns, countries, numbers)
  const entities = new Set<string>();
  const allText = [...last5UserMessages, ...last5AiMessages].join(" ");
  
  // Country/entity patterns
  const countryPattern = /\b(nigeria|usa|uk|india|ghana|kenya|canada|australia|germany|france|japan|china|brazil|south africa|egypt|ethiopia|tanzania|uganda|mexico|argentina|colombia|chile|spain|italy|russia|south korea|indonesia|pakistan|bangladesh|philippines|vietnam|thailand|saudi arabia|iran|turkey|israel|uae|new zealand)\b/gi;
  const matches = allText.match(countryPattern);
  if (matches) matches.forEach((m) => entities.add(m.toLowerCase()));

  // Numbers (for states, populations, etc.)
  const numberPattern = /\b\d+\b/g;
  const numbers = allText.match(numberPattern);
  if (numbers) numbers.forEach((n) => entities.add(`num:${n}`));

  // Determine current topic (from recent queries)
  const currentTopic = last5UserMessages.length > 0 
    ? extractTopic(last5UserMessages[last5UserMessages.length - 1])
    : null;

  // Calculate how long we've been on this topic
  const topicTurns = last5UserMessages.filter((q) => 
    extractTopic(q) === currentTopic
  ).length;

  // Calculate context relevance (how related is current query to history?)
  const contextRelevance = calculateRelevance(query, last5UserMessages);

  return {
    currentTopic,
    topicTurns,
    recentQueries: last5UserMessages,
    mentionedEntities: entities,
    lastResponseType: detectLastResponseType(last5AiMessages),
    hasFollowUp: isFollowUp,
    contextRelevance,
  };
}

/**
 * Extract topic from a query
 */
function extractTopic(query: string): string | null {
  const lower = query.toLowerCase();
  
  // Topic keywords
  const topics = [
    "states", "capital", "population", "geography", "history",
    "suicide", "self-harm", "depression", "mental health",
    "identity", "creator", "name", "who are you",
    "greeting", "hello", "hey", "how are you",
    "math", "calculate", "number", "equation",
    "science", "physics", "chemistry", "biology",
    "technology", "computer", "programming", "ai",
    "sports", "football", "basketball", "soccer",
    "music", "movie", "film", "entertainment",
    "food", "recipe", "cooking", "restaurant",
    "travel", "vacation", "holiday", "tourism",
    "weather", "climate", "temperature",
    "politics", "government", "election", "president",
    "economy", "money", "finance", "business",
    "health", "medical", "doctor", "hospital",
    "education", "school", "university", "learning",
    "work", "job", "career", "employment",
    "relationship", "love", "marriage", "family",
    "hobby", "interest", "sport", "game",
  ];

  for (const topic of topics) {
    if (lower.includes(topic)) {
      return topic;
    }
  }

  return null;
}

/**
 * Calculate how relevant current query is to conversation history
 */
function calculateRelevance(
  query: string,
  history: string[],
): number {
  if (history.length === 0) return 0;

  const queryLower = query.toLowerCase();
  const queryWords = new Set(queryLower.split(/\s+/).filter((w) => w.length > 3));

  let maxOverlap = 0;
  for (const prevQuery of history) {
    const prevWords = new Set(prevQuery.split(/\s+/).filter((w) => w.length > 3));
    const overlap = [...queryWords].filter((w) => prevWords.has(w)).length;
    maxOverlap = Math.max(maxOverlap, overlap);
  }

  // Normalize to 0-1
  return Math.min(1, maxOverlap / 5);
}

/**
 * Detect the type of the last AI response
 */
function detectLastResponseType(
  aiMessages: string[],
): "casual" | "factual" | "emotional" | "safety" {
  if (aiMessages.length === 0) return "casual";

  const lastMsg = aiMessages[aiMessages.length - 1];

  if (lastMsg.includes("crisis") || lastMsg.includes("helpline") || lastMsg.includes("reach out for help")) {
    return "safety";
  }

  if (lastMsg.includes("feel") || lastMsg.includes("empathy") || lastMsg.includes("sorry") || lastMsg.includes("💪") || lastMsg.includes("❤️")) {
    return "emotional";
  }

  if (lastMsg.includes("found") || lastMsg.includes("web") || lastMsg.includes("according to") || lastMsg.includes("states") || lastMsg.includes("capital")) {
    return "factual";
  }

  return "casual";
}

/**
 * Check if response should acknowledge previous context
 */
export function shouldAcknowledgeContext(
  query: string,
  context: ConversationContext,
): boolean {
  // Always acknowledge if it's a follow-up
  if (context.hasFollowUp) return true;

  // Acknowledge if we've been on same topic for multiple turns
  if (context.topicTurns >= 2) return true;

  // Acknowledge if high relevance to history
  if (context.contextRelevance >= 0.5) return true;

  // Don't acknowledge for completely new topics
  return false;
}

/**
 * Build context-aware transition phrase
 */
export function buildContextTransition(
  query: string,
  context: ConversationContext,
): string | null {
  if (!shouldAcknowledgeContext(query, context)) {
    return null;
  }

  // If it's a direct follow-up, use smooth transitions
  if (context.hasFollowUp) {
    const transitions = [
      "Building on what we discussed, ",
      "Continuing from earlier, ",
      "As I was saying, ",
      "To add to that, ",
      "Following up, ",
    ];
    return transitions[Math.floor(Math.random() * transitions.length)];
  }

  // If same topic for multiple turns, acknowledge
  if (context.topicTurns >= 2) {
    return `Since we're talking about ${context.currentTopic}, `;
  }

  // If high relevance, subtle acknowledgment
  if (context.contextRelevance >= 0.5) {
    return ""; // No explicit transition, just continue naturally
  }

  return null;
}

/**
 * Filter out irrelevant information based on context
 * Prevents "US has 50 states" appearing in Nigeria conversation
 */
export function filterByContext(
  content: string,
  context: ConversationContext,
): string {
  // If we have mentioned specific countries, filter out others
  if (context.mentionedEntities.size > 0) {
    const countryList = [...context.mentionedEntities].filter((e) => !e.startsWith("num:"));
    
    if (countryList.length > 0) {
      // Check if content mentions a country NOT in our context
      const irrelevantCountries = [
        "united states", "usa", "america",
        "united kingdom", "uk", "britain",
        "canada", "australia", "india",
        "germany", "france", "japan", "china",
      ].filter((country) => 
        content.toLowerCase().includes(country) && 
        !countryList.some((c) => c.includes(country))
      );

      if (irrelevantCountries.length > 0) {
        logger.debug(
          { irrelevantCountries, context: countryList },
          "[CONTEXT] Filtering out irrelevant country mentions"
        );
        // Remove sentences mentioning irrelevant countries
        const sentences = content.split(/[.!?]+/);
        const filtered = sentences.filter((s) => 
          !irrelevantCountries.some((c) => s.toLowerCase().includes(c))
        );
        return filtered.join(". ").trim();
      }
    }
  }

  return content;
}

/**
 * Detect if conversation is going off-topic
 */
export function isOffTopic(
  query: string,
  context: ConversationContext,
): boolean {
  // New topic after long discussion = probably intentional
  if (context.topicTurns < 3) return false;

  // Check if query shares ANY words with recent queries
  const queryWords = new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const recentWords = new Set(context.recentQueries.join(" ").split(/\s+/).filter((w) => w.length > 3));
  
  const overlap = [...queryWords].filter((w) => recentWords.has(w)).length;
  
  // Less than 20% overlap = off-topic
  return overlap < Math.max(1, queryWords.size * 0.2);
}

/**
 * Get summary of conversation context for logging
 */
export function getContextSummary(context: ConversationContext): string {
  return `Topic: ${context.currentTopic || "none"} | Turns: ${context.topicTurns} | Entities: ${[...context.mentionedEntities].join(", ") || "none"} | Follow-up: ${context.hasFollowUp} | Relevance: ${context.contextRelevance.toFixed(2)}`;
}
