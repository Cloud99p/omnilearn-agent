import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, ChevronRight } from "lucide-react";

const CONFIG_YAML = `# OmniLearn Configuration v1.0
# All changes are hot-reloaded and diff-tracked

# ─── Data Sources ────────────────────────────────────────────────
data_sources:
  - name: wikipedia
    type: crawler
    seed_urls:
      - https://en.wikipedia.org/wiki/Main_Page
    max_depth: 3
    follow_external: false

  - name: arxiv_rss
    type: rss
    feed_url: https://arxiv.org/rss/cs.AI
    poll_interval_seconds: 3600

  - name: hacker_news
    type: api
    endpoint: https://hacker-news.firebaseio.com/v0
    fetch_top_n: 50
    poll_interval_seconds: 900

# ─── Model Configuration ─────────────────────────────────────────
model:
  name: meta-llama/Llama-3-8b-hf
  endpoint: local          # "local" | http://your-endpoint
  context_window: 8192
  quantization: q4_k_m    # None | q4_k_m | q8_0
  device: cuda             # cpu | cuda | mps

# ─── Learning Pipeline ───────────────────────────────────────────
learning:
  interval_seconds: 3600
  batch_size: 512
  mode: active             # passive | active | synthesis
  finetune:
    enabled: true
    trigger_after_docs: 10000
    method: lora
    lora_rank: 16
    epochs: 3
    learning_rate: 2e-4
  catastrophic_forgetting:
    strategy: lora_adapter  # lora_adapter | ewc | replay_buffer

# ─── Personality Parameters ──────────────────────────────────────
personality:
  curiosity: 0.8           # 0.0 → incurious  |  1.0 → hyper-curious
  skepticism: 0.6          # 0.0 → credulous   |  1.0 → deeply skeptical
  verbosity: 0.5           # 0.0 → terse       |  1.0 → expansive
  formality: 0.4           # 0.0 → casual      |  1.0 → academic
  persona_version: 12      # Snapshot ID for rollback

# ─── Hardware Constraints ────────────────────────────────────────
hardware:
  max_ram_gb: 64
  max_cpu_cores: 16
  gpu_enabled: true
  gpu_vram_gb: 24
  crawler_workers: 8

# ─── Ethical Boundaries ──────────────────────────────────────────
ethics:
  robots_txt_respect: true
  rate_limit_rps: 2        # Requests per second per domain
  noindex_respect: true
  mode: strict             # strict | researcher
  # NOTE: "researcher" mode still disables illegal activity.
  # It relaxes politeness delays and allows broader source access.
  blocked_domains:
    - example-malicious.com

# ─── Storage Tiers ───────────────────────────────────────────────
storage:
  hot_cache_gb: 8          # In-memory, fastest retrieval
  warm_index_gb: 100       # SSD-backed vector index
  cold_archive_gb: 2000    # Compressed disk archive
  eviction_policy: lru     # lru | priority | time_decay

# ─── Active Modules ──────────────────────────────────────────────
modules:
  data_ingestion: true
  knowledge_store: true
  learning_engine: true
  character_engine: true
  config_manager: true
  api_interface: true
  meta_cognitive: true
  compliance_layer: true
`;

const SCHEMA = [
  { field: "data_sources[].type", type: "string", default: "crawler", desc: "Connector type: crawler | rss | api | db" },
  { field: "data_sources[].max_depth", type: "integer", default: "3", desc: "Max link-follow depth for crawlers" },
  { field: "model.name", type: "string", default: "Llama-3-8b", desc: "HuggingFace model ID or local path" },
  { field: "model.endpoint", type: "string", default: "local", desc: "'local' or remote inference URL" },
  { field: "model.context_window", type: "integer", default: "8192", desc: "Token context window for the model" },
  { field: "model.quantization", type: "string | null", default: "q4_k_m", desc: "GGUF quant level. null for full precision" },
  { field: "learning.interval_seconds", type: "integer", default: "3600", desc: "How often the learning pipeline triggers" },
  { field: "learning.batch_size", type: "integer", default: "512", desc: "Documents per learning batch" },
  { field: "learning.mode", type: "string", default: "active", desc: "passive | active | synthesis" },
  { field: "learning.finetune.enabled", type: "boolean", default: "true", desc: "Whether to run periodic LoRA fine-tuning" },
  { field: "learning.finetune.lora_rank", type: "integer", default: "16", desc: "LoRA adapter rank. Higher = more parameters" },
  { field: "personality.curiosity", type: "float [0,1]", default: "0.8", desc: "Controls breadth of topic exploration" },
  { field: "personality.skepticism", type: "float [0,1]", default: "0.6", desc: "Source credibility weighting bias" },
  { field: "personality.verbosity", type: "float [0,1]", default: "0.5", desc: "Response length preference" },
  { field: "personality.persona_version", type: "integer", default: "latest", desc: "Snapshot ID to restore. Enables rollback" },
  { field: "hardware.max_ram_gb", type: "integer", default: "64", desc: "System RAM cap for OmniLearn processes" },
  { field: "hardware.gpu_enabled", type: "boolean", default: "true", desc: "Enable CUDA/MPS acceleration" },
  { field: "hardware.crawler_workers", type: "integer", default: "8", desc: "Concurrent crawler threads" },
  { field: "ethics.robots_txt_respect", type: "boolean", default: "true", desc: "Enforce robots.txt. Disabling may violate law" },
  { field: "ethics.rate_limit_rps", type: "float", default: "2.0", desc: "Max requests/sec per domain" },
  { field: "ethics.mode", type: "string", default: "strict", desc: "strict | researcher. Neither allows illegal activity" },
  { field: "storage.hot_cache_gb", type: "integer", default: "8", desc: "In-memory cache for most-accessed embeddings" },
  { field: "storage.warm_index_gb", type: "integer", default: "100", desc: "SSD-backed vector index size" },
  { field: "storage.eviction_policy", type: "string", default: "lru", desc: "lru | priority | time_decay" },
];

