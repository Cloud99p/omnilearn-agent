/**
 * Advanced Text Preprocessing for OmniLearn
 * Improves knowledge extraction and retrieval quality from plain text
 * 
 * Features:
 * - Text normalization
 * - Entity recognition (simple pattern-based)
 * - Query expansion with synonyms
 * - Better tokenization for TF-IDF
 */

// Common English stop words (for TF-IDF improvement)
export const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'into', 'through', 'during',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
  'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now',
  'here', 'there', 'then', 'once', 'if', 'unless', 'until', 'while', 'although', 'though',
  'about', 'above', 'after', 'again', 'before', 'below', 'between', 'under', 'over',
]);

// Synonym mappings for query expansion
export const SYNONYM_MAP: Record<string, string[]> = {
  'ai': ['artificial intelligence', 'machine intelligence', 'ml', 'machine learning'],
  'ml': ['machine learning', 'ai', 'artificial intelligence'],
  'nlp': ['natural language processing', 'text processing', 'language ai'],
  'llm': ['large language model', 'transformer', 'generative ai'],
  'neural network': ['nn', 'deep learning', 'neural net', 'connectionist'],
  'deep learning': ['dl', 'neural network', 'representation learning'],
  'computer vision': ['cv', 'image recognition', 'visual ai'],
  'reinforcement learning': ['rl', 'reward learning', 'policy learning'],
  'algorithm': ['method', 'technique', 'procedure', 'approach'],
  'model': ['system', 'framework', 'architecture'],
  'train': ['learn', 'optimize', 'fit'],
  'prediction': ['forecast', 'inference', 'estimation'],
  'data': ['information', 'dataset', 'corpus'],
  'feature': ['attribute', 'characteristic', 'property'],
  'accuracy': ['precision', 'performance', 'correctness'],
  'error': ['mistake', 'loss', 'deviation'],
};

// Entity patterns for better tagging
export const ENTITY_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => string;
}> = [
  {
    name: 'person',
    pattern: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g,
    extract: (m) => m[1],
  },
  {
    name: 'organization',
    pattern: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Inc|Ltd|LLC|Corp|Co|Foundation|Institute|University))\.?)\b/g,
    extract: (m) => m[1],
  },
  {
    name: 'technology',
    pattern: /\b(?:Python|JavaScript|TypeScript|React|Node|TensorFlow|PyTorch|AWS|Azure|GCP|Docker|Kubernetes)\b/gi,
    extract: (m) => m[0],
  },
  {
    name: 'date',
    pattern: /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi,
    extract: (m) => m[0],
  },
  {
    name: 'measurement',
    pattern: /\b(\d+(?:\.\d+)?\s*(?:ms|s|min|hr|day|week|month|year|kb|mb|gb|tb|%|km|m|cm|mm|kg|g|lb|oz))\b/gi,
    extract: (m) => m[0],
  },
];

/**
 * Normalize text for better retrieval
 * - Lowercase (optional)
 * - Remove extra whitespace
 * - Normalize punctuation
 * - Handle common abbreviations
 */
export function normalizeText(text: string, options?: {
  lowercase?: boolean;
  removeExtraSpaces?: boolean;
  normalizePunctuation?: boolean;
}): string {
  let normalized = text;
  
  // Lowercase (optional - keep case for entity recognition)
  if (options?.lowercase) {
    normalized = normalized.toLowerCase();
  }
  
  // Remove extra whitespace
  if (options?.removeExtraSpaces !== false) {
    normalized = normalized.replace(/\s+/g, ' ').trim();
  }
  
  // Normalize punctuation
  if (options?.normalizePunctuation) {
    // Remove multiple punctuation
    normalized = normalized.replace(/([.!?])\1+/g, '$1');
    // Normalize quotes
    normalized = normalized.replace(/[""''„‟]/g, '"');
    // Normalize dashes
    normalized = normalized.replace(/[–—]/g, '-');
  }
  
  return normalized;
}

/**
 * Extract entities from text for better tagging
 */
