import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ghost, Plus, Trash2, RefreshCw, CheckCircle2, XCircle,
  Clock, Activity, Terminal, Copy, ChevronDown, ChevronRight,
  Zap, Globe, Github, AlertCircle, Loader2, Server, Link2,
  Eye, EyeOff, ArrowRight, ExternalLink, Users, Ticket, Brain,
  WifiOff, Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface BrowserWorker {
  workerId: string;
  name: string;
  status: string;
  online: boolean;
  lastSeen: string | null;
  tasksProcessed: number;
  tasksFailed: number;
  avgResponseMs: number | null;
  connectedAt: string;
}

interface InviteToken {
  id: number;
  token: string;
  label: string;
  maxUses: number;
  usesCount: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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
  createdAt: string;
}

interface NetworkStatus {
  total: number;
  online: number;
  offline: number;
  totalTasksProcessed: number;
  avgResponseMs: number | null;
  selfEndpoint: string;
}

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
      status === "offline" ? "bg-red-400" :
      "bg-yellow-400/60"
    )} />
  );
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors font-mono text-xs">
      {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {label ?? (copied ? "Copied" : "Copy")}
    </button>
  );
}

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  return (
    <div className="relative rounded-lg border border-border/40 bg-black/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
        <span className="font-mono text-[10px] text-muted-foreground/60 uppercase">{language}</span>
        <CopyButton value={code} />
      </div>
      <pre className="p-3 overflow-x-auto font-mono text-xs text-primary/90 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function NodeCard({ node, onPing, onDelete }: {
  node: GhostNode;
  onPing: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [pinging, setPinging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handlePing = async () => {
    setPinging(true);
    await onPing(node.id);
    setPinging(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(node.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        "rounded-xl border bg-card/30 overflow-hidden transition-colors",
        node.status === "online" ? "border-emerald-500/20" :
        node.status === "offline" ? "border-red-500/20" :
        "border-border/40"
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <StatusDot status={node.status} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-foreground">{node.name}</span>
                {node.isSelf && (
                  <span className="px-1.5 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider bg-primary/10 border border-primary/20 text-primary">This instance</span>
                )}
                <span className="px-1.5 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider bg-secondary/30 text-muted-foreground">{node.region}</span>
              </div>
              <a href={node.endpoint} target="_blank" rel="noopener noreferrer"
                className="font-mono text-xs text-muted-foreground/60 hover:text-primary transition-colors flex items-center gap-1 mt-0.5 truncate">
                {node.endpoint}
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePing}
              disabled={pinging}
              className="p-1.5 rounded-md border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50"
              title="Ping node"
            >
              {pinging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded-md border border-border/40 text-muted-foreground hover:text-foreground transition-all"
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-md border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition-all disabled:opacity-50"
              title="Remove node"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-4 flex-wrap">
          <span className={cn(
            "font-mono text-xs",
            node.status === "online" ? "text-emerald-400" :
            node.status === "offline" ? "text-red-400" : "text-yellow-400"
          )}>
            {node.status === "online" ? "Online" : node.status === "offline" ? "Offline" : "Unknown"}
          </span>
          {node.lastSeen && (
            <span className="font-mono text-xs text-muted-foreground/60">
              Last seen {timeSince(node.lastSeen)}
            </span>
          )}
          <span className="font-mono text-xs text-muted-foreground/60">
            {node.tasksProcessed} task{node.tasksProcessed !== 1 ? "s" : ""}
          </span>
          {node.avgResponseMs && (
            <span className="font-mono text-xs text-muted-foreground/60">
              avg {Math.round(node.avgResponseMs)}ms
            </span>
          )}
        </div>

        {node.notes && (
          <p className="mt-2 font-mono text-xs text-muted-foreground/50 italic">{node.notes}</p>
        )}
      </div>

      {/* Expanded: deploy instructions */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/30"
          >
            <div className="p-4 space-y-3">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Node deploy commands</p>
              <CodeBlock
                code={`# 1. Clone the ghost node repo\ngit clone <your-ghost-node-repo-url>\ncd omnilearn-ghost-node\n\n# 2. Configure environment\ncp .env.example .env\n# Edit .env and set your GHOST_NODE_SECRET (AI runs locally with synthesizer)\n\n# 3. Start with Docker\ndocker compose up -d\n\n# 4. Verify it's alive\ncurl ${node.endpoint}/api/ghost/health`}
              />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mt-2">Or run directly</p>
              <CodeBlock
                code={`GHOST_NODE_SECRET=<your-secret> \\\nGHOST_NODE_NAME="${node.name}" \\\nPORT=8080 \\\nnode ghost-server.js`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AddNodeForm({ onAdd }: { onAdd: (node: GhostNode) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", endpoint: "", secretKey: "", region: "unknown", notes: "" });
  const [showSecret, setShowSecret] = useState(false);
  const [result, setResult] = useState<{ status: "online" | "offline" | null; pingMs: number | null }>({ status: null, pingMs: null });
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.name.trim() || !form.endpoint.trim() || !form.secretKey.trim()) {
      setError("Name, endpoint URL, and secret key are required.");
      return;
    }
    setLoading(true);
    setError("");
    setResult({ status: null, pingMs: null });
    try {
      const res = await fetch(`${BASE}/api/ghost/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to register node"); setLoading(false); return; }
      setResult({ status: data.pingStatus, pingMs: data.pingMs });
      onAdd(data);
      setForm({ name: "", endpoint: "", secretKey: "", region: "unknown", notes: "" });
      setOpen(false);
    } catch {
      setError("Network error. Is the API server running?");
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
        <Plus className="w-4 h-4" /> Add ghost node
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-primary/20 bg-card/40 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-sm font-bold text-foreground">Connect a ghost node</h3>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="grid gap-3">
        <div>
          <label className="font-mono text-xs text-muted-foreground mb-1.5 block">Node name</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Home Lab, AWS us-east, Office PC"
            className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
          />
        </div>

        <div>
          <label className="font-mono text-xs text-muted-foreground mb-1.5 block">Endpoint URL</label>
          <input
            value={form.endpoint}
            onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))}
            placeholder="https://your-server.com or http://192.168.1.5:8080"
            className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
          />
          <p className="font-mono text-[10px] text-muted-foreground/50 mt-1">
            The public URL where your ghost node is running.
          </p>
        </div>

        <div>
          <label className="font-mono text-xs text-muted-foreground mb-1.5 block">Secret key</label>
          <div className="relative">
            <input
              type={showSecret ? "text" : "password"}
              value={form.secretKey}
              onChange={e => setForm(f => ({ ...f, secretKey: e.target.value }))}
              placeholder="Must match GHOST_NODE_SECRET on the remote server"
              className="w-full px-3 py-2 pr-9 rounded-lg border border-border/60 bg-background font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
            />
            <button
              type="button"
              onClick={() => setShowSecret(s => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-mono text-xs text-muted-foreground mb-1.5 block">Region (optional)</label>
            <input
              value={form.region}
              onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
              placeholder="e.g. eu-west, home-lab"
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="font-mono text-xs text-muted-foreground mb-1.5 block">Notes (optional)</label>
            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. 32GB RAM, RTX 4090"
              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 font-mono text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      {result.status && (
        <div className={cn(
          "flex items-center gap-2 font-mono text-xs rounded-lg px-3 py-2",
          result.status === "online"
            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
            : "bg-red-500/10 border border-red-500/20 text-red-400"
        )}>
          {result.status === "online"
            ? <CheckCircle2 className="w-3.5 h-3.5" />
            : <XCircle className="w-3.5 h-3.5" />}
          {result.status === "online"
            ? `Node reachable — ${result.pingMs}ms`
            : "Node unreachable. It was saved but marked offline. Check the URL and secret key."}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-mono text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          {loading ? "Connecting..." : "Connect node"}
        </button>
        <button onClick={() => setOpen(false)} className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

function GitHubRepoSection() {
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ htmlUrl?: string; fullName?: string; error?: string } | null>(null);
  const [repoName, setRepoName] = useState("omnilearn-ghost-node");
  const [isPrivate, setIsPrivate] = useState(false);

  const create = async () => {
    setCreating(true);
    setResult(null);
    try {
      const res = await fetch(`${BASE}/api/github/create-repo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoName, isPrivate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error ?? "Failed to create repository" });
      } else {
        setResult({ htmlUrl: data.repo.htmlUrl, fullName: data.repo.fullName });
      }
    } catch {
      setResult({ error: "Network error" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg border border-border/40 bg-secondary/20 flex items-center justify-center shrink-0">
          <Github className="w-4.5 h-4.5 text-foreground" />
        </div>
        <div>
          <h3 className="font-mono text-sm font-bold text-foreground">Create GitHub Deployment Repo</h3>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">
            Generate a ready-to-deploy GitHub repository containing the ghost node server, Docker Compose config, setup scripts, and documentation.
          </p>
        </div>
      </div>

      {result?.htmlUrl ? (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="font-mono text-xs text-emerald-400 font-bold">{result.fullName}</p>
            <a href={result.htmlUrl} target="_blank" rel="noopener noreferrer"
              className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              {result.htmlUrl} <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-3">
            <input
              value={repoName}
              onChange={e => setRepoName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-border/60 bg-background font-mono text-sm text-foreground focus:outline-none focus:border-primary/50"
              placeholder="repo-name"
            />
            <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)}
                className="accent-primary" />
              Private
            </label>
          </div>

          {result?.error && (
            <div className="flex items-center gap-2 text-red-400 font-mono text-xs">
              <AlertCircle className="w-3.5 h-3.5" /> {result.error}
            </div>
          )}

          <button
            onClick={create}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/60 text-foreground hover:border-primary/40 hover:text-primary font-mono text-sm transition-all disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
            {creating ? "Creating repository..." : "Create deployment repository"}
          </button>
          <p className="font-mono text-[10px] text-muted-foreground/50">
            Requires GitHub account connected via your Account page.
          </p>
        </div>
      )}
    </div>
  );
}

export default function GhostNetworkPage() {
  const [nodes, setNodes] = useState<GhostNode[]>([]);
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pingingAll, setPingingAll] = useState(false);
  const [setupExpanded, setSetupExpanded] = useState(false);
  const [browserWorkers, setBrowserWorkers] = useState<BrowserWorker[]>([]);
  const [invites, setInvites] = useState<InviteToken[]>([]);
  const [inviteLabel, setInviteLabel] = useState("");
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteExpanded, setInviteExpanded] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [nodesRes, statusRes, workersRes, invitesRes] = await Promise.all([
        fetch(`${BASE}/api/ghost/nodes`),
        fetch(`${BASE}/api/ghost/status`),
        fetch(`${BASE}/api/ghost/workers`),
        fetch(`${BASE}/api/ghost/invites`),
      ]);
      if (nodesRes.ok)   setNodes(await nodesRes.json());
      if (statusRes.ok)  setStatus(await statusRes.json());
      if (workersRes.ok) setBrowserWorkers(await workersRes.json());
      if (invitesRes.ok) setInvites(await invitesRes.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pingAll = async () => {
    setPingingAll(true);
    try {
      const res = await fetch(`${BASE}/api/ghost/nodes/ping-all`, { method: "POST" });
      if (res.ok) await fetchData();
    } finally {
      setPingingAll(false);
    }
  };

  const pingNode = async (id: number) => {
    const res = await fetch(`${BASE}/api/ghost/nodes/${id}/ping`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setNodes(prev => prev.map(n => n.id === id ? { ...n, ...data.node, secretKey: n.secretKey } : n));
    }
  };

  const deleteNode = async (id: number) => {
    await fetch(`${BASE}/api/ghost/nodes/${id}`, { method: "DELETE" });
    setNodes(prev => prev.filter(n => n.id !== id));
    await fetchData();
  };

  const addNode = (node: GhostNode) => {
    setNodes(prev => [...prev, node]);
    fetchData();
  };

  const generateInvite = async () => {
    setGeneratingInvite(true);
    try {
      const res = await fetch(`${BASE}/api/ghost/worker/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: inviteLabel.trim() || "Worker invite", maxUses: 100 }),
      });
      if (res.ok) {
        setInviteLabel("");
        await fetchData();
      }
    } finally {
      setGeneratingInvite(false);
    }
  };

  const revokeInvite = async (id: number) => {
    await fetch(`${BASE}/api/ghost/invites/${id}`, { method: "DELETE" });
    await fetchData();
  };

  const copyWorkerUrl = async (token: string) => {
    const workerUrl = `${window.location.origin}${import.meta.env.BASE_URL}worker?token=${token}`;
    await navigator.clipboard.writeText(workerUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const selfEndpoint = status?.selfEndpoint ?? "";
  const activeWorkers = browserWorkers.filter(w => w.online);

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Ghost className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="font-mono text-xl font-bold text-foreground">Ghost Network</h1>
            <p className="font-mono text-xs text-muted-foreground">Distributed compute nodes for OmniLearn</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={pingAll}
              disabled={pingingAll}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground font-mono text-xs transition-all disabled:opacity-50"
            >
              {pingingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Ping all
            </button>
          </div>
        </div>
      </div>

      {/* Stats overview */}
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: "Server nodes", value: status.total, icon: Server, color: "text-foreground" },
            { label: "Nodes online", value: status.online, icon: CheckCircle2, color: "text-emerald-400" },
            { label: "Browser workers", value: activeWorkers.length, icon: Brain, color: "text-violet-400" },
            { label: "Tasks processed", value: status.totalTasksProcessed + browserWorkers.reduce((s, w) => s + w.tasksProcessed, 0), icon: Zap, color: "text-primary" },
            { label: "Invites active", value: invites.filter(i => i.active).length, icon: Ticket, color: "text-amber-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border/40 bg-card/30 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn("w-3.5 h-3.5", color)} />
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
              </div>
              <span className={cn("font-mono text-2xl font-bold", color)}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* "How it works" + setup guide */}
      <div className="mb-6 rounded-xl border border-border/40 bg-card/20 overflow-hidden">
        <button
          onClick={() => setSetupExpanded(e => !e)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Terminal className="w-4 h-4 text-primary" />
            <span className="font-mono text-sm font-bold text-foreground">How Ghost Mode works — Setup guide</span>
          </div>
          {setupExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>

        <AnimatePresence>
          {setupExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-5 border-t border-border/30">
                <div className="mt-4 space-y-1">
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                    Ghost Mode turns every device you own into one connected web of compute. Each ghost node can run anywhere — laptop, desktop, home server, phone, cloud VM, or another Replit deployment — and your tasks can move between them without breaking continuity.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  {[
                    { step: "1", title: "Deploy a ghost node", desc: "Run the ghost node server on any machine with Node.js or Docker." },
                    { step: "2", title: "Register it here", desc: "Add the node's URL and shared secret. OmniLearn will ping it to verify." },
                    { step: "3", title: "Chat in Ghost Mode", desc: "Switch to Ghost mode in Chat. Messages route to the best available node." },
                  ].map(({ step, title, desc }) => (
                    <div key={step} className="rounded-lg border border-border/40 bg-secondary/10 p-3">
                      <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mb-2">
                        <span className="font-mono text-xs text-violet-400 font-bold">{step}</span>
                      </div>
                      <p className="font-mono text-xs font-bold text-foreground mb-1">{title}</p>
                      <p className="font-mono text-xs text-muted-foreground leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Quick deploy — Docker</p>
                  <CodeBlock code={`# Clone your ghost node repo, then:\ndocker compose up -d`} />
                </div>

                <div>
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Quick deploy — Node.js (no Docker)</p>
                  <CodeBlock code={`npm install\ncp .env.example .env\n# Fill in GHOST_NODE_SECRET in .env (AI runs locally)\nnpm start`} />
                </div>

                <div>
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Register this instance as a ghost node</p>
                  <p className="font-mono text-xs text-muted-foreground/70 mb-2">
                    You can register this OmniLearn instance itself as a ghost node so other OmniLearn installs can route tasks to it. Set <code className="bg-black/30 px-1 rounded text-primary/80">GHOST_NODE_SECRET</code> in your environment secrets, then add the node below using your own URL.
                  </p>
                  <CodeBlock
                    language="text"
                    code={`Endpoint: ${selfEndpoint || "https://your-replit-domain.replit.app"}\nHealth check: ${selfEndpoint || "https://your-replit-domain.replit.app"}/api/ghost/health`}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Node list */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            Registered nodes ({nodes.length})
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
          </div>
        ) : nodes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 p-10 text-center">
            <Ghost className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="font-mono text-sm text-muted-foreground/60 mb-1">No ghost nodes yet</p>
            <p className="font-mono text-xs text-muted-foreground/40">
              Add a node below or create a GitHub repo to get started.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {nodes.map(node => (
              <NodeCard
                key={node.id}
                node={node}
                onPing={pingNode}
                onDelete={deleteNode}
              />
            ))}
          </AnimatePresence>
        )}

        <AddNodeForm onAdd={addNode} />
      </div>

      {/* ── Invite Contributors ──────────────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-violet-500/20 bg-card/20 overflow-hidden">
        <button
          onClick={() => setInviteExpanded(e => !e)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-violet-400" />
            <span className="font-mono text-sm font-bold text-foreground">Invite contributors — browser workers</span>
            {activeWorkers.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 font-mono text-[10px] text-violet-400">
                {activeWorkers.length} online
              </span>
            )}
          </div>
          {inviteExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>

        <AnimatePresence>
          {inviteExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 border-t border-border/30 space-y-5">
                  <p className="font-mono text-xs text-muted-foreground leading-relaxed mt-4">
                    Share an invite link with any device. When it opens, the browser joins the ghost network and processes AI tasks using its local synthesizer — no server required. That device becomes part of the same connected web.
                  </p>

                <div className="grid md:grid-cols-3 gap-3">
                  {[
                    { step: "1", title: "Create an invite link", desc: "Generate a shareable token below. Anyone with the link can join." },
                    { step: "2", title: "Contributor opens it", desc: "They enter a name. Their browser becomes a worker with local AI processing." },
                    { step: "3", title: "Tasks distribute automatically", desc: "Ghost Mode routes tasks to online browser workers alongside server nodes." },
                  ].map(({ step, title, desc }) => (
                    <div key={step} className="rounded-lg border border-violet-500/10 bg-violet-500/5 p-3">
                      <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mb-2">
                        <span className="font-mono text-xs text-violet-400 font-bold">{step}</span>
                      </div>
                      <p className="font-mono text-xs font-bold text-foreground mb-1">{title}</p>
                      <p className="font-mono text-xs text-muted-foreground leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>

                {/* Generate invite */}
                <div>
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Generate invite link</p>
                  <div className="flex gap-2">
                    <input
                      value={inviteLabel}
                      onChange={e => setInviteLabel(e.target.value)}
                      placeholder="Label (e.g. Team Alpha)"
                      className="flex-1 bg-card border border-border/60 rounded-lg px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-violet-500/50"
                    />
                    <button
                      onClick={generateInvite}
                      disabled={generatingInvite}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 font-mono text-xs font-bold transition-all disabled:opacity-50 shrink-0"
                    >
                      {generatingInvite ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ticket className="w-3.5 h-3.5" />}
                      Create invite
                    </button>
                  </div>
                </div>

                {/* Invite list */}
                {invites.filter(i => i.active).length > 0 && (
                  <div className="space-y-2">
                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Active invite links</p>
                    {invites.filter(i => i.active).map(inv => {
                      const workerUrl = `${window.location.origin}${import.meta.env.BASE_URL}worker?token=${inv.token}`;
                      return (
                        <div key={inv.id} className="flex items-center gap-3 rounded-lg border border-border/30 bg-card/30 px-4 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-mono text-xs font-bold text-foreground">{inv.label}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {inv.usesCount}/{inv.maxUses} uses
                              </span>
                            </div>
                            <p className="font-mono text-[10px] text-muted-foreground/50 truncate">{workerUrl}</p>
                          </div>
                          <button
                            onClick={() => copyWorkerUrl(inv.token)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/30 font-mono text-xs transition-all shrink-0"
                          >
                            {copiedToken === inv.token
                              ? <><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Copied</>
                              : <><Copy className="w-3 h-3" /> Copy link</>
                            }
                          </button>
                          <button
                            onClick={() => revokeInvite(inv.id)}
                            className="p-1.5 rounded-md border border-red-500/20 text-red-400/50 hover:text-red-400 hover:border-red-500/40 transition-all shrink-0"
                            title="Revoke invite"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Browser Workers Panel ─────────────────────────────────────── */}
      {browserWorkers.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              Browser workers ({browserWorkers.length})
              {activeWorkers.length > 0 && (
                <span className="ml-2 text-violet-400">{activeWorkers.length} online</span>
              )}
            </h2>
            <button onClick={fetchData} className="font-mono text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          <div className="space-y-2">
            {browserWorkers.map(worker => (
              <div
                key={worker.workerId}
                className={cn(
                  "rounded-xl border bg-card/30 px-4 py-3 flex items-center gap-4",
                  worker.online ? "border-violet-500/20" : "border-border/40"
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {worker.online
                    ? <Wifi className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    : <WifiOff className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  }
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-foreground">{worker.name}</span>
                      <span className={cn(
                        "font-mono text-[10px]",
                        worker.online ? "text-violet-400" : "text-muted-foreground/50"
                      )}>
                        {worker.online ? (worker.status === "busy" ? "processing" : "idle") : "disconnected"}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground/40">
                      last seen {timeSince(worker.lastSeen)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {[
                    { label: "done", value: worker.tasksProcessed, color: "#34d399" },
                    { label: "failed", value: worker.tasksFailed, color: "#f87171" },
                    { label: "avg", value: worker.avgResponseMs ? `${(worker.avgResponseMs / 1000).toFixed(1)}s` : "—", color: "#22d3ee" },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <div className="font-mono text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="font-mono text-[9px] text-muted-foreground uppercase">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GitHub repo creation */}
      <GitHubRepoSection />

      {/* Chat shortcut */}
      <div className="mt-6 flex items-center justify-between rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
        <div>
          <p className="font-mono text-sm font-bold text-foreground">Ready to use Ghost Mode?</p>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">
            {nodes.filter(n => n.status === "online").length > 0
              ? `${nodes.filter(n => n.status === "online").length} node${nodes.filter(n => n.status === "online").length > 1 ? "s" : ""} online — tasks will route automatically.`
              : "Add and bring a node online first, then switch to Ghost mode in Chat."}
          </p>
        </div>
        <Link
          href="/chat"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 font-mono text-sm transition-all shrink-0"
        >
          Open Chat <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
