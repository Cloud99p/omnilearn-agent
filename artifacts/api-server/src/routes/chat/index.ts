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
      const list = await db
        .select()
        .from(conversations)
        .where(eq(conversations.clerkId, userId))
        .orderBy(conversations.createdAt);
      return res.json(list);
    }

    // If NOT logged in (anonymous user), show conversations without clerkId
    const list = await db
      .select()
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
    const list = await db
      .select()
      .from(conversations)
      .orderBy(conversations.createdAt);
    return res.json(list);
  } catch (err) {
    req.log.error({ err }, "Failed to list all conversations");
    return res.status(500).json({ error: "Failed to list all conversations" });
  }
});

// Get conversation by ID (USER-ISOLATED)
router.get("/conversations/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params as GetConversationParams;
    const { userId } = getAuth(req);

    const conv = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, parseInt(conversationId, 10)))
      .limit(1);

    if (conv.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // If user logged in, only show their conversations
    if (userId && conv[0].clerkId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get messages for this conversation
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, parseInt(conversationId, 10)))
      .orderBy(messages.createdAt);

    return res.json({
      ...conv[0],
      messages: msgs,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    return res.status(500).json({ error: "Failed to get conversation" });
  }
});

// Create conversation
router.post("/conversations", async (req, res) => {
  try {
    const { title, clerkId } = req.body as CreateConversationBody;
    const { userId } = getAuth(req);

    // If Clerk configured, use userId; otherwise use provided clerkId
    const finalClerkId = userId || clerkId || null;

    const [conv] = await db
      .insert(conversations)
      .values({
        title: title || "New Conversation",
        clerkId: finalClerkId,
      })
      .returning();

    return res.status(201).json(conv);
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    return res.status(500).json({ error: "Failed to create conversation" });
  }
});

// Delete conversation (USER-ISOLATED)
router.delete(
  "/conversations/:conversationId",
  async (req, res) => {
    try {
      const { conversationId } = req.params as DeleteConversationParams;
      const { userId } = getAuth(req);

      const conv = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, parseInt(conversationId, 10)))
        .limit(1);

      if (conv.length === 0) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // If user logged in, only allow deletion of their conversations
      if (userId && conv[0].clerkId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await db
        .delete(messages)
        .where(eq(messages.conversationId, parseInt(conversationId, 10)));

      await db
        .delete(conversations)
        .where(eq(conversations.id, parseInt(conversationId, 10)));

      return res.json({ success: true });
    } catch (err) {
      req.log.error({ err }, "Failed to delete conversation");
      return res.status(500).json({ error: "Failed to delete conversation" });
    }
  },
);

// Send message (uses Anthropic API)
router.post(
  "/:conversationId/messages",
  async (req, res) => {
    try {
      const { conversationId } = req.params as { conversationId: string };
      const { content } = req.body as SendAnthropicMessageBody;
      const { userId } = getAuth(req);

      // Verify conversation exists and user has access
      const conv = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, parseInt(conversationId, 10)))
        .limit(1);

      if (conv.length === 0) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (userId && conv[0].clerkId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Save user message
      const [userMsg] = await db
        .insert(messages)
        .values({
          conversationId: parseInt(conversationId, 10),
          role: "user",
          content,
        })
        .returning();

      // Get conversation history
      const history = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, parseInt(conversationId, 10)))
        .orderBy(messages.createdAt);

      const messagesOnly = history.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Process through brain (native synthesizer)
      const result = await processMessage(
        content,
        userId || null,
        messagesOnly,
      );

      // Save assistant message
      const [assistantMsg] = await db
        .insert(messages)
        .values({
          conversationId: parseInt(conversationId, 10),
          role: "assistant",
          content: result.text,
        })
        .returning();

      return res.json({
        response: result.text,
        messageId: assistantMsg.id,
        nodesUsed: result.nodesUsed,
        newNodesAdded: result.newNodesAdded,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to send message");
      return res.status(500).json({ error: "Failed to send message" });
    }
  },
);

export default router;
