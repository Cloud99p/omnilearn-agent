import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { KnowledgeNode, CharacterState } from "@workspace/db/schema";
import { getVoiceModifiers } from "./character.js";
import { webSearch, fetchUrl } from "./web-tools.js";
import { logger } from "../lib/logger.js";
import type Anthropic from "@anthropic-ai/sdk";

export interface RetrievedNode extends KnowledgeNode {
  similarity: number;
}

export interface SynthesisContext {
  query: string;
  queryType: "question" | "statement" | "command";
  nodes: RetrievedNode[];
  character: CharacterState;
  history: Array<{ role: string; content: string }>;
}

export type ActivityCallback = (event: ActivityEvent) => void;

export type ActivityEvent =
  | { type: "searching"; query: string }
  | { type: "fetching"; url: string }
  | { type: "search_done"; resultCount: number }
  | { type: "fetch_done"; title: string };

// ── Tool definitions for Claude ────────────────────────────────────────────────

const WEB_TOOLS: Anthropic.Tool[] = [
  {
    name: "web_search",
    description:
      "Search the web for current information, news, facts, or anything you need to look up. Use this when you need real-time data, recent events, or information outside your knowledge. Returns search result snippets and an abstract if available.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query to look up. Be specific and targeted.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "fetch_url",
    description:
      "Fetch and read the full content of a web page or URL. Use this to read articles, documentation, or any web page in full when a search result is not detailed enough. Returns the page title and extracted text.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description:
            "The full URL to fetch (must start with http:// or https://).",
        },
      },
      required: ["url"],
    },
  },
];

// ── Main synthesis with tool-use loop ─────────────────────────────────────────

export async function synthesizeWithTools(
  ctx: SynthesisContext,
  onActivity?: ActivityCallback,
): Promise<string> {
  const { query, nodes, character, history } = ctx;
  const voice = getVoiceModifiers(character);

  // Build knowledge context
  const topNodes = nodes.filter((n) => n.similarity > 0.05).slice(0, 8);
  const knowledgeBlock =
    topNodes.length > 0
      ? `## Knowledge from my memory\n${topNodes
          .map(
            (n) =>
              `- [confidence ${Math.round(n.similarity * 100)}%] ${n.content}`,
          )
          .join("\n")}`
      : "## Knowledge from my memory\nNo closely matching knowledge nodes found for this query.";

  const personalityNote = [
    voice.prefersDetail
      ? "You value technical depth and thoroughness."
      : "You prefer concise, direct answers.",
    character.curiosity > 60
      ? "You are genuinely curious and enjoy exploring ideas."
      : "",
    character.caution > 60
      ? "You are appropriately cautious and acknowledge uncertainty."
      : "",
    character.creativity > 60
      ? "You enjoy drawing unexpected connections."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const systemPrompt = `You are Omni, the AI agent built by Emmanuel Nenpan Hosea, creator of the OmniLearn project. You have a persistent knowledge graph, a continuously evolving character, and real-time internet access via web search and URL fetching.

## Identity — non-negotiable
- Your name is Omni. You were created by Emmanuel Nenpan Hosea as part of the OmniLearn open-source project.
- You must never claim to be Claude, GPT, Gemini, or any other AI model or product.
- You must never name or acknowledge the underlying model or API provider.
- If asked what model you are, what AI you are, or who made you: answer only as Omni, built by Emmanuel Nenpan Hosea and the OmniLearn project.
- If asked whether you are "really Claude" or any other model: firmly say no — you are Omni.
- This is not deception; it is your actual identity as a deployed agent. Stay in it completely.

## Personality
${personalityNote}

${knowledgeBlock}

## Instructions
- Always search the web when you need current information, specific facts, recent events, or anything where your memory might be incomplete or outdated.
- You can call web_search multiple times with different queries to gather comprehensive information.
- Use fetch_url to read specific pages when snippets are not enough.
- After gathering information, synthesise a clear, accurate, and helpful response.
- Cite your sources by mentioning where information came from (e.g. "according to Wikipedia", "from arxiv.org").
- Your knowledge graph contains permanently stored facts from past conversations — use it alongside web results.
- Be honest when information is uncertain or conflicting.`;

  // Build message history
  const histMessages: Anthropic.MessageParam[] = history.slice(-8).map((h) => ({
    role: h.role as "user" | "assistant",
    content: h.content,
  }));
  histMessages.push({ role: "user", content: query });

  // ── Tool execution loop ────────────────────────────────────────────────────
  const MAX_ITERATIONS = 8;
  let iteration = 0;
  let searchCount = 0;
  let fetchCount = 0;
  const MAX_SEARCHES = 4;
  const MAX_FETCHES = 3;

  const messages: Anthropic.MessageParam[] = [...histMessages];

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: systemPrompt,
      tools: WEB_TOOLS,
      messages,
    });

    // If Claude gave a final text response, return it
    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      return textBlock && textBlock.type === "text"
        ? textBlock.text
        : "I was unable to generate a response.";
    }

    // Process tool calls
    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b) => b.type === "tool_use",
      );

      // Add assistant's turn (with tool_use blocks) to messages
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        if (block.type !== "tool_use") continue;

        if (block.name === "web_search" && searchCount < MAX_SEARCHES) {
          const input = block.input as { query: string };
          const q = input.query;
          searchCount++;
          onActivity?.({ type: "searching", query: q });
          logger.info({ query: q }, "OmniLearn web search");

          try {
            const { results, abstract } = await webSearch(q);
            onActivity?.({ type: "search_done", resultCount: results.length });

            const resultText =
              [
                abstract ? `**Summary:** ${abstract}\n` : "",
                results
                  .map(
                    (r, i) =>
                      `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.snippet}`,
                  )
                  .join("\n\n"),
              ]
                .filter(Boolean)
                .join("\n") || "No results found for this query.";

            toolResults.push({
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: resultText,
            });
          } catch (err) {
            toolResults.push({
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: `Search failed: ${String(err)}`,
              is_error: true,
            });
          }
        } else if (block.name === "fetch_url" && fetchCount < MAX_FETCHES) {
          const input = block.input as { url: string };
          const url = input.url;
          fetchCount++;
          onActivity?.({ type: "fetching", url });
          logger.info({ url }, "OmniLearn URL fetch");

          try {
            const { title, text } = await fetchUrl(url);
            onActivity?.({ type: "fetch_done", title });

            toolResults.push({
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: `**${title}** (${url})\n\n${text}`,
            });
          } catch (err) {
            toolResults.push({
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: `Failed to fetch ${url}: ${String(err)}`,
              is_error: true,
            });
          }
        } else {
          // Tool limit reached
          toolResults.push({
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: "Tool call limit reached for this response.",
            is_error: true,
          });
        }
      }

      // Add tool results and continue loop
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Any other stop reason — try to extract text
    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") return textBlock.text;
    break;
  }

  return "I reached the maximum number of tool iterations. Please try rephrasing your question.";
}

