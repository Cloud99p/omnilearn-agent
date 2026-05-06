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

  // Add character flavor to the response
  responseText = applyCharacterVoice(responseText, character, voice);

  return {
    text: responseText,
    nodesUsed: nodesUsed + (searchResults.length > 0 ? searchResults.length : 0),
    newNodesAdded: 0, // Will be updated by caller after learning
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

  if (curiosityLevel > 70) {
    return `I don't have any knowledge about that yet — but I'm curious! Tell me more about "${query}" and I'll learn from our conversation.`;
  } else if (curiosityLevel > 40) {
    return `I haven't learned about that yet. What can you teach me about "${query}"?`;
  } else {
    return `I don't have information about that in my knowledge base.`;
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
// Synthesize from web search results
// ──────────────────────────────────────────────────────────────────────────────

function synthesizeFromWeb(
  searchResults: SearchResult[],
  fetchedContent: { title: string; text: string } | null,
  voice: ReturnType<typeof getVoiceModifiers>,
): string {
  const topResults = searchResults.slice(0, 3);
  const parts: string[] = [];

  // Add fetched content if available (full page)
  if (fetchedContent) {
    const summary = fetchedContent.text.slice(0, 400);
    parts.push(`From ${fetchedContent.title}: ${summary}...`);
  }

  // Add search result snippets
  for (const result of topResults) {
    if (voice.prefersDetail) {
      parts.push(`• ${result.title}: ${result.snippet}`);
    } else {
      parts.push(result.snippet);
    }
  }

  if (parts.length === 0) return "";

  return `Here's what I found:\n${parts.join("\n")}`;
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
// Learn from interaction (creates new knowledge node)
// ──────────────────────────────────────────────────────────────────────────────

export async function learnFromInteraction(
  query: string,
  response: string,
  character: CharacterState,
): Promise<{ newNodeId?: number; content: string }> {
  // Extract key learning from the exchange
  // This is simplified — in production you'd use NLP to extract facts
  const learningSummary = `[Learned] ${query.substring(0, 100)}${query.length > 100 ? "..." : ""}`;

  // Return learning for caller to save to DB
  return {
    content: learningSummary,
  };
}
