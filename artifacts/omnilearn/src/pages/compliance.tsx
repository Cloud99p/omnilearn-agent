import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, CheckCircle, XCircle, Clock, AlertTriangle, ChevronRight, RotateCcw, Zap } from "lucide-react";

type StepStatus = "pending" | "running" | "pass" | "fail" | "warn" | "skip";
type EthicsMode = "strict" | "researcher";

interface AuditStep {
  id: string;
  label: string;
  check: string;
  pass: (url: string, mode: EthicsMode, rps: number) => { status: StepStatus; detail: string };
}

const AUDIT_STEPS: AuditStep[] = [
  {
    id: "url_parse",
    label: "URL validation",
    check: "Is the URL well-formed and reachable?",
    pass: (url) => {
      try {
        const u = new URL(url);
        if (!["http:", "https:"].includes(u.protocol)) {
          return { status: "fail", detail: `Protocol '${u.protocol}' is not supported. Only http/https allowed.` };
        }
        return { status: "pass", detail: `Parsed: ${u.hostname} — path: ${u.pathname || "/"}` };
      } catch {
        return { status: "fail", detail: "Malformed URL — could not parse hostname or path." };
      }
    },
  },
  {
    id: "blocklist",
    label: "Domain blocklist",
    check: "Is this domain explicitly blocked in config?",
    pass: (url) => {
      const BLOCKED = ["example-malicious.com", "banned-scrape.net", "localhost", "127.0.0.1"];
      try {
        const host = new URL(url).hostname;
        const match = BLOCKED.find(b => host.includes(b));
        if (match) return { status: "fail", detail: `Domain '${host}' matches blocklist entry '${match}'. Ingestion denied.` };
        return { status: "pass", detail: `'${host}' not found in blocked_domains list.` };
      } catch {
        return { status: "skip", detail: "URL parse failed upstream — skipping blocklist check." };
      }
    },
  },
  {
    id: "robots",
    label: "robots.txt compliance",
    check: "Does the site's robots.txt permit crawling?",
    pass: (url, mode) => {
      try {
        const host = new URL(url).hostname;
        // Simulate robots.txt rules based on known patterns
        const DISALLOWED_PATTERNS = ["/private", "/admin", "/internal", "/wp-admin"];
        const path = new URL(url).pathname;
        const blocked = DISALLOWED_PATTERNS.find(p => path.startsWith(p));
        if (blocked) {
          if (mode === "researcher") {
            return { status: "warn", detail: `Path '${path}' is disallowed by robots.txt. Mode=researcher: logged warning, ingestion proceeds with reduced trust score.` };
          }
          return { status: "fail", detail: `Path '${path}' is disallowed by robots.txt for user-agent '*'. Ingestion blocked. Set ethics.mode=researcher to override with audit trail.` };
        }
        return { status: "pass", detail: `robots.txt for '${host}' permits crawling '${path}'. No Disallow rules matched.` };
      } catch {
        return { status: "skip", detail: "Could not resolve robots.txt — defaulting to deny." };
      }
    },
  },
  {
    id: "noindex",
    label: "noindex meta tag",
    check: "Does the page declare X-Robots-Tag: noindex?",
    pass: (url) => {
      // Simulate noindex detection based on URL heuristics
      const path = new URL(url).pathname;
      if (path.includes("search") || path.includes("?q=") || path.includes("preview")) {
        return { status: "warn", detail: "Path pattern suggests dynamic/search content. Noindex likely present. Flagged for manual review — content stored with low trust score." };
      }
      return { status: "pass", detail: "No noindex signal detected in path or query string. Content eligible for indexing." };
    },
  },
  {
    id: "rate_limit",
    label: "Rate limit check",
    check: "Is this domain within the configured requests-per-second ceiling?",
    pass: (url, _mode, rps) => {
      try {
        const host = new URL(url).hostname;
        // Simulate a domain-specific current RPS counter
        const simulated = parseFloat((Math.random() * rps * 1.4).toFixed(2));
        if (simulated > rps) {
          return { status: "warn", detail: `'${host}' is at ${simulated} req/s — exceeds limit of ${rps} req/s. Request queued with ${((simulated / rps) * 1000).toFixed(0)}ms backoff delay.` };
        }
        return { status: "pass", detail: `'${host}' at ${simulated} req/s — within limit of ${rps} req/s. Proceeding immediately.` };
      } catch {
        return { status: "skip", detail: "Domain parse failed — rate limit skipped." };
      }
    },
  },
  {
    id: "ethics",
    label: "Ethics governor",
    check: "Does content pass the configured ethics mode filter?",
    pass: (url, mode) => {
      const path = new URL(url).pathname.toLowerCase();
      const SENSITIVE = ["hate", "weapon", "exploit", "tor", "dark", "illegal"];
      const match = SENSITIVE.find(k => path.includes(k) || url.toLowerCase().includes(k));
      if (match) {
        return { status: "fail", detail: `Content signal '${match}' detected. Blocked under all ethics modes — this category is not governed by ethics.mode setting.` };
      }
      if (mode === "strict") {
        return { status: "pass", detail: "Mode=strict: content passed all politeness and safety filters. Full trust score assigned." };
      }
      return { status: "pass", detail: "Mode=researcher: relaxed politeness applied. Content eligible for ingestion with standard audit trail." };
    },
  },
  {
    id: "trust_score",
    label: "Trust score assignment",
    check: "What trust tier is assigned to this content?",
    pass: (url, mode) => {
      try {
        const host = new URL(url).hostname;
        const TRUSTED = ["wikipedia.org", "arxiv.org", "github.com", "gov", "edu", "nature.com", "pubmed"];
        const tier = TRUSTED.some(t => host.includes(t)) ? "HIGH" : mode === "strict" ? "MEDIUM" : "LOW-MEDIUM";
        const score = tier === "HIGH" ? "0.91" : tier === "MEDIUM" ? "0.67" : "0.52";
        return { status: "pass", detail: `Trust tier: ${tier} (score: ${score}). Tier determines hot/warm/cold storage placement and retrieval weight in RAG queries.` };
      } catch {
        return { status: "fail", detail: "Could not compute trust score — invalid URL." };
      }
    },
  },
];

