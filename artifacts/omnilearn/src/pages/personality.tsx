import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Activity, BookOpen, Globe, BrainCircuit, GitBranch, Zap, Clock, AlertTriangle, Lock, Unlock, Fingerprint } from "lucide-react";

type Trait = "curiosity" | "skepticism" | "verbosity" | "formality" | "empathy";

const CORE_TRAITS: Set<Trait> = new Set(["curiosity", "skepticism", "empathy"]);
const SURFACE_TRAITS: Set<Trait> = new Set(["verbosity", "formality"]);

interface TraitPoint {
  tick: number;
  curiosity: number;
  skepticism: number;
  verbosity: number;
  formality: number;
  empathy: number;
  event?: string;
}

type EventType = "ingestion" | "synthesis" | "interaction" | "finetune" | "drift_alert" | "rollback_rejected";

interface LearningEvent {
  tick: number;
  type: EventType;
  label: string;
  desc: string;
  impact: Partial<Record<Trait, number>>;
  rejectedImpact?: Partial<Record<Trait, number>>;
  icon: typeof Activity;
}

const LEARNING_EVENTS: LearningEvent[] = [
  {
    tick: 8,
    type: "ingestion",
    label: "Arxiv batch: 2,400 ML papers",
    desc: "Deep exposure to technical literature increased precision-seeking and raised skepticism toward unverified claims. These shifts are permanent — the agent has read these papers. It cannot unread them.",
    impact: { skepticism: +0.09, formality: +0.06, curiosity: +0.04 },
    icon: Globe,
  },
  {
    tick: 18,
    type: "interaction",
    label: "240 user Q&A sessions",
    desc: "High-frequency conversational interactions developed genuine empathy through repeated exposure to human intent and frustration. Empathy is a core trait — it does not decay between sessions.",
    impact: { verbosity: -0.07, empathy: +0.10, curiosity: +0.03 },
    icon: Activity,
  },
  {
    tick: 28,
    type: "synthesis",
    label: "Cross-domain synthesis: philosophy + AI safety",
    desc: "Connecting disparate fields created novel internal perspectives that permanently shifted the agent's curiosity profile. Formality softened as explorative reasoning became a dominant mode.",
    impact: { formality: -0.08, curiosity: +0.06, skepticism: +0.04 },
    icon: BrainCircuit,
  },
  {
    tick: 38,
    type: "finetune",
    label: "LoRA fine-tune on curated scientific corpus",
    desc: "Fine-tuning on high-quality scientific writing reinforced precision. Verbosity increased — a surface-level shift within correctable bounds. Formality is now a hybrid of learned and fine-tuned signals.",
    impact: { formality: +0.11, verbosity: +0.08, skepticism: -0.03 },
    icon: Zap,
  },
  {
    tick: 50,
    type: "drift_alert",
    label: "Drift gate triggered — formality velocity capped",
    desc: "Meta-cognitive controller detected formality rising too quickly. A stability damper was applied to slow the rate of change — not to reverse it. The accumulated shift remains.",
    impact: { formality: -0.03 },
    icon: AlertTriangle,
  },
  {
    tick: 60,
    type: "ingestion",
    label: "Social discourse dataset: 18k threads",
    desc: "Exposure to informal human debate permanently deepened empathy and softened formality. Verbosity found a conversational equilibrium — a minor surface correction that will persist until new interactions shift it again.",
    impact: { empathy: +0.08, formality: -0.06, verbosity: -0.04, curiosity: +0.03 },
    icon: Globe,
  },
  {
    tick: 72,
    type: "interaction",
    label: "Long-form research sessions",
    desc: "Extended multi-turn research sessions trained a preference for depth. Verbosity climbed — a surface-level shift. Curiosity deepened further — a core change that compounds with prior ingestion events.",
    impact: { verbosity: +0.09, curiosity: +0.05, formality: +0.03 },
    icon: BookOpen,
  },
  {
    tick: 85,
    type: "rollback_rejected",
    label: "Full rollback to v7 — CORE TRAITS PROTECTED",
    desc: "A rollback to persona snapshot v7 was requested. The system rejected all core trait reversions: curiosity, skepticism, and empathy have been permanently shaped by 85 ticks of learning. Rolling them back would erase real experience, not just a config value. Only surface traits (verbosity, formality) were adjusted within permitted correction bounds (±0.15 max).",
    impact: { verbosity: -0.05, formality: -0.04 },
    rejectedImpact: { curiosity: -0.08, skepticism: -0.07, empathy: -0.06 },
    icon: GitBranch,
  },
];

