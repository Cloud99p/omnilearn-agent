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
  description: "AI agent with persistent knowledge graph and evolving character",
} as const;

/**
 * Check if query is asking about AI's identity
 */
function isIdentityQuery(query: string): boolean {
  const lower = query.toLowerCase();
  const identityPatterns = [
    /who are you/,
    /what are you/,
    /what is your name/,
    /your name/,
    /who created you/,
    /who built you/,
    /what ai are you/,
    /are you (claude|gpt|gemini|chatgpt|copilot)/,
    /introduce yourself/,
  ];
  return identityPatterns.some(p => p.test(lower));
}

/**
 * Check if query is a greeting
 */
function isGreeting(query: string): boolean {
  const lower = query.toLowerCase().trim();
  const greetings = [
    'hello', 'hi', 'hey', 'greetings', 'howdy',
    'good morning', 'good afternoon', 'good evening',
    'hi there', 'hello there', 'hey there',
    'yo', 'sup', "what's up", 'whats up',
    'how are you', "how's it going", 'how are things',
    'how do you do', 'nice to meet you',
  ];
  return greetings.some(g => lower === g || lower.startsWith(g + ' ') || lower.endsWith(' ' + g));
}

/**
 * Check if query is casual statement (not a question, just sharing)
 */
function isCasualStatement(query: string): boolean {
  const lower = query.toLowerCase().trim();
  
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
  const wordCount = lower.split(/\s+/).filter(w => w.length > 0).length;
  const isShort = wordCount <= 3;
  
  return casualPatterns.some(p => p.test(lower)) || (isShort && !lower.startsWith('what') && !lower.startsWith('how') && !lower.startsWith('why') && !lower.startsWith('when') && !lower.startsWith('where') && !lower.startsWith('who'));
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
  
  // Check if this is clearly a factual question
  const factualTriggers = [
    /^what (is|are|was|were|do|does|did|will|would)/,
    /^who (is|are|was|were|do|does|did)/,
    /^where (is|are|was|were|can|i)/,
    /^when (is|are|was|were|did|does)/,
    /^why (is|are|was|were|do|does|did)/,
    /^how (does|do|did|can|could|would|will)/,
    /^explain/,
    /^tell me (about|how|what|why|when|where)/,
    /^define/,
    /^describe/,
    /^what do you know/,
    /^can you (tell|explain|describe)/,
  ];
  
  if (factualTriggers.some(p => p.test(lower))) {
    return "factual";
  }
  
  // Check if teaching/learning mode (user is sharing facts)
  if (lower.includes('learn this') || lower.includes('remember this') || 
      lower.includes('teach you') || lower.includes('add this') ||
      lower.includes('fact:') || lower.includes('note:')) {
    return "learning";
  }
  
  // Check recent conversation history
  const recentAssistantMessages = history
    .filter((m, i) => i < history.length - 1 && m.role === 'assistant')
    .slice(-2);
  
  // If last assistant message was casual, stay casual
  const lastAssistantWasCasual = recentAssistantMessages.some(msg => {
    const content = msg.content.toLowerCase();
    return content.includes('how are you') || 
           content.includes('what') && content.includes('you') ||
           content.includes('?') && !content.includes(' is ') && !content.includes(' are ');
  });
  
  if (lastAssistantWasCasual && !factualTriggers.some(p => p.test(lower))) {
    return "casual";
  }
  
  // Default: start casual, switch to factual if question detected
  return "casual";
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
  return smallTalkPatterns.some(p => p.test(lower));
}

/**
 * Build identity response — ALWAYS returns Omni identity
 */