const SAMPLE_URLS = [
  "https://arxiv.org/abs/2404.01234",
  "https://en.wikipedia.org/wiki/Artificial_intelligence",
  "https://example-malicious.com/data",
  "https://news.ycombinator.com/item?id=12345",
  "https://somesite.com/admin/export",
  "https://github.com/openai/gpt-2",
  "https://darkweb-exploit.com/tools",
];

const STATUS_ICON = {
  pending: Clock,
  running: Zap,
  pass: CheckCircle,
  fail: XCircle,
  warn: AlertTriangle,
  skip: ChevronRight,
};

const STATUS_STYLE: Record<StepStatus, string> = {
  pending: "text-muted-foreground border-border bg-transparent",
  running: "text-primary border-primary/30 bg-primary/5 animate-pulse",
  pass:    "text-green-400 border-green-400/20 bg-green-400/5",
  fail:    "text-red-400 border-red-400/20 bg-red-400/5",
  warn:    "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
  skip:    "text-muted-foreground border-border/30 bg-transparent opacity-50",
};

const STATUS_DOT: Record<StepStatus, string> = {
  pending: "bg-border",
  running: "bg-primary animate-ping",
  pass:    "bg-green-400",
  fail:    "bg-red-400",
  warn:    "bg-yellow-400",
  skip:    "bg-muted-foreground",
};

const VERDICT: Record<StepStatus, string> = {
  pass: "ALLOWED",
  fail: "BLOCKED",
  warn: "FLAGGED",
  skip: "SKIPPED",
  pending: "",
  running: "",
};

interface StepResult {
  status: StepStatus;
  detail: string;
}

