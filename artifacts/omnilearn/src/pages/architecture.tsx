import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Database,
  BrainCircuit,
  Globe,
  Activity,
  Shield,
  Code,
  Server,
  Zap,
  Terminal,
  Brain,
  Radio,
} from "lucide-react";
import KnowledgeGraph from "@/components/knowledge-graph";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SystemSnapshot {
  knowledge: { nodeCount: number; edgeCount: number; logCount: number } | null;
  network: {
    neurons: number;
    synapses: number;
    health: number;
    agents: number;
  } | null;
  ghost: { total: number; online: number; totalTasksProcessed: number } | null;
  character: {
    totalInteractions: number;
    curiosity: number;
    empathy: number;
  } | null;
}

function LiveSystemStats() {
  const [snap, setSnap] = useState<SystemSnapshot>({
    knowledge: null,
    network: null,
    ghost: null,
    character: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/api/omni/knowledge/stats`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${BASE}/api/network/stats`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${BASE}/api/ghost/status`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${BASE}/api/omni/character`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([knowledge, network, ghost, character]) => {
      setSnap({ knowledge, network, ghost, character });
      setLoading(false);
    });
  }, []);

  const stats = [
    {
      icon: Database,
      label: "Knowledge nodes",
      value: snap.knowledge ? snap.knowledge.nodeCount.toLocaleString() : "—",
      sub: snap.knowledge
        ? `${snap.knowledge.edgeCount.toLocaleString()} edges · ${snap.knowledge.logCount} events`
        : "fetching…",
      color: "#22d3ee",
    },
    {
      icon: Brain,
      label: "Neural neurons",
      value: snap.network ? snap.network.neurons.toLocaleString() : "—",
      sub: snap.network
        ? `${snap.network.synapses} synapses · ${snap.network.agents} agents`
        : "fetching…",
      color: "#a78bfa",
    },
    {
      icon: Radio,
      label: "Ghost nodes",
      value: snap.ghost ? `${snap.ghost.online}/${snap.ghost.total}` : "—",
      sub: snap.ghost
        ? `online/registered · ${snap.ghost.totalTasksProcessed} tasks processed`
        : "fetching…",
      color: "#34d399",
    },
    {
      icon: Activity,
      label: "Interactions",
      value: snap.character
        ? snap.character.totalInteractions.toLocaleString()
        : "—",
      sub: snap.character
        ? `curiosity ${snap.character.curiosity.toFixed(1)} · empathy ${snap.character.empathy.toFixed(1)}`
        : "fetching…",
      color: "#fb923c",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9 }}
      className="mt-10 mb-8"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
          Live system state
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                {s.label}
              </span>
            </div>
            <div
              className="font-mono text-2xl font-bold mb-1"
              style={{ color: loading ? "hsl(215 20.2% 35%)" : s.color }}
            >
              {loading ? "…" : s.value}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {loading ? "fetching…" : s.sub}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

const ARCH_MODULES = [
  {
    id: "1",
    name: "Data Ingestion",
    type: "Stateless",
    icon: Globe,
    tools: ["Scrapy", "Apache Nutch"],
  },
  {
    id: "2",
    name: "Knowledge Store",
    type: "Stateful",
    icon: Database,
    tools: ["Chroma", "Weaviate"],
  },
  {
    id: "3",
    name: "Learning Engine",
    type: "Stateless",
    icon: BrainCircuit,
    tools: ["LangChain", "Axolotl"],
  },
  {
    id: "4",
    name: "Character Engine",
    type: "Stateful",
    icon: Activity,
    tools: ["Llama 3", "Mistral"],
  },
  {
    id: "5",
    name: "Configuration Mgr",
    type: "Stateful",
    icon: Server,
    tools: ["Docker", "Kubernetes"],
  },
  {
    id: "6",
    name: "Action/API Intf",
    type: "Stateless",
    icon: Code,
    tools: ["FastAPI", "RabbitMQ"],
  },
  {
    id: "7",
    name: "Meta-Cognitive Ctrl",
    type: "Stateful",
    icon: Zap,
    tools: ["MLflow", "TensorBoard"],
  },
  {
    id: "8",
    name: "Compliance Layer",
    type: "Stateless",
    icon: Shield,
    tools: ["Custom Guardrails"],
  },
];

export default function Architecture() {
  return (
    <div className="p-6 md:p-12 max-w-6xl mx-auto min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          System Architecture
        </h1>
        <p className="text-xl text-muted-foreground font-mono">
          Data flow from "URL discovered" → "personality-inflected answer."
        </p>
      </motion.div>

      <div className="relative">
        {/* Connecting line background */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-border -translate-y-1/2 hidden md:block z-0" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
          {ARCH_MODULES.map((mod, i) => (
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="p-6 h-full bg-card/80 backdrop-blur border-border hover:border-primary/50 transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-primary/10 rounded-lg text-primary">
                    <mod.icon className="w-6 h-6" />
                  </div>
                  <Badge
                    variant={mod.type === "Stateful" ? "default" : "secondary"}
                    className="font-mono text-[10px]"
                  >
                    {mod.type}
                  </Badge>
                </div>

                <h3 className="font-bold text-lg mb-2">{mod.name}</h3>
                <div className="flex flex-wrap gap-2 mt-4">
                  {mod.tools.map((tool) => (
                    <span
                      key={tool}
                      className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-16 p-8 bg-primary/5 border border-primary/20 rounded-xl"
      >
        <h2 className="text-2xl font-bold mb-4">Data Flow Topology</h2>
        <div className="flex flex-col md:flex-row items-center justify-between text-sm font-mono text-muted-foreground">
          <div className="p-4 bg-card border border-border rounded-lg text-center w-full md:w-auto">
            <Globe className="w-5 h-5 mx-auto mb-2 text-primary" />
            URL Discovered
          </div>
          <ArrowRight className="w-6 h-6 my-4 md:my-0 text-primary animate-pulse" />
          <div className="p-4 bg-card border border-border rounded-lg text-center w-full md:w-auto">
            <Database className="w-5 h-5 mx-auto mb-2 text-primary" />
            Vectorized & Stored
          </div>
          <ArrowRight className="w-6 h-6 my-4 md:my-0 text-primary animate-pulse" />
          <div className="p-4 bg-card border border-border rounded-lg text-center w-full md:w-auto">
            <Activity className="w-5 h-5 mx-auto mb-2 text-primary" />
            Personality Applied
          </div>
          <ArrowRight className="w-6 h-6 my-4 md:my-0 text-primary animate-pulse" />
          <div className="p-4 bg-card border border-primary/50 glow-border rounded-lg text-center w-full md:w-auto text-primary">
            <Terminal className="w-5 h-5 mx-auto mb-2" />
            Output Generated
          </div>
        </div>
      </motion.div>

      <LiveSystemStats />
      <KnowledgeGraph />
    </div>
  );
}
