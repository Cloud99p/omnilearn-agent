import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { ghostNodes } from "@workspace/db/schema";

const router = Router();

// POST /api/ghost/execute — this instance processes a task from another OmniLearn node
// Another OmniLearn primary sends work here when routing in ghost mode.
router.post("/execute", async (req, res) => {
  const secret = req.headers["x-ghost-secret"] as string | undefined;

  // Check against GHOST_NODE_SECRET env var (this server's configured secret)
  const configuredSecret = process.env.GHOST_NODE_SECRET;
  if (!configuredSecret) {
    res.status(503).json({
      error: "This instance is not configured as a ghost node.",
      hint: "Set the GHOST_NODE_SECRET environment variable to enable ghost node mode.",
    });
    return;
  }

  if (!secret || secret !== configuredSecret) {
    res.status(401).json({ error: "Unauthorized. Invalid ghost node secret." });
    return;
  }

  const { message, history = [], systemPrompt, requestId } = req.body as {
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    systemPrompt?: string;
    requestId?: string;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const startTime = Date.now();
  req.log.info({ requestId }, "Ghost node executing task");

  try {
    const msgs = [
      ...history,
      { role: "user" as const, content: message.trim() },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt || "You are Omni, the AI agent built by Emmanuel Nenpan Hosea, creator of OmniLearn. You are running as a distributed ghost node.",
      messages: msgs,
    });

    const text = response.content.find(c => c.type === "text")?.text ?? "";
    const processingMs = Date.now() - startTime;

    req.log.info({ requestId, processingMs }, "Ghost node task completed");

    res.json({
      response: text,
      model: response.model,
      processingMs,
      requestId,
      nodeName: process.env.GHOST_NODE_NAME || "OmniLearn Ghost Node",
    });
  } catch (err) {
    req.log.error({ err, requestId }, "Ghost node execution failed");
    res.status(500).json({ error: "Execution failed", detail: String(err) });
  }
});

// GET /api/ghost/health — health check for this node (called by other instances to verify liveness)
router.get("/health", (req, res) => {
  const isGhostEnabled = !!process.env.GHOST_NODE_SECRET;
  res.json({
    status: "online",
    ghost: isGhostEnabled,
    name: process.env.GHOST_NODE_NAME || "OmniLearn",
    version: "1.0.0",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
