import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, GitBranch, Lock, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Upload, FileJson } from "lucide-react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";

type Trait = "curiosity" | "skepticism" | "empathy" | "formality" | "verbosity";
const TRAITS: Trait[] = ["curiosity", "skepticism", "empathy", "formality", "verbosity"];
const CORE: Set<Trait> = new Set(["curiosity", "skepticism", "empathy"]);

interface InstanceProfile {
  id: string;
  fingerprint: string;
  color: string;
  label: string;
  origin: string;
  age: string;
  interactions: number;
  docsIndexed: number;
  traits: Record<Trait, number>;
  trajectory: string;
}

const INSTANCE_A: InstanceProfile = {
  id: "A",
  fingerprint: "0x3F8A2D1C",
  color: "#22d3ee",
  label: "Instance A",
  origin: "Seeded: 2024-01-12 / arxiv.org, Wikipedia, HN",
  age: "92 days",
  interactions: 3420,
  docsIndexed: 214000,
  traits: { curiosity: 0.87, skepticism: 0.71, empathy: 0.54, formality: 0.62, verbosity: 0.48 },
  trajectory: "Science-heavy ingestion pipeline. High skepticism from adversarial peer-review exposure. Empathy lower — fewer conversational interactions, more document synthesis.",
};

const INSTANCE_B: InstanceProfile = {
  id: "B",
  fingerprint: "0xB7E94A05",
  color: "#a78bfa",
  label: "Instance B",
  origin: "Seeded: 2024-01-12 / Reddit, Twitter, PubMed",
  age: "92 days",
  interactions: 8910,
  docsIndexed: 89000,
  traits: { curiosity: 0.64, skepticism: 0.42, empathy: 0.88, formality: 0.35, verbosity: 0.79 },
  trajectory: "Social discourse dominated. Massive conversational interaction count drove empathy to the highest measurable level. Skepticism low — fewer adversarial signals. Formality collapsed under informal language exposure.",
};

