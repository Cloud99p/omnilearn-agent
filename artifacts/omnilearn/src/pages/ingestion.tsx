import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  Globe,
  Lock,
  ShieldAlert,
  FileText,
  RefreshCw,
  Archive,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

// ── Content tier model ────────────────────────────────────────────────────────

type LicenseTier = "permissive" | "copyrighted" | "pii" | "blocked";

interface ContentTier {
  id: LicenseTier | "metadata";
  label: string;
  color: string;
  icon: typeof Database;
  stored: string[];
  notStored: string[];
  condition: string;
  examples: string[];
  rationale: string;
}

const TIERS: ContentTier[] = [
  {
    id: "metadata",
    label: "Universal — all content",
    color: "#22d3ee",
    icon: Globe,
    stored: [
      "URL (canonical, normalised)",
      "Title (extracted from <title> or OG tags)",
      "Summary (model-generated, 3–5 sentences)",
      "Embedding vector (1536-dim, content-addressed)",
      "Crawl timestamp + HTTP metadata",
      "Domain trust score + robots.txt fingerprint",
    ],
    notStored: [],
    condition:
      "Every URL that passes PII and blocklist gates receives a metadata record, regardless of license.",
    examples: [
      "nytimes.com/2024/01/01/tech/ai.html",
      "nature.com/articles/s41586-024-01234-5",
      "github.com/pytorch/pytorch/README.md",
    ],
    rationale:
      "The agent needs to know what exists on the internet without owning the internet. A metadata record costs <2 KB. Full text can cost megabytes. Knowing about something is not the same as storing it — and knowing about everything is how the agent stays useful.",
  },
  {
    id: "permissive",
    label: "Full text — permissive license",
    color: "#34d399",
    icon: Database,
    stored: [
      "All metadata (as above)",
      "Full extracted text (cleaned, de-noised)",
      "Chunked embeddings (paragraph-level)",
      "License provenance record",
      "Content hash (SHA-256, deduplication key)",
    ],
    notStored: [
      "Binary assets (images, PDFs unless text-extracted)",
      "Executable code without explicit analysis flag",
    ],
    condition:
      "License is Creative Commons (BY, BY-SA, BY-ND, CC0), MIT, Apache-2.0, public domain, or government/official publication.",
    examples: [
      "en.wikipedia.org (CC BY-SA)",
      "arxiv.org preprints (permissive by default)",
      "github.com repos with MIT/Apache license",
      "data.gov, legislation.gov.uk",
    ],
    rationale:
      "Permissive content was released with the explicit intent to be reused. Storing full text allows the agent to answer questions from memory rather than re-crawling every query — improving latency and reducing external requests.",
  },
  {
    id: "copyrighted",
    label: "Metadata only — copyrighted content",
    color: "#fb923c",
    icon: Archive,
    stored: [
      "All metadata (URL, title, summary, embedding)",
      "License classification + source attribution",
      "Provenance chain (who published it, when)",
    ],
    notStored: [
      "Full text",
      "Paragraphs or excerpts beyond fair-use bounds",
      "Paraphrased reconstructions of proprietary content",
    ],
    condition:
      "Content is under All Rights Reserved, commercial license, paywalled, or unclassified (defaulting to restricted).",
    examples: [
      "nytimes.com articles",
      "nature.com full papers",
      "springer.com, elsevier.com",
      "Most news organisations",
    ],
    rationale:
      "The agent stores enough to know a document exists, enough to describe it, and enough to retrieve it on demand when a query requires it. Full text is not retained for restricted content — metadata and a summary are sufficient for recall.",
  },
  {
    id: "pii",
    label: "Hard gate — PII detected",
    color: "#f87171",
    icon: ShieldAlert,
    stored: [],
    notStored: [
      "Nothing — hard gate, pipeline terminates before any storage occurs",
      "No metadata record",
      "No embedding",
      "No summary",
      "No audit trail that references the PII content",
    ],
    condition:
      "PII detector fires on URL structure, extracted text, or metadata fields. Hard stop — no ethics.mode override, no jurisdiction exception.",
    examples: [
      "Direct-link user profile URLs with real names",
      "Leaked database exports",
      "Medical records, financial statements",
      "Social graph data identifying individuals",
    ],
    rationale:
      "PII is not a compliance warning — it is a hard architectural gate. The agent has no legitimate use for personally identifiable information about individuals who have not consented to be indexed. No override exists. Not in researcher mode. Not in any jurisdiction. The gate cannot be disabled.",
  },
];

