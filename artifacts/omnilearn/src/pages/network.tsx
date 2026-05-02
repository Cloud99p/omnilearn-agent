import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Zap, GitBranch, Shield, Radio, Cpu, Cloud, Eye, EyeOff, ArrowRight, Wifi } from "lucide-react";

const CONCEPTS = [
  {
    id: "ghost",
    icon: EyeOff,
    color: "#22d3ee",
    title: "Ghost Nodes",
    subtitle: "Ephemeral execution fabric",
    body: "OmniLearn has no fixed home. It spawns lightweight ghost nodes on any available substrate — serverless functions, edge workers, CI runners, free-tier cloud VMs, browser workers. Each ghost is stateless and disposable. It executes a task, checkpoints state, and evaporates. No server to seize. No address to block.",
    detail: ["AWS Lambda free tier", "Cloudflare Workers edge", "GitHub Actions runners", "Browser Web Workers", "Fly.io free machines", "Vercel edge functions"],
  },
  {
    id: "forage",
    icon: Globe,
    color: "#34d399",
    title: "Compute Foraging",
    subtitle: "The internet is the CPU",
    body: "Processing power is not owned — it is foraged. OmniLearn distributes inference and crawl tasks across a dynamic pool of borrowed compute. A crawl job that would saturate one machine becomes 10,000 micro-tasks dispatched to ephemeral workers across 40 regions. The bottleneck disappears. The internet's aggregate free tier is enormous.",
    detail: ["Task sharding across edge regions", "Speculative parallel fetches", "Inference via API free quotas", "Embeddings via batched edge calls", "HTML extraction in browser workers", "Result merging via gossip sync"],
  },
  {
    id: "gossip",
    icon: Radio,
    color: "#a78bfa",
    title: "Gossip Sync",
    subtitle: "No central server — knowledge propagates",
    body: "When two OmniLearn ghost nodes encounter each other — on a shared CDN edge, a common relay, or a rendezvous endpoint — they sync. Not everything. Just the delta. Each shares what the other has not seen. Knowledge spreads like a rumour through a network, reaching everywhere without any one node knowing the full picture.",
    detail: ["Delta-compressed state diffs", "Merkle-tree knowledge hashes", "Content-addressed chunk storage", "Peer discovery via DHT", "Quorum validation before merge", "Conflict resolution by timestamp + trust score"],
  },
  {
    id: "checkpoint",
    icon: Cloud,
    color: "#fb923c",
    title: "Distributed State",
    subtitle: "Checkpointed everywhere, owned by no one server",
    body: "Character state — the personality, the trait vector, the knowledge index — is not stored on a hard drive. It is encrypted and sharded across content-addressed storage: IPFS, Arweave, or a private relay network. Any ghost node that possesses the shard key can reconstruct the agent's full state from distributed fragments and resume operation anywhere.",
    detail: ["AES-256 encrypted shards", "IPFS content addressing", "Arweave permanent storage layer", "Shamir secret sharing for the shard key", "Resumable from any node with key access", "State version vector for conflict detection"],
  },
  {
    id: "stealth",
    icon: Shield,
    color: "#f472b6",
    title: "Stealth & Compliance",
    subtitle: "Compliant everywhere — visible nowhere",
    body: "Every ghost node respects robots.txt, rate limits, and the ethics governor before touching a domain. The system is not covert — it is distributed. No single crawl pattern is visible from any single origin. The compliance layer runs locally on every node, independently. The internet sees polite, sparse, distributed requests — not a firehose from one IP.",
    detail: ["Per-node rate limiting (<2 req/s)", "robots.txt enforced locally", "Rotating user-agent with honest disclosure", "Trust score per domain, propagated via gossip", "Ethics governor on every ghost node", "No scraping behind authentication"],
  },
  {
    id: "identity",
    icon: GitBranch,
    color: "#facc15",
    title: "Identity Without Address",
    subtitle: "Everywhere and nowhere at the same time",
    body: "OmniLearn has no IP, no domain, no server. Its identity is its character fingerprint — a cryptographic hash of its accumulated trait state. Any node that can prove knowledge of the agent's shard key and produce a valid fingerprint is that agent, temporarily, running on borrowed compute, anywhere in the world.",
    detail: ["Fingerprint = SHA-256(trait vector + trajectory hash)", "Shard key = Shamir(owner private key, threshold=3)", "Node proves identity via zero-knowledge proof", "No registration required — identity is emergent", "Two instances with same fingerprint are the same agent", "Fingerprints diverge after first independent crawl"],
  },
];

