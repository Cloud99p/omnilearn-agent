import { Router } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db } from "@workspace/db";
import { ghostInviteTokens, ghostWorkerSessions, ghostWorkerTasks } from "@workspace/db/schema";
import { eq, and, lt, sql } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// POST /api/ghost/worker/invite — create a shareable invite token
router.post("/worker/invite", async (req, res) => {
  try {
    const { label, maxUses, expiresInDays } = req.body as {
      label?: string; maxUses?: number; expiresInDays?: number;
    };
    const token = crypto.randomUUID();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86_400_000)
      : null;
    const [invite] = await db.insert(ghostInviteTokens).values({
      token,
      label:    label ?? "Worker invite",
      maxUses:  maxUses ?? 100,
      expiresAt,
    }).returning();
    res.json(invite);
  } catch (err) {
    req.log.error(err, "Failed to create invite token");
    res.status(500).json({ error: "Failed to create invite" });
  }
});

// GET /api/ghost/worker/invite/:token — validate an invite token (public)
router.get("/worker/invite/:token", async (req, res) => {
  try {
    const [invite] = await db.select().from(ghostInviteTokens)
      .where(eq(ghostInviteTokens.token, req.params.token));
    if (!invite || !invite.active) {
      res.status(404).json({ error: "Invite not found or inactive" });
      return;
    }
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      res.status(410).json({ error: "Invite token expired" });
      return;
    }
    if (invite.usesCount >= invite.maxUses) {
      res.status(409).json({ error: "Invite token fully used" });
      return;
    }
    res.json({
      valid: true,
      label: invite.label,
      usesRemaining: invite.maxUses - invite.usesCount,
    });
  } catch (err) {
    req.log.error(err, "Failed to validate invite");
    res.status(500).json({ error: "Failed to validate invite" });
  }
});

// GET /api/ghost/invites — list all invite tokens
router.get("/invites", async (req, res) => {
  try {
    const invites = await db.select().from(ghostInviteTokens)
      .orderBy(ghostInviteTokens.createdAt);
    res.json(invites);
  } catch (err) {
    req.log.error(err, "Failed to list invites");
    res.status(500).json({ error: "Failed to list invites" });
  }
});

// DELETE /api/ghost/invites/:id — revoke an invite token
router.delete("/invites/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    await db.update(ghostInviteTokens)
      .set({ active: false })
      .where(eq(ghostInviteTokens.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Failed to revoke invite");
    res.status(500).json({ error: "Failed to revoke invite" });
  }
});

// POST /api/ghost/worker/join — register as a browser worker
router.post("/worker/join", async (req, res) => {
  try {
    const { token, name } = req.body as { token?: string; name?: string };
    if (!token || !name || typeof token !== "string" || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name and token required" }); return;
    }
    const safeName = name.trim().slice(0, 80);
    const [invite] = await db.select().from(ghostInviteTokens)
      .where(eq(ghostInviteTokens.token, token));

    if (
      !invite || !invite.active ||
      (invite.expiresAt && new Date(invite.expiresAt) < new Date()) ||
      invite.usesCount >= invite.maxUses
    ) {
      res.status(403).json({ error: "Invalid or expired invite token" });
      return;
    }

    const workerId     = crypto.randomUUID();
    const workerSecret = crypto.randomBytes(32).toString("hex");

    await db.insert(ghostWorkerSessions).values({
      workerId,
      workerSecret,
      name: safeName,
      inviteToken: token,
      status:      "idle",
      lastSeen:    new Date(),
      connectedAt: new Date(),
    });

    await db.update(ghostInviteTokens)
      .set({ usesCount: sql`uses_count + 1` })
      .where(eq(ghostInviteTokens.id, invite.id));

    res.json({ workerId, workerSecret });
  } catch (err) {
    req.log.error(err, "Failed to join as worker");
    res.status(500).json({ error: "Failed to join" });
  }
});

