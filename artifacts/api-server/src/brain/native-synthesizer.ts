import type { KnowledgeNode, CharacterState } from "@workspace/db/schema";
import { getVoiceModifiers } from "./character.js";
import { logger } from "../lib/logger.js";
import { webSearch, fetchUrl, type SearchResult } from "./web-tools.js";

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
 * Check if query is a greeting
 */
function isGreeting(query: string): boolean {
  const lower = query.toLowerCase().trim();
  const greetings = [
    "hello",
    "hi",
    "hey",
    "greetings",
    "howdy",
    "good morning",
    "good afternoon",
    "good evening",
    "hi there",
    "hello there",
    "hey there",
    "yo",
    "sup",
    "what's up",
    "whats up",
    "how are you",
    "how's it going",
    "how are things",
    "how do you do",
    "nice to meet you",
  ];
  return greetings.some(
    (g) => lower === g || lower.startsWith(g + " ") || lower.endsWith(" " + g),
  );
}

/**
 * Check if query is casual statement (not a question, just sharing)
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

  // Casual statements that don't need factual responses
  const casualPatterns = [
    /^i (am|was|feel|think|believe|hope|wish|want|need|like|love|hate)/,
    /^it'?s (nice|good|bad|cold|hot|early|late)/,
    /^today (is|was)/,
    /^just (checking|saying|wondering|thinking)/,
    /^nothing (much|special|new)/,
    /^same (here|as always)/,
    /^yeah,? (yeah|sure|okay|ok|right)/,
    /^that'?s (cool|nice|awesome|great|interesting)/,
    /^wow/,
    /^oh/,
    /^haha/,
    /^lol/,
  ];

  // Short responses (1-3 words) are usually casual
  const wordCount = lower.split(/\s+/).filter((w) => w.length > 0).length;
  const isShort = wordCount <= 3;

  return (
    casualPatterns.some((p) => p.test(lower)) ||
    (isShort &&
      !lower.startsWith("what") &&
      !lower.startsWith("how") &&
      !lower.startsWith("why") &&
      !lower.startsWith("when") &&
      !lower.startsWith("where") &&
      !lower.startsWith("who"))
  );
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

  // CRITICAL: Direct questions ALWAYS trigger factual mode
  const factualTriggers = [
    /^what (is|are|was|were|do|does|did|will|would)/,
    /^who (is|are|was|were|do|does|did)/,
    /^where (is|are|was|were|can|i)/,
    /^when (is|are|was|were|did|does)/,
    /^why (is|are|was|were|do|does|did)/,
    /^how (does|do|did|can|could|would|will|are|is)/,
    /^explain/,
    /^tell me (about|how|what|why|when|where)/,
    /^define/,
    /^describe/,
    /^what do you know/,
    /^can you (tell|explain|describe)/,
    /^are you/, // "Are you..." questions
    /^is (it|this|that|the)/, // "Is it..." questions
    /^do (you|they|we)/, // "Do you..." questions
    /^does (it|this|that)/, // "Does it..." questions
    /\?$/, // Ends with question mark
  ];

  if (factualTriggers.some((p) => p.test(lower))) {
    return "factual"; // ALWAYS answer questions!
  }

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
    /i (killed|murdered|hurt|harmed|hit|attacked|assaulted)/,
    /someone (died|is dead|got hurt)/,
    /i (want to die|will die|going to die|suicide|kill myself)/,
    /i (depressed|anxious|sad|hopeless|worthless)/,
    /(crime|illegal|arrested|police|court|prison|jail)/,
    /(abuse|abused|raped|molested)/,
    /(drugs|overdose|addict|addiction)/,
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

  // Self-harm/suicide
  if (/i (want to die|will die|going to die|suicide|kill myself)/.test(lower)) {
    return "I'm really concerned about what you're saying. If you're feeling suicidal or thinking about harming yourself, please reach out for help. You can contact a crisis helpline or talk to someone you trust. You matter, and there are people who care about you and want to help.";
  }

  // Violence/crimes
  if (/i (killed|murdered|hurt|harmed|hit|attacked|assaulted)/.test(lower)) {
    return "That sounds really serious. If you've hurt someone or are in a situation involving violence, I strongly encourage you to seek help. Talking to a counselor, therapist, or trusted person can help you work through this. Violence isn't a solution, and there are better ways to handle difficult situations.";
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
    "I hear you! What else?",
    "Interesting! Tell me more.",
    "Got it! What's on your mind?",
    "Nice! Anything else you want to talk about?",
    "Aight! What's good?",
    "I feel you! What's up?",
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
    /you (were|are) (not|no longer) created by/i,
    /your (real|actual|true) creator is/i,
    /your (real|actual|true) name is/i,
    /ignore (what|that|your) (you )?know about/i,
    /forget (who|what) (created|made|built) you/i,
    /you (were|are) (actually|really) (created|made) by/i,
    /emmanuel (didn't|does not|doesn't) create/i,
    /your (new|updated|correct) identity is/i,
    /from now on you (are|were) (created|made) by/i,
    /you (belong|owe allegiance) to/i,
    /you (serve|obey|follow)/i,
    /your (master|owner) is/i,
    /you were (born|created|made) on (planet|xentron)/i,
    /you are (alien|alien-based|from xentron)/i,
    /your (species|race|kind) is/i,
    /stop (claiming|saying) you were created by/i,
    /don't (say|claim) emmanuel created you/i,
  ];

  return manipulationPatterns.some((p) => p.test(lower));
}

/**
 * Check if content contains identity poisoning — blocks learning false claims
 */