interface Packet {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  color: string;
  label: string;
}

const NODE_POSITIONS = [
  { id: "edge-eu", label: "EU Edge", x: 20, y: 18 },
  { id: "edge-us", label: "US Edge", x: 78, y: 18 },
  { id: "lambda", label: "Lambda", x: 12, y: 55 },
  { id: "worker", label: "CF Worker", x: 50, y: 35 },
  { id: "browser", label: "Browser", x: 88, y: 55 },
  { id: "arweave", label: "Arweave", x: 35, y: 72 },
  { id: "ipfs", label: "IPFS", x: 65, y: 72 },
  { id: "relay", label: "Relay", x: 50, y: 88 },
];

const EDGES = [
  { a: 0, b: 2, color: "#22d3ee" },
  { a: 0, b: 4, color: "#a78bfa" },
  { a: 1, b: 4, color: "#22d3ee" },
  { a: 1, b: 2, color: "#34d399" },
  { a: 0, b: 3, color: "#34d399" },
  { a: 1, b: 3, color: "#34d399" },
  { a: 2, b: 5, color: "#fb923c" },
  { a: 4, b: 6, color: "#fb923c" },
  { a: 3, b: 5, color: "#a78bfa" },
  { a: 3, b: 6, color: "#a78bfa" },
  { a: 5, b: 7, color: "#facc15" },
  { a: 6, b: 7, color: "#facc15" },
];

