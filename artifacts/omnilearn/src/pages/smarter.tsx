import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, CheckCircle, AlertCircle, Clock,
  Brain, Zap, GitBranch, BarChart3, RefreshCw,
  Loader2, Award, Target, Layers, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProbeResult {
  question: string; nodesRetrieved: number; relevantCount: number;
  avgSimilarity: number; precision: number;
}
interface SmarterProof {
  snapshot: { totalNodes: number; totalEdges: number; totalAccesses: number };
  pareto: {
    top20Count: number; top20Accesses: number; totalAccesses: number;
    paretoRatio: number; randomBaseline: number; lift: number;
    verdict: "pass" | "growing" | "fail";
  };
  confidence: {
    globalAvg: number; top10Avg: number; gradient: number;
    histogram: Array<{ label: string; count: number }>;
    verdict: "pass" | "growing" | "fail";
  };
  precision: {
    probes: ProbeResult[]; avgPrecision: number;
    randomBaseline: number; lift: number;
    verdict: "pass" | "growing" | "fail";
  };
  graph: {
    totalEdges: number; density: number;
    typeCounts: Array<{ type: string; count: number }>;
    dominantTypeFraction: number;
    verdict: "pass" | "growing" | "fail";
  };
  topNodes: Array<{
    id: number; content: string; type: string;
    confidence: number; timesAccessed: number;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  pass:    { icon: CheckCircle, color: "text-emerald-400", border: "border-emerald-400/20", bg: "bg-emerald-400/5",  label: "Proven" },
  growing: { icon: Clock,       color: "text-yellow-400",  border: "border-yellow-400/20",  bg: "bg-yellow-400/5",  label: "Growing" },
  fail:    { icon: AlertCircle, color: "text-red-400",     border: "border-red-400/20",     bg: "bg-red-400/5",     label: "Check" },
};

function VerdictBadge({ verdict }: { verdict: "pass" | "growing" | "fail" }) {
  const cfg = VERDICT_CONFIG[verdict];
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-mono text-[10px]",
      cfg.color, cfg.border, cfg.bg
    )}>
      <cfg.icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function MiniBar({ value, max, color, label }: {
  value: number; max: number; color: string; label: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
        <span className="font-mono text-[10px]" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 bg-secondary/40 rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }} />
      </div>
    </div>
  );
}

