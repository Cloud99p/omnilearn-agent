import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Copy, Check, RefreshCw, Dna, Lock, Fingerprint, BookOpen, Code, Newspaper, Library, Users, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Stable simulated instance state ─────────────────────────────────────────
const INSTANCE_ID = "0x3F8A2D1C";
const FINGERPRINT  = "0x3F8A2D1C9E2B7F41";
const CREATED      = "2024-08-14T09:21:03Z";
const VERSION      = "1.0.0-rc.4";
const UPTIME_DAYS  = 262;

const TRAITS = [
  { key: "curiosity",    value: 0.847, locked: true,  color: "#22d3ee" },
  { key: "skepticism",   value: 0.623, locked: true,  color: "#22d3ee" },
  { key: "empathy",      value: 0.412, locked: false, color: "#34d399" },
  { key: "formality",    value: 0.291, locked: false, color: "#34d399" },
  { key: "boldness",     value: 0.558, locked: false, color: "#a78bfa" },
];

const CRAWL_BY_CAT = [
  { cat: "Academic",     key: "academic",     docs: 41500,  icon: BookOpen,  color: "#22d3ee" },
  { cat: "Tech",         key: "tech",         docs: 56500,  icon: Code,      color: "#34d399" },
  { cat: "News",         key: "news",         docs: 35800,  icon: Newspaper, color: "#f472b6" },
  { cat: "Encyclopedic", key: "encyclopedic", docs: 41000,  icon: Library,   color: "#a78bfa" },
  { cat: "Social",       key: "social",       docs: 25800,  icon: Users,     color: "#facc15" },
];

const TOTAL_DOCS = CRAWL_BY_CAT.reduce((a, c) => a + c.docs, 0);

function buildSnapshot(ts: string) {
  return {
    instance: {
      id: INSTANCE_ID,
      fingerprint: FINGERPRINT,
      created: CREATED,
      checkpoint: ts,
      uptime_days: UPTIME_DAYS,
      version: VERSION,
    },
    character: {
      fingerprint: FINGERPRINT,
      traits: Object.fromEntries(TRAITS.map(t => [t.key, t.value])),
      trait_version: 847,
      irreversibility_threshold: 0.72,
      core_locked: TRAITS.filter(t => t.locked).map(t => t.key),
    },
    knowledge: {
      domains_crawled: 18,
      total_docs: TOTAL_DOCS,
      by_category: Object.fromEntries(CRAWL_BY_CAT.map(c => [c.key, c.docs])),
      knowledge_graph: {
        nodes: 847234,
        edges: 2341892,
        clusters: 342,
      },
      top_domains: [
        "en.wikipedia.org",
        "github.com",
        "news.ycombinator.com",
        "pubmed.ncbi.nih.gov",
        "arxiv.org",
      ],
    },
    substrate: {
      mode: "single_machine",
      shard_key: null,
      federation_enabled: false,
      checkpoints: 848,
    },
  };
}

// ── Syntax-highlighted JSON renderer ────────────────────────────────────────
function colorizeJson(raw: string): string {
  return raw
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) return `<span style="color:#94a3b8">${match}</span>`;
        return `<span style="color:#22d3ee">${match}</span>`;
      }
      if (/true|false/.test(match)) return `<span style="color:#34d399">${match}</span>`;
      if (/null/.test(match)) return `<span style="color:#f472b6">${match}</span>`;
      return `<span style="color:#a78bfa">${match}</span>`;
    });
}

export default function DnaPage() {
  const [checkpointTs, setCheckpointTs] = useState(() => new Date().toISOString());
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const snapshot = buildSnapshot(checkpointTs);
  const jsonStr = JSON.stringify(snapshot, null, 2);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [jsonStr]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omnilearn-dna-${INSTANCE_ID}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [jsonStr]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setCheckpointTs(new Date().toISOString());
      setRefreshing(false);
    }, 700);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono text-xs mb-4">
          <Dna className="w-3.5 h-3.5" />
          <span>instance snapshot — exportable checkpoint</span>
        </div>
        <h1 className="text-4xl font-bold mb-3">Instance DNA</h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          A complete cryptographic snapshot of this agent's identity at this moment in time — its character fingerprint,
          crawl footprint, trait vector, and substrate config. Use it to migrate, back up, or compare instances.
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
            <p className="font-mono text-xl font-bold text-primary">{FINGERPRINT}</p>
          </div>
        </div>
        <div className="h-10 border-l border-border/50 hidden md:block" />
        {[
          { label: "Created",   value: "Aug 14, 2024" },
          { label: "Uptime",    value: `${UPTIME_DAYS} days` },
          { label: "Version",   value: VERSION },
          { label: "Checkpoints", value: "848" },
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
          </div>
          <div className="space-y-4">
            {TRAITS.map(t => (
              <div key={t.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-foreground capitalize">{t.key}</span>
                    {t.locked && (
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Lock className="w-2.5 h-2.5" />
                        core
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{t.value.toFixed(3)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${t.value * 100}%` }}
                    transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 font-mono text-[10px] text-muted-foreground">
            Trait version <span className="text-primary">847</span> — irreversibility threshold locked at 0.72
          </p>
        </motion.div>

        {/* Crawl footprint */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-6 rounded-xl border border-border bg-card"
        >
          <div className="flex items-center gap-2 mb-5">
            <Database className="w-4 h-4 text-primary" />
            <p className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">Crawl Footprint</p>
          </div>
          <div className="space-y-3.5">
            {CRAWL_BY_CAT.map(c => {
              const pct = (c.docs / TOTAL_DOCS) * 100;
              return (
                <div key={c.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <c.icon className="w-3.5 h-3.5" style={{ color: c.color }} />
                      <span className="font-mono text-sm text-foreground">{c.cat}</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{c.docs.toLocaleString()} docs</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Total indexed</p>
              <p className="font-mono text-lg font-bold text-primary">{(TOTAL_DOCS / 1000).toFixed(1)}k docs</p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Domains</p>
              <p className="font-mono text-lg font-bold text-foreground">18</p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Graph nodes</p>
              <p className="font-mono text-lg font-bold text-foreground">847k</p>
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
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              omnilearn-dna-{INSTANCE_ID}.json
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Checkpoint timestamp */}
            <span className="font-mono text-[10px] text-muted-foreground hidden sm:block">
              checkpoint: {new Date(checkpointTs).toLocaleTimeString()}
            </span>

            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs h-7 px-2.5 text-muted-foreground hover:text-foreground"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs h-7 px-2.5 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.span key="check" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    Copied
                  </motion.span>
                ) : (
                  <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>

            <Button
              size="sm"
              className="font-mono text-xs h-7 px-3 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleDownload}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download
            </Button>
          </div>
        </div>

        {/* JSON body */}
        <div className="relative overflow-auto max-h-[520px] p-5">
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
