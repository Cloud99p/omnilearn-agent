import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical, Zap, Brain, BookOpen, ArrowRight,
  CheckCircle, ChevronDown, ChevronUp, Loader2, BarChart3,
  Lightbulb, FileText, Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

interface NodeResult {
  id: number; content: string; type: string;
  confidence: number; similarity: number; timesAccessed: number;
}
interface SideResult {
  text: string; wordCount: number; sentences: number;
  knowledgeTermsUsed: number; citations: number;
}
interface BenchmarkResult {
  question: string;
  raw: SideResult;
  augmented: SideResult;
  knowledge: { nodesRetrieved: number; totalNodesSearched: number; nodes: NodeResult[] };
}

// ─── Sample questions ──────────────────────────────────────────────────────────

const SAMPLES = [
  "What is OmniLearn and how does it differ from traditional AI assistants?",
  "How does the knowledge graph improve response quality over time?",
  "Explain how ghost nodes contribute to distributed learning.",
  "What is instance DNA and why does it diverge between instances?",
  "How does the self-learning engine extract knowledge from conversations?",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  fact:    "text-primary border-primary/20 bg-primary/5",
  concept: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
  opinion: "text-violet-400 border-violet-400/20 bg-violet-400/5",
  rule:    "text-emerald-400 border-emerald-400/20 bg-emerald-400/5",
};

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

function MetricRow({ label, a, b, higherIsBetter = true }: {
  label: string; a: number; b: number; higherIsBetter?: boolean;
}) {
  const max = Math.max(a, b, 1);
  const bWins = higherIsBetter ? b >= a : b <= a;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-xs text-muted-foreground/60">{a}</span>
          {!bWins && <CheckCircle className="w-3 h-3 text-primary" />}
        </div>
        <Bar value={a} max={max} color="#22d3ee" />
      </div>
      <span className="font-mono text-[10px] text-muted-foreground text-center leading-tight whitespace-nowrap">{label}</span>
      <div>
        <div className="flex items-center justify-between mb-1">
          {bWins && <CheckCircle className="w-3 h-3 text-violet-400" />}
          <span className="font-mono text-xs text-muted-foreground/60 ml-auto">{b}</span>
        </div>
        <Bar value={b} max={max} color="#a78bfa" />
      </div>
    </div>
  );
}