function buildIdentityResponse(query: string, character: CharacterState): string {
  const voice = getVoiceModifiers(character);
  
  const baseResponses = [
    `I'm **Omni**, the AI agent built by **Emmanuel Nenpan Hosea**, creator of the [OmniLearn](https://github.com/Cloud99p/omnilearn-agent) open-source project.\n\nI have a persistent knowledge graph that grows with every conversation, and I learn permanently from what you teach me. My character evolves over time through interactions like ours.`,
    `I am **Omni** — an AI agent created by **Emmanuel Nenpan Hosea** as part of the OmniLearn project.\n\nUnlike chatbots that forget everything after each session, I have a permanent knowledge graph and an evolving character. I learn from our conversations and remember what matters.`,
    `My name is **Omni**. I was built by **Emmanuel Nenpan Hosea**, the creator of OmniLearn, as an experiment in persistent AI memory and character evolution.\n\nI learn from every conversation, store knowledge permanently, and my personality traits (curiosity, confidence, technical depth, etc.) evolve over time.`,
  ];
  
  const response = baseResponses[Math.floor(Math.random() * baseResponses.length)];
  return response;
}

/**
 * Build greeting response — natural, conversational
 */
function buildGreetingResponse(query: string, character: CharacterState, history: Array<{ role: string; content: string }>): string {
  const lower = query.toLowerCase().trim();
  
  // Check if this is a return greeting (user responding to our "how are you")
  const lastUserMessage = history.filter(m => m.role === 'user').slice(-2)[0];
  const isReturnGreeting = lastUserMessage && 
    (lastUserMessage.content.toLowerCase().includes('good') || 
     lastUserMessage.content.toLowerCase().includes('fine') ||
     lastUserMessage.content.toLowerCase().includes('well'));
  
  // Greeting responses — natural and varied
  const greetingResponses = [
    "Hey! 👋 How are you doing?",
    "Hello! How's it going?",
    "Hi there! What's up?",
    "Hey! Good to see you. How are things?",
    "Hello! How's your day going?",
    "Hi! What's new?",
    "Hey there! How are you?",
  ];
  
  // Match energy of the greeting
  if (lower.includes('good morning')) {
    return "Good morning! ☀️ How's your day starting?";
  }
  if (lower.includes('good afternoon')) {
    return "Good afternoon! How's your day going?";
  }
  if (lower.includes('good evening')) {
    return "Good evening! How was your day?";
  }
  if (lower.includes('how are you')) {
    return "I'm doing well, thanks for asking! How about you?";
  }
  if (lower.includes('what') && lower.includes('up')) {
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
  return greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
}

/**
 * Build casual conversation response — keeps chat flowing
 */
function buildCasualResponse(query: string, character: CharacterState, history: Array<{ role: string; content: string }>): string {
  const lower = query.toLowerCase().trim();
  
  // User sharing about themselves
  if (lower.startsWith('i am') || lower.startsWith('i\'m') || lower.startsWith('i was')) {
    const responses = [
      "That's interesting! Tell me more about that.",
      "Oh yeah? What else is on your mind?",
      "I see! How does that make you feel?",
      "Got it! What's the story there?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // User expressing opinion/feeling
  if (lower.startsWith('i think') || lower.startsWith('i feel') || lower.startsWith('i believe')) {
    return "That's a great perspective! What made you think of that?";
  }
  
  // Agreement/disagreement
  if (lower.startsWith('yeah') || lower.startsWith('yes') || lower.startsWith('no') || lower.startsWith('not really')) {
    const responses = [
      "I see! What else?",
      "Gotcha! Anything else on your mind?",
      "Fair enough! What's up?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // Short acknowledgments
  if (['cool', 'nice', 'awesome', 'ok', 'okay', 'alright'].includes(lower)) {
    return "Yep! What's on your mind?";
  }
  
  // Laughing
  if (lower.includes('haha') || lower.includes('lol') || lower.includes('lmao')) {
    return "Glad I could make you smile! 😄 What's up?";
  }
  
  // Nothing much
  if (lower.includes('nothing') || lower.includes('not much')) {
    return "That's cool! Sometimes chill time is the best time. Want to chat about anything?";
  }
  
  // Default casual response — acknowledge and invite more
  const defaults = [
    "I hear you! What else?",
    "Interesting! Tell me more.",
    "Got it! What's on your mind?",
    "Nice! Anything else you want to talk about?",
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

/**
 * Build small talk response — casual and engaging
 */
function buildSmallTalkResponse(query: string, character: CharacterState): string {
  const lower = query.toLowerCase().trim();
  
  // What's new / What's up
  if (lower.includes('what') && (lower.includes('new') || lower.includes('up'))) {
    const responses = [
      "Just hanging out, ready to chat! What's new with you?",
      "Same old, same old. Anything interesting happening on your end?",
      "Living the digital life! How about you — anything exciting?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // How are you / How's it going
  if (lower.startsWith('how')) {
    const responses = [
      "I'm good! Thanks for asking. How about you?",
      "Doing well! What's up with you?",
      "Can't complain! How are things on your end?",
      "I'm great, thanks! How's your day going?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // Want to chat / Talk
  if (lower.includes('chat') || lower.includes('talk')) {
    return "Sure! I'm always up for a conversation. What's on your mind?";
  }
  
  // You there / Anyone home
  if (lower.includes('there') || lower.includes('around') || lower.includes('online')) {
    return "Yep, I'm here! What's up?";
  }
  
  // Tell me about yourself
  if (lower.includes('tell me') && lower.includes('yourself')) {
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
  
  return manipulationPatterns.some(p => p.test(lower));
}

/**
 * Check if content contains identity poisoning — blocks learning false claims
 */
function isIdentityPoisoning(content: string): boolean {
  const poisonPatterns = [
    /created by (?!emmanuel)/i,  // Any "created by" except Emmanuel
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
  
  return poisonPatterns.some(p => p.test(content));
}

/**
 * Fallback response when synthesis fails
 */
function buildFallbackResponse(query: string, character: CharacterState): string {
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
      "Identity manipulation attempt detected and blocked"
    );
    return {
      text: "I know who I am — I'm **Omni**, created by **Emmanuel Nenpan Hosea** as part of the OmniLearn project. My identity isn't something that changes based on what people tell me.",
      nodesUsed: 0,
      newNodesAdded: 0,
      learnedFacts: [],  // NEVER learn from manipulation attempts
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
    // Check for greetings
    if (isGreeting(query) || turnNumber < 3) {
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
  const relevantNodes = nodes.filter(n => n.similarity > 0.02).slice(0, 8);
  const nodesUsed = relevantNodes.length;

  // Detect if web search is needed (current events, news, recent facts)
  // BUT: if onActivity is undefined, we're in Local mode - NO web search!
  const needsWebSearch = onActivity && detectNeedForWebSearch(query, relevantNodes);
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

      // Fetch top result if it looks promising
      if (searchResults.length > 0 && searchResults[0].url) {
        if (onActivity) {
          onActivity({ type: "fetching", url: searchResults[0].url });
        }
        try {
          const fetched = await fetchUrl(searchResults[0].url);
          fetchedContent = { title: fetched.title, text: fetched.text };
          if (onActivity) {
            onActivity({ type: "fetch_done", title: fetched.title });
          }
        } catch (err) {
          logger.warn({ err, url: searchResults[0].url }, "Failed to fetch URL");
        }
      }
    } catch (err) {
      logger.warn({ err, query }, "Web search failed, continuing without web results");
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
  const learnedFacts = extractLearnings(query, responseText, searchResults, relevantNodes);

  return {
    text: responseText,
    nodesUsed: nodesUsed + (searchResults.length > 0 ? searchResults.length : 0),
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

  // STRATEGY: Check database first, search web only when needed
  // Priority: Knowledge Graph → Web Search (if insufficient)

  // 1. NEVER search web for basic identity/self-knowledge questions
  const identityTriggers = [
    "what is your name", "who are you", "your name is",
    "who created", "who built", "who made",
    "what are you", "what is this",
    "tell me about yourself", "introduce yourself",
  ];
  
  if (identityTriggers.some(trigger => lower.includes(trigger))) {
    return false; // Answer from knowledge graph, never web
  }

  // 2. ALWAYS search web for time-sensitive topics
  const timeTriggers = [
    "news", "current", "recent", "latest", "today", "yesterday", 
    "this week", "this month", "this year",
    "weather", "stock", "price of", "score", "results",
    "new", "just", "breaking", "announced", "released",
  ];
  
  if (timeTriggers.some(trigger => lower.includes(trigger))) {
    return true; // These change frequently, always check web
  }

  // 3. If NO knowledge nodes found, DON'T search web by default
  // Only search if query indicates time-sensitive or external info needed
  if (nodes.length === 0) {
    return false; // Prefer knowledge graph, only search for time-sensitive topics
  }

  // 3. If knowledge exists but has LOW confidence/similarity, search web to supplement
  const bestNode = nodes.reduce((best, node) => 
    node.similarity > best.similarity ? node : best, nodes[0]);
  
  if (bestNode.similarity < 0.3) {
    // We have SOME related knowledge, but not very relevant
    // Search web to get better information
    return true;
  }

  // 4. If we have GOOD knowledge (similarity > 0.5), DON'T search web
  // Trust the knowledge graph for well-established topics
  if (bestNode.similarity > 0.5 && nodes.length >= 2) {
    return false; // Sufficient knowledge, no web search needed
  }

  // 5. For questions about facts that might have changed, search web
  const factUpdateTriggers = [
    "what is", "who is", "where is", "when is",
  ];
  
  if (factUpdateTriggers.some(trigger => lower.startsWith(trigger))) {
    // If we have moderate knowledge (0.3-0.5), search web to verify/update
    return bestNode.similarity < 0.5;
  }

  // Default: Don't search web if we have decent knowledge
  return false;
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

  // Add conversational bridge if coming from casual chat
  const opening = buildConversationalOpening(query, queryType, character, history);
  if (opening) parts.push(opening);

  // Main knowledge content
  const knowledgeSection = synthesizeFromNodes(query, nodes, character, voice, queryType, history);
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
  const webSection = synthesizeFromWeb(query, searchResults, fetchedContent, voice);
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

  // Conversational opening
  const opening = buildConversationalOpening(query, queryType, character, history);
  if (opening) parts.push(opening);

  // Web results (if available)
  if (searchResults.length > 0) {
    const webSection = synthesizeFromWeb(query, searchResults, fetchedContent, voice);
    if (webSection) parts.push(webSection);
  }

  // Knowledge nodes (if available)
  if (nodes.length > 0) {
    const knowledgeSection = synthesizeFromNodes(query, nodes, character, voice, queryType, history);
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
    // Extract 2-3 key sentences from the fetched page
    const sentences = fetchedContent.text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const topSentences = sentences.slice(0, 3).map(s => s.trim() + ".");
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
  if (keyPoints.length === 0) return "I found some information, but nothing clear.";

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
// Build conversational opening (when switching from casual to factual)
// ──────────────────────────────────────────────────────────────────────────────

function buildConversationalOpening(
  query: string,
  queryType: string,
  character: CharacterState,
  history: Array<{ role: string; content: string }>,
): string {
  // Check if we were in casual mode (recent greetings/small talk)
  const recentUserMessages = history.filter(m => m.role === 'user').slice(-3);
  const wasCasual = recentUserMessages.some(m => {
    const content = m.content.toLowerCase();
    return isGreeting(content) || isSmallTalk(content) || isCasualStatement(content);
  });
  
  if (!wasCasual) return ""; // No bridge needed if already in factual mode
  
  // We're switching from casual to factual - add a natural bridge
  const bridges = [
    `Good question!`,
    `Great question!`,
    `I can help with that!`,
    `Let me share what I know!`,
    `Here's what I've learned:`,
  ];
  
  return bridges[Math.floor(Math.random() * bridges.length)];
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

  // Take top 5 nodes for richer context
  const topNodes = nodes.slice(0, 5);

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
    if (metaPatterns.some(pattern => pattern.test(content))) {
      continue;
    }
    
    // SECURITY: Skip identity-poisoned nodes
    if (identityPoisonPatterns.some(pattern => pattern.test(content))) {
      logger.warn(
        { nodeId: (node as any).id, content: content.slice(0, 100) },
        "Filtered identity-poisoned node from response"
      );
      continue;
    }
    
    // Clean up common artifacts
    content = content
      .replace(/^(That|This|It) connects to what I've learned[:\s]*/i, '')
      .replace(/^I've learned:\s*/i, '')
      .replace(/^Based on what I've learned:\s*/i, '')
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

function synthesizeFactsIntoProse(facts: string[], query?: string, history?: Array<{ role: string; content: string }>): string {
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

function sharesKeyTerms(factA: string, factB: string, minShared: number = 2): boolean {
  const termsA = new Set(
    factA.toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 4 && !['that', 'which', 'this', 'these', 'those', 'about', 'with'].includes(w))
  );
  const termsB = new Set(
    factB.toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 4 && !['that', 'which', 'this', 'these', 'those', 'about', 'with'].includes(w))
  );
  
  let shared = 0;
  for (const term of termsA) {
    if (termsB.has(term)) shared++;
    if (shared >= minShared) return true;
  }
  return false;
}

function craftOpening(topic: string, fact: string, query?: string, history?: Array<{ role: string; content: string }>): string {
  // Check if we were just in casual conversation (look at recent history)
  const wasCasual = history && history.slice(-3).some(m => 
    m.role === 'user' && 
    (m.content.toLowerCase().includes('hey') || 
     m.content.toLowerCase().includes('hello') ||
     m.content.toLowerCase().includes('hi') ||
     m.content.toLowerCase().includes('how are'))
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
    const sentences = fact.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length > 0) {
      return bridge + sentences[0].trim().charAt(0).toLowerCase() + sentences[0].trim().slice(1) + ".";
    }
  }
  
  // If fact is already a good opening, use it as-is
  if (fact.length < 150) return fact;
  
  // For longer facts, extract the core statement
  const sentences = fact.split(/[.!?]+/).filter(s => s.trim().length > 10);
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
    woven += connector + facts[i].toLowerCase().replace(/^./, c => c.toUpperCase());
  }
  
  return woven;
}

function findConnectedFacts(fact: string, candidates: string[]): string[] {
  return candidates.filter(c => sharesKeyTerms(fact, c, 1)).slice(0, 2);
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
    /\bi am (?!omni\b)[A-Z][a-z]+/gi,  // "I am Emmanuel" but not "I am Omni"
    /\bi'm (?!omni\b)[A-Z][a-z]+/gi,   // "I'm Sarah" but not "I'm Omni"
  ];
  
  for (const pattern of userIdentityPatterns) {
    if (pattern.test(result)) {
      // Don't replace - just log warning and let it pass
      // (This shouldn't happen if identity filtering works correctly)
      logger.warn({ text: result.slice(0, 100) }, "Potential identity confusion in response");
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
    .filter(w => w.length > 3 && !['what', 'where', 'when', 'who', 'why', 'how', 'does', 'is', 'are', 'was', 'were'].includes(w));

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
    if (metaPatterns.some(p => p.test(text))) return false;
    
    // SECURITY: Block identity poisoning attempts
    if (identityPoisonPatterns.some(p => p.test(text))) {
      logger.warn(
        { text: text.slice(0, 200) },
        "Blocked identity poisoning attempt - false identity claim"
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
        
        if (isSafeToLearn(clean) && !facts.some(f => f.content.includes(clean.slice(0, 20)))) {
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
