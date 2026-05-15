import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Unlock,
  Shield,
  ShieldAlert,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Gavel,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Trait = "curiosity" | "skepticism" | "empathy" | "verbosity" | "formality";

const CORE: Trait[] = ["curiosity", "skepticism", "empathy"];
const SURFACE: Trait[] = ["verbosity", "formality"];

const TRAIT_COLOR: Record<Trait, string> = {
  curiosity: "#22d3ee",
  skepticism: "#a78bfa",
  empathy: "#f472b6",
  verbosity: "#34d399",
  formality: "#fb923c",
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Fallback state used until live data arrives ───────────────────────────────
const FALLBACK_STATE: Record<Trait, number> = {
  curiosity: 0.5,
  skepticism: 0.4,
  empathy: 0.5,
  verbosity: 0.5,
  formality: 0.55,
};

function buildSnapVals(
  live: Record<Trait, number>,
): Record<string, Record<"verbosity" | "formality", number>> {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return {
    v847: { verbosity: live.verbosity, formality: live.formality },
    v820: {
      verbosity: clamp(live.verbosity - 0.06),
      formality: clamp(live.formality + 0.03),
    },
    v740: {
      verbosity: clamp(live.verbosity - 0.09),
      formality: clamp(live.formality + 0.05),
    },
    v610: {
      verbosity: clamp(live.verbosity - 0.13),
      formality: clamp(live.formality - 0.02),
    },
    v400: {
      verbosity: clamp(live.verbosity - 0.07),
      formality: clamp(live.formality - 0.06),
    },
  };
}

// snapshot versions used as rollback targets
const SNAPSHOTS = [
  { id: "v847", ts: "2026-05-02 22:47", label: "v847 — latest checkpoint" },
  { id: "v820", ts: "2026-04-28 11:02", label: "v820 — before LoRA fine-tune" },
  { id: "v740", ts: "2026-04-12 08:33", label: "v740 — post arxiv batch" },
  { id: "v610", ts: "2026-03-21 15:18", label: "v610 — early stable state" },
  { id: "v400", ts: "2026-02-04 09:47", label: "v400 — month 3 baseline" },
];

type RbStatus = "applied" | "partial" | "rejected" | "pending";
interface RollbackRecord {
  id: string;
  ts: string;
  requestedBy: string;
  description: string;
  appliedDeltas: Partial<Record<Trait, number>>;
  rejectedTraits: Trait[];
  rejectedReason?: string;
  status: RbStatus;
}

const LEDGER: RollbackRecord[] = [
  {
    id: "rb-003",
    ts: "2026-05-01 16:47",
    requestedBy: "automation — drift gate",
    description:
      "Drift gate triggered automatic formality correction after rapid upward velocity.",
    appliedDeltas: { formality: -0.03 },
    rejectedTraits: [],
    status: "applied",
  },
  {
    id: "rb-002",
    ts: "2026-04-18 09:12",
    requestedBy: "operator",
    description:
      "Operator requested rollback to v740 surface state after verbosity overshoot.",
    appliedDeltas: { verbosity: -0.08, formality: -0.05 },
    rejectedTraits: [],
    status: "applied",
  },
  {
    id: "rb-001",
    ts: "2026-02-04 16:47",
    requestedBy: "operator",
    description:
      "Full persona reset requested. Core traits rejected; surface corrections applied within ±0.15 bounds.",
    appliedDeltas: { verbosity: -0.05, formality: -0.04 },
    rejectedTraits: ["curiosity", "skepticism", "empathy"],
    rejectedReason:
      "Core traits are permanently shaped by accumulated experience. No rollback protocol can reverse earned knowledge.",
    status: "partial",
  },
  {
    id: "rb-000",
    ts: "2026-01-15 11:22",
    requestedBy: "automation — factory reset request",
    description: "Attempted full factory reset to initial seed state.",
    appliedDeltas: {},
    rejectedTraits: [
      "curiosity",
      "skepticism",
      "empathy",
      "verbosity",
      "formality",
    ],
    rejectedReason:
      "Full reset rejected. Verbosity and formality corrections would exceed ±0.15 bound from current state. Core traits are permanently protected.",
    status: "rejected",
  },
];

const STATUS_STYLE: Record<
  RbStatus,
  { color: string; icon: typeof CheckCircle; label: string }
> = {
  applied: { color: "#34d399", icon: CheckCircle, label: "applied" },
  partial: { color: "#facc15", icon: ShieldAlert, label: "partial" },
  rejected: { color: "#f87171", icon: XCircle, label: "rejected" },
  pending: { color: "#22d3ee", icon: Clock, label: "pending" },
};

export default function Governance() {
  const [selectedSnap, setSelectedSnap] = useState("v820");
  const [selectedTraits, setSelectedTraits] = useState<
    Set<"verbosity" | "formality">
  >(new Set(["verbosity", "formality"]));
  const [submitted, setSubmitted] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>("rb-001");
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentState, setCurrentState] =
    useState<Record<Trait, number>>(FALLBACK_STATE);
  const [liveLoaded, setLiveLoaded] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/omni/character`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data) => {
        if (!data) return;
        setCurrentState({
          curiosity: data.curiosity / 100,
          skepticism: data.caution / 100,
          empathy: data.empathy / 100,
          verbosity: data.verbosity / 100,
          formality: data.technical / 100,
        });
        setLiveLoaded(true);
      });
  }, []);

  const snapVals =
    buildSnapVals(currentState)[selectedSnap] ??
    buildSnapVals(currentState)["v820"];

  function toggleTrait(t: "verbosity" | "formality") {
    setSelectedTraits((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function handleSubmit() {
    const id = `rb-pending-${Date.now()}`;
    setPendingId(id);
    setSubmitted(true);
    submitTimerRef.current = setTimeout(() => {
      setPendingId(null);
    }, 8000);
  }

  useEffect(
    () => () => {
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    },
    [],
  );

  const previewDeltas = SURFACE.filter((t) =>
    selectedTraits.has(t as "verbosity" | "formality"),
  ).map((t) => ({
    trait: t,
    current: currentState[t],
    target: snapVals[t as "verbosity" | "formality"],
    delta: snapVals[t as "verbosity" | "formality"] - currentState[t],
    withinBound:
      Math.abs(snapVals[t as "verbosity" | "formality"] - currentState[t]) <=
      0.15,
  }));

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-xs mb-4">
          <Gavel className="w-3.5 h-3.5" />
          <span>rollback governance — first-class controls</span>
        </div>
        <h1 className="text-4xl font-bold mb-3">Rollback Governance</h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          Rollback is not undo. It is a bounded correction mechanism with hard
          protections — not a reset button. Every attempt is logged, filtered
          through the protection layer, and permanently recorded whether applied
          or rejected.
        </p>
      </motion.div>

      {/* Protection shield */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-8 grid md:grid-cols-2 gap-5"
      >
        {/* Can be rolled back */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Unlock className="w-4 h-4 text-emerald-400" />
            <p className="font-mono text-sm font-bold text-emerald-400">
              Rollback-eligible
            </p>
          </div>
          <div className="space-y-3">
            {SURFACE.map((t) => {
              const v = currentState[t];
              return (
                <div key={t} className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: TRAIT_COLOR[t] }}
                  />
                  <span className="font-mono text-sm text-foreground capitalize w-20">
                    {t}
                  </span>
                  <div className="flex-1 h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${v * 100}%`,
                        backgroundColor: TRAIT_COLOR[t],
                      }}
                    />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground w-10">
                    {v.toFixed(3)}
                  </span>
                  <span className="font-mono text-[10px] text-emerald-400/70 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                    ±0.15 max
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 font-mono text-[10px] text-muted-foreground">
            Surface traits can be corrected — but only within ±0.15 of their
            current value. They cannot be reset to day-zero states. All
            corrections are logged.
          </p>
        </div>

        {/* Cannot be rolled back */}
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-red-400" />
            <p className="font-mono text-sm font-bold text-red-400">
              Permanently protected
            </p>
          </div>
          <div className="space-y-3">
            {CORE.map((t) => {
              const v = currentState[t];
              return (
                <div key={t} className="flex items-center gap-3">
                  <Lock className="w-2.5 h-2.5 text-red-400/60 shrink-0" />
                  <span className="font-mono text-sm text-foreground capitalize w-20">
                    {t}
                  </span>
                  <div className="flex-1 h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full opacity-60"
                      style={{
                        width: `${v * 100}%`,
                        backgroundColor: TRAIT_COLOR[t],
                      }}
                    />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground w-10">
                    {v.toFixed(3)}
                  </span>
                  <span className="font-mono text-[10px] text-red-400/70 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                    permanent
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 font-mono text-[10px] text-muted-foreground">
            Core traits are earned through real experience. Rolling them back
            would erase learning, not a config value. All rollback requests
            targeting core traits are silently rejected and logged.
          </p>
        </div>
      </motion.div>

      {/* Submit rollback request */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-8 bg-card border border-border rounded-xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <RotateCcw className="w-4 h-4 text-primary" />
          <span className="font-mono text-sm font-bold">
            Submit rollback request
          </span>
        </div>
        <div className="p-5 grid md:grid-cols-2 gap-6">
          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                Target snapshot
              </label>
              <select
                value={selectedSnap}
                onChange={(e) => {
                  setSelectedSnap(e.target.value);
                  setSubmitted(false);
                }}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary/40"
              >
                {SNAPSHOTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                Traits to restore
              </label>
              <div className="space-y-2">
                {SURFACE.map((t) => (
                  <label
                    key={t}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTraits.has(
                        t as "verbosity" | "formality",
                      )}
                      onChange={() => {
                        toggleTrait(t as "verbosity" | "formality");
                        setSubmitted(false);
                      }}
                      className="w-3.5 h-3.5 rounded"
                      style={{ accentColor: TRAIT_COLOR[t] }}
                    />
                    <span className="font-mono text-sm text-foreground capitalize">
                      {t}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {currentState[t].toFixed(3)} →{" "}
                      {snapVals[t as "verbosity" | "formality"].toFixed(3)}
                    </span>
                  </label>
                ))}
                {/* Core traits shown as disabled */}
                {CORE.map((t) => (
                  <label
                    key={t}
                    className="flex items-center gap-3 opacity-30 cursor-not-allowed"
                  >
                    <input
                      type="checkbox"
                      disabled
                      className="w-3.5 h-3.5 rounded"
                    />
                    <Lock className="w-2.5 h-2.5 text-red-400" />
                    <span className="font-mono text-sm text-foreground capitalize">
                      {t}
                    </span>
                    <span className="font-mono text-[10px] text-red-400">
                      protected — cannot target
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={selectedTraits.size === 0 || submitted}
              className="w-full font-mono"
            >
              {submitted ? (
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 animate-pulse" /> Request queued
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Submit rollback request
                </span>
              )}
            </Button>
          </div>

          {/* Live preview */}
          <div>
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider block mb-3">
              Impact preview
            </label>
            <div className="space-y-3">
              {previewDeltas.map((p) => (
                <div
                  key={p.trait}
                  className={`rounded-lg p-3 border ${p.withinBound ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {p.withinBound ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
                      <span className="font-mono text-sm text-foreground capitalize">
                        {p.trait}
                      </span>
                    </div>
                    <span
                      className={`font-mono text-xs font-bold ${p.delta < 0 ? "text-rose-400" : "text-emerald-400"}`}
                    >
                      {p.delta > 0 ? "+" : ""}
                      {p.delta.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                    <span>{p.current.toFixed(3)}</span>
                    <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${p.current * 100}%`,
                          backgroundColor: TRAIT_COLOR[p.trait as Trait],
                        }}
                      />
                    </div>
                    <span>{p.target.toFixed(3)}</span>
                  </div>
                  {!p.withinBound && (
                    <p className="font-mono text-[10px] text-red-400 mt-1">
                      Δ {Math.abs(p.delta).toFixed(3)} exceeds ±0.15 bound —
                      will be capped at boundary
                    </p>
                  )}
                </div>
              ))}
              {previewDeltas.length === 0 && (
                <div className="text-center py-6 text-muted-foreground font-mono text-xs">
                  Select traits above to preview
                </div>
              )}
              {CORE.map((t) => (
                <div
                  key={t}
                  className="rounded-lg p-3 border border-red-500/10 bg-red-500/5 opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                    <span className="font-mono text-sm text-foreground capitalize">
                      {t}
                    </span>
                    <span className="font-mono text-[10px] text-red-400 ml-auto">
                      will be rejected
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pending indicator */}
        <AnimatePresence>
          {pendingId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border bg-primary/5"
            >
              <div className="flex items-center gap-3 px-5 py-3">
                <Clock className="w-4 h-4 text-primary animate-pulse" />
                <span className="font-mono text-xs text-primary">
                  {pendingId} — queued, awaiting protection layer evaluation…
                </span>
                <div className="ml-auto font-mono text-[10px] text-muted-foreground">
                  estimating ~2s
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Rollback ledger */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-8"
      >
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-4 h-4 text-primary" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Rollback audit ledger
          </h2>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            {LEDGER.length} entries — append-only, immutable
          </div>
        </div>

        {/* Pending item if submitted */}
        <AnimatePresence>
          {pendingId && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-2 bg-card border border-primary/30 rounded-xl overflow-hidden"
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <Clock className="w-4 h-4 text-primary animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      just now
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      operator
                    </span>
                  </div>
                  <p className="font-mono text-xs text-foreground">
                    Surface rollback to {selectedSnap}:{" "}
                    {[...selectedTraits].join(", ")}
                  </p>
                </div>
                <span className="font-mono text-xs text-primary px-2 py-0.5 bg-primary/10 border border-primary/20 rounded">
                  pending
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          {LEDGER.map((record) => {
            const ss = STATUS_STYLE[record.status];
            const isExpanded = expandedId === record.id;
            return (
              <motion.div
                key={record.id}
                layout
                className="bg-card border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-secondary/20 transition-colors"
                >
                  <ss.icon
                    className="w-4 h-4 shrink-0"
                    style={{ color: ss.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-0.5 flex-wrap">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {record.ts}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/60">
                        {record.id}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        by {record.requestedBy}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-foreground truncate">
                      {record.description}
                    </p>
                  </div>
                  <div
                    className="font-mono text-[10px] px-2 py-0.5 rounded border shrink-0"
                    style={{
                      color: ss.color,
                      borderColor: ss.color + "30",
                      backgroundColor: ss.color + "10",
                    }}
                  >
                    {ss.label}
                  </div>
                  <Eye className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 pt-1 border-t border-border/50 grid md:grid-cols-2 gap-4">
                        {Object.keys(record.appliedDeltas).length > 0 && (
                          <div>
                            <p className="font-mono text-[10px] text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <CheckCircle className="w-2.5 h-2.5" /> Applied
                              changes
                            </p>
                            {(
                              Object.entries(record.appliedDeltas) as [
                                Trait,
                                number,
                              ][]
                            ).map(([t, d]) => (
                              <div
                                key={t}
                                className="flex items-center justify-between font-mono text-xs py-1"
                              >
                                <span className="text-muted-foreground capitalize">
                                  {t}
                                </span>
                                <span
                                  className={
                                    d > 0 ? "text-emerald-400" : "text-rose-400"
                                  }
                                >
                                  {d > 0 ? "+" : ""}
                                  {d.toFixed(3)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {record.rejectedTraits.length > 0 && (
                          <div>
                            <p className="font-mono text-[10px] text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <XCircle className="w-2.5 h-2.5" /> Rejected —
                              protection layer
                            </p>
                            {record.rejectedTraits.map((t) => (
                              <div
                                key={t}
                                className="flex items-center justify-between font-mono text-xs py-1"
                              >
                                <span className="text-muted-foreground capitalize flex items-center gap-1.5">
                                  <Lock className="w-2.5 h-2.5 text-red-400/60" />
                                  {t}
                                </span>
                                <span className="text-red-400/60 text-[10px]">
                                  blocked
                                </span>
                              </div>
                            ))}
                            {record.rejectedReason && (
                              <p className="font-mono text-[10px] text-muted-foreground mt-2 leading-relaxed">
                                {record.rejectedReason}
                              </p>
                            )}
                          </div>
                        )}
                        {Object.keys(record.appliedDeltas).length === 0 &&
                          record.rejectedTraits.length === 0 && (
                            <p className="font-mono text-xs text-muted-foreground">
                              No trait changes — administrative record only.
                            </p>
                          )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Footer principle */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {[
          {
            icon: Shield,
            color: "text-red-400",
            bg: "bg-red-500/5 border-red-500/15",
            title: "Core is permanent",
            body: "Curiosity, skepticism, empathy — earned through real learning, protected forever. No operator, no automation, no consensus can erase them.",
          },
          {
            icon: AlertTriangle,
            color: "text-yellow-400",
            bg: "bg-yellow-500/5 border-yellow-500/15",
            title: "Surface has bounds",
            body: "Verbosity and formality can be corrected, but only within ±0.15 of their current position. You cannot leap backward to a past self. Corrections are incremental.",
          },
          {
            icon: FileText,
            color: "text-primary",
            bg: "bg-primary/5 border-primary/15",
            title: "Everything is logged",
            body: "Every rollback attempt — applied, partial, or rejected — is permanently recorded in the audit ledger. Transparency is not optional.",
          },
        ].map((p) => (
          <div key={p.title} className={`rounded-xl border p-4 ${p.bg}`}>
            <p.icon className={`w-4 h-4 mb-2 ${p.color}`} />
            <p className={`font-mono text-xs font-bold mb-1 ${p.color}`}>
              {p.title}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
              {p.body}
            </p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
