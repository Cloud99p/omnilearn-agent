import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, BookOpen, Activity, Zap, Plus, Trash2, Search,
  RefreshCw, ChevronRight, Database, GitBranch, Loader2,
  CheckCircle, AlertCircle, FileText, X, BarChart3, Clock,
  Lightbulb, Shield, Code, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface KnowledgeNode {
  id: number;
  content: string;
  type: string;
  tags: string[];
  confidence: number;
  source: string;
  timesAccessed: number;
  similarity?: number;
  createdAt: string;
}

interface Stats {
  nodeCount: number;
  edgeCount: number;
  logCount: number;
  typeCounts: Array<{ type: string; count: number }>;
  recentLog: Array<{ id: number; event: string; details: string; nodesAdded: number; createdAt: string }>;
}

interface Character {
  id: number;
  curiosity: number;
  caution: number;
  confidence: number;
  verbosity: number;
  technical: number;
  empathy: number;
  creativity: number;
  totalInteractions: number;
  totalKnowledgeNodes: number;
}

type Tab = "overview" | "knowledge" | "train" | "character";

const TYPE_ICONS: Record<string, React.ElementType> = {
  fact: BookOpen,
  concept: Lightbulb,
  opinion: Activity,
  rule: Shield,
};

const TYPE_COLORS: Record<string, string> = {
  fact: "text-primary border-primary/20 bg-primary/5",
  concept: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
  opinion: "text-violet-400 border-violet-400/20 bg-violet-400/5",
  rule: "text-emerald-400 border-emerald-400/20 bg-emerald-400/5",
};

