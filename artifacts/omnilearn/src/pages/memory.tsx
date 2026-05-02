import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, Link, FileText, Layers, Star, Clock, Activity, AlertTriangle, ChevronRight, Zap } from "lucide-react";

// --- Types ---
type StorageDepth = "full_text" | "metadata" | "summary_only" | "url_only";
type TierLabel = "hot" | "warm" | "cold" | "url_floor";

interface DepthSpec {
  label: string;
  tier: TierLabel;
  stored: string[];
  dropped: string[];
  costPerDoc: string;
  color: string;
  icon: React.ReactNode;
  description: string;
}

interface LifecycleEvent {
  day: number;
  event: string;
  outcome: string;
  depth: StorageDepth;
  signal?: string;
}

// --- Storage depth definitions ---
const DEPTH_SPEC: Record<StorageDepth, DepthSpec> = {
  full_text: {
    label: "Full text",
    tier: "hot",
    color: "#f97316",
    icon: <FileText className="w-4 h-4" />,
    description: "Full extracted text, chunked embeddings, and all metadata. Served from NVMe. Reserved for documents that are actively referenced and deeply trusted.",
    costPerDoc: "~52 KB",
    stored: ["Canonical URL", "Full extracted text", "Paragraph-level embeddings", "Title + OG metadata", "Model summary (3–5 sentences)", "Trust score + provenance", "Re-crawl schedule"],
    dropped: [],
  },
  metadata: {
    label: "Metadata + summary",
    tier: "warm",
    color: "#22d3ee",
    icon: <Layers className="w-4 h-4" />,
    description: "Summary, embedding, and provenance. Fast retrieval without full text. Most of the recall value at a fraction of the storage cost.",
    costPerDoc: "~1.8 KB",
    stored: ["Canonical URL", "Model summary (3–5 sentences)", "Document-level embedding (1536-dim)", "Title + OG metadata", "Trust score + provenance"],
    dropped: ["Full extracted text", "Paragraph-level embeddings", "Re-crawl schedule"],
  },
  summary_only: {
    label: "Summary only",
    tier: "cold",
    color: "#a78bfa",
    icon: <Activity className="w-4 h-4" />,
    description: "A single-sentence distillation and the URL. The document still answers broad recall queries. Re-crawl on demand restores full metadata within seconds.",
    costPerDoc: "~0.4 KB",
    stored: ["Canonical URL", "One-line distillation", "Document-level embedding (quantised, 384-dim)", "Trust score"],
    dropped: ["Full extracted text", "Paragraph-level embeddings", "Full 3–5 sentence summary", "Title + OG metadata", "Provenance chain"],
  },
  url_only: {
    label: "URL only",
    tier: "url_floor",
    color: "#64748b",
    icon: <Link className="w-4 h-4" />,
    description: "Just the URL and its crawl timestamp. The agent has not forgotten this document — it knows exactly where it lives. Re-crawl on demand restores any depth within seconds.",
    costPerDoc: "~0.06 KB",
    stored: ["Canonical URL", "First-crawl timestamp", "Domain trust class"],
    dropped: ["Full extracted text", "Paragraph-level embeddings", "Summary", "Title + OG metadata", "Document-level embedding", "Provenance chain"],
  },
};