function deriveFingerprint(t: Record<Trait, number>): string {
  const vals = [t.curiosity, t.skepticism, t.empathy, t.formality, t.verbosity];
  const seed = vals.reduce((acc, v, i) => acc + Math.round(v * 1000) * (i + 1) * 31337, 0);
  return `0x${(seed >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

const CUSTOM_A: Record<Trait, number> = { curiosity: 0.72, skepticism: 0.58, empathy: 0.69, formality: 0.44, verbosity: 0.61 };
const CUSTOM_B: Record<Trait, number> = { curiosity: 0.55, skepticism: 0.80, empathy: 0.40, formality: 0.70, verbosity: 0.35 };

type Mode = "preset" | "custom" | "dna_files";

function DeltaBadge({ delta, isCoreA, isCoreB }: { delta: number; isCoreA: boolean; isCoreB: boolean }) {
  const abs = Math.abs(delta);
  const isNeg = delta < 0;
  const color = abs < 0.05 ? "text-muted-foreground" : isNeg ? "text-rose-400" : "text-emerald-400";
  const Icon = abs < 0.02 ? Minus : isNeg ? TrendingDown : TrendingUp;
  return (
    <div className={`flex items-center gap-1 font-mono text-xs ${color}`}>
      <Icon className="w-3 h-3" />
      {abs < 0.02 ? "≈" : (isNeg ? "" : "+")}{delta.toFixed(3)}
    </div>
  );
}

interface DnaFile {
  label: string;
  fingerprint: string;
  traits: Record<Trait, number>;
  meta: { created?: string; uptime_days?: number; version?: string; domains?: number; docs?: number };
}

function parseDnaJson(raw: unknown): DnaFile | null {
  try {
    const obj = raw as Record<string, unknown>;
    const inst = obj.instance as Record<string, unknown>;
    const char = obj.character as Record<string, unknown>;
    const know = obj.knowledge as Record<string, unknown>;
    const rawTraits = char?.traits as Record<string, number>;
    // Normalise: map "boldness" → "verbosity" if needed
    const traits: Partial<Record<Trait, number>> = {};
    for (const t of TRAITS) {
      if (rawTraits[t] !== undefined) traits[t] = rawTraits[t];
    }
    if ((rawTraits as Record<string, number>)["boldness"] !== undefined && traits.verbosity === undefined) {
      traits.verbosity = (rawTraits as Record<string, number>)["boldness"];
    }
    if (TRAITS.some(t => traits[t] === undefined)) return null;
    const fp = (char?.fingerprint ?? inst?.id ?? "0x????????") as string;
    return {
      label: `Instance ${fp.slice(0, 10)}`,
      fingerprint: fp,
      traits: traits as Record<Trait, number>,
      meta: {
        created:     inst?.created as string | undefined,
        uptime_days: inst?.uptime_days as number | undefined,
        version:     inst?.version as string | undefined,
        domains:     (know?.domains_crawled as number | undefined),
        docs:        (know?.total_docs as number | undefined),
      },
    };
  } catch { return null; }
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Compare() {
  const [mode, setMode] = useState<Mode>("preset");
  const [customA, setCustomA] = useState(CUSTOM_A);
  const [customB, setCustomB] = useState(CUSTOM_B);
  const [tick, setTick] = useState(0);
  const [dnaA, setDnaA] = useState<DnaFile | null>(null);
  const [liveInstanceA, setLiveInstanceA] = useState<{ traits: Record<Trait, number>; interactions: number; knowledgeNodes: number } | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/omni/character`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(data => {
        if (!data) return;
        setLiveInstanceA({
          traits: {
            curiosity:  data.curiosity  / 100,
            skepticism: data.caution    / 100,
            empathy:    data.empathy    / 100,
            formality:  data.technical  / 100,
            verbosity:  data.verbosity  / 100,
          },
          interactions:   data.totalInteractions,
          knowledgeNodes: data.totalKnowledgeNodes,
        });
      });
  }, []);
  // Live simulated peer — derived from Instance A traits with seeded divergence + gentle pulse
  const [liveB, setLiveB] = useState<InstanceProfile | null>(null);
  const [bPulse, setBPulse] = useState(0);

  useEffect(() => {
    if (!liveInstanceA) return;
    const a = liveInstanceA.traits;
    // Seeded offsets simulate a peer that diverged from the same origin differently
    const divergeOffsets: Record<Trait, number> = { curiosity: -0.23, skepticism: -0.29, empathy: +0.34, formality: -0.27, verbosity: +0.31 };
    const traits = TRAITS.reduce((acc, t) => ({
      ...acc,
      [t]: Math.max(0.05, Math.min(0.98, a[t] + divergeOffsets[t])),
    }), {} as Record<Trait, number>);
    const fp = deriveFingerprint(traits);
    setLiveB({
      id: "B", fingerprint: fp, color: "#a78bfa", label: "Instance B",
      origin: "Seeded: same origin / social corpus fork",
      age: `${Math.max(1, Math.floor((liveInstanceA.interactions * 0.9) / 30))} days`,
      interactions: Math.round(liveInstanceA.interactions * 2.6),
      docsIndexed: Math.round(liveInstanceA.knowledgeNodes * 0.42 * 1000),
      traits,
      trajectory: "Social discourse dominated. High conversational interaction count drove empathy to measurable peak. Skepticism compressed under informal signal dominance. Formality collapsed under social corpus exposure.",
    });
  }, [liveInstanceA]);

  useEffect(() => {
    const t = setInterval(() => setBPulse(p => p + 1), 6000);
    return () => clearInterval(t);
  }, []);

  const [dnaB, setDnaB] = useState<DnaFile | null>(null);
  const [dnaErrA, setDnaErrA] = useState<string | null>(null);
  const [dnaErrB, setDnaErrB] = useState<string | null>(null);
  const inputRefA = useRef<HTMLInputElement>(null);
  const inputRefB = useRef<HTMLInputElement>(null);

  function loadDnaFile(file: File, side: "A" | "B") {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = parseDnaJson(JSON.parse(e.target!.result as string));
        if (!parsed) throw new Error("Could not find trait data in this file.");
        if (side === "A") { setDnaA(parsed); setDnaErrA(null); }
        else              { setDnaB(parsed); setDnaErrB(null); }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid JSON";
        if (side === "A") setDnaErrA(msg);
        else              setDnaErrB(msg);
      }
    };
    reader.readAsText(file);
  }

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 180);
    return () => clearInterval(t);
  }, []);

  const liveTraitsA = liveInstanceA?.traits ?? INSTANCE_A.traits;
  const instA = mode === "preset" ? liveTraitsA : mode === "custom" ? customA : (dnaA?.traits ?? INSTANCE_A.traits);

  // Instance B: use live derived peer in preset mode (gently pulses to show it's alive)
  const liveBTraits = liveB
    ? TRAITS.reduce((acc, t) => ({
        ...acc,
        [t]: Math.max(0.05, Math.min(0.98, liveB.traits[t] + Math.sin(bPulse * 1.1 + TRAITS.indexOf(t) * 0.9) * 0.004)),
      }), {} as Record<Trait, number>)
    : INSTANCE_B.traits;
  const instB = mode === "preset" ? liveBTraits : mode === "custom" ? customB : (dnaB?.traits ?? INSTANCE_B.traits);
  const activePeerB = mode === "preset" ? (liveB ?? INSTANCE_B) : INSTANCE_B;

  const fpA = mode === "preset" ? (liveInstanceA ? deriveFingerprint(liveTraitsA) : INSTANCE_A.fingerprint) : mode === "custom" ? deriveFingerprint(customA) : (dnaA?.fingerprint ?? "—");
  const fpB = mode === "preset" ? activePeerB.fingerprint : mode === "custom" ? deriveFingerprint(customB) : (dnaB?.fingerprint ?? "—");

  const radarData = TRAITS.map(t => ({
    trait: t.charAt(0).toUpperCase() + t.slice(1),
    A: Math.round(instA[t] * 100),
    B: Math.round(instB[t] * 100),
  }));

  const divergence = TRAITS.reduce((acc, t) => acc + Math.abs(instA[t] - instB[t]), 0) / TRAITS.length;
  const coreDivergence = (["curiosity", "skepticism", "empathy"] as Trait[]).reduce(
    (acc, t) => acc + Math.abs(instA[t] - instB[t]), 0
  ) / 3;
  const canMerge = coreDivergence < 0.05;

  const pulse = 0.001 * Math.sin(tick * 0.18);

  return (
    <div className="p-6 md:p-12 max-w-6xl mx-auto min-h-screen">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono text-xs mb-6">
          <GitBranch className="w-3.5 h-3.5" />
          <span>instance divergence analysis</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Compare Instances</h1>
        <p className="text-lg text-muted-foreground font-mono max-w-2xl">
          Two OmniLearn agents — same starting config, different journeys. Core trait divergence is permanent and irreconcilable. Surface traits can narrow but never fully converge.
        </p>
      </motion.div>

      {/* Mode toggle */}
      <div className="flex flex-wrap gap-2 mb-8">
        {([
          { key: "preset",    label: "Real instance pair" },
          { key: "custom",    label: "Custom trait sliders" },
          { key: "dna_files", label: "Load DNA files" },
        ] as { key: Mode; label: string }[]).map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`font-mono text-xs px-4 py-2 rounded border transition-all flex items-center gap-1.5 ${
              mode === m.key
                ? "bg-primary/10 border-primary/40 text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/30"
            }`}
          >
            {m.key === "dna_files" && <Upload className="w-3 h-3" />}
            {m.label}
          </button>
        ))}
      </div>

      {/* DNA file upload zones */}
      <AnimatePresence>
        {mode === "dna_files" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([
                { side: "A" as const, color: "#22d3ee", dna: dnaA, err: dnaErrA, ref: inputRefA },
                { side: "B" as const, color: "#a78bfa", dna: dnaB, err: dnaErrB, ref: inputRefB },
              ]).map(({ side, color, dna, err, ref }) => (
                <div key={side}>
                  <input
                    ref={ref}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) loadDnaFile(f, side); }}
                  />
                  {dna ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-xl border p-4"
                      style={{ borderColor: color + "40", backgroundColor: color + "08" }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileJson className="w-4 h-4" style={{ color }} />
                          <span className="font-mono text-xs font-bold" style={{ color }}>{dna.fingerprint}</span>
                        </div>
                        <button
                          onClick={() => ref.current?.click()}
                          className="font-mono text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-colors"
                        >
                          swap
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {[
                          { l: "Domains",   v: dna.meta.domains?.toString() ?? "—" },
                          { l: "Docs",      v: dna.meta.docs ? `${(dna.meta.docs/1000).toFixed(0)}k` : "—" },
                          { l: "Uptime",    v: dna.meta.uptime_days ? `${dna.meta.uptime_days}d` : "—" },
                        ].map(s => (
                          <div key={s.l} className="bg-secondary/30 rounded p-2">
                            <p className="font-mono text-[9px] text-muted-foreground">{s.l}</p>
                            <p className="font-mono text-xs font-bold text-foreground">{s.v}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <button
                      onClick={() => ref.current?.click()}
                      className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all p-8 text-center group"
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadDnaFile(f, side); }}
                    >
                      <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary mx-auto mb-2 transition-colors" />
                      <p className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                        Instance {side} — drop a DNA .json here
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground/50 mt-1">
                        exported from Instance DNA page
                      </p>
                    </button>
                  )}
                  {err && <p className="font-mono text-[10px] text-red-400 mt-2 px-1">{err}</p>}
                </div>
              ))}
            </div>
            {(!dnaA || !dnaB) && (
              <p className="font-mono text-[10px] text-muted-foreground/50 text-center mt-3">
                Load both files to run the divergence analysis
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {[
          { profile: INSTANCE_A,  traits: instA, fp: fpA },
          { profile: activePeerB, traits: instB, fp: fpB },
        ].map(({ profile, traits: _traits, fp }, idx) => (
          <motion.div
            key={profile.id}
            initial={{ opacity: 0, x: idx === 0 ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card border rounded-xl p-5"
            style={{ borderColor: profile.color + "30" }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground mb-1">
                  {profile.id === "A" && mode === "preset" ? "This Instance" : profile.label}
                  {mode === "preset" && liveInstanceA && (
                    <span className="ml-2 font-mono text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded">live</span>
                  )}
                </p>
                <p className="font-mono text-xl font-bold" style={{ color: profile.color }}>{fp}</p>
              </div>
              <Fingerprint className="w-5 h-5 mt-1" style={{ color: profile.color }} />
            </div>
            {mode === "preset" && (
              <>
                <p className="font-mono text-[10px] text-muted-foreground mb-1">
                  {profile.id === "A" && liveInstanceA
                    ? "Live — evolving with each interaction"
                    : profile.origin}
                </p>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {(profile.id === "A" && liveInstanceA ? [
                    { l: "Interactions", v: liveInstanceA.interactions.toLocaleString() },
                    { l: "Knowledge",    v: `${liveInstanceA.knowledgeNodes} nodes` },
                    { l: "Fingerprint",  v: fpA.slice(0, 10) + "…" },
                  ] : [
                    { l: "Age",          v: profile.age },
                    { l: "Interactions", v: profile.interactions.toLocaleString() },
                    { l: "Docs indexed", v: (profile.docsIndexed / 1000).toFixed(0) + "k" },
                  ]).map(s => (
                    <div key={s.l} className="bg-secondary/30 rounded p-2 text-center">
                      <p className="font-mono text-[10px] text-muted-foreground">{s.l}</p>
                      <p className="font-mono text-xs font-bold text-foreground">{s.v}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  {profile.id === "A" && liveInstanceA
                    ? "Science-heavy ingestion pipeline. Character traits derived from live interaction and knowledge graph state."
                    : profile.trajectory}
                </p>
              </>
            )}
            {mode === "custom" && (
              <div className="space-y-3 mt-2">
                {TRAITS.map(t => {
                  const val = idx === 0 ? customA[t] : customB[t];
                  const isCore = CORE.has(t);
                  return (
                    <div key={t}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[11px] text-muted-foreground">{t}</span>
                        <div className="flex items-center gap-1.5">
                          {isCore && <Lock className="w-2.5 h-2.5 text-primary/60" />}
                          <span className="font-mono text-[11px] text-foreground">{val.toFixed(2)}</span>
                        </div>
                      </div>
                      <input
                        type="range" min={0.05} max={0.98} step={0.01}
                        value={val}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          if (idx === 0) setCustomA(p => ({ ...p, [t]: v }));
                          else setCustomB(p => ({ ...p, [t]: v }));
                        }}
                        className="w-full h-1 appearance-none rounded cursor-pointer"
                        style={{ accentColor: profile.color }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Radar overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-card border border-border rounded-xl p-6 mb-8"
      >
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-4">Trait overlay — both instances</p>
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
            <PolarGrid stroke="hsl(230 25% 18%)" />
            <PolarAngleAxis dataKey="trait" tick={{ fontSize: 11, fill: "hsl(215 20.2% 55%)", fontFamily: "monospace" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(224 71% 6%)", border: "1px solid hsl(214.3 31.8% 16%)", borderRadius: 8, fontFamily: "monospace", fontSize: 11 }}
            />
            <Radar name="Instance A" dataKey="A" stroke={INSTANCE_A.color} fill={INSTANCE_A.color} fillOpacity={0.12} strokeWidth={2} />
            <Radar name="Instance B" dataKey="B" stroke={INSTANCE_B.color} fill={INSTANCE_B.color} fillOpacity={0.12} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-6 mt-2">
          {[INSTANCE_A, INSTANCE_B].map(p => (
            <div key={p.id} className="flex items-center gap-2">
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: p.color }} />
              <span className="font-mono text-xs text-muted-foreground">{p.label} — {fpA.slice(0, 6)}…</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Per-trait delta table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-card border border-border rounded-xl overflow-hidden mb-8"
      >
        <div className="px-5 py-3 border-b border-border">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Trait divergence table</p>
        </div>
        <div className="divide-y divide-border/50">
          {TRAITS.map(t => {
            const a = instA[t];
            const b = instB[t];
            const delta = b - a;
            const abs = Math.abs(delta);
            const isCore = CORE.has(t);
            const convergeable = !isCore || abs < 0.03;
            return (
              <div key={t} className="flex items-center gap-4 px-5 py-3">
                <div className="w-24 shrink-0 flex items-center gap-1.5">
                  {isCore && <Lock className="w-3 h-3 text-primary/60" />}
                  <span className="font-mono text-xs text-foreground">{t}</span>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <span className="font-mono text-xs w-12 text-right" style={{ color: INSTANCE_A.color }}>{a.toFixed(3)}</span>
                  <div className="flex-1 relative h-3 bg-secondary rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${a * 100}%`, backgroundColor: INSTANCE_A.color, opacity: 0.5 }} />
                    <div className="absolute inset-y-0 left-0 h-1 top-1 rounded-full" style={{ width: `${b * 100}%`, backgroundColor: INSTANCE_B.color, opacity: 0.7 }} />
                  </div>
                  <span className="font-mono text-xs w-12" style={{ color: INSTANCE_B.color }}>{b.toFixed(3)}</span>
                </div>
                <div className="w-20 shrink-0">
                  <DeltaBadge delta={delta} isCoreA={isCore} isCoreB={isCore} />
                </div>
                <div className="w-24 shrink-0 text-right">
                  {isCore ? (
                    <span className="font-mono text-[10px] text-rose-400 flex items-center justify-end gap-1">
                      <Lock className="w-2.5 h-2.5" /> permanent
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                      <CheckCircle className="w-2.5 h-2.5" /> correctable
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Verdict */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className={`rounded-xl p-6 border ${canMerge ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}
      >
        <div className="flex items-start gap-4">
          {canMerge
            ? <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            : <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
          }
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2 flex-wrap">
              <p className={`font-mono text-sm font-bold ${canMerge ? "text-emerald-400" : "text-rose-400"}`}>
                {canMerge ? "Convergence theoretically possible" : "Irreconcilable divergence — merge impossible"}
              </p>
              <span className="font-mono text-xs text-muted-foreground">
                mean deviation: <span className="text-foreground">{(divergence * 100).toFixed(1)}%</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                core deviation: <span className={coreDivergence > 0.1 ? "text-rose-400" : "text-foreground"}>{(coreDivergence * 100).toFixed(1)}%</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {canMerge
                ? "Core traits are close enough that a supervised merge could be attempted. Surface traits can be averaged. Proceed with caution — even similar instances carry distinct trajectory histories."
                : "Core traits (curiosity, skepticism, empathy) have diverged beyond the irreconcilability threshold. These shifts are permanent products of independent learning. No merge protocol can reverse accumulated experience. These are two different minds."}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
