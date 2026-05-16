import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  BookOpen,
  Activity,
  Zap,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  Database,
  GitBranch,
  Loader2,
  CheckCircle,
  AlertCircle,
  Shield,
  ExternalLink,
  Lightbulb,
  BarChart3,
  Clock,
  Network,
  Users,
  Wifi,
  TrendingUp,
  Cpu,
  Radio,
  Lock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  FlaskConical,
  Layers,
  SplitSquareHorizontal,
  Merge,
  ArrowDown,
  BookMarked,
  Play,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE =
  import.meta.env.VITE_API_URL || import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

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
  recentLog: Array<{
    id: number;
    event: string;
    details: string;
    nodesAdded: number;
    createdAt: string;
  }>;
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
interface NetworkNeuron {
  id: number;
  content: string;
  type: string;
  tags: string[];
  weight: number;
  reinforcementCount: number;
  accessCount: number;
  isCore: boolean;
  sourceAgent: string;
  createdAt: string;
}
interface NetworkSynapse {
  id: number;
  sourceId: number;
  targetId: number;
  weight: number;
  activationCount: number;
}
interface NetworkAgent {
  id: number;
  name: string;
  endpoint: string | null;
  trustScore: number;
  totalContributions: number;
  totalReinforcements: number;
  isSelf: boolean;
  lastActiveAt: string;
}
interface NetworkPulse {
  id: number;
  agentName: string;
  eventType: string;
  neuronsAffected: number;
  synapsesAffected: number;
  details: string | null;
  createdAt: string;
}
interface NetworkStats {
  neurons: number;
  synapses: number;
  coreNeurons: number;
  agents: number;
  totalWeight: number;
  avgWeight: number;
  maxWeight: number;
  health: number;
}
interface HebbianProposal {
  id: number;
  proposerId: string;
  nodeAId: number;
  nodeBId: number;
  edgeType: string;
  evidenceText: string;
  evidenceHash: string;
  proposalProof: string;
  deltaWeight: number;
  status: string;
  validationCount: number;
  rejectionCount: number;
  createdAt: string;
  appliedAt: string | null;
  nodeA: { id: number; content: string } | null;
  nodeB: { id: number; content: string } | null;
}
interface ValidationResult {
  valid: boolean;
  steps: {
    evidenceHashMatch: boolean;
    proofMatch: boolean;
    semanticOverlap: boolean;
    freshnessOk: boolean;
  };
  reason?: string;
  proposal?: HebbianProposal;
}

interface OntologyNode {
  id: number;
  name: string;
  description: string;
  nodeType: string;
  payload: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
interface OntologyProposal {
  id: number;
  opType: string;
  targetNodeId: number | null;
  targetNodeBId: number | null;
  proposedEdgeType: string | null;
  proposedContent: string | null;
  rationale: string;
  rationaleHash: string;
  proposalProof: string;
  status: string;
  executedAt: string | null;
  createdAt: string;
  nodeA: { id: number; content: string; type: string } | null;
  nodeB: { id: number; content: string; type: string } | null;
}
interface ReflectionResult {
  proposed: number;
  checks: string[];
}

type Tab =
  | "overview"
  | "network"
  | "knowledge"
  | "train"
  | "character"
  | "proposals"
  | "ontology";

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ElementType> = {
  fact: BookOpen,
  concept: Lightbulb,
  opinion: Activity,
  rule: Shield,
};

const ONTOLOGY_OP_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    description: string;
  }
> = {
  "new-edge-type": {
    label: "New Edge Type",
    icon: ArrowRight,
    color: "text-primary",
    description:
      "Register an ad-hoc edge relationship as a first-class vocabulary entry",
  },
  "split-node": {
    label: "Split Node",
    icon: SplitSquareHorizontal,
    color: "text-yellow-400",
    description: "Break an over-broad concept into two more specific nodes",
  },
  "merge-nodes": {
    label: "Merge Nodes",
    icon: Merge,
    color: "text-violet-400",
    description: "Collapse near-duplicate nodes into a single canonical node",
  },
  "demote-rule": {
    label: "Demote Rule→Fact",
    icon: ArrowDown,
    color: "text-orange-400",
    description: "Lower a rule node to a fact when confidence has eroded",
  },
};

const ONTOLOGY_STATUS_STYLE: Record<string, string> = {
  pending: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
  approved: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
  executed: "text-primary border-primary/20 bg-primary/5",
  rejected: "text-red-400 border-red-500/20 bg-red-500/5",
};

