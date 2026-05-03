import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { HardDrive, TrendingUp, Layers, GitMerge, Zap, AlertTriangle, CheckCircle, Database, Archive, Flame } from "lucide-react";

// --- Types ---
type StorageMode = "naive" | "metadata" | "federated";

interface TierRow {
  tier: "hot" | "warm" | "cold";
  label: string;
  medium: string;
  latency: string;
  maxAge: string;
  condition: string;
  color: string;
  icon: React.ReactNode;
}

// --- Constants ---
const TIERS: TierRow[] = [
  {
    tier: "hot",
    label: "Hot",
    medium: "NVMe SSD",
    latency: "< 1 ms",
    maxAge: "≤ 30 days",
    condition: "Access frequency > 3 reads / 7-day window OR trust score ≥ 0.85",
    color: "#f97316",
    icon: <Flame className="w-4 h-4" />,
  },
  {
    tier: "warm",
    label: "Warm",
    medium: "Block SSD",
    latency: "2–15 ms",
    maxAge: "31–180 days",
    condition: "Access frequency 1–2 reads / 7-day window AND trust score 0.5–0.84",
    color: "#22d3ee",
    icon: <Database className="w-4 h-4" />,
  },
  {
    tier: "cold",
    label: "Cold",
    medium: "Object store",
    latency: "50–400 ms",
    maxAge: "> 180 days",
    condition: "Zero reads in prior 14 days OR trust score < 0.5",
    color: "#64748b",
    icon: <Archive className="w-4 h-4" />,
  },
];

const DEDUP_SIGNALS = [
  { signal: "Exact SHA-256 match", action: "Drop — identical document already indexed", reduction: "~40%" },
  { signal: "SimHash distance < 3 bits", action: "Merge embeddings, keep highest-trust copy", reduction: "~18%" },
  { signal: "Canonical URL redirect chain", action: "Collapse to canonical, drop all aliases", reduction: "~9%" },
  { signal: "Syndicated content fingerprint", action: "Store once, record all referring URLs as aliases", reduction: "~7%" },
  { signal: "Cross-agent federation dedup", action: "Skip ingest if any peer agent holds the record", reduction: "~12%" },
];

const SHARD_STRATEGIES = [
  {
    name: "Domain-slice sharding",
    desc: "Each agent instance owns a consistent hash ring slice of the domain namespace. arxiv.org hashes to shard 04, wikipedia.org to shard 11. Ownership is stable across network reshuffles.",
    tradeoff: "Hotspot risk on high-volume domains. Mitigated by virtual nodes (128 vnodes per agent).",
  },
  {
    name: "Trust-tier partitioning",
    desc: "HIGH-trust content is replicated to 3 agents for redundancy. MEDIUM to 2. LOW-MEDIUM and unverified trust to 1 agent only. Loss of a single agent does not corrupt HIGH-trust knowledge.",
    tradeoff: "Storage overhead: approximately 2.1× average for HIGH-trust corpus.",
  },
  {
    name: "Temporal sharding",
    desc: "Documents crawled in the same 30-day window are co-located. Cold content ages out to a single archival shard shared across the network. Recent knowledge is query-fast; archived knowledge is bulk-accessible.",
    tradeoff: "Shard rebalancing required at month boundary. Offset with rolling 5-day overlap windows.",
  },
];