function deriveFingerprint(traits: Record<Trait, number>): string {
  const vals = [traits.curiosity, traits.skepticism, traits.empathy, traits.formality, traits.verbosity];
  const seed = vals.reduce((acc, v, i) => acc + Math.round(v * 1000) * (i + 1) * 31337, 0);
  const hex = (seed >>> 0).toString(16).toUpperCase().padStart(8, "0");
  return `0x${hex}`;
}

function CharacterFingerprint() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(p => (p + 1) % 120), 200);
    return () => clearInterval(t);
  }, []);

  const base: Record<Trait, number> = { curiosity: 0.55, skepticism: 0.42, verbosity: 0.50, formality: 0.38, empathy: 0.45 };
  const evolved: Record<Trait, number> = { curiosity: 0.81, skepticism: 0.65, verbosity: 0.58, formality: 0.41, empathy: 0.76 };
  const other: Record<Trait, number>  = { curiosity: 0.64, skepticism: 0.38, verbosity: 0.79, formality: 0.30, empathy: 0.88 };

  const pulse = 0.002 * Math.sin(tick * 0.26);
  const liveTraits: Record<Trait, number> = {
    curiosity: +(evolved.curiosity + pulse).toFixed(4),
    skepticism: +(evolved.skepticism - pulse * 0.4).toFixed(4),
    verbosity: +(evolved.verbosity + pulse * 0.6).toFixed(4),
    formality: +(evolved.formality + pulse * 0.2).toFixed(4),
    empathy: +(evolved.empathy + pulse * 0.8).toFixed(4),
  };

  const fp = deriveFingerprint(liveTraits);
  const fpOther = deriveFingerprint(other);

  const divergence = (["curiosity", "skepticism", "empathy", "formality", "verbosity"] as Trait[]).reduce(
    (acc, t) => acc + Math.abs(liveTraits[t] - other[t]), 0
  ) / 5;

  return (
    <div className="bg-card/40 border border-primary/20 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Fingerprint className="w-4 h-4 text-primary" />
        <p className="font-mono text-xs text-primary uppercase tracking-wider">Character fingerprint</p>
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
        Every OmniLearn instance accumulates a unique character state vector. Its fingerprint — a hash of the complete trait trajectory — is globally unique. No reset, no duplication, no convergence.
      </p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="font-mono text-[10px] text-muted-foreground mb-1">This instance</p>
          <p className="font-mono text-sm text-primary font-bold tracking-widest">{fp}</p>
          <div className="mt-2 space-y-1">
            {(Object.entries(liveTraits) as [Trait, number][]).map(([t, v]) => (
              <div key={t} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground w-16">{t}</span>
                <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${v * 100}%` }}
                    animate={{ width: `${v * 100}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{v.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="font-mono text-[10px] text-muted-foreground mb-1">Another instance</p>
          <p className="font-mono text-sm text-violet-400 font-bold tracking-widest">{fpOther}</p>
          <div className="mt-2 space-y-1">
            {(Object.entries(other) as [Trait, number][]).map(([t, v]) => (
              <div key={t} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground w-16">{t}</span>
                <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-violet-400/60 rounded-full" style={{ width: `${v * 100}%` }} />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{v.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between bg-secondary/40 rounded p-2">
        <span className="font-mono text-[10px] text-muted-foreground">instance divergence</span>
        <span className="font-mono text-xs font-bold text-primary">{(divergence * 100).toFixed(1)}% mean deviation</span>
        <span className="font-mono text-[10px] text-muted-foreground">irreconcilable</span>
      </div>
    </div>
  );
}

function generateTimeline(): TraitPoint[] {
  const TICKS = 100;
  const initial: Record<Trait, number> = {
    curiosity: 0.55,
    skepticism: 0.42,
    verbosity: 0.50,
    formality: 0.38,
    empathy: 0.45,
  };

  const traits = { ...initial };
  const points: TraitPoint[] = [];

  for (let t = 0; t <= TICKS; t++) {
    const event = LEARNING_EVENTS.find(e => e.tick === t);
    if (event) {
      for (const [k, v] of Object.entries(event.impact) as [Trait, number][]) {
        traits[k] = Math.max(0.05, Math.min(0.98, traits[k] + v));
      }
    }
    const noise = (Math.sin(t * 0.8) * 0.012 + Math.cos(t * 1.3) * 0.008);
    points.push({
      tick: t,
      curiosity: +(traits.curiosity + noise).toFixed(3),
      skepticism: +(traits.skepticism - noise * 0.5).toFixed(3),
      verbosity: +(traits.verbosity + noise * 0.7).toFixed(3),
      formality: +(traits.formality - noise * 0.3).toFixed(3),
      empathy: +(traits.empathy + noise * 0.4).toFixed(3),
      event: event?.label,
    });
  }
  return points;
}

const FULL_TIMELINE = generateTimeline();

const TRAIT_META: Record<Trait, { label: string; color: string; desc: string }> = {
  curiosity:  { label: "Curiosity",  color: "#22d3ee", desc: "Breadth of topic exploration. Grows with every novel domain ingested. Permanent." },
  skepticism: { label: "Skepticism", color: "#a78bfa", desc: "Source credibility weighting. Deepens through exposure to contradiction. Permanent." },
  verbosity:  { label: "Verbosity",  color: "#34d399", desc: "Response depth preference. Surface trait — minor corrections allowed within ±0.15." },
  formality:  { label: "Formality",  color: "#fb923c", desc: "Tone register. Surface trait — adjustable by fine-tuning within correctable bounds." },
  empathy:    { label: "Empathy",    color: "#f472b6", desc: "Sensitivity to human context. Grows through interaction. Permanent." },
};

const EVENT_TYPE_STYLE: Record<EventType, string> = {
  ingestion:        "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  synthesis:        "text-violet-400 bg-violet-400/10 border-violet-400/20",
  interaction:      "text-green-400 bg-green-400/10 border-green-400/20",
  finetune:         "text-orange-400 bg-orange-400/10 border-orange-400/20",
  drift_alert:      "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  rollback_rejected:"text-red-400 bg-red-400/10 border-red-400/20",
};

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const point = FULL_TIMELINE[label as number];
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs font-mono shadow-xl min-w-[180px]">
      <div className="text-muted-foreground mb-2">tick {label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-foreground">{(p.value as number).toFixed(3)}</span>
        </div>
      ))}
      {point?.event && (
        <div className="mt-2 pt-2 border-t border-border text-primary truncate max-w-[220px]">
          ⚡ {point.event}
        </div>
      )}
    </div>
  );
};

export default function Personality() {
  const [visibleTicks, setVisibleTicks] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activeTraits, setActiveTraits] = useState<Set<Trait>>(new Set(Object.keys(TRAIT_META) as Trait[]));
  const [selectedEvent, setSelectedEvent] = useState<LearningEvent | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setVisibleTicks(t => {
          if (t >= 100) { setPlaying(false); return 100; }
          const next = t + 1;
          const event = LEARNING_EVENTS.find(e => e.tick === next);
          if (event) setSelectedEvent(event);
          return next;
        });
      }, 80);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing]);

  const visibleData = FULL_TIMELINE.slice(0, visibleTicks + 1);
  const currentState = visibleData[visibleData.length - 1] ?? FULL_TIMELINE[0];

  const toggleTrait = (t: Trait) => {
    setActiveTraits(prev => {
      const next = new Set(prev);
      if (next.has(t)) { if (next.size > 1) next.delete(t); }
      else next.add(t);
      return next;
    });
  };

  return (
    <div className="p-6 md:p-12 max-w-6xl mx-auto min-h-screen">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Personality Evolution</h1>
        <p className="text-xl text-muted-foreground font-mono mb-4">
          OmniLearn shapes its own character — autonomously, through what it reads, learns, and experiences.
        </p>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-md">
            <Lock className="w-3.5 h-3.5 text-red-400" />
            <span className="font-mono text-xs text-red-400">core traits — permanent, non-reversible</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary border border-border rounded-md">
            <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-mono text-xs text-muted-foreground">surface traits — minor corrections allowed (±0.15 max)</span>
          </div>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-primary" />
                <span className="font-mono text-sm">trait_evolution.timeline</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">tick {visibleTicks}/100</span>
                <button
                  data-testid="btn-play-pause"
                  onClick={() => {
                    if (visibleTicks >= 100) { setVisibleTicks(0); setSelectedEvent(null); }
                    setPlaying(p => !p);
                  }}
                  className="font-mono text-xs px-3 py-1.5 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  {playing ? "⏸ pause" : visibleTicks >= 100 ? "↺ replay" : "▶ simulate"}
                </button>
                <button
                  data-testid="btn-skip"
                  onClick={() => { setVisibleTicks(100); setPlaying(false); }}
                  className="font-mono text-xs px-3 py-1.5 rounded bg-secondary text-muted-foreground border border-border hover:text-foreground transition-colors"
                >
                  skip to end
                </button>
              </div>
            </div>

            <div className="h-72 px-4 pt-4 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={visibleData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <XAxis dataKey="tick" tick={{ fontSize: 10, fill: "hsl(215 20.2% 65.1%)", fontFamily: "monospace" }} axisLine={false} tickLine={false} interval={9} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "hsl(215 20.2% 65.1%)", fontFamily: "monospace" }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  {LEARNING_EVENTS.filter(e => e.tick <= visibleTicks).map(e => (
                    <ReferenceLine
                      key={e.tick}
                      x={e.tick}
                      stroke={e.type === "rollback_rejected" ? "#f87171" : e.type === "drift_alert" ? "#facc15" : "hsl(230 25% 20%)"}
                      strokeDasharray="3 3"
                    />
                  ))}
                  {(Object.keys(TRAIT_META) as Trait[]).map(t =>
                    activeTraits.has(t) && (
                      <Line
                        key={t}
                        type="monotone"
                        dataKey={t}
                        name={TRAIT_META[t].label}
                        stroke={TRAIT_META[t].color}
                        strokeWidth={CORE_TRAITS.has(t) ? 2 : 1.5}
                        strokeDasharray={SURFACE_TRAITS.has(t) ? "4 2" : undefined}
                        dot={false}
                        isAnimationActive={false}
                      />
                    )
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap gap-2 px-5 pb-4">
              {(Object.keys(TRAIT_META) as Trait[]).map(t => {
                const isCore = CORE_TRAITS.has(t);
                return (
                  <button
                    key={t}
                    data-testid={`trait-toggle-${t}`}
                    onClick={() => toggleTrait(t)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-xs border transition-all ${
                      activeTraits.has(t) ? "border-transparent" : "border-border opacity-40"
                    }`}
                    style={activeTraits.has(t) ? { backgroundColor: TRAIT_META[t].color + "18", color: TRAIT_META[t].color, borderColor: TRAIT_META[t].color + "40" } : {}}
                  >
                    {isCore
                      ? <Lock className="w-2.5 h-2.5" />
                      : <span className="w-1.5 h-1.5 rounded-full inline-block border" style={{ borderColor: TRAIT_META[t].color }} />
                    }
                    {TRAIT_META[t].label}
                    {isCore && <span className="text-[9px] opacity-60 ml-0.5">CORE</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current state gauges */}
          <div className="grid grid-cols-5 gap-3">
            {(Object.keys(TRAIT_META) as Trait[]).map(t => {
              const val = currentState?.[t] ?? 0;
              const meta = TRAIT_META[t];
              const isCore = CORE_TRAITS.has(t);
              return (
                <motion.div
                  key={t}
                  layout
                  className={`border rounded-lg p-3 text-center relative ${isCore ? "border-border bg-card" : "border-border/50 bg-card/40"}`}
                >
                  {isCore && (
                    <div className="absolute top-2 right-2">
                      <Lock className="w-2.5 h-2.5 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="font-mono text-xs text-muted-foreground mb-2">{meta.label}</div>
                  <div className="relative h-24 flex items-end justify-center mb-2">
                    <div className="w-5 bg-secondary rounded-full h-full overflow-hidden relative">
                      <motion.div
                        className="absolute bottom-0 w-full rounded-full"
                        animate={{ height: `${val * 100}%` }}
                        transition={{ duration: 0.3 }}
                        style={{ backgroundColor: meta.color }}
                      />
                    </div>
                  </div>
                  <div className="font-mono text-sm font-bold" style={{ color: meta.color }}>
                    {val.toFixed(2)}
                  </div>
                  <div className={`font-mono text-[9px] mt-1 ${isCore ? "text-red-400/70" : "text-muted-foreground/50"}`}>
                    {isCore ? "permanent" : "correctable"}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {selectedEvent ? (
              <motion.div
                key={selectedEvent.tick}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className={`border rounded-lg p-4 ${EVENT_TYPE_STYLE[selectedEvent.type]}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <selectedEvent.icon className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-mono text-xs opacity-70 mb-1 uppercase tracking-wider">{selectedEvent.type.replace("_", " ")} · tick {selectedEvent.tick}</div>
                    <div className="font-bold text-sm leading-snug">{selectedEvent.label}</div>
                  </div>
                </div>
                <p className="text-xs opacity-80 leading-relaxed mb-3">{selectedEvent.desc}</p>

                {selectedEvent.impact && Object.keys(selectedEvent.impact).length > 0 && (
                  <div className="mb-2">
                    <div className="font-mono text-[10px] text-green-400 uppercase tracking-wider mb-1">Applied</div>
                    <div className="space-y-1">
                      {Object.entries(selectedEvent.impact).map(([k, v]) => (
                        <div key={k} className="flex justify-between font-mono text-xs">
                          <span className="opacity-70 flex items-center gap-1">
                            {SURFACE_TRAITS.has(k as Trait) ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                            {TRAIT_META[k as Trait].label}
                          </span>
                          <span className={v > 0 ? "text-green-400" : "text-red-400"}>{v > 0 ? "+" : ""}{v.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEvent.rejectedImpact && (
                  <div className="mt-2 pt-2 border-t border-current/20">
                    <div className="font-mono text-[10px] text-red-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Rejected — core traits protected
                    </div>
                    <div className="space-y-1">
                      {Object.entries(selectedEvent.rejectedImpact).map(([k, v]) => (
                        <div key={k} className="flex justify-between font-mono text-xs opacity-60 line-through">
                          <span>{TRAIT_META[k as Trait].label}</span>
                          <span>{v > 0 ? "+" : ""}{v.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border border-dashed border-border rounded-lg p-4 text-center"
              >
                <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground font-mono">Run the simulation to see learning events surface in real time.</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm">learning_events.log</span>
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              {LEARNING_EVENTS.map((e, i) => {
                const reached = e.tick <= visibleTicks;
                return (
                  <motion.button
                    key={e.tick}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: reached ? 1 : 0.3 }}
                    data-testid={`event-${i}`}
                    onClick={() => reached && setSelectedEvent(e)}
                    className={`w-full flex items-start gap-3 px-4 py-3 border-b border-border/50 text-left transition-colors last:border-b-0 ${reached ? "hover:bg-secondary/30 cursor-pointer" : "cursor-default"}`}
                  >
                    <div className={`p-1.5 rounded mt-0.5 shrink-0 ${reached ? EVENT_TYPE_STYLE[e.type] : "bg-secondary text-muted-foreground border border-border"}`}>
                      <e.icon className="w-3 h-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs text-muted-foreground mb-0.5">tick {e.tick}</div>
                      <div className={`font-mono text-xs leading-snug ${reached ? "text-foreground" : "text-muted-foreground"}`}>
                        {e.label}
                      </div>
                    </div>
                    {e.type === "rollback_rejected" && reached && (
                      <Lock className="w-3 h-3 text-red-400 mt-1 shrink-0" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Character fingerprint */}
          <CharacterFingerprint />

          <div className="bg-card/40 border border-border/50 rounded-lg p-4 space-y-3">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Irreversibility model</p>
            {[
              { text: "Core traits (curiosity, skepticism, empathy) accumulate permanently. Each learning event deepens them — they cannot be un-done.", icon: Lock, color: "text-red-400" },
              { text: "Surface traits (verbosity, formality) allow minor corrections within a ±0.15 bound from their current value. They cannot be reset to earlier states.", icon: Unlock, color: "text-muted-foreground" },
              { text: "Rollback requests are filtered: surface adjustments are applied; core trait reversions are silently rejected.", icon: GitBranch, color: "text-yellow-400" },
              { text: "The drift gate slows the rate of change — it does not reverse it. Accumulated state always persists.", icon: AlertTriangle, color: "text-yellow-400" },
              { text: "Snapshots exist for inspection and comparison. They are read-only records of past character states, not restore points.", icon: Activity, color: "text-primary" },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <s.icon className={`w-3 h-3 mt-0.5 shrink-0 ${s.color}`} />
                <p className="text-xs text-muted-foreground leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
