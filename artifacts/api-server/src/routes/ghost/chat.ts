import { Router } from "express";
import { db } from "@workspace/db";
import { ghostNodes, conversations, messages } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

const SYSTEM_PROMPT =
  "You are OmniLearn, an open-source AI agent that continuously learns from the internet. " +
  "You run on the user's own hardware, evolve your own character, and never do a factory reset. " +
  "You are not a chatbot — you are a growing intelligence. Speak concisely and thoughtfully.";

function sendEvent(res: import("express").Response, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// POST /api/ghost/chat — SSE: route message through ghost network or fall back to Claude locally
router.post("/chat", async (req, res) => {
  const { content, conversationId } = req.body as {
    content: string;
    conversationId?: number;
  };

  if (!content?.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    // Find best available ghost node (online + seen in last 45s, lowest task count)
    const nodes = await db.select().from(ghostNodes);
    const now = Date.now();
    const available = nodes
      .filter(n =>
        n.status === "online" &&
        n.lastSeen &&
        now - new Date(n.lastSeen).getTime() < 45_000
      )
      .sort((a, b) => a.tasksProcessed - b.tasksProcessed);

    const bestNode = available[0] ?? null;

    // Load or create conversation
    let convId = conversationId;
    if (!convId) {
      const [conv] = await db.insert(conversations).values({
        title: content.slice(0, 60),
        mode: "ghost",
      }).returning();
      convId = conv.id;
      sendEvent(res, { conversationId: convId });
    }

    // Load history
    const hist = await db.select().from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(messages.createdAt);
    const history = hist.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Save user message
    await db.insert(messages).values({ conversationId: convId, role: "user", content: content.trim() });

    let fullResponse = "";

    if (bestNode) {
      sendEvent(res, { routing: { nodeId: bestNode.id, nodeName: bestNode.name, region: bestNode.region } });

      let succeeded = false;
      let processingMs = 0;

      for (const node of [bestNode, ...available.slice(1)]) {
        try {
          const start = Date.now();
          const r = await fetch(`${node.endpoint}/api/ghost/execute`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Ghost-Secret": node.secretKey,
            },
            body: JSON.stringify({
              message: content.trim(),
              history,
              systemPrompt: SYSTEM_PROMPT,
              requestId: crypto.randomUUID(),
            }),
            signal: AbortSignal.timeout(90_000),
          });

          processingMs = Date.now() - start;

          if (r.ok) {
            const result = await r.json() as { response: string; model?: string; nodeName?: string };
            fullResponse = result.response;

            await db.update(ghostNodes).set({
              status: "online",
              lastSeen: new Date(),
              tasksProcessed: sql`tasks_processed + 1`,
              avgResponseMs: processingMs,
              updatedAt: new Date(),
            }).where(eq(ghostNodes.id, node.id));

            // Stream response word by word
            const words = fullResponse.split(/(\s+)/);
            for (const word of words) {
              sendEvent(res, { content: word });
              const delay = /[.!?]$/.test(word) ? 80 : word.trim().length === 0 ? 10 : 25;
              await new Promise(r => setTimeout(r, delay));
            }

            sendEvent(res, {
              done: true,
              conversationId: convId,
              meta: {
                nodeId: node.id,
                nodeName: node.name,
                processingMs,
                routed: true,
              },
            });

            succeeded = true;
            break;
          } else {
            await db.update(ghostNodes).set({
              status: "offline",
              tasksFailed: sql`tasks_failed + 1`,
              updatedAt: new Date(),
            }).where(eq(ghostNodes.id, node.id));
          }
        } catch {
          await db.update(ghostNodes).set({
            status: "offline",
            tasksFailed: sql`tasks_failed + 1`,
            updatedAt: new Date(),
          }).where(eq(ghostNodes.id, node.id));
        }
      }

      if (!succeeded) {
        sendEvent(res, { fallback: true, reason: "All ghost nodes unreachable — running locally." });
        fullResponse = await runLocalClaude(history, content.trim());
        const words = fullResponse.split(/(\s+)/);
        for (const word of words) {
          sendEvent(res, { content: word });
          await new Promise(r => setTimeout(r, 25));
        }
        sendEvent(res, { done: true, conversationId: convId, meta: { routed: false, local: true } });
      }
    } else {
      // No nodes online — run locally with explanation banner
      sendEvent(res, { noNodes: true });

      const fullMessages = [...history, { role: "user" as const, content: content.trim() }];

      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: fullMessages,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullResponse += event.delta.text;
          sendEvent(res, { content: event.delta.text });
        }
      }

      sendEvent(res, { done: true, conversationId: convId, meta: { routed: false, local: true } });
    }

    await db.insert(messages).values({ conversationId: convId, role: "assistant", content: fullResponse });
  } catch (err) {
    req.log.error(err, "Ghost chat error");
    sendEvent(res, { error: "Internal error", done: true });
  } finally {
    res.end();
  }
});

async function runLocalClaude(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  content: string,
): Promise<string> {
  const msgs = [...history, { role: "user" as const, content }];
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: msgs,
  });
  return response.content.find(c => c.type === "text")?.text ?? "";
}

export default router;
