import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeNodes, learningLog } from "@workspace/db/schema";
import { sql, desc } from "drizzle-orm";

const router = Router();

// ─── GET /api/omni/growth-history ────────────────────────────────────────────
// Returns actual cumulative knowledge growth bucketed by time period,
// plus real learning-log entries to use as improvement milestones.
router.get("/growth-history", async (req, res) => {
  try {
    // 1. Earliest node date
    const [earliest] = await db
      .select({ ts: sql<string>`min(created_at)` })
      .from(knowledgeNodes);

    const firstDate = earliest?.ts ? new Date(earliest.ts) : new Date();
    const now = new Date();
    const spanMs = now.getTime() - firstDate.getTime();
    const spanHours = spanMs / (1000 * 3600);

    // Use hourly buckets if < 48 h of data, otherwise daily
    const useHours = spanHours < 48;

    // 2. Node counts grouped by bucket
    const bucketExpr = useHours
      ? sql<string>`date_trunc('hour', created_at AT TIME ZONE 'UTC')::text`
      : sql<string>`date_trunc('day',  created_at AT TIME ZONE 'UTC')::text`;

    const rows = await db
      .select({
        bucket: bucketExpr,
        count: sql<number>`count(*)`,
      })
      .from(knowledgeNodes)
      .groupBy(bucketExpr)
      .orderBy(bucketExpr);

    // 3. Build cumulative series
    let cumulative = 0;
    const series = rows.map((r, i) => {
      cumulative += Number(r.count);
      const d = new Date(r.bucket);
      const label = useHours ? `H${i + 1}` : `D${i + 1}`;
      return {
        label,
        bucket: r.bucket,
        nodes: cumulative,
        added: Number(r.count),
      };
    });

    // Ensure at least two points so the chart renders
    if (series.length === 1) {
      series.unshift({ label: "D0", bucket: "", nodes: 0, added: 0 });
    }
    if (series.length === 0) {
      series.push({ label: "D1", bucket: "", nodes: 0, added: 0 });
    }

    // 4. Real learning-log milestones — most recent first, up to 8
    const logs = await db
      .select({
        id: learningLog.id,
        event: learningLog.event,
        details: learningLog.details,
        nodesAdded: learningLog.nodesAdded,
        source: learningLog.source,
        createdAt: learningLog.createdAt,
      })
      .from(learningLog)
      .orderBy(desc(learningLog.createdAt))
      .limit(8);

    // Format milestones from log entries
    const milestones = logs.map((l, i) => {
      const ts = new Date(l.createdAt);
      const label = l.details?.trim()
        ? l.details.slice(0, 80)
        : l.event.replace(/_/g, " ");
      return {
        index: i,
        label,
        nodesAdded: Number(l.nodesAdded),
        source: l.source,
        createdAt: ts.toISOString(),
        // Display as short relative time
        age: formatAge(ts),
      };
    });

    res.json({
      useHours,
      spanLabel: useHours
        ? `last ${Math.ceil(spanHours)} hours`
        : `last ${series.length} day${series.length !== 1 ? "s" : ""}`,
      series,
      milestones,
      totalNodes: series.at(-1)?.nodes ?? 0,
    });
  } catch (err) {
    req.log?.error(err, "growth-history failed");
    res.status(500).json({ error: "growth-history failed" });
  }
});

function formatAge(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default router;
