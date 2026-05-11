import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../lib/db.js";
import { conversations, messages } from "@workspace/db";
import { processMessage } from "../../brain/index.js";
import { clerkMiddleware, getAuth } from "@clerk/express";
import {
  CreateConversationBody,
  DeleteConversationParams,
  GetConversationParams,
  SendAnthropicMessageBody,
  SendAnthropicMessageParams,
} from "@workspace/api-zod";

const router = Router();

// Clerk auth is OPTIONAL - enables user isolation when configured
// If Clerk not configured, chat works without isolation
router.use(clerkMiddleware());

// List conversations (USER-ISOLATED: only shows current user's conversations)
router.get("/conversations", async (req, res) => {
  try {
    const { userId } = getAuth(req);
    
    // If Clerk configured and user logged in, show ONLY their conversations
    if (userId) {
      const list = await db.select()
        .from(conversations)
        .where(eq(conversations.clerkId, userId))
        .orderBy(conversations.createdAt);
      return res.json(list);
    }
    
    // If NOT logged in (anonymous user), show conversations without clerkId
    const list = await db.select()
      .from(conversations)
      .where(eq(conversations.clerkId, null))
      .orderBy(conversations.createdAt);
    return res.json(list);
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    return res.status(500).json({ error: "Failed to list conversations" });
  }
});

// List all conversations (for debugging - remove in production)
router.get("/conversations/all", async (req, res) => {
  try {
    const list = await db.select()
      .from(conversations)
      .orderBy(conversations.createdAt);
    return res.json(list);
  } catch (err) {
    req.log.error({ err }, "Failed to list all conversations");
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
    // SECURITY: Save with user's clerkId if Clerk configured
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
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, params.data.conversationId));
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    // If Clerk configured, check ownership
    if (userId && conv.clerkId && conv.clerkId !== userId) {
      return res.status(403).json({ error: "Forbidden - not your conversation" });
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
    // If Clerk configured, check ownership before deleting
    if (userId) {
      await db.delete(conversations).where(
        and(
          eq(conversations.id, params.data.conversationId),
          eq(conversations.clerkId, userId)
        )
      );
    } else {
      // No Clerk - delete by ID only
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
    
    // If Clerk configured, check ownership
    if (userId && conv.clerkId && conv.clerkId !== userId) {
      return res.status(403).json({ error: "Forbidden - not your conversation" });
    }
    
    // Fetch existing messages for context
    const existingMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    // Save user message - with clerkId if logged in, null if anonymous
    await db.insert(messages).values({
      conversationId,
      role: "user",
      content,
      clerkId: userId || null, // Anonymous = null, Logged-in = userId
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
    const result = await processMessage(content, userId || null, history);

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

    // Save assistant message with clerkId (if Clerk configured)
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
