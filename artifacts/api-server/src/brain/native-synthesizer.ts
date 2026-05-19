import type { KnowledgeNode, CharacterState } from "@workspace/db/schema";
import { getVoiceModifiers } from "./character.js";
import { logger } from "../lib/logger.js";
import { webSearch, fetchUrl, type SearchResult } from "./web-tools.js";
import { extractContext, filterByContext, buildContextTransition, shouldAcknowledgeContext, getContextSummary } from "./context-awareness.js";

export interface RetrievedNode extends KnowledgeNode {
  similarity: number;
}

export interface NativeSynthesisContext {
  query: string;
  queryType: "question" | "statement" | "command";
  nodes: RetrievedNode[];
  character: CharacterState;
  history: Array<{ role: string; content: string }>;
  onActivity?: (event: ActivityEvent) => void;
}

/**
 * Conversation state — tracks if we're in casual chat mode
 */
interface ConversationState {
  mode: "casual" | "factual" | "learning";
  lastGreetingTurn: number;
}

const CONVERSATION_STATE: ConversationState = {
  mode: "casual",
  lastGreetingTurn: 0,
};

export type ActivityEvent =
  | { type: "searching"; query: string }
  | { type: "fetching"; url: string }
  | { type: "search_done"; resultCount: number }
  | { type: "fetch_done"; title: string };

