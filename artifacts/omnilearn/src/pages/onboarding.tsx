import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, Circle, Terminal, Folder, FolderOpen, File,
  GitBranch, Package, Cpu, Ghost, Server, Key, Radio, Globe,
  Shield, Users, ChevronRight, Plus, Trash2, RefreshCw,
  CheckCircle2, XCircle, Loader2, Link2, Eye, EyeOff,
  AlertCircle, ExternalLink, Github, Activity,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

interface GhostNode {
  id: number;
  name: string;
  endpoint: string;
  secretKey: string;
  region: string;
  status: "online" | "offline" | "unknown";
  lastSeen: string | null;
  tasksProcessed: number;
  tasksFailed: number;
  avgResponseMs: number | null;
  isSelf: boolean;
  notes: string | null;
}

interface NetworkStatus {
  total: number;
  online: number;
  offline: number;
  totalTasksProcessed: number;
  selfEndpoint: string;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 1,
    title: "Prerequisites",
    desc: "Ensure your system meets the minimum requirements before starting.",
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "Python", version: "3.10+", note: "Required for all components" },
            { label: "Docker", version: "24.x+", note: "Container orchestration" },
            { label: "CUDA", version: "11.8+ (optional)", note: "GPU acceleration" },
            { label: "RAM", version: "16 GB min", note: "32 GB recommended" },
            { label: "Storage", version: "100 GB free", note: "For models and index" },
            { label: "Git", version: "2.40+", note: "For cloning the repo" },
          ].map(r => (
            <div key={r.label} className="flex items-start gap-3 p-3 bg-background border border-border rounded-md">
              <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <span className="font-mono text-sm font-bold text-foreground">{r.label}</span>
                <span className="font-mono text-sm text-primary ml-2">{r.version}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{r.note}</p>
              </div>
            </div>
          ))}
        </div>
        <pre className="bg-background border border-border rounded-md p-4 text-xs font-mono text-muted-foreground">
          <code>{`# Verify your setup
python --version        # 3.10+
docker --version        # 24.x+
nvidia-smi              # CUDA check (optional)
df -h                   # Disk space check`}</code>
        </pre>
      </div>
    ),
  },
  {
    id: 2,
    title: "Clone & Install",
    desc: "Get the code and install dependencies in a fresh virtual environment.",
    content: (
      <pre className="bg-background border border-border rounded-md p-4 text-xs font-mono text-muted-foreground leading-6">
        <code>{`# Clone the repository
git clone https://github.com/omnilearn-ai/omnilearn.git
cd omnilearn

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\\Scripts\\activate

# Install core dependencies
pip install -r requirements.txt

# Install optional GPU support (if CUDA available)
pip install -r requirements-gpu.txt

# Verify installation
python -c "import omnilearn; print(omnilearn.__version__)"
# → 1.0.0-rc.4`}</code>
      </pre>
    ),
  },
  {
    id: 3,
    title: "Configure Your First Source",
    desc: "Edit omni_config.yaml to define a single data source and model before starting the system.",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">Start with a minimal config — one source, one small model, local inference only:</p>
        <pre className="bg-background border border-border rounded-md p-4 text-xs font-mono text-muted-foreground leading-6">
          <code>{`# omni_config.yaml — minimal quickstart
data_sources:
  - name: hacker_news
    type: api
    endpoint: https://hacker-news.firebaseio.com/v0
    fetch_top_n: 10
    poll_interval_seconds: 3600

model:
  name: mistralai/Mistral-7B-v0.1
  endpoint: local
  quantization: q4_k_m    # Fits in 6 GB VRAM

learning:
  mode: passive           # Start simple: just index
  interval_seconds: 7200

ethics:
  robots_txt_respect: true
  rate_limit_rps: 1

hardware:
  max_ram_gb: 16
  gpu_enabled: false      # CPU-only first run`}</code>
        </pre>
      </div>
    ),
  },
  {
    id: 4,
    title: "Download Your Model",
    desc: "Pull the model weights from HuggingFace before starting the learning engine.",
    content: (
      <pre className="bg-background border border-border rounded-md p-4 text-xs font-mono text-muted-foreground leading-6">
        <code>{`# Download model weights (requires HuggingFace account for gated models)
python -m omnilearn.cli model pull mistralai/Mistral-7B-v0.1

# Or use the HuggingFace CLI directly
pip install huggingface_hub
huggingface-cli download mistralai/Mistral-7B-v0.1 \\
  --local-dir ./models/mistral-7b

# Verify model files are present
ls -lh ./models/mistral-7b/
# → config.json, tokenizer.json, model-*.safetensors`}</code>
      </pre>
    ),
  },
  {
    id: 5,
    title: "Start the System",
    desc: "Launch all services with Docker Compose for the single-machine quickstart.",
    content: (
      <div className="space-y-4">
        <pre className="bg-background border border-border rounded-md p-4 text-xs font-mono text-muted-foreground leading-6">
          <code>{`# Start all services (single machine)
docker compose up -d

# Check service status
docker compose ps

# Follow logs from all services
docker compose logs -f

# Access the API
curl http://localhost:8000/query \\
  -H "Content-Type: application/json" \\
  -d '{"text": "What is the latest in AI research?"}'

# Access monitoring
open http://localhost:3000   # Grafana dashboard
open http://localhost:5000   # MLflow experiment tracker`}</code>
        </pre>
        <div className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-md">
          <Terminal className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">First startup will take several minutes as the vector store initializes and the model loads into memory. Check logs if services don't respond within 5 minutes.</p>
        </div>
      </div>
    ),
  },
];

