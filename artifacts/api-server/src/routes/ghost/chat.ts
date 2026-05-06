import { Router } from "express";
import { db } from "@workspace/db";
import { ghostNodes, ghostWorkerSessions, ghostWorkerTasks, conversations, messages, characterState } from "@workspace/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { processMessage } from "../../brain/index.js";
import crypto from "crypto";

const router = Router();

function sendEvent(res: import("express").Response, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// POST /api/ghost/chat — SSE: route through server nodes, then browser workers, then local
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
    // Find best available server ghost node (online + seen in last 45s, lowest task count)
    const serverNodes = await db.select().from(ghostNodes);
    const now = Date.now();
    const availableServerNodes = serverNodes
      .filter(n =>
        n.status === "online" &&
        n.lastSeen &&
        now - new Date(n.lastSeen).getTime() < 45_000
      )
      .sort((a, b) => a.tasksProcessed - b.tasksProcessed);

    // Find active browser workers (seen in last 90s, idle)
    const allWorkers = await db.select().from(ghostWorkerSessions);
    const availableBrowserWorkers = allWorkers.filter(w =>
      w.lastSeen && now - new Date(w.lastSeen).getTime() < 90_000
    );
    const hasBrowserWorkers = availableBrowserWorkers.length > 0;

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

    if (availableServerNodes.length > 0) {
      // ── Route to server ghost nodes ──────────────────────────────────────────
      sendEvent(res, { routing: {
        nodeId:   availableServerNodes[0].id,
        nodeName: availableServerNodes[0].name,
        region:   availableServerNodes[0].region,
        type:     "server",
      }});

      let succeeded = false;
      let processingMs = 0;

      for (const node of availableServerNodes) {
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
              requestId: crypto.randomUUID(),
            }),
            signal: AbortSignal.timeout(90_000),
          });

          processingMs = Date.now() - start;

          if (r.ok) {
            const result = await r.json() as { response: string; model?: string; nodeName?: string };
            fullResponse = result.response;

            await db.update(ghostNodes).set({
              status:         "online",
              lastSeen:       new Date(),
              tasksProcessed: sql`tasks_processed + 1`,
              avgResponseMs:  processingMs,
              updatedAt:      new Date(),
            }).where(eq(ghostNodes.id, node.id));

            const words = fullResponse.split(/(\s+)/);
            for (const word of words) {
              sendEvent(res, { content: word });
              const delay = /[.!?]$/.test(word) ? 80 : word.trim().length === 0 ? 10 : 25;
              await new Promise(r => setTimeout(r, delay));
            }

            sendEvent(res, {
              done: true,
              conversationId: convId,
              meta: { nodeId: node.id, nodeName: node.name, processingMs, routed: true, type: "server" },
            });

            succeeded = true;
            break;
          } else {
            await db.update(ghostNodes).set({
              status:      "offline",
              tasksFailed: sql`tasks_failed + 1`,
              updatedAt:   new Date(),
            }).where(eq(ghostNodes.id, node.id));
          }
        } catch {
          await db.update(ghostNodes).set({
            status:      "offline",
            tasksFailed: sql`tasks_failed + 1`,
            updatedAt:   new Date(),
          }).where(eq(ghostNodes.id, node.id));
        }
      }

      if (!succeeded) {
        if (hasBrowserWorkers) {
          fullResponse = await routeToBrowserWorker(req, res, content.trim(), history, convId);
        } else {
          sendEvent(res, { fallback: true, reason: "All server nodes unreachable — running locally." });
          fullResponse = await runLocalNative(history, content.trim(), res);
          sendEvent(res, { done: true, conversationId: convId, meta: { routed: false, local: true } });
        }
      }

    } else if (hasBrowserWorkers) {
      // ── Route to browser worker pool ─────────────────────────────────────────
      fullResponse = await routeToBrowserWorker(req, res, content.trim(), history, convId);

    } else {
      // ── No nodes at all — run locally ────────────────────────────────────────
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

// ── Route a task through the browser worker queue ────────────────────────────
async function routeToBrowserWorker(
  req: import("express").Request,
  res: import("express").Response,
  content: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  convId: number,
): Promise<string> {
  const taskId = crypto.randomUUID();
  const timeoutAt = new Date(Date.now() + 60_000);

  await db.insert(ghostWorkerTasks).values({
    taskId,
    status:  "pending",
    payload: JSON.stringify({ message: content, history }),
    timeoutAt,
  });

  sendEvent(res, { routing: { type: "browser", taskId } });

  // Poll for completion for up to 55s
  const deadline = Date.now() + 55_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 700));

    const [task] = await db.select().from(ghostWorkerTasks)
      .where(eq(ghostWorkerTasks.taskId, taskId));

    if (!task) break;

    if (task.status === "complete" && task.result) {
      const words = task.result.split(/(\s+)/);
      for (const word of words) {
        sendEvent(res, { content: word });
        const delay = /[.!?]$/.test(word) ? 80 : word.trim().length === 0 ? 10 : 25;
        await new Promise(r => setTimeout(r, delay));
      }
      const processingMs = task.completedAt && task.assignedAt
        ? new Date(task.completedAt).getTime() - new Date(task.assignedAt).getTime()
        : null;
      sendEvent(res, {
        done: true,
        conversationId: convId,
        meta: { routed: true, type: "browser", workerId: task.workerId, processingMs },
      });
      return task.result;
    }

    if (task.status === "failed" || task.status === "timeout") {
      break;
    }
  }

  // Fallback to local
  sendEvent(res, { fallback: true, reason: "Browser worker timed out — running locally." });
  const result = await runLocalNative(history, content, res);
  sendEvent(res, { done: true, conversationId: convId, meta: { routed: false, local: true } });
  return result;
}

async function runLocalNative(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  content: string,
  res: import("express").Response,
): Promise<string> {
  // Use native brain synthesis - no external LLM needed
  const clerkId = null;
  const character = await db.select().from(characterState).limit(1).then(rows => rows[0]);
  
  const result = await processMessage(content, clerkId, history);
  
  // Stream the response word-by-word
  const words = result.text.split(/(\s+)/);
  for (const word of words) {
    sendEvent(res, { content: word });
    const delay = /[.!?]$/.test(word) ? 80 : word.trim().length === 0 ? 10 : 25;
    await new Promise(r => setTimeout(r, delay));
  }
  
  return result.text;
}

export default router;