const VOCAB_TYPE_STYLE: Record<string, string> = {
  "edge-vocab": "text-primary border-primary/20 bg-primary/5",
  "structural-rule": "text-emerald-400 border-emerald-400/20 bg-emerald-400/5",
  constraint: "text-orange-400 border-orange-400/20 bg-orange-400/5",
};
const TYPE_COLORS: Record<string, string> = {
  fact: "text-primary border-primary/20 bg-primary/5",
  concept: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
  opinion: "text-violet-400 border-violet-400/20 bg-violet-400/5",
  rule: "text-emerald-400 border-emerald-400/20 bg-emerald-400/5",
};
const NEURON_COLORS: Record<string, string> = {
  fact: "#22d3ee",
  concept: "#facc15",
  opinion: "#a78bfa",
  rule: "#34d399",
  insight: "#f97316",
};
const PULSE_COLORS: Record<string, string> = {
  contribute: "text-primary",
  reinforce: "text-yellow-400",
  decay: "text-muted-foreground",
  query: "text-violet-400",
  sync: "text-emerald-400",
  emerge: "text-orange-400",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ─── Neural Graph ─────────────────────────────────────────────────────────────

interface NodePos {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function NeuralGraph({
  neurons,
  synapses,
}: {
  neurons: NetworkNeuron[];
  synapses: NetworkSynapse[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<Record<number, NodePos>>({});
  const animRef = useRef<number>(0);
  const posRef = useRef<Record<number, NodePos>>({});
  const W = 560;
  const H = 260;

  // Initialise positions when neurons change
  useEffect(() => {
    const top = neurons.slice(0, 30);
    const next: Record<number, NodePos> = {};
    top.forEach((n, i) => {
      if (posRef.current[n.id]) {
        next[n.id] = posRef.current[n.id];
      } else {
        const angle = (i / top.length) * 2 * Math.PI;
        const r = 60 + Math.random() * 60;
        next[n.id] = {
          x: W / 2 + r * Math.cos(angle),
          y: H / 2 + r * Math.sin(angle),
          vx: 0,
          vy: 0,
        };
      }
    });
    posRef.current = next;
    setPositions({ ...next });
  }, [neurons.map((n) => n.id).join(",")]);

  // Force-directed physics
  useEffect(() => {
    const top = neurons.slice(0, 30);
    let iter = 0;
    const MAX = 300;

    function tick() {
      if (iter++ > MAX) return;
      const pos = posRef.current;
      const ids = top.map((n) => n.id);
      const forces: Record<number, { dx: number; dy: number }> = {};
      ids.forEach((id) => {
        forces[id] = { dx: 0, dy: 0 };
      });

      // Repulsion
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = pos[ids[i]];
          const b = pos[ids[j]];
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const f = 1800 / (dist * dist);
          forces[ids[i]].dx -= (f * dx) / dist;
          forces[ids[i]].dy -= (f * dy) / dist;
          forces[ids[j]].dx += (f * dx) / dist;
          forces[ids[j]].dy += (f * dy) / dist;
        }
      }

      // Attraction along synapses
      synapses.forEach((s) => {
        if (!pos[s.sourceId] || !pos[s.targetId]) return;
        const a = pos[s.sourceId];
        const b = pos[s.targetId];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const f = dist * 0.04 * s.weight;
        if (forces[s.sourceId]) {
          forces[s.sourceId].dx += (f * dx) / dist;
          forces[s.sourceId].dy += (f * dy) / dist;
        }
        if (forces[s.targetId]) {
          forces[s.targetId].dx -= (f * dx) / dist;
          forces[s.targetId].dy -= (f * dy) / dist;
        }
      });

      // Center gravity
      ids.forEach((id) => {
        const p = pos[id];
        if (!p) return;
        forces[id].dx += (W / 2 - p.x) * 0.015;
        forces[id].dy += (H / 2 - p.y) * 0.015;
      });

      // Apply
      const next: Record<number, NodePos> = {};
      ids.forEach((id) => {
        const p = pos[id];
        if (!p) return;
        const f = forces[id];
        const vx = (p.vx + f.dx) * 0.85;
        const vy = (p.vy + f.dy) * 0.85;
        next[id] = {
          x: Math.max(18, Math.min(W - 18, p.x + vx)),
          y: Math.max(18, Math.min(H - 18, p.y + vy)),
          vx,
          vy,
        };
      });
      posRef.current = next;
      setPositions({ ...next });
      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [neurons.length, synapses.length]);

  const top = neurons.slice(0, 30);
  const idSet = new Set(top.map((n) => n.id));
  const visibleSynapses = synapses.filter(
    (s) => idSet.has(s.sourceId) && idSet.has(s.targetId),
  );
  const maxWeight = Math.max(1, ...top.map((n) => n.weight));

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      style={{ overflow: "visible" }}
    >
      <defs>
        <radialGradient id="glow-fact" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Synapses */}
      {visibleSynapses.map((s) => {
        const a = positions[s.sourceId];
        const b = positions[s.targetId];
        if (!a || !b) return null;
        return (
          <line
            key={s.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#22d3ee"
            strokeOpacity={Math.min(0.5, s.weight * 0.15)}
            strokeWidth={Math.max(0.5, s.weight * 0.5)}
          />
        );
      })}

      {/* Neurons */}
      {top.map((n) => {
        const p = positions[n.id];
        if (!p) return null;
        const r = Math.max(4, Math.min(18, 4 + (n.weight / maxWeight) * 14));
        const color = NEURON_COLORS[n.type] ?? "#22d3ee";
        const label =
          n.content.length > 22 ? n.content.slice(0, 20) + "…" : n.content;
        return (
          <g key={n.id}>
            {n.isCore && (
              <circle cx={p.x} cy={p.y} r={r + 8} fill="url(#glow-core)" />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={r}
              fill={color + "22"}
              stroke={color}
              strokeWidth={n.isCore ? 2 : 1}
              strokeOpacity={0.8}
            />
            {r > 8 && (
              <text
                x={p.x}
                y={p.y + r + 9}
                textAnchor="middle"
                fill={color}
                fontSize="7"
                opacity={0.7}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TraitBar({
  label,
  value,
  color = "bg-primary",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-xs text-foreground">
          {Math.round(value)}
        </span>
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

function NodeCard({
  node,
  onDelete,
}: {
  node: KnowledgeNode;
  onDelete?: (id: number) => void;
}) {
  const Icon = TYPE_ICONS[node.type] ?? BookOpen;
  const colorClass = TYPE_COLORS[node.type] ?? TYPE_COLORS.fact;

  // Parse source and make it interactive
  const renderSource = () => {
    const source = node.source || "unknown";

    // URL source - make clickable
    if (source.startsWith("url:")) {
      const url = source.replace("url:", "");
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] text-primary/80 hover:text-primary hover:underline flex items-center gap-1"
        >
          <ExternalLink className="w-2.5 h-2.5" />
          {url.length > 40 ? url.slice(0, 40) + "..." : url}
        </a>
      );
    }

    // Document source - show document icon
    if (source.startsWith("document:")) {
      const docName = source.replace("document:", "");
      return (
        <span className="font-mono text-[10px] text-emerald-400/80 flex items-center gap-1">
          <FileText className="w-2.5 h-2.5" />
          {docName}
        </span>
      );
    }

    // Manual or other source
    return (
      <span className="font-mono text-[10px] text-muted-foreground/60">
        {source}
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group p-3 rounded-lg border border-border/40 bg-card/40 hover:border-border/70 transition-all"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-6 h-6 rounded-md border flex items-center justify-center shrink-0 mt-0.5",
            colorClass,
          )}
        >
          <Icon className="w-3 h-3" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-relaxed">
            {node.content}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-mono border",
                colorClass,
              )}
            >
              {node.type}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/60">
              conf: {(node.confidence * 100).toFixed(0)}%
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/40">
              src:
            </span>
            {renderSource()}
            {node.similarity !== undefined && (
              <span className="font-mono text-[10px] text-primary/60">
                match: {(node.similarity * 100).toFixed(0)}%
              </span>
            )}
            {node.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded bg-secondary/30 text-[10px] font-mono text-muted-foreground"
              >
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const [tab, setTab] = useState<Tab>("overview");

  // Local intelligence state
  const [stats, setStats] = useState<Stats | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trainText, setTrainText] = useState("");
  const [trainUrl, setTrainUrl] = useState("");
  const [trainUrls, setTrainUrls] = useState(""); // For research mode (multiple URLs)
  const [trainSource, setTrainSource] = useState("manual");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState<{
    added: number;
    skipped: number;
    message: string;
  } | null>(null);
  const [addContent, setAddContent] = useState("");
  const [addType, setAddType] = useState("fact");
  const [adding, setAdding] = useState(false);

  // Ontology state
  const [ontologyVocab, setOntologyVocab] = useState<OntologyNode[]>([]);
  const [ontologyProposals, setOntologyProposals] = useState<
    OntologyProposal[]
  >([]);
  const [ontologyFilter, setOntologyFilter] = useState("all");
  const [ontologyLoading, setOntologyLoading] = useState(false);
  const [reflecting, setReflecting] = useState(false);
  const [lastReflection, setLastReflection] = useState<ReflectionResult | null>(
    null,
  );
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [executingId, setExecutingId] = useState<number | null>(null);
  const [executionResults, setExecutionResults] = useState<
    Record<number, string>
  >({});

  // Proposals state
  const [proposals, setProposals] = useState<HebbianProposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [proposalFilter, setProposalFilter] = useState<string>("all");
  const [validatingId, setValidatingId] = useState<number | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [validationResults, setValidationResults] = useState<
    Record<number, ValidationResult>
  >({});

  // Network state
  const [netStats, setNetStats] = useState<NetworkStats | null>(null);
  const [netNeurons, setNetNeurons] = useState<NetworkNeuron[]>([]);
  const [netSynapses, setNetSynapses] = useState<NetworkSynapse[]>([]);
  const [netAgents, setNetAgents] = useState<NetworkAgent[]>([]);
  const [netPulses, setNetPulses] = useState<NetworkPulse[]>([]);
  const [netLoading, setNetLoading] = useState(false);
  const [contributeText, setContributeText] = useState("");
  const [contributeType, setContributeType] = useState("fact");
  const [contributing, setContributing] = useState(false);
  const [netQuery, setNetQuery] = useState("");
  const [netQueryResults, setNetQueryResults] = useState<
    Array<{
      id: number;
      content: string;
      type: string;
      weight: number;
      similarity: number;
    }>
  >([]);
  const [querying, setQuerying] = useState(false);
  const [decaying, setDecaying] = useState(false);

  // ── Fetchers ─────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/omni/knowledge/stats`);
      if (res.ok) setStats(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  const fetchCharacter = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/omni/character`);
      if (res.ok) setCharacter(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  const fetchNodes = useCallback(async (q?: string) => {
    setSearching(true);
    try {
      const url = q
        ? `${BASE}/api/omni/knowledge?search=${encodeURIComponent(q)}`
        : `${BASE}/api/omni/knowledge?limit=40`;
      const res = await fetch(url);
      if (res.ok) setNodes(await res.json());
    } catch {
      /* ignore */
    } finally {
      setSearching(false);
    }
  }, []);

  const fetchOntology = useCallback(async (filter?: string) => {
    setOntologyLoading(true);
    try {
      const f = filter && filter !== "all" ? `?status=${filter}` : "";
      const [vocabRes, propsRes] = await Promise.all([
        fetch(`${BASE}/api/brain/ontology/nodes`),
        fetch(`${BASE}/api/brain/ontology/proposals${f}`),
      ]);
      if (vocabRes.ok) setOntologyVocab(await vocabRes.json());
      if (propsRes.ok) setOntologyProposals(await propsRes.json());
    } catch {
      /* ignore */
    } finally {
      setOntologyLoading(false);
    }
  }, []);

  const handleReflect = async () => {
    setReflecting(true);
    try {
      const res = await fetch(`${BASE}/api/brain/ontology/reflect`, {
        method: "POST",
      });
      if (res.ok) {
        const result = await res.json();
        setLastReflection(result);
        await fetchOntology(ontologyFilter);
      }
    } finally {
      setReflecting(false);
    }
  };

  const handleApproveOntology = async (id: number) => {
    setApprovingId(id);
    try {
      const res = await fetch(
        `${BASE}/api/brain/ontology/proposals/${id}/approve`,
        { method: "POST" },
      );
      if (res.ok) await fetchOntology(ontologyFilter);
      else {
        const body = await res.json();
        setExecutionResults((prev) => ({
          ...prev,
          [id]: `Approval failed: ${body.error}`,
        }));
      }
    } finally {
      setApprovingId(null);
    }
  };

  const handleExecuteOntology = async (id: number) => {
    setExecutingId(id);
    try {
      const res = await fetch(
        `${BASE}/api/brain/ontology/proposals/${id}/execute`,
        { method: "POST" },
      );
      const body = await res.json();
      if (res.ok) {
        setExecutionResults((prev) => ({ ...prev, [id]: body.summary }));
        await fetchOntology(ontologyFilter);
        fetchStats();
      } else {
        setExecutionResults((prev) => ({
          ...prev,
          [id]: `Error: ${body.error}`,
        }));
      }
    } finally {
      setExecutingId(null);
    }
  };

  const handleRejectOntology = async (id: number) => {
    await fetch(`${BASE}/api/brain/ontology/proposals/${id}/reject`, {
      method: "POST",
    });
    await fetchOntology(ontologyFilter);
  };

  const fetchProposals = useCallback(async (filter?: string) => {
    setProposalsLoading(true);
    try {
      const f = filter && filter !== "all" ? `?status=${filter}` : "";
      const res = await fetch(`${BASE}/api/brain/proposals${f}`);
      if (res.ok) setProposals(await res.json());
    } catch {
      /* ignore */
    } finally {
      setProposalsLoading(false);
    }
  }, []);

  const handleRejectProposal = async (id: number) => {
    await fetch(`${BASE}/api/brain/proposals/${id}/reject`, { method: "POST" });
    await fetchProposals(proposalFilter);
  };

  const fetchNetwork = useCallback(async () => {
    setNetLoading(true);
    try {
      const [statsRes, neuronsRes, synapsesRes, agentsRes, pulsesRes] =
        await Promise.all([
          fetch(`${BASE}/api/network/stats`),
          fetch(`${BASE}/api/network/neurons?limit=40`),
          fetch(`${BASE}/api/network/synapses?limit=100`),
          fetch(`${BASE}/api/network/agents`),
          fetch(`${BASE}/api/network/pulses?limit=30`),
        ]);
      if (statsRes.ok) setNetStats(await statsRes.json());
      if (neuronsRes.ok) setNetNeurons(await neuronsRes.json());
      if (synapsesRes.ok) setNetSynapses(await synapsesRes.json());
      if (agentsRes.ok) setNetAgents(await agentsRes.json());
      if (pulsesRes.ok) setNetPulses(await pulsesRes.json());
    } catch {
      /* ignore */
    } finally {
      setNetLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchStats(), fetchCharacter(), fetchNodes()]).finally(() =>
      setLoading(false),
    );
  }, [fetchStats, fetchCharacter, fetchNodes]);

  useEffect(() => {
    if (tab === "network") fetchNetwork();
    if (tab === "proposals") fetchProposals(proposalFilter);
    if (tab === "ontology") fetchOntology(ontologyFilter);
  }, [
    tab,
    fetchNetwork,
    fetchProposals,
    fetchOntology,
    proposalFilter,
    ontologyFilter,
  ]);

  // Auto-refresh network every 15s when on that tab
  useEffect(() => {
    if (tab !== "network") return;
    const t = setInterval(() => {
      fetch(`${BASE}/api/network/stats`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setNetStats(d);
        });
      fetch(`${BASE}/api/network/pulses?limit=30`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setNetPulses(d);
        });
    }, 15000);
    return () => clearInterval(t);
  }, [tab]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (tab === "knowledge") fetchNodes(search || undefined);
    }, 350);
    return () => clearTimeout(t);
  }, [search, tab, fetchNodes]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const deleteNode = async (id: number) => {
    await fetch(`${BASE}/api/omni/knowledge/${id}`, { method: "DELETE" });
    setNodes((prev) => prev.filter((n) => n.id !== id));
    fetchStats();
  };

  const handleTrain = async () => {
    // Prevent rapid retries - only allow one training at a time
    if (training) {
      console.warn("[TRAIN] Training already in progress");
      return;
    }

    setTraining(true);
    setTrainResult(null);
    try {
      // Validate input based on source type
      if (trainSource === "manual") {
        if (!trainText.trim())
          throw new Error("Please paste some text to train");
        // } else if (trainSource === "document") {
        //   if (!trainText.trim() && !selectedFile) throw new Error("Upload a document file or paste text");
      } else if (trainSource === "web") {
        if (!trainUrl.trim()) throw new Error("Please enter a URL to fetch");
      } else if (trainSource === "research") {
        if (!trainUrls.trim()) throw new Error("Please enter URLs to research");
      }

      // Use FormData for file uploads, JSON for text/URL
      let res;
      try {
        if (selectedFile && trainSource === "document") {
          const formData = new FormData();
          formData.append("file", selectedFile);
          formData.append("source", "document");
          if (trainText.trim()) formData.append("text", trainText);
          console.log(
            "[TRAIN] Sending file upload to:",
            `${BASE}/api/omni/train`,
          );
          res = await fetch(`${BASE}/api/omni/train`, { method: "POST", body: formData });
        } else {
          const payload: any = { source: trainSource };
          if (trainSource === "manual") payload.text = trainText;
          if (trainSource === "web") payload.url = trainUrl;
          if (trainSource === "research") {
            payload.urls = trainUrls
              .split("\n")
              .filter((u) => u.trim())
              .map((u) => u.trim());
          }

          console.log(
            "[TRAIN] Sending text/URL payload to:",
            `${BASE}/api/omni/train`,
          );
          res = await fetch(`${BASE}/api/omni/train`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }

        console.log("[TRAIN] Response status:", res.status, res.ok);

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          // Handle rate limiting specifically
          if (res.status === 429) {
            throw new Error(
              "Rate limit exceeded. Please wait a few minutes before trying again.",
            );
          }
          throw new Error(
            errorData.error ||
              errorData.message ||
              `HTTP ${res.status}: ${res.statusText}`,
          );
        }

        const result = await res.json();
        console.log("[TRAIN] Success:", result);
        setTrainResult(result);
        // TEMPORARILY DISABLED: Clear inputs based on source type
        // if (trainSource === "manual") {
        //   setTrainText("");
        // }
        // if (trainSource === "document") {
        //   setTrainText("");
        //   setSelectedFile(null);
        //   setFileContent("");
        // }
        if (trainSource === "web" || trainSource === "research")
          setTrainUrl("");
        if (trainSource === "research") setTrainUrls("");
        fetchStats();
        fetchCharacter();
      } catch (fetchErr: any) {
        console.error("[TRAIN] Error:", fetchErr);
        throw fetchErr;
      }
    } catch (err: any) {
      console.error("[TRAIN] Final catch:", err);
      setTrainResult({ added: 0, message: err.message || "Training failed" });
    } finally {
      // Small delay to prevent rapid re-clicks
      setTimeout(() => {
        setTraining(false);
      }, 500);
    }
  };

  const handleAddFact = async () => {
    if (!addContent.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch(`${BASE}/api/omni/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: addContent.trim(),
          type: addType,
          confidence: 0.85,
        }),
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

  const handleContribute = async () => {
    if (!contributeText.trim() || contributing) return;
    setContributing(true);
    try {
      const res = await fetch(`${BASE}/api/network/contribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          neurons: [{ content: contributeText.trim(), type: contributeType }],
          agentName: "self",
        }),
      });
      if (res.ok) {
        setContributeText("");
        fetchNetwork();
      }
    } finally {
      setContributing(false);
    }
  };

  const handleNetQuery = async () => {
    if (!netQuery.trim() || querying) return;
    setQuerying(true);
    setNetQueryResults([]);
    try {
      const res = await fetch(`${BASE}/api/network/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: netQuery.trim(), limit: 10 }),
      });
      if (res.ok) {
        setNetQueryResults(await res.json());
        fetchNetwork();
      }
    } finally {
      setQuerying(false);
    }
  };

  const handleReinforce = async (id: number) => {
    await fetch(`${BASE}/api/network/reinforce/${id}`, { method: "POST" });
    fetchNetwork();
  };

  const handleDecay = async () => {
    setDecaying(true);
    try {
      await fetch(`${BASE}/api/network/decay`, { method: "POST" });
      fetchNetwork();
    } finally {
      setDecaying(false);
    }
  };

  // ── Tabs ─────────────────────────────────────────────────────────────────

  const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "network", label: "Network Brain", icon: Network },
    { id: "knowledge", label: "Knowledge", icon: Database },
    { id: "train", label: "Training", icon: Zap },
    { id: "character", label: "Character", icon: Activity },
    { id: "proposals", label: "Hebbian Proposals", icon: FlaskConical },
    { id: "ontology", label: "Ontology", icon: Layers },
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
            <h1 className="text-2xl font-bold tracking-tight">
              OmniLearn Intelligence
            </h1>
            <p className="text-sm text-muted-foreground font-mono">
              Native learning engine — distributed neural network
            </p>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              {
                label: "Knowledge Nodes",
                value: stats.nodeCount,
                icon: Database,
                color: "text-primary",
              },
              {
                label: "Connections",
                value: stats.edgeCount,
                icon: GitBranch,
                color: "text-yellow-400",
              },
              {
                label: "Learning Events",
                value: stats.logCount,
                icon: Clock,
                color: "text-emerald-400",
              },
              {
                label: "Interactions",
                value: character?.totalInteractions ?? 0,
                icon: Activity,
                color: "text-violet-400",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="p-4 rounded-xl border border-border/40 bg-card/40"
              >
                <Icon className={cn("w-4 h-4 mb-2", color)} />
                <div className="text-2xl font-bold font-mono">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/40 pb-px overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              if (id === "knowledge") fetchNodes(search || undefined);
            }}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 font-mono text-sm border-b-2 -mb-px transition-all whitespace-nowrap",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── NETWORK BRAIN TAB ────────────────────────────────────────────────── */}
      {tab === "network" && (
        <div className="space-y-6">
          {netLoading && !netStats ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary/60" />
            </div>
          ) : (
            <>
              {/* Network stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: "Network Neurons",
                    value: netStats?.neurons ?? 0,
                    icon: Cpu,
                    color: "text-primary",
                    sub: `${netStats?.coreNeurons ?? 0} core`,
                  },
                  {
                    label: "Synaptic Links",
                    value: netStats?.synapses ?? 0,
                    icon: GitBranch,
                    color: "text-yellow-400",
                    sub: `avg weight ${netStats?.avgWeight ?? 0}`,
                  },
                  {
                    label: "Contributing Agents",
                    value: netStats?.agents ?? 0,
                    icon: Users,
                    color: "text-violet-400",
                    sub: "ghost nodes + self",
                  },
                  {
                    label: "Network Health",
                    value: `${netStats?.health ?? 0}%`,
                    icon: TrendingUp,
                    color: "text-emerald-400",
                    sub: `total weight ${netStats?.totalWeight ?? 0}`,
                  },
                ].map(({ label, value, icon: Icon, color, sub }) => (
                  <div
                    key={label}
                    className="p-4 rounded-xl border border-border/40 bg-card/40"
                  >
                    <Icon className={cn("w-4 h-4 mb-2", color)} />
                    <div className="text-2xl font-bold font-mono">{value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {label}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">
                      {sub}
                    </div>
                  </div>
                ))}
              </div>

              {/* Visualization + right panel */}
              <div className="grid md:grid-cols-3 gap-4">
                {/* Graph */}
                <div className="md:col-span-2 p-4 rounded-xl border border-border/40 bg-card/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Network className="w-3.5 h-3.5 text-primary" />
                      Live Network Graph
                    </h3>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/60">
                      {[
                        { color: NEURON_COLORS.fact, label: "fact" },
                        { color: NEURON_COLORS.concept, label: "concept" },
                        { color: NEURON_COLORS.rule, label: "rule" },
                        { color: NEURON_COLORS.opinion, label: "opinion" },
                      ].map(({ color, label }) => (
                        <span key={label} className="flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ background: color }}
                          />
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div
                    className="rounded-lg overflow-hidden bg-background/60 border border-border/20"
                    style={{ height: 260 }}
                  >
                    {netNeurons.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <p className="font-mono text-xs text-muted-foreground/50">
                          No neurons yet. Train the model or add knowledge to
                          seed the network.
                        </p>
                      </div>
                    ) : (
                      <NeuralGraph
                        neurons={netNeurons}
                        synapses={netSynapses}
                      />
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground/40">
                    Showing top {Math.min(netNeurons.length, 30)} neurons by
                    weight. Node size = weight. Connections = Hebbian synapses.
                    {netStats?.coreNeurons
                      ? ` Orange glow = core memory (${netStats.coreNeurons} neurons).`
                      : ""}
                  </p>
                </div>

                {/* Pulse feed */}
                <div className="p-4 rounded-xl border border-border/40 bg-card/40 space-y-3">
                  <h3 className="font-mono text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-primary animate-pulse" />
                    Activity Pulses
                  </h3>
                  <div className="space-y-2 overflow-y-auto max-h-[220px]">
                    {netPulses.length === 0 ? (
                      <p className="text-[11px] font-mono text-muted-foreground/50">
                        No activity yet.
                      </p>
                    ) : (
                      netPulses.map((p) => (
                        <div key={p.id} className="flex items-start gap-2">
                          <span
                            className={cn(
                              "font-mono text-[10px] shrink-0 mt-0.5 uppercase",
                              PULSE_COLORS[p.eventType] ??
                                "text-muted-foreground",
                            )}
                          >
                            {p.eventType}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-[10px] text-foreground/70 leading-relaxed truncate">
                              {p.details ?? `${p.neuronsAffected} neurons`}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground/40">
                              {p.agentName} · {timeAgo(p.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    onClick={fetchNetwork}
                    className="w-full text-center text-[10px] font-mono text-muted-foreground/50 hover:text-primary transition-colors"
                  >
                    refresh
                  </button>
                </div>
              </div>

              {/* Strongest neurons */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border/40 bg-card/40 space-y-3">
                  <h3 className="font-mono text-sm font-bold text-foreground">
                    Strongest Neurons
                  </h3>
                  <p className="font-mono text-xs text-muted-foreground/60">
                    Neurons with the highest accumulated weight — these are the
                    network's core memory.
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {netNeurons.slice(0, 15).map((n) => (
                      <div
                        key={n.id}
                        className="group flex items-start gap-2 p-2 rounded-lg hover:bg-secondary/20 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs text-foreground leading-relaxed">
                            {n.content}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="font-mono text-[10px] px-1 py-0.5 rounded"
                              style={{
                                color: NEURON_COLORS[n.type] ?? "#22d3ee",
                                background:
                                  (NEURON_COLORS[n.type] ?? "#22d3ee") + "15",
                              }}
                            >
                              {n.type}
                            </span>
                            {n.isCore && (
                              <span className="font-mono text-[10px] text-orange-400">
                                core
                              </span>
                            )}
                            <span className="font-mono text-[10px] text-muted-foreground/40">
                              by {n.sourceAgent}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1 bg-secondary/30 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (n.weight / (netStats?.maxWeight ?? 1)) * 100)}%`,
                                background: NEURON_COLORS[n.type] ?? "#22d3ee",
                              }}
                            />
                          </div>
                          <div className="flex justify-between mt-0.5">
                            <span className="font-mono text-[10px] text-muted-foreground/40">
                              weight {n.weight.toFixed(2)} · accessed{" "}
                              {n.accessCount}× · reinforced{" "}
                              {n.reinforcementCount}×
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleReinforce(n.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground/40 hover:text-yellow-400 hover:bg-yellow-400/10 transition-all shrink-0"
                          title="Manually reinforce this neuron"
                        >
                          <Zap className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {netNeurons.length === 0 && (
                      <p className="text-center py-4 text-muted-foreground font-mono text-xs">
                        No neurons yet.
                      </p>
                    )}
                  </div>
                </div>

                {/* Agents + contribute */}
                <div className="space-y-4">
                  {/* Agents */}
                  <div className="p-4 rounded-xl border border-border/40 bg-card/40 space-y-3">
                    <h3 className="font-mono text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-primary" />
                      Contributing Agents
                    </h3>
                    {netAgents.length === 0 ? (
                      <p className="font-mono text-xs text-muted-foreground/50">
                        No agents have contributed yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {netAgents.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-3 p-2 rounded-lg bg-secondary/10"
                          >
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full shrink-0",
                                a.isSelf ? "bg-primary" : "bg-emerald-400",
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-xs text-foreground">
                                {a.name}{" "}
                                {a.isSelf && (
                                  <span className="text-primary text-[10px]">
                                    (this node)
                                  </span>
                                )}
                              </p>
                              <p className="font-mono text-[10px] text-muted-foreground/50">
                                {a.totalContributions} contributed ·{" "}
                                {a.totalReinforcements} reinforced · trust{" "}
                                {(a.trustScore * 100).toFixed(0)}%
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="font-mono text-[10px] text-muted-foreground/40">
                      Ghost nodes automatically sync their knowledge here when
                      they call POST /api/network/sync.
                    </p>
                  </div>

                  {/* Contribute manually */}
                  <div className="p-4 rounded-xl border border-border/40 bg-card/40 space-y-3">
                    <h3 className="font-mono text-sm font-bold text-foreground">
                      Feed the Network
                    </h3>
                    <p className="font-mono text-xs text-muted-foreground/60">
                      Directly inject a piece of knowledge into the shared
                      network brain.
                    </p>
                    <div className="space-y-2">
                      <textarea
                        value={contributeText}
                        onChange={(e) => setContributeText(e.target.value)}
                        placeholder="Enter a fact, concept, or insight to teach the network…"
                        rows={3}
                        className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/30 resize-none"
                      />
                      <div className="flex gap-2">
                        <select
                          value={contributeType}
                          onChange={(e) => setContributeType(e.target.value)}
                          className="bg-background border border-border/50 rounded-lg px-2 py-2 text-xs font-mono focus:outline-none focus:border-primary/50 text-muted-foreground"
                        >
                          {[
                            "fact",
                            "concept",
                            "rule",
                            "opinion",
                            "insight",
                          ].map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleContribute}
                          disabled={contributing || !contributeText.trim()}
                          className="flex-1 px-4 py-2 bg-primary text-background rounded-lg font-mono text-xs hover:bg-primary/80 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
                        >
                          {contributing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                          Contribute
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Query + decay */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Network query */}
                <div className="p-4 rounded-xl border border-border/40 bg-card/40 space-y-3">
                  <h3 className="font-mono text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-primary" />
                    Query the Network
                  </h3>
                  <p className="font-mono text-xs text-muted-foreground/60">
                    Ask the collective brain a question. Querying reinforces the
                    most relevant neurons.
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={netQuery}
                      onChange={(e) => setNetQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleNetQuery();
                      }}
                      placeholder="What does the network know about…"
                      className="flex-1 bg-background border border-border/50 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
                    />
                    <button
                      onClick={handleNetQuery}
                      disabled={querying || !netQuery.trim()}
                      className="px-3 py-2 bg-primary/10 border border-primary/30 text-primary rounded-lg hover:bg-primary/20 disabled:opacity-40 transition-all"
                    >
                      {querying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {netQueryResults.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {netQueryResults.map((r) => (
                        <div
                          key={r.id}
                          className="p-2 rounded-lg bg-secondary/10 space-y-1"
                        >
                          <p className="font-mono text-xs text-foreground">
                            {r.content}
                          </p>
                          <div className="flex gap-3">
                            <span
                              className="font-mono text-[10px]"
                              style={{
                                color: NEURON_COLORS[r.type] ?? "#22d3ee",
                              }}
                            >
                              {r.type}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground/50">
                              weight {r.weight.toFixed(2)}
                            </span>
                            <span className="font-mono text-[10px] text-violet-400/70">
                              match {(r.similarity * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Maintenance */}
                <div className="p-4 rounded-xl border border-border/40 bg-card/40 space-y-4">
                  <h3 className="font-mono text-sm font-bold text-foreground">
                    Network Maintenance
                  </h3>
                  <p className="font-mono text-xs text-muted-foreground/60">
                    The network automatically decays weak connections every 30
                    minutes, pruning irrelevant synapses so strong knowledge
                    grows stronger.
                  </p>
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-secondary/10 space-y-1.5">
                      <p className="font-mono text-xs font-bold text-foreground">
                        How self-sustaining works
                      </p>
                      <ul className="font-mono text-xs text-muted-foreground/70 space-y-1">
                        <li>
                          — Every training session feeds extracted facts into
                          the network
                        </li>
                        <li>
                          — Repeated concepts get reinforced (weight +0.2 per
                          hit)
                        </li>
                        <li>
                          — Co-occurring concepts form Hebbian synapses
                          automatically
                        </li>
                        <li>
                          — Querying strengthens the most relevant neurons
                        </li>
                        <li>
                          — Ghost nodes sync their local learning via
                          /api/network/sync
                        </li>
                        <li>
                          — Weak synapses decay; core neurons (weight ≥ 5.0)
                          persist
                        </li>
                      </ul>
                    </div>
                    <button
                      onClick={handleDecay}
                      disabled={decaying}
                      className="w-full px-4 py-2 border border-border/40 rounded-lg font-mono text-xs text-muted-foreground hover:border-primary/30 hover:text-primary disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                    >
                      {decaying ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Run Decay Cycle Now
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {tab === "overview" && stats && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl border border-border/40 bg-card/40 space-y-3">
              <h3 className="font-mono text-sm font-bold text-foreground">
                Knowledge by Type
              </h3>
              {stats.typeCounts.length === 0 ? (
                <p className="text-muted-foreground font-mono text-xs">
                  No knowledge loaded yet.
                </p>
              ) : (
                stats.typeCounts.map(({ type, count }) => {
                  const Icon = TYPE_ICONS[type] ?? BookOpen;
                  const colorClass = TYPE_COLORS[type] ?? TYPE_COLORS.fact;
                  const pct = Math.round(
                    (Number(count) / stats.nodeCount) * 100,
                  );
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center shrink-0",
                          colorClass,
                        )}
                      >
                        <Icon className="w-2.5 h-2.5" />
                      </div>
                      <span className="font-mono text-xs text-muted-foreground w-20 capitalize">
                        {type}
                      </span>
                      <div className="flex-1 h-1.5 bg-secondary/40 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/40 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-foreground w-8 text-right">
                        {Number(count)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-5 rounded-xl border border-border/40 bg-card/40 space-y-3">
              <h3 className="font-mono text-sm font-bold text-foreground">
                Recent Learning Events
              </h3>
              {stats.recentLog.length === 0 ? (
                <p className="text-muted-foreground font-mono text-xs">
                  No learning events yet. Start a conversation in Native mode.
                </p>
              ) : (
                <div className="space-y-2">
                  {stats.recentLog.slice(0, 8).map((log) => (
                    <div key={log.id} className="flex items-start gap-2">
                      <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-foreground truncate">
                          {log.details}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground/50">
                          +{log.nodesAdded} node
                          {log.nodesAdded !== 1 ? "s" : ""} · {log.event}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-5 rounded-xl border border-border/40 bg-card/40">
            <h3 className="font-mono text-sm font-bold text-foreground mb-4">
              How the Intelligence Works
            </h3>
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
                  icon: Network,
                  title: "Distributed Network",
                  body: "A separate shared brain grows across all agents. Neurons reinforce each other via Hebbian learning — knowledge that's accessed together, wires together.",
                },
                {
                  icon: Zap,
                  title: "Response Synthesis",
                  body: "Retrieved knowledge chunks are assembled into natural language responses using confidence-calibrated templates and character-voice modifiers.",
                },
                {
                  icon: Shield,
                  title: "Self-Contained Engine",
                  body: "The knowledge graph, TF-IDF retrieval, character engine, and response synthesis all run on your own server. Omni is the agent — not a wrapper around a third-party chatbot.",
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

      {/* ── KNOWLEDGE TAB ─────────────────────────────────────────────────────── */}
      {tab === "knowledge" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search knowledge semantically…"
                className="w-full bg-background border border-border/50 rounded-lg pl-9 pr-4 py-2.5 text-sm font-mono focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-primary/50" />
              )}
            </div>
            <button
              onClick={() => fetchNodes(search || undefined)}
              className="px-3 py-2 rounded-lg border border-border/40 hover:border-primary/30 text-muted-foreground hover:text-primary transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 rounded-xl border border-border/40 bg-card/30 space-y-3">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              Add Knowledge
            </p>
            <div className="flex gap-2">
              <input
                value={addContent}
                onChange={(e) => setAddContent(e.target.value)}
                placeholder="Enter a fact, concept, rule, or opinion…"
                className="flex-1 bg-background border border-border/50 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddFact();
                }}
              />
              <select
                value={addType}
                onChange={(e) => setAddType(e.target.value)}
                className="bg-background border border-border/50 rounded-lg px-2 py-2 text-xs font-mono focus:outline-none focus:border-primary/50 text-muted-foreground"
              >
                {["fact", "concept", "opinion", "rule"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddFact}
                disabled={adding || !addContent.trim()}
                className="px-4 py-2 bg-primary text-background rounded-lg font-mono text-xs hover:bg-primary/80 disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                {adding ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {nodes.length === 0 && !searching && (
              <p className="text-center py-12 text-muted-foreground font-mono text-sm">
                {search
                  ? "No matching knowledge found."
                  : "Knowledge base is loading…"}
              </p>
            )}
            {nodes.map((node) => (
              <NodeCard key={node.id} node={node} onDelete={deleteNode} />
            ))}
          </div>
        </div>
      )}

      {/* ── TRAINING TAB ─────────────────────────────────────────────────────── */}
      {tab === "train" && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-border/40 bg-card/40 space-y-4">
            <div>
              <h3 className="font-mono text-sm font-bold text-foreground mb-1">
                Bulk Training
              </h3>
              <p className="font-mono text-xs text-muted-foreground">
                Paste any text — articles, documentation, notes, definitions.
                The engine extracts structured knowledge and adds it to both the
                local model and the shared network brain.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground pt-2">
                Source:
              </span>
              {["manual", "document", "web", "research"].map((src) => (
                <button
                  key={src}
                  onClick={() => setTrainSource(src)}
                  className={cn(
                    "px-3 py-1.5 rounded-md font-mono text-xs border transition-all capitalize",
                    trainSource === src
                      ? "bg-primary/10 border-primary/30 text-primary font-bold"
                      : "border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/20",
                  )}
                >
                  {src}
                </button>
              ))}
            </div>

            {/* MANUAL: Paste text */}
            {trainSource === "manual" && (
              <>
                <textarea
                  value={trainText}
                  onChange={(e) => setTrainText(e.target.value)}
                  placeholder={
                    "Paste text to teach OmniLearn. For example:\n\nMachine learning is a subset of artificial intelligence. Neural networks are computational models inspired by the brain. Gradient descent is an optimisation algorithm used to train neural networks by minimising loss functions..."
                  }
                  rows={10}
                  className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/30 resize-none"
                />
                <div className="font-mono text-xs text-muted-foreground">
                  {trainText.length} characters · ~
                  {Math.max(0, trainText.split(/\s+/).filter(Boolean).length)}{" "}
                  words
                </div>
              </>
            )}

            {/* DOCUMENT: Upload file OR paste text */}
            {trainSource === "document" && (
              <div className="space-y-3">
                <div>
                  <label className="font-mono text-xs text-muted-foreground mb-2 block">Upload Document File</label>
                  <div className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center hover:border-primary/30 transition-colors">
                    <input
                      type="file"
                      id="document-upload"
                      accept=".pdf,.doc,.docx,.txt,.md,.html,.json,.csv,.xlsx,.xls,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSelectedFile(file);
                          if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
                            const text = await file.text();
                            setFileContent(text);
                            setTrainText(text);
                          } else {
                            setFileContent(`[Binary file: ${file.name} - will be extracted on upload]`);
                            setTrainText("");
                          }
                        }
                      }}
                      className="hidden"
                    />
                    <label htmlFor="document-upload" className="cursor-pointer">
                      <Database className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="font-mono text-xs text-foreground mb-1">
                        {selectedFile ? selectedFile.name : "Click to upload or drag and drop"}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground/50">
                        PDF, DOC, DOCX, TXT, MD, HTML, JSON, CSV, XLSX, PPTX, images (OCR)
                      </p>
                      {selectedFile && (
                        <p className="font-mono text-[10px] text-muted-foreground/40 mt-2">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      )}
                    </label>
                  </div>
                </div>

                {selectedFile && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-border/40" />
                    <span className="font-mono text-xs text-muted-foreground">OR</span>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>
                )}

                <div>
                  <label className="font-mono text-xs text-muted-foreground mb-2 block">Or paste text directly</label>
                  <textarea
                    value={trainText}
                    onChange={e => setTrainText(e.target.value)}
                    placeholder={"Paste article, paper, or document content..."}
                    rows={8}
                    className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/30 resize-none"
                    disabled={!!selectedFile}
                  />
                </div>

                <div className="font-mono text-xs text-muted-foreground">
                  {selectedFile
                    ? `File: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`
                    : `${trainText.length} characters · ~${Math.max(0, trainText.split(/\s+/).filter(Boolean).length)} words`
                  }
                </div>
              </div>
            )}

            {/* WEB: Single URL input */}
            {trainSource === "web" && (
              <div className="space-y-2">
                <label className="font-mono text-xs text-muted-foreground">
                  Enter URL to fetch and train from:
                </label>
                <input
                  type="url"
                  value={trainUrl}
                  onChange={(e) => setTrainUrl(e.target.value)}
                  placeholder="https://example.com/article or https://news.ycombinator.com/..."
                  className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
                />
                {trainUrl && (
                  <div className="font-mono text-xs text-muted-foreground truncate">
                    Fetching from: {trainUrl}
                  </div>
                )}
              </div>
            )}

            {/* RESEARCH: Multiple URLs */}
            {trainSource === "research" && (
              <div className="space-y-2">
                <label className="font-mono text-xs text-muted-foreground">
                  Enter URLs (one per line) to research:
                </label>
                <textarea
                  value={trainUrls}
                  onChange={(e) => setTrainUrls(e.target.value)}
                  placeholder={
                    "https://arxiv.org/paper/123\nhttps://example.com/research\nhttps://news.ycombinator.com/item?id=456"
                  }
                  rows={8}
                  className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/30 resize-none"
                />
                {trainUrls && (
                  <div className="font-mono text-xs text-muted-foreground">
                    {trainUrls.split("\n").filter((u) => u.trim()).length}{" "}
                    URL(s) to fetch
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">
                {trainSource === "manual" &&
                  `${trainText.length} characters · ~${Math.max(0, trainText.split(/\s+/).filter(Boolean).length)} words`}
                {trainSource === "document" &&
                  (selectedFile
                    ? `File: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`
                    : `${trainText.length} characters · ~${Math.max(0, trainText.split(/\s+/).filter(Boolean).length)} words`)}
                {trainSource === "web" &&
                  (trainUrl ? `URL ready` : `Enter URL`)}
                {trainSource === "research" &&
                  `${trainUrls.split("\n").filter((u) => u.trim()).length} URL(s)`}
              </span>
              <button
                onClick={handleTrain}
                disabled={
                  training ||
                  (trainSource === "manual" && trainText.trim().length < 10) ||
                  (trainSource === "document" &&
                    trainText.trim().length < 10 &&
                    !selectedFile) ||
                  (trainSource === "web" && !trainUrl.trim()) ||
                  (trainSource === "research" && !trainUrls.trim())
                }
                className="px-6 py-2.5 bg-primary text-background rounded-xl font-mono text-sm font-bold hover:bg-primary/80 disabled:opacity-40 transition-all flex items-center gap-2"
              >
                {training ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
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
                      : "border-border/40 bg-card/40",
                  )}
                >
                  {trainResult.added > 0 ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    trainResult.message?.includes("Rate limit") ? (
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    )
                  )}
                  <p className="font-mono text-sm text-foreground">
                    {trainResult.message}
                    {trainResult.message?.includes("Rate limit") && (
                      <span className="block mt-1 text-xs text-amber-400">
                        ⚠️ Wait 2-3 minutes before trying again
                      </span>
                    )}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-5 rounded-xl border border-border/40 bg-card/30">
            <h3 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Training Tips
            </h3>
            <ul className="space-y-2 font-mono text-xs text-muted-foreground">
              {[
                'The model learns best from declarative sentences: "X is Y", "X causes Y", "X enables Y".',
                "Structured text (documentation, definitions, explanations) yields more knowledge nodes than raw prose.",
                "Every training run automatically contributes extracted facts to the shared Network Brain.",
                "Ghost nodes running in other machines can sync their local learning to the network via POST /api/network/sync.",
                "Training the same concept multiple times reinforces its weight in the network — it becomes a core memory.",
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary/40 shrink-0">—</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── CHARACTER TAB ─────────────────────────────────────────────────────── */}
      {tab === "character" && character && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl border border-border/40 bg-card/40 space-y-4">
              <h3 className="font-mono text-sm font-bold text-foreground">
                Personality Traits
              </h3>
              <div className="space-y-3">
                <TraitBar
                  label="Curiosity"
                  value={character.curiosity}
                  color="bg-primary"
                />
                <TraitBar
                  label="Caution"
                  value={character.caution}
                  color="bg-yellow-400"
                />
                <TraitBar
                  label="Confidence"
                  value={character.confidence}
                  color="bg-emerald-400"
                />
                <TraitBar
                  label="Verbosity"
                  value={character.verbosity}
                  color="bg-violet-400"
                />
                <TraitBar
                  label="Technical Depth"
                  value={character.technical}
                  color="bg-orange-400"
                />
                <TraitBar
                  label="Empathy"
                  value={character.empathy}
                  color="bg-pink-400"
                />
                <TraitBar
                  label="Creativity"
                  value={character.creativity}
                  color="bg-cyan-400"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-xl border border-border/40 bg-card/40 space-y-3">
                <h3 className="font-mono text-sm font-bold text-foreground">
                  Lifetime Stats
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Total Interactions",
                      value: character.totalInteractions,
                    },
                    {
                      label: "Knowledge Nodes",
                      value: character.totalKnowledgeNodes,
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 rounded-lg bg-secondary/20">
                      <div className="text-xl font-bold font-mono">{value}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-xl border border-border/40 bg-card/30 space-y-3">
                <h3 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  How Character Works
                </h3>
                <p className="font-mono text-xs text-muted-foreground">
                  Each learning event shifts these traits slightly. High
                  curiosity makes the model explore tangents. High caution makes
                  it qualify statements. High creativity leads to analogical
                  responses. Traits drift naturally as the model encounters new
                  knowledge.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "character" && !character && (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground font-mono text-sm">
            No character data yet. Start a conversation in Native mode.
          </p>
        </div>
      )}

      {/* ── HEBBIAN PROPOSALS TAB ─────────────────────────────────────────────── */}
      {tab === "proposals" && (
        <div className="space-y-6">
          {/* Explainer */}
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-primary" />
              <h3 className="font-mono text-sm font-bold text-foreground">
                Verified Hebbian Deltas
              </h3>
            </div>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              Each reinforcement proposal carries a source triple{" "}
              <span className="text-primary">
                (node A → edge type → node B)
              </span>{" "}
              and a cryptographic proof tying that triple to observed evidence.
              Before any edge is strengthened, local validation re-derives both
              the evidence hash and the proposal proof from stored fields.
              Semantic overlap is also checked — the evidence text must mention
              tokens from both nodes.
            </p>
            <div className="flex items-center gap-4 pt-1 font-mono text-[10px] text-muted-foreground/60">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                pending → awaiting validation
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                validated → proof verified
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary" />
                applied → edge committed
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                rejected
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              {["all", "pending", "validated", "rejected", "applied"].map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setProposalFilter(f);
                      fetchProposals(f);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-md font-mono text-xs border transition-all",
                      proposalFilter === f
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "border-border/40 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f}
                  </button>
                ),
              )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => fetchProposals(proposalFilter)}
                className="p-2 rounded-md border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Proposal list */}
          {proposalsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <FlaskConical className="w-8 h-8 text-muted-foreground/20 mx-auto" />
              <p className="font-mono text-sm text-muted-foreground/60">
                No proposals yet.
              </p>
              <p className="font-mono text-xs text-muted-foreground/40">
                Proposals are generated automatically when you train the model
                or add knowledge nodes. Each new co-occurrence or semantic
                similarity becomes a Hebbian proposal, and validation now passes
                by majority quorum over eligible votes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((p) => {
                const vr = validationResults[p.id];
                const statusColor =
                  {
                    pending:
                      "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
                    validated:
                      "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
                    rejected: "text-red-400 border-red-500/20 bg-red-500/5",
                    applied: "text-primary border-primary/20 bg-primary/5",
                  }[p.status] ??
                  "text-muted-foreground border-border/40 bg-card/40";

                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl border border-border/40 bg-card/40 space-y-3"
                  >
                    {/* Triple header */}
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-mono border shrink-0 mt-0.5",
                          statusColor,
                        )}
                      >
                        {p.status}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs">
                          <span
                            className="text-primary/80 truncate max-w-[180px]"
                            title={p.nodeA?.content}
                          >
                            {p.nodeA
                              ? `"${p.nodeA.content.slice(0, 40)}${p.nodeA.content.length > 40 ? "…" : ""}"`
                              : `node#${p.nodeAId}`}
                          </span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                          <span className="px-1.5 py-0.5 rounded bg-secondary/40 text-[10px] text-muted-foreground shrink-0">
                            {p.edgeType}
                          </span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                          <span
                            className="text-primary/80 truncate max-w-[180px]"
                            title={p.nodeB?.content}
                          >
                            {p.nodeB
                              ? `"${p.nodeB.content.slice(0, 40)}${p.nodeB.content.length > 40 ? "…" : ""}"`
                              : `node#${p.nodeBId}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 font-mono text-[10px] text-muted-foreground/50">
                          <span>Δw = +{p.deltaWeight.toFixed(2)}</span>
                          <span>proposer: {p.proposerId}</span>
                          <span>#{p.id}</span>
                          <span>{new Date(p.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.status === "pending" && (
                          <button
                            onClick={() => handleRejectProposal(p.id)}
                            className="p-1.5 rounded-md border border-red-500/20 text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-all"
                          >
                            <XCircle className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Evidence text */}
                    <div className="p-2.5 rounded-lg bg-secondary/20 border border-border/20 space-y-1">
                      <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                        Evidence
                      </p>
                      <p className="font-mono text-xs text-foreground/70 leading-relaxed">
                        {p.evidenceText}
                      </p>
                    </div>

                    {/* Proof hashes */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-secondary/10 border border-border/20 space-y-0.5">
                        <p className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-wider">
                          Evidence Hash (SHA-256)
                        </p>
                        <p className="font-mono text-[9px] text-foreground/40 break-all">
                          {p.evidenceHash}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-secondary/10 border border-border/20 space-y-0.5">
                        <p className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-wider">
                          Proposal Proof (SHA-256)
                        </p>
                        <p className="font-mono text-[9px] text-foreground/40 break-all">
                          {p.proposalProof}
                        </p>
                      </div>
                    </div>

                    {/* Validation result */}
                    {vr && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className={cn(
                          "p-3 rounded-lg border space-y-2",
                          vr.valid
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : "border-red-500/20 bg-red-500/5",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {vr.valid ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          )}
                          <p className="font-mono text-xs font-bold text-foreground">
                            {vr.valid
                              ? "Proof verified — delta applied automatically"
                              : `Rejected: ${vr.reason}`}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px]">
                          {[
                            {
                              key: "evidenceHashMatch",
                              label: "Evidence hash match",
                            },
                            {
                              key: "proofMatch",
                              label: "Proposal proof match",
                            },
                            {
                              key: "semanticOverlap",
                              label: "Semantic overlap",
                            },
                            { key: "freshnessOk", label: "Within 72h window" },
                          ].map(({ key, label }) => {
                            const pass = vr.steps[key as keyof typeof vr.steps];
                            return (
                              <div
                                key={key}
                                className="flex items-center gap-1.5"
                              >
                                {pass ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                                )}
                                <span
                                  className={
                                    pass
                                      ? "text-foreground/70"
                                      : "text-red-400/70"
                                  }
                                >
                                  {label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {/* Applied stamp */}
                    {p.status === "applied" && p.appliedAt && (
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-primary/60">
                        <CheckCircle2 className="w-3 h-3" />
                        Applied to knowledge graph at{" "}
                        {new Date(p.appliedAt).toLocaleString()}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ONTOLOGY TAB ───────────────────────────────────────────────────────── */}
      {tab === "ontology" && (
        <div className="space-y-8">
          {/* Header + controls */}
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <h3 className="font-mono text-sm font-bold text-foreground">
                    OntologyNode — Graph Self-Awareness
                  </h3>
                </div>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                  A slow background process that reads the graph's own structure
                  and proposes meta-operations: registering new edge-type
                  vocabulary, splitting over-broad concepts, merging
                  near-duplicate nodes, and demoting stale rules to facts. Each
                  proposal is cryptographically sealed (rationale hash +
                  proposal proof) and must be approved before execution.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                  {Object.entries(ONTOLOGY_OP_CONFIG).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={key}
                        className="flex items-start gap-1.5 p-2 rounded-lg bg-secondary/10 border border-border/20"
                      >
                        <Icon
                          className={cn("w-3 h-3 mt-0.5 shrink-0", cfg.color)}
                        />
                        <div>
                          <p
                            className={cn(
                              "font-mono text-[10px] font-bold",
                              cfg.color,
                            )}
                          >
                            {cfg.label}
                          </p>
                          <p className="font-mono text-[9px] text-muted-foreground/50 leading-tight mt-0.5">
                            {cfg.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Reflect button + last result */}
            <div className="flex flex-col gap-2 items-end shrink-0">
              <button
                onClick={handleReflect}
                disabled={reflecting}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary/10 border border-primary/30 text-primary rounded-md font-mono text-sm hover:bg-primary/20 disabled:opacity-50 transition-all"
              >
                {reflecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Reflecting…
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Run Reflection
                  </>
                )}
              </button>
              {lastReflection && (
                <div className="p-3 rounded-lg border border-border/30 bg-card/40 space-y-1.5 w-64">
                  <p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                    Last reflection
                  </p>
                  <p className="font-mono text-xs text-primary">
                    {lastReflection.proposed} new proposals
                  </p>
                  <div className="space-y-0.5">
                    {lastReflection.checks.map((c, i) => (
                      <p
                        key={i}
                        className="font-mono text-[9px] text-muted-foreground/50"
                      >
                        {c}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Edge vocabulary registry */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-mono text-sm font-bold text-foreground flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-primary" />
                Edge Vocabulary Registry
              </h4>
              <button
                onClick={() => fetchOntology(ontologyFilter)}
                className="p-1.5 rounded border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {ontologyLoading && ontologyVocab.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-primary/60" />
              </div>
            ) : ontologyVocab.length === 0 ? (
              <div className="text-center py-8 space-y-1">
                <Layers className="w-6 h-6 text-muted-foreground/20 mx-auto" />
                <p className="font-mono text-sm text-muted-foreground/60">
                  No ontology vocabulary yet. Run Reflection to seed it.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ontologyVocab
                  .filter((n) => n.nodeType === "edge-vocab")
                  .map((node) => (
                    <div
                      key={node.id}
                      className="p-3 rounded-lg border border-border/40 bg-card/40 flex items-start gap-2"
                    >
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-mono border shrink-0 mt-0.5",
                          VOCAB_TYPE_STYLE[node.nodeType] ??
                            "text-muted-foreground border-border/40",
                        )}
                      >
                        {node.nodeType === "edge-vocab"
                          ? "edge"
                          : node.nodeType}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs font-bold text-primary truncate">
                          {node.name}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed mt-0.5">
                          {node.description}
                        </p>
                        <p className="font-mono text-[9px] text-muted-foreground/30 mt-1">
                          {(node.payload as Record<string, unknown>)?.source ===
                          "core-seed"
                            ? "core vocab"
                            : "discovered"}{" "}
                          · #{node.id}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full mt-1 shrink-0",
                          node.active
                            ? "bg-emerald-400"
                            : "bg-muted-foreground/20",
                        )}
                      />
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Meta proposals */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h4 className="font-mono text-sm font-bold text-foreground flex items-center gap-2">
                <Play className="w-4 h-4 text-primary" />
                Meta-Operation Proposals
              </h4>
              <div className="flex items-center gap-1 ml-auto flex-wrap">
                {["all", "pending", "approved", "executed", "rejected"].map(
                  (f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setOntologyFilter(f);
                        fetchOntology(f);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-md font-mono text-[10px] border transition-all",
                        ontologyFilter === f
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "border-border/40 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {f}
                    </button>
                  ),
                )}
              </div>
            </div>

            {ontologyLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-4 h-4 animate-spin text-primary/60" />
              </div>
            ) : ontologyProposals.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <Layers className="w-8 h-8 text-muted-foreground/20 mx-auto" />
                <p className="font-mono text-sm text-muted-foreground/60">
                  No ontology proposals yet.
                </p>
                <p className="font-mono text-xs text-muted-foreground/40">
                  Click "Run Reflection" to analyse the knowledge graph and
                  generate meta-operation proposals.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {ontologyProposals.map((p) => {
                  const opCfg = ONTOLOGY_OP_CONFIG[p.opType] ?? {
                    label: p.opType,
                    icon: Layers,
                    color: "text-muted-foreground",
                    description: "",
                  };
                  const OpIcon = opCfg.icon;
                  const execResult = executionResults[p.id];

                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl border border-border/40 bg-card/40 space-y-3"
                    >
                      {/* Header row */}
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
                            ONTOLOGY_STATUS_STYLE[p.status] ??
                              "border-border/40 bg-secondary/20",
                          )}
                        >
                          <OpIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className={cn(
                                "font-mono text-xs font-bold",
                                opCfg.color,
                              )}
                            >
                              {opCfg.label}
                            </p>
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded text-[9px] font-mono border",
                                ONTOLOGY_STATUS_STYLE[p.status] ??
                                  "text-muted-foreground border-border/40",
                              )}
                            >
                              {p.status}
                            </span>
                            <span className="font-mono text-[9px] text-muted-foreground/40 ml-auto">
                              #{p.id} · {new Date(p.createdAt).toLocaleString()}
                            </span>
                          </div>

                          {/* Subject node(s) */}
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap font-mono text-[10px]">
                            {p.nodeA && (
                              <span className="px-2 py-0.5 rounded bg-secondary/30 text-foreground/60">
                                node#{p.nodeA.id}{" "}
                                <span className="text-primary/70">
                                  "{p.nodeA.content.slice(0, 40)}
                                  {p.nodeA.content.length > 40 ? "…" : ""}"
                                </span>
                                <span className="ml-1 text-muted-foreground/40">
                                  ({p.nodeA.type})
                                </span>
                              </span>
                            )}
                            {p.nodeB && (
                              <>
                                <Merge className="w-3 h-3 text-muted-foreground/40" />
                                <span className="px-2 py-0.5 rounded bg-secondary/30 text-foreground/60">
                                  node#{p.nodeB.id}{" "}
                                  <span className="text-primary/70">
                                    "{p.nodeB.content.slice(0, 40)}
                                    {p.nodeB.content.length > 40 ? "…" : ""}"
                                  </span>
                                  <span className="ml-1 text-muted-foreground/40">
                                    ({p.nodeB.type})
                                  </span>
                                </span>
                              </>
                            )}
                            {p.proposedEdgeType && (
                              <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">
                                new type: "{p.proposedEdgeType}"
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {p.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleApproveOntology(p.id)}
                                disabled={approvingId === p.id}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-mono text-[10px] transition-all disabled:opacity-50"
                              >
                                {approvingId === p.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectOntology(p.id)}
                                className="p-1.5 rounded-md border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
                              >
                                <XCircle className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          {p.status === "approved" && (
                            <button
                              onClick={() => handleExecuteOntology(p.id)}
                              disabled={executingId === p.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-primary/30 text-primary hover:bg-primary/10 font-mono text-[10px] transition-all disabled:opacity-50"
                            >
                              {executingId === p.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Play className="w-3 h-3" />
                              )}
                              Execute
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Rationale */}
                      <div className="p-2.5 rounded-lg bg-secondary/20 border border-border/20 space-y-1">
                        <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                          Rationale
                        </p>
                        <p className="font-mono text-xs text-foreground/70 leading-relaxed">
                          {p.rationale}
                        </p>
                      </div>

                      {/* Proposed split content */}
                      {p.proposedContent &&
                        (() => {
                          let parts: string[] = [];
                          try {
                            parts = JSON.parse(p.proposedContent);
                          } catch {
                            parts = [p.proposedContent];
                          }
                          return (
                            <div className="space-y-1">
                              <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                                Proposed Split Parts
                              </p>
                              <div className="flex flex-col gap-1">
                                {parts.map((part, i) => (
                                  <div
                                    key={i}
                                    className="flex items-start gap-1.5 font-mono text-xs text-foreground/60"
                                  >
                                    <span className="text-primary/50 shrink-0">
                                      {i + 1}.
                                    </span>
                                    <span>{part}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                      {/* Proof hashes */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded-lg bg-secondary/10 border border-border/20 space-y-0.5">
                          <p className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-wider">
                            Rationale Hash (SHA-256)
                          </p>
                          <p className="font-mono text-[9px] text-foreground/30 break-all">
                            {p.rationaleHash}
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-secondary/10 border border-border/20 space-y-0.5">
                          <p className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-wider">
                            Proposal Proof (SHA-256)
                          </p>
                          <p className="font-mono text-[9px] text-foreground/30 break-all">
                            {p.proposalProof}
                          </p>
                        </div>
                      </div>

                      {/* Execution result */}
                      {execResult && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-lg border font-mono text-xs",
                            execResult.startsWith("Error") ||
                              execResult.startsWith("Approval failed")
                              ? "border-red-500/20 bg-red-500/5 text-red-400"
                              : "border-primary/20 bg-primary/5 text-primary",
                          )}
                        >
                          {execResult.startsWith("Error") ||
                          execResult.startsWith("Approval failed") ? (
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          )}
                          {execResult}
                        </motion.div>
                      )}

                      {/* Executed stamp */}
                      {p.status === "executed" && p.executedAt && (
                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-primary/60">
                          <CheckCircle2 className="w-3 h-3" />
                          Executed at {new Date(p.executedAt).toLocaleString()}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {loading && tab === "overview" && !stats && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
        </div>
      )}
    </div>
  );
}