function ResponsePanel({ label, color, icon: Icon, result, loading }: {
  label: string; color: string; icon: React.ElementType;
  result: SideResult | null; loading: boolean;
}) {
  return (
    <div className="flex flex-col h-full bg-card border rounded-xl overflow-hidden"
         style={{ borderColor: color + "30" }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b"
           style={{ borderColor: color + "20", backgroundColor: color + "08" }}>
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="font-mono text-xs font-bold" style={{ color }}>{label}</span>
        {result && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {result.wordCount} words
          </span>
        )}
      </div>
      <div className="flex-1 p-4 overflow-y-auto min-h-[200px]">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground mt-4">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color }} />
            <span className="font-mono text-xs">Running…</span>
          </div>
        ) : result ? (
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap font-mono">
            {result.text}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/40 font-mono italic mt-4">
            Response will appear here
          </p>
        )}
      </div>
      {result && (
        <div className="px-4 py-2 border-t flex gap-4" style={{ borderColor: color + "15" }}>
          {result.citations > 0 && (
            <span className="font-mono text-[10px] flex items-center gap-1" style={{ color }}>
              <Quote className="w-3 h-3" />
              {result.citations} citation{result.citations !== 1 ? "s" : ""}
            </span>
          )}
          <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {result.knowledgeTermsUsed} knowledge terms
          </span>
          <span className="font-mono text-[10px] text-muted-foreground ml-auto">
            {result.sentences} sentences
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BenchmarkPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<BenchmarkResult | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [showNodes, setShowNodes] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function runBenchmark() {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setShowNodes(false);
    try {
      const res = await fetch(`${BASE}/api/omni/benchmark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: BenchmarkResult = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Benchmark failed");
    } finally {
      setLoading(false);
    }
  }

  function pickSample(s: string) {
    setQuestion(s);
    inputRef.current?.focus();
  }

  const winWords   = result ? result.augmented.wordCount > result.raw.wordCount : false;
  const winTerms   = result ? result.augmented.knowledgeTermsUsed > result.raw.knowledgeTermsUsed : false;
  const winCites   = result ? result.augmented.citations > 0 : false;
  const totalWins  = [winWords, winTerms, winCites].filter(Boolean).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">

      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 mb-6">
          <FlaskConical className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono text-xs text-primary">knowledge quality benchmark</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-3">Does the knowledge pipeline work?</h1>
        <p className="text-muted-foreground font-mono text-sm max-w-2xl leading-relaxed">
          Ask the same question two ways — once with Omni using no context, and once with OmniLearn's
          knowledge graph injected. See exactly which nodes were retrieved, what context was added,
          and how the answer changes.
        </p>
      </div>

      {/* Input */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
          Your question
        </label>
        <textarea
          ref={inputRef}
          rows={3}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runBenchmark();
          }}
          placeholder="Ask anything — the more domain-specific, the more dramatic the difference…"
          className="w-full bg-transparent resize-none font-mono text-sm text-foreground placeholder:text-muted-foreground/30 outline-none"
        />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map(s => (
              <button
                key={s}
                onClick={() => pickSample(s)}
                className="font-mono text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                {s.slice(0, 42)}…
              </button>
            ))}
          </div>
          <button
            onClick={runBenchmark}
            disabled={!question.trim() || loading}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold transition-all",
              question.trim() && !loading
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-secondary text-muted-foreground cursor-not-allowed"
            )}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? "Running…" : "Run benchmark"}
            {!loading && <span className="text-[10px] opacity-60 ml-1">⌘↵</span>}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 font-mono text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {(loading || result) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Side-by-side responses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[320px]">
              <ResponsePanel
                label="Omni — baseline (no context)"
                color="#22d3ee"
                icon={Zap}
                result={result?.raw ?? null}
                loading={loading}
              />
              <ResponsePanel
                label="OmniLearn — knowledge augmented"
                color="#a78bfa"
                icon={Brain}
                result={result?.augmented ?? null}
                loading={loading}
              />
            </div>

            {/* Verdict banner */}
            {result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "flex items-center gap-4 rounded-xl px-5 py-4 border",
                  totalWins >= 2
                    ? "bg-violet-500/8 border-violet-500/30"
                    : "bg-primary/8 border-primary/30"
                )}
              >
                <CheckCircle className={cn("w-5 h-5 shrink-0", totalWins >= 2 ? "text-violet-400" : "text-primary")} />
                <div>
                  <p className="font-mono text-sm font-bold">
                    {totalWins >= 2
                      ? `Knowledge augmentation wins on ${totalWins}/3 signals`
                      : totalWins === 1
                        ? "Knowledge augmentation shows 1/3 signal improvement"
                        : "Responses are similar — try a more domain-specific question"}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">
                    {result.knowledge.nodesRetrieved} node{result.knowledge.nodesRetrieved !== 1 ? "s" : ""} retrieved
                    from {result.knowledge.totalNodesSearched}-node graph
                    {result.augmented.citations > 0 && ` · ${result.augmented.citations} inline citation${result.augmented.citations !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
              </motion.div>
            )}

            {/* Metrics comparison */}
            {result && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                    Quality signals
                  </p>
                  <div className="ml-auto flex items-center gap-4">
                    <span className="flex items-center gap-1.5 font-mono text-[10px] text-primary">
                      <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                      Raw
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-[10px] text-violet-400">
                      <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
                      Augmented
                    </span>
                  </div>
                </div>
                <div className="space-y-4">
                  <MetricRow label="word count"       a={result.raw.wordCount}           b={result.augmented.wordCount} />
                  <MetricRow label="sentences"        a={result.raw.sentences}           b={result.augmented.sentences} />
                  <MetricRow label="knowledge terms"  a={result.raw.knowledgeTermsUsed}  b={result.augmented.knowledgeTermsUsed} />
                  <MetricRow label="inline citations" a={result.raw.citations}           b={result.augmented.citations} />
                </div>
              </div>
            )}

            {/* Retrieved knowledge nodes */}
            {result && result.knowledge.nodesRetrieved > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowNodes(o => !o)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-secondary/10 transition-colors"
                >
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                  <span className="font-mono text-xs font-bold text-foreground">
                    {result.knowledge.nodesRetrieved} knowledge nodes injected as context
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    These were prepended to the system prompt
                  </span>
                  {showNodes
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                <AnimatePresence>
                  {showNodes && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-border/50"
                    >
                      <div className="p-5 space-y-3">
                        {result.knowledge.nodes.map((node, i) => (
                          <div key={node.id}
                               className="flex items-start gap-3 bg-secondary/10 rounded-lg px-4 py-3">
                            <span className="font-mono text-[10px] text-muted-foreground/50 w-5 shrink-0 mt-0.5">
                              [{i + 1}]
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-mono text-foreground/90 leading-relaxed">
                                {node.content}
                              </p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className={cn(
                                  "font-mono text-[10px] px-1.5 py-0.5 rounded border",
                                  TYPE_COLORS[node.type] ?? "text-muted-foreground border-border"
                                )}>
                                  {node.type}
                                </span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  similarity {(node.similarity * 100).toFixed(0)}%
                                </span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  confidence {(node.confidence * 100).toFixed(0)}%
                                </span>
                                <span className="font-mono text-[10px] text-muted-foreground ml-auto">
                                  accessed {node.timesAccessed}×
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="pt-2">
                          <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-3.5 h-3.5 text-primary" />
                              <span className="font-mono text-[10px] text-primary uppercase tracking-wider">
                                injected system prompt (excerpt)
                              </span>
                            </div>
                            <p className="font-mono text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                              {"You are OmniLearn, an AI that reasons over a personal knowledge graph.\n\nRelevant knowledge retrieved for this query:\n"}
                              {result.knowledge.nodes.map((n, i) =>
                                `[${i + 1}] (${n.type}, confidence ${(n.confidence * 100).toFixed(0)}%) ${n.content}`
                              ).join("\n")}
                              {"\n\nUse this knowledge where applicable. Cite numbered sources inline (e.g. [1])."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {result && result.knowledge.nodesRetrieved === 0 && (
              <div className="bg-yellow-500/8 border border-yellow-500/30 rounded-xl px-5 py-4 font-mono text-sm text-yellow-400">
                <span className="font-bold">No knowledge nodes matched this query.</span>
                <span className="text-yellow-400/70 ml-2">
                  Train the engine on relevant content in the Intelligence tab, then retry.
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* How it works */}
      {!result && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          {[
            { icon: Zap,      color: "#22d3ee", title: "Path A — Baseline",
              body: "Your question goes directly to Omni with no additional context. This is the control." },
            { icon: Brain,    color: "#a78bfa", title: "Path B — Augmented",
              body: "OmniLearn retrieves the top matching knowledge nodes and prepends them as a system prompt before Omni responds." },
            { icon: BarChart3,color: "#34d399", title: "The delta",
              body: "Word count, sentence depth, knowledge terms used, and inline citations all measure how much the context improved the answer." },
          ].map(c => (
            <div key={c.title} className="bg-card border border-border rounded-xl p-5">
              <c.icon className="w-5 h-5 mb-3" style={{ color: c.color }} />
              <p className="font-mono text-sm font-bold mb-2">{c.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
