import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, Circle, Terminal, FolderOpen, File,
  GitBranch, Package, Cpu, Ghost, Server, Key, Radio, Globe,
  Shield, Users, Plus, Trash2, RefreshCw,
  CheckCircle2, XCircle, Loader2, Link2, Eye, EyeOff,
  AlertCircle, ExternalLink, Github, ChevronDown, ChevronRight,
  Zap, Monitor, Cloud, Rocket, Target, History, Sparkles, Info,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
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
            { label: "Node.js 18+", note: "Runs the frontend and backend (we'll install it with you)", required: true },
            { label: "4 GB RAM", note: "Minimum — 8 GB recommended for smooth multitasking", required: true },
            { label: "10 GB free disk", note: "For the app, dependencies, and local data", required: true },
            { label: "Git", note: "To download the code from GitHub", required: true },
            { label: "pnpm", note: "Package manager (we'll show you how to install)", required: true },
            { label: "GPU / CUDA", note: "Not needed — AI runs in the cloud via Claude API", required: false },
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
          <p className="text-xs text-muted-foreground mb-2">Quick check — run these in your terminal:</p>
          <pre className="text-xs font-mono text-primary/80 leading-6">
            <code>{`node --version      # Should say v18.x or higher
git --version       # Should say 2.x or higher
pnpm --version      # If installed, shows version number`}</code>
          </pre>
          <p className="text-xs text-muted-foreground mt-2">Don't have Node.js or pnpm? We'll install them together in the next step.</p>
        </div>
        <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Good news:</strong> OmniLearn uses a <strong className="text-emerald-400">local AI synthesizer</strong> — no API keys, no cloud costs, no data leaving your machine. Your conversations stay private, forever.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 2,
    title: "Download the code",
    desc: "Copy the OmniLearn project to your computer and install its dependencies. This takes a few minutes.",
    content: (
      <div className="space-y-4">
        <pre className="bg-background border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground leading-6">
          <code>{`# Download the project
git clone https://github.com/Cloud99p/omnilearn-agent.git
cd omnilearn-agent

# Install pnpm if you don't have it
npm install -g pnpm

# Install all dependencies (frontend + backend)
pnpm install

# That's it! Ready to configure.`}</code>
        </pre>
        <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">No Python needed!</strong> OmniLearn is built with Node.js + TypeScript. The AI runs via Claude API (cloud), so no heavy local models.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 3,
    title: "Set up environment variables",
    desc: "OmniLearn needs auth and database setup. The AI runs locally — no API keys needed!",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Copy the example env file and fill in your keys:</p>
        <pre className="bg-background border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground leading-6">
          <code>{`# Copy the template
cp .env.example .env

# Edit .env and add your keys:
CLERK_SECRET_KEY=sk_test_xxx
CLERK_PUBLISHABLE_KEY=pk_test_xxx
DATABASE_URL=postgresql://xxx

# That's it! No AI API keys needed — runs locally.`}</code>
        </pre>
        <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Where to get keys:</strong>
            </p>
            <ul className="text-xs text-muted-foreground mt-1 space-y-1">
              <li>• Clerk (auth): <a href="https://clerk.com" target="_blank" className="text-primary hover:underline">clerk.com</a></li>
              <li>• Supabase (database): <a href="https://supabase.com" target="_blank" className="text-primary hover:underline">supabase.com</a></li>
            </ul>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">No AI costs!</strong> OmniLearn uses a local synthesizer. No API bills, no rate limits, no data sent to OpenAI/Anthropic.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 4,
    title: "Push database schema",
    desc: "Set up your database tables for the first time. This only happens once.",
    content: (
      <div className="space-y-4">
        <pre className="bg-background border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground leading-6">
          <code>{`# From the project root:
pnpm --filter @workspace/db run push

# This creates all the tables in your Supabase database.
# Takes about 30 seconds.`}</code>
        </pre>
        <div className="flex items-start gap-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Done?</strong> Your database is ready. You only do this once unless you change the schema.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 5,
    title: "Start OmniLearn",
    desc: "Launch the frontend and backend. You'll be up and running in seconds.",
    content: (
      <div className="space-y-4">
        <pre className="bg-background border border-border rounded-lg p-4 text-xs font-mono text-muted-foreground leading-6">
          <code>{`# Start everything (frontend + backend)
pnpm dev

# Or start them separately:
# Terminal 1: pnpm --filter api-server run dev
# Terminal 2: pnpm --filter omnilearn run dev`}</code>
        </pre>
        <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Open in your browser:</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Frontend: <code className="text-primary bg-primary/10 px-1 rounded">http://localhost:5173</code>
            </p>
            <p className="text-xs text-muted-foreground">
              Backend API: <code className="text-primary bg-primary/10 px-1 rounded">http://localhost:3001</code>
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            First build takes <strong className="text-foreground">1–2 minutes</strong>. If something fails, check that all env vars are set correctly in <code className="text-primary">.env</code>.
          </p>
        </div>
      </div>
    ),
  },
];

