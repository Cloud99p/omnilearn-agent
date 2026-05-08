import { useState, useEffect, useCallback } from "react";
import { Show } from "@clerk/react";
import { Redirect, Link } from "wouter";
import {
  Github, Star, GitFork, Lock, Globe, Plus, Search,
  RefreshCw, ExternalLink, Copy, Check, X, BookOpen,
  Code2, Zap, Share2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Repo {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  private: boolean;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  updatedAt: string | null;
  topics: string[];
}

interface GitHubStatus {
  connected: boolean;
  username?: string;
  avatarUrl?: string;
  publicRepos?: number;
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "bg-blue-400",
  JavaScript: "bg-yellow-400",
  Python: "bg-green-400",
  Rust: "bg-orange-400",
  Go: "bg-cyan-400",
  Java: "bg-red-400",
  "C++": "bg-pink-400",
  Ruby: "bg-red-500",
  Shell: "bg-gray-400",
};

function ConnectGitHubPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-foreground/5 border border-border/40 flex items-center justify-center">
        <Github className="w-8 h-8 text-muted-foreground" />
      </div>
      <div>
        <h2 className="font-mono text-lg font-semibold text-foreground mb-2">Connect GitHub</h2>
        <p className="font-mono text-sm text-muted-foreground max-w-sm">
          Sign in with GitHub to browse, create, fork, and share repositories directly from OmniLearn.
        </p>
      </div>
      <a
        href="https://dashboard.clerk.com/" 
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 font-mono text-sm bg-primary text-background px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors font-semibold"
      >
        <Github className="w-4 h-4" />
        Connect via Clerk Dashboard
      </a>
      <p className="font-mono text-xs text-muted-foreground">
        Open Clerk dashboard in new tab → Sign in → Connected Accounts → Add GitHub
      </p>
    </div>
  );
}

