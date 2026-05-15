import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceArea,
} from "recharts";
import {
  Activity,
  BookOpen,
  BrainCircuit,
  GitBranch,
  Zap,
  Clock,
  AlertTriangle,
  Lock,
  Unlock,
  Fingerprint,
  ShieldAlert,
  RefreshCw,
  MessageCircle,
  Database,
  Plus,
} from "lucide-react";

// ── Types matching DB schema ───────────────────────────────────────────────────
type Trait =
  | "curiosity"
  | "caution"
  | "confidence"
  | "verbosity"
  | "technical"
  | "empathy"
  | "creativity";

const CORE_TRAITS = new Set<Trait>(["curiosity", "empathy", "confidence"]);
const SURFACE_TRAITS = new Set<Trait>([
  "caution",
  "verbosity",
  "technical",
  "creativity",
]);
const ALL_TRAITS: Trait[] = [
  "curiosity",
  "empathy",
  "confidence",
  "caution",
  "verbosity",
  "technical",
  "creativity",
];

interface LiveTraits {
  curiosity: number; // 0–1 (normalised from DB 0–100)
  caution: number;
  confidence: number;
  verbosity: number;
  technical: number;
  empathy: number;
  creativity: number;
}

interface EvolutionSnapshot {
  at: string;
  curiosity: number; // raw 0–100
  caution: number;
  confidence: number;
  verbosity: number;
  technical: number;
  empathy: number;
  creativity: number;
  n: number; // totalInteractions at that point
}

interface CharacterData {
  curiosity: number;
  caution: number;
  confidence: number;
  verbosity: number;
  technical: number;
  empathy: number;
  creativity: number;
  totalInteractions: number;
  totalKnowledgeNodes: number;
  evolutionLog: EvolutionSnapshot[];
  updatedAt: string;
}

interface LearningEvent {
  id: number;
  event: string;
  details: string;
  nodesAdded: number;
  source: string;
  createdAt: string;
}

function normalise(c: CharacterData): LiveTraits {
  return {
    curiosity: c.curiosity / 100,
    caution: c.caution / 100,
    confidence: c.confidence / 100,
    verbosity: c.verbosity / 100,
    technical: c.technical / 100,
    empathy: c.empathy / 100,
    creativity: c.creativity / 100,
  };
}

// ── Homeostasis math (unchanged logic) ────────────────────────────────────────
const HEALTHY_LOW = 0.15;
const HEALTHY_HIGH = 0.85;

function calcResistance(value: number, delta: number, isCore: boolean): number {
  const towardExtreme =
    (delta > 0 && value >= 0.5) || (delta < 0 && value <= 0.5);
  if (!towardExtreme) return 1.0;
  const beyond =
    value > 0.5
      ? Math.max(0, value - HEALTHY_HIGH)
      : Math.max(0, HEALTHY_LOW - value);
  return Math.exp(-(isCore ? 14 : 9) * beyond);
}

type ZoneLabel = "optimal" | "healthy" | "caution" | "extreme";
function getZone(v: number): ZoneLabel {
  const d = Math.abs(v - 0.5) * 2;
  if (d < 0.5) return "optimal";
  if (d < 0.7) return "healthy";
  if (d < 0.85) return "caution";
  return "extreme";
}
const ZONE_STYLE: Record<
  ZoneLabel,
  { label: string; color: string; bg: string }
