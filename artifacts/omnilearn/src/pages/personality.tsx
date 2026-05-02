import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Activity, BookOpen, Globe, BrainCircuit, GitBranch, Zap, Clock, AlertTriangle } from "lucide-react";

type Trait = "curiosity" | "skepticism" | "verbosity" | "formality" | "empathy";

interface TraitPoint {
  tick: number;
  curiosity: number;
  skepticism: number;
  verbosity: number;
  formality: number;
  empathy: number;
  event?: string;
}

interface LearningEvent {
  tick: number;
  type: "ingestion" | "synthesis" | "interaction" | "finetune" | "drift_alert";
  label: string;
  desc: string;
  impact: Partial<Record<Trait, number>>;
  icon: typeof Activity;
}

const LEARNING_EVENTS: LearningEvent[] = [
  {
    tick: 8,
    type: "ingestion",
    label: "Arxiv batch: 2,400 ML papers",
    desc: "Deep exposure to technical literature increased precision-seeking and raised skepticism toward unverified claims.",
    impact: { skepticism: +0.09, formality: +0.06, curiosity: +0.04 },
    icon: Globe,
  },
  {
    tick: 18,
    type: "interaction",
    label: "240 user Q&A sessions",
    desc: "High-frequency conversational interactions pushed responses toward brevity. Empathy climbed from context-rich dialogue.",
    impact: { verbosity: -0.07, empathy: +0.10, curiosity: +0.03 },
    icon: Activity,
  },
  {
    tick: 28,
    type: "synthesis",
    label: "Cross-domain synthesis: philosophy + AI safety",
    desc: "Connecting disparate fields created novel perspectives. Formality dipped as the agent adopted a more exploratory tone.",
    impact: { formality: -0.08, curiosity: +0.06, skepticism: +0.04 },
    icon: BrainCircuit,
  },
  {
    tick: 38,
    type: "finetune",
    label: "LoRA fine-tune on curated corpus",
    desc: "Fine-tuning on high-quality scientific writing reinforced precision and formality. Verbosity increased with richer completions.",
    impact: { formality: +0.11, verbosity: +0.08, skepticism: -0.03 },
    icon: Zap,
  },
  {
    tick: 50,
    type: "drift_alert",
    label: "Drift gate triggered — formality capped",
    desc: "Meta-cognitive controller detected formality exceeding coherence threshold. Stability damper applied to prevent persona rigidity.",
    impact: { formality: -0.05 },
    icon: AlertTriangle,
  },
  {
    tick: 60,
    type: "ingestion",
    label: "Social discourse dataset: 18k threads",
    desc: "Exposure to informal debate and opinion raised empathy and softened formality. Verbosity settled at a conversational equilibrium.",
    impact: { empathy: +0.08, formality: -0.06, verbosity: -0.04, curiosity: +0.03 },
    icon: Globe,
  },
  {
    tick: 72,
    type: "interaction",
    label: "Long-form research sessions",
    desc: "Extended multi-turn research sessions rewarded depth. Verbosity climbed again as the agent learned detail is valued.",
    impact: { verbosity: +0.09, curiosity: +0.05, formality: +0.03 },
    icon: BookOpen,
  },
  {
    tick: 85,
    type: "finetune",
    label: "Character snapshot v7 — persona restored",
    desc: "Community rollback vote triggered restoration of v7 snapshot. Traits converged toward a consensus equilibrium.",
    impact: { curiosity: -0.04, skepticism: -0.05, verbosity: -0.06, empathy: +0.03 },
    icon: GitBranch,
  },
];

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
    // micro-noise: organic drift between events
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
  curiosity:   { label: "Curiosity",   color: "#22d3ee", desc: "Breadth of topic exploration and link-following behaviour" },
  skepticism:  { label: "Skepticism",  color: "#a78bfa", desc: "Source credibility weighting and claim verification intensity" },
  verbosity:   { label: "Verbosity",   color: "#34d399", desc: "Preferred response depth and elaboration tendency" },
  formality:   { label: "Formality",   color: "#fb923c", desc: "Tone register from casual conversation to academic register" },
  empathy:     { label: "Empathy",     color: "#f472b6", desc: "Sensitivity to human context in conversational interactions" },
};

