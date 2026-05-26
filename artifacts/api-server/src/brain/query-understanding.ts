/**
 * Query Understanding and Expansion for OmniLearn
 * Improves retrieval quality by better understanding user intent
 * 
 * Features:
 * - Intent classification
 * - Query rewriting
 * - Entity extraction
 * - Context-aware expansion
 */

import { tokenizeAdvanced, expandQuery, extractEntities, STOP_WORDS } from './text-preprocessing.js';

export interface QueryIntent {
  type: 'factual' | 'procedural' | 'exploratory' | 'comparative' | 'definitional' | 'conversational';
  confidence: number;
  entities: Array<{ type: string; value: string }>;
  topics: string[];
  constraints: {
    timeSensitive?: boolean;
    technical?: boolean;
    opinion?: boolean;
  };
}

// Intent classification patterns
const INTENT_PATTERNS: Array<{
  type: QueryIntent['type'];
  patterns: RegExp[];
  weight: number;
}> = [
  {
    type: 'definitional',
    patterns: [
      /\bwhat is (?:a|an|the)?\s*\w+/i,
      /\bdefine\s+\w+/i,
      /\bexplain\s+(?:what|the)\s+\w+/i,
      /\bmeans\s+\w+/i,
    ],
    weight: 0.9,
  },
  {
    type: 'procedural',
    patterns: [
      /\bhow (?:do|does|to)\s+\w+/i,
      /\bwhat are the steps (?:to|for)\s+\w+/i,
      /\bhow can i\s+\w+/i,
      /\bguide (?:to|for)\s+\w+/i,
    ],
    weight: 0.85,
  },
  {
    type: 'comparative',
    patterns: [
      /\b(?:what'?s the )?difference between\s+\w+/i,
      /\bcompare\s+\w+/i,
      /\b(?:which is )?better (?:than)?\s+\w+/i,
      /\bvs\.?\s+\w+/i,
    ],
    weight: 0.9,
  },
  {
    type: 'factual',
    patterns: [
      /\b(?:when|where|who|why)\s+\w+/i,
      /\b(?:is|are|was|were)\s+\w+/i,
      /\b(?:does|do|did)\s+\w+/i,
      /\b(?:has|have|had)\s+\w+/i,
    ],
    weight: 0.8,
  },
  {
    type: 'exploratory',
    patterns: [
      /\btell me (?:about|more about)\s+\w+/i,
      /\bwhat do you know (?:about)?\s*\w*/i,
      /\b(?:give me|show me) (?:an )?(?:overview|summary|introduction) (?:to|of|about)?\s*\w*/i,
      /\b(?:everything|all) (?:about|on)\s+\w+/i,
    ],
    weight: 0.75,
  },
  {
    type: 'conversational',
    patterns: [
      /\b(?:hi|hello|hey|good (?:morning|afternoon|evening))\b/i,
      /\b(?:thanks?|thank you|appreciate)\b/i,
      /\b(?:how are you|how'?s it going)\b/i,
      /\b(?:bye|goodbye|see you)\b/i,
    ],
    weight: 0.95,
  },
];

/**
 * Classify query intent
 */
export function classifyIntent(query: string): QueryIntent {
  const scores: Record<QueryIntent['type'], number> = {
    factual: 0,
    procedural: 0,
    exploratory: 0,
    comparative: 0,
    definitional: 0,
    conversational: 0,
  };
  
  // Score each intent type
  for (const { type, patterns, weight } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        scores[type] += weight;
      }
    }
  }
  
  // Find best match
  let bestType: QueryIntent['type'] = 'factual';
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type as QueryIntent['type'];
    }
  }
  
  // Extract entities
  const entities = extractEntities(query);
  
  // Extract topics (non-stop words)
  const topics = tokenizeAdvanced(query)
    .filter(word => word.length > 3)
    .slice(0, 5);
  
  // Detect constraints
  const constraints = {
    timeSensitive: /\b(today|yesterday|recent|current|latest|new|202\d)\b/i.test(query),
    technical: /\b(api|sdk|algorithm|function|class|interface|database|server)\b/i.test(query),
    opinion: /\b(better|best|good|bad|opinion|think|prefer)\b/i.test(query),
  };
  
  return {
    type: bestType,
    confidence: Math.min(1.0, bestScore),
    entities,
    topics,
    constraints,
  };
}

/**
 * Rewrite query for better retrieval
 * - Fix typos (simple)
 * - Expand abbreviations
 * - Normalize phrasing
 */
