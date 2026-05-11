export interface ExtractedFact {
  content: string;
  type: "fact" | "concept" | "opinion" | "rule" | "identity";
  tags: string[];
  confidence: number;
  userIdentity?: boolean; // True if this is a user identity statement ("I am...", "My name is...")
}

// Common words that should NOT be captured as names
const NON_NAME_WORDS = new Set([
  'learning', 'happy', 'sad', 'tired', 'excited', 'bored', 'confused',
  'ai', 'bot', 'assistant', 'omni', 'omnilearn', 'robot', 'machine', 'system',
  'a', 'an', 'the', 'this', 'that', 'one', 'someone', 'anyone',
  'student', 'developer', 'programmer', 'engineer', 'user', 'person',
  'here', 'there', 'ready', 'sure', 'okay', 'ok', 'yes', 'no',
]);

// Identity statement patterns - detect user self-identification
const IDENTITY_PATTERNS: Array<{ re: RegExp; extractName: (m: RegExpMatchArray) => string }> = [
  // "I am [Name]" or "I'm [Name]" - must be capitalized proper noun(s)
  { re: /(i am|i'm)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i, extractName: (m) => m[2] },
  // "My name is [Name]"
  { re: /my name is\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i, extractName: (m) => m[1] },
  // "Call me [Name]"
  { re: /call me\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i, extractName: (m) => m[1] },
  // "I go by [Name]"
  { re: /i go by\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i, extractName: (m) => m[1] },
];

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
  if (/\b(ai|bot|assistant|omni|omnilearn|robot|machine|intelligence)\b/i.test(lower)) return false;
  
  // Reject if it's just a common noun pretending to be capitalized
  const commonNouns = ['Learning', 'Happy', 'Sad', 'Tired', 'Ready', 'Sure', 'Here', 'There'];
  if (commonNouns.includes(name)) return false;
  
  return true;
}

const FACT_PATTERNS: Array<{ re: RegExp; type: ExtractedFact["type"]; conf: number }> = [
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:is|are)\s+(?:a|an|the|one of)?\s*([\w][\w\s,]{2,60})/gi, type: "fact", conf: 0.75 },
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:means?|refers? to|stands? for)\s+([\w][\w\s,]{2,60})/gi, type: "fact", conf: 0.80 },
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:can|could|enables?|allows?)\s+([\w][\w\s,]{2,60})/gi, type: "rule", conf: 0.70 },
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:causes?|leads? to|results? in|produces?)\s+([\w][\w\s,]{2,60})/gi, type: "fact", conf: 0.75 },
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:uses?|employs?|relies? on|requires?)\s+([\w][\w\s,]{2,60})/gi, type: "fact", conf: 0.70 },
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:consists? of|contains?|includes?|has)\s+([\w][\w\s,]{2,60})/gi, type: "fact", conf: 0.70 },
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:was|were)\s+(?:designed?|built?|created?|developed?)\s+(?:to|for|by)\s+([\w][\w\s,]{2,60})/gi, type: "fact", conf: 0.72 },
  { re: /([A-Za-z][\w\s]{2,40}?)\s+(?:works?|operates?|functions?|runs?)\s+(?:by|through|via|on)\s+([\w][\w\s,]{2,60})/gi, type: "fact", conf: 0.68 },
  // NEW: Capture simple declarative sentences as facts
  { re: /^(\w+\s+\w+\s+\w+)\s+(?:is|are|was|were)\s+(\w+)$/i, type: "fact", conf: 0.60 },
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
  
  // Too short (likely truncated)
  if (trimmed.length < 25) return false;
  
  // Too long (likely a full document, not atomic fact)
  if (trimmed.length > 500) return false;
  
  // Check for obvious garbage patterns
  const garbagePatterns = [
    /is a n\s+\w+/i,           // "is a n open" (broken grammar)
    /the the\s+/i,              // Repeated words
    /a a\s+/i,                  // Repeated articles
    /\n\n\n+/,                  // Multiple blank lines
    /^\s*[A-Z]\.$/,             // Single letter sentences
    /\[\d+\]/,                  // Citation markers [1], [2]
    /fig\.?\s*\d+/i,           // Figure references
    /table\s*\d+/i,            // Table references
    /et al\.?/i,               // Academic citations
  ];
  
  if (garbagePatterns.some(p => p.test(trimmed))) return false;
  
  // AI shouldn't claim agency (working on features, building things)
  const agencyPatterns = [
    /i['']?m working on/i,
    /i['']?m building/i,
    /i['']?m developing/i,
    /i['']?m creating/i,
    /i will (add|implement|create|build)/i,
  ];
  
  if (agencyPatterns.some(p => p.test(trimmed))) return false;
  
  // Check for incomplete sentences (no verb)
  const hasVerb = /\b(is|are|was|were|has|have|had|does|do|did|can|could|will|would|should|may|might|must|works?|uses?|creates?|builds?|makes?|provides?|enables?|allows?)\b/i.test(trimmed);
  if (!hasVerb && trimmed.length > 40) return false;  // Long text without verb is suspicious
  
  // Check for proper sentence structure (capital letter start, punctuation end)
  const hasProperStructure = /^[A-Z]/.test(trimmed) && /[.!?]$/.test(trimmed);
  if (!hasProperStructure && trimmed.length > 60) return false;  // Long text should be properly structured
  
  // Reject if it's mostly numbers/symbols
  const alphaChars = trimmed.replace(/[^a-zA-Z]/g, '').length;
  if (alphaChars / trimmed.length < 0.6) return false;  // Less than 60% letters is suspicious
  
  return true;
}

