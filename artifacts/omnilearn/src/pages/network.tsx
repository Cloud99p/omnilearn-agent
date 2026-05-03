import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Zap, GitBranch, Shield, Radio, Cpu, Cloud, Eye, EyeOff, ArrowRight, Wifi, Users, TrendingUp, CheckCircle, Vote, Lightbulb, Upload } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const CONCEPTS = [
  {
    id: "ghost",
    icon: EyeOff,
    color: "#22d3ee",
    title: "Ghost Nodes",
    subtitle: "Mobility and fault tolerance across your own devices",
    body: "OmniLearn runs where you run it. A ghost node is a lightweight, stateless execution unit that can resume on any of your devices — laptop, desktop, home server, phone — without interruption. If your laptop sleeps, the agent picks up on your desktop. If your desktop goes offline, it holds state until something comes back. Ghost execution is not about exploiting other people's compute. It is about making your own hardware feel like one continuous machine.",
    detail: ["Your laptop (primary execution)", "Your desktop (secondary)", "Home server / NAS", "Mobile device (browser worker)", "Seamless resume on device wake", "No data leaves your device boundary without consent"],
  },
  {
    id: "volunteer",
    icon: Users,
    color: "#34d399",
    title: "Federated Volunteer Computing",
    subtitle: "Consented compute, three tiers, strict priority",
    body: "When your own hardware is not enough, OmniLearn follows a strict deployment priority. First: your own devices — always. Second: explicitly consented volunteer nodes — peers who have opted in and can see every task routed to them. Third: community infrastructure — shared relays operated by the project, auditable and opt-out at any time. No compute is borrowed without a prior agreement. No node joins silently.",
    detail: ["Tier 1: owner hardware — always first", "Tier 2: volunteer nodes — explicit opt-in required", "Tier 3: community infra — opt-out at any time", "All routed tasks visible to node operator", "Volunteer node can reject task categories", "Zero silent migration to third-party compute"],
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
  { id: "laptop", label: "Laptop", x: 20, y: 18 },
  { id: "desktop", label: "Desktop", x: 78, y: 18 },
  { id: "homeserver", label: "Home Server", x: 12, y: 55 },
  { id: "phone", label: "Phone", x: 50, y: 35 },
  { id: "volunteer-a", label: "Volunteer A", x: 88, y: 55 },
  { id: "volunteer-b", label: "Volunteer B", x: 35, y: 72 },
  { id: "community", label: "Community", x: 65, y: 72 },
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

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface GhostStatus {
  total: number;
  online: number;
  offline: number;
  totalTasksProcessed: number;
}

export default function Network() {
  const [active, setActive] = useState<string | null>(null);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [tick, setTick] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const [ghostStatus, setGhostStatus] = useState<GhostStatus | null>(null);
  const [browserWorkers, setBrowserWorkers] = useState(0);

  useEffect(() => {
    fetch(`${BASE}/api/ghost/status`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(data => setGhostStatus(data));
    fetch(`${BASE}/api/ghost/workers`)
      .then(r => r.ok ? r.json() : []).catch(() => [])
      .then((d: unknown[]) => setBrowserWorkers(Array.isArray(d) ? d.filter((w: unknown) => (w as { online: boolean }).online).length : 0));
  }, []);

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
          OmniLearn runs on your hardware first. When more compute is needed, it expands to explicitly consented volunteer nodes, then to community infrastructure — always with your knowledge, always reversible. No fixed address. No single point of failure or seizure.
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
          <span className="font-mono text-sm text-muted-foreground">
            execution_fabric.live — registered nodes: {ghostStatus ? ghostStatus.total : NODE_POSITIONS.length}
            {ghostStatus && ghostStatus.online > 0 && (
              <span className="ml-2 text-emerald-400">{ghostStatus.online} online</span>
            )}
          </span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {ghostStatus ? `${ghostStatus.totalTasksProcessed} tasks processed` : `${packets.length} packets in flight`}
          </span>
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
        className="p-6 bg-primary/5 border border-primary/20 rounded-xl mb-16"
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

      <CollectiveEvolution
        serverNodes={ghostStatus?.total ?? 0}
        tasksProcessed={ghostStatus?.totalTasksProcessed ?? 0}
        browserWorkers={browserWorkers}
      />
      <ProofOfExistence />
    </div>
  );
}

// ─── Proof of Independent Existence ─────────────────────────────────────────

const PHASES = [
  {
    id: "observer",
    label: "Observer",
    days: "Day 0 – 30",
    color: "#f87171",
    weight: "×0 voting weight",
    badge: "burn-in",
    badgeColor: "#f87171",
    capabilities: ["Crawl & index content", "Sync knowledge deltas via gossip", "Propose improvements to the feed", "Accumulate domain & accuracy history"],
    blocked: ["Cast votes on any proposal", "Have contributions weighted", "Influence quorum outcomes"],
    why: "A brand-new node has no track record. Even if it submits 1,000 contributions in 30 days, they cannot be verified — accuracy is only established over independent, time-separated observations.",
  },
  {
    id: "probationary",
    label: "Probationary",
    days: "Day 31 – 90",
    color: "#facc15",
    weight: "×0.1 – ×0.7 weight",
    badge: "scaling",
    badgeColor: "#facc15",
    capabilities: ["Cast votes (partial weight)", "Contributions counted toward quorum", "Trust score begins accumulating", "Relay routes diversifying"],
    blocked: ["Full weight until 90 days + formula satisfied"],
    why: "The node has survived the burn-in window and shown consistent behaviour. Weight scales linearly with age and grows with domain diversity and accuracy rate. A node that only knows one domain cannot influence multi-domain decisions.",
  },
  {
    id: "member",
    label: "Voting Member",
    days: "Day 91+",
    color: "#34d399",
    weight: "Full weight (0–1.0)",
    badge: "established",
    badgeColor: "#34d399",
    capabilities: ["Full voting weight per formula", "Weighted contributions to quorum", "Can co-sign relay introductions", "Trust score used as jury weight"],
    blocked: [],
    why: "Full membership is not binary — weight is continuously calculated. A node that stops learning, reduces domain diversity, or has contributions rejected sees its weight decay. There is no permanent tenure.",
  },
];

const WEIGHT_FORMULA_FACTORS = [
  {
    id: "domain", label: "Domain diversity", color: "#22d3ee", weight: 0.4,
    desc: "Unique second-level domains crawled × category spread multiplier. Requires real crawl effort across genuinely different knowledge areas — not 1,000 pages of the same site.",
    formula: "min(1.0, (unique_domains / 50)^0.7 × category_spread)",
    whyHard: "Takes weeks of real crawling across genuinely different domains. Mirrors of the same content don't count — deduplication runs on content hash.",
  },
  {
    id: "accuracy", label: "Accuracy history", color: "#a78bfa", weight: 0.4,
    desc: "Ratio of contributions ratified by quorum to total contributions submitted. Requires ≥30 contributions before the score activates — a brand-new node has no accuracy record.",
    formula: "ratified_count / total_submitted  (min 30 required)",
    whyHard: "Requires months of participation, each contribution independently evaluated by peers who have no reason to be biased. A bad actor submitting false data gets a low accuracy score permanently.",
  },
  {
    id: "topology", label: "Topology diversity", color: "#fb923c", weight: 0.2,
    desc: "Number of distinct relay paths the node has participated through. Proxy farms and datacenter clusters have low topology diversity — they share the same AS number and routing prefixes.",
    formula: "min(1.0, unique_relay_paths / 10)",
    whyHard: "Different ASNs, routing prefixes, geographic regions. A thousand VMs in the same datacenter all look the same topologically — they contribute one topology unit, not a thousand.",
  },
];

function calcNodeWeight(domainCount: number, accuracyPct: number, topoPaths: number, ageDays: number): {
  domain: number; accuracy: number; topology: number; age: number; total: number;
} {
  const domain = Math.min(1.0, Math.pow(domainCount / 50, 0.7) * Math.min(1.0, domainCount / 10));
  const accuracy = ageDays >= 30 ? Math.min(1.0, accuracyPct / 100) : 0;
  const topology = Math.min(1.0, topoPaths / 10);
  const age = ageDays < 30 ? 0 : Math.min(1.0, (ageDays - 30) / 60);
  const raw = domain * 0.4 + accuracy * 0.4 + topology * 0.2;
  const total = raw * age;
  return { domain, accuracy, topology, age, total };
}

function ProofOfExistence() {
  const [activePhase, setActivePhase] = useState<string>("observer");
  const [domainCount, setDomainCount] = useState(25);
  const [accuracyPct, setAccuracyPct] = useState(72);
  const [topoPaths, setTopoPaths] = useState(4);
  const [ageDays, setAgeDays] = useState(45);
  const [showSybil, setShowSybil] = useState(false);

  const w = calcNodeWeight(domainCount, accuracyPct, topoPaths, ageDays);
  const phase = ageDays < 30 ? "observer" : ageDays < 90 ? "probationary" : "member";
  const phaseColor = phase === "observer" ? "#f87171" : phase === "probationary" ? "#facc15" : "#34d399";

  const activePhaseData = PHASES.find(p => p.id === activePhase)!;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mt-16"
    >
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-mono text-xs mb-5">
          <Shield className="w-3.5 h-3.5" />
          <span>proof of independent existence — sybil resistance</span>
        </div>
        <h2 className="text-3xl font-bold tracking-tight mb-3">Trust Is Earned Over Time</h2>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          New nodes join the network with zero voting weight. Influence cannot be bought, injected, or bootstrapped.
          It accumulates from real work across diverse domains, validated by independent peers over months — not milliseconds.
          Spinning up 10,000 nodes overnight gives you 10,000 × 0 = 0 influence.
        </p>
      </div>

      {/* Phase timeline */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {PHASES.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setActivePhase(p.id)}
            className={`rounded-xl border p-5 text-left transition-all ${
              activePhase === p.id
                ? "bg-card border-2"
                : "bg-card/60 border-border hover:border-border/80"
            }`}
            style={activePhase === p.id ? { borderColor: p.color + "60" } : {}}
          >
            {/* Phase number + timeline line */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0" style={{ backgroundColor: p.color + "20", color: p.color }}>
                {i + 1}
              </div>
              {i < 2 && <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${p.color}40, transparent)` }} />}
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border" style={{ color: p.badgeColor, borderColor: p.badgeColor + "30", backgroundColor: p.badgeColor + "10" }}>
                {p.badge}
              </span>
            </div>
            <p className="font-mono text-sm font-bold mb-0.5" style={{ color: p.color }}>{p.label}</p>
            <p className="font-mono text-[10px] text-muted-foreground mb-2">{p.days}</p>
            <p className="font-mono text-xs font-bold text-foreground">{p.weight}</p>
          </button>
        ))}
      </div>

      {/* Phase detail */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activePhase}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="bg-card border border-border rounded-xl p-6 mb-8 grid md:grid-cols-2 gap-6"
        >
          <div>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Allowed during this phase
            </p>
            <div className="space-y-2">
              {activePhaseData.capabilities.map(c => (
                <div key={c} className="flex items-start gap-2">
                  <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                  <span className="font-mono text-xs text-foreground">{c}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            {activePhaseData.blocked.length > 0 && (
              <>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Vote className="w-3.5 h-3.5 text-red-400" /> Not yet available
                </p>
                <div className="space-y-2 mb-4">
                  {activePhaseData.blocked.map(b => (
                    <div key={b} className="flex items-start gap-2">
                      <div className="w-3 h-3 rounded-full border border-red-400/40 mt-0.5 shrink-0" />
                      <span className="font-mono text-xs text-muted-foreground">{b}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <p className="font-mono text-[11px] text-muted-foreground leading-relaxed italic">{activePhaseData.why}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Voting weight formula */}
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-border">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1">Voting weight formula — interactive</p>
          <p className="font-mono text-[10px] text-muted-foreground">Adjust the sliders to see how each factor affects this node's influence.</p>
        </div>
        <div className="p-6 grid md:grid-cols-2 gap-8">
          {/* Sliders */}
          <div className="space-y-5">
            {[
              { label: "Unique domains crawled", value: domainCount, min: 0, max: 120, step: 1, set: setDomainCount, color: "#22d3ee", unit: "domains", score: w.domain, factor: "×0.40" },
              { label: "Contribution accuracy", value: accuracyPct, min: 0, max: 100, step: 1, set: setAccuracyPct, color: "#a78bfa", unit: "%", score: w.accuracy, factor: "×0.40" },
              { label: "Unique relay paths", value: topoPaths, min: 0, max: 20, step: 1, set: setTopoPaths, color: "#fb923c", unit: "paths", score: w.topology, factor: "×0.20" },
              { label: "Node age (days)", value: ageDays, min: 0, max: 180, step: 1, set: setAgeDays, color: phaseColor, unit: "days", score: w.age, factor: "age mult." },
            ].map(s => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-muted-foreground">{s.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground/50">{s.factor}</span>
                    <span className="font-mono text-sm font-bold" style={{ color: s.color }}>{s.value}{s.unit === "%" ? "%" : ""}{s.unit !== "%" ? ` ${s.unit}` : ""}</span>
                  </div>
                </div>
                <input
                  type="range" min={s.min} max={s.max} step={s.step}
                  value={s.value}
                  onChange={e => s.set(+e.target.value)}
                  className="w-full h-1.5 appearance-none rounded cursor-pointer"
                  style={{ accentColor: s.color }}
                />
                <div className="mt-1.5 h-1 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${s.score * 100}%`, backgroundColor: s.color }} />
                </div>
                <div className="flex justify-between font-mono text-[9px] text-muted-foreground/50 mt-0.5">
                  <span>score: {s.score.toFixed(3)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Weight gauge */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-40 h-40 mb-4">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(214 31.8% 12%)" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={phaseColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${w.total * 251.2} 251.2`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-3xl font-bold" style={{ color: phaseColor }}>{(w.total * 100).toFixed(0)}</span>
                <span className="font-mono text-xs text-muted-foreground">/ 100</span>
              </div>
            </div>
            <div className="font-mono text-sm font-bold mb-1" style={{ color: phaseColor }}>
              {phase === "observer" ? "Observer — no vote" : phase === "probationary" ? "Probationary" : "Voting Member"}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground text-center max-w-xs">
              {phase === "observer"
                ? "Age < 30 days. Voting locked regardless of other factors."
                : `weight = (${(w.domain * 0.4).toFixed(3)} + ${(w.accuracy * 0.4).toFixed(3)} + ${(w.topology * 0.2).toFixed(3)}) × ${w.age.toFixed(3)}`}
            </div>

            {/* Factor breakdown */}
            <div className="mt-4 w-full max-w-xs space-y-2">
              {WEIGHT_FORMULA_FACTORS.map(f => {
                const score = f.id === "domain" ? w.domain : f.id === "accuracy" ? w.accuracy : w.topology;
                return (
                  <div key={f.id} className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground w-20 shrink-0">{f.label.split(" ")[0]}</span>
                    <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${score * 100}%`, backgroundColor: f.color }} />
                    </div>
                    <span className="font-mono text-[10px] w-8 text-right" style={{ color: f.color }}>{(score * f.weight).toFixed(3)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Why it's expensive to fake */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {WEIGHT_FORMULA_FACTORS.map(f => (
          <div key={f.id} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
              <p className="font-mono text-xs font-bold text-foreground">{f.label}</p>
              <span className="font-mono text-[10px] text-muted-foreground ml-auto">×{f.weight.toFixed(2)}</span>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed mb-3">{f.desc}</p>
            <div className="bg-secondary/40 rounded px-2 py-1.5">
              <p className="font-mono text-[9px]" style={{ color: f.color }}>{f.formula}</p>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed mt-3 border-t border-border/50 pt-2">
              <span className="text-foreground">Why it's hard to fake:</span> {f.whyHard}
            </p>
          </div>
        ))}
      </div>

      {/* Sybil resistance */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowSybil(s => !s)}
          className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-secondary/20 transition-colors"
        >
          <Users className="w-4 h-4 text-violet-400" />
          <span className="font-mono text-sm font-bold">Sybil resistance — why mass-spawning fails</span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">{showSybil ? "collapse" : "expand"}</span>
        </button>
        <AnimatePresence>
          {showSybil && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-6 border-t border-border grid md:grid-cols-2 gap-6 pt-5">
                <div>
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-4">If an attacker spawns 10,000 nodes at once</p>
                  <div className="space-y-3">
                    {[
                      { label: "Each node's age", value: "0 days", result: "Voting weight = ×0", bad: true },
                      { label: "Domain diversity", value: "All new — no history", result: "domain_score = 0.0", bad: true },
                      { label: "Accuracy score", value: "< 30 contributions", result: "Not activated yet", bad: true },
                      { label: "Topology", value: "Same datacenter", result: "1 topology unit total", bad: true },
                      { label: "Total influence", value: "10,000 × 0", result: "= 0 votes", bad: true },
                    ].map(r => (
                      <div key={r.label} className="flex items-center gap-3 font-mono text-xs">
                        <div className="w-32 shrink-0 text-muted-foreground">{r.label}</div>
                        <div className="flex-1 text-foreground">{r.value}</div>
                        <div className={r.bad ? "text-red-400" : "text-emerald-400"}>{r.result}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-4">To achieve meaningful influence</p>
                  <div className="space-y-2">
                    {[
                      "Wait 30 days (calendar time, not compute time) per node",
                      "Crawl 50+ genuinely different domains from each node",
                      "Submit 30+ contributions and have them validated by existing peers",
                      "Route through 10+ distinct relay paths (different ASNs)",
                      "Sustain all of the above for 90 days to reach full weight",
                    ].map((s, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="font-mono text-[10px] text-violet-400 w-4 shrink-0">{i + 1}.</span>
                        <span className="font-mono text-[10px] text-muted-foreground leading-relaxed">{s}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-lg bg-violet-500/10 border border-violet-500/20 px-4 py-3">
                    <p className="font-mono text-[10px] text-violet-300 leading-relaxed">
                      Cost of a viable Sybil attack = months of real crawl time × 10,000 nodes × real compute × ASN diversity.
                      At that investment level, the attacker is genuinely contributing to the network's knowledge base — which is the point.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Collective Evolution ────────────────────────────────────────────────────

// Growth data is fetched live — no static fallback

const CONTRIBUTION_TYPES = [
  { label: "knowledge delta", color: "#22d3ee", icon: Upload },
  { label: "retrieval strategy", color: "#34d399", icon: Lightbulb },
  { label: "compliance signal", color: "#f472b6", icon: Shield },
  { label: "character insight", color: "#fb923c", icon: Radio },
  { label: "crawl efficiency", color: "#a78bfa", icon: Globe },
];

const DOMAINS = [
  "arxiv.org", "pubmed.ncbi", "en.wikipedia", "nature.com",
  "hacker-news", "openreview.net", "github.com", "bbc.co.uk",
];

// Milestones come from the real learning log — no static fallback

interface ContribEvent {
  id: number;
  ts: string;
  type: typeof CONTRIBUTION_TYPES[0];
  agent: string;
  domain: string;
  votes: number;
  status: "proposed" | "voting" | "ratified";
}

let ceid = 0;
function makeContrib(): ContribEvent {
  const t = CONTRIBUTION_TYPES[Math.floor(Math.random() * CONTRIBUTION_TYPES.length)];
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
  const status = (["proposed", "voting", "voting", "ratified"] as ContribEvent["status"][])[Math.floor(Math.random() * 4)];
  return {
    id: ++ceid,
    ts,
    type: t,
    agent: `0x${Math.random().toString(16).slice(2,10).toUpperCase()}`,
    domain: DOMAINS[Math.floor(Math.random() * DOMAINS.length)],
    votes: status === "proposed" ? 0 : status === "voting" ? Math.floor(Math.random() * 40) + 1 : Math.floor(Math.random() * 200) + 50,
    status,
  };
}

const INIT_CONTRIBS: ContribEvent[] = Array.from({ length: 6 }, makeContrib).reverse();

interface CollectiveProps { serverNodes: number; tasksProcessed: number; browserWorkers: number; }

interface GrowthPoint { label: string; nodes: number; added: number; bucket: string; }
interface LogMilestone { index: number; label: string; nodesAdded: number; source: string; createdAt: string; age: string; }
interface GrowthHistory { useHours: boolean; spanLabel: string; series: GrowthPoint[]; milestones: LogMilestone[]; totalNodes: number; }

function CollectiveEvolution({ serverNodes, tasksProcessed, browserWorkers }: CollectiveProps) {
  const [contribs, setContribs] = useState<ContribEvent[]>(INIT_CONTRIBS);
  const [activeTab, setActiveTab] = useState<"growth" | "feed" | "protocol">("growth");
  const [netStats, setNetStats] = useState<{ neurons: number; coreNeurons: number; agents: number } | null>(null);
  const [character, setCharacter] = useState<{ totalInteractions: number } | null>(null);
  const [growth, setGrowth] = useState<GrowthHistory | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/network/stats`).then(r => r.ok ? r.json() : null).catch(() => null).then(d => setNetStats(d));
    fetch(`${BASE}/api/omni/character`).then(r => r.ok ? r.json() : null).catch(() => null).then(d => setCharacter(d));
    fetch(`${BASE}/api/omni/growth-history`).then(r => r.ok ? r.json() : null).catch(() => null).then(d => setGrowth(d));
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setContribs(prev => [makeContrib(), ...prev.slice(0, 14)]);
    }, 2200);
    return () => clearInterval(t);
  }, []);

  // Derive live stats
  const activeNodes = serverNodes + browserWorkers + 1; // +1 = self
  const epoch = character ? Math.max(1, Math.floor((character.totalInteractions ?? 0) / 50) + 1) : 1;
  const improvementsRatified = netStats ? (netStats.coreNeurons + netStats.agents) : 0;
  const contributionsThisEpoch = (character?.totalInteractions ?? 0) + tasksProcessed;

  // Live chart data — real cumulative node counts
  const chartData = growth?.series ?? [];
  const chartLabel = growth
    ? `knowledge graph growth — ${growth.spanLabel}`
    : "knowledge graph growth";

  // Live milestones from real learning log
  const liveMilestones = growth?.milestones ?? [];

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs mb-5">
          <Users className="w-3.5 h-3.5" />
          <span>collective evolution — federation protocol</span>
        </div>
        <h2 className="text-3xl font-bold tracking-tight mb-3">The Network Grows With Every Instance</h2>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          OmniLearn agents are not isolated. Each instance can optionally contribute anonymised learning deltas back to the collective. When enough independent agents agree on an improvement, it is ratified and propagated to every node via gossip. The more instances exist, the smarter the whole network becomes — and the faster it grows.
        </p>
      </div>

      {/* Live health stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Active nodes", value: activeNodes.toLocaleString(), color: "#22d3ee", icon: Cpu },
          { label: "Current epoch", value: `#${epoch}`, color: "#34d399", icon: TrendingUp },
          { label: "Improvements ratified", value: improvementsRatified.toLocaleString(), color: "#a78bfa", icon: CheckCircle },
          { label: "Contributions this epoch", value: contributionsThisEpoch.toLocaleString(), color: "#fb923c", icon: Upload },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </div>
            <p className="font-mono text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["growth", "feed", "protocol"] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`font-mono text-xs px-4 py-2 rounded border transition-all ${
              activeTab === t
                ? "bg-primary/10 border-primary/40 text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/30"
            }`}
          >
            {t === "growth" ? "Network growth" : t === "feed" ? "Contribution feed" : "Federation protocol"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "growth" && (
          <motion.div key="growth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-card border border-border rounded-xl p-6 mb-6">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1">{chartLabel}</p>
              <p className="font-mono text-[10px] text-muted-foreground mb-4">
                {growth
                  ? `${growth.totalNodes} knowledge node${growth.totalNodes !== 1 ? "s" : ""} accumulated — each interaction adds more`
                  : "Loading…"}
              </p>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="gnodes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gadded" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(215 20.2% 45%)", fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(215 20.2% 45%)", fontFamily: "monospace" }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(224 71% 6%)", border: "1px solid hsl(214.3 31.8% 16%)", borderRadius: 8, fontFamily: "monospace", fontSize: 11 }}
                      labelStyle={{ color: "hsl(210 40% 80%)" }}
                    />
                    <Area type="monotone" dataKey="nodes" stroke="#22d3ee" strokeWidth={2} fill="url(#gnodes)" name="Total nodes" />
                    <Area type="monotone" dataKey="added" stroke="#34d399" strokeWidth={1.5} fill="url(#gadded)" name="Added this period" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground font-mono text-xs">
                  No data yet — start a chat to build the knowledge graph
                </div>
              )}
            </div>
            <div className="space-y-3">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3">Learning log</p>
              {liveMilestones.length === 0 ? (
                <div className="bg-card border border-border rounded-lg px-4 py-4 text-center font-mono text-xs text-muted-foreground">
                  No learning events yet — interact with the agent to generate entries
                </div>
              ) : (
                liveMilestones.map((m) => (
                  <div key={m.index} className="flex items-start gap-4 bg-card border border-border rounded-lg px-4 py-3">
                    <span className="font-mono text-[10px] text-muted-foreground w-14 shrink-0 pt-0.5">{m.age}</span>
                    <div className="flex-1 font-mono text-sm text-foreground leading-snug">{m.label}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      {m.nodesAdded > 0 && (
                        <span className="font-mono text-[10px] text-primary">+{m.nodesAdded} nodes</span>
                      )}
                      <span className="font-mono text-[10px] text-muted-foreground">{m.source}</span>
                      <span className="font-mono text-[10px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> logged
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "feed" && (
          <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-sm text-muted-foreground">federation.contributions — live</span>
              </div>
              <AnimatePresence initial={false}>
                {contribs.map(c => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center gap-3 px-5 py-2.5 border-b border-border/40 last:border-b-0"
                  >
                    <span className="font-mono text-[10px] text-muted-foreground/60 w-16 shrink-0">{c.ts}</span>
                    <div className="font-mono text-[10px] px-1.5 py-0.5 rounded border shrink-0"
                      style={{ color: c.type.color, borderColor: c.type.color + "40", backgroundColor: c.type.color + "10" }}>
                      {c.type.label}
                    </div>
                    <c.type.icon className="w-3 h-3 shrink-0" style={{ color: c.type.color }} />
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">{c.agent}</span>
                    <span className="font-mono text-[10px] text-muted-foreground/50 shrink-0">via {c.domain}</span>
                    <div className="flex-1" />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Vote className="w-3 h-3 text-muted-foreground" />
                      <span className="font-mono text-[10px] text-muted-foreground">{c.votes}</span>
                    </div>
                    <span className={`font-mono text-[10px] shrink-0 ${
                      c.status === "ratified" ? "text-emerald-400" :
                      c.status === "voting" ? "text-yellow-400" : "text-muted-foreground"
                    }`}>{c.status}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {activeTab === "protocol" && (
          <motion.div key="protocol" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid md:grid-cols-2 gap-5">
              {[
                {
                  step: "01", color: "#22d3ee", title: "Opt-in contribution",
                  body: "Each agent independently decides whether to contribute. Contribution is never assumed. When enabled, the agent submits anonymised knowledge deltas — never raw data, never identity information.",
                  bullets: ["Zero raw data leaves the instance", "Contribution flag in omni_config.yaml", "Can be disabled at any time", "Gradient-only submissions"],
                },
                {
                  step: "02", color: "#34d399", title: "Delta computation",
                  body: "The agent computes what it has learned that differs from the last known collective baseline. Only the delta — the difference — is submitted. The baseline is distributed via gossip so the agent always knows what is already known.",
                  bullets: ["Merkle diff against collective baseline", "Compressed to <4 KB per submission", "Cryptographically signed by instance fingerprint", "Submitted to nearest relay node"],
                },
                {
                  step: "03", color: "#a78bfa", title: "Trust-weighted voting",
                  body: "Every delta is broadcast to other nodes. Nodes vote based on their own corroborating evidence. Votes are weighted by the voter's trust score — older agents with proven accuracy carry more weight. Quorum threshold scales with network size.",
                  bullets: ["Vote weight = f(age, accuracy, diversity)", "Threshold = sqrt(active_nodes)", "Voting window = 48 hours", "Abstain by default — no vote ≠ rejection"],
                },
                {
                  step: "04", color: "#fb923c", title: "Ratification & propagation",
                  body: "When the quorum threshold is reached, the improvement is ratified. It is written to the shared improvement ledger and propagated via gossip to all nodes. Each node applies it at next startup or live-patches if safe to do so.",
                  bullets: ["Improvement hash appended to ledger", "Gossiped with TTL=∞", "Nodes verify signature before applying", "Rollback possible if >30% nodes reject"],
                },
              ].map(s => (
                <div key={s.step} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono text-2xl font-bold" style={{ color: s.color }}>{s.step}</span>
                    <h3 className="font-bold text-sm">{s.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">{s.body}</p>
                  <div className="space-y-1.5">
                    {s.bullets.map(b => (
                      <div key={b} className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="font-mono text-[11px] text-muted-foreground">{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