const EVENT_TYPE_STYLE: Record<LearningEvent["type"], string> = {
  ingestion:    "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  synthesis:    "text-violet-400 bg-violet-400/10 border-violet-400/20",
  interaction:  "text-green-400 bg-green-400/10 border-green-400/20",
  finetune:     "text-orange-400 bg-orange-400/10 border-orange-400/20",
  drift_alert:  "text-red-400 bg-red-400/10 border-red-400/20",
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
          if (t >= 100) {
            setPlaying(false);
            return 100;
          }
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
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Personality Evolution</h1>
        <p className="text-xl text-muted-foreground font-mono">
          OmniLearn shapes its own character — autonomously, through what it reads, learns, and experiences.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Chart */}
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
                    <ReferenceLine key={e.tick} x={e.tick} stroke={e.type === "drift_alert" ? "#f87171" : "hsl(230 25% 20%)"} strokeDasharray="3 3" />
                  ))}
                  {(Object.keys(TRAIT_META) as Trait[]).map(t => (
                    activeTraits.has(t) && (
                      <Line
                        key={t}
                        type="monotone"
                        dataKey={t}
                        name={TRAIT_META[t].label}
                        stroke={TRAIT_META[t].color}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    )
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Trait toggles */}
            <div className="flex flex-wrap gap-2 px-5 pb-4">
              {(Object.keys(TRAIT_META) as Trait[]).map(t => (
                <button
                  key={t}
                  data-testid={`trait-toggle-${t}`}
                  onClick={() => toggleTrait(t)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-xs border transition-all ${
                    activeTraits.has(t) ? "border-transparent" : "border-border opacity-40"
                  }`}
                  style={activeTraits.has(t) ? { backgroundColor: TRAIT_META[t].color + "18", color: TRAIT_META[t].color, borderColor: TRAIT_META[t].color + "40" } : {}}
                >
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: TRAIT_META[t].color }} />
                  {TRAIT_META[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* Current state gauges */}
          <div className="grid grid-cols-5 gap-3">
            {(Object.keys(TRAIT_META) as Trait[]).map(t => {
              const val = currentState?.[t] ?? 0;
              const meta = TRAIT_META[t];
              return (
                <motion.div
                  key={t}
                  layout
                  className="bg-card border border-border rounded-lg p-3 text-center"
                >
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
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Active event card */}
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
                    <div className="font-mono text-xs opacity-70 mb-1 uppercase tracking-wider">{selectedEvent.type} · tick {selectedEvent.tick}</div>
                    <div className="font-bold text-sm leading-snug">{selectedEvent.label}</div>
                  </div>
                </div>
                <p className="text-xs opacity-80 leading-relaxed mb-3">{selectedEvent.desc}</p>
                <div className="space-y-1">
                  {Object.entries(selectedEvent.impact).map(([k, v]) => (
                    <div key={k} className="flex justify-between font-mono text-xs">
                      <span className="opacity-70">{TRAIT_META[k as Trait].label}</span>
                      <span className={v > 0 ? "text-green-400" : "text-red-400"}>{v > 0 ? "+" : ""}{v.toFixed(2)}</span>
                    </div>
                  ))}
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
                <p className="text-xs text-muted-foreground font-mono">Run the simulation to see learning events surface in real time.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Event log */}
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
                      <div className={`font-mono text-xs leading-snug truncate ${reached ? "text-foreground" : "text-muted-foreground"}`}>
                        {e.label}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-card/40 border border-border/50 rounded-lg p-4 space-y-3">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">How autonomous evolution works</p>
            {[
              "Every ingestion event reweights the character state vector based on topic distribution.",
              "Interactions train a preference model that subtly biases future response style.",
              "Fine-tuning shifts the base distribution — formality and verbosity are most affected.",
              "A drift gate monitors trait velocity. If any trait moves too fast, a stability damper fires.",
              "The meta-cognitive controller can rollback to any versioned persona snapshot.",
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="font-mono text-xs text-primary mt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}.</span>
                <p className="text-xs text-muted-foreground leading-relaxed">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
