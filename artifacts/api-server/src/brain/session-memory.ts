/**
 * Session Memory for OmniLearn
 * Extracts and permanently stores facts from conversations
 * Aligned with "never forgets" principle: facts stored permanently, transcripts discarded
 */

import { extractFacts } from './extractor.js';
import { logger } from '../lib/logger.js';

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface SessionConfig {
  enabled: boolean;
  extractFacts: boolean;
  storeTranscript: boolean; // Should be false for privacy (aligned with "never forgets")
  minFactConfidence: number;
}

const DEFAULT_CONFIG: SessionConfig = {
  enabled: true,
  extractFacts: true,
  storeTranscript: false, // Privacy: don't store raw transcripts
  minFactConfidence: 0.6,
};

/**
 * Extract facts from a conversation session
 * 
 * @param messages - Conversation messages
 * @param config - Session memory configuration
 * @returns Extracted facts ready for storage
 */
export function extractFactsFromSession(
  messages: SessionMessage[],
  config: SessionConfig = DEFAULT_CONFIG
): Array<{
  content: string;
  type: string;
  tags: string[];
  confidence: number;
  source: string;
}> {
  if (!config.enabled || !config.extractFacts) {
    return [];
  }
  
  const facts: Array<{
    content: string;
    type: string;
    tags: string[];
    confidence: number;
    source: string;
  }> = [];
  
  // Process each message
  for (const message of messages) {
    // Skip low-content messages
    if (message.content.length < 20) continue;
    
    // Extract facts from message content
    const extractedFacts = extractFacts(message.content);
    
    for (const fact of extractedFacts) {
      // Filter by confidence threshold
      if (fact.confidence < config.minFactConfidence) {
        logger.debug(
          { fact: fact.content.slice(0, 50), confidence: fact.confidence },
          'Fact below confidence threshold, skipping'
        );
        continue;
      }
      
      // Add to session facts
      facts.push({
        content: fact.content,
        type: fact.type,
        tags: fact.tags,
        confidence: fact.confidence,
        source: `session:${message.role}`,
      });
    }
  }
  
  logger.info(
    { messageCount: messages.length, extractedFactCount: facts.length },
    'Extracted facts from session'
  );
  
  return facts;
}

/**
 * Detect if a message contains learnable knowledge
 */
export function isLearnableMessage(content: string): boolean {
  // Indicators of factual content
  const factualPatterns = [
    /\b(is|are|was|were|has|have|had|does|do|did)\b/i,
    /\b(means|refers to|stands for)\b/i,
    /\b(can|could|enables|allows|must|should)\b/i,
    /\b(causes|leads to|results in|produces)\b/i,
    /\b(uses|employs|relies on|requires)\b/i,
    /\b(consists of|contains|includes|has)\b/i,
    /\b(was designed|built|created|developed)\b/i,
    /\b(works|operates|functions|runs)\b/i,
  ];
  
  // Indicators of non-learnable content
  const nonLearnablePatterns = [
    /\?$/, // Questions
    /^(explain|show|tell|give|help|teach|describe)/i, // Commands
    /^(hello|hi|hey|thanks|thank you|please)/i, // Greetings
    /^(ok|okay|sure|yes|no|good|great|awesome)/i, // Responses
    /i (don't|do not) understand/i, // Confusion
    /can you (explain|clarify|help)/i, // Requests
  ];
  
  // Check if non-learnable
  if (nonLearnablePatterns.some(p => p.test(content))) {
    return false;
  }
  
  // Check if factual
  return factualPatterns.some(p => p.test(content));
}

/**
 * Get session summary for user-facing display
 */
export function getSessionSummary(messages: SessionMessage[]): {
  messageCount: number;
  userMessages: number;
  assistantMessages: number;
  learnableMessages: number;
  duration: string;
} {
  const userMessages = messages.filter(m => m.role === 'user').length;
  const assistantMessages = messages.filter(m => m.role === 'assistant').length;
  const learnableMessages = messages.filter(m => isLearnableMessage(m.content)).length;
  
  const startTime = messages[0]?.timestamp ?? Date.now();
  const endTime = messages[messages.length - 1]?.timestamp ?? Date.now();
  const durationMs = endTime - startTime;
  const durationMin = Math.floor(durationMs / (1000 * 60));
  
  return {
    messageCount: messages.length,
    userMessages,
    assistantMessages,
    learnableMessages,
    duration: durationMin < 1 ? '< 1 min' : `${durationMin} min`,
  };
}

/**
 * Phase 2 improvement: Sync session to permanent memory
 * 
 * Usage in API route:
 * ```typescript
 * const facts = extractFactsFromSession(messages);
 * for (const fact of facts) {
 *   await insertNode(fact.content, fact.type, fact.tags, fact.confidence, fact.source, clerkId);
 * }
 * ```
 */
export async function syncSessionToMemory(
  sessionId: string,
  messages: SessionMessage[],
  clerkId: string | null,
  insertNodeFn: (
    content: string,
    type: string,
    tags: string[],
    confidence: number,
    source: string,
    clerkId: string | null
  ) => Promise<void>,
  config: SessionConfig = DEFAULT_CONFIG
): Promise<{
  factsStored: number;
  sessionId: string;
}> {
  if (!config.enabled) {
    return { factsStored: 0, sessionId };
  }
  
  logger.info(
    { sessionId, messageCount: messages.length, clerkId },
    'Syncing session to memory'
  );
  
  // Extract facts from session
  const facts = extractFactsFromSession(messages, config);
  
  // Store each fact permanently (aligned with "never forgets")
  let storedCount = 0;
  for (const fact of facts) {
    try {
      await insertNodeFn(
        fact.content,
        fact.type,
        fact.tags,
        fact.confidence,
        `${fact.source}:${sessionId}`,
        clerkId
      );
      storedCount++;
    } catch (err) {
      logger.warn(
        { err, fact: fact.content.slice(0, 50) },
        'Failed to store session fact'
      );
    }
  }
  
  logger.info(
    { sessionId, factsExtracted: facts.length, factsStored: storedCount },
    'Session synced to memory'
  );
  
  return {
    factsStored: storedCount,
    sessionId,
  };
}
