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
  for (const { re, type, conf } of FACT_PATTERNS) {
    const pattern = new RegExp(re.source, re.flags);
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const subj = match[1]?.trim().toLowerCase().replace(/\s+/g, " ");
      const obj = match[2]?.trim().toLowerCase().replace(/\s+/g, " ");

      if (!subj || !obj) continue;
      // More lenient length checks
      if (subj.split(" ").length > 12 || obj.split(" ").length > 15) continue;
      if (subj.length < 2 || obj.length < 2) continue;

      const key = `${subj}::${obj}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const content =
        `${subj} ${match[0].slice(subj.length, match[0].indexOf(obj)).trim()} ${obj}`.trim();
      const tags = extractTags([subj, obj]);

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
      seen.add(key);

      // Skip questions/commands
      if (isNonLearnable(clean)) continue;

      // CRITICAL: Skip sentence fragments (not standalone facts)
      const fragmentStarts = /^(which|that|where|when|who|whom|whose|what|while|although|though|because|since|unless|until|if|though|although|despite|whereas|whereby)\b/i;
      if (fragmentStarts.test(clean)) {
        console.log(`[EXTRACT] Skipping fragment: ${clean.slice(0, 80)}`);
        continue;
      }

      // Must have a verb (or be a clear factual statement)
      const hasVerb =
        /\b(is|are|was|were|has|have|had|does|do|did|can|could|will|would|should|may|might|must|works?|uses?|creates?|builds?|makes?|provides?|enables?|allows?|contains?|includes?|consists?|requires?|depends?|affects?|produces?|generates?|forms?|becomes?|remains?|show|shows?|indicate|indicates?|suggest|suggests?)\b/i.test(
          clean,
        );
      // Skip only if no verb AND doesn't look like a fact
      if (!hasVerb && !/\b(were|are|is|was)\b/i.test(clean)) continue;

      // Determine type
      let type: ExtractedFact["type"] = "fact";
      if (
        /\b(can|could|enables?|allows?|must|should|requires?)\b/i.test(clean)
      ) {
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

export function extractTags(words: string[]): string[] {
  return words
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 3)
    .slice(0, 8);
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
  // Extract multi-word proper nouns and key concepts
  const terms: string[] = [];

  // Capitalized phrases (likely proper nouns / named concepts)
  const caps = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) ?? [];
  terms.push(...caps.map((t) => t.toLowerCase()));

  // Words after "about", "regarding", "on", "concerning"
  const topicMatch = text.match(
    /(?:about|regarding|on|concerning|understand|know about|tell me about)\s+([a-z][\w\s]{2,30})/gi,
  );
  if (topicMatch) {
    for (const m of topicMatch) {
      const t = m
        .replace(
          /^(about|regarding|on|concerning|understand|know about|tell me about)\s+/i,
          "",
        )
        .trim();
      if (t) terms.push(t.toLowerCase());
    }
  }

  return [...new Set(terms)].slice(0, 10);
}
