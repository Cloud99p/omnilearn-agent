import { Router } from "express";
import { db } from "@workspace/db";
import { ghostWorkerSessions } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

const router = Router();

const ALIVE_THRESHOLD_MS = 90_000; // worker must have pinged within 90s
const MIN_PEERS_FOR_GOSSIP = 2;

// ─── GET /api/ghost/gossip-probe ─────────────────────────────────────────────
// Returns the real gossip sync state based on actually-registered workers.
// State machine:
//   dormant  — 0 workers registered
//   staging  — 1 worker registered but < 2 needed
//   active   — ≥2 workers, all pinged within threshold
//   degraded — ≥2 workers registered but some stale
router.get("/gossip-probe", async (req, res) => {
  try {
    const sessions = await db
      .select({
        workerId: ghostWorkerSessions.workerId,
        name: ghostWorkerSessions.name,
        status: ghostWorkerSessions.status,
        lastSeen: ghostWorkerSessions.lastSeen,
        tasksProcessed: ghostWorkerSessions.tasksProcessed,
        tasksFailed: ghostWorkerSessions.tasksFailed,
        avgResponseMs: ghostWorkerSessions.avgResponseMs,
        connectedAt: ghostWorkerSessions.connectedAt,
      })
      .from(ghostWorkerSessions)
      .orderBy(desc(ghostWorkerSessions.lastSeen));

    const now = Date.now();

    const workers = sessions.map((s) => {
      const lastSeenMs = new Date(s.lastSeen).getTime();
      const msSince = now - lastSeenMs;
      const alive = msSince < ALIVE_THRESHOLD_MS;
      return {
        workerId: s.workerId,
        name: s.name,
        status: s.status,
        alive,
        msSinceLastSeen: msSince,
        lastSeenAgo: formatAge(new Date(s.lastSeen)),
        tasksProcessed: s.tasksProcessed,
        tasksFailed: s.tasksFailed,
        avgResponseMs: s.avgResponseMs,
        connectedAt: s.connectedAt,
      };
    });

    const totalRegistered = workers.length;
    const aliveCount = workers.filter((w) => w.alive).length;
    const staleCount = totalRegistered - aliveCount;

    type GossipState = "dormant" | "staging" | "active" | "degraded";
    let state: GossipState;
    let message: string;

    if (totalRegistered === 0) {
      state = "dormant";
      message = `No peer nodes registered. Gossip protocol requires ≥${MIN_PEERS_FOR_GOSSIP} nodes. Join the Ghost Network to activate it.`;
    } else if (aliveCount < MIN_PEERS_FOR_GOSSIP) {
      state = "staging";
      message = `${aliveCount}/${totalRegistered} node${totalRegistered !== 1 ? "s" : ""} alive. Need ≥${MIN_PEERS_FOR_GOSSIP} simultaneously online for gossip to run. Invite another contributor to activate.`;
    } else if (staleCount === 0) {
      state = "active";
      message = `${aliveCount} peer${aliveCount !== 1 ? "s" : ""} online. Gossip sync is operational — knowledge deltas can propagate.`;
    } else {
      state = "degraded";
      message = `${aliveCount} of ${totalRegistered} nodes alive. Gossip protocol is running but ${staleCount} peer${staleCount !== 1 ? "s" : ""} are stale.`;
    }

    // Gossip readiness: what fraction of the needed peers are alive
    const readiness = Math.min(1, aliveCount / MIN_PEERS_FOR_GOSSIP);

    res.json({
      state,
      message,
      totalRegistered,
      aliveCount,
      staleCount,
      readiness,
      minForGossip: MIN_PEERS_FOR_GOSSIP,
      workers: workers.map((w) => ({
        name: w.name,
        alive: w.alive,
        lastSeenAgo: w.lastSeenAgo,
        tasksProcessed: w.tasksProcessed,
        status: w.status,
      })),
      probeTime: new Date().toISOString(),
    });
  } catch (err) {
    req.log?.error(err, "gossip-probe failed");
    res.status(500).json({ error: "gossip-probe failed" });
  }
});

function formatAge(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default router;