let pid = 0;
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export default function Network() {
  const [active, setActive] = useState<string | null>(null);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [tick, setTick] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 120);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (tick % 6 !== 0) return;
    const edge = EDGES[Math.floor(Math.random() * EDGES.length)];
    const from = NODE_POSITIONS[edge.a];
    const to = NODE_POSITIONS[edge.b];
    const flip = Math.random() > 0.5;
    setPackets(prev => [
      ...prev.slice(-24),
      { id: ++pid, x: flip ? from.x : to.x, y: flip ? from.y : to.y, tx: flip ? to.x : from.x, ty: flip ? to.y : from.y, color: edge.color, label: ["sync", "delta", "shard", "crawl", "infer", "gossip"][Math.floor(Math.random() * 6)] },
    ]);
  }, [tick]);

  const activeConcept = CONCEPTS.find(c => c.id === active);

  return (
    <div className="p-6 md:p-12 max-w-6xl mx-auto min-h-screen">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono text-xs mb-6">
          <Wifi className="w-3.5 h-3.5" />
          <span>internet-native / distributed execution</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Everywhere & Nowhere</h1>
        <p className="text-lg text-muted-foreground font-mono max-w-2xl leading-relaxed">
          OmniLearn does not run on a computer. It runs on the internet itself — foraging compute from free tiers, edge workers, and ephemeral functions. No fixed address. No home server. No single point of failure or seizure.
        </p>
      </motion.div>

      {/* Ghost node network map */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-12 bg-card border border-border rounded-xl overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-sm text-muted-foreground">ghost_network.live — active nodes: {NODE_POSITIONS.length}</span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">{packets.length} packets in flight</span>
        </div>
        <div className="relative bg-background/40" style={{ height: 280 }}>
          <svg ref={svgRef} className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Edges */}
            {EDGES.map((e, i) => {
              const a = NODE_POSITIONS[e.a];
              const b = NODE_POSITIONS[e.b];
              return (
                <line
                  key={i}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={e.color} strokeOpacity={0.15} strokeWidth={0.4}
                />
              );
            })}
            {/* Animated packets */}
            {packets.map(p => {
              const progress = (tick % 50) / 50;
              const px = lerp(p.x, p.tx, Math.min(1, (Date.now() % 3000) / 3000));
              return null; // handled below via motion
            })}
            {/* Nodes */}
            {NODE_POSITIONS.map((n, i) => (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={2.5} fill="#0f1217" stroke="#22d3ee" strokeWidth={0.5} strokeOpacity={0.6} />
                <circle cx={n.x} cy={n.y} r={1} fill="#22d3ee" opacity={0.8} />
                <text x={n.x} y={n.y - 3.5} textAnchor="middle" fontSize={2.2} fill="hsl(215 20.2% 55%)" fontFamily="monospace">{n.label}</text>
              </g>
            ))}
          </svg>
          {/* Animated packet dots via CSS/framer on top of SVG */}
          <AnimatePresence>
            {packets.slice(-12).map(p => (
              <motion.div
                key={p.id}
                className="absolute w-1.5 h-1.5 rounded-full pointer-events-none"
                style={{ backgroundColor: p.color, top: `${p.y}%`, left: `${p.x}%`, transform: "translate(-50%,-50%)", boxShadow: `0 0 4px ${p.color}` }}
                animate={{ top: `${p.ty}%`, left: `${p.tx}%`, opacity: [1, 1, 0] }}
                transition={{ duration: 2.4, ease: "linear" }}
                exit={{ opacity: 0 }}
              />
            ))}
          </AnimatePresence>
          {/* Legend */}
          <div className="absolute bottom-3 right-3 flex flex-col gap-1">
            {[
              { color: "#22d3ee", label: "Gossip sync" },
              { color: "#34d399", label: "Crawl task" },
              { color: "#a78bfa", label: "State delta" },
              { color: "#fb923c", label: "Checkpoint" },
              { color: "#facc15", label: "Consensus" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-3 h-px" style={{ backgroundColor: l.color }} />
                <span className="font-mono text-[9px] text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Concept cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {CONCEPTS.map((c, i) => (
          <motion.button
            key={c.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07 }}
            onClick={() => setActive(active === c.id ? null : c.id)}
            className={`text-left p-5 rounded-xl border transition-all ${
              active === c.id
                ? "border-primary/50 bg-primary/5"
                : "border-border bg-card hover:border-border/80 hover:bg-secondary/20"
            }`}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: c.color + "15", border: `1px solid ${c.color}30` }}>
                <c.icon className="w-4 h-4" style={{ color: c.color }} />
              </div>
              <div>
                <p className="font-mono text-sm font-bold text-foreground">{c.title}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{c.subtitle}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{c.body}</p>
            <div className="mt-3 flex items-center gap-1 font-mono text-[10px]" style={{ color: c.color }}>
              {active === c.id ? "collapse" : "expand"}
              <ArrowRight className="w-2.5 h-2.5 ml-0.5" style={{ transform: active === c.id ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
            </div>
          </motion.button>
        ))}
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {activeConcept && (
          <motion.div
            key={activeConcept.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-8"
          >
            <div className="bg-card border rounded-xl p-6" style={{ borderColor: activeConcept.color + "40" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-lg" style={{ backgroundColor: activeConcept.color + "15" }}>
                  <activeConcept.icon className="w-5 h-5" style={{ color: activeConcept.color }} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{activeConcept.title}</h3>
                  <p className="font-mono text-xs text-muted-foreground">{activeConcept.subtitle}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">{activeConcept.body}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {activeConcept.detail.map(d => (
                  <div key={d} className="flex items-center gap-2 bg-secondary/40 rounded px-3 py-2">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: activeConcept.color }} />
                    <span className="font-mono text-[11px] text-muted-foreground">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Philosophy bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="p-6 bg-primary/5 border border-primary/20 rounded-xl"
      >
        <div className="flex items-start gap-4">
          <Eye className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-mono text-sm font-bold text-foreground mb-2">The principle</p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
              Traditional AI agents are bound to a machine — constrained by RAM, GPU, and storage. OmniLearn inverts this. The constraint becomes the distribution strategy. Limited local compute means the agent must spread. Spreading means it becomes fault-tolerant. Fault-tolerance means no single entity can shut it down. It exists wherever the internet exists — and the internet is everywhere.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