// --- Decision engine ---
function computeDepth(
  accessCount: number,
  trustScore: number,
  relevance: number,
  daysSinceCrawl: number
): { depth: StorageDepth; reason: string; signals: { label: string; value: number; weight: number; color: string }[] } {
  // Signal weights
  const accessSignal = Math.min(accessCount / 10, 1);       // saturates at 10 accesses
  const trustSignal = trustScore;
  const relevanceSignal = relevance;

  // Age decay: older documents need stronger signals to stay promoted
  const ageFactor = daysSinceCrawl <= 3 ? 1.0
    : daysSinceCrawl <= 7 ? 0.85
    : daysSinceCrawl <= 14 ? 0.7
    : daysSinceCrawl <= 30 ? 0.5
    : daysSinceCrawl <= 60 ? 0.3
    : 0.15;

  const score = (accessSignal * 0.45 + trustSignal * 0.30 + relevanceSignal * 0.25) * ageFactor;

  const signals = [
    { label: "Access frequency", value: accessSignal, weight: 0.45, color: "#f97316" },
    { label: "Source trust", value: trustSignal, weight: 0.30, color: "#22d3ee" },
    { label: "Active learning relevance", value: relevanceSignal, weight: 0.25, color: "#a78bfa" },
  ];

  // Hard promotion: highly relevant to active goals always gets at least metadata
  const learningBoost = relevance > 0.8;

  // Hard floor: URL-only if never accessed and >7 days old
  const neverAccessed = accessCount === 0;
  const stale = daysSinceCrawl > 7;

  if (neverAccessed && stale) {
    return {
      depth: "url_only",
      reason: `Zero accesses in ${daysSinceCrawl} days. Demoted to URL-only floor. The URL is retained indefinitely — re-crawl on demand restores any depth within seconds.`,
      signals,
    };
  }

  if (neverAccessed && daysSinceCrawl > 3) {
    return {
      depth: "summary_only",
      reason: `Zero accesses for ${daysSinceCrawl} days. Summary retained for broad recall. Full metadata dropped. Will reach URL-only floor at day 7 without access.`,
      signals,
    };
  }

  if (score >= 0.62 || (accessCount >= 5 && trustScore >= 0.7)) {
    return {
      depth: "full_text",
      reason: learningBoost
        ? `High active-learning relevance (${(relevance * 100).toFixed(0)}%) triggered promotion override. Full text promoted to hot tier regardless of access count.`
        : `Composite score ${(score * 100).toFixed(0)}% exceeds full-text threshold (62%). Access frequency and trust jointly qualify this document for hot-tier storage.`,
      signals,
    };
  }

  if (score >= 0.35 || learningBoost) {
    return {
      depth: "metadata",
      reason: learningBoost
        ? `Active learning relevance (${(relevance * 100).toFixed(0)}%) above 80% threshold — document promoted to at least metadata depth regardless of access history.`
        : `Composite score ${(score * 100).toFixed(0)}% within metadata range (35–62%). Document is trusted and occasionally accessed — summary and embedding retained.`,
      signals,
    };
  }

  if (score >= 0.12 || accessCount >= 1) {
    return {
      depth: "summary_only",
      reason: `Composite score ${(score * 100).toFixed(0)}% within summary range (12–35%). Accessed at least once but low trust or relevance — one-line distillation retained for broad recall.`,
      signals,
    };
  }

  return {
    depth: "url_only",
    reason: `Composite score ${(score * 100).toFixed(0)}% below all retention thresholds. URL retained. The agent has not forgotten this document — it knows exactly where it lives.`,
    signals,
  };
}

// --- Build lifecycle timeline ---
function buildTimeline(
  accessPattern: "never" | "once_early" | "frequent" | "bursty",
  trustScore: number,
  relevance: number
): LifecycleEvent[] {
  const events: LifecycleEvent[] = [];

  const accessSchedule: Record<typeof accessPattern, Record<number, number>> = {
    never:       {},
    once_early:  { 1: 1 },
    frequent:    { 1: 2, 3: 3, 7: 5, 14: 7, 21: 9, 30: 11 },
    bursty:      { 2: 4, 3: 6, 60: 7 },
  };

  const schedule = accessSchedule[accessPattern];
  const checkpoints = [0, 1, 3, 7, 14, 30, 60, 90];

  let runningAccess = 0;
  for (const day of checkpoints) {
    runningAccess += schedule[day] ?? 0;
    const { depth, reason } = computeDepth(runningAccess, trustScore, relevance, day);
    const prev = events[events.length - 1];
    const changed = prev && prev.depth !== depth;

    events.push({
      day,
      event: day === 0 ? "Initial crawl" : changed ? "Tier change" : "Scheduled evaluation",
      outcome: reason.slice(0, 90) + (reason.length > 90 ? "…" : ""),
      depth,
      signal: changed ? (DEPTH_SPEC[depth].tier === "url_floor" || depth < (prev?.depth ?? "") ? "demotion" : "promotion") : undefined,
    });
  }

  return events;
}

