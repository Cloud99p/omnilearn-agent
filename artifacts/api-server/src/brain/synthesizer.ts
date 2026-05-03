import type { KnowledgeNode } from "@workspace/db/schema";
import type { CharacterState } from "@workspace/db/schema";
import { getVoiceModifiers } from "./character.js";

export interface RetrievedNode extends KnowledgeNode {
  similarity: number;
}

interface SynthesisContext {
  query: string;
  queryType: "question" | "statement" | "command";
  nodes: RetrievedNode[];
  character: CharacterState;
  history: Array<{ role: string; content: string }>;
}

const HIGH_CONF = 0.38;
const MED_CONF = 0.14;

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatFacts(nodes: RetrievedNode[], maxNodes = 4, detail = false): string {
  const top = nodes.slice(0, maxNodes);
  if (top.length === 0) return "";

  const lines = top.map(n => {
    const conf = n.similarity > 0.6 ? "" : n.similarity > 0.3 ? " *(moderate confidence)*" : " *(low confidence)*";
    return `- ${n.content}${conf}`;
  });

  if (!detail && lines.length === 1) return top[0].content;
  return lines.join("\n");
}

function extractMainTopic(query: string): string {
  const cleaned = query
    .replace(/^(what|who|where|when|why|how|can you|tell me|explain|describe|is|are|do|does)\s+/i, "")
    .replace(/\?$/, "")
    .trim();
  return cleaned.slice(0, 60) || query.slice(0, 60);
}

export function synthesizeResponse(ctx: SynthesisContext): string {
  const { query, queryType, nodes, character } = ctx;
  const voice = getVoiceModifiers(character);
  const topic = extractMainTopic(query);
  const detail = voice.prefersDetail;

  const topNode = nodes[0];
  const topSim = topNode?.similarity ?? 0;

  // ── No knowledge ──────────────────────────────────────────────────────────
  if (nodes.length === 0 || topSim < 0.05) {
    const noKnowledge = [
      `I have not learned about **${topic}** yet.\n\nMy knowledge base is empty on this topic. You can teach me in two ways:\n- **Tell me directly** — just share information about ${topic} in this conversation and I will absorb it.\n- **Use the Training interface** at \`/intelligence\` to add structured knowledge.\n\nI remember everything you teach me permanently.`,
      `**${topic}** is outside my current knowledge.\n\nI am a learning system — I start with what I have been taught and grow from there. Share what you know about ${topic} and I will integrate it into my knowledge graph immediately.\n\nYou can also browse my current knowledge at \`/intelligence\`.`,
      `I do not yet have knowledge about **${topic}**.\n\nThis is an honest gap in my knowledge base. Unlike models trained on static datasets, I only know what I have been explicitly taught or inferred from previous conversations.\n\nTeach me: what should I know about ${topic}?`,
    ];
    return pickRandom(noKnowledge);
  }

  // ── Very low confidence ───────────────────────────────────────────────────
  if (topSim < MED_CONF) {
    const weakFacts = formatFacts(nodes, 2, false);
    return [
      `My knowledge of **${topic}** is limited. The closest I have is:\n\n${weakFacts}\n\n${voice.uncertaintyPhrase}. If this is not relevant, please teach me more about ${topic} directly.`,
      `I have very little on **${topic}** — here is what I can find:\n\n${weakFacts}\n\nThis may not be exactly what you are looking for. I learn from every conversation, so sharing more will improve my future responses on this topic.`,
    ][Math.floor(Math.random() * 2)];
  }

  // ── Medium confidence ─────────────────────────────────────────────────────
  if (topSim < HIGH_CONF) {
    const facts = formatFacts(nodes, detail ? 4 : 3, detail);
    const opener = voice.openingTone ? `${voice.openingTone}\n\n` : "";
    const closer = voice.closingStyle ? `\n\n${voice.closingStyle}` : "";

    if (queryType === "question") {
      return `${opener}Based on what I have learned about **${topic}**:\n\n${facts}\n\n${voice.uncertaintyPhrase} — my confidence here is moderate. I may have incomplete coverage.${closer}`;
    }
    return `${opener}Regarding **${topic}**, here is what I know:\n\n${facts}${closer}`;
  }

  // ── High confidence ────────────────────────────────────────────────────────
  const facts = formatFacts(nodes, detail ? 5 : 3, detail);
  const opener = voice.openingTone ? `${voice.openingTone}\n\n` : "";
  const closer = voice.closingStyle ? `\n\n${voice.closingStyle}` : "";

  if (queryType === "question") {
    const starters = [
      `${opener}**${topic}**: here is what I know with high confidence:\n\n${facts}`,
      `${opener}I have solid knowledge on **${topic}**:\n\n${facts}`,
      `${opener}On the subject of **${topic}**:\n\n${facts}`,
    ];
    return pickRandom(starters) + closer;
  }

  if (queryType === "command") {
    return `${opener}Here is what I have stored about **${topic}**:\n\n${facts}${closer}`;
  }

  return `${opener}My knowledge on **${topic}**:\n\n${facts}${closer}`;
}

export function synthesizeLearningAck(
  newFacts: number,
  topic: string,
  character: CharacterState,
): string {
  if (newFacts === 0) {
    return pickRandom([
      `I have processed your message. This appears to be consistent with — or does not add new structured facts to — my existing knowledge. Keep sharing and I will keep learning.`,
      `Noted. I did not extract new distinct facts from this, but I have logged the exchange. If you want to teach me something specific, try a statement like "X is Y" or "X causes Y".`,
    ]);
  }

  const curiosityNote = character.curiosity > 65 ? " I am curious to learn more." : "";
  const confNote = character.confidence > 65 ? " My confidence in this area is growing." : "";

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

**Character State** *(evolved through ${character.totalInteractions} interactions)*
- Curiosity: ${character.curiosity.toFixed(0)}/100
- Confidence: ${character.confidence.toFixed(0)}/100
- Technical depth: ${character.technical.toFixed(0)}/100
- Caution: ${character.caution.toFixed(0)}/100
- Empathy: ${character.empathy.toFixed(0)}/100
- Verbosity: ${character.verbosity.toFixed(0)}/100
- Creativity: ${character.creativity.toFixed(0)}/100

This is a self-contained intelligence system. It learns only from what it is taught — no external AI APIs are used. Browse and manage knowledge at \`/intelligence\`.`;
}
