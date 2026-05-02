import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Node {
  id: string;
  label: string;
  short: string;
  x: number;
  y: number;
  type: "stateful" | "stateless";
  desc: string;
  tools: string[];
}

interface Edge {
  id: string;
  from: string;
  to: string;
  label: string;
  protocol: "kafka" | "rest" | "grpc" | "event" | "broadcast" | "feedback";
  speed: number;
  delay: number;
}

const NODES: Node[] = [
  {
    id: "ingestion",
    label: "Data Ingestion",
    short: "INGEST",
    x: 90,
    y: 100,
    type: "stateless",
    desc: "Distributed web crawlers and stream listeners. Modular connectors per source type. Stateless workers scale horizontally.",
    tools: ["Scrapy", "Nutch", "Kafka"],
  },
  {
    id: "compliance",
    label: "Compliance Layer",
    short: "COMPLY",
    x: 90,
    y: 290,
    type: "stateless",
    desc: "Inline gate between raw crawl and the knowledge store. Enforces robots.txt, rate limits, ethics mode, and domain blocklist.",
    tools: ["reppy", "aiohttp", "Redis"],
  },
  {
    id: "knowledge",
    label: "Knowledge Store",
    short: "STORE",
    x: 310,
    y: 195,
    type: "stateful",
    desc: "The persistent semantic memory. Hot/warm/cold tiered vector storage. All retrieval passes through here.",
    tools: ["Weaviate", "Qdrant", "FAISS"],
  },
  {
    id: "learning",
    label: "Learning Engine",
    short: "LEARN",
    x: 510,
    y: 100,
    type: "stateless",
    desc: "Passive indexing, active extraction, and deep synthesis modes. LoRA fine-tuning in isolated jobs.",
    tools: ["LangChain", "Axolotl", "Unsloth"],
  },
  {
    id: "character",
    label: "Character Engine",
    short: "CHAR",
    x: 510,
    y: 290,
    type: "stateful",
    desc: "Evolving persona state. Core traits are permanent. Surface traits allow bounded correction. Append-only history.",
    tools: ["Llama 3", "Mistral", "HF Transformers"],
  },
  {
    id: "config",
    label: "Config Manager",
    short: "CONFIG",
    x: 310,
    y: 360,
    type: "stateful",
    desc: "Live config watcher. Schema-validates every change. Broadcasts updates to all modules via Kafka events.",
    tools: ["Pydantic", "watchdog", "Kafka"],
  },
  {
    id: "metacog",
    label: "Meta-Cognitive",
    short: "META",
    x: 700,
    y: 100,
    type: "stateful",
    desc: "Self-improvement loop. Monitors gaps, sandboxes experiments, promotes improvements after benchmark pass.",
    tools: ["MLflow", "Docker", "Prometheus"],
  },
  {
    id: "api",
    label: "Action / API",
    short: "API",
    x: 700,
    y: 290,
    type: "stateless",
    desc: "Stateless REST + gRPC interface. Routes queries to knowledge store, inflects responses via character engine.",
    tools: ["FastAPI", "gRPC", "Redis"],
  },
];

const EDGES: Edge[] = [
  {
    id: "e1",
    from: "ingestion",
    to: "compliance",
    label: "raw crawl",
    protocol: "kafka",
    speed: 3,
    delay: 0,
  },
  {
    id: "e2",
    from: "compliance",
    to: "knowledge",
    label: "filtered stream",
    protocol: "kafka",
    speed: 2.8,
    delay: 0.5,
  },
  {
    id: "e3",
    from: "ingestion",
    to: "knowledge",
    label: "batch direct",
    protocol: "kafka",
    speed: 3.5,
    delay: 1.2,
  },
  {
    id: "e4",
    from: "knowledge",
    to: "learning",
    label: "document corpus",
    protocol: "grpc",
    speed: 2.5,
    delay: 0.3,
  },
  {
    id: "e5",
    from: "learning",
    to: "character",
    label: "persona delta",
    protocol: "event",
    speed: 4,
    delay: 0.8,
  },
  {
    id: "e6",
    from: "learning",
    to: "metacog",
    label: "perf metrics",
    protocol: "event",
    speed: 3.2,
    delay: 1.5,
  },
  {
    id: "e7",
    from: "metacog",
    to: "learning",
    label: "control signal",
    protocol: "feedback",
    speed: 5,
    delay: 2.1,
  },
  {
    id: "e8",
    from: "knowledge",
    to: "api",
    label: "RAG retrieval",
    protocol: "rest",
    speed: 2,
    delay: 0.6,
  },
  {
    id: "e9",
    from: "character",
    to: "api",
    label: "persona inflect",
    protocol: "rest",
    speed: 2.2,
    delay: 1.0,
  },
  {
    id: "e10",
    from: "config",
    to: "knowledge",
    label: "config broadcast",
    protocol: "broadcast",
    speed: 6,
    delay: 3.0,
  },
  {
    id: "e11",
    from: "config",
    to: "learning",
    label: "config broadcast",
    protocol: "broadcast",
    speed: 6,
    delay: 3.4,
  },
  {
    id: "e12",
    from: "config",
    to: "character",
    label: "config broadcast",
    protocol: "broadcast",
    speed: 6,
    delay: 3.8,
  },
];