export function extractEntities(text: string): Array<{
  type: string;
  value: string;
  position: number;
}> {
  const entities: Array<{ type: string; value: string; position: number }> = [];
  
  for (const { name, pattern, extract } of ENTITY_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const value = extract(match);
      if (value) {
        entities.push({
          type: name,
          value,
          position: match.index,
        });
      }
    }
  }
  
  // Sort by position
  entities.sort((a, b) => a.position - b.position);
  
  return entities;
}

/**
 * Expand query with synonyms for better recall
 */
export function expandQuery(
  query: string,
  options?: {
    maxSynonyms?: number;
    includeOriginal?: boolean;
  }
): string {
  const maxSynonyms = options?.maxSynonyms ?? 3;
  const includeOriginal = options?.includeOriginal ?? true;
  
  const queryLower = query.toLowerCase();
  const expandedTerms: string[] = includeOriginal ? [queryLower] : [];
  
  // Check each word/phrase in synonym map
  for (const [term, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (queryLower.includes(term)) {
      // Add top synonyms
      for (const synonym of synonyms.slice(0, maxSynonyms)) {
        if (!expandedTerms.includes(synonym)) {
          expandedTerms.push(synonym);
        }
      }
    }
  }
  
  return expandedTerms.join(' ');
}

/**
 * Better tokenization for TF-IDF
 * - Removes stop words
 * - Handles compound words
 * - Preserves important punctuation
 */
export function tokenizeAdvanced(text: string): string[] {
  // Normalize first
  const normalized = normalizeText(text, {
    lowercase: true,
    removeExtraSpaces: true,
  });
  
  // Split on word boundaries but keep hyphenated compounds
  const tokens = normalized
    .split(/[\s,;.!?()"\[\]{}]+/)
    .filter(token => {
      // Filter out stop words
      if (STOP_WORDS.has(token)) return false;
      // Filter out single characters (except 'a' which might be important)
      if (token.length < 2) return false;
      // Filter out pure numbers
      if (/^\d+$/.test(token)) return false;
      return true;
    });
  
  return tokens;
}

/**
 * Detect text type for better processing
 */
export function detectTextType(text: string): 'conversational' | 'formal' | 'technical' | 'mixed' {
  const lower = text.toLowerCase();
  
  // Conversational indicators
  const conversationalMarkers = [
    /\bi['']?m\b/i,
    /\bi['']?ve\b/i,
    /\bi['']?ll\b/i,
    /\bwhat do you think\b/i,
    /\bcan you\b/i,
    /\btell me\b/i,
    /\bhey\b/i,
    /\bthanks?\b/i,
  ];
  
  // Technical indicators
  const technicalMarkers = [
    /\b(api|sdk|http|json|xml|sql|css|html)\b/i,
    /\b(function|class|interface|module|package)\b/i,
    /\b(algorithm|complexity|optimization|recursion)\b/i,
    /\b(database|server|client|endpoint|request|response)\b/i,
    /[{}[\]()]/, // Code-like punctuation
  ];
  
  // Formal indicators
  const formalMarkers = [
    /\btherefore\b/i,
    /\bhowever\b/i,
    /\bmoreover\b/i,
    /\bfurthermore\b/i,
    /\bconsequently\b/i,
    /\bnotwithstanding\b/i,
  ];
  
  const conversationalScore = conversationalMarkers.filter(m => m.test(text)).length;
  const technicalScore = technicalMarkers.filter(m => m.test(text)).length;
  const formalScore = formalMarkers.filter(m => m.test(text)).length;
  
  if (technicalScore >= 2) return 'technical';
  if (conversationalScore >= 2) return 'conversational';
  if (formalScore >= 2) return 'formal';
  return 'mixed';
}

/**
 * Improve fact extraction from conversational text
 * Handles implicit knowledge and coreference
 */
export function extractImplicitKnowledge(
  text: string,
  context?: { previousMessages?: string[] }
): Array<{
  explicit: string;
  implicit?: string;
  confidence: number;
}> {
  const improvements: Array<{
    explicit: string;
    implicit?: string;
    confidence: number;
  }> = [];
  
  // Pattern 1: "I think X" → X is a belief/opinion
  const beliefPattern = /\bi (think|believe|feel|guess)\s+(.+?)\.?$/im;
  const beliefMatch = text.match(beliefPattern);
  if (beliefMatch) {
    improvements.push({
      explicit: beliefMatch[0],
      implicit: beliefMatch[2].trim(),
      confidence: 0.7,
    });
  }
  
  // Pattern 2: "In my experience, X" → X is empirical knowledge
  const experiencePattern = /\bin my (experience|opinion|view),?\s+(.+?)\.?$/im;
  const experienceMatch = text.match(experiencePattern);
  if (experienceMatch) {
    improvements.push({
      explicit: experienceMatch[0],
      implicit: experienceMatch[2].trim(),
      confidence: 0.8,
    });
  }
  
  // Pattern 3: "X is better than Y" → Extract comparison
  const comparisonPattern = /(\w+(?:\s+\w+)*)\s+is\s+(?:much\s+)?better than\s+(\w+(?:\s+\w+)*)/i;
  const comparisonMatch = text.match(comparisonPattern);
  if (comparisonMatch) {
    improvements.push({
      explicit: comparisonMatch[0],
      implicit: `${comparisonMatch[1]} > ${comparisonMatch[2]} (preference)`,
      confidence: 0.6,
    });
  }
  
  // Pattern 4: Coreference resolution (simple)
  // "The model is accurate. It uses transformers." → "The model uses transformers."
  if (context?.previousMessages && context.previousMessages.length > 0) {
    const lastMessage = context.previousMessages[context.previousMessages.length - 1];
    
    // Check for pronouns referring to previous subject
    const pronounPattern = /\b(it|they|them|this|that)\s+(.+)/i;
    const pronounMatch = text.match(pronounPattern);
    
    if (pronounMatch) {
      // Extract subject from previous message
      const prevSubject = lastMessage.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
      if (prevSubject) {
        const resolved = `${prevSubject[1]} ${pronounMatch[2]}`;
        improvements.push({
          explicit: text,
          implicit: resolved,
          confidence: 0.5, // Lower confidence for coreference resolution
        });
      }
    }
  }
  
  return improvements;
}

/**
 * Calculate text quality score for better filtering
 */
export function calculateTextQuality(text: string): {
  score: number; // 0-1
  factors: {
    length: number;
    hasVerb: boolean;
    hasSubject: boolean;
    isComplete: boolean;
    isGarbage: boolean;
  };
} {
  const trimmed = text.trim();
  
  // Length factor (0-0.3)
  const lengthScore = Math.min(0.3, trimmed.length / 500);
  
  // Has verb factor (0-0.2)
  const hasVerb = /\b(is|are|was|were|has|have|had|does|do|did|can|could|will|would|should|may|might|must|works?|uses?|creates?|builds?|makes?|provides?|enables?)\b/i.test(trimmed);
  const verbScore = hasVerb ? 0.2 : 0;
  
  // Has subject factor (0-0.2)
  const hasSubject = /^[A-Z]/.test(trimmed) && /\b[a-zA-Z]+\b/.test(trimmed);
  const subjectScore = hasSubject ? 0.2 : 0;
  
  // Completeness factor (0-0.2)
  const isComplete = /[.!?]$/.test(trimmed);
  const completenessScore = isComplete ? 0.2 : 0;
  
  // Garbage penalty (0 to -0.5)
  const garbagePatterns = [
    /^\s*[a-z]{1,3}\s+$/i, // Too short
    /\s{3,}/, // Multiple spaces
    /^[^a-zA-Z]{50,}$/, // Mostly non-alpha
  ];
  const isGarbage = garbagePatterns.some(p => p.test(trimmed));
  const garbagePenalty = isGarbage ? 0.5 : 0;
  
  const score = Math.max(0, lengthScore + verbScore + subjectScore + completenessScore - garbagePenalty);
  
  return {
    score,
    factors: {
      length: trimmed.length,
      hasVerb,
      hasSubject,
      isComplete,
      isGarbage,
    },
  };
}