function ProofCard({
  icon: Icon, title, verdict, metric, metricLabel,
  baseline, baselineLabel, lift, liftLabel, children,
}: {
  icon: React.ElementType; title: string;
  verdict: "pass" | "growing" | "fail";
  metric: string; metricLabel: string;
  baseline: string; baselineLabel: string;
  lift: string; liftLabel: string;
  children?: React.ReactNode;
}) {
  const cfg = VERDICT_CONFIG[verdict];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("bg-card border rounded-xl p-5 space-y-4", cfg.border)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", cfg.color)} />
          <span className="font-mono text-sm font-bold">{title}</span>
        </div>
        <VerdictBadge verdict={verdict} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { v: metric,   l: metricLabel },
          { v: baseline, l: baselineLabel },
          { v: lift,     l: liftLabel },
        ].map(({ v, l }) => (
          <div key={l} className="bg-secondary/20 rounded-lg p-3 text-center">
            <p className="font-mono text-lg font-bold text-foreground">{v}</p>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5 leading-tight">{l}</p>
          </div>
        ))}
      </div>

      {children}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SmarterPage() {
  const [data, setData]       = useState<SmarterProof | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/omni/smarter-proof`);
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      setData(d);
      setLastRun(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const passes = data
    ? [data.pareto.verdict, data.confidence.verdict,
       data.precision.verdict, data.graph.verdict]
        .filter(v => v === "pass").length
    : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">

      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 mb-6">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono text-xs text-primary">intelligence quality proof</span>
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-3">Smarter, not just bigger</h1>
            <p className="text-muted-foreground font-mono text-sm max-w-2xl leading-relaxed">
              Growing a knowledge graph is easy. Proving it actually improves reasoning is harder.
              Four statistical tests — Pareto concentration, confidence gradient, retrieval precision lift,
              and graph density — each independent evidence that intelligence is compounding.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border font-mono text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all shrink-0"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 font-mono text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0,1,2,3].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 h-48 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && data && (data as { empty?: boolean }).empty && (
        <div className="bg-secondary/20 border border-border rounded-xl px-6 py-10 text-center space-y-3">
          <Brain className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="font-mono text-sm font-bold">No knowledge nodes yet</p>
          <p className="text-xs text-muted-foreground">
            Chat with the agent or train it via Intelligence → the proofs will run automatically once nodes exist.
          </p>
        </div>
      )}

      <AnimatePresence>
        {data && !(data as { empty?: boolean }).empty && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

            {/* Snapshot bar */}
            <div className="flex items-center gap-6 bg-card border border-border rounded-xl px-5 py-4 flex-wrap">
              {[
                { l: "Knowledge nodes", v: data.snapshot.totalNodes, icon: Brain },
                { l: "Graph edges",     v: data.snapshot.totalEdges, icon: GitBranch },
                { l: "Total accesses",  v: data.snapshot.totalAccesses, icon: Activity },
                { l: "Proofs passed",   v: `${passes}/4`, icon: Award },
              ].map(({ l, v, icon: Ic }) => (
                <div key={l} className="flex items-center gap-3">
                  <Ic className="w-4 h-4 text-primary" />
                  <div>
                    <p className="font-mono text-lg font-bold">{v}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{l}</p>
                  </div>
                </div>
              ))}
              {lastRun && (
                <p className="font-mono text-[10px] text-muted-foreground ml-auto">
                  computed {lastRun.toLocaleTimeString()}
                </p>
              )}
            </div>

            {/* Proof cards — 2-col grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* 1. Pareto concentration */}
              <ProofCard
                icon={Target}
                title="Pareto Concentration"
                verdict={data.pareto.verdict}
                metric={`${(data.pareto.paretoRatio * 100).toFixed(0)}%`}
                metricLabel="accesses by top 20% nodes"
                baseline={`${(data.pareto.randomBaseline * 100).toFixed(0)}%`}
                baselineLabel="random baseline"
                lift={`${data.pareto.lift}×`}
                liftLabel="lift over random"
              >
                <p className="text-xs text-muted-foreground leading-relaxed">
                  If knowledge were accumulating randomly, accesses would spread evenly — each 20% of nodes
                  handles 20% of queries. When a core set of high-value nodes handles a much larger share,
                  the agent has learned <em className="text-foreground">which facts actually matter</em>.
                </p>
                <div className="space-y-2 pt-1">
                  <MiniBar
                    value={data.pareto.top20Accesses}
                    max={data.pareto.totalAccesses || 1}
                    color="#22d3ee"
                    label={`Top ${data.pareto.top20Count} nodes → ${data.pareto.top20Accesses} accesses`}
                  />
                  <MiniBar
                    value={data.pareto.totalAccesses - data.pareto.top20Accesses}
                    max={data.pareto.totalAccesses || 1}
                    color="#334155"
                    label={`Remaining nodes → ${data.pareto.totalAccesses - data.pareto.top20Accesses} accesses`}
                  />
                </div>
              </ProofCard>

              {/* 2. Confidence gradient */}
              <ProofCard
                icon={Award}
                title="Confidence Gradient"
                verdict={data.confidence.verdict}
                metric={`${(data.confidence.top10Avg * 100).toFixed(0)}%`}
                metricLabel="top-10 nodes avg confidence"
                baseline={`${(data.confidence.globalAvg * 100).toFixed(0)}%`}
                baselineLabel="graph-wide average"
                lift={`${data.confidence.gradient}×`}
                liftLabel="gradient ratio"
              >
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The most-used nodes should also be the most reliable ones. A positive gradient
                  proves the retrieval system is surfacing <em className="text-foreground">high-confidence facts</em>,
                  not grabbing random noise.
                </p>
                <div className="flex items-end gap-1 h-12 pt-2">
                  {data.confidence.histogram.map((b, i) => {
                    const maxCount = Math.max(...data.confidence.histogram.map(x => x.count), 1);
                    const pct = (b.count / maxCount) * 100;
                    return (
                      <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                        <motion.div
                          className="w-full rounded-t"
                          style={{ backgroundColor: `hsl(${180 + i * 15}, 70%, ${35 + i * 8}%)` }}
                          initial={{ height: 0 }}
                          animate={{ height: `${pct}%` }}
                          transition={{ duration: 0.6, delay: i * 0.08 }}
                        />
                        <span className="font-mono text-[8px] text-muted-foreground/50">{b.label}</span>
                      </div>
                    );
                  })}
                </div>
              </ProofCard>

              {/* 3. Retrieval precision */}
              <ProofCard
                icon={Zap}
                title="Retrieval Precision Lift"
                verdict={data.precision.verdict}
                metric={`${(data.precision.avgPrecision * 100).toFixed(0)}%`}
                metricLabel="avg relevant nodes retrieved"
                baseline={`${(data.precision.randomBaseline * 100).toFixed(0)}%`}
                baselineLabel="random-pick baseline"
                lift={`${data.precision.lift}×`}
                liftLabel="better than random"
              >
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Five domain-specific questions are probed against the knowledge graph. A random retriever
                  would score ≈ {(data.precision.randomBaseline * 100).toFixed(0)}% relevance.
                  This measures how much the TF-IDF retriever beats that floor.
                </p>
                <div className="space-y-1.5 pt-1">
                  {data.precision.probes.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-1 flex-1 bg-secondary/40 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-violet-400"
                          initial={{ width: 0 }}
                          animate={{ width: `${p.precision * 100}%` }}
                          transition={{ duration: 0.6, delay: i * 0.1 }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">
                        {(p.precision * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                  <p className="font-mono text-[9px] text-muted-foreground/50 pt-1">
                    {data.precision.probes.map(p => p.question.slice(0, 30) + "…").join(" · ")}
                  </p>
                </div>
              </ProofCard>

              {/* 4. Graph density */}
              <ProofCard
                icon={Layers}
                title="Conceptual Graph Density"
                verdict={data.graph.verdict}
                metric={`${data.graph.density}`}
                metricLabel="edges per node"
                baseline={`${data.graph.typeCounts.length}`}
                baselineLabel="knowledge types"
                lift={`${(100 - data.graph.dominantTypeFraction * 100).toFixed(0)}%`}
                liftLabel="type diversity"
              >
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A growing graph that just accumulates facts stays sparse. A graph that's
                  building <em className="text-foreground">conceptual connections</em> grows denser edges
                  between nodes — evidence of structured understanding, not trivia hoarding.
                </p>
                <div className="flex gap-2 flex-wrap pt-1">
                  {data.graph.typeCounts.map(({ type, count }) => {
                    const colors: Record<string, string> = {
                      fact: "#22d3ee", concept: "#facc15",
                      opinion: "#a78bfa", rule: "#34d399",
                    };
                    return (
                      <div key={type}
                           className="flex items-center gap-1.5 bg-secondary/30 rounded px-2 py-1">
                        <span className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: colors[type] ?? "#64748b" }} />
                        <span className="font-mono text-[10px] text-foreground">{type}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </ProofCard>
            </div>

            {/* Workhorse nodes */}
            {data.topNodes.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-border/50">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <p className="font-mono text-xs font-bold">Workhorse nodes</p>
                  <span className="font-mono text-[10px] text-muted-foreground ml-2">
                    — the most-retrieved facts. High access = the agent keeps returning here because these nodes answer real questions.
                  </span>
                </div>
                <div className="divide-y divide-border/30">
                  {data.topNodes.map((node, i) => {
                    const maxAccess = data.topNodes[0]?.timesAccessed ?? 1;
                    const pct = (node.timesAccessed / maxAccess) * 100;
                    const typeColors: Record<string, string> = {
                      fact: "#22d3ee", concept: "#facc15",
                      opinion: "#a78bfa", rule: "#34d399",
                    };
                    return (
                      <div key={node.id} className="flex items-center gap-4 px-5 py-3 group">
                        <span className="font-mono text-[10px] text-muted-foreground/40 w-4 shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs text-foreground/90 truncate">
                            {node.content}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[9px]"
                                  style={{ color: typeColors[node.type] ?? "#64748b" }}>
                              {node.type}
                            </span>
                            <span className="font-mono text-[9px] text-muted-foreground">
                              {(node.confidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-16 h-1 bg-secondary/40 rounded-full overflow-hidden">
                            <motion.div className="h-full rounded-full bg-primary"
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono text-xs text-primary w-6 text-right">
                            {node.timesAccessed}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Summary verdict */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className={cn(
                "flex items-center gap-4 rounded-xl px-5 py-4 border",
                passes >= 3
                  ? "bg-emerald-500/8 border-emerald-500/30"
                  : passes >= 1
                    ? "bg-yellow-500/8 border-yellow-500/30"
                    : "bg-secondary/20 border-border"
              )}
            >
              <TrendingUp className={cn(
                "w-5 h-5 shrink-0",
                passes >= 3 ? "text-emerald-400" : passes >= 1 ? "text-yellow-400" : "text-muted-foreground"
              )} />
              <div>
                <p className="font-mono text-sm font-bold">
                  {passes >= 3
                    ? `${passes}/4 proofs pass — intelligence is compounding`
                    : passes >= 1
                      ? `${passes}/4 proofs pass — quality is building`
                      : "Not enough data yet — keep using the agent"}
                </p>
                <p className="font-mono text-xs text-muted-foreground mt-0.5">
                  {passes >= 3
                    ? "Pareto concentration + confidence gradient + precision lift all confirm the agent rewards useful knowledge over raw accumulation."
                    : "Run more chats, train on documents in the Intelligence tab, then refresh this proof."}
                </p>
              </div>
            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
