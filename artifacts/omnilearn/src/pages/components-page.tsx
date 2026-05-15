import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Database,
  BrainCircuit,
  Activity,
  Settings,
  Code,
  Zap,
  Shield,
  ChevronDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const MODULES = [
  {
    id: "ingestion",
    name: "Data Ingestion",
    icon: Globe,
    purpose:
      "Continuously crawls, scrapes, and streams public internet data — web pages, APIs, RSS feeds, scientific repositories, social media, government data, and more. Each source type is handled by a dedicated, swappable connector.",
    stack: [
      { name: "Scrapy", role: "Python-based web scraping framework" },
      { name: "Apache Nutch", role: "Distributed, extensible web crawler" },
      { name: "Heritrix", role: "Archival web crawler (Internet Archive)" },
      { name: "Apache Kafka", role: "Real-time data streaming pipeline" },
      { name: "RabbitMQ", role: "Message queue for connector coordination" },
    ],
    scaling:
      "Horizontal: deploy additional Scrapy spiders as containers. Kafka partitioning distributes load across workers. Connector registry allows hot-swapping without downtime.",
    pseudocode: `# Core ingestion loop
async def ingestion_loop(source_config):
    connector = registry.get(source_config.type)
    async for item in connector.stream():
        item = normalize(item)
        item = deduplicate(item, bloom_filter)
        if item:
            await kafka.produce('raw_data', item)`,
    resources: [
      { label: "Small (1 node)", cpu: 4, ram: 16, storage: 500 },
      { label: "Medium (4 nodes)", cpu: 16, ram: 64, storage: 5000 },
      { label: "Large (16 nodes)", cpu: 128, ram: 512, storage: 50000 },
    ],
  },
  {
    id: "knowledge",
    name: "Knowledge Store",
    icon: Database,
    purpose:
      "The persistent semantic memory of OmniLearn. Stores vectorized embeddings of all ingested content enabling semantic search, similarity queries, and structured knowledge retrieval at scale.",
    stack: [
      {
        name: "Chroma",
        role: "Embedded vector database for smaller deployments",
      },
      { name: "Weaviate", role: "Distributed vector search engine" },
      { name: "Qdrant", role: "High-performance vector similarity search" },
      { name: "FAISS", role: "Facebook AI's efficient similarity search" },
      { name: "PostgreSQL", role: "Relational store for metadata and indices" },
    ],
    scaling:
      "Vector stores support horizontal sharding. Hot/warm/cold tiering: recent embeddings in fast memory, older in compressed disk. Prioritization logic decides what stays hot.",
    pseudocode: `# Storage tiering logic
def store_with_priority(document, embedder):
    embedding = embedder.encode(document.text)
    priority = compute_priority(document)
    
    if priority > HOT_THRESHOLD:
        hot_cache.upsert(embedding, document)
    elif priority > WARM_THRESHOLD:
        warm_index.upsert(embedding, document)
    else:
        cold_archive.append(document.compress())`,
    resources: [
      { label: "Small", cpu: 2, ram: 32, storage: 2000 },
      { label: "Medium", cpu: 8, ram: 128, storage: 20000 },
      { label: "Large", cpu: 32, ram: 512, storage: 200000 },
    ],
  },
  {
    id: "learning",
    name: "Learning Engine",
    icon: BrainCircuit,
    purpose:
      "Transforms raw indexed data into structured knowledge. Runs three distinct modes: passive indexing (store everything), active extraction (pull entities, relationships, facts), and deep synthesis (cross-source reasoning and insight generation).",
    stack: [
      { name: "LangChain", role: "LLM orchestration and RAG pipelines" },
      { name: "LlamaIndex", role: "Data ingestion and indexing framework" },
      { name: "Haystack", role: "Production NLP pipeline framework" },
      { name: "Axolotl", role: "Fine-tuning with LoRA/QLoRA" },
      { name: "Unsloth", role: "2x faster fine-tuning, lower VRAM" },
    ],
    scaling:
      "Fine-tuning runs in isolated jobs on GPU nodes. RAG retrieval is stateless and horizontally scalable. Catastrophic forgetting mitigated via LoRA adapters — base model unchanged.",
    pseudocode: `# Learning mode dispatcher
def process_document(doc, mode):
    if mode == 'passive':
        return index_only(doc)
    elif mode == 'active':
        entities = extract_entities(doc)
        relations = extract_relations(doc)
        return update_knowledge_graph(entities, relations)
    elif mode == 'synthesis':
        context = retrieve_related(doc)
        insights = llm.synthesize(doc, context)
        return store_insights(insights)`,
    resources: [
      { label: "Small", cpu: 8, ram: 32, storage: 100 },
      { label: "Medium", cpu: 32, ram: 128, storage: 500 },
      { label: "Large", cpu: 128, ram: 512, storage: 5000 },
    ],
  },
  {
    id: "character",
    name: "Character Engine",
    icon: Activity,
    purpose:
      "Manages OmniLearn's evolving identity. A long-term persona prompt is augmented by a dynamic character state vector that updates permanently with each significant learning event. Core traits (curiosity, skepticism, empathy) are non-reversible. Surface traits (verbosity, formality) permit minor corrections within a bounded range. Snapshots are read-only records — not restore points.",
    stack: [
      { name: "Llama 3", role: "Primary open-weight language model" },
      { name: "Mistral", role: "Efficient alternative model" },
      { name: "Falcon", role: "Apache-licensed alternative" },
      { name: "HuggingFace Transformers", role: "Model loading and inference" },
      {
        name: "SQLite / PostgreSQL",
        role: "Immutable character history store",
      },
    ],
    scaling:
      "Character state is a lightweight JSON blob. Model inference scales via tensor parallelism across GPUs. Multiple persona variants can run concurrently for evaluation — but core trait divergence between variants is permanent once each variant accumulates experience.",
    pseudocode: `# Character update routine
CORE_TRAITS = {"curiosity", "skepticism", "empathy"}
SURFACE_TRAITS = {"verbosity", "formality"}
SURFACE_MAX_CORRECTION = 0.15

def update_character(learning_event, character_state):
    delta = compute_persona_delta(learning_event)
    
    # Stability gate: slow rate of change, never reverse it
    if drift_velocity(delta, character_state) > MAX_VELOCITY:
        delta = dampen_velocity(delta, factor=0.3)
    
    new_state = {}
    for trait, change in delta.items():
        if trait in CORE_TRAITS:
            # Core traits: always accumulate, never reduced by rollback
            new_state[trait] = character_state[trait] + change
        elif trait in SURFACE_TRAITS:
            # Surface traits: corrections capped at ±0.15 from current value
            new_state[trait] = clamp(
                character_state[trait] + change,
                character_state[trait] - SURFACE_MAX_CORRECTION,
                character_state[trait] + SURFACE_MAX_CORRECTION,
            )
    
    # Snapshot is append-only — no delete, no overwrite
    history_store.append_snapshot(new_state)
    return new_state

def apply_rollback_request(target_snapshot, current_state):
    """Rollback is filtered — core traits are always rejected."""
    adjusted = {}
    for trait, target_val in target_snapshot.items():
        if trait in CORE_TRAITS:
            # Silently reject — experience cannot be un-lived
            adjusted[trait] = current_state[trait]
        else:
            delta = target_val - current_state[trait]
            adjusted[trait] = clamp(
                current_state[trait] + delta,
                current_state[trait] - SURFACE_MAX_CORRECTION,
                current_state[trait] + SURFACE_MAX_CORRECTION,
            )
    return adjusted`,
    resources: [
      { label: "Small", cpu: 4, ram: 16, storage: 50 },
      { label: "Medium", cpu: 16, ram: 64, storage: 200 },
      { label: "Large", cpu: 64, ram: 256, storage: 1000 },
    ],
  },
  {
    id: "config",
    name: "Configuration Manager",
    icon: Settings,
    purpose:
      "The control plane of OmniLearn. Watches YAML/JSON config files for changes, validates against schema, and applies updates live without restarting the core loop. All changes are logged and diff-tracked.",
    stack: [
      { name: "Pydantic", role: "Config schema validation and type safety" },
      { name: "watchdog", role: "File system change detection" },
      { name: "PyYAML", role: "YAML parsing" },
      { name: "jsonpatch", role: "Diff and patch config changes" },
      { name: "structlog", role: "Structured audit logging" },
    ],
    scaling:
      "Stateful singleton per deployment. In a cluster, config is stored in a shared volume or etcd and changes broadcast via Kafka events to all nodes.",
    pseudocode: `# Live config watcher
class ConfigManager:
    def on_file_change(self, path):
        raw = yaml.safe_load(open(path))
        try:
            new_config = OmniConfig(**raw)  # Pydantic validation
        except ValidationError as e:
            logger.error("Invalid config", errors=e)
            return  # Reject bad config
        
        diff = jsonpatch.make_patch(self.current, new_config)
        self.apply(new_config)
        audit_log.record(diff, timestamp=now())`,
    resources: [
      { label: "Small", cpu: 1, ram: 2, storage: 1 },
      { label: "Medium", cpu: 1, ram: 2, storage: 1 },
      { label: "Large", cpu: 2, ram: 4, storage: 10 },
    ],
  },
  {
    id: "api",
    name: "Action / API Interface",
    icon: Code,
    purpose:
      "Exposes OmniLearn's capabilities to the outside world. REST and gRPC endpoints for querying knowledge, triggering ingestion, managing personas, and monitoring system state. Stateless and horizontally scalable.",
    stack: [
      { name: "FastAPI", role: "High-performance async REST API" },
      { name: "gRPC", role: "Low-latency RPC for internal services" },
      { name: "RabbitMQ", role: "Async task queue for background jobs" },
      { name: "Redis", role: "Response caching and rate limiting" },
      { name: "Uvicorn", role: "ASGI server for FastAPI" },
    ],
    scaling:
      "Stateless: spin up as many instances as needed behind a load balancer. Rate limiting enforced at this layer. Long-running jobs dispatched to Kafka queues.",
    pseudocode: `# Query endpoint
@app.post("/query")
async def query(request: QueryRequest):
    # Retrieve relevant context
    context = await knowledge_store.search(
        query=request.text, top_k=10
    )
    # Generate personality-inflected response
    response = await character_engine.respond(
        query=request.text,
        context=context,
        persona=current_persona()
    )
    return {"answer": response, "sources": context.sources}`,
    resources: [
      { label: "Small", cpu: 2, ram: 4, storage: 10 },
      { label: "Medium", cpu: 8, ram: 16, storage: 50 },
      { label: "Large", cpu: 32, ram: 64, storage: 500 },
    ],
  },
  {
    id: "metacog",
    name: "Meta-Cognitive Controller",
    icon: Zap,
    purpose:
      "OmniLearn's self-improvement loop. Monitors system performance, detects knowledge gaps, and autonomously triggers retraining or reconfiguration. All self-modifications are sandboxed before promotion.",
    stack: [
      { name: "MLflow", role: "Experiment tracking and model registry" },
      { name: "TensorBoard", role: "Training visualization" },
      { name: "Docker", role: "Sandbox isolation for experiments" },
      { name: "Prometheus", role: "Performance metrics collection" },
      { name: "Python scripting", role: "Custom meta-learning loops" },
    ],
    scaling:
      "Experiment sandboxes run as isolated containers. Promotion to production requires passing a benchmark suite. All experiments logged in MLflow with full reproducibility.",
    pseudocode: `# Meta-learning loop
async def meta_loop():
    while True:
        metrics = await monitor.collect()
        gaps = detect_knowledge_gaps(metrics)
        
        for gap in gaps:
            experiment = sandbox.create_experiment(gap)
            result = await experiment.run()
            
            if result.improvement > THRESHOLD:
                await promote_to_production(result)
            
            mlflow.log_experiment(experiment, result)
        
        await asyncio.sleep(META_LOOP_INTERVAL)`,
    resources: [
      { label: "Small", cpu: 4, ram: 16, storage: 200 },
      { label: "Medium", cpu: 16, ram: 64, storage: 1000 },
      { label: "Large", cpu: 64, ram: 256, storage: 10000 },
    ],
  },
  {
    id: "compliance",
    name: "Compliance Layer",
    icon: Shield,
    purpose:
      "Enforces ethical and legal boundaries: robots.txt respect, noindex tags, rate limits, terms of service constraints. An ethics governor configurable from 'strict politeness' to 'unfiltered researcher' — neither mode enables illegal activity.",
    stack: [
      { name: "reppy", role: "robots.txt parsing and enforcement" },
      { name: "aiohttp", role: "Rate-limited async HTTP requests" },
      { name: "Custom guardrails", role: "Output filtering and ethics checks" },
      {
        name: "urllib.robotparser",
        role: "Standard library robots.txt support",
      },
      { name: "structlog", role: "Compliance audit trail" },
    ],
    scaling:
      "Stateless filter layer. Deployed as middleware in the ingestion pipeline. Rate limit state stored in Redis for distributed coordination across crawler nodes.",
    pseudocode: `# Compliance gate
class ComplianceLayer:
    def check(self, url, content=None):
        # Robots.txt enforcement
        if not self.robots.can_fetch('*', url):
            return Blocked("robots.txt disallows")
        
        # Rate limiting
        if self.rate_limiter.is_throttled(url.domain):
            return Delayed(self.rate_limiter.wait_time(url.domain))
        
        # Ethics mode filter
        if content and self.ethics_mode == 'strict':
            if self.classifier.is_harmful(content):
                return Blocked("ethics governor")
        
        return Allowed()`,
    resources: [
      { label: "Small", cpu: 1, ram: 2, storage: 5 },
      { label: "Medium", cpu: 2, ram: 4, storage: 20 },
      { label: "Large", cpu: 8, ram: 16, storage: 100 },
    ],
  },
];

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(230 25% 9%)",
  border: "1px solid hsl(230 25% 15%)",
  color: "hsl(210 40% 98%)",
  fontFamily: "monospace",
  fontSize: "12px",
};

