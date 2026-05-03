import { Router } from "express";
import { db } from "@workspace/db";
import { ghostNodes } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

// GET /api/ghost/status
router.get("/status", async (req, res) => {
  try {
    const nodes = await db.select().from(ghostNodes);
    const now = Date.now();
    const online = nodes.filter(n =>
      n.status === "online" && n.lastSeen &&
      now - new Date(n.lastSeen).getTime() < 45_000
    );
    const totalTasks = nodes.reduce((s, n) => s + n.tasksProcessed, 0);
    const avgMs = nodes.filter(n => n.avgResponseMs).length > 0
      ? nodes.filter(n => n.avgResponseMs).reduce((s, n) => s + n.avgResponseMs!, 0) /
        nodes.filter(n => n.avgResponseMs).length
      : null;

    res.json({
      total: nodes.length,
      online: online.length,
      offline: nodes.length - online.length,
      totalTasksProcessed: totalTasks,
      avgResponseMs: avgMs,
      selfEndpoint: `${req.protocol}://${req.get("host")}`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get ghost status");
    res.status(500).json({ error: "Failed to get network status" });
  }
});

// GET /api/ghost/nodes
router.get("/nodes", async (req, res) => {
  try {
    const nodes = await db.select().from(ghostNodes).orderBy(ghostNodes.createdAt);
    res.json(nodes.map(n => ({ ...n, secretKey: "••••••••" })));
  } catch (err) {
    req.log.error({ err }, "Failed to list ghost nodes");
    res.status(500).json({ error: "Failed to list nodes" });
  }
});

// POST /api/ghost/nodes — register and auto-ping a new node
router.post("/nodes", async (req, res) => {
  const { name, endpoint, secretKey, region, notes, isSelf } = req.body as {
    name: string; endpoint: string; secretKey: string;
    region?: string; notes?: string; isSelf?: boolean;
  };

  if (!name?.trim() || !endpoint?.trim() || !secretKey?.trim()) {
    res.status(400).json({ error: "name, endpoint, and secretKey are required" });
    return;
  }

  const normEndpoint = endpoint.trim().replace(/\/$/, "");

  // Ping before saving so we know initial status
  let pingStatus: "online" | "offline" = "offline";
  let pingMs: number | null = null;
  try {
    const start = Date.now();
    const r = await fetch(`${normEndpoint}/api/ghost/health`, {
      headers: { "X-Ghost-Secret": secretKey },
      signal: AbortSignal.timeout(8_000),
    });
    pingMs = Date.now() - start;
    if (r.ok) pingStatus = "online";
  } catch { /* unreachable — saved as offline */ }

  try {
    const [node] = await db.insert(ghostNodes).values({
      name: name.trim(),
      endpoint: normEndpoint,
      secretKey: secretKey.trim(),
      region: region?.trim() || "unknown",
      status: pingStatus,
      lastSeen: pingStatus === "online" ? new Date() : undefined,
      avgResponseMs: pingMs,
      notes: notes?.trim() || null,
      isSelf: isSelf ?? false,
    }).returning();

    res.status(201).json({ ...node, secretKey: "••••••••", pingStatus, pingMs });
  } catch (err) {
    req.log.error({ err }, "Failed to register ghost node");
    res.status(500).json({ error: "Failed to register node" });
  }
});

// POST /api/ghost/nodes/ping-all — must be before /:id routes
router.post("/nodes/ping-all", async (req, res) => {
  try {
    const nodes = await db.select().from(ghostNodes);
    const results = await Promise.all(
      nodes.map(async node => {
        let status: "online" | "offline" = "offline";
        let pingMs: number | null = null;
        try {
          const start = Date.now();
          const r = await fetch(`${node.endpoint}/api/ghost/health`, {
            headers: { "X-Ghost-Secret": node.secretKey },
            signal: AbortSignal.timeout(6_000),
          });
          pingMs = Date.now() - start;
          if (r.ok) status = "online";
        } catch { /* offline */ }

        await db.update(ghostNodes).set({
          status,
          lastSeen: status === "online" ? new Date() : node.lastSeen,
          avgResponseMs: pingMs ?? node.avgResponseMs,
          updatedAt: new Date(),
        }).where(eq(ghostNodes.id, node.id));

        return { id: node.id, name: node.name, status, pingMs };
      })
    );
    res.json(results);
  } catch (err) {
    req.log.error({ err }, "Failed to ping all nodes");
    res.status(500).json({ error: "Failed to ping nodes" });
  }
});

// POST /api/ghost/nodes/:id/ping
router.post("/nodes/:id/ping", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [node] = await db.select().from(ghostNodes).where(eq(ghostNodes.id, id));
    if (!node) { res.status(404).json({ error: "Node not found" }); return; }

    let status: "online" | "offline" = "offline";
    let pingMs: number | null = null;
    let nodeInfo: Record<string, unknown> = {};

    try {
      const start = Date.now();
      const r = await fetch(`${node.endpoint}/api/ghost/health`, {
        headers: { "X-Ghost-Secret": node.secretKey },
        signal: AbortSignal.timeout(8_000),
      });
      pingMs = Date.now() - start;
      if (r.ok) { status = "online"; nodeInfo = await r.json(); }
    } catch { /* offline */ }

    const [updated] = await db.update(ghostNodes).set({
      status,
      lastSeen: status === "online" ? new Date() : node.lastSeen,
      avgResponseMs: pingMs ?? node.avgResponseMs,
      updatedAt: new Date(),
    }).where(eq(ghostNodes.id, id)).returning();

    res.json({ status, pingMs, nodeInfo, node: { ...updated, secretKey: "••••••••" } });
  } catch (err) {
    req.log.error({ err }, "Failed to ping node");
    res.status(500).json({ error: "Failed to ping node" });
  }
});

// PUT /api/ghost/nodes/:id
router.put("/nodes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, endpoint, region, notes } = req.body as {
    name?: string; endpoint?: string; region?: string; notes?: string;
  };
  try {
    const [updated] = await db.update(ghostNodes).set({
      ...(name ? { name } : {}),
      ...(endpoint ? { endpoint: endpoint.replace(/\/$/, "") } : {}),
      ...(region ? { region } : {}),
      ...(notes !== undefined ? { notes } : {}),
      updatedAt: new Date(),
    }).where(eq(ghostNodes.id, id)).returning();

    if (!updated) { res.status(404).json({ error: "Node not found" }); return; }
    res.json({ ...updated, secretKey: "••••••••" });
  } catch (err) {
    req.log.error({ err }, "Failed to update node");
    res.status(500).json({ error: "Failed to update node" });
  }
});

// DELETE /api/ghost/nodes/:id
router.delete("/nodes/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(ghostNodes).where(eq(ghostNodes.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete node");
    res.status(500).json({ error: "Failed to delete node" });
  }
});

export default router;