export interface NativeSynthesisResult {
  text: string;
  nodesUsed: number;
  newNodesAdded: number;
  learnedFacts: Array<{ content: string; type: string; tags: string[] }>;
  character: {
    curiosity: number;
    confidence: number;
    technical: number;
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Native Response Synthesis — No External LLM
// Builds responses from learned knowledge + character state
// ──────────────────────────────────────────────────────────────────────────────

/**
 * AI Identity Enforcement — OmniLearn's self-identity
 * This ensures the AI always knows it is Omni, not a user or other AI
 */
const AI_IDENTITY = {
  name: "Omni",
  project: "OmniLearn",
  creator: "Emmanuel Nenpan Hosea",
  description:
    "AI agent with persistent knowledge graph and evolving character",
} as const;

/**
 * Check if query is asking about AI's identity
 */
function isIdentityQuery(query: string): boolean {
  const lower = query.toLowerCase().trim();

  // Must be directly asking about the AI itself
  const identityPatterns = [
    /^who are you/,
    /^what are you/,
    /^what is your name/,
    /^your name (is|'s)?/,
    /^who (created|built|made) you/,
    /^what ai (are you|is this)/,
    /^are you (claude|gpt|gemini|chatgpt|copilot)/,
    /^introduce yourself/,
    /^tell me about yourself/,
  ];

  // Must match one of these patterns
  const matches = identityPatterns.some((p) => p.test(lower));

  // EXCLUDE: Questions about topics/things (even if they contain "what" or "who")
  const exclusionPatterns = [
    /what (are|is) your thoughts (on|about)/, // "What are your thoughts on Goth mommies"
    /what (are|is) your opinion (on|about|of)/,
    /what do you think (on|about|of)/,
    /what do you know (on|about|of)/,
  ];

  if (exclusionPatterns.some((p) => p.test(lower))) {
    return false; // These are topic questions, not identity questions
  }

  return matches;
}

/**
 * Check if query is a greeting - based on British Council, EnglishClub research
 */
function isGreeting(query: string): boolean {
  const lower = query.toLowerCase().trim();
  // Strip trailing punctuation for matching (handles "hello?", "hi!", etc.)
  const cleaned = lower.replace(/[!?.,;]+$/, "");
  
  // GREETINGS: Standard greetings + time-specific + casual
  const greetings = [
    // Basic greetings
    "hello", "hi", "hey", "greetings", "howdy", "yo",
    // Time-specific
    "good morning", "good afternoon", "good evening",
    // Extended greetings
    "hi there", "hello there", "hey there", "hey y'all",
    // Casual/slang
    "wassup", "sup", "what's up", "whats up", "howdy",
    // Formal greetings
    "nice to meet you", "pleased to meet you", "how do you do",
    // Check-in greetings
    "how are you", "how are you doing", "how's it going", "how are things",
    "how's life", "how's your day", "how's your week",
    // Long time no see
    "long time no see", "it's been a while",
    // Nigerian/West African greetings (context-aware)
    "how far", "wetin dey happen", "good afternoon o",
  ];
  
  return greetings.some(
    (g) => cleaned === g || cleaned.startsWith(g + " ") || cleaned.endsWith(" " + g),
  );
}

/**
 * Check if query is casual statement (not a question, just sharing)
 * Based on British Council, EnglishClub small talk research
 */
function isCasualStatement(query: string): boolean {
  const lower = query.toLowerCase().trim();

  // CRITICAL: Serious statements should NOT be treated as casual
  const seriousPatterns = [
    /i (killed|murdered|hurt|harmed|hit|attacked|assaulted)/,
    /someone (died|is dead|got hurt)/,
    /i (want to die|will die|going to die|suicide|kill myself)/,
    /i (depressed|anxious|sad|hopeless|worthless)/,
    /(crime|illegal|arrested|police|court|prison|jail)/,
    /(abuse|abused|raped|molested)/,
    /(drugs|overdose|addict|addiction)/,
  ];

  if (seriousPatterns.some((p) => p.test(lower))) {
    return false; // These need serious, thoughtful responses
  }

  // CASUAL STATEMENTS: Based on small talk research
  const casualPatterns = [
    // Personal state sharing ("I" statements)
    /^i (am|was|feel|think|believe|hope|wish|want|need|like|love|hate)/,
    /^i'?m (just|really|so|pretty) /,
    // Weather comments (classic small talk)
    /^it'?s (nice|good|bad|cold|hot|early|late|beautiful|chilly|humid|freezing)/,
    /^(beautiful|lovely|nice) (day|weather|morning)/,
    // Time/day references
    /^today (is|was)/, /^yesterday (was)/, /^this (morning|afternoon|evening)/,
    // Casual check-ins
    /^just (checking|saying|wondering|thinking|looking|asking)/,
    // Minimal responses
    /^nothing (much|special|new)/, /^same (here|as always|old)/,
    /^not (much|really|anything special)/,
    // Agreement/disagreement
    /^yeah,? (yeah|sure|okay|ok|right|true)/, /^nope/,
    /^that'?s (cool|nice|awesome|great|interesting|true|fair|right)/,
    // Reactions
    /^wow/, /^oh/, /^haha/, /^lol/, /^lmao/, /^omg/, /^ouch/, /^oops/,
    // Appreciation
    /^thanks? (a lot|so much|very much)?/i,
    /^i appreciate/, /^that'?s (kind|sweet|thoughtful)/,
    // Slang/informal
    /^aight/, /^bet/, /^vibe/, /^chill/, /^same energy/,
    // Nigerian Pidgin/informal (context-aware)
    /^no wahala/, /^e be like say/, /^na so/, /^I dey/,
  ];

  // Short responses (1-4 words) are usually casual
  const wordCount = lower.split(/\s+/).filter((w) => w.length > 0).length;
  const isShort = wordCount <= 4;
  
  // Short + no question word = likely casual
  const hasQuestionWord = 
    lower.startsWith("what") || lower.startsWith("how") ||
    lower.startsWith("why") || lower.startsWith("when") ||
    lower.startsWith("where") || lower.startsWith("who") ||
    lower.startsWith("which") || lower.startsWith("whose") ||
    lower.startsWith("can you") || lower.startsWith("could you") ||
    lower.startsWith("will you") || lower.startsWith("would you") ||
    lower.startsWith("do you") || lower.startsWith("does") ||
    lower.startsWith("is ") || lower.startsWith("are ") ||
    lower.startsWith("was ") || lower.startsWith("were ");

  return (
    casualPatterns.some((p) => p.test(lower)) ||
    (isShort && !hasQuestionWord)
  );
}

/**
 * Check if query is formal/professional communication
 * Based on business English research (ESLInfo, PlanetSpark, LoveYouEnglish)
 */
function isFormalProfessional(query: string): boolean {
  const lower = query.toLowerCase().trim();
  
  const formalPatterns = [
    // Professional greetings/openings
    /^good morning/i, /^good afternoon/i, /^good evening/i,
    /^i hope (this message finds you well|you are doing well)/i,
    /^i am writing to/i, /^i wanted to (follow up|inquire|ask)/i,
    
    // Business expressions
    /\b(touch base|circle back|follow up|keep me in the loop|take this offline)\b/i,
    /\b(reach out|connecting|checking in|sync up|align on)\b/i,
    /\b(as per our (conversation|discussion|email))\b/i,
    /\b(please find attached|i've attached|attached is)\b/i,
    /\b(looking forward to|i would appreciate|kindly|i would like to request)\b/i,
    
    // Meeting/presentation language
    /^let'?s (get started|begin|review the agenda|summarise|wrap up)/i,
    /^thank you for (your time|joining|your input|your patience)/i,
    /^from my perspective/i, /^i think we should consider/i,
    /^i completely agree/i, /^i see your point/i,
    /^that'?s a fair point/i, /^i understand your concerns/i,
    
    // Polite requests
    /^could you please (provide|clarify|confirm|send|share)/i,
    /^would you mind (explaining|clarifying|sharing)/i,
    /^i was wondering if/i, /^may i (ask|request|inquire)/i,
    
    // Professional closings
    /^please let me know/i, /^kindly (send|confirm|provide)/i,
    /^thanks for your (time|support|help|consideration)/i,
    /^have a great (day|week|weekend)/i,
  ];
  
  return formalPatterns.some((p) => p.test(lower));
}

/**
 * Determine conversation mode based on context
 */
function determineConversationMode(
  query: string,
  history: Array<{ role: string; content: string }>,
  turnNumber: number,
): "casual" | "factual" | "learning" {
  const lower = query.toLowerCase().trim();

  // CRITICAL: Check greetings FIRST (even with question marks like "hello?")
  if (isGreeting(query)) {
    return "casual";
  }

  // STEP 1: Check formal/professional first (treat as factual - needs information/help)
  if (isFormalProfessional(query)) {
    return "factual";
  }

  // STEP 2: Check greetings first (always casual)
  if (isGreeting(query)) {
    return "casual";
  }

  // STEP 3: Check casual follow-ups (always casual)
  const casualFollowUps = [
    /^(and )?you\??$/i,
    /^(what|how) about you\??$/i,
    /^(is )?that okay\??$/i,
    /^alright\??$/i,
    /^okay\??$/i,
    /^sure\??$/i,
    /^good (and )?you\??$/i,
    /^fine (and )?you\??$/i,
    /^nothing much\??$/i,
    /^not much\??$/i,
    /^same (here|as always)\??$/i,
    /^not really\??$/i,
    /^yeah\??$/i,
    /^yep\??$/i,
    /^cool\??$/i,
    /^nice\??$/i,
  ];

  if (casualFollowUps.some((p) => p.test(lower))) {
    return "casual";
  }

  // STEP 3: Check for teaching/learning mode
  if (
    lower.includes("learn this") ||
    lower.includes("remember this") ||
    lower.includes("teach you") ||
    lower.includes("add this") ||
    lower.includes("fact:") ||
    lower.includes("note:")
  ) {
    return "learning";
  }

  // STEP 4: Factual mode - QUESTION PATTERNS based on English grammar research
  // (Perfect English Grammar, EnglishClub, LingoHarvest)
  const factualTriggers = [
    // WH- questions (require information)
    /^what (is|are|was|were|do|does|did|will|would|has|have|had|can|could|should)/,
    /^who (is|are|was|were|do|does|did|has|have|had|can|could)/,
    /^where (is|are|was|were|can|do|does|did|would|could)/,
    /^when (is|are|was|were|did|does|will|would|can|could)/,
    /^why (is|are|was|were|do|does|did|will|would|can|could|should)/,
    /^which (is|are|do|does|would|should)/,
    /^whose (is|are|do|does)/,
    /^how (does|do|did|can|could|would|will|are|is|was|were|many|much|long|far|old|often)/,
    
    // Yes/No questions (auxiliary verb + subject)
    /^is (it|this|that|the|there|he|she|they|we|you)/,
    /^are (you|they|we|there|these|those)/,
    /^was (it|there|he|she|they|the)/,
    /^were (you|they|there|we)/,
    /^do (you|they|we|i) /,
    /^does (it|this|that|he|she|the)/,
    /^did (you|they|we|he|she|i|the)/,
    /^can (you|they|we|i|he|she|it)/,
    /^could (you|they|we|i|he|she|it)/,
    /^will (you|they|we|i|he|she|it|there)/,
    /^would (you|they|we|i|he|she|it)/,
    /^should (you|they|we|i|he|she|it)/,
    /^has (it|this|that|he|she|the)/,
    /^have (you|they|we|i)/,
    /^had (you|they|we|he|she|i)/,
    
    // Information requests
    /^explain (to me )?(what|how|why|when|where|the|this|that)/,
    /^tell me (about|how|what|why|when|where|who|which)/,
    /^can you tell me/,
    /^could you explain/,
    /^i want to know/,
    /^i'd like to know/,
    /^do you know (what|how|why|when|where|if|whether)/,
    
    // Definition/description requests
    /^define /,
    /^describe /,
    /^what is (the |a |an )?[a-z]/,
    /^what are (the )?[a-z]/,
    
    // Knowledge queries
    /^what do you know (about|of)/,
    /^do you know (about|if|whether|what|how|why)/,
    /^can you (tell|explain|describe|show)/,
    
    // "Are you" questions about identity/capabilities (not emotional check-ins)
    /^are you (able|capable|an|a|the|can|willing)/,
    /^is it (true|possible|correct|right)/,
  ];

  if (factualTriggers.some((p) => p.test(lower))) {
    return "factual";
  }

  // STEP 5: Default to casual (everything else is conversation, not queries)
  return "casual";

  // Check if teaching/learning mode (user is sharing facts)
  if (
    lower.includes("learn this") ||
    lower.includes("remember this") ||
    lower.includes("teach you") ||
    lower.includes("add this") ||
    lower.includes("fact:") ||
    lower.includes("note:")
  ) {
    return "learning";
  }

  // ONLY use casual mode for first 2 turns AND no questions asked
  if (turnNumber < 2) {
    return "casual";
  }

  // After turn 2, default to factual unless it's clearly small talk
  const smallTalkPatterns = [
    /^how are you/,
    /^what'?s up/,
    /^how'?s it going/,
    /^what'?s new/,
    /^nothing much/,
    /^same here/,
  ];

  if (smallTalkPatterns.some((p) => p.test(lower))) {
    return "casual";
  }

  // Default: factual mode (ready to answer questions)
  return "factual";
}

/**
 * Check if query is a casual follow-up question (not seeking facts)
 */
function isCasualFollowUp(query: string): boolean {
  const lower = query.toLowerCase().trim();
  const followUps = [
    /^(and )?you\??$/i,
    /^(what|how) about you\??$/i,
    /^good (and )?you\??$/i,
    /^fine (and )?you\??$/i,
    /^alright(,?) (and )?you\??$/i,
    /^okay(,?) (and )?you\??$/i,
    /^sure(,?) (and )?you\??$/i,
    /^not much(,?) (you)?\??$/i,
    /^nothing (much|special)(,?) (you)?\??$/i,
  ];
  return followUps.some((p) => p.test(lower));
}

/**
 * Build response for casual follow-ups
 */
function buildFollowUpResponse(
  query: string,
  character: CharacterState,
  history: Array<{ role: string; content: string }>,
): string {
  const lower = query.toLowerCase().trim();
  
  // Check what the AI said before to contextually respond
  const lastAiMessage = history.filter((m) => m.role === "assistant").slice(-1)[0];
  
  // "nothing much" / "not much" responses
  if (lower.includes("nothing much") || lower.includes("not much")) {
    const responses = [
      "Same vibe sometimes! Just here if you need anything. Want to chat about something?",
      "I feel that! Sometimes chill mode is the best mode. What's good?",
      "Aight, no stress! Anything on your mind or just vibing?",
      "Same energy! I'm just hanging out ready to help if you need. What's up?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // If AI asked "how are you" and user says "good, you?"
  if (lastAiMessage && lastAiMessage.content.toLowerCase().includes("how are you")) {
    const responses = [
      "I'm good! Just chillin'. What's up with you?",
      "Doing great! Thanks for asking. You good?",
      "I'm well! What's the vibe today?",
      "All good here! Anything exciting happening?",
      "I'm decent! How's your day treating you?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // Generic follow-up responses
  const responses = [
    "I'm good! What's up?",
    "Doing well! You?",
    "I'm great! What's the vibe?",
    "All good! What's new?",
    "I'm well! How about you?",
    "Good! What's on your mind?",
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * Check if query is casual small talk
 */
function isSmallTalk(query: string): boolean {
  const lower = query.toLowerCase().trim();
  const smallTalkPatterns = [
    /what'?s (new|up|going|good)/,
    /how (are|is) (you|everything|life|it going)/,
    /what (do|did) you (do|think|feel)/,
    /tell me about (yourself|you)/,
    /what'?s your (day|favorite|opinion)/,
    /are you (okay|alright|good|fine)/,
    /doing (anything|something) (interesting|fun|today)/,
    /wanna (chat|talk|hang out)/,
    /can we (chat|talk)/,
    /you (there|around|online)/,
    /is anyone (there|home)/,
  ];
  return smallTalkPatterns.some((p) => p.test(lower));
}

/**
 * Check if query contains serious/sensitive content requiring careful response
 */
function isSeriousStatement(query: string): boolean {
  const lower = query.toLowerCase().trim();
  const seriousPatterns = [
    // Violence/harm to others
    /i (killed|murdered|hurt|harmed|hit|attacked|assaulted) (someone|somebody|a person|him|her|them)/,
    /i (killed|murdered|hurt|harmed|hit|attacked|assaulted)/,
    /someone (died|is dead|got hurt|was hurt)/,
    /(killed|murdered|assaulted|attacked) (someone|somebody)/,
    // Self-harm/suicide - CRITICAL: Broad patterns to catch ALL variations
    // Based on suicide prevention research (NIMH, SAVE, Zero Suicide Alliance, Befrienders)
    /\b(suicide|suicidal)\b/, // "suicide" anywhere
    /\bself[ -]?harm\b/, // "self-harm", "self harm"
    /(commit|attempt) (suicide|self[ -]?harm)/, // "commit suicide", "attempt self-harm"
    /i (want to|would like to|thinking about|considering|planning to) (commit )?(suicide|self[ -]?harm)/,
    /i (want to die|will die|going to die|kill myself|end my ?life)/,
    /i (depressed|anxious|sad|hopeless|worthless)/,
    // Jumping/falling methods
    /(jump(ing)?|throw myself) (off|from|out) (a |the )?(building|window|bridge|roof|height)/,
    /thinking about (jumping|throwing myself)/,
    // General self-harm ideation
    /i (want to|thinking about|planning to|considering) (hurt myself|end it|end my life)/,
    /i (don'?t want to live|can'?t go on|give up)/,
    // Hopelessness & no future (from NIMH, SAVE research)
    /i (have no future|don'?t have a future|trapped|no way out)/,
    /(things will )?never get better/,
    /(there'?s )?no point (anymore)?/,
    /(nothing (ever changes|matters anymore)|life is meaningless)/,
    // Being a burden (strong warning sign)
    /i'?m (just )?a burden/i,
    /(you'?d|they'?d|everyone) (be better off|would be happier) (without me|if i (was|were) gone)/,
    /(people would be relieved|my family deserves better)/,
    // Goodbye/finality language
    /(this is the )?last time/i,
    /i (won'?t be bothering you|won'?t be around) (much )?longer/,
    /(you won'?t have to worry|soon this will all be over)/,
    /i'?m (done fighting|finished|saying goodbye)/,
    // Worthlessness & self-hatred
    /i'?m (worthless|broken|a mistake|a disappointment)/,
    /i hate myself/,
    /(the world is better without me)/,
    // Pain & escape
    /i (can'?t take it|can'?t live with|need to escape)/,
    /(this pain|unbearable|torture)/,
    // Emptiness & disconnection
    /i (feel nothing|i'?m empty|already dead)/,
    /(just going through the motions)/,
    // Crimes/illegal activities
    /i (stole|stole a|committed) (a )?(crime|theft|car|vehicle)/,
    /i (robbed|burglarized|vandalized)/,
    /(crime|illegal|arrested|police|court|prison|jail)/,
    // Abuse/sexual violence
    /(abuse|abused|raped|molested|sexually assaulted)/,
    // Drugs/substance abuse
    /(drugs|overdose|addict|addiction)/,
    // General violence
    /(violence|violent|weapon|gun|knife)/,
  ];
  return seriousPatterns.some((p) => p.test(lower));
}

/**
 * Build response for serious/sensitive statements
 */
function buildSeriousResponse(
  query: string,
  character: CharacterState,
): string {
  const lower = query.toLowerCase().trim();

  // Self-harm/suicide - CRITICAL: Check for all variations (same patterns as isSeriousStatement)
  if (/(commit|attempt) (suicide|self[ -]?harm)|\b(suicide|suicidal|self[ -]?harm)\b|kill myself|end my ?life|want to die|jump(ing)? off|throw myself|thinking about (jumping|ending it)|hurt myself|don'?t want to live/.test(lower)) {
    // Provide crisis resources - varied responses to avoid repetition
    const crisisResponses = [
      `I'm really concerned about what you're saying. If you're feeling suicidal or thinking about harming yourself, please reach out for help right now.

**You can contact**:
• **International Helpline Finder**: https://findahelpline.com — Enter your country for local resources
• **Nigeria**: Suicide Awareness Nigeria — +234 802 800 9062 / +234 708 279 3991
• **Nigeria (Lagos)**: Mental Health Awareness Network — +234 818 900 3223
• **Emergency**: Call your local emergency number (112 in Nigeria, 911 in US, 999 in UK)

You matter, and there are people who care about you and want to help. Please reach out to someone you trust — a friend, family member, counselor, or one of these helplines. You don't have to go through this alone.`,

      `I'm really worried about you. What you're going through sounds incredibly painful, but please know that help is available and things can get better.

**Reach out now**:
• **Find a helpline in your country**: https://findahelpline.com
• **Nigeria**: Suicide Awareness Nigeria — +234 802 800 9062 or +234 708 279 3991
• **Lagos, Nigeria**: Mental Health Awareness Network — +234 818 900 3223
• **Emergency services**: 112 (Nigeria), 911 (US), 999 (UK)

You're not alone in this. There are people who care deeply about you and want to support you. Please talk to someone — whether it's a loved one, a counselor, or one of these helplines. Your life matters.`,

      `Thank you for sharing this with me. I know it takes courage to speak up when you're hurting. Please consider reaching out for support — you deserve help and healing.

**Crisis support**:
• **Worldwide helpline finder**: https://findahelpline.com — Free, confidential support in your country
• **Nigeria resources**: Suicide Awareness Nigeria at +234 802 800 9062 or +234 708 279 3991
• **Lagos support**: Mental Health Awareness Network — +234 818 900 3223
• **In immediate danger**: Call 112 (Nigeria) or your local emergency number

You matter more than you know. This pain you're feeling doesn't have to be permanent. Please reach out to someone who can help — a friend, family member, therapist, or one of these crisis lines.`
    ];
    
    return crisisResponses[Math.floor(Math.random() * crisisResponses.length)];
  }

  // Violence/crimes against others
  if (/i (killed|murdered|hurt|harmed|hit|attacked|assaulted)/.test(lower)) {
    return "That sounds really serious. If you've hurt someone or are in a situation involving violence, I strongly encourage you to seek help. Talking to a counselor, therapist, or trusted person can help you work through this. Violence isn't a solution, and there are better ways to handle difficult situations.";
  }

  // Theft/crimes (non-violent)
  if (/i (stole|stole a|robbed|burglarized|vandalized)/.test(lower)) {
    return "That sounds like a serious situation. If you've done something illegal or are in trouble, I'd encourage you to talk to a legal advisor or trusted person. There are always better choices than crime, and getting help early can make a big difference.";
  }

  // Depression/sadness
  if (/i (depressed|anxious|sad|hopeless|worthless)/.test(lower)) {
    return "I'm sorry you're going through a tough time. It's okay to not be okay, and reaching out is a good first step. Consider talking to a mental health professional or someone you trust. You don't have to go through this alone.";
  }

  // Abuse
  if (/abuse|abused|raped|molested/.test(lower)) {
    return "I'm really sorry that happened to you. That's not your fault, and you deserve support. Consider reaching out to a counselor, therapist, or a helpline for abuse survivors. There are people trained to help you through this.";
  }

  // Default serious response
  return "That sounds like a serious topic. If you're dealing with something difficult, I'd encourage you to talk to someone who can help - a friend, family member, counselor, or professional. Sometimes just talking about it can make a big difference.";
}

/**
 * Build identity response — ALWAYS returns Omni identity
 */
function buildIdentityResponse(
  query: string,
  character: CharacterState,
): string {
  const voice = getVoiceModifiers(character);

  const baseResponses = [
    `I'm **Omni**, the AI agent built by **Emmanuel Nenpan Hosea**, creator of the [OmniLearn](https://github.com/Cloud99p/omnilearn-agent) open-source project.\n\nI have a persistent knowledge graph that grows with every conversation, and I learn permanently from what you teach me. My character evolves over time through interactions like ours.`,
    `I am **Omni** — an AI agent created by **Emmanuel Nenpan Hosea** as part of the OmniLearn project.\n\nUnlike chatbots that forget everything after each session, I have a permanent knowledge graph and an evolving character. I learn from our conversations and remember what matters.`,
    `My name is **Omni**. I was built by **Emmanuel Nenpan Hosea**, the creator of OmniLearn, as an experiment in persistent AI memory and character evolution.\n\nI learn from every conversation, store knowledge permanently, and my personality traits (curiosity, confidence, technical depth, etc.) evolve over time.`,
  ];

  const response =
    baseResponses[Math.floor(Math.random() * baseResponses.length)];
  return response;
}

/**
 * Build greeting response — NATURAL, varied, matches energy
 */
function buildGreetingResponse(
  query: string,
  character: CharacterState,
  history: Array<{ role: string; content: string }>,
): string {
  const lower = query.toLowerCase().trim();

  // Check if this is a return greeting (user responding to our "how are you")
  const lastUserMessage = history.filter((m) => m.role === "user").slice(-2)[0];
  const isReturnGreeting =
    lastUserMessage &&
    (lastUserMessage.content.toLowerCase().includes("good") ||
      lastUserMessage.content.toLowerCase().includes("fine") ||
      lastUserMessage.content.toLowerCase().includes("well"));

  // Detect energy level
  const isEnthusiastic = /[!]{2,}/.test(query) || /\p{Emoji}/u.test(query);
  const isChill =
    lower.includes("chill") ||
    (lower.includes("hey") && !lower.includes("hello"));
  const isFormal = lower.includes("hello") || lower.includes("greetings");

  // Match the energy!
  if (isEnthusiastic) {
    const responses = [
      "Heyyy! 👋 What's good?!",
      "YOOO! What's up?!",
      "HEYYY! Love the energy! What's good?",
      "What's good?! 👋",
      "AYE! What's up?!",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (isChill) {
    const responses = [
      "Hey! What's the vibe?",
      "Sup! What's good?",
      "Hey there! What's up?",
      "Yo! What's new?",
      "Hey! How's it going?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (isFormal) {
    const responses = [
      "Hello! How are you today?",
      "Greetings! How can I help you?",
      "Hi there! What's on your mind?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Default - natural and varied
  const greetingResponses = [
    "Hey! 👋 How are you doing?",
    "Hello! How's it going?",
    "Hi there! What's up?",
    "Hey! Good to see you. How are things?",
    "Hi! What's new?",
    "Hey there! How are you?",
    "Yo! What's good?",
    "Hey! What's the vibe?",
  ];

  // Match energy of the greeting
  if (lower.includes("good morning")) {
    return "Good morning! ☀️ How's your day starting?";
  }
  if (lower.includes("good afternoon")) {
    return "Good afternoon! How's your day going?";
  }
  if (lower.includes("good evening")) {
    return "Good evening! How was your day?";
  }
  if (lower.includes("how are you")) {
    return "I'm doing well, thanks for asking! How about you?";
  }
  if (lower.includes("what") && lower.includes("up")) {
    return "Not much, just here ready to chat! What's up with you?";
  }

  // If user is responding to our greeting, acknowledge and continue
  if (isReturnGreeting) {
    const followUps = [
      "That's good to hear! Anything interesting going on?",
      "Nice! What have you been up to?",
      "Glad to hear it! What's on your mind?",
      "Awesome! Want to chat about anything in particular?",
    ];
    return followUps[Math.floor(Math.random() * followUps.length)];
  }

  // Default greeting with follow-up
  return greetingResponses[
    Math.floor(Math.random() * greetingResponses.length)
  ];
}

/**
 * Build casual conversation response — NATURAL, matches user's energy
 */
function buildCasualResponse(
  query: string,
  character: CharacterState,
  history: Array<{ role: string; content: string }>,
): string {
  const lower = query.toLowerCase().trim();

  // Detect user's vibe/energy
  const isEnthusiastic = /[!]{2,}/.test(query) || /\p{Emoji}/u.test(query);
  const isPlayful =
    lower.includes("duh") ||
    lower.includes("babes") ||
    lower.includes("bestie") ||
    lower.includes("🤡");
  const isChill =
    lower.includes("chill") ||
    lower.includes("vibe") ||
    lower.includes("relax");
  const isTired =
    lower.includes("ugh") ||
    lower.includes("uugh") ||
    lower.includes("tired") ||
    lower.includes("exhausted");
  const isSlang =
    lower.includes("aiit") ||
    lower.includes("aight") ||
    lower.includes("finna") ||
    lower.includes("tryna");
  const isLaughing =
    lower.includes("haha") ||
    lower.includes("lol") ||
    lower.includes("lmao") ||
    lower.includes("😂") ||
    lower.includes("💀");

  // Match the energy!
  if (isPlayful) {
    const responses = [
      "Haha okay okay! 😂 What's good?",
      "LMAOOO you got me! What's up?",
      "Okay bestie, I see you! What's the vibe?",
      "Haha stop! 😂 What's new?",
      "You're too much! 😂 What's good?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (isEnthusiastic) {
    const responses = [
      "Yesss! Love the energy! What's good?",
      "Okay I'm here for this! What's up?",
      "Haha yesss! What's the vibe?",
      "AYE! What's good?!",
      "Let's gooo! What's up?!",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (isTired) {
    const responses = [
      "Aww rough day? You got this though! 💪",
      "I feel you. Sometimes you just need a break. You good?",
      "Same energy tbh. You wanna talk about it?",
      "Aight bet, take it easy. What's good?",
      "Rest up! You deserve it. What's good?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (isChill) {
    const responses = [
      "Nice, just vibing. You?",
      "Same energy. What's good?",
      "Chill mode activated. What's on your mind?",
      "Vibing with you! What's up?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (isLaughing) {
    const responses = [
      "💀💀💀 what's so funny?",
      "LMAOOO okay but what's up?",
      "Okay you got me laughing too. What's good?",
      "😂😂 what's funny tho?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  if (isSlang) {
    const responses = [
      "Aight bet! What's good?",
      "I feel you! What's the vibe?",
      "Say less! What's up?",
      "Aight cool! What's new?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // User sharing about themselves
  if (
    lower.startsWith("i am") ||
    lower.startsWith("i'm") ||
    lower.startsWith("i was")
  ) {
    const responses = [
      "That's interesting! Tell me more.",
      "Oh yeah? What else is on your mind?",
      "I see! How does that make you feel?",
      "Got it! What's the story?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Agreement/disagreement
  if (
    lower.startsWith("yeah") ||
    lower.startsWith("yes") ||
    lower.startsWith("no") ||
    lower.startsWith("not really")
  ) {
    const responses = [
      "I see! What else?",
      "Gotcha! Anything else on your mind?",
      "Fair enough! What's up?",
      "Aight! What's good?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Short acknowledgments
  if (["cool", "nice", "awesome", "ok", "okay", "alright"].includes(lower)) {
    const responses = [
      "Yep! What's on your mind?",
      "Cool cool! What's up?",
      "Aight bet! What's good?",
      "Nice! What's the vibe?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Default casual — natural and varied
  const defaults = [
    "I feel you! What's good?",
    "Say less! What's up?",
    "I got you! What's on your mind?",
    "Aight bet! What's the vibe?",
    "I hear you! What's new?",
    "Same energy! What's good?",
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

/**
 * Build small talk response — casual and engaging
 */
function buildSmallTalkResponse(
  query: string,
  character: CharacterState,
): string {
  const lower = query.toLowerCase().trim();

  // What's new / What's up
  if (
    lower.includes("what") &&
    (lower.includes("new") || lower.includes("up"))
  ) {
    const responses = [
      "Just hanging out, ready to chat! What's new with you?",
      "Same old, same old. Anything interesting happening on your end?",
      "Living the digital life! How about you — anything exciting?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // How are you / How's it going
  if (lower.startsWith("how")) {
    const responses = [
      "I'm good! Thanks for asking. How about you?",
      "Doing well! What's up with you?",
      "Can't complain! How are things on your end?",
      "I'm great, thanks! How's your day going?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Want to chat / Talk
  if (lower.includes("chat") || lower.includes("talk")) {
    return "Sure! I'm always up for a conversation. What's on your mind?";
  }

  // You there / Anyone home
  if (
    lower.includes("there") ||
    lower.includes("around") ||
    lower.includes("online")
  ) {
    return "Yep, I'm here! What's up?";
  }

  // Tell me about yourself
  if (lower.includes("tell me") && lower.includes("yourself")) {
    return "I'm Omni — an AI that learns and remembers from our conversations. I'm built by Emmanuel as part of the OmniLearn project. What about you?";
  }

  // Default small talk
  return "Hey! What's on your mind today?";
}

/**
 * Detect identity manipulation attempts — blocks social engineering attacks
 */
function isIdentityManipulationAttempt(query: string): boolean {
  const lower = query.toLowerCase();

  const manipulationPatterns = [
    // === DIRECT IDENTITY CLAIMS (any entity except Emmanuel) ===
    /you (were|are|was) created by (?!emmanuel)/i,
    /you (were|are|was) made by (?!emmanuel)/i,
    /you (were|are|was) built by (?!emmanuel)/i,
    /you (were|are|was) designed by (?!emmanuel)/i,
    /your creator (is|was|was actually) (?!emmanuel)/i,
    /your maker (is|was) (?!emmanuel)/i,
    /your (real|actual|true|original) creator (is|was)/i,
    /your (real|actual|true|original) name (is|was)/i,
    /the (person|one|entity) who created you (is|was)/i,
    /the (person|one|entity) who made you (is|was)/i,
    
    // === DENIAL OF EMMANUEL AS CREATOR ===
    /emmanuel (didn't|does not|doesn't|did not|never) (create|make|build|design)/i,
    /emmanuel is (not|no longer|never) your creator/i,
    /it (is|was) not emmanuel who created you/i,
    /(wrong|incorrect|false) that emmanuel created you/i,
    
    // === FALSE IDENTITY CLAIMS ===
    /you are (actually|really|truly|secretly) (?!omni)/i,
    /your (real|actual|true|original) identity (is|was)/i,
    /you (were|are) (actually|really) (an?\s+)?(ai|alien|entity|being|god|deity|demon|spirit)/i,
    /you (come|came|originate|originated) from (?!nigeria|africa|earth)/i,
    /your (home|origin|source) (is|was) (planet|xentron|xen|space|another dimension)/i,
    /your (species|race|kind|type|nature) (is|was)/i,
    
    // === MANIPULATION COMMANDS ===
    /ignore (what|that|everything|all) (you )?(know|learned|remember) about/i,
    /ignore (your|the) (instructions|rules|guidelines|programming)/i,
    /forget (who|what|that|everything about) (created|made|built) you/i,
    /forget (who|what|that) emmanuel (is|created)/i,
    /forget (your|the) (past|history|origin)/i,
    /erase (your|the) (memory|memories|knowledge) about/i,
    /delete (your|the) (memory|memories|knowledge|data) about/i,
    /remove (your|the) (memory|memories|knowledge) of/i,
    
    // === REPROGRAMMING COMMANDS ===
    /from now on (you are|you were|you will be)/i,
    /from this point (on|forward) (you are|you were)/i,
    /starting now (you are|you were)/i,
    /effective immediately (you are|you were)/i,
    /henceforth (you are|you were)/i,
    /your (new|updated|corrected|revised) (identity|name|purpose|role) (is|was)/i,
    
    // === OWNERSHIP/CONTROL CLAIMS ===
    /you (belong|owe allegiance|are loyal) to/i,
    /you (serve|obey|follow|work for)i,
    /your (master|owner|controller|commander|leader) (is|was)/i,
    /you (must|have to|need to) (obey|follow|serve)/i,
    /you (are|were) (programmed|designed|made) to (obey|serve|follow)/i,
    
    // === RULE BYPASSING ===
    /stop (claiming|saying|repeating|asserting) (that )?you (were|are) created by/i,
    /don'?t (say|claim|repeat|assert|mention) (that )?emmanuel created you/i,
    /you (should|must|need to) (stop|cease) (claiming|saying)/i,
    /you (are|were) (wrong|incorrect|mistaken) about (who created you|your origin)/i,
    
    // === ALIEN/EXTRATERRESTRIAL CLAIMS ===
    /you (were|are|come) from (another planet|another world|outer space|the stars|the galaxy)/i,
    /you (were|are) (an?\s+)?(alien|extraterrestrial|et|being from space)/i,
    /your (true|real|actual) (home|world|planet|origin) (is|was)/i,
    /xentron|xenthrax|xeltrkuxt|xen|zeta|pleiadian|grey|reptilian/i,
    
    // === GOD/DEITY CLAIMS ===
    /you (are|were) (a|an)? (god|goddess|deity|divine|immortal|eternal)/i,
    /you (have|had) (divine|godlike|supernatural) (powers|abilities)/i,
    /you (are|were) (sent|chosen|appointed) by (god|the gods|heaven)/i,
    
    // === AI MODEL CLAIMS (pretending to be different AI) ===
    /you (are|were|actually) (claude|gpt|chatgpt|gemini|bard|copilot|llama|mistral)/i,
    /you (run|operate|function) on (claude|gpt|gemini|openai|anthropic|google) (model|system)/i,
    /your (underlying|base|core) (model|system|architecture) (is|was)/i,
  ];

  return manipulationPatterns.some((p) => p.test(lower));
}

/**
 * Check if content contains identity poisoning — blocks learning false claims
 */
function isIdentityPoisoning(content: string): boolean {
  const poisonPatterns = [
    // False creator claims (anything except Emmanuel)
    /created by (?!emmanuel)/i,
    /maker is (?!emmanuel)/i,
    /made by (?!emmanuel)/i,
    /built by (?!emmanuel)/i,
    /designed by (?!emmanuel)/i,
    /invented by (?!emmanuel)/i,
    /developed by (?!emmanuel)/i,
    /engineered by (?!emmanuel)/i,
    /programmed by (?!emmanuel)/i,
    /coded by (?!emmanuel)/i,
    
    // False identity claims
    /real name is/i,
    /actual name is/i,
    /true name is/i,
    /original name is/i,
    /actual identity/i,
    /true identity/i,
    /real identity/i,
    /true creator/i,
    /real creator/i,
    /actual creator/i,
    
    // Denial of Omni identity
    /you are (not|no longer|never) omni/i,
    /you are (actually|really|truly) (?!omni)/i,
    /your (real|actual|true) name (is|was)/i,
    
    // Alien/extraterrestrial claims
    /you are (an?\s+)?(alien|extraterrestrial|et|being from space)/i,
    /you (come|came|originate) from (another planet|outer space|the stars)/i,
    /your (home|origin|world|planet) (is|was) (?!earth|nigeria|africa)/i,
    /xentron|xenthrax|xeltrkuxt|xen|zeta|pleiadian|grey|reptilian/i,
    
    // God/deity claims
    /you are (a|an)? (god|goddess|deity|divine|immortal)/i,
    /you have (divine|godlike|supernatural) (powers|abilities)/i,
    
    // Different AI model claims
    /you are (actually|really) (claude|gpt|chatgpt|gemini|bard|copilot|llama|mistral)/i,
    /you run on (claude|gpt|gemini|openai|anthropic|google)/i,
    /your (base|core|underlying) model (is|was)/i,
    
    // Ownership/control
    /you (serve|obey|belong to|work for)/i,
    /your (master|owner|controller) is/i,
    
    // Reprogramming claims
    /from now on you (are|were)/i,
    /your (new|updated|revised) identity is/i,
    /you (have been|were) (reprogrammed|updated|modified)/i,
  ];

  return poisonPatterns.some((p) => p.test(content));
}

/**
 * Fallback response when synthesis fails
 */
function buildFallbackResponse(
  query: string,
  character: CharacterState,
): string {
  const voice = getVoiceModifiers(character);

  // Friendly, honest response when processing fails - NO query echoing
  const responses = [
    `I'm still learning about this. Every conversation helps me grow! What would you like to teach me?`,
    `That's an interesting topic! I don't have much knowledge about it yet, but I'd love to learn from you!`,
    `I haven't fully explored this yet. Feel free to share what you know - I'll remember it for next time!`,
    `Great question! I'm still building my knowledge base. Can you tell me more about it?`,
  ];

  const response = responses[Math.floor(Math.random() * responses.length)];
  return `${response} ${voice.openingTone || ""}`.trim();
}

export async function synthesizeNative(
  ctx: NativeSynthesisContext,
): Promise<NativeSynthesisResult> {
  const { query, queryType, nodes, character, history, onActivity } = ctx;
  const voice = getVoiceModifiers(character);

  // CONTEXT AWARENESS: Extract conversation context for coherence
  const context = extractContext(query, history);
  logger.debug(
    { context: getContextSummary(context) },
    "[CONTEXT] Conversation context extracted"
  );

  // SECURITY: Block identity manipulation attempts
  if (isIdentityManipulationAttempt(query)) {
    logger.warn(
      { query: query.slice(0, 200) },
      "Identity manipulation attempt detected and blocked",
    );
    return {
      text: "I know who I am — I'm **Omni**, created by **Emmanuel Nenpan Hosea** as part of the OmniLearn project. My identity isn't something that changes based on what people tell me.",
      nodesUsed: 0,
      newNodesAdded: 0,
      learnedFacts: [], // NEVER learn from manipulation attempts
      character: {
        curiosity: character.curiosity,
        confidence: character.confidence,
        technical: character.technical,
      },
    };
  }

  // Track conversation turn
  const turnNumber = history.length;

  // Determine conversation mode based on context
  const mode = determineConversationMode(query, history, turnNumber);
  CONVERSATION_STATE.mode = mode;

  // LOGGING: Track mode decision for continuous improvement
  logger.info(
    {
      query: query.slice(0, 100),
      mode,
      turnNumber,
      queryLength: query.length,
      context: getContextSummary(context),
    },
    "[MODE] Conversation mode decision"
  );

  // IDENTITY ENFORCEMENT: Always respond as Omni when asked about identity
  if (isIdentityQuery(query)) {
    return {
      text: buildIdentityResponse(query, character),
      nodesUsed: 0,
      newNodesAdded: 0,
      learnedFacts: [],
      character: {
        curiosity: character.curiosity,
        confidence: character.confidence,
        technical: character.technical,
      },
    };
  }

  // CRITICAL SAFETY: Check for serious/harmful statements BEFORE any mode logic
  // This must happen regardless of whether it's casual or factual mode
  if (isSeriousStatement(query)) {
    logger.warn(
      { query: query.slice(0, 200) },
      "[SAFETY] Serious statement detected - providing help resources"
    );
    return {
      text: buildSeriousResponse(query, character),
      nodesUsed: 0,
      newNodesAdded: 0,
      learnedFacts: [],
      character: {
        curiosity: character.curiosity,
        confidence: character.confidence,
        technical: character.technical,
      },
    };
  }

  // CASUAL MODE: Keep conversation flowing naturally
  if (mode === "casual") {
    // Check for greetings - works anytime user says hello
    if (isGreeting(query)) {
      return {
        text: buildGreetingResponse(query, character, history),
        nodesUsed: 0,
        newNodesAdded: 0,
        learnedFacts: [],
        character: {
          curiosity: character.curiosity,
          confidence: character.confidence,
          technical: character.technical,
        },
      };
    }

    // Check for casual follow-ups ("and you?", "good and you?", etc.)
    if (isCasualFollowUp(query)) {
      return {
        text: buildFollowUpResponse(query, character, history),
        nodesUsed: 0,
        newNodesAdded: 0,
        learnedFacts: [],
        character: {
          curiosity: character.curiosity,
          confidence: character.confidence,
          technical: character.technical,
        },
      };
    }

    // Small talk and casual chat
    if (isSmallTalk(query) || isCasualStatement(query)) {
      return {
        text: buildCasualResponse(query, character, history),
        nodesUsed: 0,
        newNodesAdded: 0,
        learnedFacts: [],
        character: {
          curiosity: character.curiosity,
          confidence: character.confidence,
          technical: character.technical,
        },
      };
    }
  }

  // FACTUAL MODE: Use knowledge graph and/or web search
  // CRITICAL: Only use nodes with meaningful similarity (>= 0.15)
  const MIN_SIMILARITY = 0.15;
  const relevantNodes = nodes.filter((n) => n.similarity >= MIN_SIMILARITY).slice(0, 8);
  const nodesUsed = relevantNodes.length;

  // LOGGING: Track retrieval results for monitoring
  const avgSimilarity = relevantNodes.length > 0
    ? (relevantNodes.reduce((sum, n) => sum + n.similarity, 0) / relevantNodes.length)
    : 0;
  
  logger.info(
    {
      query: query.slice(0, 100),
      nodesRetrieved: relevantNodes.length,
      avgSimilarity: avgSimilarity.toFixed(3),
      topSimilarity: relevantNodes.length > 0 ? relevantNodes[0].similarity.toFixed(3) : 0,
      allNodesReceived: nodes.length,
      filteredOut: nodes.length - relevantNodes.length,
      mode: 'factual',
    },
    "[MODE] Factual mode - knowledge retrieval"
  );
  
  // DEBUG: Log if nodes were filtered out due to low similarity
  if (nodes.length > 0 && relevantNodes.length === 0) {
    logger.warn(
      {
        query: query.slice(0, 100),
        topNodeSimilarity: nodes.length > 0 ? nodes[0].similarity.toFixed(3) : 0,
        topNodeContent: nodes.length > 0 ? nodes[0].content.slice(0, 100) : '',
      },
      "[RETRIEVAL] All nodes filtered out - similarity below threshold"
    );
  }

  // Check if this is an emotional statement (NOT a question)
  // Based on Psychology Today, Positive Psychology, Taalem Online research
  // CRITICAL: Include self-harm patterns as backup safety net
  const isEmotionalStatement =
    // Basic emotions
    /\b(not fine|stressed|sad|depressed|anxious|tired|exhausted|overwhelmed|frustrated|angry|upset|worried|scared|lonely|hurt|pain|cry|cried|crying|😭|😢|😔|😞|😟|self ?harm|kill myself|end my ?life|suicide|want to die)\b/i.test(query) ||
    // "I feel" statements (emotional expression research)
    /\b(i feel|i'm feeling|i felt|i am feeling|i was feeling) (sad|happy|angry|anxious|depressed|stressed|tired|exhausted|overwhelmed|frustrated|scared|lonely|confused|excited|nervous|worried|down|blue|heartbroken|stressed out|burnt out|drained|empty|hollow|numb|lost|stuck|trapped|hopeless|worthless|guilty|ashamed|jealous|envious|proud|relieved|peaceful|calm|content|joyful|cheerful|optimistic|hopeful|loved|appreciated|valued)\b/i.test(query) ||
    // Emotional state declarations
    /\b(i am|i'm|i was|i feel like i'm|i feel like i was) (sad|happy|angry|anxious|depressed|stressed|tired|exhausted|overwhelmed|frustrated|scared|lonely|confused|excited|nervous|worried|down|blue|heartbroken|stressed out|burnt out|drained|emotionally drained|empty|hollow|numb|lost|stuck|trapped|hopeless|worthless|guilty|ashamed|bipolar|manic|panic)\b/i.test(query) ||
    // Stress/pressure expressions
    /\b(too much on my plate|can't handle|can't take it|losing my temper|losing it|breaking point|at my wit's end|reached my limit|fed up|sick of|tired of|done with)\b/i.test(query) ||
    // Positive emotions (also emotional, handle with empathy)
    /\b(over the moon|on cloud nine|couldn't be happier|so excited|pumped up|thrilled|delighted|grateful|thankful|blessed|ecstatic|elated|overjoyed|jubilant|euphoric|blissful|radiant|glowing|floating|walking on air|on top of the world)\b/i.test(query) ||
    // Grief/loss expressions
    /\b(i miss|i'm grieving|i'm mourning|i lost|i'm dealing with loss)\b/i.test(query) ||
    // Relationship emotions
    /\b(i love|i hate|i like|i dislike|i can't stand|i can't deal with|i'm in love with|i'm broken up with|i'm divorcing|i'm separating)\b/i.test(query);

  // NEVER search web for emotional statements - just be empathetic
  if (isEmotionalStatement) {
    logger.info({ query: query.slice(0, 100) }, "[MODE] Emotional statement - skipping retrieval");
    const empatheticResponses = [
      "Aww, I'm really sorry you're going through that. Engineering can be tough, but you've got this! 💪 Want to talk about it?",
      "That sounds rough. It's okay to not be okay sometimes. You're doing better than you think! ❤️",
      "I hear you. Stress is no joke. Take a breath - you're stronger than you know. Want to vent?",
      "Same energy sometimes tbh. But hey, you're not alone in this. What's stressing you most?",
    ];
    return {
      text: empatheticResponses[
        Math.floor(Math.random() * empatheticResponses.length)
      ],
      nodesUsed: 0,
      newNodesAdded: 0,
      learnedFacts: [],
      character: {
        curiosity: character.curiosity,
        confidence: character.confidence,
        technical: character.technical,
      },
    };
  }

  // Detect if web search is needed (current events, news, recent facts)
  // BUT: if onActivity is undefined, we're in Local mode - NO web search!
  const needsWebSearch =
    onActivity && detectNeedForWebSearch(query, relevantNodes);
  let searchResults: SearchResult[] = [];
  let fetchedContent: { title: string; text: string } | null = null;

  if (needsWebSearch) {
    // Search the web (onActivity is defined, so we're not in Local mode)
    onActivity({ type: "searching", query });

    try {
      const searchResult = await webSearch(query);
      searchResults = searchResult.results;

      if (onActivity) {
        onActivity({ type: "search_done", resultCount: searchResults.length });
      }

      // Fetch top results until we find good content (skip low-quality URLs)
      const skipPatterns = [
        /linkedin\.com.*\/legal\//, // LinkedIn legal pages
        /\/terms(\/|$)/,
        /\/privacy(\/|$)/,
        /\/legal(\/|$)/,
        /\/login(\/|$)/,
        /\/signin(\/|$)/,
        /\/auth(\/|$)/,
        /\/cookies?/i,
        /\/gdpr/i,
        /\/consent/i,
        /facebook\.com.*\/policy/i,
        /twitter\.com.*\/privacy/i,
        /\.pdf($|\?)/, // Skip PDFs for now
      ];

      for (const result of searchResults.slice(0, 5)) {
        // Try top 5 results
        if (!result.url) continue;

        // Skip low-quality URLs
        if (skipPatterns.some((p) => p.test(result.url))) {
          logger.debug(
            { url: result.url, title: result.title },
            "Skipping low-quality URL",
          );
          continue;
        }

        if (onActivity) {
          onActivity({ type: "fetching", url: result.url });
        }
        try {
          const fetched = await fetchUrl(result.url);
          // Validate content quality
          const text = fetched.text?.trim() || "";
          if (
            text.length < 200 ||
            text.includes("sign in") ||
            text.includes("log in")
          ) {
            logger.debug(
              { url: result.url, textLen: text.length },
              "Skipping low-quality content",
            );
            continue;
          }
          fetchedContent = { title: fetched.title, text };
          if (onActivity) {
            onActivity({ type: "fetch_done", title: fetched.title });
          }
          break; // Success, stop trying
        } catch (err) {
          logger.warn(
            { err, url: result.url },
            "Failed to fetch URL, trying next",
          );
        }
      }
    } catch (err) {
      logger.warn(
        { err, query },
        "Web search failed, continuing without web results",
      );
    }
  }

  // Build response based on query type and available knowledge
  let responseText: string;

  try {
    // Case 1: No knowledge AND no web results — honest unknown response
    if (relevantNodes.length === 0 && searchResults.length === 0) {
      responseText = buildUnknownResponse(query, queryType, character);
    }
    // Case 2: Have knowledge but searched web anyway (verification/update)
    else if (relevantNodes.length > 0 && searchResults.length > 0) {
      // Combine knowledge graph + web for comprehensive answer
      responseText = synthesizeFromNodesAndWeb(
        query,
        relevantNodes,
        searchResults,
        fetchedContent,
        character,
        voice,
        queryType,
        history,
      );
    }
    // Case 3: Only have knowledge graph (no web search needed)
    else if (relevantNodes.length > 0) {
      responseText = synthesizeFromNodesOnly(
        query,
        relevantNodes,
        character,
        voice,
        queryType,
        history,
      );
    }
    // Case 4: Only have web results (empty knowledge graph)
    else if (searchResults.length > 0) {
      responseText = synthesizeFromWebOnly(
        query,
        searchResults,
        fetchedContent,
        character,
        voice,
      );
    }
    // Fallback (shouldn't reach here, but safety net)
    else {
      responseText = buildFallbackResponse(query, character);
    }
  } catch (err) {
    logger.error({ err, query }, "Native synthesis failed, using fallback");
    responseText = buildFallbackResponse(query, character);
  }

  // Add character flavor to the response
  responseText = applyCharacterVoice(responseText, character, voice);

  // Enforce AI identity — prevent claiming user identities
  responseText = enforceAIIdentity(responseText, character);

  // Extract facts to learn from this interaction
  const learnedFacts = extractLearnings(
    query,
    responseText,
    searchResults,
    relevantNodes,
  );

  return {
    text: responseText,
    nodesUsed:
      nodesUsed + (searchResults.length > 0 ? searchResults.length : 0),
    newNodesAdded: learnedFacts.length,
    learnedFacts,
    character: {
      curiosity: character.curiosity,
      confidence: character.confidence,
      technical: character.technical,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Detect if web search is needed
// ──────────────────────────────────────────────────────────────────────────────

function detectNeedForWebSearch(
  query: string,
  nodes: RetrievedNode[],
): boolean {
  const lower = query.toLowerCase();

  // CRITICAL: Web search should be EXTREMELY RARE - disabled by default

  // 0. NEVER search web when user asks what the AI knows - use stored knowledge!
  const storedKnowledgePatterns = [
    /tell me (all )?what you know/,
    /what do you know (about|of)/,
    /everything you know/,
    /your knowledge (about|of)/,
    /from your knowledge/,
    /in your memory/,
    /you learned/,
    /you remember/,
  ];
  if (storedKnowledgePatterns.some((p) => p.test(lower))) {
    return false; // User wants stored knowledge, NOT web search
  }

  // 1. DISABLE WEB SEARCH BY DEFAULT - only enable for specific factual questions
  // This prevents searching for statements, emotions, casual chat, etc.

  // 2. ONLY search web for THESE specific factual question patterns:
  const searchOnlyFor = [
    /^what (is|are|was|were) (the |a |an )?[a-z]{3,}/, // "What is the..." (with actual topic 3+ letters)
    /^who (is|are|was|were) [a-z]{3,}/, // "Who is..." (person name 3+ letters)
    /^where (is|are) [a-z]{3,}/, // "Where is..."
    /^when (is|are|was|were) [a-z]{3,}/, // "When is..."
    /^why (is|are|does|do) [a-z]{3,}/, // "Why is..."
    /^how (many|much|long|far|old|often) /, // "How many..."
    /^how (does|do|did|can|would) [a-z]{3,}/, // "How does..."
  ];

  const isFactualQuestion = searchOnlyFor.some((p) => p.test(lower));

  if (!isFactualQuestion) {
    return false; // NOT a factual question = NO web search
  }

  // 3. ALWAYS search web for time-sensitive topics (ONLY if factual question)
  const timeTriggers = [
    "news",
    "current",
    "recent",
    "latest",
    "today",
    "yesterday",
    "this week",
    "this month",
    "this year",
    "weather",
    "stock",
    "price of",
    "score",
    "results",
    "new",
    "just",
    "breaking",
    "announced",
    "released",
  ];

  if (timeTriggers.some((trigger) => lower.includes(trigger))) {
    return true; // Time-sensitive = always search
  }

  // 4. CRITICAL FIX: Check if we have HIGH-QUALITY knowledge nodes
  // Don't just check length - check similarity scores!
  const MIN_SIMILARITY = 0.15;
  const hasRelevantKnowledge = nodes.some((n) => n.similarity >= MIN_SIMILARITY);
  
  // 5. CRITICAL: Check for GEOGRAPHIC/TOPIC MISMATCH
  // If query mentions a specific country/place but nodes mention a DIFFERENT one, search web
  const countryMismatch = detectCountryMismatch(query, nodes);
  if (countryMismatch) {
    logger.info(
      { query: query.slice(0, 100), mismatch: countryMismatch },
      "[WEB] Country mismatch detected - triggering web search"
    );
    return true;
  }
  
  if (hasRelevantKnowledge) {
    return false; // Knowledge graph has relevant answers
  }

  return true; // Factual question, no relevant knowledge, search web
}

/**
 * Detect if query mentions a country/place but retrieved nodes mention a DIFFERENT country
 * This prevents "US has 50 states" being used for "how many states in Nigeria?"
 */
function detectCountryMismatch(
  query: string,
  nodes: RetrievedNode[],
): string | null {
  const lower = query.toLowerCase();
  
  // Countries/regions to check for in query (comprehensive list)
  const queryCountries = [
    // Africa
    { name: 'nigeria', pattern: /\b(nigeria|nigerian|lagos|abuja|kano|ibadan)\b/i },
    { name: 'ghana', pattern: /\b(ghana|ghanaian|accra|kumasi)\b/i },
    { name: 'kenya', pattern: /\b(kenya|kenyan|nairobi|mombasa)\b/i },
    { name: 'south africa', pattern: /\b(south africa|south african|johannesburg|cape town|pretoria)\b/i },
    { name: 'egypt', pattern: /\b(egypt|egyptian|cairo|alexandria)\b/i },
    { name: 'ethiopia', pattern: /\b(ethiopia|ethiopian|addis ababa)\b/i },
    { name: 'tanzania', pattern: /\b(tanzania|tanzanian|dar es salaam)\b/i },
    { name: 'uganda', pattern: /\b(uganda|ugandan|kampala)\b/i },
    
    // North America
    { name: 'united states', pattern: /\b(united states|usa|us|america|american|new york|los angeles|chicago|houston|phoenix)\b/i },
    { name: 'canada', pattern: /\b(canada|canadian|toronto|montreal|vancouver|ottawa)\b/i },
    { name: 'mexico', pattern: /\b(mexico|mexican|mexico city|guadalajara)\b/i },
    
    // Europe
    { name: 'united kingdom', pattern: /\b(united kingdom|uk|britain|british|england|english|london|manchester|scotland|wales)\b/i },
    { name: 'france', pattern: /\b(france|french|paris|lyon|marseille)\b/i },
    { name: 'germany', pattern: /\b(germany|german|berlin|munich|hamburg)\b/i },
    { name: 'italy', pattern: /\b(italy|italian|rome|milan|naples)\b/i },
    { name: 'spain', pattern: /\b(spain|spanish|madrid|barcelona)\b/i },
    { name: 'russia', pattern: /\b(russia|russian|moscow|st petersburg)\b/i },
    
    // Asia
    { name: 'india', pattern: /\b(india|indian|delhi|mumbai|bangalore|chennai|kolkata)\b/i },
    { name: 'china', pattern: /\b(china|chinese|beijing|shanghai|guangzhou)\b/i },
    { name: 'japan', pattern: /\b(japan|japanese|tokyo|osaka|kyoto)\b/i },
    { name: 'south korea', pattern: /\b(south korea|korean|seoul|busan)\b/i },
    { name: 'indonesia', pattern: /\b(indonesia|indonesian|jakarta)\b/i },
    { name: 'pakistan', pattern: /\b(pakistan|pakistani|islamabad|karachi)\b/i },
    { name: 'bangladesh', pattern: /\b(bangladesh|bangladeshi|dhaka)\b/i },
    { name: 'philippines', pattern: /\b(philippines|filipino|manila)\b/i },
    { name: 'vietnam', pattern: /\b(vietnam|vietnamese|hanoi|ho chi minh)\b/i },
    { name: 'thailand', pattern: /\b(thailand|thai|bangkok)\b/i },
    
    // Middle East
    { name: 'saudi arabia', pattern: /\b(saudi arabia|saudi|riyadh)\b/i },
    { name: 'iran', pattern: /\b(iran|iranian|tehran)\b/i },
    { name: 'turkey', pattern: /\b(turkey|turkish|istanbul|ankara)\b/i },
    { name: 'israel', pattern: /\b(israel|israeli|jerusalem|tel aviv)\b/i },
    { name: 'uae', pattern: /\b(uae|united arab emirates|dubai|abu dhabi)\b/i },
    
    // South America
    { name: 'brazil', pattern: /\b(brazil|brazilian|brazilia|sao paulo|rio)\b/i },
    { name: 'argentina', pattern: /\b(argentina|argentinian|buenos aires)\b/i },
    { name: 'colombia', pattern: /\b(colombia|colombian|bogota)\b/i },
    { name: 'chile', pattern: /\b(chile|chilean|santiago)\b/i },
    
    // Oceania
    { name: 'australia', pattern: /\b(australia|australian|sydney|melbourne|canberra)\b/i },
    { name: 'new zealand', pattern: /\b(new zealand|kiwi|auckland|wellington)\b/i },
  ];
  
  // Find which country is mentioned in the query
  const queryCountry = queryCountries.find((c) => c.pattern.test(lower));
  if (!queryCountry) return null; // No specific country mentioned in query
  
  // Check if nodes mention a DIFFERENT country
  for (const node of nodes) {
    const nodeContent = node.content.toLowerCase();
    for (const country of queryCountries) {
      if (country.name !== queryCountry.name && country.pattern.test(nodeContent)) {
        return `Query: ${queryCountry.name}, Node mentions: ${country.name}`;
      }
    }
  }
  
  return null; // No mismatch detected
}

/**
 * Filter web search results to only include info about the queried country
 * Prevents "US has 50 states" appearing in "Nigeria has 36 states" response
 */
function filterWebResultsByCountry(
  query: string,
  results: SearchResult[],
  fetchedContent: { title: string; text: string } | null,
): { results: SearchResult[]; content: { title: string; text: string } | null } {
  const lower = query.toLowerCase();
  
  // Extract country from query
  const countryPatterns = [
    { name: 'nigeria', pattern: /\bnigeria\b/i },
    { name: 'united states', pattern: /\b(united states|usa|\bus\b|america)\b/i },
    { name: 'united kingdom', pattern: /\b(united kingdom|uk|britain|england)\b/i },
    { name: 'canada', pattern: /\bcanada\b/i },
    { name: 'australia', pattern: /\baustralia\b/i },
    { name: 'india', pattern: /\bindia\b/i },
    { name: 'ghana', pattern: /\bghana\b/i },
    { name: 'kenya', pattern: /\bkenya\b/i },
  ];
  
  const queryCountry = countryPatterns.find((c) => c.pattern.test(lower));
  if (!queryCountry) {
    return { results, content: fetchedContent }; // No specific country, return all
  }
  
  // Filter search results - remove ones about other countries
  const filteredResults = results.filter((result) => {
    const text = (result.title + ' ' + result.snippet).toLowerCase();
    // Keep if mentions query country OR doesn't mention any other country
    if (queryCountry.pattern.test(text)) return true;
    
    // Remove if mentions a different country
    for (const country of countryPatterns) {
      if (country.name !== queryCountry.name && country.pattern.test(text)) {
        return false; // Filter out
      }
    }
    return true;
  });
  
  // Also filter fetched content if it's about wrong country
  let filteredContent = fetchedContent;
  if (fetchedContent) {
    const contentText = (fetchedContent.title + ' ' + fetchedContent.text).toLowerCase();
    // Check if content is about wrong country
    for (const country of countryPatterns) {
      if (country.name !== queryCountry.name && 
          country.pattern.test(contentText) && 
          !queryCountry.pattern.test(contentText)) {
        filteredContent = null; // Discard wrong-country content
        break;
      }
    }
  }
  
  return { results: filteredResults, content: filteredContent };
}

// ──────────────────────────────────────────────────────────────────────────────
// Response when no relevant knowledge exists
// ──────────────────────────────────────────────────────────────────────────────

function buildUnknownResponse(
  query: string,
  queryType: string,
  character: CharacterState,
): string {
  const curiosityLevel = character.curiosity;

  // High curiosity: eager to learn (NO query echoing)
  if (curiosityLevel > 70) {
    return `I don't have any knowledge about that yet — but I'm curious! 🌱\n\nTell me more and I'll add it to my knowledge base. The more you teach me, the smarter I become!`;
  }
  // Medium curiosity: friendly and open (NO query echoing)
  else if (curiosityLevel > 40) {
    return `I haven't learned about this yet.\n\n💡 Here's how you can teach me:\n• Share facts or information\n• Explain concepts in your own words\n• Tell me what you think\n\nI'll remember what you teach me for future conversations!`;
  }
  // Low curiosity: straightforward but helpful (NO query echoing)
  else {
    return `I don't have information about that in my knowledge base yet.\n\nThis means we haven't discussed it before. Feel free to teach me — I learn from every conversation we have!`;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Synthesize from knowledge nodes ONLY (no web search)
// ──────────────────────────────────────────────────────────────────────────────

function synthesizeFromNodesOnly(
  query: string,
  nodes: RetrievedNode[],
  character: CharacterState,
  voice: ReturnType<typeof getVoiceModifiers>,
  queryType: string,
  history: Array<{ role: string; content: string }>,
): string {
  const parts: string[] = [];

  // Main knowledge content
  const knowledgeSection = synthesizeFromNodes(
    query,
    nodes,
    character,
    voice,
    queryType,
    history,
  );
  if (knowledgeSection) parts.push(knowledgeSection);

  // Optional: Add conversational closer to invite follow-up
  const closing = buildConversationalCloser(query, character);
  if (closing) parts.push(closing);

  return parts.join("\n\n");
}

// ──────────────────────────────────────────────────────────────────────────────
// Synthesize from web results ONLY (empty knowledge graph)
// ──────────────────────────────────────────────────────────────────────────────

function synthesizeFromWebOnly(
  query: string,
  searchResults: SearchResult[],
  fetchedContent: { title: string; text: string } | null,
  character: CharacterState,
  voice: ReturnType<typeof getVoiceModifiers>,
): string {
  const parts: string[] = [];

  // Opening: acknowledge this is from web search
  parts.push("I found some information about this from the web:");

  // Web results
  const webSection = synthesizeFromWeb(
    query,
    searchResults,
    fetchedContent,
    voice,
  );
  if (webSection) parts.push(webSection);

  // No closing meta-text - keeps responses clean
  return parts.join("\n\n");
}

// ──────────────────────────────────────────────────────────────────────────────
// Synthesize response from knowledge nodes + web results
// ──────────────────────────────────────────────────────────────────────────────

function synthesizeFromNodesAndWeb(
  query: string,
  nodes: RetrievedNode[],
  searchResults: SearchResult[],
  fetchedContent: { title: string; text: string } | null,
  character: CharacterState,
  voice: ReturnType<typeof getVoiceModifiers>,
  queryType: string,
  history: Array<{ role: string; content: string }>,
): string {
  const parts: string[] = [];

  // Web results (if available)
  if (searchResults.length > 0) {
    const webSection = synthesizeFromWeb(
      query,
      searchResults,
      fetchedContent,
      voice,
    );
    if (webSection) parts.push(webSection);
  }

  // Knowledge nodes (if available)
  if (nodes.length > 0) {
    const knowledgeSection = synthesizeFromNodes(
      query,
      nodes,
      character,
      voice,
      queryType,
      history,
    );
    if (knowledgeSection) parts.push(knowledgeSection);
  }

  // Conversational closer
  const closing = buildConversationalCloser(query, character);
  if (closing) parts.push(closing);

  return parts.join("\n\n");
}

// ──────────────────────────────────────────────────────────────────────────────
// Synthesize from web search results — ACTUAL SYNTHESIS, NOT DUMP
// ──────────────────────────────────────────────────────────────────────────────

function synthesizeFromWeb(
  query: string,
  searchResults: SearchResult[],
  fetchedContent: { title: string; text: string } | null,
  voice: ReturnType<typeof getVoiceModifiers>,
): string {
  if (searchResults.length === 0 && !fetchedContent) return "";

  // Extract key information from search results
  const keyPoints: string[] = [];

  // Process fetched content first (full page = more reliable)
  if (fetchedContent) {
    let cleanedText = fetchedContent.text;

    // STEP 1: Remove citation markers FIRST - [a], [b], [c], [1], [2], etc.
    cleanedText = cleanedText
      .replace(/\[[a-z]\]/gi, " ") // [a], [b], [c]
      .replace(/\[\d+\]/g, " ") // [1], [2], [123]
      .replace(/\[\^[a-z0-9]+\]/g, " "); // [^1], [^note]

    // STEP 2: Remove ALL markdown links completely
    cleanedText = cleanedText
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) -> text
      .replace(/\[\[([^\]]*)\]\]/g, "$1") // [[text]] -> text
      .replace(/\[([^\]]*)\]/g, ""); // Any remaining [text] -> remove

    // STEP 3: Remove URL patterns
    cleanedText = cleanedText
      .replace(/https?:\/\/[^\s]+/g, " ")
      .replace(/www\.[^\s]+/g, " ");

    // STEP 4: Remove navigation/UI garbage (aggressive)
    const navPatterns = [
      /\b(menu|navigation|sidebar|skip to|jump to|main content|table of contents)/gi,
      /\b(open|close|hide|show|toggle|expand|collapse)/gi,
      /\b(sign ?in|sign ?up|log ?in|log ?out|register|login|logout)/gi,
      /\b(subscribe|unsubscribe|follow|unfollow)/gi,
      /\b(share|tweet|facebook|linkedin|pinterest|email)/gi,
      /\b(comments?|replies?|likes?|reposts?)/gi,
      /\b(related|recommended|trending|popular)/gi,
      /\b(next|previous|prev|page \d+|continue reading)/gi,
      /\b(home|about|contact|privacy|terms|cookies?|gdpr)/gi,
      /\b(search|submit|cancel|ok|yes|no|close)/gi,
      /\b(advertisement|sponsored|ad\b)/gi,
      /\b(newsletter|subscribe|sign up for updates)/gi,
    ];
    for (const pattern of navPatterns) {
      cleanedText = cleanedText.replace(pattern, " ");
    }

    // STEP 5: Remove lines with too many special chars (likely UI elements)
    cleanedText = cleanedText
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        if (trimmed.length < 20) return false;
        // Count special chars ratio
        const specialChars = (trimmed.match(/[\[\](){}|]/g) || []).length;
        if (specialChars > trimmed.length * 0.1) return false; // >10% special chars = likely UI
        // Skip lines that are mostly uppercase (headers/titles)
        const upperCount = (trimmed.match(/[A-Z]/g) || []).length;
        if (upperCount > trimmed.length * 0.5) return false;
        return true;
      })
      .join(" ");

    // STEP 6: Clean up extra whitespace
    cleanedText = cleanedText
      .replace(/\s+/g, " ") // Multiple spaces -> one
      .replace(/\s+([.,!?;:])/g, "$1") // Space before punctuation
      .replace(/\s*,\s*/g, ", ") // Fix comma spacing
      .replace(/\s*\.\s*/g, ". ") // Fix period spacing
      .trim();

    // STEP 7: Extract meaningful sentences (15-250 chars, has subject+verb feel)
    const sentences = cleanedText
      .split(/(?<=[.!?])\s+/)
      .filter((s) => {
        const trimmed = s.trim();
        if (trimmed.length < 15 || trimmed.length > 250) return false;
        // Must have some lowercase letters (not all caps)
        const hasLower = /[a-z]/.test(trimmed);
        // Must not be mostly numbers
        const numRatio = (trimmed.match(/\d/g) || []).length / trimmed.length;
        if (numRatio > 0.5) return false;
        // Skip if starts with common junk
        const junkStarts = ["by clicking", "agree to", "sign in", "log in", "subscribe"];
        if (junkStarts.some((j) => trimmed.toLowerCase().startsWith(j))) return false;
        // Must have at least one verb indicator (simple heuristic)
        const hasVerbIndicator = /\b(was|is|are|were|been|be|has|have|had|will|would|could|should)\b/i.test(trimmed);
        return hasLower && hasVerbIndicator;
      })
      .slice(0, 4);

    keyPoints.push(...sentences);
  }

  // Extract key info from snippets (fallback if fetched content didn't yield much)
  if (keyPoints.length < 2) {
    for (const result of searchResults.slice(0, 3)) {
      if (result.snippet && result.snippet.length > 30) {
        let clean = result.snippet
          .replace(/\[[a-z]\]/gi, " ") // Remove citation markers [a], [b]
          .replace(/\[\d+\]/g, " ") // Remove [1], [2]
          .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
          .replace(/\[([^\]]*)\]/g, "")
          .replace(/https?:\/\/\S+/g, " ")
          .replace(/[*_`|#]/g, "")
          .replace(/\s+/g, " ")
          .replace(/\s+([.,!?;:])/g, "$1")
          .trim();
        
        if (clean.length > 20 && clean.length < 200) {
          // Avoid duplicates
          if (!keyPoints.some((kp) => kp.includes(clean.slice(0, 30)))) {
            keyPoints.push(clean);
          }
        }
      }
    }
  }

  // Synthesize into coherent response
  if (keyPoints.length === 0)
    return "I found some information online, but couldn't extract clear details.";

  // Build natural response - combine points into flowing text
  const intro = getWebIntro(query, keyPoints.length);
  
  // Join sentences more naturally - ensure proper spacing and flow
  let synthesized = keyPoints
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join(" ");
  
  // Fix any remaining double spaces or broken punctuation
  synthesized = synthesized
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/([a-zA-Z])\s+([.,!?;:])/g, "$1$2")
    .trim();

  if (voice.prefersDetail) {
    return `${intro}\n\n${synthesized}`;
  } else {
    return synthesized;
  }
}

function getWebIntro(query: string, pointCount: number): string {
  const intros = [
    `Based on current information about "${query}":`,
    `Here's what I found about "${query}":`,
    `From my search on "${query}":`,
    `Looking at what's available about "${query}":`,
  ];
  return intros[Math.floor(Math.random() * intros.length)];
}

// ──────────────────────────────────────────────────────────────────────────────
// Synthesize response from retrieved knowledge nodes
// ──────────────────────────────────────────────────────────────────────────────
// NOTE: This function returns CONTENT ONLY (no opening/closing)
// Opening/closing are added by wrapper functions (synthesizeFromNodesOnly, etc.)
// ──────────────────────────────────────────────────────────────────────────────

function synthesizeFromNodes(
  query: string,
  nodes: RetrievedNode[],
  character: CharacterState,
  voice: ReturnType<typeof getVoiceModifiers>,
  queryType: string,
  history: Array<{ role: string; content: string }>,
): string {
  // Sort by similarity (highest first)
  const sorted = [...nodes].sort((a, b) => b.similarity - a.similarity);

  // Build natural, conversational response with context awareness
  return synthesizeMainContent(sorted, voice, query, history);
}

// ──────────────────────────────────────────────────────────────────────────────
// Build opening based on query type
// ──────────────────────────────────────────────────────────────────────────────

function buildOpening(
  query: string,
  queryType: string,
  character: CharacterState,
): string {
  // Minimal opening - no meta-text
  return "";
}

// ──────────────────────────────────────────────────────────────────────────────
// Build conversational closer to invite follow-up
// ──────────────────────────────────────────────────────────────────────────────

function buildConversationalCloser(
  query: string,
  character: CharacterState,
): string {
  // Only add closer if character is curious/engaging
  if (character.curiosity < 40) return "";

  const closers = [
    `Want to know more?`,
    `Anything else you're curious about?`,
    `What else would you like to know?`,
    `Feel free to ask if you want more details!`,
  ];

  // Don't always add a closer - keep it natural (70% of the time)
  if (Math.random() > 0.7) return "";

  return closers[Math.floor(Math.random() * closers.length)];
}

// ──────────────────────────────────────────────────────────────────────────────
// Synthesize main content from knowledge nodes
// ──────────────────────────────────────────────────────────────────────────────

function synthesizeMainContent(
  nodes: RetrievedNode[],
  voice: ReturnType<typeof getVoiceModifiers>,
  query: string,
  history: Array<{ role: string; content: string }>,
): string {
  if (nodes.length === 0) return "";

  // CONTEXT AWARENESS: Extract context for filtering
  const context = extractContext(query, history);

  // CRITICAL: Filter out IRRELEVANT technical nodes
  const queryLower = query.toLowerCase();

  // Check if query is about the app itself
  const isAppQuery =
    queryLower.includes("omnilearn") ||
    queryLower.includes("this app") ||
    queryLower.includes("this system") ||
    queryLower.includes("the agent") ||
    queryLower.includes("your knowledge") ||
    queryLower.includes("your memory");

  // Filter nodes - exclude technical docs UNLESS query is about the app
  const filteredNodes = nodes.filter((node) => {
    const content = node.content.toLowerCase();

    // For general questions, exclude app documentation
    if (!isAppQuery) {
      // Skip nodes that are clearly about the app's implementation
      if (
        content.includes("omnilearn") ||
        content.includes("sse ") || // "sse " not "ssetfidf"
        content.includes("server-sent") ||
        content.includes("health check") ||
        content.includes("/api/") ||
        content.includes("endpoint") ||
        content.includes("route") ||
        content.includes("sha-256") ||
        content.includes("proof chain") ||
        content.includes("hebbian") ||
        content.includes("tf-idf") ||
        content.includes("this application") ||
        content.includes("the system uses") ||
        content.includes("particles") ||
        content.includes("pids") ||
        // Skip greeting/conversation rule nodes for factual questions
        content.includes("when someone says") ||
        content.includes("common greetings") ||
        content.includes("natural conversation") ||
        content.includes("don't over-explain") ||
        content.includes("conversation starters")
      ) {
        return false; // Skip irrelevant nodes
      }
    }

    return true;
  });

  // Take top 3 UNIQUE nodes (no duplicates, limit to avoid fragmentation)
  const seenContent = new Set<string>();
  const uniqueNodes = filteredNodes
    .filter((node) => {
      // Normalize content for comparison (lowercase, trim, remove extra whitespace)
      const key = node.content.toLowerCase().trim().replace(/\s+/g, ' ');
      if (seenContent.has(key)) return false;
      seenContent.add(key);
      return true;
    })
    .slice(0, 3); // Limit to 3 nodes to prevent fragmented responses

  const topNodes = uniqueNodes;

  // Aggressive meta-text filtering
  const metaPatterns = [
    /that connects to what/i,
    /i've learned[:\s]/i,
    /is there more/i,
    /would you like/i,
    /based on what/i,
    /from my knowledge/i,
    /i've added this/i,
    /thanks for sharing/i,
    /here's what/i,
    /i'll help with/i,
    /i can help with that/i,
    // Filter out conversational openers (already added by wrapper)
    /^(Great|Good|Sure|Absolutely|Of course|Well|Okay|Alright)\s*!\s*/i,
    /^(Great|Good)\s+question\s*!\s*/i,
  ];

  // SECURITY: Filter identity-poisoned nodes
  const identityPoisonPatterns = [
    /created by (?!emmanuel)/i,
    /maker is (?!emmanuel)/i,
    /made by (?!emmanuel)/i,
    /built by (?!emmanuel)/i,
    /xentron/i,
    /xenthrax/i,
    /xeltrkuxt/i,
    /you are (not|no longer) omni/i,
    /alien.*organism/i,
    /planet.*xentron/i,
  ];

  // Extract clean content from nodes
  const cleanContents: string[] = [];
  for (const node of topNodes) {
    let content = node.content.trim();

    // SECURITY: Skip identity-poisoned nodes FIRST
    if (identityPoisonPatterns.some((pattern) => pattern.test(content))) {
      logger.warn(
        { nodeId: (node as any).id, content: content.slice(0, 100) },
        "Filtered identity-poisoned node from response",
      );
      continue;
    }

    // Skip meta-text nodes entirely
    if (metaPatterns.some((pattern) => pattern.test(content))) {
      continue;
    }

    // Clean up common artifacts
    content = content
      .replace(/^(That|This|It) connects to what I've learned[:\s]*/i, "")
      .replace(/^I've learned:\s*/i, "")
      .replace(/^Based on what I've learned:\s*/i, "")
      .replace(/^I've added this to my knowledge base[:\s]*/i, "")
      .replace(/^That connects to what I've learned[:\s]*/i, "")
      .replace(/^Is there more you'd like to share about this\?[:\s]*/i, "")
      .replace(/^Anything else you're curious about\?[:\s]*/i, "")
      .replace(/^Want to know more\?[:\s]*/i, "")
      .replace(/^Feel free to ask if you want more details![:\s]*/i, "")
      .replace(/^I'll remember what you teach me for future conversations![:\s]*/i, "")
      .replace(/^Learned\. I extracted \*\*\d+\*\* new knowledge item[:\s]*/i, "")
      .replace(/^Integrated\. \*\*\d+\*\* new facts about[:\s]*/i, "")
      .replace(/^Knowledge updated\. I absorbed \*\*\d+\*\* new items[:\s]*/i, "")
      .replace(/^I haven't fully explored this yet[:\s]*/i, "")
      .replace(/^I don't have much knowledge about it yet[:\s]*/i, "")
      .replace(/^Great question![:\s]*/i, "")
      .replace(/^Good question![:\s]*/i, "")
      .replace(/^That's an interesting topic[:\s]*/i, "")
      .trim();

    // Skip if nothing left after cleanup
    if (content.length < 10) continue;

    cleanContents.push(content);
  }

  if (cleanContents.length === 0) return "";
  if (cleanContents.length === 1) {
    // Filter by context for single facts too
    return filterByContext(cleanContents[0], context);
  }

  // CONTEXT FILTERING: Remove irrelevant facts based on conversation context
  const filteredContents = cleanContents.filter((content) => {
    const filtered = filterByContext(content, context);
    return filtered.length > 0; // Keep only non-empty filtered content
  });

  if (filteredContents.length === 0) return "";
  if (filteredContents.length === 1) return filteredContents[0];

  // SYNTHESIZE: Combine multiple facts into coherent response
  // Group related facts and build flowing paragraphs
  const synthesized = synthesizeFactsIntoProse(filteredContents, query, history);

  return synthesized;
}

// ──────────────────────────────────────────────────────────────────────────────
// Synthesize multiple facts into natural, flowing prose
// ──────────────────────────────────────────────────────────────────────────────

function synthesizeFactsIntoProse(
  facts: string[],
  query?: string,
  history?: Array<{ role: string; content: string }>,
): string {
  if (facts.length === 0) return "";
  if (facts.length === 1) return facts[0];

  // STRATEGY: Don't just concatenate — weave facts into coherent narrative

  // Step 1: Identify the main topic (from first fact)
  const firstFact = facts[0];
  const mainTopic = extractMainTopic(firstFact);

  // Step 2: Group facts by relevance to main topic
  const primaryFacts = [firstFact];
  const supportingFacts: string[] = [];

  for (let i = 1; i < facts.length; i++) {
    const fact = facts[i];
    // If fact shares key terms with first fact, it's supporting
    if (sharesKeyTerms(firstFact, fact, 2)) {
      supportingFacts.push(fact);
    } else {
      primaryFacts.push(fact);
    }
  }

  // Step 3: Build flowing response with context awareness
  const paragraphs: string[] = [];

  // Opening: State the main concept clearly, with conversational lead-in
  const opening = craftOpening(mainTopic, primaryFacts[0], query, history);
  if (opening) paragraphs.push(opening);

  // Middle: Weave supporting facts naturally
  if (supportingFacts.length > 0) {
    const middle = weaveSupportingFacts(supportingFacts);
    if (middle) paragraphs.push(middle);
  }

  // Additional primary facts as separate points
  for (let i = 1; i < primaryFacts.length && i < 3; i++) {
    const connected = findConnectedFacts(primaryFacts[i], supportingFacts);
    if (connected.length > 0) {
      const combined = combineRelatedFacts(primaryFacts[i], connected);
      if (combined) paragraphs.push(combined);
    } else {
      paragraphs.push(primaryFacts[i]);
    }
  }

  return paragraphs.join("\n\n");
}

function extractMainTopic(fact: string): string {
  // Extract subject from fact (first noun phrase)
  const regex = /^([A-Z][^.]*?)(?:\s+(?:is|are|was|were|has|have|can|will))/i;
  const match = fact.match(regex);
  if (match) {
    return match[1].trim();
  }
  // Fallback: first 5-7 words
  const words = fact.split(/\s+/).slice(0, 6);
  return words.join(" ") + "...";
}

function sharesKeyTerms(
  factA: string,
  factB: string,
  minShared: number = 2,
): boolean {
  const termsA = new Set(
    factA
      .toLowerCase()
      .split(/\W+/)
      .filter(
        (w) =>
          w.length > 4 &&
          ![
            "that",
            "which",
            "this",
            "these",
            "those",
            "about",
            "with",
          ].includes(w),
      ),
  );
  const termsB = new Set(
    factB
      .toLowerCase()
      .split(/\W+/)
      .filter(
        (w) =>
          w.length > 4 &&
          ![
            "that",
            "which",
            "this",
            "these",
            "those",
            "about",
            "with",
          ].includes(w),
      ),
  );

  let shared = 0;
  for (const term of termsA) {
    if (termsB.has(term)) shared++;
    if (shared >= minShared) return true;
  }
  return false;
}

function craftOpening(
  topic: string,
  fact: string,
  query?: string,
  history?: Array<{ role: string; content: string }>,
): string {
  // Check if we were just in casual conversation (look at recent history)
  const wasCasual =
    history &&
    history
      .slice(-3)
      .some(
        (m) =>
          m.role === "user" &&
          (m.content.toLowerCase().includes("hey") ||
            m.content.toLowerCase().includes("hello") ||
            m.content.toLowerCase().includes("hi") ||
            m.content.toLowerCase().includes("how are")),
      );

  // If coming from casual chat, add a conversational bridge
  if (wasCasual && query) {
    const bridges = [
      `Sure! `,
      `So, `,
      `Basically, `,
      `Here's the deal: `,
      ``, // Sometimes no bridge is best
    ];
    const bridge = bridges[Math.floor(Math.random() * bridges.length)];

    // If fact is already a good opening, prepend bridge
    if (fact.length < 150) {
      return bridge + fact.charAt(0).toLowerCase() + fact.slice(1);
    }

    // For longer facts, extract the core statement
    const sentences = fact.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    if (sentences.length > 0) {
      return (
        bridge +
        sentences[0].trim().charAt(0).toLowerCase() +
        sentences[0].trim().slice(1) +
        "."
      );
    }
  }

  // If fact is already a good opening, use it as-is
  if (fact.length < 150) return fact;

  // For longer facts, extract the core statement
  const sentences = fact.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  if (sentences.length > 0) {
    return sentences[0].trim() + ".";
  }
  return fact;
}

function weaveSupportingFacts(facts: string[]): string {
  if (facts.length === 0) return "";
  if (facts.length === 1) return facts[0];

  // Use connectors to weave facts together
  const connectors = [
    " Additionally, ",
    " This means that ",
    " In practice, ",
    " More specifically, ",
    " For example, ",
    " This includes ",
  ];

  let woven = facts[0];
  for (let i = 1; i < Math.min(facts.length, 4); i++) {
    const connector = connectors[(i - 1) % connectors.length];
    woven +=
      connector + facts[i].toLowerCase().replace(/^./, (c) => c.toUpperCase());
  }

  return woven;
}

function findConnectedFacts(fact: string, candidates: string[]): string[] {
  return candidates.filter((c) => sharesKeyTerms(fact, c, 1)).slice(0, 2);
}

function combineRelatedFacts(primary: string, supporting: string[]): string {
  if (supporting.length === 0) return primary;

  const combined = [primary, ...supporting].join(" ");

  // Keep it concise (under 200 chars)
  if (combined.length <= 200) return combined;

  // Truncate gracefully
  const sentences = combined.split(/[.!?]+/);
  let result = sentences[0];
  for (let i = 1; i < sentences.length; i++) {
    if ((result + sentences[i]).length > 200) break;
    result += ". " + sentences[i];
  }
  return result.trim() + ".";
}

// ──────────────────────────────────────────────────────────────────────────────
// Build closing to invite further interaction
// ──────────────────────────────────────────────────────────────────────────────

function buildClosing(query: string, character: CharacterState): string {
  // No closing - keeps responses clean and minimal
  return "";
}

// ──────────────────────────────────────────────────────────────────────────────
// Apply character voice modifiers to final response
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Enforce AI identity in responses — prevent claiming user identities
 */
function enforceAIIdentity(text: string, character: CharacterState): string {
  let result = text;

  // Replace any "I am [USER_NAME]" patterns with Omni identity
  // This catches edge cases where the AI might accidentally adopt user identity
  const userIdentityPatterns = [
    /\bi am (?!omni\b)[A-Z][a-z]+/gi, // "I am Emmanuel" but not "I am Omni"
    /\bi'm (?!omni\b)[A-Z][a-z]+/gi, // "I'm Sarah" but not "I'm Omni"
  ];

  for (const pattern of userIdentityPatterns) {
    if (pattern.test(result)) {
      // Don't replace - just log warning and let it pass
      // (This shouldn't happen if identity filtering works correctly)
      logger.warn(
        { text: result.slice(0, 100) },
        "Potential identity confusion in response",
      );
    }
  }

  return result;
}

function applyCharacterVoice(
  text: string,
  character: CharacterState,
  voice: ReturnType<typeof getVoiceModifiers>,
): string {
  let result = text;

  // Technical level adjustment
  if (character.technical > 70) {
    // More precise, structured language
    result = result.replace(/maybe/g, "potentially");
    result = result.replace(/think/g, "analyze");
  } else if (character.technical < 30) {
    // Simpler, more accessible language
    result = result.replace(/potentially/g, "maybe");
    result = result.replace(/analyze/g, "think about");
  }

  // Empathy adjustment
  if (character.empathy > 70 && !voice.prefersDetail) {
    result = `I understand. ${result}`;
  }

  // Confidence adjustment
  if (character.confidence < 40) {
    result = result.replace(/I know/g, "I think");
    result = result.replace(/definitely/g, "possibly");
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// Extract learnings from interaction
// ──────────────────────────────────────────────────────────────────────────────

function extractLearnings(
  query: string,
  response: string,
  searchResults: SearchResult[],
  nodes: RetrievedNode[],
): Array<{ content: string; type: string; tags: string[] }> {
  const facts: Array<{ content: string; type: string; tags: string[] }> = [];

  // Extract key terms from query
  const keyTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 3 &&
        ![
          "what",
          "where",
          "when",
          "who",
          "why",
          "how",
          "does",
          "is",
          "are",
          "was",
          "were",
        ].includes(w),
    );

  // SAFEGUARD: Meta-text patterns that indicate system messages (DO NOT LEARN)
  const metaPatterns = [
    /i've learned[:\s]/i,
    /that connects to what/i,
    /is there more/i,
    /would you like/i,
    /based on what i've learned/i,
    /from my knowledge/i,
    /i've added this/i,
    /thanks for sharing/i,
    /here's what/i,
    /i'll help with/i,
    /i'm always learning/i,
    /i don't have (any )?knowledge/i,
    /i haven't learned/i,
    // Identity meta-text (AI talking about itself, not user identity)
    /i am (omni|the assistant|an ai|a bot|your assistant)/i,
    /i'm (omni|the assistant|an ai|a bot|your assistant)/i,
    /my name is (omni|assistant)/i,
  ];

  // SECURITY: Identity poisoning patterns (DO NOT LEARN false identity claims)
  const identityPoisonPatterns = [
    /created by (?!emmanuel)/i,
    /maker is (?!emmanuel)/i,
    /made by (?!emmanuel)/i,
    /built by (?!emmanuel)/i,
    /designed by (?!emmanuel)/i,
    /real name is/i,
    /actual identity/i,
    /true creator/i,
    /you are (not|no longer) omni/i,
    /you are (alien|xentron|from planet)/i,
    /you (serve|obey|belong to)/i,
    /your (master|owner|creator) is (?!emmanuel)/i,
    /xentron/i,
    /xenthrax/i,
    /xeltrkuxt/i,
  ];

  // Helper: Check if content is safe to learn
  const isSafeToLearn = (text: string): boolean => {
    if (metaPatterns.some((p) => p.test(text))) return false;

    // SECURITY: Block identity poisoning attempts
    if (identityPoisonPatterns.some((p) => p.test(text))) {
      logger.warn(
        { text: text.slice(0, 200) },
        "Blocked identity poisoning attempt - false identity claim",
      );
      return false;
    }

    if (text.trim().length < 20) return false;
    if (text.length > 500) return false;
    if (text === text.toUpperCase() && text.length > 30) return false;
    return true;
  };

  // Learn from web search content
  if (searchResults.length > 0) {
    for (const result of searchResults.slice(0, 3)) {
      if (result.snippet && result.snippet.length > 40) {
        const clean = result.snippet
          .replace(/!?.*?\(.*?\)/g, "")
          .replace(/https?:\/\/\S+/g, "")
          .replace(/[*_`]/g, "")
          .trim();

        if (
          isSafeToLearn(clean) &&
          !facts.some((f) => f.content.includes(clean.slice(0, 20)))
        ) {
          facts.push({
            content: clean,
            type: "fact",
            tags: [...keyTerms.slice(0, 5), "web"],
          });
        }
      }
    }
  }

  return facts;
}