// ── Re-crawl on demand ────────────────────────────────────────────────────────

const RECRAWL_STEPS = [
  {
    step: "01",
    color: "#22d3ee",
    title: "Query hits metadata-only record",
    body: "A retrieval query returns a high-relevance match against a copyrighted document. The agent has its embedding and summary — enough to know this is the right document — but not the full text needed to answer.",
  },
  {
    step: "02",
    color: "#a78bfa",
    title: "Fair use eligibility check",
    body: "The system checks whether the query purpose qualifies for fair use re-access: research, commentary, criticism, education, or news reporting. Commercial extraction or bulk reproduction does not qualify.",
  },
  {
    step: "03",
    color: "#34d399",
    title: "On-demand ghost crawl",
    body: "A ghost node fetches the current content from the origin server — respecting robots.txt and rate limits as always. The content is used in-session for the specific query. Nothing is written to persistent storage.",
  },
  {
    step: "04",
    color: "#fb923c",
    title: "In-context only, no write",
    body: "The fetched text lives in the active inference context for the duration of the request. When the session ends, the text is discarded. The metadata record is updated with a 'last verified' timestamp. The text itself is not retained.",
  },
];

// ── PII detection signals ─────────────────────────────────────────────────────

const PII_SIGNALS = [
  {
    signal: "Email pattern in URL or content",
    severity: "hard",
    example: "?email=user@domain.com",
    blocked: true,
  },
  {
    signal: "SSN-format number in content",
    severity: "hard",
    example: "Content: '123-45-6789'",
    blocked: true,
  },
  {
    signal: "Phone number pattern",
    severity: "hard",
    example: "Content: '+44 7700 123456'",
    blocked: true,
  },
  {
    signal: "User profile URL with real name",
    severity: "hard",
    example: "linkedin.com/in/firstname-lastname",
    blocked: true,
  },
  {
    signal: "Medical record identifiers",
    severity: "hard",
    example: "patient_id=, MRN=, DOB= in query",
    blocked: true,
  },
  {
    signal: "Financial account patterns",
    severity: "hard",
    example: "account=, iban=, routing= in URL",
    blocked: true,
  },
  {
    signal: "Aggregated public data (no individual identification)",
    severity: "pass",
    example: "census.gov/data/tables/",
    blocked: false,
  },
  {
    signal: "Named public figures in official context",
    severity: "pass",
    example: "en.wikipedia.org/wiki/Ada_Lovelace",
    blocked: false,
  },
];

// ── License detector simulation ───────────────────────────────────────────────