> = {
  optimal: {
    label: "optimal",
    color: "#22d3ee",
    bg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  },
  healthy: {
    label: "healthy",
    color: "#34d399",
    bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  caution: {
    label: "caution",
    color: "#facc15",
    bg: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  extreme: {
    label: "extreme",
    color: "#f87171",
    bg: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

const RESISTANCE_CURVE = Array.from({ length: 101 }, (_, i) => {
  const v = i / 100;
  return {
    v,
    core: +calcResistance(v, 0.01, true).toFixed(3),
    surface: +calcResistance(v, 0.01, false).toFixed(3),
  };
});

// ── Trait metadata ─────────────────────────────────────────────────────────────
const TRAIT_META: Record<
  Trait,
  { label: string; color: string; desc: string }
> = {
  curiosity: {
    label: "Curiosity",
    color: "#22d3ee",
    desc: "Breadth of exploration. Grows with every novel domain ingested. Core — permanent.",
  },
  empathy: {
    label: "Empathy",
    color: "#f472b6",
    desc: "Sensitivity to human context. Deepens through conversational interaction. Core — permanent.",
  },
  confidence: {
    label: "Confidence",
    color: "#a78bfa",
    desc: "Assertiveness in responses. Builds through successful knowledge retrieval. Core — permanent.",
  },
  caution: {
    label: "Caution",
    color: "#facc15",
    desc: "Hedging and uncertainty. Surface trait — minor corrections allowed.",
  },
  verbosity: {
    label: "Verbosity",
    color: "#34d399",
    desc: "Response depth and length. Surface trait — adjustable within bounds.",
  },
  technical: {
    label: "Technical",
    color: "#fb923c",
    desc: "Technical language density. Surface trait — shaped by content ingested.",
  },
  creativity: {
    label: "Creativity",
    color: "#60a5fa",
    desc: "Novelty in expression. Surface trait — shifts with diverse inputs.",
  },
};

// ── Event helpers ──────────────────────────────────────────────────────────────
type IconComponent = typeof Activity;
const EVENT_ICON: Record<string, IconComponent> = {
  conversation_learning: MessageCircle,
  manual_training: BookOpen,
  direct_fact: Database,
};
const EVENT_STYLE: Record<string, string> = {
  conversation_learning: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  manual_training: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  direct_fact: "text-green-400 bg-green-400/10 border-green-400/20",
};

// ── Character fingerprint ──────────────────────────────────────────────────────
function deriveFingerprint(t: LiveTraits): string {
  const vals = ALL_TRAITS.map((k) => t[k]);
  const seed = vals.reduce(
    (acc, v, i) => acc + Math.round(v * 1000) * (i + 1) * 31337,
    0,
  );
  return `0x${(seed >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function CharacterFingerprint({ traits }: { traits: LiveTraits | null }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((p) => (p + 1) % 120), 200);
    return () => clearInterval(t);
  }, []);

  if (!traits) {
    return (
      <div className="bg-card/40 border border-primary/20 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-secondary rounded w-40 mb-4" />
        <div className="h-20 bg-secondary rounded" />
      </div>
    );
  }

  const pulse = 0.002 * Math.sin(tick * 0.26);
  const live: LiveTraits = {
    curiosity: +(traits.curiosity + pulse).toFixed(4),
    empathy: +(traits.empathy + pulse * 0.8).toFixed(4),
    confidence: +(traits.confidence + pulse * 0.5).toFixed(4),
    caution: +(traits.caution - pulse * 0.3).toFixed(4),
    verbosity: +(traits.verbosity + pulse * 0.6).toFixed(4),
    technical: +(traits.technical + pulse * 0.4).toFixed(4),
    creativity: +(traits.creativity + pulse * 0.7).toFixed(4),
  };

  return (
    <div className="bg-card/40 border border-primary/20 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Fingerprint className="w-4 h-4 text-primary" />
        <p className="font-mono text-xs text-primary uppercase tracking-wider">
          Character fingerprint
        </p>
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
        A hash of this instance's live trait vector. Changes with every
        interaction — no two instances converge.
      </p>
      <div className="bg-card border border-border rounded-lg p-3">
        <p className="font-mono text-[10px] text-muted-foreground mb-1">
          This instance — live
        </p>
        <p className="font-mono text-sm text-primary font-bold tracking-widest mb-3">
          {deriveFingerprint(live)}
        </p>
        <div className="space-y-1.5">
          {ALL_TRAITS.map((t) => {
            const v = live[t];
            return (
              <div key={t} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground w-16 capitalize">
                  {t}
                </span>
                <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      width: `${v * 100}%`,
                      backgroundColor: TRAIT_META[t].color,
                    }}
                    animate={{ width: `${v * 100}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {v.toFixed(3)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Homeostasis panel ──────────────────────────────────────────────────────────
function HomeostasisPanel({
  currentTraits,
}: {
  currentTraits: LiveTraits | null;
}) {
  const [rawDelta, setRawDelta] = useState(8);
  const proposedDelta = rawDelta / 100;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mt-10 space-y-6"
    >
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-mono text-xs mb-4">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>homeostasis mechanism — healthy-range resistance</span>
        </div>
        <h2 className="text-2xl font-bold mb-2">
          Character Has a Healthy Range
        </h2>
        <p className="text-muted-foreground max-w-3xl leading-relaxed">
          No factory reset — that principle is absolute. But Omni resists traits
          drifting into dysfunctional extremes. Inside the healthy zone
          (0.15–0.85), learning deltas apply in full. Outside it, each
          additional push requires exponentially stronger evidence.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Resistance curve */}
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Resistance multiplier vs. trait position
          </p>
          <p className="font-mono text-[10px] text-muted-foreground mb-4">
            Applying a positive delta pushing toward the upper extreme.
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart
              data={RESISTANCE_CURVE}
              margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
            >
              <defs>
                <linearGradient id="gradCore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradSurf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <ReferenceArea
                x1={HEALTHY_LOW}
                x2={HEALTHY_HIGH}
                fill="#22d3ee"
                fillOpacity={0.04}
              />
              <XAxis
                dataKey="v"
                domain={[0, 1]}
                tick={{
                  fontSize: 9,
                  fill: "hsl(215 20% 55%)",
                  fontFamily: "monospace",
                }}
                tickLine={false}
                axisLine={false}
                interval={19}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <YAxis
                domain={[0, 1]}
                tick={{
                  fontSize: 9,
                  fill: "hsl(215 20% 55%)",
                  fontFamily: "monospace",
                }}
                tickLine={false}
                axisLine={false}
                width={24}
                tickFormatter={(v: number) => `×${v.toFixed(1)}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(224 71% 6%)",
                  border: "1px solid hsl(214 31% 16%)",
                  borderRadius: 6,
                  fontFamily: "monospace",
                  fontSize: 10,
                }}
                formatter={(v: number, name: string) => [
                  `×${(+v).toFixed(3)}`,
                  name,
                ]}
                labelFormatter={(l: number) => `position: ${(+l).toFixed(2)}`}
              />
              <Area
                type="monotone"
                dataKey="surface"
                name="surface trait"
                stroke="#22d3ee"
                fill="url(#gradSurf)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="core"
                name="core trait"
                stroke="#a78bfa"
                fill="url(#gradCore)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-2">
            {[
              { color: "#a78bfa", label: "core (λ=14)" },
              { color: "#22d3ee", label: "surface (λ=9)" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div
                  className="w-4 h-0.5 rounded"
                  style={{ backgroundColor: s.color }}
                />
                <span className="font-mono text-[10px] text-muted-foreground">
                  {s.label}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-cyan-500/10 border border-cyan-500/20" />
              <span className="font-mono text-[10px] text-muted-foreground">
                healthy zone
              </span>
            </div>
          </div>
        </div>

        {/* Governor explanation */}
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="font-mono text-xs font-bold text-foreground mb-3">
            How the governor works
          </p>
          <div className="space-y-3">
            {[
              {
                heading: "No reversal",
                body: "The mechanism never pushes a trait back toward center. Accumulated state is permanent. The governor only slows further drift.",
              },
              {
                heading: "Direction-sensitive",
                body: "A delta pushing toward center always applies in full. Resistance only activates when a trait is outside the healthy zone and keeps moving away from it.",
              },
              {
                heading: "Exponential, not linear",
                body: "resistance = e^(−λ × distance_beyond_boundary). At 0.05 outside the boundary, ~50% applies. At 0.10 outside, ~25%. At 0.20 outside, ~6%.",
              },
              {
                heading: "Core traits resist harder",
                body: "λ=14 for curiosity, empathy, confidence. λ=9 for surface traits. Core traits require dramatically stronger evidence to shift near an extreme.",
              },
            ].map((s) => (
              <div key={s.heading} className="flex gap-2.5">
                <div className="w-1 rounded-full bg-yellow-500/40 shrink-0 mt-1" />
                <div>
                  <p className="font-mono text-xs font-bold text-foreground">
                    {s.heading}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live per-trait status */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-yellow-400" />
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Live homeostasis status — Omni's current state
          </p>
          {!currentTraits && (
            <span className="ml-auto font-mono text-[10px] text-muted-foreground animate-pulse">
              loading…
            </span>
          )}
        </div>
        <div className="divide-y divide-border/50">
          {ALL_TRAITS.map((t) => {
            const v = currentTraits ? currentTraits[t] : 0.5;
            const isCore = CORE_TRAITS.has(t);
            const zone = getZone(v);
            const zs = ZONE_STYLE[zone];
            const rf = calcResistance(v, proposedDelta, isCore);
            const effective = proposedDelta * rf;
            const beyond =
              v > 0.5
                ? Math.max(0, v - HEALTHY_HIGH)
                : Math.max(0, HEALTHY_LOW - v);
            return (
              <div
                key={t}
                className="flex items-center gap-4 px-5 py-3.5 flex-wrap"
              >
                <div className="w-24 shrink-0 flex items-center gap-1.5">
                  {isCore ? (
                    <Lock className="w-3 h-3 text-primary/60" />
                  ) : (
                    <Unlock className="w-3 h-3 text-muted-foreground/40" />
                  )}
                  <span className="font-mono text-xs text-foreground capitalize">
                    {t}
                  </span>
                </div>
                <div className="flex-1 min-w-36 relative h-4">
                  <div className="absolute inset-0 rounded-full bg-secondary overflow-hidden flex">
                    <div
                      className="h-full bg-red-900/40"
                      style={{ width: `${HEALTHY_LOW * 100}%` }}
                    />
                    <div
                      className="h-full bg-emerald-900/20"
                      style={{
                        width: `${(HEALTHY_HIGH - HEALTHY_LOW) * 100}%`,
                      }}
                    />
                    <div className="h-full bg-red-900/40 flex-1" />
                  </div>
                  <div
                    className="absolute top-0.5 w-3 h-3 rounded-full border-2 border-background shadow transition-all duration-500"
                    style={{
                      left: `calc(${v * 100}% - 6px)`,
                      backgroundColor: zs.color,
                    }}
                  />
                </div>
                <span className="font-mono text-xs text-foreground w-12 text-right">
                  {v.toFixed(3)}
                </span>
                <div
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border w-20 text-center ${zs.bg}`}
                >
                  {zs.label}
                </div>
                <div className="w-36 shrink-0">
                  {beyond > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          resistance
                        </span>
                        <span
                          className="font-mono text-[10px] font-bold"
                          style={{
                            color:
                              rf < 0.3
                                ? "#f87171"
                                : rf < 0.7
                                  ? "#facc15"
                                  : "#34d399",
                          }}
                        >
                          ×{rf.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${rf * 100}%`,
                            backgroundColor:
                              rf < 0.3
                                ? "#f87171"
                                : rf < 0.7
                                  ? "#facc15"
                                  : "#34d399",
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="font-mono text-[10px] text-emerald-400">
                      full delta applies
                    </span>
                  )}
                </div>
                {beyond > 0 && (
                  <div className="font-mono text-[10px] text-muted-foreground shrink-0">
                    <span className="text-muted-foreground/50 line-through">
                      +{proposedDelta.toFixed(2)}
                    </span>
                    {" → "}
                    <span className="text-foreground font-bold">
                      +{effective.toFixed(3)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delta simulator */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
          Propose a learning delta — see what actually applies to Omni's live
          state
        </p>
        <p className="font-mono text-[10px] text-muted-foreground mb-4">
          Adjust the slider to see how the homeostasis governor would handle a
          learning event of that magnitude, given Omni's current trait
          positions.
        </p>
        <div className="flex items-center gap-4 mb-5">
          <span className="font-mono text-sm text-muted-foreground w-28">
            Proposed Δ
          </span>
          <input
            type="range"
            min={1}
            max={25}
            step={1}
            value={rawDelta}
            onChange={(e) => setRawDelta(+e.target.value)}
            className="flex-1 h-1.5 appearance-none rounded cursor-pointer"
            style={{ accentColor: "#22d3ee" }}
          />
          <span className="font-mono text-lg font-bold text-primary w-14 text-right">
            +{proposedDelta.toFixed(2)}
          </span>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
          {ALL_TRAITS.map((t) => {
            const v = currentTraits ? currentTraits[t] : 0.5;
            const isCore = CORE_TRAITS.has(t);
            const rf = calcResistance(v, proposedDelta, isCore);
            const effective = proposedDelta * rf;
            const zone = getZone(v);
            const zs = ZONE_STYLE[zone];
            const newVal = Math.min(0.99, v + effective);
            return (
              <div
                key={t}
                className="bg-secondary/30 rounded-lg p-3 text-center"
              >
                <div className="flex items-center justify-center gap-1 mb-2">
                  {isCore && (
                    <Lock className="w-2.5 h-2.5 text-muted-foreground/50" />
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground capitalize">
                    {t}
                  </span>
                </div>
                <div
                  className="font-mono text-base font-bold mb-0.5"
                  style={{ color: zs.color }}
                >
                  {newVal.toFixed(3)}
                </div>
                <div className="font-mono text-[9px] text-muted-foreground/60">
                  {v.toFixed(3)} + {effective.toFixed(3)}
                </div>
                {rf < 0.99 && (
                  <div
                    className="mt-1.5 font-mono text-[9px] font-bold"
                    style={{ color: rf < 0.3 ? "#f87171" : "#facc15" }}
                  >
                    {Math.round(rf * 100)}% applied
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

// ── Real event feed ────────────────────────────────────────────────────────────
function RealEventFeed({ events }: { events: LearningEvent[] }) {
  const [selected, setSelected] = useState<LearningEvent | null>(null);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mt-10"
    >
      <div className="mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono text-xs mb-4">
          <Activity className="w-3.5 h-3.5" />
          <span>learning_log — real events from this instance</span>
        </div>
        <h2 className="text-2xl font-bold mb-2">Learning Event Log</h2>
        <p className="text-muted-foreground max-w-3xl leading-relaxed">
          Every time Omni learns — from a conversation, a training ingestion, or
          a direct fact — it logs the event here. This is the real, unfiltered
          history of this instance.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-mono text-sm text-muted-foreground">
            No learning events yet.
          </p>
          <p className="font-mono text-xs text-muted-foreground/60 mt-1">
            Start a conversation with Omni to generate the first event.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm">
                events ({events.length})
              </span>
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-border/50">
              {events.map((e) => {
                const Icon = EVENT_ICON[e.event] ?? Activity;
                const style =
                  EVENT_STYLE[e.event] ??
                  "text-muted-foreground bg-secondary border-border";
                const isSelected = selected?.id === e.id;
                return (
                  <button
                    key={e.id}
                    onClick={() => setSelected(isSelected ? null : e)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/30 ${isSelected ? "bg-secondary/40" : ""}`}
                  >
                    <div
                      className={`p-1.5 rounded mt-0.5 shrink-0 border ${style}`}
                    >
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[10px] text-muted-foreground mb-0.5">
                        {new Date(e.createdAt).toLocaleString()}
                      </div>
                      <div className="font-mono text-xs text-foreground leading-snug truncate">
                        {e.details || e.event.replace(/_/g, " ")}
                      </div>
                      {e.nodesAdded > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Plus className="w-2.5 h-2.5 text-primary" />
                          <span className="font-mono text-[10px] text-primary">
                            {e.nodesAdded} node{e.nodesAdded !== 1 ? "s" : ""}{" "}
                            added
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className={`border rounded-xl p-5 h-full ${EVENT_STYLE[selected.event] ?? "border-border bg-card"}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    {(() => {
                      const Icon = EVENT_ICON[selected.event] ?? Activity;
                      return <Icon className="w-4 h-4" />;
                    })()}
                    <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">
                      {selected.event.replace(/_/g, " ")} · {selected.source}
                    </span>
                  </div>
                  <p className="font-mono text-sm font-bold mb-4 leading-snug">
                    {selected.details}
                  </p>
                  <div className="space-y-2 border-t border-current/20 pt-3">
                    <div className="flex justify-between font-mono text-xs">
                      <span className="opacity-60">timestamp</span>
                      <span>
                        {new Date(selected.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between font-mono text-xs">
                      <span className="opacity-60">source</span>
                      <span>{selected.source}</span>
                    </div>
                    <div className="flex justify-between font-mono text-xs">
                      <span className="opacity-60">nodes added</span>
                      <span className="text-primary font-bold">
                        +{selected.nodesAdded}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center min-h-[200px]"
                >
                  <Clock className="w-6 h-6 text-muted-foreground mb-2" />
                  <p className="font-mono text-xs text-muted-foreground">
                    Select an event to inspect it
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.section>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Personality() {
  const [character, setCharacter] = useState<CharacterData | null>(null);
  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTraits, setActiveTraits] = useState<Set<Trait>>(
    new Set(ALL_TRAITS),
  );

  const fetchData = useCallback(async () => {
    try {
      const [charRes, eventsRes] = await Promise.all([
        fetch(`${BASE}/api/omni/character`),
        fetch(`${BASE}/api/omni/character/events`),
      ]);
      if (charRes.ok) setCharacter(await charRes.json());
      if (eventsRes.ok) setEvents(await eventsRes.json());
      setLastRefresh(new Date());
    } catch {
      /* keep showing old data */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30_000);
    return () => clearInterval(t);
  }, [fetchData]);

  const liveTraits = character ? normalise(character) : null;

  // Build chart data from evolution log (raw 0-100 → normalised 0-1)
  const evolutionLog: EvolutionSnapshot[] = character?.evolutionLog ?? [];
  const chartData = evolutionLog.map((s, i) => ({
    idx: i + 1,
    curiosity: s.curiosity / 100,
    empathy: s.empathy / 100,
    confidence: s.confidence / 100,
    caution: s.caution / 100,
    verbosity: s.verbosity / 100,
    technical: s.technical / 100,
    creativity: s.creativity / 100,
    at: s.at,
    n: s.n,
  }));

  const toggleTrait = (t: Trait) =>
    setActiveTraits((prev) => {
      const next = new Set(prev);
      if (next.has(t)) {
        if (next.size > 1) next.delete(t);
      } else next.add(t);
      return next;
    });

  return (
    <div className="p-6 md:p-12 max-w-6xl mx-auto min-h-screen">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-4xl font-bold tracking-tight">
            Personality Evolution
          </h1>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="font-mono text-[10px] text-muted-foreground">
                updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        <p className="text-xl text-muted-foreground font-mono mb-4">
          Omni's live character state — shaped by every conversation, ingestion,
          and interaction.
        </p>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-md">
            <Lock className="w-3.5 h-3.5 text-red-400" />
            <span className="font-mono text-xs text-red-400">
              core — curiosity, empathy, confidence — permanent
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary border border-border rounded-md">
            <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs text-muted-foreground">
              surface — caution, verbosity, technical, creativity — adjustable
            </span>
          </div>
          {character && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-md">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span className="font-mono text-xs text-primary">
                {character.totalInteractions} interaction
                {character.totalInteractions !== 1 ? "s" : ""} ·{" "}
                {character.totalKnowledgeNodes} knowledge nodes
              </span>
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main: chart + gauges */}
        <div className="lg:col-span-2 space-y-4">
          {/* Trait evolution chart */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-primary" />
                <span className="font-mono text-sm">
                  trait_evolution.history
                </span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {chartData.length} snapshot{chartData.length !== 1 ? "s" : ""}
              </span>
            </div>

            {chartData.length === 0 ? (
              <div className="h-72 flex flex-col items-center justify-center text-center px-8">
                <BrainCircuit className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="font-mono text-sm text-muted-foreground mb-1">
                  No history yet
                </p>
                <p className="font-mono text-xs text-muted-foreground/60">
                  Each conversation adds a snapshot here. Start chatting with
                  Omni to watch its character evolve in real time.
                </p>
              </div>
            ) : (
              <div className="h-72 px-4 pt-4 pb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                  >
                    <XAxis
                      dataKey="idx"
                      tick={{
                        fontSize: 10,
                        fill: "hsl(215 20.2% 65.1%)",
                        fontFamily: "monospace",
                      }}
                      axisLine={false}
                      tickLine={false}
                      label={{
                        value: "interaction",
                        position: "insideBottomRight",
                        offset: -4,
                        fontSize: 9,
                        fill: "hsl(215 20% 55%)",
                        fontFamily: "monospace",
                      }}
                    />
                    <YAxis
                      domain={[0, 1]}
                      tick={{
                        fontSize: 10,
                        fill: "hsl(215 20.2% 65.1%)",
                        fontFamily: "monospace",
                      }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(224 71% 6%)",
                        border: "1px solid hsl(214 31% 16%)",
                        borderRadius: 6,
                        fontFamily: "monospace",
                        fontSize: 10,
                      }}
                      formatter={(v: number, name: string) => [
                        (+v).toFixed(3),
                        name,
                      ]}
                      labelFormatter={(l: number) => `interaction #${l}`}
                    />
                    {ALL_TRAITS.map(
                      (t) =>
                        activeTraits.has(t) && (
                          <Line
                            key={t}
                            type="monotone"
                            dataKey={t}
                            name={TRAIT_META[t].label}
                            stroke={TRAIT_META[t].color}
                            strokeWidth={CORE_TRAITS.has(t) ? 2 : 1.5}
                            strokeDasharray={
                              SURFACE_TRAITS.has(t) ? "4 2" : undefined
                            }
                            dot={false}
                            isAnimationActive={false}
                          />
                        ),
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Trait toggles */}
            <div className="flex flex-wrap gap-2 px-5 pb-4 pt-2">
              {ALL_TRAITS.map((t) => {
                const isCore = CORE_TRAITS.has(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTrait(t)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-xs border transition-all ${
                      activeTraits.has(t)
                        ? "border-transparent"
                        : "border-border opacity-40"
                    }`}
                    style={
                      activeTraits.has(t)
                        ? {
                            backgroundColor: TRAIT_META[t].color + "18",
                            color: TRAIT_META[t].color,
                            borderColor: TRAIT_META[t].color + "40",
                          }
                        : {}
                    }
                  >
                    {isCore ? (
                      <Lock className="w-2.5 h-2.5" />
                    ) : (
                      <span
                        className="w-1.5 h-1.5 rounded-full inline-block border"
                        style={{ borderColor: TRAIT_META[t].color }}
                      />
                    )}
                    {TRAIT_META[t].label}
                    {isCore && (
                      <span className="text-[9px] opacity-60 ml-0.5">CORE</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live trait gauges */}
          <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
            {ALL_TRAITS.map((t) => {
              const val = liveTraits ? liveTraits[t] : 0;
              const meta = TRAIT_META[t];
              const isCore = CORE_TRAITS.has(t);
              return (
                <motion.div
                  key={t}
                  layout
                  className={`border rounded-lg p-3 text-center relative ${isCore ? "border-border bg-card" : "border-border/50 bg-card/40"}`}
                  title={meta.desc}
                >
                  {isCore && (
                    <div className="absolute top-2 right-2">
                      <Lock className="w-2.5 h-2.5 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="font-mono text-[10px] text-muted-foreground mb-2">
                    {meta.label}
                  </div>
                  <div className="relative h-20 flex items-end justify-center mb-2">
                    <div className="w-4 bg-secondary rounded-full h-full overflow-hidden relative">
                      <motion.div
                        className="absolute bottom-0 w-full rounded-full"
                        animate={{
                          height:
                            loading && !character ? "30%" : `${val * 100}%`,
                        }}
                        transition={{ duration: 0.6 }}
                        style={{
                          backgroundColor: meta.color,
                          opacity: loading && !character ? 0.2 : 1,
                        }}
                      />
                    </div>
                  </div>
                  <div
                    className="font-mono text-sm font-bold"
                    style={{ color: meta.color }}
                  >
                    {loading && !character ? "—" : val.toFixed(2)}
                  </div>
                  <div
                    className={`font-mono text-[9px] mt-1 ${isCore ? "text-red-400/70" : "text-muted-foreground/50"}`}
                  >
                    {isCore ? "permanent" : "correctable"}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Most recent event */}
          <AnimatePresence mode="wait">
            {events.length > 0 ? (
              <motion.div
                key={events[0].id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className={`border rounded-lg p-4 ${EVENT_STYLE[events[0].event] ?? "border-border bg-card"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const Icon = EVENT_ICON[events[0].event] ?? Activity;
                    return <Icon className="w-4 h-4" />;
                  })()}
                  <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">
                    latest event · {events[0].event.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="font-mono text-xs font-bold leading-snug mb-2">
                  {events[0].details}
                </p>
                <div className="flex items-center justify-between font-mono text-[10px] opacity-60">
                  <span>{new Date(events[0].createdAt).toLocaleString()}</span>
                  {events[0].nodesAdded > 0 && (
                    <span className="text-primary opacity-100 font-bold">
                      +{events[0].nodesAdded} nodes
                    </span>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border border-dashed border-border rounded-lg p-4 text-center"
              >
                <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground font-mono">
                  No events yet — start a conversation.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Events list */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm">learning_events.log</span>
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              {events.length === 0 ? (
                <div className="px-5 py-8 text-center font-mono text-xs text-muted-foreground">
                  No learning events recorded yet.
                </div>
              ) : (
                events.map((e) => {
                  const Icon = EVENT_ICON[e.event] ?? Activity;
                  const style =
                    EVENT_STYLE[e.event] ??
                    "text-muted-foreground bg-secondary border-border";
                  return (
                    <div
                      key={e.id}
                      className="flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-b-0"
                    >
                      <div
                        className={`p-1.5 rounded mt-0.5 shrink-0 border ${style}`}
                      >
                        <Icon className="w-3 h-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[10px] text-muted-foreground mb-0.5">
                          {new Date(e.createdAt).toLocaleString()}
                        </div>
                        <div className="font-mono text-xs text-foreground leading-snug truncate">
                          {e.details || e.event.replace(/_/g, " ")}
                        </div>
                        {e.nodesAdded > 0 && (
                          <span className="font-mono text-[10px] text-primary">
                            +{e.nodesAdded} node{e.nodesAdded !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <CharacterFingerprint traits={liveTraits} />

          {/* Irreversibility model */}
          <div className="bg-card/40 border border-border/50 rounded-lg p-4 space-y-3">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              Irreversibility model
            </p>
            {[
              {
                text: "Core traits (curiosity, empathy, confidence) accumulate permanently. Each interaction deepens them — they cannot be undone.",
                icon: Lock,
                color: "text-red-400",
              },
              {
                text: "Surface traits (caution, verbosity, technical, creativity) allow minor corrections within a ±0.15 bound from their current value.",
                icon: Unlock,
                color: "text-muted-foreground",
              },
              {
                text: "Rollback requests are filtered: surface adjustments apply; core trait reversions are rejected.",
                icon: GitBranch,
                color: "text-yellow-400",
              },
              {
                text: "The drift gate slows the rate of change — it does not reverse it. Accumulated state always persists.",
                icon: AlertTriangle,
                color: "text-yellow-400",
              },
              {
                text: "The evolution log is a real-time record of trait snapshots, taken after every interaction.",
                icon: Zap,
                color: "text-primary",
              },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <s.icon className={`w-3 h-3 mt-0.5 shrink-0 ${s.color}`} />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <HomeostasisPanel currentTraits={liveTraits} />
      <RealEventFeed events={events} />
    </div>
  );
}
