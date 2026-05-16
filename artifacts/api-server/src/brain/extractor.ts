export interface ExtractedFact {
  content: string;
  type: "fact" | "concept" | "opinion" | "rule" | "identity";
  tags: string[];
  confidence: number;
  userIdentity?: boolean; // True if this is a user identity statement ("I am...", "My name is...")
}

// Common words that should NOT be captured as names
const NON_NAME_WORDS = new Set([
  "learning",
  "happy",
  "sad",
  "tired",
  "excited",
  "bored",
  "confused",
  "ai",
  "bot",
  "assistant",
  "omni",
  "omnilearn",
  "robot",
  "machine",
  "system",
  "a",
  "an",
  "the",
  "this",
  "that",
  "one",
  "someone",
  "anyone",
  "student",
  "developer",
  "programmer",
  "engineer",
  "user",
  "person",
  "here",
  "there",
  "ready",
  "sure",
  "okay",
  "ok",
  "yes",
  "no",
]);

// Identity statement patterns - detect user self-identification
const IDENTITY_PATTERNS: Array<{
  re: RegExp;
  extractName: (m: RegExpMatchArray) => string;
}> = [
  // "I am [Name]" or "I'm [Name]" - must be capitalized proper noun(s)
  {
    re: /(i am|i'm)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
    extractName: (m) => m[2],
  },
  // "My name is [Name]"
  {
    re: /my name is\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
    extractName: (m) => m[1],
  },
  // "Call me [Name]"
  {
    re: /call me\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
    extractName: (m) => m[1],
  },
  // "I go by [Name]"
  {
    re: /i go by\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
    extractName: (m) => m[1],
  },
];

/**
 * Split long sentences into atomic facts when they contain clear independent clauses.
 * Returns array of clauses (includes original if no splitting occurs).
 * 
 * Hybrid approach: preserve full sentences for context, but split when:
 * - Sentence > 150 chars
 * - Contains clear clause markers (semicolon, " and ", " which ", etc.)
 * - Each clause can stand alone as a fact
 */
export function splitIntoAtomicFacts(sentence: string): string[] {
  const trimmed = sentence.trim();
  
  // Don't split short sentences - keep as-is
  if (trimmed.length < 150) {
    return [trimmed];
  }
  
  const clauses: string[] = [];
  
  // Strategy 1: Split on semicolons (clear independent clauses)
  if (trimmed.includes(';')) {
    const parts = trimmed.split(';').map(p => p.trim()).filter(p => p.length > 20);
    if (parts.length > 1) {
      clauses.push(...parts);
    }
  }
  
  // Strategy 2: Split on ", and " or ", which " when followed by capitalized or verb
  if (clauses.length === 0) {
    // Look for patterns like "[clause], and [subject] [verb]..."
    const andWhichPattern = /(.+?),\s+(and|which)\s+([A-Z][a-zA-Z]+|[a-z]+)\s+(?:is|are|was|were|has|have|had|does|do|did|can|could|will|would|should|may|might|must|result|lead|become|include|contain|consist|work|function|operate|live|exist|occur|appear|seem|remain|stay|continue|begin|start|end|finish|develop|evolve|diverge|domesticate|classify|relate|connect|separate|isolate)\b/i;
    const match = trimmed.match(andWhichPattern);
    if (match && match[1]?.length > 30) {
      clauses.push(match[1].trim());
      // Add the rest as second clause
      const rest = trimmed.slice(match[1].length + 2).trim();
      if (rest.length > 30) {
        clauses.push(rest);
      }
    }
  }
  
  // Strategy 3: Split on " - " (em-dash used as clause separator)
  if (clauses.length === 0 && trimmed.includes(' - ')) {
    const parts = trimmed.split(' - ').map(p => p.trim()).filter(p => p.length > 20);
    if (parts.length > 1) {
      clauses.push(...parts);
    }
  }
  
  // If no clean splitting found, keep original
  if (clauses.length === 0) {
    return [trimmed];
  }
  
  // Validate each clause has a verb (can stand alone)
  const validClauses = clauses.filter(clause => {
    const hasVerb = /\b(is|are|was|were|has|have|had|does|do|did|can|could|will|would|should|may|might|must|works?|uses?|creates?|builds?|makes?|provides?|enables?|allows?|contains?|includes?|consists?|requires?|depends?|affects?|produces?|generates?|forms?|becomes?|remains?|show|shows?|indicate|indicates?|suggest|suggests?|diverge|domesticate|classify|relate|connect|separate|isolate|develop|evolve|live|exist|occur|appear|seem|remain|stay|continue|begin|start|end|finish)\b/i.test(clause);
    return hasVerb && clause.length > 25;
  });
  
  return validClauses.length > 0 ? validClauses : [trimmed];
}

/**
 * Check if extracted text is a valid name (not a common word or AI self-reference)
 */
function isValidName(name: string): boolean {
  const lower = name.toLowerCase().trim();

  // Must start with capital letter and be 2-50 chars
  if (!/^[A-Z][a-z]/.test(name)) return false;
  if (name.length < 2 || name.length > 50) return false;

  // Reject if it's a common non-name word
  if (NON_NAME_WORDS.has(lower)) return false;

  // Reject if it looks like an AI self-description or project name
  if (
    /\b(ai|bot|assistant|omni|omnilearn|robot|machine|intelligence)\b/i.test(
      lower,
    )
  )
    return false;

  // Reject if it's just a common noun pretending to be capitalized
  const commonNouns = [
    "Learning",
    "Happy",
    "Sad",
    "Tired",
    "Ready",
    "Sure",
    "Here",
    "There",
  ];
  if (commonNouns.includes(name)) return false;

  return true;
}

const FACT_PATTERNS: Array<{
  re: RegExp;
  type: ExtractedFact["type"];
  conf: number;
}> = [
  {
    re: /([A-Za-z][\w\s]{2,40}?)\s+(?:is|are)\s+(?:a|an|the|one of)?\s*([\w][\w\s,]{2,60})/gi,
    type: "fact",
    conf: 0.75,
  },
  {
    re: /([A-Za-z][\w\s]{2,40}?)\s+(?:means?|refers? to|stands? for)\s+([\w][\w\s,]{2,60})/gi,
    type: "fact",
    conf: 0.8,
  },
  {
    re: /([A-Za-z][\w\s]{2,40}?)\s+(?:can|could|enables?|allows?)\s+([\w][\w\s,]{2,60})/gi,
    type: "rule",
    conf: 0.7,
  },
  {
    re: /([A-Za-z][\w\s]{2,40}?)\s+(?:causes?|leads? to|results? in|produces?)\s+([\w][\w\s,]{2,60})/gi,
    type: "fact",
    conf: 0.75,
  },
  {
    re: /([A-Za-z][\w\s]{2,40}?)\s+(?:uses?|employs?|relies? on|requires?)\s+([\w][\w\s,]{2,60})/gi,
    type: "fact",
    conf: 0.7,
  },
  {
    re: /([A-Za-z][\w\s]{2,40}?)\s+(?:consists? of|contains?|includes?|has)\s+([\w][\w\s,]{2,60})/gi,
    type: "fact",
    conf: 0.7,
  },
  {
    re: /([A-Za-z][\w\s]{2,40}?)\s+(?:was|were)\s+(?:designed?|built?|created?|developed?)\s+(?:to|for|by)\s+([\w][\w\s,]{2,60})/gi,
    type: "fact",
    conf: 0.72,
  },
  {
    re: /([A-Za-z][\w\s]{2,40}?)\s+(?:works?|operates?|functions?|runs?)\s+(?:by|through|via|on)\s+([\w][\w\s,]{2,60})/gi,
    type: "fact",
    conf: 0.68,
  },
  // NEW: Capture simple declarative sentences as facts
  {
    re: /^(\w+\s+\w+\s+\w+)\s+(?:is|are|was|were)\s+(\w+)$/i,
    type: "fact",
    conf: 0.6,
  },
];

/**
 * Detect if text contains user identity statements ("I am X", "My name is X")
 * Returns the extracted name if found, null otherwise
 */
export function detectIdentityStatement(text: string): string | null {
  for (const { re, extractName } of IDENTITY_PATTERNS) {
    const match = text.match(re);
    if (match) {
      const name = extractName(match);
      if (name && isValidName(name)) {
        return name.trim();
      }
    }
  }
  return null;
}

/**
 * Check if text has sufficient quality to be stored as knowledge
 * Used for batch training validation
 */
export function hasKnowledgeQuality(text: string): boolean {
  const trimmed = text.trim();

  // Strip citation markers for quality checks (but keep original text)
  const cleanText = trimmed.replace(/\[\d+\]/g, "").replace(/\[\d+,\s*\d+\]/g, "");

  // Too short (likely truncated)
  if (cleanText.length < 20) return false;

  // Too long (likely a full document, not atomic fact)
  if (cleanText.length > 700) return false;

  // Check for obvious garbage patterns
  const garbagePatterns = [
    /is a n\s+\w+/i, // "is a n open" (broken grammar)
    /the the\s+/i, // Repeated words
    /a a\s+/i, // Repeated articles
    /\n\n\n+/, // Multiple blank lines
    /^\s*[A-Z]\.$/, // Single letter sentences
  ];

  if (garbagePatterns.some((p) => p.test(cleanText))) return false;

  // AI shouldn't claim agency (working on features, building things)
  const agencyPatterns = [
    /i['']?m working on/i,
    /i['']?m building/i,
    /i['']?m developing/i,
    /i['']?m creating/i,
    /i will (add|implement|create|build)/i,
  ];

  if (agencyPatterns.some((p) => p.test(trimmed))) return false;

  // Check for incomplete sentences (no verb)
  const hasVerb =
    /\b(is|are|was|were|has|have|had|does|do|did|can|could|will|would|should|may|might|must|works?|uses?|creates?|builds?|makes?|provides?|enables?|allows?)\b/i.test(
      trimmed,
    );
  if (!hasVerb && trimmed.length > 40) return false; // Long text without verb is suspicious

  // Check for proper sentence structure (capital letter start, punctuation end)
  // Allow citation markers at end like .[28] or .[28, 29]
  const hasProperStructure = /^[A-Z]/.test(cleanText) && /[.!?]\s*(\[\d+[\d,\s]*\])?$/.test(trimmed);
  if (!hasProperStructure && cleanText.length > 60) return false; // Long text should be properly structured

  // Reject if it's mostly numbers/symbols (but ignore citation markers)
  const alphaChars = cleanText.replace(/[^a-zA-Z]/g, "").length;
  if (alphaChars / cleanText.length < 0.6) return false; // Less than 60% letters is suspicious

  return true;
}

/**
 * Check if text is a question, command, or request (NOT a learnable fact)
 */
function isNonLearnable(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  console.log(`[NonLearnable] Checking: ${trimmed.slice(0, 80)}...`);

  // Empty or too short
  if (trimmed.length < 10) {
    console.log(`[NonLearnable] TRUE - too short (${trimmed.length})`);
    return true;
  }

  // Questions ending with ?
  if (trimmed.endsWith("?")) {
    console.log(`[NonLearnable] TRUE - ends with ?`);
    return true;
  }

  // Direct questions (what, who, where, when, why, how, etc.) - use word boundaries!
  // NOTE: Removed 'is' and 'are' - they appear in statements like 'Dogs are domesticated'
  const questionStarts =
    /^(what|who|where|when|why|how|can|could|does|will|would|should|tell|explain|describe|show|give|help)\b/i;
  if (questionStarts.test(trimmed)) {
    console.log(`[NonLearnable] TRUE - question start: ${trimmed.slice(0, 50)}`);
    return true;
  }

  // Commands/requests (imperative mood) - use word boundaries!
  const commands =
    /^(explain|show|tell|give|help|teach|describe|summarize|clarify|elaborate|expand|simplify|rephrase|repeat)\b/i;
  if (commands.test(trimmed)) {
    console.log(`[NonLearnable] TRUE - command: ${trimmed.slice(0, 50)}`);
    return true;
  }

  // Understanding/clarification requests
  const clarification = [
    /i (don't|do not|dont) understand/,
    /i (don't|do not|dont) get it/,
    /i'm confused/,
    /i'm lost/,
    /can you (explain|clarify|help)/,
    /could you (explain|clarify|help)/,
    /would you (explain|clarify|help)/,
    /please (explain|clarify|help|tell)/,
    /more clearly/,
    /in simple terms/,
    /explain (it|this|that|more)/,
    /clarify (it|this|that)/,
    /what do you mean/,
    /what does (that|this) mean/,
    /i need (help|clarification)/,
    /help me understand/,
    /make it clearer/,
    /simplify (it|this)/,
  ];

  if (clarification.some((pattern) => pattern.test(trimmed))) return true;

  // Greetings and conversational fillers
  const greetings = [
    /^hello/,
    /^hi /,
    /^hey /,
    /^thanks/,
    /^thank you/,
    /^please/,
    /^ok$/,
    /^okay$/,
    /^sure/,
    /^yes$/,
    /^no$/,
    /^good/,
    /^great/,
    /^awesome/,
    /^nice/,
    /^cool/,
  ];

  if (greetings.some((pattern) => pattern.test(trimmed))) return true;

  // Meta-conversation about the conversation
  const metaPatterns = [
    /let['']s (talk|discuss|chat)/,
    /i have a question/,
    /quick question/,
    /can i ask/,
    /are you (there|ready|listening)/,
    /do you (know|remember|understand)/,
    // Filter out meta-text that's just conversational openers
    /^(Great|Good|Sure|Absolutely|Of course|Well|Okay|Alright)\s*!\s*/i,
    /^(Great|Good)\s+question\s*!\s*/i,
  ];

  if (metaPatterns.some((pattern) => pattern.test(trimmed))) return true;

  return false;
}

export function extractFacts(text: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();
  
  // DEBUG: Log text preview
  const textPreview = text.slice(0, 100).replace(/\n/g, '\\n');
  console.log(`[EXTRACT] Input text (${text.length} chars): ${textPreview}...`);
  
  // Check for identity statements FIRST
  const identityName = detectIdentityStatement(text);
  console.log(`[EXTRACT] Identity check: ${identityName ? 'FOUND: ' + identityName : 'none'}`);
  if (identityName) {
    console.log(`[EXTRACT] Returning identity fact`);
    facts.push({
      content: text.trim(),
      type: "identity",
      tags: ["identity", "user", identityName.toLowerCase()],
      confidence: 0.95,
      userIdentity: true,
    });
    return facts;
  }
  
  // Check if non-learnable
  const nonLearnable = isNonLearnable(text);
  console.log(`[EXTRACT] isNonLearnable: ${nonLearnable}`);
  if (nonLearnable) {
    console.log(`[EXTRACT] Returning empty - non-learnable`);
    return facts; // Return empty - no fact extraction
  }

  // NORMALIZE TEXT: Fix common OCR/copy-paste errors
  let normalized = text
    // Fix spacing around words (OCR errors like "a lso" -> "also", "a t" -> "at")
    .replace(/\s+(a|an|is|as|at|in|on|to|for|of|and|or|but|not|was|were|be|been|being)\s+(\w)/g, (match, p1, p2) => {
      const combined = p1 + p2.toLowerCase();
      if (["also", "into", "onto", "about", "that", "with", "from", "then", "when", "than", "what", "who", "why", "how", "where", "which", "while", "would", "could", "should", "must", "could", "need", "used", "does", "done", "gone", "come", "made", "take", "have", "been", "am", "are", "is", "was", "were"].includes(combined)) {
        return combined;
      }
      return match; // Keep original if not a known combination
    })
    // Fix doubled words
    .replace(/\b(\w+)\s+\1\b/gi, "$1")
    // Normalize multiple spaces to single space
    .replace(/\s+/g, " ")
    // Trim
    .trim();

  // 1. Try pattern-based extraction first (high quality)
  // Words that indicate a fragment (not a complete thought)
  const fragmentStarts = /^(and|or|but|so|yet|nor|for|although|though|because|since|unless|until|while|where|which|that|who|whom|whose|what|when|where|why|how|if|then|else|however|therefore|moreover|furthermore|nevertheless|nonetheless|consequently|accordingly|meanwhile|otherwise|instead|rather|also|too|either|neither|both|all|some|any|most|many|few|several|each|every|either|neither)/i;
  
  for (const { re, type, conf } of FACT_PATTERNS) {
    const pattern = new RegExp(re.source, re.flags);
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const subj = match[1]?.trim().toLowerCase().replace(/\s+/g, " ");
      const obj = match[2]?.trim().toLowerCase().replace(/\s+/g, " ");

      if (!subj || !obj) continue;
      
      // REJECT fragments starting with conjunctions/prepositions
      if (fragmentStarts.test(subj)) {
        console.log(`[EXTRACT] Skipping fragment start: "${subj.slice(0, 40)}"`);
        continue;
      }
      
      // More lenient length checks
      if (subj.split(" ").length > 12 || obj.split(" ").length > 15) continue;
      if (subj.length < 3 || obj.length < 3) continue;
      
      // Reject if subject is just a common word
      const commonWords = new Set(["and", "or", "but", "so", "yet", "it", "this", "that", "these", "those", "there", "here", "then", "now", "also", "too", "either", "neither", "both", "all", "some", "any", "most", "many", "few", "several", "each", "every"]);
      if (commonWords.has(subj) || commonWords.has(obj)) continue;

      const key = `${subj}::${obj}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Reconstruct the full match more carefully
      const fullMatch = match[0].trim();
      const content = fullMatch.toLowerCase().replace(/\s+/g, " ");
      const tags = extractTags([subj, obj]);

      console.log(`[EXTRACT] Pattern match: "${content.slice(0, 80)}..." (type: ${type}, conf: ${conf})`);
      facts.push({ content, type, tags, confidence: conf });
    }
  }

  // 2. If bulk text (>200 chars), extract sentences as facts (ALWAYS for educational content)
  if (text.length > 200) {
    // Split into sentences - handle citation markers like .[6][7]
    const normalized = text.replace(/\]\s*\[/g, '], [');
    const sentences = normalized
      .split(/[.!?]+(?:\s*\[\d+\])*(?:\s*\[\d+\])*\s+/)
      .filter((s) => s.trim().length > 15 && s.trim().length < 600);
    
    console.log(`[EXTRACT] Found ${sentences.length} sentences from ${text.length} chars`);
    if (sentences.length > 0) {
      console.log(`[EXTRACT] First: ${sentences[0].slice(0, 150)}`);
    }

    for (const sentence of sentences) {
      const clean = sentence.trim();

      // Skip if already extracted
      const key = clean.toLowerCase().slice(0, 50);
      if (seen.has(key)) continue;

      // Skip questions/commands
      if (isNonLearnable(clean)) continue;

      // CRITICAL: Skip sentence fragments (not standalone facts)
      const fragmentStarts = /^(which|that|where|when|who|whom|whose|what|while|although|though|because|since|unless|until|if|though|although|despite|whereas|whereby)\b/i;
      if (fragmentStarts.test(clean)) {
        console.log(`[EXTRACT] Skipping fragment: ${clean.slice(0, 80)}`);
        continue;
      }

      // HYBRID SPLITTING: Split long sentences into atomic facts
      const atomicClauses = splitIntoAtomicFacts(clean);
      console.log(`[EXTRACT] Sentence split: ${atomicClauses.length} clause(s) from ${clean.length} chars`);

      for (const clause of atomicClauses) {
        // Check for duplicates within split clauses
        const clauseKey = clause.toLowerCase().slice(0, 50);
        if (seen.has(clauseKey)) continue;
        seen.add(clauseKey);

        // Must have a verb (or be a clear factual statement)
        const hasVerb =
          /\b(is|are|was|were|has|have|had|does|do|did|can|could|will|would|should|may|might|must|works?|uses?|creates?|builds?|makes?|provides?|enables?|allows?|contains?|includes?|consists?|requires?|depends?|affects?|produces?|generates?|forms?|becomes?|remains?|show|shows?|indicate|indicates?|suggest|suggests?)\b/i.test(
            clause,
          );
        console.log(`[EXTRACT] Clause verb check: hasVerb=${hasVerb}, len=${clause.length}`);
        // Skip only if no verb AND doesn't look like a fact
        if (!hasVerb && !/\b(were|are|is|was)\b/i.test(clause)) {
          console.log(`[EXTRACT] Skipping clause - no verb: ${clause.slice(0, 60)}...`);
          continue;
        }

        // Determine type
        let type: ExtractedFact["type"] = "fact";
        if (
          /\b(can|could|enables?|allows?|must|should|requires?)\b/i.test(clause)
        ) {
          type = "rule";
        } else if (/\b(concept|idea|theory|principle|notion)\b/i.test(clause)) {
          type = "concept";
        } else if (/\b(think|believe|opinion|feel)\b/i.test(clause)) {
          type = "opinion";
        }

        // Extract key terms for tags
        const terms = extractKeyTerms(clause);

        // Higher confidence for atomic clauses (more focused)
        const confidence = atomicClauses.length > 1 ? 0.68 : 0.65;

        console.log(`[EXTRACT] Clause: "${clause.slice(0, 80)}..." (type: ${type}, conf: ${confidence})`);
        facts.push({
          content: clause,
          type,
          tags: terms.slice(0, 5),
          confidence,
        });
      }
    }
  }

  // Also capture the whole sentence as a general knowledge node if long enough
  // BUT: skip sentences that are questions, commands, requests, or low-quality
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 300);
  for (const sentence of sentences) {
    const normalised = sentence.toLowerCase().replace(/\s+/g, " ");
    if (
      !seen.has(`sent::${normalised}`) &&
      !isNonLearnable(sentence) &&
      hasKnowledgeQuality(sentence)
    ) {
      seen.add(`sent::${normalised}`);
      facts.push({
        content: sentence.trim(),
        type: "fact",
        tags: extractTags(sentence.split(/\s+/).slice(0, 5)),
        confidence: 0.6,
      });
    }
  }

  return facts.slice(0, 20);
}

// Common stop words that should NOT be tags
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must",
  "in", "on", "at", "to", "for", "of", "with", "by", "from", "into", "through", "during",
  "it", "its", "this", "that", "these", "those", "i", "you", "he", "she", "we", "they",
  "what", "which", "who", "whom", "whose", "when", "where", "why", "how",
  "all", "each", "every", "both", "few", "more", "most", "other", "some", "such", "no", "nor", "not",
  "only", "own", "same", "so", "than", "too", "very", "just", "also", "now",
  "here", "there", "then", "once", "if", "unless", "until", "while", "although", "though",
  "about", "above", "after", "again", "before", "below", "between", "under", "over",
]);

export function extractTags(words: string[]): string[] {
  // Split compound words and preserve word boundaries
  const allWords: string[] = [];
  for (const word of words) {
    // Split on spaces first (if input is phrases)
    const parts = word.split(/\s+/);
    for (const part of parts) {
      // Clean each word individually - remove citation markers and non-alpha
      const cleaned = part.toLowerCase().replace(/[^a-z]/g, "");
      // Filter: length 3-25, not a stop word, not pure numbers
      if (cleaned.length >= 3 && cleaned.length <= 25 && !STOP_WORDS.has(cleaned) && /\d/.test(cleaned) === false) {
        allWords.push(cleaned);
      }
    }
  }
  // Remove duplicates and limit
  return [...new Set(allWords)].slice(0, 8);
}

export function detectQueryType(
  text: string,
): "question" | "statement" | "command" {
  const trimmed = text.trim();
  if (
    trimmed.endsWith("?") ||
    /^(what|who|where|when|why|how|is|are|can|could|does|do|will|would|should|tell|explain|describe)/i.test(
      trimmed,
    )
  ) {
    return "question";
  }
  if (
    /^(teach|learn|remember|know|store|add|save|update|forget)/i.test(trimmed)
  ) {
    return "command";
  }
  return "statement";
}

export function extractKeyTerms(text: string): string[] {
  const terms: string[] = [];

  // 1. Capitalized phrases (likely proper nouns / named concepts)
  const caps = text.match(/\b[A-Z][a-z]+(?:[-\s][A-Z][a-z]+){0,3}\b/g) ?? [];
  for (const cap of caps) {
    let lower = cap.toLowerCase();
    if (lower.startsWith("the ")) lower = lower.slice(4);
    if (!STOP_WORDS.has(lower) && lower.length >= 3 && lower.length <= 25) {
      terms.push(lower);
    }
  }

  // 2. Always also extract significant content words (technical terms, nouns, etc.)
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    // Remove citation markers and non-alpha chars
    const cleaned = word.replace(/[^a-z]/g, "");
    // Skip stop words, short words, very long words, and pure numbers
    if (cleaned.length >= 4 && cleaned.length <= 25 && !STOP_WORDS.has(cleaned) && /^[a-z]+$/.test(cleaned)) {
      terms.push(cleaned);
    }
  }

  return [...new Set(terms)].slice(0, 10);
}