const SECTIONS = [
  { id: "data_sources", label: "data_sources", color: "text-yellow-400" },
  { id: "model", label: "model", color: "text-cyan-400" },
  { id: "learning", label: "learning", color: "text-violet-400" },
  { id: "personality", label: "personality", color: "text-green-400" },
  { id: "hardware", label: "hardware", color: "text-orange-400" },
  { id: "ethics", label: "ethics", color: "text-red-400" },
  { id: "storage", label: "storage", color: "text-blue-400" },
];

function highlight(yaml: string) {
  return yaml.split("\n").map((line, i) => {
    if (line.startsWith("#")) return <span key={i} className="text-muted-foreground/60">{line}{"\n"}</span>;
    if (line.match(/^[a-z_]+:/)) return <span key={i} className="text-cyan-400">{line}{"\n"}</span>;
    if (line.match(/^\s+[a-z_]+:/)) {
      const [key, ...rest] = line.split(":");
      const val = rest.join(":").trim();
      return <span key={i}><span className="text-blue-300">{key}</span><span className="text-muted-foreground">:</span> <span className="text-emerald-400">{val}</span>{"\n"}</span>;
    }
    if (line.match(/^\s+-/)) return <span key={i} className="text-violet-300">{line}{"\n"}</span>;
    return <span key={i} className="text-muted-foreground">{line}{"\n"}</span>;
  });
}

export default function Configuration() {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [tab, setTab] = useState<"yaml" | "schema">("yaml");

  return (
    <div className="p-6 md:p-12 max-w-6xl mx-auto min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <h1 className="text-4xl font-bold tracking-tight mb-4">Configuration System</h1>
        <p className="text-xl text-muted-foreground font-mono">
          Every parameter, live-reloaded, diff-tracked, schema-validated.
        </p>
      </motion.div>

      <div className="flex gap-6 flex-col lg:flex-row">
        <div className="lg:w-48 shrink-0">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3">Sections</p>
          <div className="space-y-1">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                data-testid={`section-${s.id}`}
                onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left font-mono text-sm transition-colors ${
                  activeSection === s.id ? "bg-secondary border border-border" : "hover:bg-secondary/50 text-muted-foreground"
                }`}
              >
                <ChevronRight className={`w-3 h-3 ${activeSection === s.id ? "rotate-90" : ""} transition-transform`} />
                <span className={activeSection === s.id ? s.color : ""}>{s.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-8 p-3 bg-card border border-border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="font-mono text-xs text-muted-foreground">Live reload</span>
            </div>
            <p className="text-xs text-muted-foreground">Changes detected via watchdog and applied without restart. Failures are rejected and logged.</p>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex gap-1 mb-4 bg-secondary/40 rounded-lg p-1 w-fit">
            {(["yaml", "schema"] as const).map(t => (
              <button
                key={t}
                data-testid={`tab-${t}`}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-md font-mono text-sm transition-colors ${
                  tab === t ? "bg-card text-foreground border border-border" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "yaml" ? "omni_config.yaml" : "schema reference"}
              </button>
            ))}
          </div>

          {tab === "yaml" ? (
            <motion.div
              key="yaml"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-background border border-border rounded-lg overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50">
                <Settings className="w-4 h-4 text-primary" />
                <span className="font-mono text-sm text-muted-foreground">omni_config.yaml</span>
                <span className="ml-auto font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">AGPLv3</span>
              </div>
              <pre className="p-5 text-xs font-mono overflow-x-auto leading-6 max-h-[600px] overflow-y-auto">
                <code>{highlight(CONFIG_YAML)}</code>
              </pre>
            </motion.div>
          ) : (
            <motion.div
              key="schema"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-background border border-border rounded-lg overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="border-b border-border bg-card/50">
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider">Field</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider">Default</th>
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SCHEMA.filter(s => !activeSection || s.field.startsWith(activeSection)).map((row, i) => (
                      <tr key={row.field} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-card/20"}`}>
                        <td className="px-4 py-2.5 text-cyan-400 text-xs whitespace-nowrap">{row.field}</td>
                        <td className="px-4 py-2.5 text-violet-400 text-xs whitespace-nowrap">{row.type}</td>
                        <td className="px-4 py-2.5 text-emerald-400 text-xs whitespace-nowrap">{row.default}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