// GET /api/ghost/worker/poll — long-poll for a pending task
router.get("/worker/poll", async (req, res) => {
  const { workerId, workerSecret } = req.query as { workerId?: string; workerSecret?: string };
  if (!workerId || !workerSecret) {
    res.status(400).json({ error: "Missing credentials" });
    return;
  }

  try {
    const [session] = await db.select().from(ghostWorkerSessions)
      .where(eq(ghostWorkerSessions.workerId, workerId));
    if (!session || session.workerSecret !== workerSecret) {
      res.status(401).json({ error: "Invalid worker credentials" });
      return;
    }

    await db.update(ghostWorkerSessions)
      .set({ lastSeen: new Date(), status: "idle" })
      .where(eq(ghostWorkerSessions.workerId, workerId));

    const deadline = Date.now() + 25_000;

    while (Date.now() < deadline) {
      // Expire timed-out pending tasks
      await db.update(ghostWorkerTasks)
        .set({ status: "timeout" })
        .where(and(
          eq(ghostWorkerTasks.status, "pending"),
          lt(ghostWorkerTasks.timeoutAt, new Date()),
        ));

      // Also expire timed-out assigned tasks (worker died)
      await db.update(ghostWorkerTasks)
        .set({ status: "timeout" })
        .where(and(
          eq(ghostWorkerTasks.status, "assigned"),
          lt(ghostWorkerTasks.timeoutAt, new Date()),
        ));

      const [task] = await db.select().from(ghostWorkerTasks)
        .where(eq(ghostWorkerTasks.status, "pending"))
        .orderBy(ghostWorkerTasks.createdAt)
        .limit(1);

      if (task) {
        // Atomically claim it
        const claimed = await db.update(ghostWorkerTasks)
          .set({ status: "assigned", workerId, assignedAt: new Date() })
          .where(and(
            eq(ghostWorkerTasks.taskId, task.taskId),
            eq(ghostWorkerTasks.status, "pending"),
          ))
          .returning();

        if (claimed.length > 0) {
          await db.update(ghostWorkerSessions)
            .set({ status: "busy" })
            .where(eq(ghostWorkerSessions.workerId, workerId));

          res.json({ task: { taskId: task.taskId, payload: JSON.parse(task.payload) } });
          return;
        }
      }

      await new Promise(r => setTimeout(r, 600));
    }

    res.json({ task: null });
  } catch (err) {
    req.log.error(err, "Worker poll error");
    res.status(500).json({ error: "Poll failed" });
  }
});

// POST /api/ghost/worker/result/:taskId — submit task result
router.post("/worker/result/:taskId", async (req, res) => {
  try {
    const { workerId, workerSecret, result, failed, processingMs } = req.body as {
      workerId: string; workerSecret: string;
      result?: string; failed?: boolean; processingMs?: number;
    };

    const [session] = await db.select().from(ghostWorkerSessions)
      .where(eq(ghostWorkerSessions.workerId, workerId));
    if (!session || session.workerSecret !== workerSecret) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const taskId = req.params.taskId;
    await db.update(ghostWorkerTasks).set({
      status:      failed ? "failed" : "complete",
      result:      result ?? null,
      completedAt: new Date(),
    }).where(eq(ghostWorkerTasks.taskId, taskId));

    const prevCount = session.tasksProcessed;
    const newAvg = processingMs && prevCount > 0
      ? ((session.avgResponseMs ?? processingMs) * prevCount + processingMs) / (prevCount + 1)
      : processingMs ?? session.avgResponseMs;

    await db.update(ghostWorkerSessions).set({
      status:         "idle",
      lastSeen:       new Date(),
      tasksProcessed: failed ? session.tasksProcessed : sql`tasks_processed + 1`,
      tasksFailed:    failed ? sql`tasks_failed + 1`   : session.tasksFailed,
      avgResponseMs:  newAvg ?? null,
    }).where(eq(ghostWorkerSessions.workerId, workerId));

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Worker result error");
    res.status(500).json({ error: "Failed to submit result" });
  }
});

// POST /api/ghost/worker/heartbeat
router.post("/worker/heartbeat", async (req, res) => {
  try {
    const { workerId, workerSecret } = req.body as { workerId?: string; workerSecret?: string };
    const [session] = await db.select().from(ghostWorkerSessions)
      .where(eq(ghostWorkerSessions.workerId, workerId ?? ""));
    if (!session || session.workerSecret !== workerSecret) {
      res.status(401).json({ error: "Invalid credentials" }); return;
    }
    await db.update(ghostWorkerSessions)
      .set({ lastSeen: new Date() })
      .where(eq(ghostWorkerSessions.workerId, workerId!));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Heartbeat error");
    res.status(500).json({ error: "Heartbeat failed" });
  }
});