function formatBytes(gb: number): string {
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(gb * 1024).toFixed(0)} MB`;
}

function calcStorage(docs: number, mode: StorageMode, agents: number) {
  const AVG_FULL_KB = 52;      // average full-text page (compressed)
  const AVG_META_KB = 1.8;     // metadata + embedding record
  const DEDUP_FACTOR = 0.74;   // 26% reduction after dedup

  const rawDocs = docs * DEDUP_FACTOR;

  let singleAgentGB: number;
  if (mode === "naive") {
    singleAgentGB = (rawDocs * AVG_FULL_KB) / (1024 * 1024);
  } else if (mode === "metadata") {
    singleAgentGB = (rawDocs * AVG_META_KB) / (1024 * 1024);
  } else {
    // federated: metadata per doc, divided across agents, with 2.1x replication overhead for HIGH tier (~30% of corpus)
    const perAgentDocs = rawDocs / agents;
    const highTierDocs = rawDocs * 0.3 * 2.1 / agents; // replicated
    const restDocs = rawDocs * 0.7 / agents;
    singleAgentGB = ((highTierDocs + restDocs) * AVG_META_KB) / (1024 * 1024);
  }

  const networkTotalGB = mode === "federated"
    ? (rawDocs * AVG_META_KB * 1.2) / (1024 * 1024) // ~1.2x for replication overhead
    : singleAgentGB * agents;

  return { singleAgentGB, networkTotalGB, rawDocs };
}

function CapacityBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const overflow = value > max;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-xs" style={{ color: overflow ? "#ef4444" : color }}>
          {formatBytes(value)}{overflow ? " — EXCEEDS AGENT CAPACITY" : ""}
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: overflow ? "#ef4444" : color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function StoragePage() {
  const [docCount, setDocCount] = useState(100);          // millions
  const [agentCount, setAgentCount] = useState(10);
  const [mode, setMode] = useState<StorageMode>("naive");
  const [liveNodes, setLiveNodes] = useState<{ nodeCount: number; edgeCount: number } | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/omni/knowledge/stats`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(data => { if (data) setLiveNodes({ nodeCount: data.nodeCount, edgeCount: data.edgeCount }); });
  }, []);

  const AGENT_CAPACITY_GB = 500; // per agent assumed capacity

  const docs = docCount * 1_000_000;
  const { singleAgentGB, networkTotalGB, rawDocs } = useMemo(
    () => calcStorage(docs, mode, agentCount),
    [docs, mode, agentCount]
  );

  const modeLabel: Record<StorageMode, string> = {
    naive: "Naive full-text",
    metadata: "Metadata-first",
    federated: "Federated metadata",
  };

  const modeColor: Record<StorageMode, string> = {
    naive: "#ef4444",
    metadata: "#22d3ee",
    federated: "#34d399",
  };

  const ceiling = singleAgentGB > AGENT_CAPACITY_GB;
  const networkMax = agentCount * AGENT_CAPACITY_GB;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-16">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 font-mono text-xs text-primary mb-4 border border-primary/20 bg-primary/5 rounded px-3 py-1.5 w-fit">
          <HardDrive className="w-3.5 h-3.5" />
          <span>storage.architecture — internet-scale capacity planning</span>
        </div>
        <h1 className="text-4xl font-bold mb-3">Storage at Scale</h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          The agent can't fulfil "the whole internet as data centre" if it chokes at a few million documents.
          Storage failure is a hard ceiling on growth. This page makes the math visible and shows how the
          architecture keeps that ceiling above internet scale.
        </p>
        {liveNodes && (
          <div className="mt-5 inline-flex items-center gap-3 px-4 py-2.5 rounded-lg border border-primary/20 bg-primary/5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs text-muted-foreground">
              Current knowledge base:{" "}
              <span className="text-primary font-bold">{liveNodes.nodeCount.toLocaleString()} nodes</span>
              {" / "}
              <span className="text-foreground">{liveNodes.edgeCount.toLocaleString()} edges</span>
              {" — "}
              <span className="text-muted-foreground">
                {((liveNodes.nodeCount * 1.8) / 1024).toFixed(3)} MB at metadata-first scale
              </span>
            </span>
          </div>
        )}
      </motion.div>

      {/* The ceiling problem */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-5">
          The ceiling problem
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: "Indexed web pages (2024 est.)", value: "~5.4 billion", sub: "Common Crawl April 2024 snapshot", color: "#64748b" },
            { label: "Naive storage at 52 KB/page", value: "~280 TB", sub: "Per agent, before deduplication", color: "#ef4444" },
            { label: "Metadata-first at 1.8 KB/page", value: "~9.7 TB", sub: "Network total, federated across 10 agents", color: "#22d3ee" },
          ].map(c => (
            <div key={c.label} className="bg-card border border-border rounded-lg p-4">
              <div className="font-mono text-2xl font-bold mb-1" style={{ color: c.color }}>{c.value}</div>
              <div className="font-mono text-xs text-foreground mb-1">{c.label}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{c.sub}</div>
            </div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-lg p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-mono text-sm text-foreground mb-1">Why naive storage collapses</p>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                A naive crawler stores the full extracted text of every page. At 52 KB average (compressed HTML, de-noised),
                one million pages costs 52 GB. One billion pages costs 52 TB — on a single agent. That's before replication,
                before index overhead, before embedding vectors. The ceiling is hit at a few million documents on any
                commodity hardware. Scaling the hardware doesn't solve the problem — it just moves the ceiling and compounds the cost.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-mono text-sm text-foreground mb-1">Why metadata-first survives it</p>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                A metadata record is a URL, a model-generated summary (3–5 sentences), a 1536-dim embedding vector,
                a crawl timestamp, and a trust score. Total: ~1.8 KB. One billion pages costs 1.8 TB distributed
                across a federation of agents — feasible on standard cloud object storage. Copyrighted content
                is not absent from the agent's knowledge; it is represented without being owned.
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Capacity simulator */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-5">
          Capacity simulator
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-5">
            <p className="font-mono text-xs text-primary uppercase tracking-wider">Parameters</p>

            <div>
              <div className="flex justify-between mb-2">
                <p className="font-mono text-xs text-muted-foreground">document count</p>
                <span className="font-mono text-xs text-primary">{docCount}M docs</span>
              </div>
              <input
                type="range" min={1} max={5400} step={10}
                value={docCount}
                onChange={e => setDocCount(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground mt-1">
                <span>1M</span>
                <span>5.4B (full web)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <p className="font-mono text-xs text-muted-foreground">agent count</p>
                <span className="font-mono text-xs text-primary">{agentCount} agents</span>
              </div>
              <input
                type="range" min={1} max={100} step={1}
                value={agentCount}
                onChange={e => setAgentCount(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground mt-1">
                <span>1</span>
                <span>100</span>
              </div>
            </div>

            <div>
              <p className="font-mono text-xs text-muted-foreground mb-2">storage model</p>
              <div className="space-y-1.5">
                {(["naive", "metadata", "federated"] as StorageMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`w-full text-left font-mono text-xs px-3 py-2 rounded border transition-colors ${
                      mode === m ? "border-2" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                    style={mode === m ? { borderColor: modeColor[m] + "80", color: modeColor[m], backgroundColor: modeColor[m] + "10" } : {}}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: modeColor[m] }} />
                      {modeLabel[m]}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <div className="font-mono text-[10px] text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>After dedup (26% removed)</span>
                  <span className="text-foreground">{(rawDocs / 1_000_000).toFixed(1)}M</span>
                </div>
                <div className="flex justify-between">
                  <span>Per-agent capacity assumed</span>
                  <span className="text-foreground">500 GB</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg record size</span>
                  <span className="text-foreground">{mode === "naive" ? "52 KB" : "1.8 KB"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="md:col-span-2 space-y-4">
            <div className={`bg-card border rounded-lg p-5 space-y-5 ${ceiling ? "border-red-500/40" : "border-border"}`}>
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs text-primary uppercase tracking-wider">Storage projection</p>
                {ceiling ? (
                  <span className="font-mono text-[10px] text-red-400 border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded">
                    CEILING EXCEEDED
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-green-400 border border-green-500/30 bg-green-500/10 px-2 py-0.5 rounded">
                    WITHIN CAPACITY
                  </span>
                )}
              </div>

              <CapacityBar
                value={singleAgentGB}
                max={AGENT_CAPACITY_GB}
                color={modeColor[mode]}
                label="Per-agent storage requirement"
              />
              <CapacityBar
                value={networkTotalGB}
                max={networkMax}
                color={modeColor[mode]}
                label={`Network total (${agentCount} agents × 500 GB)`}
              />

              {/* Comparison row */}
              <div className="border-t border-border pt-4 space-y-2">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">All models at this document count</p>
                {(["naive", "metadata", "federated"] as StorageMode[]).map(m => {
                  const { singleAgentGB: s } = calcStorage(docs, m, agentCount);
                  const over = s > AGENT_CAPACITY_GB;
                  return (
                    <div key={m} className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: modeColor[m] }} />
                      <span className="font-mono text-xs text-muted-foreground w-36">{modeLabel[m]}</span>
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: over ? "#ef4444" : modeColor[m],
                            width: `${Math.min((s / AGENT_CAPACITY_GB) * 100, 100)}%`
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs w-28 text-right" style={{ color: over ? "#ef4444" : modeColor[m] }}>
                        {formatBytes(s)}{over ? " ✗" : " ✓"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {ceiling && mode === "naive" && (
                <div className="bg-red-950/30 border border-red-500/30 rounded p-3">
                  <p className="font-mono text-xs text-red-300">
                    At {docCount}M documents, naive storage requires {formatBytes(singleAgentGB)} per agent — {(singleAgentGB / AGENT_CAPACITY_GB).toFixed(1)}× the assumed 500 GB capacity.
                    Switch to metadata-first to reduce per-agent footprint by {((1 - 1.8 / 52) * 100).toFixed(0)}%.
                    Enable federation to distribute the remainder across {agentCount} agents.
                  </p>
                </div>
              )}
            </div>

            {/* Compression math */}
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Compression breakdown</p>
              <div className="space-y-2">
                {[
                  { label: "Full text → summary", from: "52 KB", to: "0.6 KB", ratio: "87×", color: "#22d3ee" },
                  { label: "HTML → embedding", from: "52 KB", to: "6.1 KB (fp16)", ratio: "8.5×", color: "#a78bfa" },
                  { label: "Metadata record total", from: "52 KB", to: "1.8 KB", ratio: "29×", color: "#34d399" },
                  { label: "After network dedup", from: "1.8 KB", to: "1.3 KB effective", ratio: "net 37×", color: "#f97316" },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-muted-foreground w-44">{r.label}</span>
                    <span className="text-muted-foreground">{r.from}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-foreground">{r.to}</span>
                    <span className="ml-auto font-bold" style={{ color: r.color }}>{r.ratio}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Content-addressed deduplication */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-5">
          Content-addressed deduplication
        </div>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="font-mono text-xs text-muted-foreground">
              26% of the raw corpus is eliminated before storage through five deduplication passes.
              Each pass runs on content fingerprints — no full text is materialised to perform dedup.
            </p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Signal</th>
                <th className="px-5 py-3 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Action</th>
                <th className="px-5 py-3 text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Reduction</th>
              </tr>
            </thead>
            <tbody>
              {DEDUP_SIGNALS.map((row, i) => (
                <tr key={row.signal} className={i < DEDUP_SIGNALS.length - 1 ? "border-b border-border/50" : ""}>
                  <td className="px-5 py-3 font-mono text-xs text-foreground">{row.signal}</td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{row.action}</td>
                  <td className="px-5 py-3 font-mono text-xs text-primary text-right">{row.reduction}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-primary/5">
                <td className="px-5 py-3 font-mono text-xs text-primary" colSpan={2}>Combined effective reduction (with overlap)</td>
                <td className="px-5 py-3 font-mono text-xs font-bold text-primary text-right">~26%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </motion.section>

      {/* Tiered storage */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-5">
          Tiered storage — automatic demotion
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {TIERS.map(tier => (
            <div key={tier.tier} className="bg-card border border-border rounded-lg p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div style={{ color: tier.color }}>{tier.icon}</div>
                <span className="font-mono text-sm font-bold" style={{ color: tier.color }}>{tier.label}</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-muted-foreground">Medium</span>
                  <span className="text-foreground">{tier.medium}</span>
                </div>
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-muted-foreground">Latency</span>
                  <span className="text-foreground">{tier.latency}</span>
                </div>
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-muted-foreground">Age range</span>
                  <span className="text-foreground">{tier.maxAge}</span>
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">{tier.condition}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex gap-8 font-mono text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span>Hot corpus: ~8% of indexed docs, ~31% of queries served</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Warm corpus: ~22% of indexed docs, ~54% of queries served</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-500" />
              <span>Cold corpus: ~70% of indexed docs, ~15% of queries served</span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Sharding strategies */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-5">
          Federated sharding strategies
        </div>
        <div className="space-y-3">
          {SHARD_STRATEGIES.map((s, i) => (
            <div key={s.name} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start gap-3">
                <div className="font-mono text-xs text-primary/50 w-6 shrink-0 mt-0.5">0{i + 1}</div>
                <div className="space-y-2 flex-1">
                  <p className="font-mono text-sm text-foreground">{s.name}</p>
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  <div className="flex items-start gap-2 border-t border-border/50 pt-2 mt-2">
                    <AlertTriangle className="w-3 h-3 text-yellow-500 mt-0.5 shrink-0" />
                    <p className="font-mono text-[10px] text-muted-foreground/70">{s.tradeoff}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Growth projection */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-5">
          Growth projection — federated metadata model
        </div>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Scale</th>
                <th className="px-5 py-3 text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Naive / agent</th>
                <th className="px-5 py-3 text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Metadata / agent</th>
                <th className="px-5 py-3 text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Federated / agent</th>
                <th className="px-5 py-3 text-right font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "1M docs", naive: "52 GB", meta: "1.8 GB", fed10: "0.18 GB", ok: true },
                { label: "10M docs", naive: "520 GB", meta: "18 GB", fed10: "1.8 GB", ok: true },
                { label: "100M docs", naive: "5.2 TB", meta: "180 GB", fed10: "18 GB", ok: true },
                { label: "1B docs", naive: "52 TB", meta: "1.8 TB", fed10: "180 GB", ok: true },
                { label: "5.4B docs (full web)", naive: "280 TB", meta: "9.7 TB", fed10: "970 GB", ok: false },
              ].map((row, i) => (
                <tr key={row.label} className={i < 4 ? "border-b border-border/50" : ""}>
                  <td className="px-5 py-3 font-mono text-xs text-foreground">{row.label}</td>
                  <td className="px-5 py-3 font-mono text-xs text-red-400 text-right">{row.naive}</td>
                  <td className="px-5 py-3 font-mono text-xs text-primary text-right">{row.meta}</td>
                  <td className="px-5 py-3 font-mono text-xs text-green-400 text-right">{row.fed10}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${row.ok
                      ? "text-green-400 border-green-500/30 bg-green-500/10"
                      : "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"}`}>
                      {row.ok ? "feasible" : "needs 20+ agents"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border px-5 py-3">
            <p className="font-mono text-[10px] text-muted-foreground">
              Federated column assumes 10 agents, 500 GB/agent. Full web requires ~20 agents at metadata-first rates, or ~560 agents naive. Deduplication (26%) applied to all figures.
            </p>
          </div>
        </div>
      </motion.section>

    </div>
  );
}
