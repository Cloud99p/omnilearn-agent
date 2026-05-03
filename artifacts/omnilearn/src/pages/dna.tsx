import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Copy, Check, RefreshCw, Dna, Lock, Fingerprint, Database, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CharacterAPI {
  id: number;
  curiosity: number;
  caution: number;
  confidence: number;
  verbosity: number;
  technical: number;
  empathy: number;
  creativity: number;
  totalInteractions: number;
  totalKnowledgeNodes: number;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeStats {
  nodeCount: number;
  edgeCount: number;
  logCount: number;
  typeCounts: Array<{ type: string; count: string }>;
}

type TraitKey = "curiosity" | "caution" | "confidence" | "verbosity" | "technical" | "empathy" | "creativity";

const TRAIT_META: Array<{ key: TraitKey; label: string; locked: boolean; color: string }> = [
  { key: "curiosity",  label: "curiosity",  locked: true,  color: "#22d3ee" },
  { key: "caution",    label: "caution",    locked: true,  color: "#22d3ee" },
  { key: "empathy",    label: "empathy",    locked: true,  color: "#22d3ee" },
  { key: "confidence", label: "confidence", locked: false, color: "#34d399" },
  { key: "verbosity",  label: "verbosity",  locked: false, color: "#34d399" },
  { key: "technical",  label: "technical",  locked: false, color: "#a78bfa" },
  { key: "creativity", label: "creativity", locked: false, color: "#a78bfa" },
];

function deriveFingerprint(char: CharacterAPI): string {
  const vals = [char.curiosity, char.caution, char.empathy, char.confidence, char.verbosity].map(v => Math.round(v));
  const seed = vals.reduce((acc, v, i) => acc + v * (i + 1) * 31337, 0);
  return `0x${(seed >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function buildSnapshot(char: CharacterAPI, knowledge: KnowledgeStats, ts: string) {
  const fp = deriveFingerprint(char);
  const traits = Object.fromEntries(TRAIT_META.map(t => [t.label, +(char[t.key] / 100).toFixed(4)]));
  const uptimeDays = Math.floor((Date.now() - new Date(char.createdAt).getTime()) / 86_400_000);
  return {
    instance: {
      id: fp,
      fingerprint: fp,
      created: char.createdAt,
      checkpoint: ts,
      uptime_days: uptimeDays,
      version: "1.0.0",
    },
    character: {
      fingerprint: fp,
      traits,
      core_locked: TRAIT_META.filter(t => t.locked).map(t => t.label),
      total_interactions: char.totalInteractions,
    },
    knowledge: {
      nodes: knowledge.nodeCount,
      edges: knowledge.edgeCount,
      learning_events: knowledge.logCount,
      by_type: Object.fromEntries(knowledge.typeCounts.map(tc => [tc.type, Number(tc.count)])),
    },
    substrate: {
      mode: "single_machine",
      shard_key: null,
      federation_enabled: false,
    },
  };
}

function colorizeJson(raw: string): string {
  return raw.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    match => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) return `<span style="color:#94a3b8">${match}</span>`;
        return `<span style="color:#22d3ee">${match}</span>`;
      }
      if (/true|false/.test(match)) return `<span style="color:#34d399">${match}</span>`;
      if (/null/.test(match)) return `<span style="color:#f472b6">${match}</span>`;
      return `<span style="color:#a78bfa">${match}</span>`;
    },
  );
}

export default function DnaPage() {
  const [char, setChar] = useState<CharacterAPI | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkpointTs, setCheckpointTs] = useState(() => new Date().toISOString());
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const [cRes, kRes] = await Promise.all([
        fetch(`${BASE}/api/omni/character`),
        fetch(`${BASE}/api/omni/knowledge/stats`),
      ]);
      if (cRes.ok) setChar(await cRes.json());
      if (kRes.ok) setKnowledge(await kRes.json());
    } catch { /* silent — show loading skeleton */ }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const snapshot = char && knowledge ? buildSnapshot(char, knowledge, checkpointTs) : null;
  const jsonStr = snapshot ? JSON.stringify(snapshot, null, 2) : "";
  const fingerprint = char ? deriveFingerprint(char) : "0x????????";
  const uptimeDays = char ? Math.floor((Date.now() - new Date(char.createdAt).getTime()) / 86_400_000) : 0;

  const handleCopy = useCallback(async () => {
    if (!jsonStr) return;
    await navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [jsonStr]);

  const handleDownload = useCallback(() => {
    if (!jsonStr) return;
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omnilearn-dna-${fingerprint}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [jsonStr, fingerprint]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setCheckpointTs(new Date().toISOString());
    setRefreshing(false);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono text-xs mb-4">
          <Dna className="w-3.5 h-3.5" />
          <span>instance snapshot — live checkpoint</span>
          {!loading && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
        </div>
        <h1 className="text-4xl font-bold mb-3">Instance DNA</h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          A complete snapshot of this agent's live state — its character fingerprint,
          knowledge graph, trait vector, and substrate config. Pulled from the live database on every load.
          No two agents produce the same file.
        </p>
      </motion.div>

      {/* Instance badge */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-8 p-5 rounded-xl border border-primary/30 bg-primary/5 flex flex-wrap items-center gap-6"
      >
        <div className="flex items-center gap-3">
          <Fingerprint className="w-8 h-8 text-primary" />
          <div>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Instance Fingerprint</p>
            <p className="font-mono text-xl font-bold text-primary">{loading ? "computing…" : fingerprint}</p>
          </div>
        </div>
        <div className="h-10 border-l border-border/50 hidden md:block" />
        {[
          { label: "Created",      value: char ? new Date(char.createdAt).toLocaleDateString() : "—" },
          { label: "Uptime",       value: char ? `${uptimeDays}d` : "—" },
          { label: "Interactions", value: char ? char.totalInteractions.toLocaleString() : "—" },
          { label: "Knowledge",    value: knowledge ? `${knowledge.nodeCount} nodes` : "—" },
        ].map(s => (
          <div key={s.label}>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className="font-mono text-sm font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Summary grid */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Character traits */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 rounded-xl border border-border bg-card"
        >
          <div className="flex items-center gap-2 mb-5">
            <Fingerprint className="w-4 h-4 text-primary" />
            <p className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">Character Traits</p>
            {!loading && (
              <span className="ml-auto font-mono text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded">
                live
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-secondary rounded w-32 mb-2" />
                  <div className="h-1.5 bg-secondary rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {TRAIT_META.map(t => {
                const raw = char ? char[t.key] : 50;
                const norm = raw / 100;
                return (
                  <div key={t.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-foreground capitalize">{t.label}</span>
                        {t.locked && (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Lock className="w-2.5 h-2.5" />core
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{norm.toFixed(3)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${norm * 100}%` }}
                        transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-4 font-mono text-[10px] text-muted-foreground">
            Interaction count:{" "}
            <span className="text-primary">{char?.totalInteractions ?? "—"}</span>
            {" "}— traits evolve with each learning event
          </p>
        </motion.div>

        {/* Knowledge graph */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-6 rounded-xl border border-border bg-card"
        >
          <div className="flex items-center gap-2 mb-5">
            <Database className="w-4 h-4 text-primary" />
            <p className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">Knowledge Graph</p>
            {!loading && (
              <span className="ml-auto font-mono text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded">
                live
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-10 bg-secondary rounded" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Nodes",   value: knowledge?.nodeCount ?? 0, color: "#22d3ee" },
                  { label: "Edges",   value: knowledge?.edgeCount ?? 0, color: "#a78bfa" },
                  { label: "Events",  value: knowledge?.logCount  ?? 0, color: "#34d399" },
                ].map(s => (
                  <div key={s.label} className="text-center p-3 bg-secondary/30 rounded-lg">
                    <p className="font-mono text-xl font-bold" style={{ color: s.color }}>
                      {s.value.toLocaleString()}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {knowledge?.typeCounts && knowledge.typeCounts.length > 0 && (
                <div className="space-y-3">
                  {knowledge.typeCounts.map((tc, i) => {
                    const palette = ["#22d3ee", "#34d399", "#a78bfa", "#f472b6", "#fb923c"];
                    const color = palette[i % palette.length];
                    const total = knowledge.typeCounts.reduce((a, t) => a + Number(t.count), 0);
                    const pct = total > 0 ? (Number(tc.count) / total) * 100 : 0;
                    return (
                      <div key={tc.type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-sm text-foreground capitalize">{tc.type}</span>
                          <span className="font-mono text-xs text-muted-foreground">{tc.count} nodes</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Total indexed</p>
              <p className="font-mono text-lg font-bold text-primary">{knowledge?.nodeCount ?? "—"} nodes</p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Connections</p>
              <p className="font-mono text-lg font-bold text-foreground">{knowledge?.edgeCount ?? "—"}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Learning log</p>
              <p className="font-mono text-lg font-bold text-foreground">{knowledge?.logCount ?? "—"}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* JSON export panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-10 rounded-xl border border-border bg-card overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>
            <span className="font-mono text-xs text-muted-foreground">omnilearn-dna-{fingerprint}.json</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground hidden sm:block">
              checkpoint: {new Date(checkpointTs).toLocaleTimeString()}
            </span>
            <Button variant="ghost" size="sm" className="font-mono text-xs h-7 px-2.5 text-muted-foreground hover:text-foreground" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" className="font-mono text-xs h-7 px-2.5 text-muted-foreground hover:text-foreground" onClick={handleCopy} disabled={!snapshot}>
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.span key="check" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />Copied
                  </motion.span>
                ) : (
                  <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                    <Copy className="w-3.5 h-3.5" />Copy
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
            <Button size="sm" className="font-mono text-xs h-7 px-3 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleDownload} disabled={!snapshot}>
              <Download className="w-3.5 h-3.5 mr-1.5" />Download
            </Button>
          </div>
        </div>

        <div className="relative overflow-auto max-h-[520px] p-5">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="h-4 bg-secondary rounded" style={{ width: `${35 + (i * 17) % 55}%` }} />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.pre
                key={checkpointTs}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="font-mono text-xs leading-relaxed text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: colorizeJson(jsonStr) }}
              />
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      {/* Migration note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-8 p-5 rounded-xl border border-border/50 bg-secondary/20"
      >
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3">How to use this file</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: "Migrate",  desc: "Pass to `omnilearn restore --dna ./file.json` on a new machine. Character and knowledge transfer intact." },
            { title: "Compare",  desc: "Load two DNA files into the Compare page to see how two instances diverged from a common ancestor." },
            { title: "Archive",  desc: "Store as a point-in-time snapshot. Useful before major knowledge domain shifts or substrate changes." },
          ].map(u => (
            <div key={u.title}>
              <p className="font-mono text-sm font-bold text-foreground mb-1">{u.title}</p>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">{u.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