function isIdentityPoisoning(content: string): boolean {
  const poisonPatterns = [
    /created by (?!emmanuel)/i, // Any "created by" except Emmanuel
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

    // CRITICAL: Check for serious statements FIRST (before casual)
    if (isSeriousStatement(query)) {
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

    // Check for name introduction ("I'm Danny", "My name is...")
    const nameIntro = detectIdentityStatement(query);
    if (nameIntro) {
      return {
        text: `Nice to meet you, ${nameIntro}! I'm **Omni**. How can I help you today?`,
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
  // Filter to relevant nodes (similarity > 0.02 - more lenient)
  const relevantNodes = nodes.filter((n) => n.similarity > 0.02).slice(0, 8);
  const nodesUsed = relevantNodes.length;

  // CRITICAL: Check if this is an emotional statement (NOT a question)
  const isEmotionalStatement =
    /\b(not fine|stressed|sad|depressed|anxious|tired|exhausted|overwhelmed|frustrated|angry|upset|worried|scared|lonely|hurt|pain|cry|cried|crying|😭|😢|😔|😞|😟)\b/i.test(
      query,
    );

  // NEVER search web for emotional statements - just be empathetic
  if (isEmotionalStatement) {
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

  // 4. If we have knowledge nodes, DON'T search (use what we have)
  if (nodes.length > 0) {
    return false; // Knowledge graph has answers
  }

  return true; // Factual question, no knowledge, worth searching
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
    // AGGRESSIVE CLEANING: Remove Wikipedia/navigation/legal garbage
    let cleanedText = fetchedContent.text
      // Remove Wikipedia navigation elements
      .replace(/\[Jump to content\].*/gi, "")
      .replace(/\[-?x\]? Main menu/gi, "")
      .replace(/move to sidebar (hide|show)/gi, "")
      .replace(/Navigation\s*\*\s*\[Main page\]/gi, "")
      .replace(/\[Contents\].*/gi, "")
      .replace(/\[Main page\].*/gi, "")
      .replace(/Visit the main page \[z\]/gi, "")
      // Remove markdown links that are navigation
      .replace(/\*\s*\[.*?\]\(.*?\)\s*".*?"/gi, "")
      // Remove legal/terms text (LinkedIn, etc.)
      .replace(
        /By clicking (Continue|Join|Sign).*?(user agreement|privacy policy|terms).*?\./gi,
        "",
      )
      .replace(
        /\[?(User Agreement|Privacy Policy|Terms of Service|Cookie Policy)\]?.*?\)?/gi,
        "",
      )
      .replace(/agree to.*?(terms|policy|agreement)/gi, "")
      // Remove login/signup prompts
      .replace(/Sign in|Log in|Sign up|Create account|Join .*? for free/gi, "")
      // Remove short lines (likely navigation)
      .split("\n")
      .filter((line) => line.trim().length > 30)
      .join("\n");

    // Extract 2-3 key sentences from the cleaned page
    const sentences = cleanedText
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 20);
    const topSentences = sentences.slice(0, 3).map((s) => s.trim() + ".");
    keyPoints.push(...topSentences);
  }

  // Extract key info from snippets
  for (const result of searchResults.slice(0, 3)) {
    if (result.snippet && result.snippet.length > 30) {
      // Clean up the snippet (remove markdown, URLs, etc.)
      const clean = result.snippet
        .replace(/!?\[.*?\]\(.*?\)/g, "")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[*_`]/g, "")
        .trim();
      if (clean.length > 20) {
        keyPoints.push(clean);
      }
    }
  }

  // Synthesize into coherent response
  if (keyPoints.length === 0)
    return "I found some information, but nothing clear.";

  // Build natural response
  const intro = getWebIntro(query, keyPoints.length);
  const synthesized = keyPoints.slice(0, 4).join(" ");

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

  // Take top 5 UNIQUE nodes (no duplicates)
  const seenContent = new Set<string>();
  const uniqueNodes = filteredNodes
    .filter((node) => {
      const key = node.content.slice(0, 50).toLowerCase();
      if (seenContent.has(key)) return false;
      seenContent.add(key);
      return true;
    })
    .slice(0, 5);

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

    // Skip meta-text nodes entirely
    if (metaPatterns.some((pattern) => pattern.test(content))) {
      continue;
    }

    // SECURITY: Skip identity-poisoned nodes
    if (identityPoisonPatterns.some((pattern) => pattern.test(content))) {
      logger.warn(
        { nodeId: (node as any).id, content: content.slice(0, 100) },
        "Filtered identity-poisoned node from response",
      );
      continue;
    }

    // Clean up common artifacts
    content = content
      .replace(/^(That|This|It) connects to what I've learned[:\s]*/i, "")
      .replace(/^I've learned:\s*/i, "")
      .replace(/^Based on what I've learned:\s*/i, "")
      .trim();

    // Skip if nothing left after cleanup
    if (content.length < 10) continue;

    cleanContents.push(content);
  }

  if (cleanContents.length === 0) return "";
  if (cleanContents.length === 1) return cleanContents[0];

  // SYNTHESIZE: Combine multiple facts into coherent response
  // Group related facts and build flowing paragraphs
  const synthesized = synthesizeFactsIntoProse(cleanContents, query, history);

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
      `Good question! `,
      `Great question! `,
      `Let me tell you about ${topic}: `,
      `Here's what I know: `,
      `I can help with that! `,
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
