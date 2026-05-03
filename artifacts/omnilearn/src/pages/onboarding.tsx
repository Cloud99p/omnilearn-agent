import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, Circle, Terminal, FolderOpen, File,
  GitBranch, Package, Cpu, Ghost, Server, Key, Radio, Globe,
  Shield, Users, Plus, Trash2, RefreshCw,
  CheckCircle2, XCircle, Loader2, Link2, Eye, EyeOff,
  AlertCircle, ExternalLink, Github, ChevronDown, ChevronRight,
  Zap, Monitor, Cloud,
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

// ─── Static content ───────────────────────────────────────────────────────────

const LOCAL_STEPS = [
  {
    id: 1,
    title: "Check your computer meets the requirements",
    desc: "Before you begin, make sure you have the right tools installed. You only need to do this once.",
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { label: "Python 3.10+", note: "The main programming language OmniLearn is written in", required: true },
            { label: "Docker 24+", note: "Runs all the services together as a package", required: true },
            { label: "16 GB RAM", note: "Minimum — 32 GB recommended for comfortable use", required: true },
            { label: "100 GB free disk", note: "For storing AI models and the knowledge index", required: true },
            { label: "Git 2.40+", note: "For downloading the code from GitHub", required: true },
            { label: "CUDA / GPU", note: "Optional — speeds things up a lot if you have an Nvidia GPU", required: false },
          ].map(r => (
            <div key={r.label} className="flex items-start gap-3 p-3 bg-background border border-border rounded-lg">
              <CheckCircle className={cn("w-4 h-4 mt-0.5 shrink-0", r.required ? "text-primary" : "text-muted-foreground/40")} />
              <div>
                <span className="font-mono text-sm font-bold text-foreground">{r.label}</span>
                {!r.required && <span className="ml-2 text-[10px] text-muted-foreground bg-secondary/40 px-1.5 py-0.5 rounded">optional</span>}
                <p className="text-xs text-muted-foreground mt-0.5">{r.note}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-xs text-muted-foreground mb-2">Open a terminal and run these to check what you already have:</p>
          <pre className="text-xs font-mono text-primary/80 leading-6">
            <code>{`python --version    # Should say 3.10 or higher
docker --version   # Should say 24.x or higher
df -h              # Check free disk space`}</code>
          </pre>
        </div>
      </div>
    ),
  },
  {
    id: 2,
    title: "Download the code",
    desc: "Copy the OmniLearn project to your computer and install its dependencies. This takes a few minutes.",
    content: (
      <pre className="bg-background border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground leading-6">
        <code>{`# Download the project (paste these into your terminal one at a time)
git clone https://github.com/omnilearn-ai/omnilearn.git
cd omnilearn

# Create an isolated environment so OmniLearn doesn't conflict with other Python software
python -m venv .venv
source .venv/bin/activate     # On Windows: .venv\\Scripts\\activate

# Install everything OmniLearn needs
pip install -r requirements.txt

# Confirm it worked — you should see a version number
python -c "import omnilearn; print(omnilearn.__version__)"
# → 1.0.0-rc.4`}</code>
      </pre>
    ),
  },
  {
    id: 3,
    title: "Create a basic config file",
    desc: "Tell OmniLearn where to get its first bit of data and which AI model to use. Start small — you can add more later.",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Create a file called <code className="text-primary bg-primary/10 px-1 rounded">omni_config.yaml</code> in the project folder with this content:</p>
        <pre className="bg-background border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground leading-6">
          <code>{`# omni_config.yaml — a simple starting point
data_sources:
  - name: hacker_news          # Pull tech news as test data
    type: api
    endpoint: https://hacker-news.firebaseio.com/v0
    fetch_top_n: 10
    poll_interval_seconds: 3600  # Check for new articles every hour

model:
  name: mistralai/Mistral-7B-v0.1  # A free, capable AI model
  endpoint: local                   # Run it on your own computer
  quantization: q4_k_m              # Compressed to fit in ~6 GB of RAM

learning:
  mode: passive    # Just index data for now — no active learning yet

ethics:
  robots_txt_respect: true    # Always respect website rules
  rate_limit_rps: 1           # Be polite — max 1 request per second

hardware:
  max_ram_gb: 16
  gpu_enabled: false          # Set to true if you have an Nvidia GPU`}</code>
        </pre>
      </div>
    ),
  },
  {
    id: 4,
    title: "Download the AI model",
    desc: "OmniLearn needs an AI model file on your computer. This download is about 4 GB — it only happens once.",
    content: (
      <pre className="bg-background border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground leading-6">
        <code>{`# Download the model (takes 5–15 minutes depending on your internet)
python -m omnilearn.cli model pull mistralai/Mistral-7B-v0.1

# Alternatively, using the HuggingFace tool directly:
pip install huggingface_hub
huggingface-cli download mistralai/Mistral-7B-v0.1 --local-dir ./models/mistral-7b

# Check the files arrived
ls ./models/mistral-7b/
# You should see: config.json, tokenizer.json, model-*.safetensors`}</code>
      </pre>
    ),
  },
  {
    id: 5,
    title: "Start everything up",
    desc: "One command launches all the services. The first start takes a few minutes while the AI model loads into memory.",
    content: (
      <div className="space-y-4">
        <pre className="bg-background border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground leading-6">
          <code>{`# Start all services at once
docker compose up -d

# Watch the startup logs (Ctrl+C to stop watching, services keep running)
docker compose logs -f

# Test that it's working — ask it a question:
curl http://localhost:8000/query \\
  -H "Content-Type: application/json" \\
  -d '{"text": "What is the latest in AI research?"}'

# Open the monitoring dashboard in your browser:
# http://localhost:3000  — Grafana (charts and metrics)
# http://localhost:5000  — MLflow (experiment tracking)`}</code>
        </pre>
        <div className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
          <Terminal className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            The first startup can take <strong className="text-foreground">3–10 minutes</strong> while the knowledge store builds and the model loads.
            If nothing responds after 10 minutes, run <code className="text-primary">docker compose logs</code> to see what's happening.
          </p>
        </div>
      </div>
    ),
  },
];

