import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { processMessage, seedIfEmpty, trainOnText } from "../../brain/index.js";

const router = Router();

// POST /api/omni/chat  — SSE streaming native intelligence chat
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
    await seedIfEmpty();

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
          mode: "native",
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

    const clerkId = null; // Future: extract from auth

    // Activity callback — streams search/fetch events to the client in real time
    const onActivity = (event: {
      type: string;
      query?: string;
      url?: string;
      resultCount?: number;
      title?: string;
    }) => {
      if (event.type === "searching") sendEvent({ searching: event.query });
      if (event.type === "fetching") sendEvent({ fetching: event.url });
      if (event.type === "search_done")
        sendEvent({ searchDone: true, resultCount: event.resultCount });
      if (event.type === "fetch_done")
        sendEvent({ fetchDone: true, pageTitle: event.title });
    };

    // Process through brain (now uses Claude with tool_use + web access)
    const result = await processMessage(
      content.trim(),
      clerkId,
      history,
      onActivity,
    );

    // Stream the response token-by-token
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

    // Send metadata event
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

    trainOnText(result.text, "chat-response", clerkId).catch((err) => {
      req.log.warn({ err }, "Failed to learn from chat response");
    });

    sendEvent({ done: true, conversationId: convId });
  } catch (err) {
    req.log.error(err, "Brain processing error");
    sendEvent({ error: "Internal brain error", done: true });
  } finally {
    res.end();
  }
});

export default router;