export default function ComponentsPage() {
  const [open, setOpen] = useState<string | null>("ingestion");

  return (
    <div className="p-6 md:p-12 max-w-5xl mx-auto min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Component Breakdown
        </h1>
        <p className="text-xl text-muted-foreground font-mono">
          8 modules. Each replaceable. Each open-source.
        </p>
      </motion.div>

      <div className="space-y-3">
        {MODULES.map((mod, i) => {
          const isOpen = open === mod.id;
          return (
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`border rounded-lg overflow-hidden transition-colors ${
                isOpen
                  ? "border-primary/50 bg-card"
                  : "border-border bg-card/40 hover:border-border/80"
              }`}
            >
              <button
                data-testid={`accordion-${mod.id}`}
                onClick={() => setOpen(isOpen ? null : mod.id)}
                className="w-full flex items-center gap-4 p-5 text-left"
              >
                <div
                  className={`p-2 rounded-md ${isOpen ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}
                >
                  <mod.icon className="w-5 h-5" />
                </div>
                <span className="font-mono font-bold text-lg flex-1">
                  {mod.name}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-6 space-y-6 border-t border-border/50 pt-5">
                      <p className="text-muted-foreground leading-relaxed">
                        {mod.purpose}
                      </p>

                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-mono text-sm text-primary uppercase tracking-wider mb-3">
                            Tech Stack
                          </h4>
                          <div className="space-y-2">
                            {mod.stack.map((s) => (
                              <div
                                key={s.name}
                                className="flex items-start gap-2"
                              >
                                <span className="font-mono text-sm text-primary mt-0.5 shrink-0">
                                  {s.name}
                                </span>
                                <span className="text-muted-foreground text-sm">
                                  — {s.role}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-mono text-sm text-primary uppercase tracking-wider mb-3">
                            Scaling Strategy
                          </h4>
                          <p className="text-muted-foreground text-sm leading-relaxed">
                            {mod.scaling}
                          </p>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-mono text-sm text-primary uppercase tracking-wider mb-3">
                          Core Loop
                        </h4>
                        <pre className="bg-background border border-border rounded-md p-4 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed">
                          <code>{mod.pseudocode}</code>
                        </pre>
                      </div>

                      <div>
                        <h4 className="font-mono text-sm text-primary uppercase tracking-wider mb-3">
                          Resource Estimates
                        </h4>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          {mod.resources.map((r) => (
                            <div
                              key={r.label}
                              className="bg-background border border-border rounded-md p-3 text-center"
                            >
                              <div className="font-mono text-xs text-muted-foreground mb-2">
                                {r.label}
                              </div>
                              <div className="text-sm font-bold text-primary">
                                {r.cpu} CPU
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {r.ram} GB RAM
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {r.storage} GB storage
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="h-32">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mod.resources} barSize={20}>
                              <XAxis
                                dataKey="label"
                                tick={{
                                  fontSize: 10,
                                  fill: "hsl(215 20.2% 65.1%)",
                                  fontFamily: "monospace",
                                }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{
                                  fontSize: 10,
                                  fill: "hsl(215 20.2% 65.1%)",
                                  fontFamily: "monospace",
                                }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip contentStyle={TOOLTIP_STYLE} />
                              <Bar
                                dataKey="ram"
                                name="RAM (GB)"
                                fill="hsl(180 100% 45%)"
                                radius={[2, 2, 0, 0]}
                              />
                              <Bar
                                dataKey="cpu"
                                name="CPU cores"
                                fill="hsl(260 100% 65%)"
                                radius={[2, 2, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
