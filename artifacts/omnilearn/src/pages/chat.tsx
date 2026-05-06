import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Server, Ghost, Plus, Trash2, Bot, User, Loader2,
  Wrench, Search, Code, Brain, Globe, Shield, ChevronRight,
  X, Sparkles, MessageSquare, Zap, FileText, Database,
  CheckCircle2, XCircle, ArrowRight, Activity, ChevronDown, BookOpen, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useSearch, useLocation } from "wouter";

// Use Railway API URL directly (Vercel proxy unreliable)
const BASE = import.meta.env.VITE_API_URL || import.meta.env.BASE_URL.replace(/\/$/, "");

type Mode = "local" | "ghost" | "native";
type Role = "user" | "assistant";

interface Message {
  id: number;
  role: Role;
  content: string;
  createdAt: string;
  meta?: {
    nodesUsed?: number;
    newNodesAdded?: number;
    nodeId?: number;
    nodeName?: string;
    processingMs?: number;
    routed?: boolean;
    local?: boolean;
  };
}

interface Conversation {
  id: number;
  title: string;
  mode: Mode;
  createdAt: string;
}

interface Skill {
  id: number;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  category: string;
  isBuiltIn: boolean;
  isInstalled: boolean;
}

interface GhostStatus {
  total: number;
  online: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Search, Code, Brain, Globe, Shield, Wrench, Zap, FileText, Database, Sparkles,
};

function isOnboarded() {
  return true;
}

const SKILL_CATALOG: Omit<Skill, "id" | "createdAt" | "isInstalled">[] = [
  {
    name: "Web Search",
    description: "Search the internet for real-time information and current events.",
    icon: "Search",
    systemPrompt: "You have access to web search capabilities. When relevant, reason about what you would find if you searched the web, and synthesise results clearly.",
    category: "Research",
    isBuiltIn: true,
  },
  {
    name: "Code Interpreter",
    description: "Write, explain, debug, and reason through code in any language.",
    icon: "Code",
    systemPrompt: "You are an expert programmer. When asked about code, write clean, well-commented solutions and explain your reasoning step by step.",
    category: "Engineering",
    isBuiltIn: true,
  },
  {
    name: "Deep Memory",
    description: "Recall and synthesise knowledge from the agent's long-term memory store.",
    icon: "Brain",
    systemPrompt: "You have access to deep memory recall. Reference prior conversations and stored knowledge when constructing answers. Prioritise memory-grounded responses.",
    category: "Memory",
    isBuiltIn: true,
  },
  {
    name: "Compliance Filter",
    description: "Apply PII detection, ethics governance, and compliance rules to all outputs.",
    icon: "Shield",
    systemPrompt: "Apply strict compliance rules: detect and redact PII, follow ethical guidelines, flag content that may violate privacy or copyright. Always explain compliance decisions.",
    category: "Safety",
    isBuiltIn: true,
  },
  {
    name: "Document Analyst",
    description: "Summarise, extract structured data, and reason about documents.",
    icon: "FileText",
    systemPrompt: "You specialise in document analysis. Extract key entities, summarise content hierarchically, and produce structured outputs (tables, bullets, schemas) from unstructured text.",
    category: "Research",
    isBuiltIn: true,
  },
  {
    name: "Knowledge Ingestion",
    description: "Analyse URLs and sources for metadata-first ingestion into the knowledge store.",
    icon: "Database",
    systemPrompt: "You assist with knowledge ingestion. Evaluate sources for license tier, PII risk, and crawl priority. Produce structured ingestion reports.",
    category: "Data",
    isBuiltIn: true,
  },
];

function SkillIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICON_MAP[icon] ?? Wrench;
  return <Icon className={className} />;
}

function MarkdownContent({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const code = part.replace(/^```\w*\n?/, "").replace(/```$/, "");
          return (
            <pre key={i} className="bg-black/40 border border-border/40 rounded-md p-3 overflow-x-auto font-mono text-xs text-primary/90">
              <code>{code}</code>
            </pre>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="bg-black/30 text-primary/80 rounded px-1 py-0.5 font-mono text-xs">
              {part.slice(1, -1)}
            </code>
          );
        }
        return (
          <span key={i} className="whitespace-pre-wrap">
            {part.split(/(\*\*[^*]+\*\*)/g).map((seg, j) => {
              if (seg.startsWith("**") && seg.endsWith("**")) {
                return <strong key={j} className="text-foreground font-semibold">{seg.slice(2, -2)}</strong>;
              }
              return <span key={j}>{seg}</span>;
            })}
          </span>
        );
      })}
    </div>
  );
}