const FILE_TREE = [
  { name: "omnilearn/", type: "folder", depth: 0 },
  { name: "ingestion/", type: "folder", depth: 1 },
  { name: "connectors/", type: "folder", depth: 2 },
  { name: "crawler.py", type: "file", depth: 3 },
  { name: "knowledge/", type: "folder", depth: 1 },
  { name: "store.py", type: "file", depth: 2 },
  { name: "embedder.py", type: "file", depth: 2 },
  { name: "learning/", type: "folder", depth: 1 },
  { name: "engine.py", type: "file", depth: 2 },
  { name: "character/", type: "folder", depth: 1 },
  { name: "persona.py", type: "file", depth: 2 },
  { name: "ghost/", type: "folder", depth: 1 },
  { name: "node.py", type: "file", depth: 2 },
  { name: "api/", type: "folder", depth: 1 },
  { name: "routes.py", type: "file", depth: 2 },
  { name: "docker-compose.yml", type: "file", depth: 0 },
  { name: "omni_config.yaml", type: "file", depth: 0 },
  { name: "requirements.txt", type: "file", depth: 0 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      "inline-block w-2 h-2 rounded-full shrink-0 mt-1",
      status === "online" ? "bg-emerald-400 animate-pulse" :
      status === "offline" ? "bg-red-400" : "bg-yellow-400/60"
    )} />
  );
}

// ─── Add node form ────────────────────────────────────────────────────────────

