import Anthropic from "@anthropic-ai/sdk";

// Support both Replit integration and standalone Anthropic API
const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY 
  ?? process.env.ANTHROPIC_API_KEY;
const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL
  ?? process.env.ANTHROPIC_BASE_URL
  ?? "https://api.anthropic.com";

if (!apiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY must be set. Get one from https://console.anthropic.com",
  );
}

export const anthropic = new Anthropic({
  apiKey,
  baseURL,
});