const FILE_TREE = [
  { name: "omnilearn-agent/", type: "root", depth: 0 },
  { name: "artifacts/", type: "folder", depth: 1 },
  { name: "omnilearn/", type: "folder", depth: 2 },
  { name: "src/pages/", type: "folder", depth: 3 },
  { name: "chat.tsx", type: "file", depth: 4 },
  { name: "api-server/", type: "folder", depth: 2 },
  { name: "src/brain/", type: "folder", depth: 3 },
  { name: "routes/", type: "folder", depth: 3 },
  { name: "lib/", type: "folder", depth: 1 },
  { name: "db/", type: "folder", depth: 2 },
  { name: "api-client/", type: "folder", depth: 2 },
  { name: ".env.example", type: "file", depth: 0 },
  { name: "package.json", type: "file", depth: 0 },
  { name: "pnpm-workspace.yaml", type: "file", depth: 0 },
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
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async (pingFirst = false) => {
    try {
      if (pingFirst) {
        await fetch(`${BASE}/api/ghost/nodes/ping-all`, { method: "POST" });
      }
      const [nr, sr] = await Promise.all([
        fetch(`${BASE}/api/ghost/nodes`),
        fetch(`${BASE}/api/ghost/status`),
      ]);
      if (nr.ok) {
        const nodesData = await nr.json();
        setNodes(nodesData);
        // Calculate online count from actual node statuses (fallback)
        const onlineCount = nodesData.filter((n: GhostNode) => n.status === "online").length;
        if (sr.ok) {
          const statusData = await sr.json();
          // Use the higher of the two counts (API vs calculated)
          setStatus({ ...statusData, online: Math.max(statusData.online, onlineCount) });
        } else {
          setStatus({ total: nodesData.length, online: onlineCount, offline: nodesData.length - onlineCount, totalTasksProcessed: 0, selfEndpoint: "" });
        }
      } else if (sr.ok) {
        setStatus(await sr.json());
      }
      setLastRefresh(new Date());
    } catch { /* offline */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchData(false), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

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
          {lastRefresh && (
            <p className="text-[10px] text-muted-foreground/50 mt-1 flex items-center gap-1">
              <RefreshCw className="w-2.5 h-2.5" /> Auto-refreshing every 30s • Last updated {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
        {nodes.length > 0 && (
          <button onClick={() => fetchData(true)} disabled={pingingAll || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground text-xs transition-all disabled:opacity-50">
            {pingingAll || loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh now
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

// ─── Roadmap Component ───────────────────────────────────────────────────────

function Roadmap() {
  const [open, setOpen] = useState(false);

  const timeline = [
    {
      period: "May 2026",
      status: "completed" as const,
      icon: History,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      title: "We Started",
      items: [
        "Built the foundation — AI that learns and remembers",
        "Made it work on any device, anywhere",
        "Fixed the basics (identity, memory, reliability)",
        "Opened it up for people to actually use",
        "Proof that decentralized AI is possible",
      ],
    },
    {
      period: "Now",
      status: "active" as const,
      icon: Target,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      title: "Finding Our Feet",
      items: [
        "Learning what people actually need (not what we think they need)",
        "Growing our first community of believers",
        "Making the AI smarter from every conversation",
        "Connecting more computers to make it faster",
        "Proving this model can work at scale",
        "Not giving up when things break (they always break)",
      ],
    },
    {
      period: "2027",
      status: "planned" as const,
      icon: Rocket,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
      border: "border-violet-500/20",
      title: "Becoming Essential",
      items: [
        "Your AI that knows you — your work, your goals, your style",
        "Available on every device, everywhere you are",
        "Learning from the world's knowledge, owned by you",
        "Fast enough to feel instant, smart enough to feel human",
        "Trusted by millions who depend on it daily",
      ],
    },
    {
      period: "2030+",
      status: "planned" as const,
      icon: Sparkles,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
      title: "Connecting the World",
      items: [
        "Everything you need to know, at your beck and call",
        "A global brain — connected, distributed, owned by everyone",
        "No more information inequality — knowledge is free and universal",
        "Your AI twin that understands you better than you understand yourself",
        "The infrastructure for human knowledge, forever",
        "AI for everyone, not just the wealthy or connected",
      ],
    },
  ];

  return (
    <div className="rounded-xl border border-border/30 overflow-hidden mt-8">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-secondary/10 transition-colors">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Project Roadmap</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-5 pb-5 space-y-4 border-t border-border/20 pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Follow our journey from production launch to intelligent, evolving AI agents.
              </p>
              <div className="space-y-3">
                {timeline.map((phase, i) => (
                  <div key={phase.period} className={cn("rounded-lg border p-4", phase.border, phase.bg)}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn("p-2 rounded-lg", phase.bg)}>
                        <phase.icon className={cn("w-4 h-4", phase.color)} />
                      </div>
                      <div>
                        <p className={cn("font-mono text-xs font-bold", phase.color)}>{phase.period}</p>
                        <p className="font-bold text-sm text-foreground">{phase.title}</p>
                      </div>
                      {phase.status === "completed" && (
                        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">DONE</span>
                      )}
                      {phase.status === "active" && (
                        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold animate-pulse">IN PROGRESS</span>
                      )}
                      {phase.status === "planned" && (
                        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-bold">PLANNED</span>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {phase.items.map((item, j) => (
                        <li key={j} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className={cn("w-1 h-1 rounded-full mt-1 shrink-0", phase.color.replace("text-", "bg-"))} />
                          {item}
                        </li>
                      ))}
                    </ul>
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

  useEffect(() => {
    if (completed.size === LOCAL_STEPS.length) {
      localStorage.setItem("omni_onboarded", "true");
    }
  }, [completed]);

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
                  OmniLearn runs entirely on <strong className="text-foreground">your own computer</strong>. Your data stays local, your conversations are private. 
                  <strong className="text-foreground">AI runs locally too</strong> — no API costs, no cloud dependencies, nothing sent to OpenAI/Anthropic. 
                  Perfect for development, testing, or personal use on a modern laptop.
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
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex flex-wrap items-center gap-3">
                    <p className="text-xs text-primary flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> All steps complete — your system is running.
                    </p>
                    <Link href="/chat">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-mono text-xs font-semibold hover:bg-primary/90 transition-colors">
                        Start chatting <ChevronRight className="w-3 h-3" />
                      </button>
                    </Link>
                  </motion.div>
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
                  <h3 className="font-mono text-xs text-primary uppercase tracking-wider mb-3">Extending OmniLearn</h3>
                  <div className="bg-background border border-border rounded-xl p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Build custom features on top of the core platform. The codebase is yours to modify.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Cpu className="w-3 h-3 text-primary" />
                        <span>Add new AI synthesizers in <code className="text-cyan-400">src/brain/</code></span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Globe className="w-3 h-3 text-primary" />
                        <span>Custom data sources in <code className="text-cyan-400">src/routes/</code></span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Shield className="w-3 h-3 text-primary" />
                        <span>Modify moderation in <code className="text-cyan-400">lib/moderation.ts</code></span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-mono text-xs text-primary uppercase tracking-wider mb-3">Development</h3>
                  <div className="space-y-2">
                    {[
                      { type: "Install", cmd: "pnpm install" },
                      { type: "Dev mode", cmd: "pnpm dev" },
                      { type: "Type check", cmd: "pnpm typecheck" },
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

# 3. Open .env and set these values:
GHOST_NODE_SECRET=ghost_sk_$(openssl rand -hex 16)
# ANTHROPIC_API_KEY= (leave empty if using local synthesizer)

# 4. Install and start (pick one)
npm install && npm start       # Simple start
docker compose up -d           # Or run with Docker (recommended)`}</code>
                </pre>
                
                {/* Expose to Internet Section */}
                <div className="mt-6 p-4 rounded-xl border border-violet-500/20 bg-violet-500/5">
                  <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-violet-400" />
                    Expose your node to the internet
                  </h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Your Ghost Node needs a public URL so OmniLearn can reach it. Use one of these methods (no router configuration needed):
                  </p>
                  
                  {/* Option A: Cloudflare Tunnel */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">OPTION A</span>
                      <span className="text-sm font-bold text-foreground">Cloudflare Tunnel (Recommended — Free, No Account)</span>
                    </div>
                    <pre className="bg-black/40 rounded-lg border border-border/30 p-3 font-mono text-xs text-primary/90 overflow-x-auto leading-6">
                      <code>{`# Install cloudflared (one-time)
# Windows (PowerShell as Admin):
winget install cloudflare.cloudflared

# macOS:
brew install cloudflared

# Linux:
# See: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads

# Start the tunnel (run in a NEW terminal, keep ghost node running)
cloudflared tunnel --url http://localhost:8080`}</code>
                    </pre>
                    <p className="text-xs text-muted-foreground">
                      You'll see output like: <code className="text-violet-400 bg-violet-500/10 px-1 rounded">https://abc123-xyz456.trycloudflare.com</code> — copy that URL!
                    </p>
                  </div>
                  
                  {/* Option B: ngrok */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">OPTION B</span>
                      <span className="text-sm font-bold text-foreground">ngrok (Free tier — Requires Account)</span>
                    </div>
                    <pre className="bg-black/40 rounded-lg border border-border/30 p-3 font-mono text-xs text-primary/90 overflow-x-auto leading-6">
                      <code>{`# Install ngrok (one-time)
# See: https://ngrok.com/download

# Start the tunnel (run in a NEW terminal)
ngrok http 8080`}</code>
                    </pre>
                    <p className="text-xs text-muted-foreground">
                      You'll see a URL like: <code className="text-violet-400 bg-violet-500/10 px-1 rounded">https://abc123.ngrok.io</code> — copy that URL!
                    </p>
                  </div>
                  
                  {/* Option C: Cloudflare Permanent Tunnel */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">OPTION C</span>
                      <span className="text-sm font-bold text-foreground">Cloudflare Permanent Tunnel (Free — Requires Cloudflare Account)</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      This gives you a permanent URL that never changes, even after restarts.
                    </p>
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 space-y-2">
                      <div className="text-xs font-bold text-emerald-400 mb-2">Step 1: Login</div>
                      <pre className="bg-black/40 rounded p-2 font-mono text-xs text-primary/90"><code>{`cloudflared tunnel login`}</code></pre>
                      
                      <div className="text-xs font-bold text-emerald-400 mb-2">Step 2: Create tunnel</div>
                      <pre className="bg-black/40 rounded p-2 font-mono text-xs text-primary/90"><code>{`cloudflared tunnel create omnilearn-ghost`}</code></pre>
                      <p className="text-[10px] text-muted-foreground">Note the tunnel ID it gives you!</p>
                      
                      <div className="text-xs font-bold text-emerald-400 mb-2">Step 3: Create config (Windows)</div>
                      <pre className="bg-black/40 rounded p-2 font-mono text-xs text-primary/90"><code>{`@"tunnel: omnilearn-ghost
credentials-file: C:\Users\<YourUser>\.cloudflared\<TUNNEL_ID>.json
ingress:
  - hostname: ghost.omnilearn.dpdns.org
    service: http://localhost:8080
  - service: http_status:404
"@ | Out-File $env:USERPROFILE\.cloudflared\config.yml`}</code></pre>
                      
                      <div className="text-xs font-bold text-emerald-400 mb-2">Step 4: Route hostname</div>
                      <pre className="bg-black/40 rounded p-2 font-mono text-xs text-primary/90"><code>{`cloudflared tunnel route dns omnilearn-ghost ghost.omnilearn.dpdns.org`}</code></pre>
                      
                      <div className="text-xs font-bold text-emerald-400 mb-2">Step 5: Run tunnel</div>
                      <pre className="bg-black/40 rounded p-2 font-mono text-xs text-primary/90"><code>{`cloudflared tunnel run omnilearn-ghost`}</code></pre>
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        Your permanent URL: <code className="text-emerald-400 bg-emerald-500/10 px-1 rounded">https://ghost.omnilearn.dpdns.org</code>
                      </p>
                      
                      <p className="text-[10px] text-muted-foreground">
                        <strong>Survive reboots:</strong> <code className="text-primary">cloudflared service install omnilearn-ghost</code>
                      </p>
                    </div>
                  </div>
                </div>
                
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
                
                {/* Troubleshooting */}
                <div className="mt-4 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
                  <h5 className="font-bold text-xs text-foreground mb-2 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
                    Troubleshooting
                  </h5>
                  <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                    <li>If the tunnel won't start, make sure nothing else is using port 8080</li>
                    <li>Keep both terminals open — one for the ghost node, one for the tunnel</li>
                    <li>Test the URL in your browser first: you should see a health check response</li>
                    <li>Firewall issues? Try disabling temporarily or allow Node.js through</li>
                  </ul>
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

            {/* Roadmap */}
            <Roadmap />

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