function AddNodeForm({ onAdd }: { onAdd: (node: GhostNode) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", endpoint: "", secretKey: "", region: "" });
  const [showSecret, setShowSecret] = useState(false);
  const [pingResult, setPingResult] = useState<{ status: "online" | "offline" | null; ms: number | null }>({ status: null, ms: null });
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.name.trim() || !form.endpoint.trim() || !form.secretKey.trim()) {
      setError("Give the node a name, paste its URL, and enter the secret key.");
      return;
    }
    setLoading(true);
    setError("");
    setPingResult({ status: null, ms: null });
    try {
      const res = await fetch(`${BASE}/api/ghost/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, region: form.region || "unknown" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to register node"); setLoading(false); return; }
      setPingResult({ status: data.pingStatus, ms: data.pingMs });
      onAdd(data);
      setForm({ name: "", endpoint: "", secretKey: "", region: "" });
      setTimeout(() => setOpen(false), 1500);
    } catch {
      setError("Could not reach the server. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border/50 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/3 transition-all font-mono text-sm"
      >
        <Plus className="w-4 h-4" /> Connect a node
      </button>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-primary/20 bg-card/50 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-sm text-foreground">Connect a node</p>
          <p className="text-xs text-muted-foreground mt-0.5">Fill in details from the machine running the ghost node server.</p>
        </div>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1 block">Node nickname</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Home Server, Work Laptop, AWS"
            className="w-full px-3 py-2.5 rounded-lg border border-border/60 bg-background font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors" />
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1 block">Machine URL</label>
          <input value={form.endpoint} onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))}
            placeholder="https://your-server.com  or  http://192.168.1.x:3001"
            className="w-full px-3 py-2.5 rounded-lg border border-border/60 bg-background font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors" />
          <p className="text-[10px] text-muted-foreground/60 mt-1">The public address of the machine — must be reachable from the internet.</p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1 block">Secret key</label>
          <div className="relative">
            <input type={showSecret ? "text" : "password"} value={form.secretKey}
              onChange={e => setForm(f => ({ ...f, secretKey: e.target.value }))}
              placeholder="The GHOST_NODE_SECRET you set in the .env file"
              className="w-full px-3 py-2.5 pr-10 rounded-lg border border-border/60 bg-background font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors" />
            <button type="button" onClick={() => setShowSecret(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1">This proves the request is coming from you. Must match exactly what's on the server.</p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1 block">Label <span className="text-muted-foreground/40">(optional)</span></label>
          <input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
            placeholder="e.g. home-lab, eu-west, office"
            className="w-full px-3 py-2.5 rounded-lg border border-border/60 bg-background font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors" />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {pingResult.status && (
        <div className={cn("flex items-center gap-2 text-sm rounded-lg px-3 py-2.5",
          pingResult.status === "online"
            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
            : "bg-red-500/10 border border-red-500/20 text-red-400"
        )}>
          {pingResult.status === "online"
            ? <><CheckCircle2 className="w-4 h-4 shrink-0" /> Connected successfully — responded in {pingResult.ms}ms</>
            : <><XCircle className="w-4 h-4 shrink-0" /> Could not reach the node — saved as offline. You can still add it and ping later.</>}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          {loading ? "Connecting…" : "Connect"}
        </button>
        <button onClick={() => { setOpen(false); setError(""); setPingResult({ status: null, ms: null }); }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

// ─── GitHub repo creation ─────────────────────────────────────────────────────

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
      setResult({ error: "Network error — check your connection and try again." });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/20 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Github className="w-4 h-4 text-foreground mt-0.5 shrink-0" />
        <div>
          <p className="font-bold text-sm text-foreground">Get the ghost node code</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Creates a ready-to-run GitHub repository with everything you need to set up a ghost node on another machine — the server code, Docker setup, config files, and step-by-step instructions.
          </p>
        </div>
      </div>

      {result?.htmlUrl ? (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm text-emerald-400 font-bold">Repository created!</p>
            <a href={result.htmlUrl} target="_blank" rel="noopener noreferrer"
              className="font-mono text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5">
              {result.htmlUrl} <ExternalLink className="w-2.5 h-2.5 shrink-0" />
            </a>
            <p className="text-xs text-muted-foreground mt-1">Clone it on the machine you want to use as a node, then follow the README.</p>
          </div>
        </div>
      ) : (
        <>
          {result?.error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {result.error}
            </div>
          )}
          <button onClick={create} disabled={creating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border/60 text-foreground hover:border-primary/40 hover:text-primary text-sm transition-all disabled:opacity-50">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
            {creating ? "Creating repository…" : "Create omnilearn-ghost-node repo"}
          </button>
          <p className="text-[10px] text-muted-foreground/50">
            Requires your GitHub account to be connected — go to Account settings to link it.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Live node list ───────────────────────────────────────────────────────────

function LiveNodeManager() {
  const [nodes, setNodes] = useState<GhostNode[]>([]);
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pingingAll, setPingingAll] = useState(false);
  const [pingingId, setPingingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

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
    setConfirmDelete(null);
    fetchData();
  };

  const addNode = (node: GhostNode) => {
    setNodes(prev => [...prev, node]);
    fetchData();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-foreground">Your connected nodes</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Each node is a machine that can handle chat requests in Ghost mode.
          </p>
        </div>
        {nodes.length > 0 && (
          <button onClick={pingAll} disabled={pingingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground text-xs transition-all disabled:opacity-50">
            {pingingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Check all
          </button>
        )}
      </div>

      {/* Stats bar */}
      {status && status.total > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Nodes registered", value: status.total, color: "text-foreground" },
            { label: "Online now", value: status.online, color: "text-emerald-400" },
            { label: "Tasks handled", value: status.totalTasksProcessed, color: "text-primary" },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-border/40 bg-card/20 p-3 text-center">
              <p className={cn("font-mono text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Node cards */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border/30 p-10 text-center">
          <Ghost className="w-8 h-8 text-muted-foreground/15 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground/50 font-medium">No nodes connected yet</p>
          <p className="text-xs text-muted-foreground/30 mt-1">Follow the steps above to set one up, then connect it below.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {nodes.map(node => (
              <motion.div key={node.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                className={cn("rounded-xl border p-4 bg-card/30 transition-colors",
                  node.status === "online" ? "border-emerald-500/25" :
                  node.status === "offline" ? "border-red-500/20" : "border-border/40"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <StatusDot status={node.status} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{node.name}</span>
                        {node.region && node.region !== "unknown" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary/40 text-muted-foreground">{node.region}</span>
                        )}
                        <span className={cn("text-xs font-medium",
                          node.status === "online" ? "text-emerald-400" :
                          node.status === "offline" ? "text-red-400" : "text-yellow-400"
                        )}>
                          {node.status === "online" ? "Online" : node.status === "offline" ? "Offline" : "Unknown"}
                        </span>
                      </div>
                      <a href={node.endpoint} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-xs text-muted-foreground/40 hover:text-primary flex items-center gap-1 mt-0.5 truncate">
                        {node.endpoint} <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {node.lastSeen && (
                          <span className="text-[11px] text-muted-foreground/50">Last seen {timeSince(node.lastSeen)}</span>
                        )}
                        <span className="text-[11px] text-muted-foreground/50">{node.tasksProcessed} tasks handled</span>
                        {node.avgResponseMs && (
                          <span className="text-[11px] text-muted-foreground/50">avg {Math.round(node.avgResponseMs)}ms response</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => pingOne(node.id)} disabled={pingingId === node.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground text-xs transition-all disabled:opacity-50"
                      title="Check if this node is reachable">
                      {pingingId === node.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      <span className="hidden sm:inline">Ping</span>
                    </button>
                    {confirmDelete === node.id ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => deleteNode(node.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs hover:bg-red-500/30 transition-all">
                          Remove
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="px-2.5 py-1.5 rounded-lg border border-border/40 text-muted-foreground text-xs">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(node.id)}
                        className="p-1.5 rounded-lg border border-border/40 text-muted-foreground/40 hover:text-red-400 hover:border-red-500/30 transition-all"
                        title="Remove this node">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AddNodeForm onAdd={addNode} />
    </div>
  );
}

// ─── Technical details accordion ─────────────────────────────────────────────

function TechDetails() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/30 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-secondary/10 transition-colors">
        <span className="text-sm font-medium text-muted-foreground">How it works under the hood</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-5 pb-5 space-y-4 border-t border-border/20">
              <div className="grid sm:grid-cols-2 gap-3 pt-4">
                {[
                  { icon: Key, color: "#22d3ee", label: "Shard key", desc: "Your identity is encrypted with a key only you hold, derived using Shamir secret sharing. The network holds nothing." },
                  { icon: Ghost, color: "#a78bfa", label: "Ghost node", desc: "Stateless execution unit. It runs a task, returns the result, and evaporates — no data is stored on it." },
                  { icon: Globe, color: "#34d399", label: "IPFS / Arweave", desc: "Encrypted state is sharded across a content-addressed store. Reconstructable on any machine with your key." },
                  { icon: Radio, color: "#fb923c", label: "Rendezvous relay", desc: "Peer discovery bootstrap only. The relay never sees your state or your messages." },
                  { icon: Users, color: "#facc15", label: "Federation", desc: "Opt-in only. You choose what learning signals to share with the wider network. Personality stays private." },
                  { icon: Shield, color: "#f43f5e", label: "Compliance", desc: "Each node enforces robots.txt and rate limits independently. The distributed design makes it more respectful, not less." },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border/40">
                    <div className="p-1.5 rounded shrink-0" style={{ backgroundColor: item.color + "18" }}>
                      <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                    </div>
                    <div>
                      <p className="font-mono text-xs font-bold text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Mode = "local" | "ghost";

export default function Onboarding() {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<Mode>("local");

  const toggle = (id: number) => setCompleted(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const progress = Math.round((completed.size / LOCAL_STEPS.length) * 100);

  return (
    <div className="p-6 md:p-12 max-w-5xl mx-auto min-h-screen">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Get Started</h1>
        <p className="text-muted-foreground">
          Choose how you want to run OmniLearn. Either way takes less than 30 minutes.
        </p>
      </motion.div>

      {/* Mode tabs */}
      <div className="flex gap-3 mb-10 flex-wrap">
        <button onClick={() => setMode("local")}
          className={cn("flex items-center gap-2.5 px-5 py-3 rounded-xl border text-sm transition-all",
            mode === "local"
              ? "bg-primary/10 border-primary/40 text-primary font-bold"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/20"
          )}>
          <Monitor className="w-4 h-4" />
          Single Machine
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md border",
            mode === "local" ? "text-primary/70 border-primary/20" : "text-muted-foreground/50 border-border/40"
          )}>~20 min</span>
        </button>
        <button onClick={() => setMode("ghost")}
          className={cn("flex items-center gap-2.5 px-5 py-3 rounded-xl border text-sm transition-all",
            mode === "ghost"
              ? "bg-violet-500/10 border-violet-500/40 text-violet-300 font-bold"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/20"
          )}>
          <Ghost className="w-4 h-4" />
          Ghost Deployment
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md border",
            mode === "ghost" ? "text-violet-400/60 border-violet-500/20" : "text-muted-foreground/50 border-border/40"
          )}>use any machine</span>
        </button>
      </div>

      <AnimatePresence mode="wait">

        {/* ── Single Machine ─────────────────────────────────────────────────── */}
        {mode === "local" && (
          <motion.div key="local" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* Plain-English callout */}
            <div className="mb-8 p-5 rounded-xl border border-primary/15 bg-primary/5 flex items-start gap-4">
              <Monitor className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-foreground mb-1">What this does</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  OmniLearn runs entirely on <strong className="text-foreground">your own computer</strong>. No cloud subscription, no data leaving your machine. 
                  You'll install a few tools, download an AI model, and start the system with one command. 
                  Good starting point if you have a reasonably modern laptop or desktop.
                </p>
              </div>
            </div>

            {/* Progress bar */}
            {completed.size > 0 && (
              <div className="mb-6 p-4 rounded-xl border border-border/40 bg-card/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{completed.size} of {LOCAL_STEPS.length} steps done</span>
                  <span className="font-mono text-sm font-bold text-primary">{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
                </div>
                {completed.size === LOCAL_STEPS.length && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-primary flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> All steps complete — your system is running.
                  </motion.p>
                )}
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-3">
                {LOCAL_STEPS.map((step, i) => {
                  const done = completed.has(step.id);
                  return (
                    <motion.div key={step.id}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                      className={cn("border rounded-xl overflow-hidden transition-colors",
                        done ? "border-primary/30 bg-primary/5" : "border-border bg-card/40"
                      )}>
                      <div className="flex items-start gap-4 p-5">
                        <button onClick={() => toggle(step.id)} className="mt-0.5 shrink-0 hover:opacity-80 transition-opacity">
                          {done
                            ? <CheckCircle className="w-6 h-6 text-primary" />
                            : <Circle className="w-6 h-6 text-border" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">Step {step.id}</span>
                            <h3 className="font-bold text-base text-foreground">{step.title}</h3>
                          </div>
                          <p className="text-muted-foreground text-sm mb-4">{step.desc}</p>
                          {step.content}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-mono text-xs text-primary uppercase tracking-wider mb-3">Project structure</h3>
                  <div className="bg-background border border-border rounded-xl p-4 font-mono text-xs overflow-x-auto">
                    {FILE_TREE.map((item, i) => {
                      const indent = item.depth * 14;
                      const Icon = item.type === "file" ? File : item.type === "root" ? Cpu : FolderOpen;
                      return (
                        <div key={i} style={{ paddingLeft: indent }} className={cn("flex items-center gap-1.5 py-0.5",
                          item.type === "file" ? "text-muted-foreground" : "text-cyan-400"
                        )}>
                          <Icon className="w-3 h-3 shrink-0" />
                          <span>{item.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="font-mono text-xs text-primary uppercase tracking-wider mb-3">Plugin system</h3>
                  <div className="bg-background border border-border rounded-xl p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">Drop a Python file into <code className="text-cyan-400">plugins/</code> and it's automatically loaded on next start.</p>
                    <pre className="text-xs font-mono text-muted-foreground leading-5 bg-black/20 rounded-lg p-3">
                      <code>{`class MyPlugin:
    name = "my-source"
    version = "1.0.0"

    async def stream(self):
        yield {"text": "..."}

    def validate_config(self, cfg):
        pass  # raise ValueError if bad`}</code>
                    </pre>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Package className="w-3 h-3 text-primary" />
                        <span>Community plugins: <code className="text-cyan-400">plugins/</code></span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <GitBranch className="w-3 h-3 text-primary" />
                        <span>Submit via PR to <code className="text-cyan-400">main</code></span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-mono text-xs text-primary uppercase tracking-wider mb-3">Testing</h3>
                  <div className="space-y-2">
                    {[
                      { type: "Unit", cmd: "pytest tests/unit/ -v" },
                      { type: "Integration", cmd: "pytest tests/integration/" },
                      { type: "Quality", cmd: "python -m omnilearn.eval quality" },
                    ].map(t => (
                      <div key={t.type} className="bg-background border border-border rounded-lg p-3">
                        <div className="font-mono text-xs font-bold text-foreground mb-1.5">{t.type}</div>
                        <code className="text-xs text-primary font-mono bg-primary/5 px-2 py-1 rounded block">{t.cmd}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Ghost Deployment ───────────────────────────────────────────────── */}
        {mode === "ghost" && (
          <motion.div key="ghost" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">

            {/* Plain-English intro */}
            <div className="p-5 rounded-xl border border-violet-500/20 bg-violet-500/5 flex items-start gap-4">
              <Ghost className="w-5 h-5 text-violet-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-foreground mb-1">What this does</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ghost mode lets OmniLearn use <strong className="text-foreground">other computers you control</strong> — a home server, an old laptop, a cheap cloud VM — to handle your chat requests.
                  When you chat in Ghost mode, your message is sent to one of your registered machines, processed there, and the answer comes back here.
                  It's like having a remote worker you trust, rather than running everything on your current machine.
                </p>
              </div>
            </div>

            {/* Visual 3-step flow */}
            <div>
              <h2 className="font-mono text-xs text-primary uppercase tracking-wider mb-4">How to get set up — 3 steps</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  {
                    num: "1",
                    icon: Github,
                    color: "text-foreground",
                    bg: "bg-secondary/30",
                    border: "border-border/40",
                    title: "Get the node code",
                    desc: "Create a GitHub repo with the ghost node server included — ready to run, with a full setup guide inside.",
                    action: "Use the button below ↓",
                  },
                  {
                    num: "2",
                    icon: Cloud,
                    color: "text-violet-400",
                    bg: "bg-violet-500/10",
                    border: "border-violet-500/20",
                    title: "Run it on another machine",
                    desc: "Clone the repo on any computer you want to use. Set two values in a config file, then run one command to start.",
                    action: "See the deploy commands ↓",
                  },
                  {
                    num: "3",
                    icon: Zap,
                    color: "text-emerald-400",
                    bg: "bg-emerald-500/10",
                    border: "border-emerald-500/20",
                    title: "Connect it here",
                    desc: "Paste the machine's address and secret key into the form below. Done — switch to Ghost mode in Chat to use it.",
                    action: "Use the form below ↓",
                  },
                ].map((s, i) => (
                  <div key={s.num} className={cn("rounded-xl border p-5 space-y-3", s.border, s.bg)}>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-3xl font-black text-border/40">{s.num}</span>
                      <div className={cn("p-2 rounded-lg", s.bg)}>
                        <s.icon className={cn("w-4 h-4", s.color)} />
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground/40 font-mono">{s.action}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 1: GitHub repo */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-primary font-bold bg-primary/10 px-2 py-0.5 rounded">STEP 1</span>
                <h3 className="font-bold text-foreground">Get the ghost node code</h3>
              </div>
              <GitHubRepoSection />
            </div>

            {/* Step 2: Deploy commands */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-violet-400 font-bold bg-violet-500/10 px-2 py-0.5 rounded">STEP 2</span>
                <h3 className="font-bold text-foreground">Run it on the other machine</h3>
              </div>
              <div className="rounded-xl border border-border/40 bg-card/20 p-5 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Open a terminal on the machine you want to use as a node (your home server, another laptop, a cloud VM, etc.) and run these commands:
                </p>
                <pre className="bg-black/40 rounded-xl border border-border/30 p-4 font-mono text-sm text-primary/90 overflow-x-auto leading-7">
                  <code>{`# 1. Download the code (replace YOUR_USERNAME with your GitHub username)
git clone https://github.com/YOUR_USERNAME/omnilearn-ghost-node.git
cd omnilearn-ghost-node

# 2. Create your config file from the template
cp .env.example .env

# 3. Open .env and set these two values:
#    GHOST_NODE_SECRET=choose-any-long-random-string
#    ANTHROPIC_API_KEY=your-anthropic-api-key

# 4. Install and start (pick one)
npm install && npm start       # Simple start
docker compose up -d           # Or run with Docker (recommended)`}</code>
                </pre>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border/40">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-foreground">The machine must be reachable</p>
                      <p className="text-xs text-muted-foreground mt-0.5">It needs a public URL or IP. For home use, try Cloudflare Tunnel or ngrok to get a public address without opening router ports.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border/40">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Keep the secret key safe</p>
                      <p className="text-xs text-muted-foreground mt-0.5">The <code className="text-primary">GHOST_NODE_SECRET</code> you set is like a password — it proves the request came from you. Make it long and random.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Connect nodes */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">STEP 3</span>
                <h3 className="font-bold text-foreground">Connect the node to this app</h3>
              </div>
              <div className="rounded-xl border border-border/40 bg-card/20 p-5 space-y-5">
                <p className="text-sm text-muted-foreground">
                  Once your machine is running, paste its URL and secret key below. The app will check connectivity automatically.
                  After that, go to <strong className="text-foreground">Chat → Ghost mode</strong> to start using it.
                </p>
                <LiveNodeManager />
              </div>
            </div>

            {/* Technical details (collapsed) */}
            <TechDetails />

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