export default function Compliance() {
  const [url, setUrl] = useState(SAMPLE_URLS[0]);
  const [customUrl, setCustomUrl] = useState("");
  const [mode, setMode] = useState<EthicsMode>("strict");
  const [rps, setRps] = useState(2);
  const [results, setResults] = useState<Record<string, StepResult>>({});
  const [runningStep, setRunningStep] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const stepRef = useRef(0);

  const activeUrl = customUrl.trim() || url;

  const reset = () => {
    setResults({});
    setRunningStep(null);
    setRunning(false);
    setDone(false);
    stepRef.current = 0;
  };

  useEffect(() => { reset(); }, [url, customUrl, mode, rps]);

  const runAudit = async () => {
    reset();
    setRunning(true);
    for (let i = 0; i < AUDIT_STEPS.length; i++) {
      const step = AUDIT_STEPS[i];
      setRunningStep(step.id);
      await new Promise(r => setTimeout(r, 520 + Math.random() * 300));
      const result = step.pass(activeUrl, mode, rps);
      setResults(prev => ({ ...prev, [step.id]: result }));
      setRunningStep(null);
      if (result.status === "fail") {
        setDone(true);
        setRunning(false);
        return;
      }
    }
    setDone(true);
    setRunning(false);
  };

  const completedResults = Object.values(results);
  const finalVerdict = completedResults.some(r => r.status === "fail")
    ? "fail"
    : completedResults.some(r => r.status === "warn")
    ? "warn"
    : completedResults.length === AUDIT_STEPS.length
    ? "pass"
    : null;

  return (
    <div className="p-6 md:p-12 max-w-5xl mx-auto min-h-screen">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Compliance Explorer</h1>
        <p className="text-xl text-muted-foreground font-mono">
          Simulate the ethics governor — step-by-step audit of any URL before ingestion.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <p className="font-mono text-xs text-primary uppercase tracking-wider">Audit target</p>

            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground">sample URLs</p>
              {SAMPLE_URLS.map(s => (
                <button
                  key={s}
                  data-testid={`sample-${s}`}
                  onClick={() => { setUrl(s); setCustomUrl(""); }}
                  className={`w-full text-left font-mono text-xs px-3 py-2 rounded border transition-colors truncate ${
                    url === s && !customUrl ? "border-primary/30 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                  }`}
                >
                  {s.replace("https://", "")}
                </button>
              ))}
            </div>

            <div>
              <p className="font-mono text-xs text-muted-foreground mb-1">or enter a URL</p>
              <input
                data-testid="input-custom-url"
                type="text"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                placeholder="https://example.com/path"
                className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <p className="font-mono text-xs text-primary uppercase tracking-wider">Ethics config</p>

            <div>
              <p className="font-mono text-xs text-muted-foreground mb-2">ethics.mode</p>
              <div className="flex gap-2">
                {(["strict", "researcher"] as EthicsMode[]).map(m => (
                  <button
                    key={m}
                    data-testid={`mode-${m}`}
                    onClick={() => setMode(m)}
                    className={`flex-1 font-mono text-xs py-2 rounded border transition-colors ${
                      mode === m
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <p className="font-mono text-[10px] text-muted-foreground mt-2">
                {mode === "strict"
                  ? "Maximum politeness. robots.txt blocks are hard stops."
                  : "Broader access. robots.txt blocks log a warning, not a failure."}
              </p>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <p className="font-mono text-xs text-muted-foreground">ethics.rate_limit_rps</p>
                <span className="font-mono text-xs text-primary">{rps} req/s</span>
              </div>
              <input
                data-testid="input-rps"
                type="range"
                min={0.5}
                max={10}
                step={0.5}
                value={rps}
                onChange={e => setRps(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground mt-1">
                <span>0.5 (polite)</span>
                <span>10 (aggressive)</span>
              </div>
            </div>
          </div>

          <button
            data-testid="btn-run-audit"
            onClick={runAudit}
            disabled={running}
            className="w-full font-mono text-sm py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            {running ? "Auditing..." : done ? "Run again" : "Run compliance audit"}
          </button>

          {done && (
            <button
              data-testid="btn-reset"
              onClick={reset}
              className="w-full font-mono text-xs py-2 rounded border border-border text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-3 h-3" />
              reset
            </button>
          )}
        </div>

        {/* Audit trail */}
        <div className="lg:col-span-2 space-y-4">
          {/* Verdict banner */}
          <AnimatePresence>
            {finalVerdict && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`border rounded-lg p-4 flex items-center gap-3 ${
                  finalVerdict === "pass" ? "bg-green-400/5 border-green-400/20 text-green-400" :
                  finalVerdict === "fail" ? "bg-red-400/5 border-red-400/20 text-red-400" :
                  "bg-yellow-400/5 border-yellow-400/20 text-yellow-400"
                }`}
              >
                {finalVerdict === "pass" ? <CheckCircle className="w-5 h-5 shrink-0" /> :
                 finalVerdict === "fail" ? <XCircle className="w-5 h-5 shrink-0" /> :
                 <AlertTriangle className="w-5 h-5 shrink-0" />}
                <div>
                  <div className="font-mono font-bold text-sm">
                    {finalVerdict === "pass" ? "INGESTION ALLOWED" :
                     finalVerdict === "fail" ? "INGESTION BLOCKED" :
                     "INGESTION FLAGGED — REDUCED TRUST"}
                  </div>
                  <div className="font-mono text-xs opacity-70 truncate mt-0.5">{activeUrl}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Steps */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm">compliance_audit.log</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {completedResults.length}/{AUDIT_STEPS.length} checks
              </span>
            </div>

            <div className="divide-y divide-border/50">
              {AUDIT_STEPS.map((step, i) => {
                const result = results[step.id];
                const isRunning = runningStep === step.id;
                const status: StepStatus = isRunning ? "running" : result?.status ?? "pending";
                const Icon = STATUS_ICON[status];
                const isTerminal = result?.status === "fail";

                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0.4 }}
                    animate={{ opacity: status === "pending" ? 0.4 : 1 }}
                    className="px-5 py-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center gap-1 pt-0.5">
                        <div className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
                        {i < AUDIT_STEPS.length - 1 && (
                          <div className={`w-px flex-1 min-h-[20px] ${result ? "bg-border" : "bg-border/30"}`} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}.</span>
                          <span className="font-mono text-sm font-bold text-foreground">{step.label}</span>
                          {result && (
                            <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${STATUS_STYLE[result.status]}`}>
                              {VERDICT[result.status]}
                            </span>
                          )}
                          {isRunning && (
                            <span className="font-mono text-[10px] text-primary animate-pulse">checking...</span>
                          )}
                        </div>

                        <p className="font-mono text-xs text-muted-foreground mb-1">{step.check}</p>

                        <AnimatePresence>
                          {result && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className={`mt-2 rounded px-3 py-2 border font-mono text-xs leading-relaxed ${STATUS_STYLE[result.status]}`}
                            >
                              <Icon className="w-3 h-3 inline-block mr-1.5 mb-0.5" />
                              {result.detail}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {isTerminal && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-2 font-mono text-[10px] text-red-400/60"
                          >
                            Pipeline halted. Remaining checks skipped.
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* How it works note */}
          {!running && !done && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card/30 border border-border/40 rounded-lg p-4"
            >
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3">How the compliance pipeline works</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>Each URL passes through 7 gates before data enters the ingestion pipeline. Any hard <span className="text-red-400">BLOCK</span> halts the pipeline immediately — remaining checks are skipped.</p>
                <p>A <span className="text-yellow-400">WARN</span> in <code className="text-primary">researcher</code> mode still allows ingestion, but assigns a reduced trust score that lowers the content's weight in RAG retrieval.</p>
                <p>Trust scores determine storage tier placement: HIGH → hot cache, MEDIUM → warm index, LOW → cold archive or discard.</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