const PROTOCOL_COLOR: Record<Edge["protocol"], string> = {
  kafka:     "#22d3ee",
  rest:      "#34d399",
  grpc:      "#a78bfa",
  event:     "#fb923c",
  broadcast: "#facc15",
  feedback:  "#f472b6",
};

const PROTOCOL_LABEL: Record<Edge["protocol"], string> = {
  kafka:     "Kafka",
  rest:      "REST",
  grpc:      "gRPC",
  event:     "Event",
  broadcast: "Broadcast",
  feedback:  "Feedback",
};

const NODE_W = 88;
const NODE_H = 38;

function getNodeCenter(node: Node) {
  return { cx: node.x + NODE_W / 2, cy: node.y + NODE_H / 2 };
}

function edgePath(from: Node, to: Node): string {
  const f = getNodeCenter(from);
  const t = getNodeCenter(to);
  const dx = t.cx - f.cx;
  const dy = t.cy - f.cy;
  // Slight cubic bezier curve
  const cx1 = f.cx + dx * 0.35;
  const cy1 = f.cy + dy * 0.1;
  const cx2 = f.cx + dx * 0.65;
  const cy2 = f.cy + dy * 0.9;
  return `M ${f.cx} ${f.cy} C ${cx1} ${cy1} ${cx2} ${cy2} ${t.cx} ${t.cy}`;
}

function AnimatedPacket({ path, color, speed, delay }: { path: string; color: string; speed: number; delay: number }) {
  return (
    <circle r="4" fill={color} opacity="0.9">
      <animateMotion
        dur={`${speed}s`}
        repeatCount="indefinite"
        begin={`${delay}s`}
        path={path}
        rotate="auto"
      />
    </circle>
  );
}