const DEPTH_ORDER: StorageDepth[] = ["url_only", "summary_only", "metadata", "full_text"];

function depthIndex(d: StorageDepth) { return DEPTH_ORDER.indexOf(d); }

function ScoreBar({ value, label, color, weight }: { value: number; label: string; color: string; weight: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground/60">×{weight.toFixed(2)}</span>
          <span className="font-mono text-xs" style={{ color }}>{(value * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default function MemoryPage() {
  const [accessCount, setAccessCount] = useState(0);
  const [trustScore, setTrustScore] = useState(0.65);
  const [relevance, setRelevance] = useState(0.3);
  const [daysSinceCrawl, setDaysSinceCrawl] = useState(1);

  const [accessPattern, setAccessPattern] = useState<"never" | "once_early" | "frequent" | "bursty">("never");
  const [timelineTrust, setTimelineTrust] = useState(0.7);
  const [timelineRelevance, setTimelineRelevance] = useState(0.3);

  const { depth, reason, signals } = useMemo(
    () => computeDepth(accessCount, trustScore, relevance, daysSinceCrawl),
    [accessCount, trustScore, relevance, daysSinceCrawl]
  );

  const timeline = useMemo(
    () => buildTimeline(accessPattern, timelineTrust, timelineRelevance),
    [accessPattern, timelineTrust, timelineRelevance]
  );

  const spec = DEPTH_SPEC[depth];

  const PATTERN_LABELS = {
    never: "Never accessed",
    once_early: "Accessed once (day 1)",
    frequent: "Frequently accessed",
    bursty: "Burst then dormant",
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-16">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 font-mono text-xs text-primary mb-4 border border-primary/20 bg-primary/5 rounded px-3 py-1.5 w-fit">
          <Brain className="w-3.5 h-3.5" />
          <span>memory.manager — intelligent promotion and demotion engine</span>
        </div>
        <h1 className="text-4xl font-bold mb-3">Memory Manager</h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          Documents are promoted or demoted based on access frequency, source trust, and relevance to active
          learning goals. A document crawled once and never accessed becomes a URL-only record within days.
          The agent doesn't forget — it knows exactly where to look things up again.
        </p>
      </motion.div>

      {/* Core insight */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-5">The floor is free</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {(["url_only", "summary_only", "metadata", "full_text"] as StorageDepth[]).map(d => {
            const s = DEPTH_SPEC[d];
            return (
              <div
                key={d}
                className={`bg-card border rounded-lg p-4 space-y-2 ${d === "url_only" ? "border-primary/20 bg-primary/5" : "border-border"}`}
              >
                <div className="flex items-center gap-2" style={{ color: s.color }}>
                  {s.icon}
                  <span className="font-mono text-xs font-bold">{s.label}</span>
                </div>
                <div className="font-mono text-xl font-bold" style={{ color: s.color }}>{s.costPerDoc}</div>
                <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 bg-card border border-primary/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Link className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-mono text-sm text-primary mb-1">URLs are infinite free storage</p>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                A URL record costs 0.06 KB. Storing every URL the agent has ever encountered — all 5.4 billion indexed web
                pages — costs 324 GB at the network level. The agent retains knowledge of every URL's existence
                indefinitely. "Forgetting" is not deletion: it is returning a document to the internet, where it already lives,
                while keeping a pointer back to it.
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Signals */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-5">The three promotion signals</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: <Activity className="w-4 h-4" />,
              label: "Access frequency",
              weight: "0.45",
              color: "#f97316",
              desc: "How many times has this document been retrieved from storage since it was crawled? Each retrieval is a vote for relevance. Weight saturates at 10 accesses — a document retrieved 10 times and one retrieved 100 times are treated identically to prevent runaway promotion.",
              threshold: "≥ 3 accesses within 7 days → metadata. ≥ 10 accesses → full text candidate.",
            },
            {
              icon: <Star className="w-4 h-4" />,
              label: "Source trust",
              weight: "0.30",
              color: "#22d3ee",
              desc: "The trust score assigned by the compliance pipeline (0.0–1.0). HIGH-trust sources (arxiv, Wikipedia, .gov, .edu) contribute 0.85–0.95. Unknown or low-signal domains contribute 0.3–0.5. Trust is stable — it doesn't decay with time.",
              threshold: "Trust < 0.4 → document cannot be promoted above summary_only regardless of access count.",
            },
            {
              icon: <Brain className="w-4 h-4" />,
              label: "Active learning relevance",
              weight: "0.25",
              color: "#a78bfa",
              desc: "Cosine similarity between the document's embedding and the agent's current attention centroid — a running average of recently processed topic vectors. Documents within distance 0.15 of the centroid are relevant to what the agent is actively learning about right now.",
              threshold: "Relevance > 0.8 → hard promotion override: at least metadata depth, regardless of access count or age.",
            },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2" style={{ color: s.color }}>
                  {s.icon}
                  <span className="font-mono text-xs font-bold">{s.label}</span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">weight {s.weight}</span>
              </div>
              <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{s.desc}</p>
              <div className="border-t border-border pt-3">
                <p className="font-mono text-[10px] text-muted-foreground/70 leading-relaxed">{s.threshold}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Interactive decision engine */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-5">Document decision engine</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Controls */}
          <div className="md:col-span-2 bg-card border border-border rounded-lg p-5 space-y-5">
            <p className="font-mono text-xs text-primary uppercase tracking-wider">Document parameters</p>

            <div>
              <div className="flex justify-between mb-2">
                <p className="font-mono text-xs text-muted-foreground">access count</p>
                <span className="font-mono text-xs" style={{ color: "#f97316" }}>{accessCount} retrievals</span>
              </div>
              <input type="range" min={0} max={20} step={1} value={accessCount}
                onChange={e => setAccessCount(Number(e.target.value))} className="w-full accent-orange-500" />
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground mt-1">
                <span>0</span><span>20+</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <p className="font-mono text-xs text-muted-foreground">source trust score</p>
                <span className="font-mono text-xs text-primary">{trustScore.toFixed(2)}</span>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={trustScore}
                onChange={e => setTrustScore(Number(e.target.value))} className="w-full accent-primary" />
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground mt-1">
                <span>0.0 (unknown)</span><span>1.0 (verified)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <p className="font-mono text-xs text-muted-foreground">active learning relevance</p>
                <span className="font-mono text-xs" style={{ color: "#a78bfa" }}>{(relevance * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={relevance}
                onChange={e => setRelevance(Number(e.target.value))} className="w-full accent-violet-500" />
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground mt-1">
                <span>0% (unrelated)</span><span>100% (on-topic)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <p className="font-mono text-xs text-muted-foreground">days since crawl</p>
                <span className="font-mono text-xs text-foreground">{daysSinceCrawl}d</span>
              </div>
              <input type="range" min={0} max={90} step={1} value={daysSinceCrawl}
                onChange={e => setDaysSinceCrawl(Number(e.target.value))} className="w-full accent-slate-400" />
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground mt-1">
                <span>0 (fresh)</span><span>90d</span>
              </div>
            </div>
          </div>

          {/* Result */}
          <div className="md:col-span-3 space-y-4">
            {/* Decision */}
            <AnimatePresence mode="wait">
              <motion.div
                key={depth}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-card border rounded-lg p-5"
                style={{ borderColor: spec.color + "40" }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: spec.color + "15", color: spec.color }}>
                    {spec.icon}
                  </div>
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">storage depth assigned</div>
                    <div className="font-mono text-lg font-bold" style={{ color: spec.color }}>{spec.label}</div>
                  </div>
                  <div className="ml-auto font-mono text-xs px-2 py-1 rounded border" style={{ borderColor: spec.color + "40", color: spec.color }}>
                    {spec.costPerDoc} / doc
                  </div>
                </div>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-4">{reason}</p>

                {/* Signal bars */}
                <div className="space-y-2">
                  {signals.map(s => (
                    <ScoreBar key={s.label} value={s.value} label={s.label} color={s.color} weight={s.weight} />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* What is stored */}
            <div className="bg-card border border-border rounded-lg p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="font-mono text-[10px] text-green-400 uppercase tracking-wider mb-2">Stored</p>
                <div className="space-y-1">
                  {spec.stored.map(f => (
                    <div key={f} className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-green-400 shrink-0" />
                      <span className="font-mono text-[10px] text-muted-foreground">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
              {spec.dropped.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] text-red-400 uppercase tracking-wider mb-2">Not stored locally</p>
                  <div className="space-y-1">
                    {spec.dropped.map(f => (
                      <div key={f} className="flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-red-400/50 shrink-0" />
                        <span className="font-mono text-[10px] text-muted-foreground/60">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Lifecycle timeline */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-5">Document lifecycle simulator</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {/* Pattern selector */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <p className="font-mono text-xs text-muted-foreground">access pattern</p>
            <div className="space-y-1.5">
              {(["never", "once_early", "frequent", "bursty"] as const).map(p => (
                <button key={p} onClick={() => setAccessPattern(p)}
                  className={`w-full text-left font-mono text-xs px-3 py-1.5 rounded border transition-colors ${
                    accessPattern === p ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  }`}>
                  {PATTERN_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <p className="font-mono text-xs text-muted-foreground">source trust</p>
            <input type="range" min={0} max={1} step={0.01} value={timelineTrust}
              onChange={e => setTimelineTrust(Number(e.target.value))} className="w-full accent-primary" />
            <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>0.0</span>
              <span className="text-primary font-bold">{timelineTrust.toFixed(2)}</span>
              <span>1.0</span>
            </div>
            <p className="font-mono text-xs text-muted-foreground">active learning relevance</p>
            <input type="range" min={0} max={1} step={0.01} value={timelineRelevance}
              onChange={e => setTimelineRelevance(Number(e.target.value))} className="w-full accent-violet-500" />
            <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>0%</span>
              <span className="text-violet-400 font-bold">{(timelineRelevance * 100).toFixed(0)}%</span>
              <span>100%</span>
            </div>
          </div>
          {/* Legend */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-2">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Depth legend</p>
            {(["full_text", "metadata", "summary_only", "url_only"] as StorageDepth[]).map(d => (
              <div key={d} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DEPTH_SPEC[d].color }} />
                <span className="font-mono text-[10px] text-muted-foreground">{DEPTH_SPEC[d].label}</span>
                <span className="font-mono text-[10px] text-muted-foreground/50 ml-auto">{DEPTH_SPEC[d].costPerDoc}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-green-400" />
                <span className="font-mono text-[10px] text-muted-foreground">promotion event</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <TrendingDown className="w-3 h-3 text-red-400" />
                <span className="font-mono text-[10px] text-muted-foreground">demotion event</span>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Depth track */}
          <div className="px-5 pt-5 pb-2">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Storage depth over time</p>
            <div className="relative h-8 flex items-stretch gap-0">
              {timeline.map((ev, i) => {
                const next = timeline[i + 1];
                const widthPct = next ? ((next.day - ev.day) / 90) * 100 : 0;
                if (widthPct === 0) return null;
                const s = DEPTH_SPEC[ev.depth];
                return (
                  <div
                    key={i}
                    className="h-full relative group"
                    style={{ width: `${widthPct}%`, backgroundColor: s.color + "25", borderLeft: `2px solid ${s.color}60` }}
                    title={`Day ${ev.day}–${next?.day}: ${s.label}`}
                  >
                    <div className="absolute inset-0" style={{ backgroundColor: s.color + "15" }} />
                  </div>
                );
              })}
            </div>
            {/* Day markers */}
            <div className="relative h-4 mt-1">
              {timeline.map((ev, i) => {
                const leftPct = (ev.day / 90) * 100;
                return (
                  <span key={i} className="absolute font-mono text-[9px] text-muted-foreground/50 -translate-x-1/2"
                    style={{ left: `${leftPct}%` }}>
                    {ev.day === 0 ? "0d" : `${ev.day}d`}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Events table */}
          <div className="border-t border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider w-16">Day</th>
                  <th className="px-3 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider w-32">Event</th>
                  <th className="px-3 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider w-32">Depth</th>
                  <th className="px-3 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((ev, i) => {
                  const s = DEPTH_SPEC[ev.depth];
                  const prevDepth = i > 0 ? timeline[i - 1].depth : ev.depth;
                  const promoted = depthIndex(ev.depth) > depthIndex(prevDepth);
                  const demoted = depthIndex(ev.depth) < depthIndex(prevDepth);
                  return (
                    <tr key={i} className={i < timeline.length - 1 ? "border-b border-border/40" : ""}>
                      <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">{ev.day === 0 ? "0" : `+${ev.day}`}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {promoted && <TrendingUp className="w-3 h-3 text-green-400 shrink-0" />}
                          {demoted && <TrendingDown className="w-3 h-3 text-red-400 shrink-0" />}
                          {!promoted && !demoted && <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                          <span className="font-mono text-[10px] text-foreground">{ev.event}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: s.color + "15", color: s.color }}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">{ev.outcome}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </motion.section>

      {/* Demotion schedule */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-5">Demotion schedule — unaccessed documents</div>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Age (zero accesses)</th>
                <th className="px-5 py-3 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Storage depth</th>
                <th className="px-5 py-3 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider">What is dropped</th>
                <th className="px-5 py-3 text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Cost / doc</th>
              </tr>
            </thead>
            <tbody>
              {[
                { age: "Day 0–1", depth: "metadata" as StorageDepth, dropped: "—", note: "Grace period: full metadata retained while evaluation runs" },
                { age: "Day 2–3", depth: "summary_only" as StorageDepth, dropped: "Full embedding, title/OG, provenance chain" },
                { age: "Day 4–7", depth: "summary_only" as StorageDepth, dropped: "— (holding at summary, awaiting day-7 gate)" },
                { age: "Day 7+", depth: "url_only" as StorageDepth, dropped: "Summary, quantised embedding, trust record — URL retained forever" },
              ].map((row, i) => {
                const s = DEPTH_SPEC[row.depth];
                return (
                  <tr key={i} className={i < 3 ? "border-b border-border/50" : ""}>
                    <td className="px-5 py-3 font-mono text-xs text-foreground">{row.age}</td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ backgroundColor: s.color + "15", color: s.color }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{row.dropped}</td>
                    <td className="px-5 py-3 font-mono text-xs text-primary text-right">{s.costPerDoc}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-border px-5 py-3 bg-primary/5">
            <div className="flex items-start gap-2">
              <Zap className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <p className="font-mono text-[10px] text-muted-foreground">
                Any access resets the demotion clock. A single retrieval at day 6 restores the document to full metadata depth and restarts the 7-day evaluation window.
                Re-crawl on demand from URL-only state takes 2–8 seconds and restores any depth level.
              </p>
            </div>
          </div>
        </div>
      </motion.section>

    </div>
  );
}