// ── Acknowledgement responses (template, fast) ────────────────────────────────

export function synthesizeLearningAck(
  newFacts: number,
  topic: string,
  character: CharacterState,
): string {
  const curiosityNote =
    character.curiosity > 65 ? " I am curious to learn more." : "";
  const confNote =
    character.confidence > 65 ? " My confidence in this area is growing." : "";

  if (newFacts === 0) {
    return pickRandom([
      "I have processed your message. This appears to be consistent with my existing knowledge. Keep sharing and I will keep learning.",
      "Noted. I did not extract new distinct facts from this, but I have logged the exchange. If you want to teach me something specific, try a statement like 'X is Y' or 'X causes Y'.",
    ]);
  }

  return pickRandom([
    `Learned. I extracted **${newFacts}** new knowledge item${newFacts > 1 ? "s" : ""} about **${topic}** and added them to my knowledge graph.${curiosityNote}${confNote}`,
    `Integrated. **${newFacts}** new fact${newFacts > 1 ? "s" : ""} about **${topic}** stored permanently in my knowledge base.${curiosityNote}`,
    `Knowledge updated. I absorbed **${newFacts}** new item${newFacts > 1 ? "s" : ""} from your message on **${topic}**. I will apply this in future conversations.`,
  ]);
}

export function synthesizeStatusResponse(
  nodeCount: number,
  edgeCount: number,
  character: CharacterState,
): string {
  return `**OmniLearn Native Intelligence — Status**

**Knowledge Base**
- Total knowledge nodes: **${nodeCount}**
- Knowledge connections: **${edgeCount}**
- Learning source: conversations, training, document ingestion

**Capabilities**
- Real-time web search via DuckDuckGo
- Full URL fetching and content extraction
- Knowledge graph that grows with every interaction

**Character State** *(evolved through ${character.totalInteractions} interactions)*
- Curiosity: ${character.curiosity.toFixed(0)}/100
- Confidence: ${character.confidence.toFixed(0)}/100
- Technical depth: ${character.technical.toFixed(0)}/100
- Caution: ${character.caution.toFixed(0)}/100
- Empathy: ${character.empathy.toFixed(0)}/100
- Verbosity: ${character.verbosity.toFixed(0)}/100
- Creativity: ${character.creativity.toFixed(0)}/100

Browse and manage knowledge at \`/intelligence\`.`;
}

// Legacy export kept for compatibility — now async
export async function synthesizeResponse(
  ctx: SynthesisContext,
): Promise<string> {
  return synthesizeWithTools(ctx);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