export default function KnowledgeGraph() {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]));
  const selectedNode = activeNode ? nodeMap[activeNode] : null;

  return (
    <div className="mt-16">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight mb-2">Module Communication Map</h2>
        <p className="text-muted-foreground font-mono text-sm">
          Live data flow between all 8 modules. Click any node for details.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Graph */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <svg
              viewBox="0 0 800 430"
              className="w-full"
              style={{ minHeight: 320 }}
            >
              {/* Background grid */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                </pattern>
                <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="hsl(230 25% 20%)" />
                </marker>
                {Object.entries(PROTOCOL_COLOR).map(([proto, color]) => (
                  <marker key={proto} id={`arrow-${proto}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill={color} opacity="0.6" />
                  </marker>
                ))}
              </defs>
              <rect width="800" height="430" fill="url(#grid)" />

              {/* Edges */}
              {EDGES.map(edge => {
                const fromNode = nodeMap[edge.from];
                const toNode = nodeMap[edge.to];
                if (!fromNode || !toNode) return null;
                const d = edgePath(fromNode, toNode);
                const color = PROTOCOL_COLOR[edge.protocol];
                const isHovered = hoveredEdge === edge.id;
                const isRelated = activeNode && (edge.from === activeNode || edge.to === activeNode);
                const isActive = isHovered || isRelated;

                return (
                  <g key={edge.id}>
                    {/* Invisible hit area */}
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="16"
                      onMouseEnter={() => setHoveredEdge(edge.id)}
                      onMouseLeave={() => setHoveredEdge(null)}
                      style={{ cursor: "pointer" }}
                    />
                    {/* Visible line */}
                    <path
                      d={d}
                      fill="none"
                      stroke={color}
                      strokeWidth={isActive ? 2 : 1}
                      strokeDasharray={edge.protocol === "broadcast" ? "5 4" : edge.protocol === "feedback" ? "3 3" : undefined}
                      opacity={isActive ? 0.9 : activeNode ? 0.15 : 0.35}
                      markerEnd={`url(#arrow-${edge.protocol})`}
                      style={{ transition: "opacity 0.2s, stroke-width 0.2s" }}
                    />
                    {/* Edge label on hover */}
                    {isHovered && (() => {
                      const fromC = getNodeCenter(fromNode);
                      const toC = getNodeCenter(toNode);
                      const mx = (fromC.cx + toC.cx) / 2;
                      const my = (fromC.cy + toC.cy) / 2;
                      return (
                        <g>
                          <rect x={mx - 38} y={my - 10} width={76} height={18} rx={4} fill="hsl(230 25% 9%)" stroke={color} strokeWidth="1" opacity="0.95" />
                          <text x={mx} y={my + 4} textAnchor="middle" fill={color} fontSize="9" fontFamily="monospace">{PROTOCOL_LABEL[edge.protocol]} · {edge.label}</text>
                        </g>
                      );
                    })()}
                    {/* Animated packet */}
                    <AnimatedPacket
                      path={d}
                      color={color}
                      speed={edge.speed}
                      delay={edge.delay}
                    />
                  </g>
                );
              })}

              {/* Nodes */}
              {NODES.map(node => {
                const isSelected = activeNode === node.id;
                const isDimmed = activeNode && !isSelected && !EDGES.some(e => e.from === activeNode && e.to === node.id || e.to === activeNode && e.from === node.id);
                const color = isSelected ? "#22d3ee" : node.type === "stateful" ? "#a78bfa" : "#64748b";
                return (
                  <g
                    key={node.id}
                    onClick={() => setActiveNode(activeNode === node.id ? null : node.id)}
                    style={{ cursor: "pointer" }}
                    opacity={isDimmed ? 0.25 : 1}
                  >
                    {/* Glow on selected */}
                    {isSelected && (
                      <rect
                        x={node.x - 3}
                        y={node.y - 3}
                        width={NODE_W + 6}
                        height={NODE_H + 6}
                        rx={9}
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth="1.5"
                        opacity="0.5"
                      />
                    )}
                    <rect
                      x={node.x}
                      y={node.y}
                      width={NODE_W}
                      height={NODE_H}
                      rx={6}
                      fill={isSelected ? "hsl(180 100% 45% / 0.15)" : "hsl(230 25% 9%)"}
                      stroke={color}
                      strokeWidth={isSelected ? 1.5 : 1}
                    />
                    <text
                      x={node.x + NODE_W / 2}
                      y={node.y + 14}
                      textAnchor="middle"
                      fill={isSelected ? "#22d3ee" : "#f8fafc"}
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                      letterSpacing="1"
                    >
                      {node.short}
                    </text>
                    <text
                      x={node.x + NODE_W / 2}
                      y={node.y + 27}
                      textAnchor="middle"
                      fill={color}
                      fontSize="7.5"
                      fontFamily="monospace"
                      opacity="0.8"
                    >
                      {node.type}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {selectedNode ? (
              <motion.div
                key={selectedNode.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="bg-card border border-primary/30 rounded-xl p-5 space-y-4"
              >
                <div>
                  <div className="font-mono text-xs text-primary uppercase tracking-wider mb-1">{selectedNode.type}</div>
                  <h3 className="font-bold text-lg">{selectedNode.label}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedNode.desc}</p>

                <div>
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Stack</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNode.tools.map(t => (
                      <span key={t} className="font-mono text-xs px-2 py-1 bg-secondary border border-border rounded text-muted-foreground">{t}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">Connections</p>
                  <div className="space-y-1.5">
                    {EDGES.filter(e => e.from === selectedNode.id || e.to === selectedNode.id).map(e => {
                      const isOut = e.from === selectedNode.id;
                      const other = nodeMap[isOut ? e.to : e.from];
                      const color = PROTOCOL_COLOR[e.protocol];
                      return (
                        <div key={e.id} className="flex items-center gap-2 font-mono text-xs">
                          <span style={{ color }} className="w-14 shrink-0">{PROTOCOL_LABEL[e.protocol]}</span>
                          <span className="text-muted-foreground">{isOut ? "→" : "←"}</span>
                          <span className="text-foreground">{other?.label}</span>
                          <span className="text-muted-foreground/50 truncate">({e.label})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card/40 border border-dashed border-border rounded-xl p-5 text-center"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                  <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                </div>
                <p className="font-mono text-sm text-muted-foreground">Click any module node to inspect its connections and stack.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Legend */}
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3">Protocol legend</p>
            <div className="space-y-2">
              {(Object.entries(PROTOCOL_COLOR) as [Edge["protocol"], string][]).map(([proto, color]) => (
                <div key={proto} className="flex items-center gap-2">
                  <div className="flex items-center gap-1 w-28">
                    <svg width="32" height="8">
                      <line
                        x1="0" y1="4" x2="28" y2="4"
                        stroke={color}
                        strokeWidth="1.5"
                        strokeDasharray={proto === "broadcast" ? "4 3" : proto === "feedback" ? "2 2" : undefined}
                      />
                    </svg>
                    <span className="font-mono text-xs" style={{ color }}>{PROTOCOL_LABEL[proto]}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {proto === "kafka" && "Async message queue"}
                    {proto === "rest" && "HTTP request/response"}
                    {proto === "grpc" && "Low-latency RPC"}
                    {proto === "event" && "Internal event stream"}
                    {proto === "broadcast" && "Config fan-out"}
                    {proto === "feedback" && "Control loop return"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded border border-violet-400/60 bg-violet-400/10" />
                <span className="font-mono text-xs text-muted-foreground">stateful — holds persistent state</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded border border-slate-500/60 bg-slate-500/10" />
                <span className="font-mono text-xs text-muted-foreground">stateless — horizontally scalable</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
