import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Cpu,
  Globe,
  Ghost,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Zap,
  Database,
  Activity,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface GhostStatus {
  total: number;
  online: number;
}

function Check({ color }: { color: string }) {
  return <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color }} />;
}
function Blank() {
  return (
    <div className="w-3 h-0.5 bg-muted-foreground/20 rounded shrink-0 ml-0.5" />
  );
}
function Warn() {
  return <AlertCircle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
}

export default function ModesPage() {
  const [ghostStatus, setGhostStatus] = useState<GhostStatus | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/ghost/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setGhostStatus(d);
      })
      .catch(() => {});
  }, []);

  const ghostOnline = ghostStatus?.online ?? 0;
  const ghostTotal = ghostStatus?.total ?? 0;
  const ghostReady = ghostOnline > 0;
  const ghostChecked = ghostStatus !== null;

  return (
    <div className="p-6 md:p-12 max-w-5xl mx-auto min-h-screen">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 mb-5">
          <Cpu className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono text-xs text-primary">
            omni.chat_modes
          </span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-3">Chat Modes</h1>
        <p className="text-muted-foreground font-mono text-sm max-w-2xl leading-relaxed">
          Omni can run in three configurations. Each trades off speed,
          capability, and infrastructure requirements differently. Pick the one
          that fits your workflow, then click{" "}
          <span className="text-foreground">"Use this mode"</span> to open the
          chat.
        </p>
      </motion.div>

      <div className="space-y-5">
        {/* ── LOCAL ──────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <div className="bg-card border border-cyan-500/20 rounded-2xl overflow-hidden">
            {/* Card header */}
            <div className="flex items-start justify-between gap-4 p-6 border-b border-border/40">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 shrink-0">
                  <Cpu className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold">Local</h2>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      default
                    </span>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      always available
                    </span>
                  </div>
                  <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                    Answers from Omni's own knowledge graph — no internet, no
                    external nodes.
                  </p>
                </div>
              </div>
              <Link href="/chat?mode=local">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors font-mono text-sm whitespace-nowrap shrink-0">
                  Use this mode <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>

            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/40">
              <div className="p-5">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
                  How it works
                </p>
                <ol className="space-y-2.5">
                  {[
                    "Message arrives at Omni",
                    "TF-IDF retrieval finds relevant stored facts",
                    "Facts are injected as context",
                    "Omni synthesises a response",
                  ].map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-mono text-[10px] text-cyan-400/50 w-4 shrink-0 mt-0.5">
                        {i + 1}.
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {s}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="p-5">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
                  Best for
                </p>
                <ul className="space-y-2.5">
                  {[
                    "Fast, private answers",
                    "Querying facts Omni already knows",
                    "Air-gapped or offline environments",
                    "Low-latency workflows",
                  ].map((s) => (
                    <li key={s} className="flex items-start gap-2">
                      <Check color="#22d3ee" />
                      <span className="font-mono text-xs text-muted-foreground">
                        {s}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-5">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
                  Requirements
                </p>
                <ul className="space-y-2.5">
                  <li className="flex items-center gap-2">
                    <Check color="#34d399" />
                    <span className="font-mono text-xs text-muted-foreground">
                      OmniLearn running
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Blank />
                    <span className="font-mono text-xs text-muted-foreground/40 line-through">
                      Internet access
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Blank />
                    <span className="font-mono text-xs text-muted-foreground/40 line-through">
                      Ghost nodes
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── NATIVE ─────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
        >
          <div className="bg-card border border-violet-500/20 rounded-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-4 p-6 border-b border-border/40">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 shrink-0">
                  <Globe className="w-6 h-6 text-violet-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold">Native</h2>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      internet access
                    </span>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      always available
                    </span>
                  </div>
                  <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                    Searches the web in real time, reads pages, and permanently
                    stores everything it learns.
                  </p>
                </div>
              </div>
              <Link href="/chat?mode=native">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors font-mono text-sm whitespace-nowrap shrink-0">
                  Use this mode <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>

            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/40">
              <div className="p-5">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
                  How it works
                </p>
                <ol className="space-y-2.5">
                  {[
                    "Message arrives at Omni",
                    "Searches DuckDuckGo (up to 4 queries)",
                    "Fetches full pages when needed",
                    "Combines web + knowledge graph",
                    "Stores new facts permanently, then responds",
                  ].map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-mono text-[10px] text-violet-400/50 w-4 shrink-0 mt-0.5">
                        {i + 1}.
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {s}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="p-5">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
                  Best for
                </p>
                <ul className="space-y-2.5">
                  {[
                    "Current events and real-time data",
                    "Questions Omni hasn't seen before",
                    "Research that grows the knowledge base",
                    "Anything that needs cited sources",
                  ].map((s) => (
                    <li key={s} className="flex items-start gap-2">
                      <Check color="#a78bfa" />
                      <span className="font-mono text-xs text-muted-foreground">
                        {s}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-5">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
                  Requirements
                </p>
                <ul className="space-y-2.5">
                  <li className="flex items-center gap-2">
                    <Check color="#34d399" />
                    <span className="font-mono text-xs text-muted-foreground">
                      OmniLearn running
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check color="#34d399" />
                    <span className="font-mono text-xs text-muted-foreground">
                      Outbound internet access
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Blank />
                    <span className="font-mono text-xs text-muted-foreground/40 line-through">
                      Ghost nodes
                    </span>
                  </li>
                </ul>
                <div className="mt-4 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-violet-400" />
                    <span className="font-mono text-[10px] text-violet-400">
                      Live activity indicators
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground/70">
                    Cyan badges appear in the sidebar while Omni is searching
                    and reading pages.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── GHOST ──────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
        >
          <div
            className={`bg-card rounded-2xl overflow-hidden border ${ghostReady ? "border-emerald-500/20" : "border-border"}`}
          >
            <div className="flex items-start justify-between gap-4 p-6 border-b border-border/40">
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className={`p-3 rounded-xl shrink-0 ${ghostReady ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-secondary border border-border"}`}
                >
                  <Ghost
                    className={`w-6 h-6 ${ghostReady ? "text-emerald-400" : "text-muted-foreground"}`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold">Ghost</h2>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-secondary text-muted-foreground border border-border">
                      distributed
                    </span>
                    {!ghostChecked && (
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-secondary text-muted-foreground/50 border border-border animate-pulse">
                        checking…
                      </span>
                    )}
                    {ghostChecked && ghostOnline > 0 && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {ghostOnline}/{ghostTotal} node
                        {ghostTotal !== 1 ? "s" : ""} online
                      </span>
                    )}
                    {ghostChecked && ghostOnline === 0 && ghostTotal > 0 && (
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                        {ghostTotal} registered — none online
                      </span>
                    )}
                    {ghostChecked && ghostTotal === 0 && (
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-secondary text-muted-foreground border border-border">
                        no nodes configured
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-sm text-muted-foreground leading-relaxed">
                    Routes your message to a remote node — offloads inference to
                    other machines on your network.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                {ghostChecked && ghostTotal === 0 && (
                  <Link href="/ghost-network">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-muted-foreground border border-border hover:text-foreground transition-colors font-mono text-sm whitespace-nowrap">
                      Add nodes <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </Link>
                )}
                <Link href="/chat?mode=ghost">
                  <button
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm whitespace-nowrap transition-colors ${ghostReady ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20" : "bg-secondary text-muted-foreground border border-border hover:text-foreground"}`}
                  >
                    Use this mode <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>
            </div>

            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/40">
              <div className="p-5">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
                  How it works
                </p>
                <ol className="space-y-2.5">
                  {[
                    "Message arrives at Omni",
                    "Server picks the lowest-load online node",
                    "Message is forwarded to that node",
                    "Remote node processes and streams back",
                    "Falls back to local Omni if unreachable",
                  ].map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-mono text-[10px] text-emerald-400/50 w-4 shrink-0 mt-0.5">
                        {i + 1}.
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {s}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="p-5">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
                  Best for
                </p>
                <ul className="space-y-2.5">
                  {[
                    "Offloading compute from your main server",
                    "Running Omni across a machine network",
                    "High-availability with automatic failover",
                    "Collaborative or multi-user deployments",
                  ].map((s) => (
                    <li key={s} className="flex items-start gap-2">
                      <Check color="#34d399" />
                      <span className="font-mono text-xs text-muted-foreground">
                        {s}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-5">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
                  Requirements
                </p>
                <ul className="space-y-2.5">
                  <li className="flex items-center gap-2">
                    <Check color="#34d399" />
                    <span className="font-mono text-xs text-muted-foreground">
                      OmniLearn running
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check color="#34d399" />
                    <span className="font-mono text-xs text-muted-foreground">
                      Outbound internet access
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    {!ghostChecked && <Blank />}
                    {ghostChecked && ghostTotal > 0 && (
                      <Check color="#34d399" />
                    )}
                    {ghostChecked && ghostTotal === 0 && <Warn />}
                    <span
                      className={`font-mono text-xs ${ghostChecked && ghostTotal === 0 ? "text-yellow-400" : "text-muted-foreground"}`}
                    >
                      ≥1 ghost node registered
                    </span>
                  </li>
                </ul>
                {ghostChecked && ghostTotal === 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 space-y-2">
                    <p className="font-mono text-[10px] text-yellow-400/80">
                      No nodes registered yet. Ghost mode falls back to local
                      Omni.
                    </p>
                    <Link
                      href="/ghost-network"
                      className="flex items-center gap-1 font-mono text-[10px] text-primary hover:text-primary/80 transition-colors"
                    >
                      Set up ghost nodes <ArrowRight className="w-2.5 h-2.5" />
                    </Link>
                  </div>
                )}
                {ghostChecked && ghostTotal > 0 && ghostOnline === 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                    <p className="font-mono text-[10px] text-yellow-400/80">
                      {ghostTotal} node{ghostTotal !== 1 ? "s" : ""} registered
                      but currently offline. Ghost mode will fall back to local
                      Omni.
                    </p>
                  </div>
                )}
                {ghostChecked && ghostOnline > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-mono text-[10px] text-emerald-400">
                        {ghostOnline} node{ghostOnline !== 1 ? "s" : ""} ready
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground/70">
                      Ghost mode is fully operational.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Comparison table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
        className="mt-10"
      >
        <h2 className="text-xl font-bold mb-4">Side-by-side comparison</h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-4 border-b border-border bg-secondary/20">
            <div className="px-5 py-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Feature
            </div>
            <div className="px-5 py-3 font-mono text-[10px] text-cyan-400 uppercase tracking-wider border-l border-border">
              Local
            </div>
            <div className="px-5 py-3 font-mono text-[10px] text-violet-400 uppercase tracking-wider border-l border-border">
              Native
            </div>
            <div className="px-5 py-3 font-mono text-[10px] text-emerald-400 uppercase tracking-wider border-l border-border">
              Ghost
            </div>
          </div>
          {[
            {
              label: "Uses knowledge graph",
              local: true,
              native: true,
              ghost: true,
            },
            {
              label: "Real-time web search",
              local: false,
              native: true,
              ghost: false,
            },
            {
              label: "Learns from every response",
              local: false,
              native: true,
              ghost: false,
            },
            {
              label: "Runs on this server",
              local: true,
              native: true,
              ghost: false,
            },
            {
              label: "Needs ghost nodes",
              local: false,
              native: false,
              ghost: true,
            },
            {
              label: "Live activity indicators",
              local: false,
              native: true,
              ghost: false,
            },
            {
              label: "Automatic failover",
              local: false,
              native: false,
              ghost: true,
            },
            {
              label: "Works offline",
              local: true,
              native: false,
              ghost: false,
            },
          ].map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-4 border-t border-border/40"
            >
              <div className="px-5 py-3 font-mono text-xs text-muted-foreground">
                {row.label}
              </div>
              {[
                { val: row.local, color: "#22d3ee" },
                { val: row.native, color: "#a78bfa" },
                { val: row.ghost, color: "#34d399" },
              ].map(({ val, color }, i) => (
                <div
                  key={i}
                  className="px-5 py-3 border-l border-border/40 flex items-center"
                >
                  {val ? <Check color={color} /> : <Blank />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Bottom CTA row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-8 grid sm:grid-cols-3 gap-3"
      >
        {[
          {
            label: "Open Local mode",
            href: "/chat?mode=local",
            color: "#22d3ee",
            icon: Cpu,
          },
          {
            label: "Open Native mode",
            href: "/chat?mode=native",
            color: "#a78bfa",
            icon: Globe,
          },
          {
            label: "Open Ghost mode",
            href: "/chat?mode=ghost",
            color: "#34d399",
            icon: Ghost,
          },
        ].map(({ label, href, color, icon: Icon }) => (
          <Link key={href} href={href}>
            <button
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-mono text-sm transition-all hover:scale-[1.02]"
              style={{
                borderColor: color + "30",
                backgroundColor: color + "08",
                color,
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>
          </Link>
        ))}
      </motion.div>
    </div>
  );
}
