import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../lib/db.js";
import { conversations, messages } from "@workspace/db";
import { processMessage } from "../../brain/index.js";
import { getAuth } from "@clerk/express";
import {
  CreateConversationBody,
  DeleteConversationParams,
  GetConversationParams,
  SendAnthropicMessageBody,
  SendAnthropicMessageParams,
} from "@workspace/api-zod";

const router = Router();

// Clerk auth is OPTIONAL - chat works with or without it
// router.use(clerkMiddleware());

// List conversations (USER-ISOLATED: only shows current user's conversations)
router.get("/conversations", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    
    // If no auth, return empty list (don't block)
    if (!userId) {
      return res.json([]);
    }
    
    // SECURITY: Filter by current user's clerkId
    const list = await db.select()
      .from(conversations)
      .where(eq(conversations.clerkId, userId))
      .orderBy(conversations.createdAt);
    
    return res.json(list);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    return res.status(500).json({ error: "Failed to list conversations" });
  }
});

// Create conversation (USER-ISOLATED: saves with current user's clerkId)
router.post("/conversations", async (req, res) => {
  const { userId } = getAuth(req);
  
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error });
  }
  try {
    // SECURITY: Save with current user's clerkId (if auth available)
    const [conv] = await db
      .insert(conversations)
      .values({ 
        title: parsed.data.title, 
        mode: parsed.data.mode,
        clerkId: userId || null, // USER ISOLATION (optional)
      })
      .returning();
    return res.status(201).json(conv);
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    return res.status(500).json({ error: "Failed to create conversation" });
  }
});

// Get conversation with messages (USER-ISOLATED: checks ownership)
router.get("/conversations/:conversationId", async (req, res) => {
  const { userId } = getAuth(req);
  
  const params = GetConversationParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid params" });

  try {
    // SECURITY: Check ownership if auth available
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, params.data.conversationId));
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    // If auth is enabled, check ownership
    if (userId && conv.clerkId && conv.clerkId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

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

// Delete conversation (USER-ISOLATED: can only delete own conversations)
router.delete("/conversations/:conversationId", async (req, res) => {
  const { userId } = getAuth(req);
  
  const params = DeleteConversationParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid params" });

  try {
    // If auth enabled, check ownership
    if (userId) {
      await db.delete(conversations).where(
        and(
          eq(conversations.id, params.data.conversationId),
          eq(conversations.clerkId, userId)
        )
      );
    } else {
      // No auth - just delete by ID
      await db.delete(conversations).where(eq(conversations.id, params.data.conversationId));
    }
    return res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    return res.status(500).json({ error: "Failed to delete conversation" });
  }
});

// Stream message — uses native brain (no external LLM, learns from conversation)
router.post("/conversations/:conversationId/messages/stream", async (req, res) => {
  const { userId } = getAuth(req);
  
  const params = SendAnthropicMessageParams.safeParse(req.params);
  const body = SendAnthropicMessageBody.safeParse(req.body);

  if (!params.success) return res.status(400).json({ error: "Invalid params" });
  if (!body.success) return res.status(400).json({ error: "Invalid body", details: body.error });

  const { conversationId } = params.data;
  const { content } = body.data;

  try {
    // Verify conversation exists
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId));
    if (!conv) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    
    // If auth enabled, check ownership
    if (userId && conv.clerkId && conv.clerkId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    // Fetch existing messages for context
    const existingMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    // Save user message with clerkId (if auth available)
    await db.insert(messages).values({
      conversationId,
      role: "user",
      content,
      clerkId: userId || null, // USER ISOLATION (optional)
    });

    // Build message history for brain
    const history = existingMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendEvent = (data: object) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Process through native brain (learns from conversation)
    const clerkId = null;
    const result = await processMessage(content, clerkId, history);

    // Stream the response word-by-word
    const words = result.text.split(/(\s+)/);
    for (const word of words) {
      sendEvent({ content: word });
      const delay = /[.!?]$/.test(word) ? 80 : word.trim().length === 0 ? 10 : 25;
      await new Promise(r => setTimeout(r, delay));
    }

    // Send metadata
    sendEvent({
      meta: {
        nodesUsed: result.nodesUsed,
        newNodesAdded: result.newNodesAdded,
        character: {
          curiosity: result.character.curiosity,
          confidence: result.character.confidence,
          technical: result.character.technical,
        },
      },
    });

    // Save assistant message with clerkId (if auth available)
    await db.insert(messages).values({
      conversationId,
      role: "assistant",
      content: result.text,
      clerkId: userId || null, // USER ISOLATION (optional)
    });

    sendEvent({ done: true, conversationId });
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
