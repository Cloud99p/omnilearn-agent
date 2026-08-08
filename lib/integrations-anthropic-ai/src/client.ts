import Anthropic from "@anthropic-ai/sdk";

// Lazy client: constructing the Anthropic SDK requires an API key, but only
// AI-powered features (synthesizer, ghost routes) need it. The knowledge
// graph API (record/search/delete/batch) works without any AI key, so the
// server MUST boot even when no key is configured (e.g. fresh Railway env).
// We build the client on first actual use and throw a clear error there.

const apiKey = () =>
  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ??
  process.env.ANTHROPIC_API_KEY;

const baseURL = () =>
  process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ??
  process.env.ANTHROPIC_BASE_URL ??
  "https://api.anthropic.com";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const key = apiKey();
    if (!key) {
      throw new Error(
        "ANTHROPIC_API_KEY must be set. Get one from https://console.anthropic.com",
      );
    }
    client = new Anthropic({ apiKey: key, baseURL: baseURL() });
  }
  return client;
}

/**
 * Proxy that resolves to the real Anthropic client on first member access.
 * `await anthropic.messages.create(...)` behaves identically to before; the
 * only difference is the key check happens at call time, not import time.
 */
export const anthropic: Anthropic = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    const c = getClient();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