export default function Chat() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const initialMode = ((): Mode => {
    const p = new URLSearchParams(search).get("mode");
    if (p === "native") return "native";
    if (p === "ghost" || p === "local") return p as Mode;
    return "native";
  })();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(() => {
    const s = localStorage.getItem("omni_conv_local"); return s ? parseInt(s, 10) : null;
  });
  const [nativeConvId, setNativeConvId] = useState<number | null>(() => {
    const s = localStorage.getItem("omni_conv_native"); return s ? parseInt(s, 10) : null;
  });
  const [ghostConvId, setGhostConvId] = useState<number | null>(() => {
    const s = localStorage.getItem("omni_conv_ghost"); return s ? parseInt(s, 10) : null;
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streamingSession, setStreamingSession] = useState<Mode | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showSkillCreator, setShowSkillCreator] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: "", description: "", icon: "Wrench", systemPrompt: "", category: "Custom" });
  const [loadingConv, setLoadingConv] = useState(false);
  const [latestMeta, setLatestMeta] = useState<Message["meta"] | null>(null);
  const [onboarded, setOnboarded] = useState(() => isOnboarded());
  const [modeOpen, setModeOpen] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [tasksContributed, setTasksContributed] = useState(() =>
    parseInt(localStorage.getItem("omni_tasks_contributed") || "0", 10)
  );
  const [ghostStatus, setGhostStatus] = useState<GhostStatus | null>(null);
  const [ghostRouting, setGhostRouting] = useState<{ nodeName: string; region: string } | null>(null);
  const [ghostFallback, setGhostFallback] = useState(false);
  const [webActivity, setWebActivity] = useState<{ type: "searching" | "fetching"; payload: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modeInitialized = useRef(false);

  const installedSkillIds = skills.filter(s => s.isInstalled).map(s => s.id);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages, streamingContent]);

  useEffect(() => {
    if (nativeConvId != null) localStorage.setItem("omni_conv_native", String(nativeConvId));
    else localStorage.removeItem("omni_conv_native");
  }, [nativeConvId]);
  useEffect(() => {
    if (ghostConvId != null) localStorage.setItem("omni_conv_ghost", String(ghostConvId));
    else localStorage.removeItem("omni_conv_ghost");
  }, [ghostConvId]);
  useEffect(() => {
    if (activeConvId != null) localStorage.setItem("omni_conv_local", String(activeConvId));
    else localStorage.removeItem("omni_conv_local");
  }, [activeConvId]);

  useEffect(() => {
    fetchConversations();
    fetchSkills();
    fetchGhostStatus();
    const savedNative = localStorage.getItem("omni_conv_native");
    const savedGhost  = localStorage.getItem("omni_conv_ghost");
    const savedLocal  = localStorage.getItem("omni_conv_local");
    if (initialMode === "native" && savedNative) loadConversationById(parseInt(savedNative, 10));
    else if (initialMode === "ghost" && savedGhost) loadConversationById(parseInt(savedGhost, 10));
    else if (initialMode === "local" && savedLocal) loadConversationById(parseInt(savedLocal, 10));
  }, []);

  // Idle CPU contribution — when onboarded and not actively chatting, donate cycles to the ghost network
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const contribute = async () => {
      if (streamingSession !== null) return;
      setContributing(true);
      try {
        const res = await fetch(`${BASE}/api/ghost/contribute`, { method: "POST" });
        if (res.ok) {
          const data = await res.json() as { processed: boolean };
          if (data.processed) {
            setTasksContributed(prev => {
              const next = prev + 1;
              localStorage.setItem("omni_tasks_contributed", String(next));
              return next;
            });
          }
        }
      } catch { /* silent */ } finally {
        setContributing(false);
      }
      timer = setTimeout(contribute, 30_000);
    };
    timer = setTimeout(contribute, 30_000);
    return () => clearTimeout(timer);
  }, [onboarded, streamingSession]);

  useEffect(() => {
    if (!modeInitialized.current) { modeInitialized.current = true; return; }
    setMessages([]);
    setLatestMeta(null);
    setGhostRouting(null);
    setGhostFallback(false);
    setWebActivity(null);
    const savedNative = localStorage.getItem("omni_conv_native");
    const savedGhost  = localStorage.getItem("omni_conv_ghost");
    const savedLocal  = localStorage.getItem("omni_conv_local");
    if (mode === "native" && savedNative) loadConversationById(parseInt(savedNative, 10));
    else if (mode === "ghost" && savedGhost) loadConversationById(parseInt(savedGhost, 10));
    else if (mode === "local" && savedLocal) loadConversationById(parseInt(savedLocal, 10));
  }, [mode]);

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${BASE}/api/anthropic/conversations`);
      if (res.ok) setConversations(await res.json());
    } catch { /* offline */ }
  };

  const fetchSkills = async () => {
    try {
      const res = await fetch(`${BASE}/api/skills`);
      if (res.ok) setSkills(await res.json());
    } catch { /* offline */ }
  };

  const fetchGhostStatus = async () => {
    try {
      const res = await fetch(`${BASE}/api/ghost/status`);
      if (res.ok) {
        const data = await res.json();
        setGhostStatus({ total: data.total, online: data.online });
      }
    } catch { /* offline */ }
  };

  const loadConversationById = async (id: number) => {
    setLoadingConv(true);
    try {
      const res = await fetch(`${BASE}/api/anthropic/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        const m = data.mode as Mode;
        if (m === "native") setNativeConvId(id);
        else if (m === "ghost") setGhostConvId(id);
        else setActiveConvId(id);
      }
    } catch { /* offline */ } finally {
      setLoadingConv(false);
    }
  };

  const loadConversation = async (id: number) => {
    setLoadingConv(true);
    try {
      const res = await fetch(`${BASE}/api/anthropic/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        const m = data.mode as Mode;
        setMode(m);
        if (m === "native") setNativeConvId(id);
        else if (m === "ghost") setGhostConvId(id);
        else setActiveConvId(id);
      }
    } finally {
      setLoadingConv(false);
    }
  };

  const createConversation = async (firstMessage = "") => {
    const title = firstMessage.slice(0, 60) || "New conversation";
    const res = await fetch(`${BASE}/api/anthropic/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, mode }),
    });
    if (!res.ok) throw new Error("Failed to create conversation");
    const conv: Conversation = await res.json();
    setConversations(prev => [conv, ...prev]);
    setMessages([]);
    setStreamingContent("");
    setLatestMeta(null);
    setWebActivity(null);
    setGhostRouting(null);
    setGhostFallback(false);
    if (mode === "native") setNativeConvId(conv.id);
    if (mode === "ghost") setGhostConvId(conv.id);
    if (mode === "local") setActiveConvId(conv.id);
    return conv.id;
  };

  const gatedModeOptions = [
    { value: "native" as const, label: "Native", icon: "native" },
    { value: "ghost" as const, label: "Ghost", icon: "ghost" },
    { value: "local" as const, label: "Local", icon: "local" },
  ];

  const deleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`${BASE}/api/anthropic/conversations/${id}`, { method: "DELETE" });
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) { setActiveConvId(null); setMessages([]); }
    if (nativeConvId === id) { setNativeConvId(null); setMessages([]); }
    if (ghostConvId === id) { setGhostConvId(null); setMessages([]); }
  };

  // ── Native mode send ──────────────────────────────────────────────────────
  const sendNativeMessage = useCallback(async (content: string) => {
    const tempUserMsg: Message = { id: Date.now(), role: "user", content, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, tempUserMsg]);
    setStreamingSession("native");
    setStreamingContent("");
    setLatestMeta(null);
    setWebActivity(null);

    try {
      let convId = nativeConvId;
      if (!convId) convId = await createConversation();
      const res = await fetch(`${BASE}/api/omni/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, conversationId: convId }),
      });
      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let meta: Message["meta"] | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.conversationId && !nativeConvId) setNativeConvId(json.conversationId);
            if (json.searching) setWebActivity({ type: "searching", payload: json.searching });
            if (json.fetching)  setWebActivity({ type: "fetching",  payload: json.fetching });
            if (json.searchDone || json.fetchDone) setWebActivity(null);
            if (json.content) { full += json.content; setStreamingContent(full); setWebActivity(null); }
            if (json.meta) meta = json.meta;
            if (json.done) {
              setMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: full, createdAt: new Date().toISOString(), meta: meta ?? undefined }]);
              setStreamingContent("");
              setWebActivity(null);
              if (meta) setLatestMeta(meta);
            }
          } catch { /* parse error */ }
        }
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now() + 2, role: "assistant", content: "Connection error. Make sure the API server is running.", createdAt: new Date().toISOString() }]);
      setStreamingContent("");
    } finally {
      setStreamingSession(null);
    }
  }, [nativeConvId, createConversation]);

  // ── Ghost mode send ───────────────────────────────────────────────────────
  const sendGhostMessage = useCallback(async (content: string) => {
    const tempUserMsg: Message = { id: Date.now(), role: "user", content, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, tempUserMsg]);
    setStreamingSession("ghost");
    setStreamingContent("");
    setLatestMeta(null);
    setGhostRouting(null);
    setGhostFallback(false);

    try {
      const res = await fetch(`${BASE}/api/ghost/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, conversationId: ghostConvId }),
      });
      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let meta: Message["meta"] | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.conversationId && !ghostConvId) setGhostConvId(json.conversationId);
            if (json.routing) setGhostRouting({ nodeName: json.routing.nodeName, region: json.routing.region });
            if (json.noNodes || json.fallback) { setGhostFallback(true); setGhostRouting(null); }
            if (json.content) { full += json.content; setStreamingContent(full); }
            if (json.meta) meta = json.meta;
            if (json.done) {
              const finalMeta = meta ?? undefined;
              setMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: full, createdAt: new Date().toISOString(), meta: finalMeta }]);
              setStreamingContent("");
              if (finalMeta) setLatestMeta(finalMeta);
              setGhostRouting(null);
            }
          } catch { /* parse error */ }
        }
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now() + 2, role: "assistant", content: "Connection error. Make sure the API server is running.", createdAt: new Date().toISOString() }]);
      setStreamingContent("");
    } finally {
      setStreamingSession(null);
    }
  }, [ghostConvId]);

  // ── Local mode send (knowledge graph only, NO web search) ─────────────────
  const sendLocalMessage = useCallback(async (content: string) => {
    const tempUserMsg: Message = { id: Date.now(), role: "user", content, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, tempUserMsg]);
    setStreamingSession("local");
    setStreamingContent("");

    try {
      let convId = activeConvId;
      if (!convId) convId = await createConversation();

      const res = await fetch(`${BASE}/api/local/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, conversationId: convId }),
      });
      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.content) { full += json.content; setStreamingContent(full); }
            if (json.done) {
              setMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: full, createdAt: new Date().toISOString() }]);
              setStreamingContent("");
            }
          } catch { /* parse error */ }
        }
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now() + 2, role: "assistant", content: "Connection error. Make sure the API server is running.", createdAt: new Date().toISOString() }]);
      setStreamingContent("");
    } finally {
      setStreamingSession(null);
    }
  }, [activeConvId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streamingSession !== null) return;
    const content = input.trim();
    setInput("");
    if (mode === "native") await sendNativeMessage(content);
    else if (mode === "ghost") await sendGhostMessage(content);
    else await sendLocalMessage(content);  // Local mode: knowledge graph only
  }, [input, streamingSession, mode, sendNativeMessage, sendGhostMessage, sendLocalMessage]);

  const installSkill = async (catalog: typeof SKILL_CATALOG[0]) => {
    const res = await fetch(`${BASE}/api/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...catalog, isInstalled: true }),
    });
    if (res.ok) { const skill: Skill = await res.json(); setSkills(prev => [...prev, skill]); }
  };

  const removeSkill = async (id: number) => {
    await fetch(`${BASE}/api/skills/${id}`, { method: "DELETE" });
    setSkills(prev => prev.filter(s => s.id !== id));
  };

  const createCustomSkill = async () => {
    if (!newSkill.name || !newSkill.systemPrompt) return;
    const res = await fetch(`${BASE}/api/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newSkill, isBuiltIn: false, isInstalled: true }),
    });
    if (res.ok) {
      const skill: Skill = await res.json();
      setSkills(prev => [...prev, skill]);
      setNewSkill({ name: "", description: "", icon: "Wrench", systemPrompt: "", category: "Custom" });
      setShowSkillCreator(false);
    }
  };

  const uninstalledCatalog = SKILL_CATALOG.filter(c => !skills.some(s => s.name === c.name));

  const MODE_CONFIG = {
    local:  { label: "Local",  desc: "Knowledge graph, no internet",  icon: Server, color: "text-primary",    activeBg: "bg-primary/10 border-primary/30",    badge: "bg-primary/10 border-primary/20 text-primary" },
    ghost:  { label: "Ghost",  desc: "Routes to remote nodes",        icon: Ghost,  color: "text-violet-400", activeBg: "bg-violet-500/10 border-violet-500/30", badge: "bg-violet-500/10 border-violet-500/20 text-violet-400" },
    native: { label: "Native", desc: "Live web search + learning",    icon: Brain,  color: "text-emerald-400",activeBg: "bg-emerald-500/10 border-emerald-500/30", badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
  };

  const activeCfg = MODE_CONFIG[mode];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Conversation sidebar ── */}
      <div className="hidden md:flex w-56 border-r border-border/40 bg-card/30 flex-col shrink-0">
        <div className="px-4 py-4 border-b border-border/40">

          {/* Mode accordion */}
          <div className="mb-3">
            <button
              onClick={() => setModeOpen(o => !o)}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all", activeCfg.activeBg)}
            >
              <activeCfg.icon className={cn("w-3.5 h-3.5 shrink-0", activeCfg.color)} />
              <div className="flex-1 text-left">
                <p className={cn("font-mono text-xs font-semibold leading-none", activeCfg.color)}>{activeCfg.label}</p>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{activeCfg.desc}</p>
              </div>
              <ChevronDown className={cn("w-3.5 h-3.5 shrink-0 transition-transform duration-200", activeCfg.color, modeOpen ? "rotate-180" : "")} />
            </button>

            <AnimatePresence>
              {modeOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.16 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1 space-y-1">
                    {(["native", "local", "ghost"] as Mode[]).filter(m => m !== mode).map(m => {
                      const cfg = MODE_CONFIG[m];
                      const Icon = cfg.icon;
                      const locked = false;
                      return (
                        <button key={m}
                          onClick={() => {
                            if (locked) { navigate("/onboarding"); setModeOpen(false); return; }
                            setMode(m); setModeOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all",
                            locked
                              ? "border-border/20 text-muted-foreground/40 hover:border-border/40 hover:text-muted-foreground/60"
                              : "border-border/30 text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <div className="flex-1 text-left">
                            <p className="font-mono text-xs font-medium leading-none">{cfg.label}</p>
                            <p className={cn("font-mono text-[10px] mt-0.5", locked ? "text-muted-foreground/30" : "text-muted-foreground/60")}>
                              {cfg.desc}
                            </p>
                          </div>
                          {locked && <Lock className="w-3 h-3 shrink-0 text-muted-foreground/25" />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {mode === "ghost" && (
            <button onClick={() => { setGhostConvId(null); setMessages([]); setGhostRouting(null); setGhostFallback(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 font-mono text-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> New ghost session
            </button>
          )}
          {mode !== "native" && mode !== "ghost" && (
            <button onClick={() => { setActiveConvId(null); setMessages([]); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-primary/30 text-primary hover:bg-primary/10 font-mono text-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> New chat
            </button>
          )}
          {mode === "native" && (
            <button onClick={() => { setNativeConvId(null); setMessages([]); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-mono text-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> New session
            </button>
          )}
        </div>

        {/* Sidebar content per mode */}
        {mode === "local" && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.filter(c => c.mode === "local").length === 0
              ? <p className="text-muted-foreground/40 font-mono text-xs px-2 py-4 text-center">No conversations yet</p>
              : conversations.filter(c => c.mode === "local").map(conv => (
                <div key={conv.id} onClick={() => loadConversation(conv.id)} role="button" tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && loadConversation(conv.id)}
                  className={cn("w-full flex items-center gap-2 px-2 py-2 rounded-md text-left group transition-all cursor-pointer",
                    activeConvId === conv.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                  )}
                >
                  <MessageSquare className="w-3 h-3 shrink-0" />
                  <span className="font-mono text-xs truncate flex-1">{conv.title}</span>
                  <button onClick={(e) => deleteConversation(conv.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            }
          </div>
        )}

        {mode === "ghost" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">History</p>
            {conversations.filter(c => c.mode === "ghost").length > 0 && (
              <div className="space-y-1">
                {conversations.filter(c => c.mode === "ghost").map(conv => (
                  <div key={conv.id} onClick={() => loadConversation(conv.id)} role="button" tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && loadConversation(conv.id)}
                    className={cn("w-full flex items-center gap-2 px-2 py-2 rounded-md text-left group transition-all cursor-pointer",
                      ghostConvId === conv.id ? "bg-violet-500/10 text-violet-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                    )}
                  >
                    <MessageSquare className="w-3 h-3 shrink-0" />
                    <span className="font-mono text-xs truncate flex-1">{conv.title}</span>
                    <button onClick={(e) => deleteConversation(conv.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">Ghost Mode</p>

            {/* Network status */}
            {ghostStatus !== null && (
              <div className={cn(
                "p-2.5 rounded-lg border space-y-1.5",
                ghostStatus.online > 0
                  ? "border-violet-500/20 bg-violet-500/5"
                  : "border-yellow-500/20 bg-yellow-500/5"
              )}>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Network</p>
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0",
                    ghostStatus.online > 0 ? "bg-emerald-400 animate-pulse" : "bg-yellow-400/60"
                  )} />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {ghostStatus.online} / {ghostStatus.total} node{ghostStatus.total !== 1 ? "s" : ""} online
                  </span>
                </div>
              </div>
            )}

            {/* No nodes warning */}
            {ghostStatus !== null && ghostStatus.total === 0 && (
              <div className="p-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 space-y-2">
                <p className="font-mono text-[10px] text-yellow-400/80 leading-relaxed">
                  No ghost nodes registered. Messages will fall back to Omni running locally.
                </p>
                <Link href="/ghost-network" className="flex items-center gap-1 font-mono text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
                  Set up nodes <ArrowRight className="w-2.5 h-2.5" />
                </Link>
              </div>
            )}

            {/* Routing indicator */}
            {ghostRouting && streamingSession === "ghost" && (
              <div className="p-2.5 rounded-lg border border-violet-500/20 bg-violet-500/5 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-violet-400 animate-pulse" />
                  <p className="font-mono text-[10px] text-violet-400">Routing to node</p>
                </div>
                <p className="font-mono text-[10px] text-foreground font-bold">{ghostRouting.nodeName}</p>
                {ghostRouting.region !== "unknown" && (
                  <p className="font-mono text-[10px] text-muted-foreground/60">{ghostRouting.region}</p>
                )}
              </div>
            )}

            {/* Fallback indicator */}
            {ghostFallback && (
              <div className="p-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
                <p className="font-mono text-[10px] text-yellow-400 leading-relaxed">
                  Ghost nodes unreachable. Processing locally via Omni.
                </p>
              </div>
            )}

            {/* Latest response meta */}
            {latestMeta && (
              <div className="p-2.5 rounded-lg border border-violet-500/20 bg-violet-500/5 space-y-1.5">
                <p className="font-mono text-[10px] text-violet-400 uppercase tracking-wider">Last Response</p>
                <div className="font-mono text-[10px] text-muted-foreground space-y-0.5">
                  {latestMeta.nodeName && <p>Node: {latestMeta.nodeName}</p>}
                  {latestMeta.processingMs && <p>Time: {Math.round(latestMeta.processingMs)}ms</p>}
                  {latestMeta.routed === false && <p className="text-yellow-400/70">Ran locally (fallback)</p>}
                  {latestMeta.routed === true && (
                    <div className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>Distributed</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Link href="/ghost-network"
              className="flex items-center gap-1.5 font-mono text-xs text-violet-400/60 hover:text-violet-400 transition-colors"
            >
              <Ghost className="w-3 h-3" /> Manage nodes
            </Link>
          </div>
        )}

        {mode === "native" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3 flex flex-col">
            {/* Conversation history */}
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 px-1">History</p>
              {conversations.filter(c => c.mode === "native").length === 0
                ? <p className="text-muted-foreground/40 font-mono text-xs px-1 py-2 text-center">No sessions yet</p>
                : conversations.filter(c => c.mode === "native").map(conv => (
                  <div key={conv.id} onClick={() => loadConversation(conv.id)} role="button" tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && loadConversation(conv.id)}
                    className={cn("w-full flex items-center gap-2 px-2 py-2 rounded-md text-left group transition-all cursor-pointer",
                      nativeConvId === conv.id ? "bg-emerald-500/10 text-emerald-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                    )}
                  >
                    <MessageSquare className="w-3 h-3 shrink-0" />
                    <span className="font-mono text-xs truncate flex-1">{conv.title}</span>
                    <button onClick={(e) => deleteConversation(conv.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              }
            </div>
            <div className="border-t border-border/20 pt-3 space-y-2">
              {latestMeta && (
                <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                  <p className="font-mono text-[10px] text-emerald-400 uppercase tracking-wider">Last Response</p>
                  <div className="font-mono text-[10px] text-muted-foreground space-y-0.5">
                    <p>Nodes used: {latestMeta.nodesUsed ?? 0}</p>
                    <p>New learned: {latestMeta.newNodesAdded ?? 0}</p>
                  </div>
                </div>
              )}
              <Link href="/intelligence"
                className="flex items-center gap-1.5 font-mono text-xs text-primary/60 hover:text-primary transition-colors"
              >
                <Brain className="w-3 h-3" /> View knowledge base
              </Link>
            </div>
          </div>
        )}

        {/* Network contribution footer */}
        <div className="px-3 py-3 border-t border-border/30 shrink-0">
          <div className={cn(
            "flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all duration-500",
            contributing
              ? "bg-cyan-500/10 border-cyan-500/20"
              : "bg-secondary/10 border-border/20"
          )}>
            {contributing ? (
              <>
                <Activity className="w-3 h-3 text-cyan-400 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[10px] text-cyan-400 leading-none">Processing network task</p>
                  <p className="font-mono text-[9px] text-cyan-400/50 mt-0.5">contributing idle cycles</p>
                </div>
              </>
            ) : (
              <>
                <Zap className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[10px] text-muted-foreground/40 leading-none">
                    {tasksContributed > 0
                      ? `${tasksContributed} task${tasksContributed !== 1 ? "s" : ""} contributed`
                      : "Network contributor"}
                  </p>
                  <p className="font-mono text-[9px] text-muted-foreground/25 mt-0.5">idle cycles → ghost network</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-3 border-b border-border/40 flex items-center justify-between bg-card/20 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-primary" />
            <span className="font-mono text-sm font-bold text-foreground">
              {mode === "native" ? "OmniLearn Native" : mode === "ghost" ? "OmniLearn Ghost" : "OmniLearn Agent"}
            </span>
            <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-mono", activeCfg.badge)}>
              <activeCfg.icon className="w-3 h-3" />
              {activeCfg.label}
            </div>
            {mode === "ghost" && ghostStatus && ghostStatus.online > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {ghostStatus.online} node{ghostStatus.online > 1 ? "s" : ""}
              </div>
            )}
            {mode !== "native" && mode !== "ghost" && installedSkillIds.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-mono">
                <Zap className="w-3 h-3" />
                {installedSkillIds.length} skill{installedSkillIds.length > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
          {messages.length === 0 && streamingSession === null && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto text-center py-16">
              <div className={cn("w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-6",
                mode === "native" ? "bg-emerald-500/10 border-emerald-500/20" :
                mode === "ghost" ? "bg-violet-500/10 border-violet-500/20" :
                "bg-primary/10 border-primary/20"
              )}>
                {mode === "native" ? <Brain className="w-8 h-8 text-emerald-400" /> :
                 mode === "ghost" ? <Ghost className="w-8 h-8 text-violet-400" /> :
                 <Bot className="w-8 h-8 text-primary" />}
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {mode === "native" ? "OmniLearn Native Intelligence" :
                 mode === "ghost" ? "Ghost Network Ready" :
                 "OmniLearn is ready"}
              </h2>
              <p className="text-muted-foreground font-mono text-sm mb-8">
                {mode === "native"
                  ? "Powered by Omni with live internet access — searches the web in real time, reads pages, and stores what it learns permanently in the knowledge graph."
                  : mode === "ghost"
                  ? ghostStatus && ghostStatus.total === 0
                    ? "No ghost nodes registered yet. Messages will run locally via Omni until you add nodes."
                    : `${ghostStatus?.online ?? 0} node${(ghostStatus?.online ?? 0) !== 1 ? "s" : ""} online. Messages route to the least-loaded node automatically.`
                  : `Running locally on your hardware. ${installedSkillIds.length > 0 ? `${installedSkillIds.length} skill${installedSkillIds.length > 1 ? "s" : ""} active.` : "Install skills to expand capabilities."}`}
              </p>

              {mode === "ghost" && ghostStatus?.total === 0 && (
                <Link href="/ghost-network"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 font-mono text-sm transition-all mb-8"
                >
                  <Ghost className="w-4 h-4" /> Set up ghost nodes
                </Link>
              )}

              <div className="grid grid-cols-2 gap-3 text-left max-w-lg mx-auto">
                {(mode === "native" ? [
                  "What's happening in AI research today?",
                  "Search the web for the latest news on open-source LLMs.",
                  "How does your knowledge graph work?",
                  "Fetch https://en.wikipedia.org/wiki/Artificial_intelligence and summarise it.",
                ] : mode === "ghost" ? [
                  "Explain distributed AI computation.",
                  "What are the benefits of ghost mode?",
                  "How does node selection work?",
                  "Compare centralised vs distributed AI.",
                ] : [
                  "What have you learned about distributed AI systems?",
                  "Explain the OmniLearn architecture.",
                  "How do AI agents self-improve?",
                  "What is federated learning?",
                ]).map(prompt => (
                  <button key={prompt} onClick={() => { setInput(prompt); textareaRef.current?.focus(); }}
                    className="text-left p-3 rounded-xl border border-border/40 bg-card/30 hover:border-primary/40 hover:bg-card/60 transition-all group"
                  >
                    <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">{prompt}</span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary transition-colors mt-1" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map(msg => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className={cn("flex gap-3 max-w-3xl", msg.role === "user" ? "ml-auto flex-row-reverse" : "")}
              >
                <div className={cn("w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5",
                  msg.role === "user"
                    ? "bg-primary/10 border-primary/20"
                    : mode === "ghost" ? "bg-violet-500/10 border-violet-500/20"
                    : mode === "native" ? "bg-emerald-500/10 border-emerald-500/20"
                    : "bg-secondary border-border/40"
                )}>
                  {msg.role === "user"
                    ? <User className="w-3.5 h-3.5 text-primary" />
                    : mode === "ghost" ? <Ghost className="w-3.5 h-3.5 text-violet-400" />
                    : mode === "native" ? <Brain className="w-3.5 h-3.5 text-emerald-400" />
                    : <Bot className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
                <div className={cn("rounded-2xl px-4 py-3 max-w-2xl",
                  msg.role === "user"
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-card/60 border border-border/40"
                )}>
                  <MarkdownContent text={msg.content} />
                  {/* Ghost / Native message metadata */}
                  {msg.role === "assistant" && msg.meta && (
                    <div className="mt-2 pt-2 border-t border-border/20 flex items-center gap-3 flex-wrap">
                      {msg.meta.nodeName && (
                        <span className="font-mono text-[10px] text-muted-foreground/60 flex items-center gap-1">
                          <Ghost className="w-2.5 h-2.5 text-violet-400/60" />
                          {msg.meta.nodeName}
                        </span>
                      )}
                      {msg.meta.processingMs && (
                        <span className="font-mono text-[10px] text-muted-foreground/60">{Math.round(msg.meta.processingMs)}ms</span>
                      )}
                      {msg.meta.routed === true && (
                        <span className="font-mono text-[10px] text-emerald-400/60 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> distributed
                        </span>
                      )}
                      {msg.meta.nodesUsed !== undefined && (
                        <span className="font-mono text-[10px] text-muted-foreground/60">{msg.meta.nodesUsed} nodes</span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Streaming message */}
          {streamingSession !== null && streamingContent && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 max-w-3xl">
              <div className={cn("w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5",
                mode === "ghost" ? "bg-violet-500/10 border-violet-500/20" :
                mode === "native" ? "bg-emerald-500/10 border-emerald-500/20" :
                "bg-secondary border-border/40"
              )}>
                {mode === "ghost" ? <Ghost className="w-3.5 h-3.5 text-violet-400" /> :
                 mode === "native" ? <Brain className="w-3.5 h-3.5 text-emerald-400" /> :
                 <Bot className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
              <div className="rounded-2xl px-4 py-3 bg-card/60 border border-border/40 max-w-2xl">
                <MarkdownContent text={streamingContent} />
                <span className={cn("inline-block w-1.5 h-4 rounded-sm ml-0.5 animate-pulse",
                  mode === "ghost" ? "bg-violet-400" : mode === "native" ? "bg-emerald-400" : "bg-primary"
                )} />
              </div>
            </motion.div>
          )}

          {/* Web activity indicator (searching / fetching) */}
          <AnimatePresence>
            {streamingSession === "native" && webActivity && (
              <motion.div
                key="web-activity"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex gap-3 max-w-3xl"
              >
                <div className="w-7 h-7 rounded-lg border bg-cyan-500/10 border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  {webActivity.type === "searching"
                    ? <Search className="w-3.5 h-3.5 text-cyan-400" />
                    : <Globe className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <div className="rounded-2xl px-4 py-3 bg-cyan-500/5 border border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                    <span className="font-mono text-xs text-cyan-300">
                      {webActivity.type === "searching"
                        ? <>searching — <span className="text-cyan-100 font-medium">{webActivity.payload}</span></>
                        : <>reading — <span className="text-cyan-100 font-medium truncate max-w-[340px] inline-block align-bottom">{webActivity.payload}</span></>}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Routing / thinking indicator */}
          {streamingSession !== null && !streamingContent && !webActivity && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className={cn("w-7 h-7 rounded-lg border flex items-center justify-center shrink-0",
                mode === "ghost" ? "bg-violet-500/10 border-violet-500/20" :
                mode === "native" ? "bg-emerald-500/10 border-emerald-500/20" :
                "bg-secondary border-border/40"
              )}>
                {mode === "ghost" ? <Ghost className="w-3.5 h-3.5 text-violet-400" /> :
                 mode === "native" ? <Brain className="w-3.5 h-3.5 text-emerald-400" /> :
                 <Bot className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
              <div className="rounded-2xl px-4 py-3 bg-card/60 border border-border/40">
                <div className="flex items-center gap-2">
                  <Loader2 className={cn("w-3 h-3 animate-spin",
                    mode === "ghost" ? "text-violet-400" : mode === "native" ? "text-emerald-400" : "text-muted-foreground"
                  )} />
                  <span className="font-mono text-xs text-muted-foreground">
                    {mode === "ghost"
                      ? ghostRouting
                        ? `Processing on ${ghostRouting.nodeName}${ghostRouting.region !== "unknown" ? ` (${ghostRouting.region})` : ""}…`
                        : "Selecting ghost node…"
                      : mode === "native" ? "Thinking…"
                      : "Thinking…"}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Skills bar ── */}
        {mode !== "native" && mode !== "ghost" && (
          <div className="px-4 py-2 border-t border-border/30 bg-card/10 flex items-center gap-2 overflow-x-auto shrink-0">
            {skills.filter(s => s.isInstalled).map(skill => (
              <div key={skill.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-mono whitespace-nowrap shrink-0">
                <SkillIcon icon={skill.icon} className="w-3 h-3" />
                {skill.name}
                <button onClick={() => removeSkill(skill.id)} className="hover:text-red-400 transition-colors ml-0.5">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            <button onClick={() => setShowCatalog(c => !c)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/30 text-xs font-mono transition-all whitespace-nowrap shrink-0"
            >
              <Plus className="w-3 h-3" />
              {skills.some(s => s.isInstalled) ? "Skills" : "Add skills"}
            </button>
          </div>
        )}

        {/* ── Input area ── */}
        <div className="px-4 py-4 border-t border-border/40 bg-card/10 shrink-0">
          <div className={cn("flex items-end gap-3 rounded-2xl border bg-background/60 backdrop-blur px-4 py-3 transition-colors",
            mode === "ghost" ? "border-violet-500/30 focus-within:border-violet-500/50" :
            mode === "native" ? "border-emerald-500/30 focus-within:border-emerald-500/50" :
            "border-border/60 focus-within:border-primary/40"
          )}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={
                mode === "ghost" ? "Message ghost network…" :
                mode === "native" ? "Message native intelligence…" :
                "Message OmniLearn…"
              }
              rows={1}
              className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none resize-none max-h-32"
              style={{ lineHeight: "1.5" }}
            />
            <button onClick={sendMessage} disabled={streamingSession !== null || !input.trim()}
              className={cn("p-2 rounded-xl transition-all shrink-0",
                streamingSession !== null || !input.trim()
                  ? "bg-muted text-muted-foreground/30"
                  : mode === "ghost" ? "bg-violet-500 text-white hover:bg-violet-400"
                  : mode === "native" ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {streamingSession !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-center font-mono text-[10px] text-muted-foreground/30 mt-2">
            {mode === "ghost"
              ? "Routes to ghost nodes — falls back to Omni if none available"
              : mode === "native"
              ? "OmniLearn native intelligence — learns from every message"
              : "Enter to send · Shift+Enter for new line"}
          </p>
        </div>
      </div>

      {/* ── Skill catalog modal ── */}
      <AnimatePresence>
        {showCatalog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-end md:items-center justify-center p-4"
            onClick={() => setShowCatalog(false)}
          >
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              className="w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                <div>
                  <h3 className="font-mono text-sm font-bold">Skill catalog</h3>
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">Enhance OmniLearn's capabilities</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowSkillCreator(c => !c)}
                    className="font-mono text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    {showSkillCreator ? "Close" : "+ Custom"}
                  </button>
                  <button onClick={() => setShowCatalog(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                {showSkillCreator && (
                  <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-2.5 mb-3">
                    <p className="font-mono text-xs font-bold text-foreground">Create custom skill</p>
                    <input value={newSkill.name} onChange={e => setNewSkill(s => ({ ...s, name: e.target.value }))}
                      placeholder="Skill name" className="w-full px-2.5 py-1.5 rounded-lg border border-border/60 bg-background font-mono text-xs focus:outline-none focus:border-primary/50" />
                    <input value={newSkill.description} onChange={e => setNewSkill(s => ({ ...s, description: e.target.value }))}
                      placeholder="Short description" className="w-full px-2.5 py-1.5 rounded-lg border border-border/60 bg-background font-mono text-xs focus:outline-none focus:border-primary/50" />
                    <textarea value={newSkill.systemPrompt} onChange={e => setNewSkill(s => ({ ...s, systemPrompt: e.target.value }))}
                      placeholder="System prompt — instructions for OmniLearn when this skill is active" rows={3}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border/60 bg-background font-mono text-xs focus:outline-none focus:border-primary/50 resize-none" />
                    <button onClick={createCustomSkill}
                      className="w-full py-1.5 rounded-lg bg-primary text-primary-foreground font-mono text-xs font-bold hover:bg-primary/90 transition-colors"
                    >
                      Add skill
                    </button>
                  </div>
                )}

                {uninstalledCatalog.length === 0 && !showSkillCreator && (
                  <p className="text-center font-mono text-xs text-muted-foreground/50 py-6">All skills installed</p>
                )}

                {uninstalledCatalog.map(skill => (
                  <div key={skill.name} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:border-primary/30 transition-all group">
                    <div className="w-8 h-8 rounded-lg border border-border/40 bg-secondary/30 flex items-center justify-center shrink-0">
                      <SkillIcon icon={skill.icon} className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs font-bold text-foreground">{skill.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground/70 truncate">{skill.description}</p>
                    </div>
                    <button onClick={() => installSkill(skill)}
                      className="px-2.5 py-1 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 font-mono text-xs transition-all opacity-0 group-hover:opacity-100"
                    >
                      Install
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
