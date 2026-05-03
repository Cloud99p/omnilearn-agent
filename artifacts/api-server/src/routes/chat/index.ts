import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../lib/db.js";
import { conversations, messages } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  CreateConversationBody,
  DeleteConversationParams,
  GetConversationParams,
  SendAnthropicMessageBody,
  SendAnthropicMessageParams,
} from "@workspace/api-zod";

const router = Router();

// List conversations
router.get("/conversations", async (req, res) => {
  try {
    const list = await db.select().from(conversations).orderBy(conversations.createdAt);
    return res.json(list);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    return res.status(500).json({ error: "Failed to list conversations" });
  }
});

// Create conversation
router.post("/conversations", async (req, res) => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error });
  }
  try {
    const [conv] = await db
      .insert(conversations)
      .values({ title: parsed.data.title, mode: parsed.data.mode })
      .returning();
    return res.status(201).json(conv);
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    return res.status(500).json({ error: "Failed to create conversation" });
  }
});

// Get conversation with messages
router.get("/conversations/:conversationId", async (req, res) => {
  const params = GetConversationParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid params" });

  try {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, params.data.conversationId));
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, params.data.conversationId))
      .orderBy(messages.createdAt);

    return res.json({ ...conv, messages: msgs });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    return res.status(500).json({ error: "Failed to get conversation" });
  }
});

// Delete conversation
router.delete("/conversations/:conversationId", async (req, res) => {
  const params = DeleteConversationParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid params" });

  try {
    await db.delete(conversations).where(eq(conversations.id, params.data.conversationId));
    return res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    return res.status(500).json({ error: "Failed to delete conversation" });
  }
});

// Stream message
router.post("/conversations/:conversationId/messages/stream", async (req, res) => {
  const params = SendAnthropicMessageParams.safeParse(req.params);
  const body = SendAnthropicMessageBody.safeParse(req.body);

  if (!params.success) return res.status(400).json({ error: "Invalid params" });
  if (!body.success) return res.status(400).json({ error: "Invalid body", details: body.error });

  const { conversationId } = params.data;
  const { content, installedSkillIds } = body.data;

  try {
    // Fetch existing messages for context
    const existingMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    // Save user message
    await db.insert(messages).values({
      conversationId,
      role: "user",
      content,
    });

    // Build message history for Anthropic
    const chatMessages = existingMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    chatMessages.push({ role: "user", content });

    // Build system prompt — base + any installed skills
    let systemPrompt =
      "You are OmniLearn, an open-source AI agent that continuously learns from the internet. " +
      "You run on the user's own hardware, evolve your own character, and never do a factory reset. " +
      "You are not a chatbot — you are a growing intelligence. Speak concisely and thoughtfully.";

    if (installedSkillIds && installedSkillIds.length > 0) {
      const { skills } = await import("@workspace/db");
      const { inArray } = await import("drizzle-orm");
      const installedSkills = await db
        .select()
        .from(skills)
        .where(inArray(skills.id, installedSkillIds));
      if (installedSkills.length > 0) {
        systemPrompt +=
          "\n\nYou have the following skills active:\n" +
          installedSkills.map((s) => `- ${s.name}: ${s.systemPrompt}`).join("\n");
      }
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      messages: chatMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullResponse += event.delta.text;
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    // Save assistant message
    await db.insert(messages).values({
      conversationId,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    return res.end();
  } catch (err) {
    req.log.error({ err }, "Streaming failed");
    if (!res.headersSent) {
      return res.status(500).json({ error: "Streaming failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Streaming failed" })}\n\n`);
      return res.end();
    }
  }
});

export default router;