function RepoCard({ repo, onFork, onShare, onCopy }: {
  repo: Repo;
  onFork: (owner: string, name: string) => void;
  onShare: (repo: Repo) => void;
  onCopy: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(repo.cloneUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const langColor = repo.language ? (LANG_COLORS[repo.language] ?? "bg-muted-foreground") : null;

  return (
    <div className="p-4 rounded-xl bg-card border border-border/40 hover:border-primary/20 transition-colors group">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {repo.private ? (
            <Lock className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          ) : (
            <Globe className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
          )}
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm font-semibold text-foreground hover:text-primary transition-colors truncate"
          >
            {repo.name}
          </a>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <Star className="w-3 h-3" />
            {repo.stargazersCount}
          </span>
          <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground ml-2">
            <GitFork className="w-3 h-3" />
            {repo.forksCount}
          </span>
        </div>
      </div>

      {repo.description && (
        <p className="font-mono text-xs text-muted-foreground mb-3 line-clamp-2">{repo.description}</p>
      )}

      {repo.topics.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {repo.topics.slice(0, 4).map((t) => (
            <span key={t} className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary/80 border border-primary/20">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {langColor && (
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <span className={cn("w-2 h-2 rounded-full", langColor)} />
              {repo.language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleCopy}
            title="Copy clone URL"
            className="p-1.5 rounded-md hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onFork(repo.owner, repo.name)}
            title="Fork"
            className="p-1.5 rounded-md hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <GitFork className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onShare(repo)}
            title="Share via Gist"
            className="p-1.5 rounded-md hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open on GitHub"
            className="p-1.5 rounded-md hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function CreateRepoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) { setError("Repository name is required"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${basePath}/api/github/repos`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description, isPrivate, autoInit: true }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to create repository");
        return;
      }
      const repo = await res.json();
      window.open(repo.htmlUrl, "_blank");
      onCreated();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border/60 rounded-2xl w-full max-w-md p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono font-semibold text-foreground">
            <Plus className="w-4 h-4 text-primary" />
            New Repository
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-mono text-xs text-muted-foreground mb-1.5">Repository name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-agent-config"
              className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 font-mono text-sm text-foreground focus:border-primary/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-muted-foreground mb-1.5">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 font-mono text-sm text-foreground focus:border-primary/50 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setIsPrivate(p => !p)}
              className={cn(
                "w-9 h-5 rounded-full transition-colors relative",
                isPrivate ? "bg-primary" : "bg-border"
              )}
            >
              <div className={cn(
                "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform",
                isPrivate ? "translate-x-4" : "translate-x-0.5"
              )} />
            </div>
            <span className="font-mono text-sm text-muted-foreground">
              {isPrivate ? "Private" : "Public"} repository
            </span>
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 font-mono text-xs p-3 bg-red-400/5 border border-red-400/20 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 font-mono text-sm text-muted-foreground border border-border/40 rounded-lg py-2 hover:bg-secondary/20 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 font-mono text-sm bg-primary text-background rounded-lg py-2 hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function RepositoriesContent() {
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "public" | "private">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [forking, setForking] = useState<string | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadRepos = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, reposRes] = await Promise.all([
        fetch(`${basePath}/api/github/status`, { credentials: "include" }),
        fetch(`${basePath}/api/github/repos`, { credentials: "include" }),
      ]);
      const statusData = await statusRes.json();
      setStatus(statusData);
      if (reposRes.ok) {
        const reposData = await reposRes.json();
        setRepos(reposData);
      }
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRepos(); }, [loadRepos]);

  const handleFork = async (owner: string, repo: string) => {
    setForking(`${owner}/${repo}`);
    try {
      const res = await fetch(`${basePath}/api/github/repos/${owner}/${repo}/fork`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const d = await res.json();
        showToast(`Forked to ${d.fullName}`);
        loadRepos();
      } else {
        showToast("Failed to fork repository", "error");
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setForking(null);
    }
  };

  const handleShare = async (repo: Repo) => {
    const content = JSON.stringify({
      source: repo.htmlUrl,
      cloneUrl: repo.cloneUrl,
      branch: repo.defaultBranch,
      sharedVia: "OmniLearn",
      timestamp: new Date().toISOString(),
    }, null, 2);

    try {
      const res = await fetch(`${basePath}/api/github/share`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: `OmniLearn share: ${repo.fullName}`,
          content,
          filename: "omnilearn-share.json",
          isPublic: true,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        window.open(d.htmlUrl, "_blank");
        showToast("Shared as GitHub Gist");
      } else {
        showToast("Failed to share", "error");
      }
    } catch {
      showToast("Network error", "error");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => showToast("Clone URL copied"));
  };

  const filtered = repos.filter((r) => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.description?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "private" ? r.private : !r.private);
    return matchSearch && matchFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  if (!status?.connected) {
    return <ConnectGitHubPrompt />;
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 font-mono text-sm px-4 py-3 rounded-xl border shadow-lg",
          toast.type === "success"
            ? "bg-card border-primary/30 text-foreground"
            : "bg-card border-red-400/30 text-red-400"
        )}>
          {toast.type === "success" ? <Check className="w-4 h-4 text-primary" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Github className="w-5 h-5 text-primary" />
            <h1 className="font-mono text-xl font-bold text-foreground">Repositories</h1>
          </div>
          <p className="font-mono text-sm text-muted-foreground ml-8">
            @{status.username} · {status.publicRepos} public repos
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 font-mono text-sm bg-primary text-background px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-semibold shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Repo
        </button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: BookOpen, label: "Browse", desc: "Your repositories" },
          { icon: Code2, label: "Create", desc: "New repository", onClick: () => setShowCreate(true) },
          { icon: Zap, label: "Skills", desc: "Share via Gist" },
        ].map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="p-3 rounded-xl bg-card border border-border/40 hover:border-primary/20 text-left transition-colors group"
          >
            <a.icon className="w-4 h-4 text-primary mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-mono text-xs font-semibold text-foreground">{a.label}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{a.desc}</div>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter repositories..."
            className="w-full bg-card border border-border/40 rounded-lg pl-9 pr-3 py-2 font-mono text-sm text-foreground focus:border-primary/50 focus:outline-none"
          />
        </div>
        <div className="flex gap-1 p-1 bg-card border border-border/40 rounded-lg">
          {(["all", "public", "private"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "font-mono text-xs px-3 py-1 rounded-md transition-colors capitalize",
                filter === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Repos */}
      <div className="text-xs font-mono text-muted-foreground">
        {filtered.length} of {repos.length} repositories
      </div>
      <div className="space-y-3">
        {filtered.map((repo) => (
          <div key={repo.id} className={cn(forking === `${repo.owner}/${repo.name}` && "opacity-60 pointer-events-none")}>
            <RepoCard
              repo={repo}
              onFork={handleFork}
              onShare={handleShare}
              onCopy={handleCopy}
            />
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 font-mono text-sm text-muted-foreground">
            No repositories match your filter.
          </div>
        )}
      </div>

      {showCreate && (
        <CreateRepoModal
          onClose={() => setShowCreate(false)}
          onCreated={loadRepos}
        />
      )}
    </div>
  );
}

export default function RepositoriesPage() {
  return (
    <>
      <Show when="signed-in">
        <RepositoriesContent />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}