// POST /api/ghost/worker/execute/:taskId — worker claims & server processes task via Anthropic
router.post("/worker/execute/:taskId", async (req, res) => {
  try {
    const { workerId, workerSecret } = req.body as { workerId?: string; workerSecret?: string };
    if (!workerId || !workerSecret) {
      res.status(400).json({ error: "Missing credentials" }); return;
    }

    const [session] = await db.select().from(ghostWorkerSessions)
      .where(eq(ghostWorkerSessions.workerId, workerId));
    if (!session || session.workerSecret !== workerSecret) {
      res.status(401).json({ error: "Invalid worker credentials" }); return;
    }

    const taskId = req.params.taskId;
    const [task] = await db.select().from(ghostWorkerTasks)
      .where(and(eq(ghostWorkerTasks.taskId, taskId), eq(ghostWorkerTasks.workerId, workerId)));
    if (!task) {
      res.status(404).json({ error: "Task not found or not assigned to this worker" }); return;
    }
    if (task.status !== "assigned") {
      res.status(409).json({ error: "Task is not in assigned state" }); return;
    }

    const payload = JSON.parse(task.payload) as {
      message: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      systemPrompt?: string;
    };

    const startTime = Date.now();
    let resultText = "";
    let failed = false;

    try {
      const msgs = [
        ...(payload.history ?? []),
        { role: "user" as const, content: payload.message },
      ];
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: payload.systemPrompt ?? "You are OmniLearn, a distributed AI assistant.",
        messages: msgs,
      });
      resultText = response.content.find(c => c.type === "text")?.text ?? "";
    } catch (err) {
      req.log.error(err, "Browser worker execute: Anthropic error");
      failed = true;
    }

    const processingMs = Date.now() - startTime;

    await db.update(ghostWorkerTasks).set({
      status:      failed ? "failed" : "complete",
      result:      failed ? null : resultText,
      completedAt: new Date(),
    }).where(eq(ghostWorkerTasks.taskId, taskId));

    const prevCount = session.tasksProcessed ?? 0;
    const newAvg = !failed && processingMs
      ? prevCount > 0
        ? ((session.avgResponseMs ?? processingMs) * prevCount + processingMs) / (prevCount + 1)
        : processingMs
      : session.avgResponseMs;

    await db.update(ghostWorkerSessions).set({
      status:         "idle",
      lastSeen:       new Date(),
      tasksProcessed: failed ? session.tasksProcessed : sql`tasks_processed + 1`,
      tasksFailed:    failed ? sql`tasks_failed + 1`   : session.tasksFailed,
      avgResponseMs:  newAvg ?? null,
    }).where(eq(ghostWorkerSessions.workerId, workerId));

    if (failed) {
      res.status(500).json({ error: "AI processing failed" });
    } else {
      res.json({ ok: true, result: resultText, processingMs });
    }
  } catch (err) {
    req.log.error(err, "Worker execute error");
    res.status(500).json({ error: "Execution failed" });
  }
});

// GET /api/ghost/workers — list active browser workers
router.get("/workers", async (req, res) => {
  try {
    const all = await db.select({
      workerId:       ghostWorkerSessions.workerId,
      name:           ghostWorkerSessions.name,
      status:         ghostWorkerSessions.status,
      lastSeen:       ghostWorkerSessions.lastSeen,
      tasksProcessed: ghostWorkerSessions.tasksProcessed,
      tasksFailed:    ghostWorkerSessions.tasksFailed,
      avgResponseMs:  ghostWorkerSessions.avgResponseMs,
      connectedAt:    ghostWorkerSessions.connectedAt,
    }).from(ghostWorkerSessions).orderBy(ghostWorkerSessions.connectedAt);

    const now = Date.now();
    res.json(all.map(w => ({
      ...w,
      online: w.lastSeen ? now - new Date(w.lastSeen).getTime() < 90_000 : false,
    })));
  } catch (err) {
    req.log.error(err, "Failed to list workers");
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