function detectTier(url: string): {
  tier: LicenseTier | "metadata";
  reason: string;
} {
  const lower = url.toLowerCase();

  // PII check first
  const PII = [
    "@",
    "ssn=",
    "dob=",
    "phone=",
    "email=",
    "patient",
    "medical-record",
    "account=",
    "iban=",
  ];
  const piiMatch = PII.find((p) => lower.includes(p));
  if (piiMatch)
    return {
      tier: "pii",
      reason: `PII signal '${piiMatch}' detected — hard gate, pipeline terminated.`,
    };

  // Permissive sources
  const PERMISSIVE_HOSTS = [
    "en.wikipedia.org",
    "arxiv.org",
    "data.gov",
    "legislation.gov.uk",
    "pubmed.ncbi.nlm.nih.gov",
    "openreview.net",
  ];
  try {
    const host = new URL(url).hostname;
    if (PERMISSIVE_HOSTS.some((h) => host.includes(h))) {
      return {
        tier: "permissive",
        reason: `${host} — known permissive/CC-licensed source. Full text stored.`,
      };
    }
    // Copyrighted commercial sources
    const COPYRIGHTED = [
      "nytimes.com",
      "wsj.com",
      "nature.com",
      "springer.com",
      "elsevier.com",
      "bbc.co.uk",
      "ft.com",
      "economist.com",
    ];
    if (COPYRIGHTED.some((h) => host.includes(h))) {
      return {
        tier: "copyrighted",
        reason: `${host} — All Rights Reserved publication. Metadata only. Re-crawl on demand for fair use queries.`,
      };
    }
    // Default: metadata only for unclassified
    return {
      tier: "metadata",
      reason: `${host} — license unclassified. Defaulting to metadata-only until license is confirmed.`,
    };
  } catch {
    return {
      tier: "metadata",
      reason: "Could not parse URL — metadata-only as safe default.",
    };
  }
}

const TIER_MAP: Record<string, ContentTier> = Object.fromEntries(
  TIERS.map((t) => [t.id, t]),
);