export function rewriteQuery(query: string): string {
  let rewritten = query;
  
  // Abbreviation expansion
  const abbreviations: Record<string, string> = {
    'ai': 'artificial intelligence',
    'ml': 'machine learning',
    'dl': 'deep learning',
    'nlp': 'natural language processing',
    'cv': 'computer vision',
    'rl': 'reinforcement learning',
    'llm': 'large language model',
    'nn': 'neural network',
    'api': 'application programming interface',
    'sdk': 'software development kit',
    'db': 'database',
    'sql': 'structured query language',
    'http': 'hypertext transfer protocol',
    'json': 'javascript object notation',
  };
  
  for (const [abbr, full] of Object.entries(abbreviations)) {
    // Replace whole word only
    const pattern = new RegExp(`\\b${abbr}\\b`, 'gi');
    rewritten = rewritten.replace(pattern, full);
  }
  
  // Normalize common phrasings
  const normalizations: Array<[RegExp, string]> = [
    [/what'?s/gi, 'what is'],
    [/how'?s/gi, 'how is'],
    [/where'?s/gi, 'where is'],
    [/when'?s/gi, 'when is'],
    [/who'?s/gi, 'who is'],
    [/why'?s/gi, 'why is'],
    [/it'?s/gi, 'it is'],
    [/that'?s/gi, 'that is'],
    [/there'?s/gi, 'there is'],
    [/don'?t/gi, 'do not'],
    [/doesn'?t/gi, 'does not'],
    [/didn'?t/gi, 'did not'],
    [/won'?t/gi, 'will not'],
    [/can'?t/gi, 'cannot'],
    [/isn'?t/gi, 'is not'],
    [/aren'?t/gi, 'are not'],
    [/wasn'?t/gi, 'was not'],
    [/weren'?t/gi, 'were not'],
    [/hasn'?t/gi, 'has not'],
    [/haven'?t/gi, 'have not'],
    [/hadn'?t/gi, 'had not'],
    [/wouldn'?t/gi, 'would not'],
    [/couldn'?t/gi, 'could not'],
    [/shouldn'?t/gi, 'should not'],
  ];
  
  for (const [pattern, replacement] of normalizations) {
    rewritten = rewritten.replace(pattern, replacement);
  }
  
  return rewritten;
}

/**
 * Generate query variants for better recall
 */
export function generateQueryVariants(
  query: string,
  intent: QueryIntent
): string[] {
  const variants: string[] = [query];
  
  // Add expanded query
  const expanded = expandQuery(query);
  if (expanded !== query) {
    variants.push(expanded);
  }
  
  // Add rewritten query
  const rewritten = rewriteQuery(query);
  if (rewritten !== query) {
    variants.push(rewritten);
  }
  
  // Add intent-specific variants
  switch (intent.type) {
    case 'definitional':
      // Add "definition of X" variant
      const definitionVariant = `definition of ${intent.topics.join(' ')}`;
      variants.push(definitionVariant);
      break;
      
    case 'procedural':
      // Add "how to X" variant
      const proceduralVariant = `how to ${intent.topics.join(' ')}`;
      variants.push(proceduralVariant);
      break;
      
    case 'comparative':
      // Add "X vs Y" variant
      if (intent.entities.length >= 2) {
        const compareVariant = `${intent.entities[0].value} vs ${intent.entities[1].value}`;
        variants.push(compareVariant);
      }
      break;
      
    case 'exploratory':
      // Add broad variant
      const broadVariant = `overview of ${intent.topics.join(' ')}`;
      variants.push(broadVariant);
      break;
  }
  
  // Remove duplicates
  return [...new Set(variants)];
}

/**
 * Multi-stage retrieval strategy
 * Stage 1: Exact match (high precision)
 * Stage 2: Semantic match (balanced)
 * Stage 3: Expanded match (high recall)
 */
export interface RetrievalStage {
  name: string;
  queries: string[];
  minSimilarity: number;
  maxResults: number;
  strategy: 'exact' | 'semantic' | 'expanded';
}

export function getRetrievalStages(
  query: string,
  intent: QueryIntent
): RetrievalStage[] {
  const stages: RetrievalStage[] = [];
  
  // Stage 1: Exact/original query (high precision)
  stages.push({
    name: 'exact',
    queries: [query],
    minSimilarity: 0.4,
    maxResults: 3,
    strategy: 'exact',
  });
  
  // Stage 2: Semantic/rewritten query (balanced)
  const rewritten = rewriteQuery(query);
  stages.push({
    name: 'semantic',
    queries: [rewritten, query],
    minSimilarity: 0.25,
    maxResults: 5,
    strategy: 'semantic',
  });
  
  // Stage 3: Expanded query (high recall)
  const variants = generateQueryVariants(query, intent);
  stages.push({
    name: 'expanded',
    queries: variants,
    minSimilarity: 0.15,
    maxResults: 10,
    strategy: 'expanded',
  });
  
  return stages;
}

/**
 * Reciprocal Rank Fusion for combining results from multiple queries
 */
export function reciprocalRankFusion<T extends { id: number }>(
  resultSets: T[][],
  k: number = 60
): T[] {
  const scores: Map<number, number> = new Map();
  
  // Score each result by rank
  for (const results of resultSets) {
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const rank = i + 1;
      const score = 1 / (k + rank);
      
      const currentScore = scores.get(result.id) || 0;
      scores.set(result.id, currentScore + score);
    }
  }
  
  // Sort by fused score
  const fused = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => resultSets.flat().find(r => r.id === id)!)
    .filter(Boolean);
  
  return fused;
}

/**
 * Improve retrieval for plain text / conversational queries
 */
export function improveConversationalRetrieval(
  query: string,
  context?: {
    previousQueries?: string[];
    sessionTopics?: string[];
  }
): {
  improvedQuery: string;
  intent: QueryIntent;
  variants: string[];
  stages: RetrievalStage[];
} {
  // Classify intent
  const intent = classifyIntent(query);
  
  // Rewrite query
  const rewritten = rewriteQuery(query);
  
  // Add context if available
  let improvedQuery = rewritten;
  if (context?.sessionTopics && context.sessionTopics.length > 0) {
    // Add session topics to query for context
    improvedQuery = `${rewritten} ${context.sessionTopics.slice(0, 3).join(' ')}`;
  }
  
  // Generate variants
  const variants = generateQueryVariants(query, intent);
  
  // Get retrieval stages
  const stages = getRetrievalStages(query, intent);
  
  return {
    improvedQuery,
    intent,
    variants,
    stages,
  };
}
