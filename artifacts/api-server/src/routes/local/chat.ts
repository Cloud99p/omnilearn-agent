import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { processMessage } from "../../brain/index.js";

const router = Router();

// POST /api/local/chat — Knowledge graph only, NO web search
router.post("/chat", async (req, res) => {
  const { content, conversationId } = req.body as {
    content: string;
    conversationId?: number;
  };

  if (!content?.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Load conversation history
    let history: Array<{ role: string; content: string }> = [];
    let convId = conversationId;

    if (convId) {
      const hist = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, convId))
        .orderBy(desc(messages.createdAt))
        .limit(10);
      history = hist
        .reverse()
        .map((m) => ({ role: m.role, content: m.content }));
    } else {
      // Create a new conversation
      const title = content.slice(0, 60);
      const [conv] = await db
        .insert(conversations)
        .values({
          title,
          mode: "local",
        })
        .returning();
      convId = conv.id;
      sendEvent({ conversationId: convId });
    }

    // Save user message
    await db.insert(messages).values({
      conversationId: convId,
      role: "user",
      content: content.trim(),
    });

    const clerkId = null;

    // Process through brain — NO web search, knowledge graph only
    // Pass onActivity as undefined to disable web search
    const result = await processMessage(
      content.trim(),
      clerkId,
      history,
      undefined,
    );

    // Stream the response word-by-word
    const words = result.text.split(/(\s+)/);
    for (const word of words) {
      sendEvent({ content: word });
      const delay = word.match(/[.!?]$/)
        ? 80
        : word.match(/[,;:]$/)
          ? 40
          : word.trim().length === 0
            ? 15
            : 25;
      await new Promise((r) => setTimeout(r, delay));
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

    // Save assistant message
    await db.insert(messages).values({
      conversationId: convId,
      role: "assistant",
      content: result.text,
    });

    sendEvent({ done: true, conversationId: convId });
  } catch (err) {
    req.log.error(err, "Local chat error");
    sendEvent({ error: "Internal error", done: true });
  } finally {
    res.end();
  }
});

export default router;