/**
 * Check if text is a question, command, or request (NOT a learnable fact)
 */
function isNonLearnable(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  
  // Empty or too short
  if (trimmed.length < 10) return true;
  
  // Questions ending with ?
  if (trimmed.endsWith("?")) return true;
  
  // Direct questions (what, who, where, when, why, how, etc.)
  const questionStarts = /^(what|who|where|when|why|how|is|are|can|could|does|do|will|would|should|tell|explain|describe|show|give|help)/i;
  if (questionStarts.test(trimmed)) return true;
  
  // Commands/requests (imperative mood)
  const commands = /^(explain|show|tell|give|help|teach|describe|summarize|clarify|elaborate|expand|simplify|rephrase|repeat)/i;
  if (commands.test(trimmed)) return true;
  
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
  
  if (clarification.some(pattern => pattern.test(trimmed))) return true;
  
  // Greetings and conversational fillers
  const greetings = [
    /^hello/, /^hi /, /^hey /, /^thanks/, /^thank you/,
    /^please/, /^ok$/, /^okay$/, /^sure/, /^yes$/, /^no$/,
    /^good/, /^great/, /^awesome/, /^nice/, /^cool/,
  ];
  
  if (greetings.some(pattern => pattern.test(trimmed))) return true;
  
  // Meta-conversation about the conversation
  const metaPatterns = [
    /let['']s (talk|discuss|chat)/,
    /i have a question/,
    /quick question/,
    /can i ask/,
    /are you (there|ready|listening)/,
    /do you (know|remember|understand)/,
  ];
  
  if (metaPatterns.some(pattern => pattern.test(trimmed))) return true;
  
  return false;
}