function TraitBar({ label, value, color = "bg-primary" }: { label: string; value: number; color?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-xs text-foreground">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 bg-secondary/40 rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function NodeCard({ node, onDelete }: { node: KnowledgeNode; onDelete?: (id: number) => void }) {
  const Icon = TYPE_ICONS[node.type] ?? BookOpen;
  const colorClass = TYPE_COLORS[node.type] ?? TYPE_COLORS.fact;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group p-3 rounded-lg border border-border/40 bg-card/40 hover:border-border/70 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className={cn("w-6 h-6 rounded-md border flex items-center justify-center shrink-0 mt-0.5", colorClass)}>
          <Icon className="w-3 h-3" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-relaxed">{node.content}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono border", colorClass)}>{node.type}</span>
            <span className="font-mono text-[10px] text-muted-foreground/60">
              conf: {(node.confidence * 100).toFixed(0)}%
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/40">
              src: {node.source}
            </span>
            {node.similarity !== undefined && (
              <span className="font-mono text-[10px] text-primary/60">
                match: {(node.similarity * 100).toFixed(0)}%
              </span>
            )}
            {node.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-1.5 py-0.5 rounded bg-secondary/30 text-[10px] font-mono text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(node.id)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 hover:text-red-400 text-muted-foreground/40 transition-all shrink-0"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function IntelligencePage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trainText, setTrainText] = useState("");
  const [trainSource, setTrainSource] = useState("manual");
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState<{ added: number; skipped: number; message: string } | null>(null);
  const [addContent, setAddContent] = useState("");
  const [addType, setAddType] = useState("fact");
  const [addConf, setAddConf] = useState(0.85);
  const [adding, setAdding] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/omni/knowledge/stats`);
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchCharacter = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/omni/character`);
      if (res.ok) setCharacter(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchNodes = useCallback(async (q?: string) => {
    setSearching(true);
    try {
      const url = q
        ? `${BASE}/api/omni/knowledge?search=${encodeURIComponent(q)}`
        : `${BASE}/api/omni/knowledge?limit=40`;
      const res = await fetch(url);
      if (res.ok) setNodes(await res.json());
    } catch { /* ignore */ } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchStats(), fetchCharacter(), fetchNodes()]).finally(() => setLoading(false));
  }, [fetchStats, fetchCharacter, fetchNodes]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (tab === "knowledge") fetchNodes(search || undefined);
    }, 350);
    return () => clearTimeout(t);
  }, [search, tab, fetchNodes]);

  const deleteNode = async (id: number) => {
    await fetch(`${BASE}/api/omni/knowledge/${id}`, { method: "DELETE" });
    setNodes(prev => prev.filter(n => n.id !== id));
    fetchStats();
  };

  const handleTrain = async () => {
    if (!trainText.trim() || training) return;
    setTraining(true);
    setTrainResult(null);
    try {
      const res = await fetch(`${BASE}/api/omni/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trainText, source: trainSource }),
      });
      if (res.ok) {
        const result = await res.json();
        setTrainResult(result);
        setTrainText("");
        fetchStats();
        fetchCharacter();
      }
    } finally {
      setTraining(false);
    }
  };

  const handleAddFact = async () => {
    if (!addContent.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch(`${BASE}/api/omni/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: addContent.trim(), type: addType, confidence: addConf }),
      });
      if (res.ok) {
        setAddContent("");
        fetchStats();
        if (tab === "knowledge") fetchNodes();
      }
    } finally {
      setAdding(false);
    }
  };

  const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "knowledge", label: "Knowledge", icon: Database },
    { id: "train", label: "Training", icon: Zap },
    { id: "character", label: "Character", icon: Activity },
  ];

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">OmniLearn Intelligence</h1>
            <p className="text-sm text-muted-foreground font-mono">Native learning engine — no external AI APIs</p>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              { label: "Knowledge Nodes", value: stats.nodeCount, icon: Database, color: "text-primary" },
              { label: "Connections", value: stats.edgeCount, icon: GitBranch, color: "text-yellow-400" },
              { label: "Learning Events", value: stats.logCount, icon: Clock, color: "text-emerald-400" },
              { label: "Interactions", value: character?.totalInteractions ?? 0, icon: Activity, color: "text-violet-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="p-4 rounded-xl border border-border/40 bg-card/40">
                <Icon className={cn("w-4 h-4 mb-2", color)} />
                <div className="text-2xl font-bold font-mono">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/40 pb-px">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); if (id === "knowledge") fetchNodes(search || undefined); }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 font-mono text-sm border-b-2 -mb-px transition-all",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && stats && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Type breakdown */}
            <div className="p-5 rounded-xl border border-border/40 bg-card/40 space-y-3">
              <h3 className="font-mono text-sm font-bold text-foreground">Knowledge by Type</h3>
              {stats.typeCounts.length === 0 ? (
                <p className="text-muted-foreground font-mono text-xs">No knowledge loaded yet.</p>
              ) : (
                stats.typeCounts.map(({ type, count }) => {
                  const Icon = TYPE_ICONS[type] ?? BookOpen;
                  const colorClass = TYPE_COLORS[type] ?? TYPE_COLORS.fact;
                  const pct = Math.round((Number(count) / stats.nodeCount) * 100);
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <div className={cn("w-5 h-5 rounded border flex items-center justify-center shrink-0", colorClass)}>
                        <Icon className="w-2.5 h-2.5" />
                      </div>
                      <span className="font-mono text-xs text-muted-foreground w-20 capitalize">{type}</span>
                      <div className="flex-1 h-1.5 bg-secondary/40 rounded-full overflow-hidden">
                        <div className="h-full bg-primary/40 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-mono text-xs text-foreground w-8 text-right">{Number(count)}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Recent learning events */}
            <div className="p-5 rounded-xl border border-border/40 bg-card/40 space-y-3">
              <h3 className="font-mono text-sm font-bold text-foreground">Recent Learning Events</h3>
              {stats.recentLog.length === 0 ? (
                <p className="text-muted-foreground font-mono text-xs">No learning events yet. Start a conversation in Native mode.</p>
              ) : (
                <div className="space-y-2">
                  {stats.recentLog.slice(0, 8).map(log => (
                    <div key={log.id} className="flex items-start gap-2">
                      <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-foreground truncate">{log.details}</p>
                        <p className="font-mono text-[10px] text-muted-foreground/50">
                          +{log.nodesAdded} node{log.nodesAdded !== 1 ? "s" : ""} · {log.event}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* How it works */}
          <div className="p-5 rounded-xl border border-border/40 bg-card/40">
            <h3 className="font-mono text-sm font-bold text-foreground mb-4">How the Native Intelligence Works</h3>
            <div className="grid md:grid-cols-3 gap-4 text-xs font-mono text-muted-foreground">
              {[
                {
                  icon: Database,
                  title: "Knowledge Graph",
                  body: "Every fact, concept, rule, and opinion is stored as a node in a persistent graph. Nodes are connected by typed edges (causes, enables, is-a).",
                },
                {
                  icon: Search,
                  title: "TF-IDF Retrieval",
                  body: "Queries are matched against all knowledge nodes using Term Frequency-Inverse Document Frequency cosine similarity — no embeddings API needed.",
                },
                {
                  icon: Activity,
                  title: "Character Evolution",
                  body: "Traits like curiosity, caution, and technical depth shift gradually with every learning event, shaping how the model expresses its knowledge.",
                },
                {
                  icon: Brain,
                  title: "Fact Extraction",
                  body: "The engine extracts structured facts from conversations automatically — \"X is Y\", \"X causes Y\" — and adds them to the knowledge base in real time.",
                },
                {
                  icon: Zap,
                  title: "Response Synthesis",
                  body: "Retrieved knowledge chunks are assembled into natural language responses using confidence-calibrated templates and character-voice modifiers.",
                },
                {
                  icon: Shield,
                  title: "No External APIs",
                  body: "Zero dependency on Claude, GPT, or any other AI API. The model runs entirely on your own server using pure TypeScript algorithms.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                    <span className="text-foreground font-bold">{title}</span>
                  </div>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Knowledge browser ── */}
      {tab === "knowledge" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search knowledge semantically…"
                className="w-full bg-background border border-border/50 rounded-lg pl-9 pr-4 py-2.5 text-sm font-mono focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-primary/50" />}
            </div>
            <button
              onClick={() => fetchNodes(search || undefined)}
              className="px-3 py-2 rounded-lg border border-border/40 hover:border-primary/30 text-muted-foreground hover:text-primary transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Add single fact */}
          <div className="p-4 rounded-xl border border-border/40 bg-card/30 space-y-3">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Add Knowledge</p>
            <div className="flex gap-2">
              <input
                value={addContent}
                onChange={e => setAddContent(e.target.value)}
                placeholder="Enter a fact, concept, rule, or opinion…"
                className="flex-1 bg-background border border-border/50 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
                onKeyDown={e => { if (e.key === "Enter") handleAddFact(); }}
              />
              <select
                value={addType}
                onChange={e => setAddType(e.target.value)}
                className="bg-background border border-border/50 rounded-lg px-2 py-2 text-xs font-mono focus:outline-none focus:border-primary/50 text-muted-foreground"
              >
                {["fact", "concept", "opinion", "rule"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                onClick={handleAddFact}
                disabled={adding || !addContent.trim()}
                className="px-4 py-2 bg-primary text-background rounded-lg font-mono text-xs hover:bg-primary/80 disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Add
              </button>
            </div>
          </div>

          {/* Node list */}
          <div className="space-y-2">
            {nodes.length === 0 && !searching && (
              <p className="text-center py-12 text-muted-foreground font-mono text-sm">
                {search ? "No matching knowledge found." : "Knowledge base is loading…"}
              </p>
            )}
            {nodes.map(node => (
              <NodeCard key={node.id} node={node} onDelete={deleteNode} />
            ))}
          </div>
        </div>
      )}

      {/* ── Training ── */}
      {tab === "train" && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-border/40 bg-card/40 space-y-4">
            <div>
              <h3 className="font-mono text-sm font-bold text-foreground mb-1">Bulk Training</h3>
              <p className="font-mono text-xs text-muted-foreground">
                Paste any text — articles, documentation, notes, definitions. The engine will extract structured knowledge and add it permanently to the model.
              </p>
            </div>

            <div className="flex gap-2">
              <span className="font-mono text-xs text-muted-foreground pt-2">Source:</span>
              {["manual", "document", "web", "research"].map(src => (
                <button
                  key={src}
                  onClick={() => setTrainSource(src)}
                  className={cn(
                    "px-2.5 py-1 rounded-md font-mono text-xs border transition-all",
                    trainSource === src
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "border-border/40 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {src}
                </button>
              ))}
            </div>

            <textarea
              value={trainText}
              onChange={e => setTrainText(e.target.value)}
              placeholder="Paste text to teach OmniLearn. For example:&#10;&#10;Machine learning is a subset of artificial intelligence. Neural networks are computational models inspired by the brain. Gradient descent is an optimisation algorithm used to train neural networks by minimising loss functions..."
              rows={10}
              className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/30 resize-none"
            />

            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">
                {trainText.length} characters · ~{Math.max(0, Math.round(trainText.split(/\s+/).filter(Boolean).length))} words
              </span>
              <button
                onClick={handleTrain}
                disabled={training || trainText.trim().length < 10}
                className="px-6 py-2.5 bg-primary text-background rounded-xl font-mono text-sm font-bold hover:bg-primary/80 disabled:opacity-40 transition-all flex items-center gap-2"
              >
                {training ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {training ? "Integrating…" : "Train Model"}
              </button>
            </div>

            <AnimatePresence>
              {trainResult && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-xl border",
                    trainResult.added > 0
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : "border-border/40 bg-card/40"
                  )}
                >
                  {trainResult.added > 0
                    ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    : <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                  <p className="font-mono text-sm text-foreground">{trainResult.message}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tips */}
          <div className="p-5 rounded-xl border border-border/40 bg-card/30">
            <h3 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Training Tips</h3>
            <ul className="space-y-2 font-mono text-xs text-muted-foreground">
              {[
                "The model learns best from declarative sentences: \"X is Y\", \"X causes Y\", \"X enables Y\".",
                "Structured text (documentation, definitions, explanations) yields more knowledge nodes than raw prose.",
                "Repeat training on the same topic with different phrasings builds confidence in that knowledge area.",
                "The model also learns from conversations in Native mode — every statement you make is analysed.",
                "High-confidence knowledge (>0.9) takes precedence over low-confidence nodes when answering questions.",
              ].map((tip, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary shrink-0">{i + 1}.</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Character ── */}
      {tab === "character" && character && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Traits */}
            <div className="p-5 rounded-xl border border-border/40 bg-card/40 space-y-4">
              <div>
                <h3 className="font-mono text-sm font-bold text-foreground">Personality Traits</h3>
                <p className="font-mono text-xs text-muted-foreground mt-0.5">
                  Evolved through {character.totalInteractions} interactions
                </p>
              </div>
              <div className="space-y-3">
                <TraitBar label="Curiosity" value={character.curiosity} color="bg-primary" />
                <TraitBar label="Confidence" value={character.confidence} color="bg-emerald-500" />
                <TraitBar label="Technical Depth" value={character.technical} color="bg-blue-500" />
                <TraitBar label="Caution" value={character.caution} color="bg-yellow-500" />
                <TraitBar label="Empathy" value={character.empathy} color="bg-pink-500" />
                <TraitBar label="Verbosity" value={character.verbosity} color="bg-violet-500" />
                <TraitBar label="Creativity" value={character.creativity} color="bg-orange-500" />
              </div>
            </div>

            {/* Trait descriptions */}
            <div className="p-5 rounded-xl border border-border/40 bg-card/40 space-y-4">
              <h3 className="font-mono text-sm font-bold text-foreground">What Traits Mean</h3>
              <div className="space-y-3 font-mono text-xs text-muted-foreground">
                {[
                  { name: "Curiosity", effect: "Higher → more eager to explore new topics, more follow-up questions." },
                  { name: "Confidence", effect: "Higher → more assertive statements; lower → more hedging and uncertainty." },
                  { name: "Technical Depth", effect: "Higher → prefers precise terminology, longer technical explanations." },
                  { name: "Caution", effect: "Higher → more disclaimers, more honest about gaps in knowledge." },
                  { name: "Empathy", effect: "Higher → warmer tone, acknowledges context and the person asking." },
                  { name: "Verbosity", effect: "Higher → longer, more detailed responses with more context." },
                  { name: "Creativity", effect: "Higher → more varied sentence structures and analogies in responses." },
                ].map(({ name, effect }) => (
                  <div key={name} className="flex gap-2">
                    <span className="text-foreground font-bold w-28 shrink-0">{name}</span>
                    <span>{effect}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* How traits evolve */}
          <div className="p-5 rounded-xl border border-border/40 bg-card/30">
            <h3 className="font-mono text-sm font-bold text-foreground mb-3">How Character Evolves</h3>
            <div className="grid md:grid-cols-3 gap-4 font-mono text-xs text-muted-foreground">
              {[
                { trigger: "Learning new facts", effect: "+Curiosity, +Confidence" },
                { trigger: "Conflicting information", effect: "+Caution, −Confidence" },
                { trigger: "Technical content", effect: "+Technical Depth" },
                { trigger: "Emotional content", effect: "+Empathy, +Creativity" },
                { trigger: "High knowledge volume", effect: "+Verbosity over time" },
                { trigger: "Repeated confirmations", effect: "+Confidence on confirmed topics" },
              ].map(({ trigger, effect }) => (
                <div key={trigger} className="p-3 rounded-lg border border-border/30 bg-background/40">
                  <p className="text-foreground font-bold">{trigger}</p>
                  <p className="text-primary mt-1">{effect}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={fetchCharacter}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/40 hover:border-primary/30 text-muted-foreground hover:text-primary font-mono text-xs transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh character state
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
