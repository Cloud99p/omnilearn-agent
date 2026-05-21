/**
 * FreeLLMAPI client for hybrid response synthesis
 * 
 * This utility allows OmniLearn to occasionally use free LLM APIs
 * as a "teacher model" to improve the native synthesizer over time.
 * 
 * Usage:
 * - Primary mode: Use native synthesizer (70% of requests)
 * - Fallback mode: Use FreeLLMAPI for unknown queries (30% of requests)
 * - Training mode: Log both responses for analysis
 */

import { createClient } from "openai";

const FREE_LLM_API_URL = process.env.FREELLM_API_URL || "http://localhost:3001/v1";
const FREE_LLM_API_KEY = process.env.FREELLM_API_KEY;

// Validate configuration
if (!FREE_LLM_API_KEY) {
  console.warn("[FreeLLMAPI] FREELLM_API_KEY not set - LLM fallback disabled");
}

/**
 * Call FreeLLMAPI to get an LLM response
 */
export async function callFreeLLM(
  query: string,
  context: {
    retrievedNodes?: Array<{ content: string; similarity: number }>;
    systemPrompt?: string;
  } = {},
): Promise<{
  response: string;
  model: string;
  routedVia: string;
}> {
  if (!FREE_LLM_API_KEY) {
    throw new Error("FREELLM_API_KEY not configured");
  }

  const openai = new createClient({
    baseURL: FREE_LLM_API_URL,
    apiKey: FREE_LLM_API_KEY,
  });

  const messages = [
    {
      role: "system",
      content: context.systemPrompt || "You are a helpful AI assistant.",
    },
    {
      role: "user",
      content: buildContextualPrompt(query, context.retrievedNodes),
    },
  ];

  const response = await openai.chat.completions.create({
    model: "auto", // Let the router pick the best available model
    messages,
    stream: false,
  });

  const content = response.choices[0]?.message?.content || "";
  const routedVia = response.headers?.get("x-routed-via") || "unknown";

  return {
    response: content,
    model: response.model,
    routedVia,
  };
}

/**
 * Build a contextual prompt with retrieved knowledge
 */
function buildContextualPrompt(
  query: string,
  nodes?: Array<{ content: string; similarity: number }>,
): string {
  if (!nodes || nodes.length === 0) {
    return query;
  }

  const facts = nodes
    .slice(0, 5)
    .map((n) => `- ${n.content}`)
    .join("\n");

  return `Answer this question using the retrieved facts when relevant:

Facts:
${facts}

Question: ${query}

If the facts are relevant, use them to answer. If not, use your general knowledge.
Be conversational, not textbook. Match the user's tone.
`;
}

/**
 * Score a response for conversationality (1-10)
 * Uses FreeLLMAPI to evaluate native responses
 */
export async function scoreResponse(
  query: string,
  response: string,
): Promise<number> {
  if (!FREE_LLM_API_KEY) {
    return 5; // Default score if LLM unavailable
  }

  const openai = new createClient({
    baseURL: FREE_LLM_API_URL,
    apiKey: FREE_LLM_API_KEY,
  });

  const prompt = `Score this response 1-10 for conversationality:

Query: "${query}"
Response: "${response}"

Criteria:
- Sounds human (not Wikipedia/textbook)
- Matches casual tone
- Not robotic or templated
- Appropriate length (not too short, not rambling)
- Engaging

Return ONLY a number 1-10, no explanation.
`;

  const response = await openai.chat.completions.create({
    model: "auto",
    messages: [{ role: "user", content: prompt }],
    stream: false,
  });

  const content = response.choices[0]?.message?.content || "5";
  const score = parseInt(content.trim(), 10);
  return isNaN(score) ? 5 : Math.max(1, Math.min(10, score));
}
