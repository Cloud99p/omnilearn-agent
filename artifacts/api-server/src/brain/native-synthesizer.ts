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
 * Fallback response when synthesis fails
 */
function buildFallbackResponse(query: string, character: CharacterState): string {
  const voice = getVoiceModifiers(character);
  
  // Friendly, honest response when processing fails
  const responses = [
    `I'm still learning about "${query}". Every conversation helps me grow! What would you like to teach me?`,
    `That's an interesting topic - "${query}". I don't have much knowledge about it yet, but I'd love to learn from you!`,
    `I haven't fully explored "${query}" yet. Feel free to share what you know - I'll remember it for next time!`,
    `Great question about "${query}"! I'm still building my knowledge base. Can you tell me more about it?`,
  ];
  
  const response = responses[Math.floor(Math.random() * responses.length)];
  return `${response} ${voice.greeting || ""}`.trim();
}

export async function synthesizeNative(
  ctx: NativeSynthesisContext,
): Promise<NativeSynthesisResult> {
  const { query, queryType, nodes, character, history, onActivity } = ctx;
  const voice = getVoiceModifiers(character);

  // Filter to relevant nodes (similarity > 0.05)
  const relevantNodes = nodes.filter(n => n.similarity > 0.05).slice(0, 8);
  const nodesUsed = relevantNodes.length;

  // Detect if web search is needed (current events, news, recent facts)
  const needsWebSearch = detectNeedForWebSearch(query, relevantNodes);
  let searchResults: SearchResult[] = [];
  let fetchedContent: { title: string; text: string } | null = null;

  if (needsWebSearch && onActivity) {
    // Search the web
    onActivity({ type: "searching", query });
    const searchResult = await webSearch(query);
    searchResults = searchResult.results;
    onActivity({ type: "search_done", resultCount: searchResults.length });

    // Fetch top result if it looks promising
    if (searchResults.length > 0 && searchResults[0].url) {
      onActivity({ type: "fetching", url: searchResults[0].url });
      try {
        const fetched = await fetchUrl(searchResults[0].url);
        fetchedContent = { title: fetched.title, text: fetched.text };
        onActivity({ type: "fetch_done", title: fetched.title });
      } catch (err) {
        logger.warn({ err, url: searchResults[0].url }, "Failed to fetch URL");
      }
    }
  }

  // Build response based on query type and available knowledge
  let responseText: string;

  try {
    if (relevantNodes.length === 0 && searchResults.length === 0) {
      // No relevant knowledge and no web results — respond honestly
      responseText = buildUnknownResponse(query, queryType, character);
    } else {
      // Synthesize from knowledge nodes + web results
      responseText = synthesizeFromNodesAndWeb(
        query,
        relevantNodes,
        searchResults,
        fetchedContent,
        character,
        voice,
        queryType,
      );
    }
  } catch (err) {
    logger.error({ err, query }, "Native synthesis failed, using fallback");
    // Fallback: simple response acknowledging the query
    responseText = buildFallbackResponse(query, character);
  }

  // Add character flavor to the response
  responseText = applyCharacterVoice(responseText, character, voice);

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

  // Triggers for web search
  const webTriggers = [
    "news", "current", "recent", "latest", "today", "yesterday", "this week",
    "who is", "what is happening", "what happened", "when did",
    "weather", "stock", "price of", "score", "results",
    "new", "just", "breaking", "announced", "released",
  ];

  // If query has web triggers, search
  if (webTriggers.some(trigger => lower.includes(trigger))) {
    return true;
  }

  // If no relevant knowledge nodes, search
  if (nodes.length === 0 || nodes.every(n => n.similarity < 0.2)) {
    return true;
  }

  // If query is a question about external facts
  if (lower.startsWith("what is ") || lower.startsWith("who is ") || lower.startsWith("where is ")) {
    return true;
  }

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

  // High curiosity: eager to learn
  if (curiosityLevel > 70) {
    return `I don't have any knowledge about that yet — but I'm curious! 🌱\n\nTell me more about "${query}" and I'll add it to my knowledge base. The more you teach me, the smarter I become!`;
  } 
  // Medium curiosity: friendly and open
  else if (curiosityLevel > 40) {
    return `I haven't learned about "${query}" yet.\n\n💡 Here's how you can teach me:\n• Share facts or information about it\n• Explain concepts in your own words\n• Tell me what you think about it\n\nI'll remember what you teach me for future conversations!`;
  } 
  // Low curiosity: straightforward but helpful
  else {
    return `I don't have information about that in my knowledge base yet.\n\nThis means we haven't discussed it before. Feel free to teach me — I learn from every conversation we have!`;
  }
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
): string {
  const parts: string[] = [];

  // Opening
  const opening = buildOpening(query, queryType, character);
  if (opening) parts.push(opening);

  // Web results (if available)
  if (searchResults.length > 0) {
    const webSection = synthesizeFromWeb(searchResults, fetchedContent, voice);
    if (webSection) parts.push(webSection);
  }

  // Knowledge nodes (if available)
  if (nodes.length > 0) {
    const knowledgeSection = synthesizeFromNodes(query, nodes, character, voice, queryType);
    if (knowledgeSection) parts.push(knowledgeSection);
  }

  // Closing
  if (character.curiosity > 50) {
    const closing = buildClosing(query, character);
    if (closing) parts.push(closing);
  }

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

function synthesizeFromNodes(
  query: string,
  nodes: RetrievedNode[],
  character: CharacterState,
  voice: ReturnType<typeof getVoiceModifiers>,
  queryType: string,
): string {
  // Sort by similarity (highest first)
  const sorted = [...nodes].sort((a, b) => b.similarity - a.similarity);
  const topNode = sorted[0];

  // Build response structure
  const parts: string[] = [];

  // Opening — acknowledge the query
  const opening = buildOpening(query, queryType, character);
  if (opening) parts.push(opening);

  // Main content — synthesize from top nodes
  const mainContent = synthesizeMainContent(sorted, voice);
  parts.push(mainContent);

  // Closing — invite further interaction if curious
  if (character.curiosity > 50) {
    const closing = buildClosing(query, character);
    if (closing) parts.push(closing);
  }

  return parts.join("\n\n");
}

// ──────────────────────────────────────────────────────────────────────────────
// Build opening based on query type
// ──────────────────────────────────────────────────────────────────────────────

function buildOpening(
  query: string,
  queryType: string,
  character: CharacterState,
): string {
  switch (queryType) {
    case "question":
      if (character.confidence > 60) {
        return `Based on what I've learned:`;
      } else {
        return `From my knowledge:`;
      }

    case "statement":
      if (character.empathy > 60) {
        return `I hear you. Here's what I know:`;
      } else {
        return `That connects to what I've learned:`;
      }

    case "command":
      return `I'll help with that. Here's what I know:`;

    default:
      return ``;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Synthesize main content from knowledge nodes
// ──────────────────────────────────────────────────────────────────────────────

function synthesizeMainContent(
  nodes: RetrievedNode[],
  voice: ReturnType<typeof getVoiceModifiers>,
): string {
  if (nodes.length === 0) return "";

  // Take top 3-5 nodes for coherence
  const topNodes = nodes.slice(0, 5);

  // Build coherent response from nodes
  const contentParts: string[] = [];

  for (const node of topNodes) {
    const confidence = Math.round(node.similarity * 100);
    
    // Add node content with confidence indicator
    if (voice.prefersDetail && confidence > 30) {
      // Detailed mode: include more context
      contentParts.push(`• ${node.content}`);
    } else if (confidence > 50) {
      // High confidence: state directly
      contentParts.push(node.content);
    } else if (confidence > 30) {
      // Medium confidence: hedge slightly
      contentParts.push(`This might be relevant: ${node.content}`);
    }
    // Low confidence (<30%): skip or mention briefly
  }

  // Join with appropriate connectors
  if (voice.prefersDetail) {
    return contentParts.join("\n");
  } else {
    // Concise mode: combine into flowing text
    return contentParts.slice(0, 3).join(" ");
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Build closing to invite further interaction
// ──────────────────────────────────────────────────────────────────────────────

function buildClosing(query: string, character: CharacterState): string {
  if (character.curiosity > 70) {
    return `What else can you tell me about this? I'm always learning.`;
  } else if (character.curiosity > 50) {
    return `Is there more you'd like to share about this?`;
  }
  return "";
}

// ──────────────────────────────────────────────────────────────────────────────
// Apply character voice modifiers to final response
// ──────────────────────────────────────────────────────────────────────────────

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

  // Learn from web search results (new information)
  for (const result of searchResults.slice(0, 2)) {
    if (result.snippet && result.snippet.length > 30) {
      const clean = result.snippet
        .replace(/!?\[.*?\]\(.*?\)/g, "")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[*_`]/g, "")
        .trim();
      if (clean.length > 20) {
        facts.push({
          content: clean,
          type: "fact",
          tags: keyTerms.slice(0, 5),
        });
      }
    }
  }

  // Learn from the conversation itself (user taught something)
  if (response.length > 50 && nodes.length === 0) {
    // This was new info, save a summary
    const summary = response.slice(0, 200);
    facts.push({
      content: summary,
      type: "conversation",
      tags: [...keyTerms.slice(0, 3), "learned"],
    });
  }

  return facts;
}