export function extractFacts(text: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();

  // Check for identity statements FIRST - these are handled specially
  const identityName = detectIdentityStatement(text);
  if (identityName) {
    // Add identity fact with special type
    facts.push({
      content: text.trim(),
      type: "identity",
      tags: ["identity", "user", identityName.toLowerCase()],
      confidence: 0.95,
      userIdentity: true,
    });
    // Don't extract other facts from pure identity statements
    return facts;
  }

  // Don't extract facts from questions, commands, or requests - they're prompts, not knowledge!
  if (isNonLearnable(text)) {
    return facts; // Return empty - no fact extraction
  }

  // 1. Try pattern-based extraction first (high quality)
  for (const { re, type, conf } of FACT_PATTERNS) {
    const pattern = new RegExp(re.source, re.flags);
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const subj = match[1]?.trim().toLowerCase().replace(/\s+/g, " ");
      const obj = match[2]?.trim().toLowerCase().replace(/\s+/g, " ");

      if (!subj || !obj) continue;
      if (subj.split(" ").length > 8 || obj.split(" ").length > 10) continue;
      if (subj.length < 3 || obj.length < 3) continue;

      const key = `${subj}::${obj}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const content = `${subj} ${match[0].slice(subj.length, match[0].indexOf(obj)).trim()} ${obj}`.trim();
      const tags = extractTags([subj, obj]);

      facts.push({ content, type, tags, confidence: conf });
    }
  }

  // 2. If bulk text (>200 chars), extract sentences as facts (more aggressive)
  if (text.length > 200 && facts.length < 5) {
    // Split into sentences
    const sentences = text
      .split(/[.!?]+\s+/)
      .filter(s => s.trim().length > 30 && s.trim().length < 300);
    
    for (const sentence of sentences) {
      const clean = sentence.trim();
      
      // Skip if already extracted
      const key = clean.toLowerCase().slice(0, 50);
      if (seen.has(key)) continue;
      seen.add(key);
      
      // Skip questions/commands
      if (isNonLearnable(clean)) continue;
      
      // Must have a verb
      const hasVerb = /\b(is|are|was|were|has|have|had|does|do|did|can|could|will|would|should|may|might|must|works?|uses?|creates?|builds?|makes?|provides?|enables?|allows?|contains?|includes?|consists?|requires?|depends?|affects?|produces?|generates?|forms?|becomes?|remains?)\b/i.test(clean);
      if (!hasVerb) continue;
      
      // Determine type
      let type: ExtractedFact["type"] = "fact";
      if (/\b(can|could|enables?|allows?|must|should|requires?)\b/i.test(clean)) {
        type = "rule";
      } else if (/\b(concept|idea|theory|principle|notion)\b/i.test(clean)) {
        type = "concept";
      } else if (/\b(think|believe|opinion|feel)\b/i.test(clean)) {
        type = "opinion";
      }
      
      // Extract key terms for tags
      const terms = extractKeyTerms(clean);
      
      facts.push({
        content: clean,
        type,
        tags: terms.slice(0, 5),
        confidence: 0.65, // Lower confidence for sentence extraction
      });
    }
  }

  // Also capture the whole sentence as a general knowledge node if long enough
  // BUT: skip sentences that are questions, commands, requests, or low-quality
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 30 && s.length < 300);
  for (const sentence of sentences) {
    const normalised = sentence.toLowerCase().replace(/\s+/g, " ");
    if (!seen.has(`sent::${normalised}`) && !isNonLearnable(sentence) && hasKnowledgeQuality(sentence)) {
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

export function extractTags(words: string[]): string[] {
  return words
    .map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(w => w.length > 3)
    .slice(0, 8);
}

export function detectQueryType(text: string): "question" | "statement" | "command" {
  const trimmed = text.trim();
  if (trimmed.endsWith("?") || /^(what|who|where|when|why|how|is|are|can|could|does|do|will|would|should|tell|explain|describe)/i.test(trimmed)) {
    return "question";
  }
  if (/^(teach|learn|remember|know|store|add|save|update|forget)/i.test(trimmed)) {
    return "command";
  }
  return "statement";
}

export function extractKeyTerms(text: string): string[] {
  // Extract multi-word proper nouns and key concepts
  const terms: string[] = [];

  // Capitalized phrases (likely proper nouns / named concepts)
  const caps = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) ?? [];
  terms.push(...caps.map(t => t.toLowerCase()));

  // Words after "about", "regarding", "on", "concerning"
  const topicMatch = text.match(/(?:about|regarding|on|concerning|understand|know about|tell me about)\s+([a-z][\w\s]{2,30})/gi);
  if (topicMatch) {
    for (const m of topicMatch) {
      const t = m.replace(/^(about|regarding|on|concerning|understand|know about|tell me about)\s+/i, "").trim();
      if (t) terms.push(t.toLowerCase());
    }
  }

  return [...new Set(terms)].slice(0, 10);
}