const GHOST_STEPS = [
  {
    id: 1,
    icon: Key,
    color: "#22d3ee",
    title: "Generate your shard key",
    desc: "Your agent's identity and state are encrypted with a shard key derived from Shamir secret sharing. You hold the master secret — the network holds nothing.",
    content: (
      <div className="space-y-4">
        <pre className="bg-background border border-border rounded-md p-4 text-xs font-mono text-muted-foreground leading-6">
          <code>{`# Generate master secret + 5 shards, threshold = 3
python -m omnilearn.cli keygen \\
  --shards 5 \\
  --threshold 3 \\
  --output ~/.omnilearn/keyshards/

# Output:
# master.key   — KEEP OFFLINE. Never upload.
# shard-1.key  ─┐
# shard-2.key   │  Store on separate devices.
# shard-3.key   │  Any 3 of 5 reconstruct master.
# shard-4.key   │
# shard-5.key  ─┘
#
# Instance fingerprint: 0x3F8A2D1C...
# (derived from master, changes as traits evolve)`}</code>
        </pre>
        <div className="flex items-start gap-3 p-3 bg-rose-500/5 border border-rose-500/20 rounded-md">
          <Key className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">The master key is your agent's soul. Lose it and the agent cannot be reconstructed from distributed shards. Store shards on separate physical devices.</p>
        </div>
      </div>
    ),
  },
  {
    id: 2,
    icon: Server,
    color: "#34d399",
    title: "Choose your execution substrate",
    desc: "Ghost nodes run on borrowed compute. Pick one or more substrates — they will be used in rotation.",
    content: (
      <div className="space-y-3">
        {[
          { name: "Cloudflare Workers", latency: "~5ms", limit: "100k req/day free", cmd: "omnilearn ghost add --substrate cloudflare" },
          { name: "AWS Lambda", latency: "~20ms", limit: "1M req/month free", cmd: "omnilearn ghost add --substrate lambda" },
          { name: "GitHub Actions", latency: "~30s cold", limit: "2000 min/month free", cmd: "omnilearn ghost add --substrate github-actions" },
          { name: "Browser Worker", latency: "local", limit: "Unlimited (tab open)", cmd: "omnilearn ghost add --substrate browser" },
          { name: "Fly.io", latency: "~10ms", limit: "3 shared VMs free", cmd: "omnilearn ghost add --substrate fly" },
        ].map(s => (
          <div key={s.name} className="bg-background border border-border rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-sm font-bold text-foreground">{s.name}</span>
              <div className="flex gap-3">
                <span className="font-mono text-[10px] text-muted-foreground">{s.latency}</span>
                <span className="font-mono text-[10px] text-emerald-400">{s.limit}</span>
              </div>
            </div>
            <code className="text-xs text-primary font-mono bg-primary/5 px-2 py-1 rounded block">{s.cmd}</code>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 3,
    icon: Ghost,
    color: "#a78bfa",
    title: "Configure ghost mode",
    desc: "Switch the agent from local-persistent to ephemeral mode. State lives on IPFS/Arweave — the ghost node holds nothing between tasks.",
    content: (
      <pre className="bg-background border border-border rounded-md p-4 text-xs font-mono text-muted-foreground leading-6">
        <code>{`# omni_config.yaml — ghost mode
execution:
  mode: ghost             # Ephemeral execution fabric
  local_state: false      # No disk writes on the ghost node
  checkpoint_store: ipfs  # State shards to IPFS after each task
  shard_key_path: ~/.omnilearn/keyshards/shard-1.key

substrates:
  - cloudflare_workers
  - aws_lambda
  - fly_io

crawl:
  task_size: micro        # 50–200 URLs per ghost invocation
  parallel_ghosts: 64     # Max simultaneous ghost nodes
  region_affinity: true   # Spawn ghost near target domain's CDN

inference:
  mode: routed            # Route to nearest free-tier API
  fallback: local         # If all APIs exhausted, use local`}</code>
      </pre>
    ),
  },
  {
    id: 4,
    icon: Radio,
    color: "#fb923c",
    title: "Join the rendezvous",
    desc: "Register your agent with a bootstrap relay. The relay never stores your state — it only introduces your ghost nodes to peers for gossip sync.",
    content: (
      <pre className="bg-background border border-border rounded-md p-4 text-xs font-mono text-muted-foreground leading-6">
        <code>{`# Register with the bootstrap relay
python -m omnilearn.cli network join \\
  --relay relay.omnilearn.net \\
  --fingerprint $(omnilearn fingerprint)

# Verify connectivity
python -m omnilearn.cli network ping

# Expected output:
# Relay: relay.omnilearn.net  CONNECTED  12ms
# Peers discovered: 847
# First gossip sync: 3.2s
# Knowledge delta received: 14,822 chunks
# Your node is live.`}</code>
      </pre>
    ),
  },
  {
    id: 5,
    icon: Users,
    color: "#facc15",
    title: "Enable federation (optional)",
    desc: "Opt in to contributing anonymised learning deltas back to the collective.",
    content: (
      <pre className="bg-background border border-border rounded-md p-4 text-xs font-mono text-muted-foreground leading-6">
        <code>{`# Add to omni_config.yaml
federation:
  enabled: true           # Opt in — never assumed
  contribute:
    knowledge_deltas: true
    retrieval_strategies: true
    compliance_signals: true
    character_insights: false   # Keep personality private
  anonymisation: strict   # Strip all PII + domain fingerprints
  vote_weight: auto       # Derived from your trust score

# Start with federation active
python -m omnilearn.cli start --ghost --federated`}</code>
      </pre>
    ),
  },
];

const FILE_TREE = [
  { name: "omnilearn/", type: "root", depth: 0 },
  { name: "omnilearn/", type: "folder", depth: 0 },
  { name: "ingestion/", type: "folder", depth: 1 },
  { name: "connectors/", type: "folder", depth: 2 },
  { name: "crawler.py", type: "file", depth: 3 },
  { name: "rss.py", type: "file", depth: 3 },
  { name: "api.py", type: "file", depth: 3 },
  { name: "pipeline.py", type: "file", depth: 2 },
  { name: "knowledge/", type: "folder", depth: 1 },
  { name: "store.py", type: "file", depth: 2 },
  { name: "embedder.py", type: "file", depth: 2 },
  { name: "tiering.py", type: "file", depth: 2 },
  { name: "learning/", type: "folder", depth: 1 },
  { name: "engine.py", type: "file", depth: 2 },
  { name: "finetune/", type: "folder", depth: 2 },
  { name: "lora.py", type: "file", depth: 3 },
  { name: "character/", type: "folder", depth: 1 },
  { name: "engine.py", type: "file", depth: 2 },
  { name: "persona.py", type: "file", depth: 2 },
  { name: "ghost/", type: "folder", depth: 1 },
  { name: "node.py", type: "file", depth: 2 },
  { name: "substrate/", type: "folder", depth: 2 },
  { name: "federation.py", type: "file", depth: 2 },
  { name: "api/", type: "folder", depth: 1 },
  { name: "routes.py", type: "file", depth: 2 },
  { name: "models.py", type: "file", depth: 2 },
  { name: "config/", type: "folder", depth: 0 },
  { name: "omni_config.yaml", type: "file", depth: 1 },
  { name: "requirements.txt", type: "file", depth: 0 },
];

const TESTING = [
  { type: "Unit Tests", desc: "Each module has isolated unit tests. Mock external dependencies (HTTP, DB). Run with pytest.", cmd: "pytest tests/unit/ -v" },
  { type: "Integration Tests", desc: "Spin up Docker Compose and run end-to-end flows against real services.", cmd: "pytest tests/integration/ --integration" },
  { type: "Learning Quality", desc: "Evaluate RAG retrieval precision/recall and fine-tuned model perplexity.", cmd: "python -m omnilearn.eval quality --split tests/quality/" },
];

// ─── Ghost node management helpers ────────────────────────────────────────────

function timeSince(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 5000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function StatusDot({ status }: { status: "online" | "offline" | "unknown" }) {
  return (
    <span className={cn(
      "inline-block w-2 h-2 rounded-full shrink-0",
      status === "online" ? "bg-emerald-400 animate-pulse" :
      status === "offline" ? "bg-red-400" : "bg-yellow-400/60"
    )} />
  );
}

// ─── Add node form ─────────────────────────────────────────────────────────────

function AddNodeForm({ onAdd }: { onAdd: (node: GhostNode) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", endpoint: "", secretKey: "", region: "unknown" });
  const [showSecret, setShowSecret] = useState(false);
  const [pingResult, setPingResult] = useState<{ status: "online" | "offline" | null; ms: number | null }>({ status: null, ms: null });
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.name.trim() || !form.endpoint.trim() || !form.secretKey.trim()) {
      setError("Name, endpoint URL, and secret key are required.");
      return;
    }
    setLoading(true);
    setError("");
    setPingResult({ status: null, ms: null });
    try {
      const res = await fetch(`${BASE}/api/ghost/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to register node"); setLoading(false); return; }
      setPingResult({ status: data.pingStatus, ms: data.pingMs });
      onAdd(data);
      setForm({ name: "", endpoint: "", secretKey: "", region: "unknown" });
      setTimeout(() => setOpen(false), 1200);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 transition-all font-mono text-sm"
      >
        <Plus className="w-4 h-4" /> Connect a node
      </button>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-primary/20 bg-card/40 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-bold">Connect ghost node</span>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        placeholder="Node name (e.g. Home Lab, AWS us-east)"
        className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50" />

      <input value={form.endpoint} onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))}
        placeholder="Endpoint URL (e.g. https://your-server.com)"
        className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50" />

      <div className="relative">
        <input type={showSecret ? "text" : "password"} value={form.secretKey}
          onChange={e => setForm(f => ({ ...f, secretKey: e.target.value }))}
          placeholder="GHOST_NODE_SECRET (must match server)"
          className="w-full px-3 py-2 pr-9 rounded-lg border border-border/60 bg-background font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50" />
        <button type="button" onClick={() => setShowSecret(s => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>

      <input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
        placeholder="Region label (optional, e.g. eu-west, home-lab)"
        className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50" />

      {error && (
        <div className="flex items-center gap-2 text-red-400 font-mono text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      {pingResult.status && (
        <div className={cn("flex items-center gap-2 font-mono text-xs rounded-lg px-3 py-2",
          pingResult.status === "online"
            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
            : "bg-red-500/10 border border-red-500/20 text-red-400"
        )}>
          {pingResult.status === "online"
            ? <><CheckCircle2 className="w-3.5 h-3.5" /> Node reachable — {pingResult.ms}ms</>
            : <><XCircle className="w-3.5 h-3.5" /> Node unreachable — saved as offline</>}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-mono text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          {loading ? "Connecting…" : "Connect"}
        </button>
        <button onClick={() => setOpen(false)} className="font-mono text-sm text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
    </motion.div>
  );
}

// ─── GitHub repo creation ──────────────────────────────────────────────────────

function GitHubRepoSection() {
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ htmlUrl?: string; fullName?: string; error?: string } | null>(null);

  const create = async () => {
    setCreating(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}/api/github/create-repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoName: "omnilearn-ghost-node", isPrivate: false }),
      });
      const data = await res.json();
      setResult(res.ok ? { htmlUrl: data.repo?.htmlUrl, fullName: data.repo?.fullName } : { error: data.error });
    } catch {
      setResult({ error: "Network error" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/20 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Github className="w-4 h-4 text-foreground" />
        <div>
          <p className="font-mono text-sm font-bold text-foreground">Create deployment repo</p>
          <p className="font-mono text-xs text-muted-foreground">
            Generates a GitHub repo with the ghost node server, Docker Compose, and docs.
          </p>
        </div>
      </div>

      {result?.htmlUrl ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="font-mono text-xs text-emerald-400 font-bold">{result.fullName}</p>
            <a href={result.htmlUrl} target="_blank" rel="noopener noreferrer"
              className="font-mono text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
              {result.htmlUrl} <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      ) : (
        <>
          {result?.error && (
            <div className="flex items-center gap-2 text-red-400 font-mono text-xs">
              <AlertCircle className="w-3.5 h-3.5" /> {result.error}
            </div>
          )}
          <button onClick={create} disabled={creating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/60 text-foreground hover:border-primary/40 hover:text-primary font-mono text-sm transition-all disabled:opacity-50">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
            {creating ? "Creating…" : "Create omnilearn-ghost-node"}
          </button>
          <p className="font-mono text-[10px] text-muted-foreground/50">
            Requires GitHub connected via your Account page.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Live node list ────────────────────────────────────────────────────────────

function LiveNodeManager() {
  const [nodes, setNodes] = useState<GhostNode[]>([]);
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pingingAll, setPingingAll] = useState(false);
  const [pingingId, setPingingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [nr, sr] = await Promise.all([
        fetch(`${BASE}/api/ghost/nodes`),
        fetch(`${BASE}/api/ghost/status`),
      ]);
      if (nr.ok) setNodes(await nr.json());
      if (sr.ok) setStatus(await sr.json());
    } catch { /* offline */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pingAll = async () => {
    setPingingAll(true);
    await fetch(`${BASE}/api/ghost/nodes/ping-all`, { method: "POST" });
    await fetchData();
    setPingingAll(false);
  };

  const pingOne = async (id: number) => {
    setPingingId(id);
    const res = await fetch(`${BASE}/api/ghost/nodes/${id}/ping`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setNodes(prev => prev.map(n => n.id === id ? { ...n, ...data.node, secretKey: n.secretKey } : n));
    }
    setPingingId(null);
  };

  const deleteNode = async (id: number) => {
    await fetch(`${BASE}/api/ghost/nodes/${id}`, { method: "DELETE" });
    setNodes(prev => prev.filter(n => n.id !== id));
    fetchData();
  };

  const addNode = (node: GhostNode) => {
    setNodes(prev => [...prev, node]);
    fetchData();
  };

  return (
    <div className="mt-10 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-mono text-sm text-primary uppercase tracking-wider">Your Ghost Network</h2>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">
            Register and manage the machines that process your ghost mode chat.
          </p>
        </div>
        {nodes.length > 0 && (
          <button onClick={pingAll} disabled={pingingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground font-mono text-xs transition-all disabled:opacity-50">
            {pingingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Ping all
          </button>
        )}
      </div>

      {/* Stats */}
      {status && status.total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: status.total, color: "text-foreground" },
            { label: "Online", value: status.online, color: "text-emerald-400" },
            { label: "Tasks", value: status.totalTasksProcessed, color: "text-primary" },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border/40 bg-card/20 p-3 text-center">
              <p className={cn("font-mono text-xl font-bold", s.color)}>{s.value}</p>
              <p className="font-mono text-[10px] text-muted-foreground uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Node list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
          <Ghost className="w-7 h-7 text-muted-foreground/20 mx-auto mb-2" />
          <p className="font-mono text-sm text-muted-foreground/50">No nodes yet — connect one below.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {nodes.map(node => (
              <motion.div key={node.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={cn("rounded-xl border p-4 bg-card/30",
                  node.status === "online" ? "border-emerald-500/20" :
                  node.status === "offline" ? "border-red-500/20" : "border-border/40"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <StatusDot status={node.status} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-foreground">{node.name}</span>
                        {node.region !== "unknown" && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary/30 text-muted-foreground">{node.region}</span>
                        )}
                      </div>
                      <a href={node.endpoint} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-xs text-muted-foreground/50 hover:text-primary flex items-center gap-1 mt-0.5 truncate">
                        {node.endpoint} <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className={cn("font-mono text-xs",
                          node.status === "online" ? "text-emerald-400" :
                          node.status === "offline" ? "text-red-400" : "text-yellow-400"
                        )}>
                          {node.status}
                        </span>
                        {node.lastSeen && (
                          <span className="font-mono text-[10px] text-muted-foreground/50">
                            seen {timeSince(node.lastSeen)}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-muted-foreground/50">
                          {node.tasksProcessed} tasks
                        </span>
                        {node.avgResponseMs && (
                          <span className="font-mono text-[10px] text-muted-foreground/50">
                            avg {Math.round(node.avgResponseMs)}ms
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => pingOne(node.id)} disabled={pingingId === node.id}
                      className="p-1.5 rounded-md border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50"
                      title="Ping node">
                      {pingingId === node.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => deleteNode(node.id)}
                      className="p-1.5 rounded-md border border-red-500/20 text-red-400/50 hover:text-red-400 hover:border-red-500/40 transition-all"
                      title="Remove node">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AddNodeForm onAdd={addNode} />
      <GitHubRepoSection />

      {/* Deploy commands */}
      <div className="rounded-xl border border-border/40 bg-card/20 p-4 space-y-3">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Quick deploy — on any machine</p>
        <pre className="bg-black/40 rounded-lg border border-border/30 p-3 font-mono text-xs text-primary/90 overflow-x-auto leading-relaxed">
          <code>{`# Clone your ghost node repo, then:
npm install
cp .env.example .env
# Set GHOST_NODE_SECRET and ANTHROPIC_API_KEY in .env
npm start

# Or with Docker:
docker compose up -d`}</code>
        </pre>
        <p className="font-mono text-[10px] text-muted-foreground/50">
          The deployed machine must be publicly reachable (use a domain or expose via ngrok/Cloudflare Tunnel for local testing).
        </p>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type Mode = "local" | "ghost";

export default function Onboarding() {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [ghostCompleted, setGhostCompleted] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<Mode>("local");

  const toggle = (id: number) => setCompleted(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleGhost = (id: number) => setGhostCompleted(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="p-6 md:p-12 max-w-5xl mx-auto min-h-screen">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-3">Developer Onboarding</h1>
        <p className="text-lg text-muted-foreground font-mono">
          Two paths: run on a machine, or run on the internet itself.
        </p>
      </motion.div>

      {/* Mode tabs */}
      <div className="flex gap-3 mb-10">
        <button onClick={() => setMode("local")}
          className={cn("flex items-center gap-2.5 px-5 py-3 rounded-xl border font-mono text-sm transition-all",
            mode === "local"
              ? "bg-primary/10 border-primary/40 text-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/30"
          )}>
          <Server className="w-4 h-4" />
          Single Machine
          <span className="text-[10px] opacity-60">20 min</span>
        </button>
        <button onClick={() => setMode("ghost")}
          className={cn("flex items-center gap-2.5 px-5 py-3 rounded-xl border font-mono text-sm transition-all",
            mode === "ghost"
              ? "bg-violet-500/10 border-violet-500/40 text-violet-300"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/30"
          )}>
          <Ghost className="w-4 h-4" />
          Ghost Deployment
          <span className="text-[10px] opacity-60">everywhere</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {/* ── Single machine ── */}
        {mode === "local" && (
          <motion.div key="local" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <h2 className="font-mono text-sm text-primary uppercase tracking-wider mb-4">Quickstart Steps</h2>
                {STEPS.map((step, i) => {
                  const done = completed.has(step.id);
                  return (
                    <motion.div key={step.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className={cn("border rounded-lg overflow-hidden transition-colors",
                        done ? "border-primary/30 bg-primary/5" : "border-border bg-card/40"
                      )}>
                      <div className="flex items-start gap-4 p-5">
                        <button onClick={() => toggle(step.id)} className="mt-0.5 shrink-0 text-primary hover:text-primary/80 transition-colors">
                          {done ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6 text-border" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-mono text-xs text-muted-foreground">STEP {step.id}</span>
                            <h3 className="font-bold text-lg">{step.title}</h3>
                          </div>
                          <p className="text-muted-foreground text-sm mb-4">{step.desc}</p>
                          {step.content}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="space-y-6">
                <div>
                  <h2 className="font-mono text-sm text-primary uppercase tracking-wider mb-4">Directory Structure</h2>
                  <div className="bg-background border border-border rounded-lg p-4 font-mono text-xs overflow-x-auto">
                    {FILE_TREE.map((item, i) => {
                      const indent = item.depth * 16;
                      const Icon = item.type === "file" ? File : item.type === "root" ? Cpu : FolderOpen;
                      const color = item.type === "file" ? "text-muted-foreground" : "text-cyan-400";
                      return (
                        <div key={i} style={{ paddingLeft: indent }} className={cn("flex items-center gap-1.5 py-0.5", color)}>
                          <Icon className="w-3 h-3 shrink-0" />
                          <span>{item.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h2 className="font-mono text-sm text-primary uppercase tracking-wider mb-4">Plugin Architecture</h2>
                  <div className="bg-background border border-border rounded-lg p-4 space-y-4">
                    <p className="text-xs text-muted-foreground">Drop new plugins into the <code className="text-cyan-400">plugins/</code> directory. They are auto-discovered at startup.</p>
                    <pre className="text-xs font-mono text-muted-foreground leading-5">
                      <code>{`class ConnectorPlugin:
    name: str
    version: str

    async def stream(self):
        """Yield raw documents."""
        ...

    def validate_config(self, cfg):
        """Raise ValueError if invalid."""
        ...`}</code>
                    </pre>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Package className="w-3 h-3 text-primary" />
                      <span>Community plugins live in <code className="text-cyan-400">plugins/</code></span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <GitBranch className="w-3 h-3 text-primary" />
                      <span>Contributions via PR to <code className="text-cyan-400">main</code> branch</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h2 className="font-mono text-sm text-primary uppercase tracking-wider mb-4">Testing Strategy</h2>
                  <div className="space-y-3">
                    {TESTING.map(t => (
                      <div key={t.type} className="bg-background border border-border rounded-lg p-4">
                        <div className="font-mono text-sm font-bold text-foreground mb-1">{t.type}</div>
                        <p className="text-xs text-muted-foreground mb-2">{t.desc}</p>
                        <code className="text-xs text-primary font-mono bg-primary/5 px-2 py-1 rounded block">{t.cmd}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Ghost deployment ── */}
        {mode === "ghost" && (
          <motion.div key="ghost" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Banner */}
            <div className="mb-8 p-5 rounded-xl border border-violet-500/20 bg-violet-500/5 flex items-start gap-4">
              <Ghost className="w-5 h-5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-mono text-sm font-bold text-foreground mb-1">No fixed machine required</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ghost deployment routes OmniLearn chat across registered compute nodes — any server, VM, or cloud instance you control. Register nodes below, then switch to Ghost mode in Chat to use them.
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Left: steps + live manager */}
              <div className="lg:col-span-2 space-y-4">
                <h2 className="font-mono text-sm text-primary uppercase tracking-wider mb-4">Architecture Steps</h2>
                {GHOST_STEPS.map((step, i) => {
                  const done = ghostCompleted.has(step.id);
                  return (
                    <motion.div key={step.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className={cn("border rounded-lg overflow-hidden transition-colors",
                        done ? "border-primary/30 bg-primary/5" : "border-border bg-card/40"
                      )}>
                      <div className="flex items-start gap-4 p-5">
                        <button onClick={() => toggleGhost(step.id)} className="mt-0.5 shrink-0 text-primary hover:text-primary/80 transition-colors">
                          {done ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6 text-border" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <div className="p-1.5 rounded" style={{ backgroundColor: step.color + "15" }}>
                              <step.icon className="w-3.5 h-3.5" style={{ color: step.color }} />
                            </div>
                            <span className="font-mono text-xs text-muted-foreground">STEP {step.id}</span>
                            <h3 className="font-bold text-base">{step.title}</h3>
                          </div>
                          <p className="text-muted-foreground text-sm mb-4">{step.desc}</p>
                          {step.content}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Live node manager */}
                <LiveNodeManager />
              </div>

              {/* Right sidebar */}
              <div className="space-y-6">
                <div>
                  <h2 className="font-mono text-sm text-primary uppercase tracking-wider mb-4">Ghost Architecture</h2>
                  <div className="bg-background border border-border rounded-lg p-4 space-y-4">
                    {[
                      { icon: Key, color: "#22d3ee", label: "Shard key", desc: "Your identity. Never leaves your devices." },
                      { icon: Ghost, color: "#a78bfa", label: "Ghost node", desc: "Stateless. Spawns, executes, evaporates." },
                      { icon: Globe, color: "#34d399", label: "IPFS/Arweave", desc: "Encrypted state shards. Reconstructable anywhere." },
                      { icon: Radio, color: "#fb923c", label: "Rendezvous relay", desc: "Peer discovery only. No state stored." },
                      { icon: Users, color: "#facc15", label: "Federation", desc: "Opt-in delta contributions. Personality stays private." },
                    ].map(item => (
                      <div key={item.label} className="flex items-start gap-3">
                        <div className="p-1.5 rounded mt-0.5 shrink-0" style={{ backgroundColor: item.color + "15" }}>
                          <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                        </div>
                        <div>
                          <p className="font-mono text-xs font-bold text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="font-mono text-sm text-primary uppercase tracking-wider mb-4">Compliance in ghost mode</h2>
                  <div className="bg-background border border-border rounded-lg p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">Each ghost node enforces compliance independently.</p>
                    {[
                      { label: "robots.txt", note: "Checked per ghost invocation" },
                      { label: "Rate limit", note: "<2 req/s per domain per ghost" },
                      { label: "Ethics governor", note: "Runs locally on every node" },
                      { label: "Trust score", note: "Propagated via gossip" },
                    ].map(c => (
                      <div key={c.label} className="flex items-center gap-2">
                        <Shield className="w-3 h-3 text-primary shrink-0" />
                        <span className="font-mono text-xs text-foreground">{c.label}</span>
                        <span className="font-mono text-[10px] text-muted-foreground ml-auto">{c.note}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="font-mono text-sm text-primary uppercase tracking-wider mb-4">Progress</h2>
                  <div className="bg-background border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs text-muted-foreground">Steps completed</span>
                      <span className="font-mono text-sm font-bold text-primary">{ghostCompleted.size} / {GHOST_STEPS.length}</span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <motion.div className="h-full bg-primary rounded-full"
                        animate={{ width: `${(ghostCompleted.size / GHOST_STEPS.length) * 100}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                    {ghostCompleted.size === GHOST_STEPS.length && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex items-center gap-2 text-primary">
                        <CheckCircle className="w-4 h-4" />
                        <span className="font-mono text-xs">Your agent is live on the network.</span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