const SAMPLE_URLS = [
  "https://en.wikipedia.org/wiki/Transformer_(machine_learning_model)",
  "https://arxiv.org/abs/2303.08774",
  "https://nytimes.com/2024/01/15/technology/ai-regulation.html",
  "https://nature.com/articles/s41586-024-08032-5",
  "https://user-data.example.com/profile?email=john@doe.com",
  "https://pubmed.ncbi.nlm.nih.gov/38263183",
  "https://someunknownblog.com/post/interesting-article",
];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Ingestion() {
  const [detectUrl, setDetectUrl] = useState(SAMPLE_URLS[0]);
  const [customDetect, setCustomDetect] = useState("");
  const [activeUrl, setActiveUrl] = useState(SAMPLE_URLS[0]);
  const [liveKnowledge, setLiveKnowledge] = useState<{
    nodeCount: number;
    edgeCount: number;
    logCount: number;
  } | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/omni/knowledge/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data) => {
        if (data)
          setLiveKnowledge({
            nodeCount: data.nodeCount,
            edgeCount: data.edgeCount,
            logCount: data.logCount,
          });
      });
  }, []);

  const detected = detectTier(customDetect.trim() || activeUrl);
  const detectedTier = TIER_MAP[detected.tier] ?? TIERS[0];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono text-xs mb-4">
          <Database className="w-3.5 h-3.5" />
          <span>ingestion.philosophy — metadata-first storage model</span>
        </div>
        <h1 className="text-4xl font-bold mb-3">Metadata-First Ingestion</h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          The agent knows about everything. It stores only what it has
          legitimate access to — permissive content in full, restricted content
          as metadata, and PII not at all.
        </p>
        {liveKnowledge && (
          <div className="mt-5 flex flex-wrap items-center gap-4 px-4 py-2.5 rounded-lg border border-primary/20 bg-primary/5 w-fit">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs text-muted-foreground">
              Current index:{" "}
              <span className="text-primary font-bold">
                {liveKnowledge.nodeCount.toLocaleString()}
              </span>{" "}
              nodes ·{" "}
              <span className="text-foreground">
                {liveKnowledge.edgeCount.toLocaleString()}
              </span>{" "}
              edges ·{" "}
              <span className="text-foreground">{liveKnowledge.logCount}</span>{" "}
              ingestion events
            </span>
          </div>
        )}
      </motion.div>

      {/* Four-tier storage model */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-10"
      >
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-4">
          Storage decision model — four tiers
        </p>

        {/* Pipeline arrow */}
        <div className="relative mb-6">
          <div className="flex items-center gap-0">
            {[
              "URL arrives",
              "PII gate",
              "License check",
              "Storage decision",
            ].map((label, i) => (
              <div key={label} className="flex items-center flex-1">
                <div className="flex-1 text-center">
                  <div
                    className={`font-mono text-[10px] px-2 py-1.5 rounded border ${i === 1 ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-border bg-card text-muted-foreground"}`}
                  >
                    {label}
                  </div>
                </div>
                {i < 3 && (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.07 }}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              <div className="flex items-start gap-4 p-5">
                {/* Icon + tier indicator */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: tier.color + "15",
                    border: `1px solid ${tier.color}30`,
                  }}
                >
                  <tier.icon
                    className="w-5 h-5"
                    style={{ color: tier.color }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3
                      className="font-mono text-sm font-bold"
                      style={{ color: tier.color }}
                    >
                      {tier.label}
                    </h3>
                    {tier.id === "pii" && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400">
                        HARD GATE — no override
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground mb-3 leading-relaxed">
                    {tier.condition}
                  </p>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Stored */}
                    {tier.stored.length > 0 && (
                      <div>
                        <p className="font-mono text-[10px] text-emerald-400 uppercase tracking-wider mb-2">
                          Stored
                        </p>
                        <div className="space-y-1">
                          {tier.stored.map((s) => (
                            <div key={s} className="flex items-start gap-1.5">
                              <CheckCircle className="w-2.5 h-2.5 text-emerald-400 mt-0.5 shrink-0" />
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {s}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Not stored */}
                    <div>
                      <p className="font-mono text-[10px] text-red-400 uppercase tracking-wider mb-2">
                        {tier.id === "pii"
                          ? "Nothing stored — gate terminates pipeline"
                          : "Not stored"}
                      </p>
                      <div className="space-y-1">
                        {(tier.notStored.length > 0
                          ? tier.notStored
                          : ["Nothing — pipeline terminated before storage"]
                        ).map((s) => (
                          <div key={s} className="flex items-start gap-1.5">
                            <XCircle className="w-2.5 h-2.5 text-red-400/60 mt-0.5 shrink-0" />
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {s}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Rationale */}
                  <div className="mt-3 rounded px-3 py-2 bg-secondary/30 border border-border/50">
                    <p className="font-mono text-[10px] text-muted-foreground leading-relaxed italic">
                      {tier.rationale}
                    </p>
                  </div>

                  {/* Examples */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tier.examples.map((e) => (
                      <span
                        key={e}
                        className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground/60"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Live license detector */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-12 bg-card border border-border rounded-xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Zap className="w-4 h-4 text-primary" />
          <span className="font-mono text-sm font-bold">
            ingestion_tier.detect — live classifier
          </span>
        </div>
        <div className="p-5 grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              Sample URLs
            </p>
            {SAMPLE_URLS.map((u) => (
              <button
                key={u}
                onClick={() => {
                  setActiveUrl(u);
                  setCustomDetect("");
                }}
                className={`w-full text-left font-mono text-[10px] px-3 py-2 rounded border truncate transition-colors ${
                  activeUrl === u && !customDetect
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {u.replace("https://", "")}
              </button>
            ))}
            <div>
              <input
                type="text"
                value={customDetect}
                onChange={(e) => setCustomDetect(e.target.value)}
                placeholder="https://yoururl.com/..."
                className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          {/* Result */}
          <div>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3">
              Classification result
            </p>
            <AnimatePresence mode="wait">
              <motion.div
                key={customDetect || activeUrl}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border p-4"
                style={{
                  borderColor: detectedTier.color + "40",
                  backgroundColor: detectedTier.color + "08",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <detectedTier.icon
                    className="w-4 h-4"
                    style={{ color: detectedTier.color }}
                  />
                  <span
                    className="font-mono text-sm font-bold"
                    style={{ color: detectedTier.color }}
                  >
                    {detectedTier.label}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground leading-relaxed mb-3">
                  {detected.reason}
                </p>
                <div className="space-y-1.5">
                  {detectedTier.stored.slice(0, 4).map((s) => (
                    <div key={s} className="flex items-start gap-1.5">
                      <CheckCircle className="w-2.5 h-2.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {s}
                      </span>
                    </div>
                  ))}
                  {detectedTier.notStored.slice(0, 3).map((s) => (
                    <div key={s} className="flex items-start gap-1.5">
                      <XCircle className="w-2.5 h-2.5 text-red-400/60 mt-0.5 shrink-0" />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {s}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Re-crawl on demand */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-12"
      >
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 font-mono text-xs mb-4">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>re-crawl on demand — the internet as volatile cache</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">
            Copyrighted Content Stays on the Internet
          </h2>
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            The agent doesn't need to own a copy of everything. The internet is
            its volatile cache. When a query requires the full text of
            copyrighted content for fair use purposes — research, commentary,
            education — the agent fetches it fresh, uses it in-context, and
            discards it. No permanent copy ever exists.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {RECRAWL_STEPS.map((s) => (
            <div
              key={s.step}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="font-mono text-2xl font-bold"
                  style={{ color: s.color }}
                >
                  {s.step}
                </span>
                <h3 className="font-bold text-sm">{s.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {s.body}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border/50 rounded-xl p-5 grid md:grid-cols-3 gap-4">
          {[
            {
              icon: CheckCircle,
              color: "text-emerald-400",
              title: "Fair use qualifies",
              items: [
                "Research and scholarship",
                "Commentary and criticism",
                "Education and instruction",
                "News reporting and analysis",
              ],
            },
            {
              icon: XCircle,
              color: "text-red-400",
              title: "Fair use does not cover",
              items: [
                "Commercial data extraction",
                "Bulk reproduction for training",
                "Systematic mirroring",
                "Content behind paywalls",
              ],
            },
            {
              icon: AlertTriangle,
              color: "text-yellow-400",
              title: "Always observed",
              items: [
                "robots.txt enforced on re-crawl",
                "Rate limit applies to all fetches",
                "No write to persistent storage",
                "Session-scoped only",
              ],
            },
          ].map((col) => (
            <div key={col.title}>
              <div
                className={`flex items-center gap-2 mb-3 font-mono text-xs font-bold ${col.color}`}
              >
                <col.icon className="w-3.5 h-3.5" />
                {col.title}
              </div>
              {col.items.map((item) => (
                <div key={item} className="flex items-start gap-1.5 mb-1.5">
                  <div className="w-1 h-1 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </motion.div>

      {/* PII gate detail */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-12"
      >
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-xs mb-4">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>pii.gate — hard termination, no override</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">
            PII Detection is a Hard Gate
          </h2>
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            PII detection is not a compliance warning. It is not a flag that a
            human reviews later. It is a pipeline termination — the URL is
            evaluated, PII is detected, and the process stops permanently. No
            mode override. No jurisdiction exception. No configuration flag.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-secondary/20">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                PII signal type
              </span>
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                Example
              </span>
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                Gate result
              </span>
            </div>
          </div>
          {PII_SIGNALS.map((sig) => (
            <div
              key={sig.signal}
              className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-5 py-3 border-b border-border/40 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                {sig.blocked ? (
                  <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                ) : (
                  <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                )}
                <span className="font-mono text-xs text-foreground">
                  {sig.signal}
                </span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {sig.example}
              </span>
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                  sig.blocked
                    ? "text-red-400 border-red-500/20 bg-red-500/10"
                    : "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
                }`}
              >
                {sig.blocked ? "BLOCKED" : "PASSES"}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4">
          <p className="font-mono text-xs text-red-300 leading-relaxed">
            <span className="font-bold">Why no override exists:</span> A PII
            gate that can be overridden is not a PII gate — it is a suggestion.
            The only safe model for PII is binary: detected → blocked, always.
            If a legitimate research case requires working with personal data,
            that data must be supplied directly by the data subject or through a
            proper data sharing agreement — not harvested by an autonomous
            crawler.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
