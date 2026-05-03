import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Server, Ghost, Plus, Trash2, Bot, User, Loader2,
  Wrench, Search, Code, Brain, Globe, Shield, ChevronRight,
  X, Sparkles, MessageSquare, Zap, FileText, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Mode = "local" | "ghost" | "native";
type Role = "user" | "assistant";

interface Message {
  id: number;
  role: Role;
  content: string;
  createdAt: string;
  meta?: { nodesUsed?: number; newNodesAdded?: number };
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

const ICON_MAP: Record<string, React.ElementType> = {
  Search, Code, Brain, Globe, Shield, Wrench, Zap, FileText, Database, Sparkles,
};

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
  const [mode, setMode] = useState<Mode>("local");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [nativeConvId, setNativeConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showSkillCreator, setShowSkillCreator] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: "", description: "", icon: "Wrench", systemPrompt: "", category: "Custom" });
  const [loadingConv, setLoadingConv] = useState(false);
  const [latestMeta, setLatestMeta] = useState<{ nodesUsed?: number; newNodesAdded?: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const installedSkillIds = skills.filter(s => s.isInstalled).map(s => s.id);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages, streamingContent]);

  useEffect(() => {
    fetchConversations();
    fetchSkills();
  }, []);

  // Reset native conversation when switching away from native
  useEffect(() => {
    if (mode !== "native") setNativeConvId(null);
    setMessages([]);
    setActiveConvId(null);
  }, [mode]);

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${BASE}/api/anthropic/conversations`);
      if (res.ok) setConversations(await res.json());
    } catch { /* network not available */ }
  };

  const fetchSkills = async () => {
    try {
      const res = await fetch(`${BASE}/api/skills`);
      if (res.ok) setSkills(await res.json());
    } catch { /* network not available */ }
  };

  const loadConversation = async (id: number) => {
    setLoadingConv(true);
    try {
      const res = await fetch(`${BASE}/api/anthropic/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        setActiveConvId(id);
        setMode(data.mode);
      }
    } finally {
      setLoadingConv(false);
    }
  };

  const createConversation = async (firstMessage: string) => {
    const title = firstMessage.slice(0, 60) || "New conversation";
    const res = await fetch(`${BASE}/api/anthropic/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, mode }),
    });
    if (!res.ok) throw new Error("Failed to create conversation");
    const conv: Conversation = await res.json();
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(conv.id);
    return conv.id;
  };

  const deleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`${BASE}/api/anthropic/conversations/${id}`, { method: "DELETE" });
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
  };

  // ── Native mode send ──────────────────────────────────────────────────────
  const sendNativeMessage = useCallback(async (content: string) => {
    const tempUserMsg: Message = {
      id: Date.now(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setStreaming(true);
    setStreamingContent("");
    setLatestMeta(null);

    try {
      const res = await fetch(`${BASE}/api/omni/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, conversationId: nativeConvId }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let meta: { nodesUsed?: number; newNodesAdded?: number } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.conversationId && !nativeConvId) setNativeConvId(json.conversationId);
            if (json.content) {
              full += json.content;
              setStreamingContent(full);
            }
            if (json.meta) meta = json.meta;
            if (json.done) {
              const assistantMsg: Message = {
                id: Date.now() + 1,
                role: "assistant",
                content: full,
                createdAt: new Date().toISOString(),
                meta: meta ?? undefined,
              };
              setMessages(prev => [...prev, assistantMsg]);
              setStreamingContent("");
              if (meta) setLatestMeta(meta);
            }
          } catch { /* parse error */ }
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 2,
        role: "assistant",
        content: "Connection error. Make sure the API server is running.",
        createdAt: new Date().toISOString(),
      }]);
      setStreamingContent("");
    } finally {
      setStreaming(false);
    }
  }, [nativeConvId]);

  // ── Claude mode send ──────────────────────────────────────────────────────
  const sendClaudeMessage = useCallback(async (content: string) => {
    const tempUserMsg: Message = {
      id: Date.now(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setStreaming(true);
    setStreamingContent("");

    try {
      let convId = activeConvId;
      if (!convId) convId = await createConversation(content);

      const res = await fetch(`${BASE}/api/anthropic/conversations/${convId}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, installedSkillIds }),
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
            if (json.content) {
              full += json.content;
              setStreamingContent(full);
            }
            if (json.done) {
              setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: "assistant",
                content: full,
                createdAt: new Date().toISOString(),
              }]);
              setStreamingContent("");
            }
          } catch { /* parse error */ }
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 2,
        role: "assistant",
        content: "Connection error. Make sure the API server is running.",
        createdAt: new Date().toISOString(),
      }]);
      setStreamingContent("");
    } finally {
      setStreaming(false);
    }
  }, [activeConvId, mode, installedSkillIds]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return;
    const content = input.trim();
    setInput("");

    if (mode === "native") {
      await sendNativeMessage(content);
    } else {
      await sendClaudeMessage(content);
    }
  }, [input, streaming, mode, sendNativeMessage, sendClaudeMessage]);

  const installSkill = async (catalog: typeof SKILL_CATALOG[0]) => {
    const res = await fetch(`${BASE}/api/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...catalog, isInstalled: true }),
    });
    if (res.ok) {
      const skill: Skill = await res.json();
      setSkills(prev => [...prev, skill]);
    }
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
    local:  { label: "Local",   icon: Server,  color: "text-primary",    activeBg: "bg-primary/10 border-primary/30",    badge: "bg-primary/10 border-primary/20 text-primary" },
    ghost:  { label: "Ghost",   icon: Ghost,   color: "text-violet-400", activeBg: "bg-violet-500/10 border-violet-500/30", badge: "bg-violet-500/10 border-violet-500/20 text-violet-400" },
    native: { label: "Native",  icon: Brain,   color: "text-emerald-400", activeBg: "bg-emerald-500/10 border-emerald-500/30", badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
  };

  const activeCfg = MODE_CONFIG[mode];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Conversation sidebar ── */}
      <div className="hidden md:flex w-56 border-r border-border/40 bg-card/30 flex-col shrink-0">
        <div className="px-4 py-4 border-b border-border/40">
          {/* Mode buttons */}
          <div className="grid grid-cols-3 gap-1 mb-3">
            {(["local", "ghost", "native"] as Mode[]).map(m => {
              const cfg = MODE_CONFIG[m];
              const Icon = cfg.icon;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-1.5 rounded-md font-mono text-[10px] border transition-all",
                    mode === m ? cfg.activeBg : "border-border/40 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", mode === m ? cfg.color : "")} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
          {mode !== "native" && (
            <button
              onClick={() => { setActiveConvId(null); setMessages([]); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-primary/30 text-primary hover:bg-primary/10 font-mono text-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> New chat
            </button>
          )}
          {mode === "native" && (
            <button
              onClick={() => { setNativeConvId(null); setMessages([]); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-mono text-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> New session
            </button>
          )}
        </div>

        {mode !== "native" && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 ? (
              <p className="text-muted-foreground/40 font-mono text-xs px-2 py-4 text-center">No conversations yet</p>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && loadConversation(conv.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-2 rounded-md text-left group transition-all cursor-pointer",
                    activeConvId === conv.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                  )}
                >
                  <MessageSquare className="w-3 h-3 shrink-0" />
                  <span className="font-mono text-xs truncate flex-1">{conv.title}</span>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {mode === "native" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">Native Mode</p>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              Running OmniLearn's built-in intelligence engine. No external AI API. Learns from every message.
            </p>
            {latestMeta && (
              <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                <p className="font-mono text-[10px] text-emerald-400 uppercase tracking-wider">Last Response</p>
                <div className="font-mono text-[10px] text-muted-foreground space-y-0.5">
                  <p>Nodes used: {latestMeta.nodesUsed ?? 0}</p>
                  <p>New learned: {latestMeta.newNodesAdded ?? 0}</p>
                </div>
              </div>
            )}
            <a
              href={`${BASE}/intelligence`}
              className="flex items-center gap-1.5 font-mono text-xs text-primary/60 hover:text-primary transition-colors"
            >
              <Brain className="w-3 h-3" /> View knowledge base
            </a>
          </div>
        )}
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-3 border-b border-border/40 flex items-center justify-between bg-card/20 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-primary" />
            <span className="font-mono text-sm font-bold text-foreground">
              {mode === "native" ? "OmniLearn Native" : "OmniLearn Agent"}
            </span>
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-mono",
              activeCfg.badge
            )}>
              <activeCfg.icon className="w-3 h-3" />
              {activeCfg.label}
            </div>
            {mode !== "native" && installedSkillIds.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-mono">
                <Zap className="w-3 h-3" />
                {installedSkillIds.length} skill{installedSkillIds.length > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
          {messages.length === 0 && !streaming && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto text-center py-16"
            >
              <div className={cn(
                "w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-6",
                mode === "native"
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : "bg-primary/10 border-primary/20"
              )}>
                {mode === "native"
                  ? <Brain className="w-8 h-8 text-emerald-400" />
                  : <Bot className="w-8 h-8 text-primary" />}
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {mode === "native" ? "OmniLearn Native Intelligence" : "OmniLearn is ready"}
              </h2>
              <p className="text-muted-foreground font-mono text-sm mb-8">
                {mode === "native"
                  ? "Powered by OmniLearn's own knowledge graph, TF-IDF retrieval, and character engine. No external AI. Learns from every message."
                  : `Running in ${mode === "local" ? "local mode — on your hardware" : "ghost mode — distributed execution"}.${installedSkillIds.length > 0 ? ` ${installedSkillIds.length} skill${installedSkillIds.length > 1 ? "s" : ""} active.` : " Install skills to expand capabilities."}`}
              </p>
              <div className="grid grid-cols-2 gap-3 text-left max-w-lg mx-auto">
                {(mode === "native" ? [
                  "What do you know about OmniLearn?",
                  "How does your memory system work?",
                  "What is TF-IDF and how do you use it?",
                  "Tell me about your character traits.",
                ] : [
                  "What have you learned about distributed AI systems?",
                  "Explain how memory tiering works in this agent.",
                  "Summarise the federated volunteer computing model.",
                  "What makes an OmniLearn instance irreplaceable?",
                ]).map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="p-3 rounded-lg border border-border/40 bg-card/40 hover:border-primary/30 hover:bg-primary/5 text-left transition-all group"
                  >
                    <p className="font-mono text-xs text-muted-foreground group-hover:text-foreground">{suggestion}</p>
                    <ChevronRight className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 mt-1 transition-opacity" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex gap-3 max-w-4xl", msg.role === "user" ? "ml-auto flex-row-reverse" : "")}
              >
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                  msg.role === "user"
                    ? "bg-secondary border border-border/40"
                    : mode === "native"
                      ? "bg-emerald-500/10 border border-emerald-500/20"
                      : "bg-primary/10 border border-primary/20"
                )}>
                  {msg.role === "user"
                    ? <User className="w-3.5 h-3.5 text-muted-foreground" />
                    : mode === "native"
                      ? <Brain className="w-3.5 h-3.5 text-emerald-400" />
                      : <Bot className="w-3.5 h-3.5 text-primary" />}
                </div>
                <div className={cn(
                  "max-w-2xl px-4 py-3 rounded-xl border",
                  msg.role === "user"
                    ? "bg-secondary/40 border-border/40 text-foreground"
                    : mode === "native"
                      ? "bg-card/60 border-emerald-500/10"
                      : "bg-card/60 border-border/30"
                )}>
                  {msg.role === "assistant"
                    ? <MarkdownContent text={msg.content} />
                    : <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                  {msg.role === "assistant" && msg.meta && (
                    <div className="flex gap-3 mt-2 pt-2 border-t border-border/20">
                      {msg.meta.nodesUsed !== undefined && (
                        <span className="font-mono text-[10px] text-muted-foreground/40">
                          {msg.meta.nodesUsed} nodes used
                        </span>
                      )}
                      {msg.meta.newNodesAdded !== undefined && msg.meta.newNodesAdded > 0 && (
                        <span className="font-mono text-[10px] text-emerald-400/60">
                          +{msg.meta.newNodesAdded} learned
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Streaming message */}
          {streaming && streamingContent && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 max-w-4xl">
              <div className={cn(
                "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5",
                mode === "native" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-primary/10 border-primary/20"
              )}>
                {mode === "native"
                  ? <Brain className="w-3.5 h-3.5 text-emerald-400" />
                  : <Bot className="w-3.5 h-3.5 text-primary" />}
              </div>
              <div className={cn(
                "max-w-2xl px-4 py-3 rounded-xl border bg-card/60",
                mode === "native" ? "border-emerald-500/20" : "border-primary/20"
              )}>
                <MarkdownContent text={streamingContent} />
                <span className={cn(
                  "inline-block w-1.5 h-4 animate-pulse ml-0.5 align-middle",
                  mode === "native" ? "bg-emerald-400/70" : "bg-primary/70"
                )} />
              </div>
            </motion.div>
          )}

          {/* Thinking indicator */}
          {streaming && !streamingContent && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className={cn(
                "w-7 h-7 rounded-lg border flex items-center justify-center shrink-0",
                mode === "native" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-primary/10 border-primary/20"
              )}>
                <Loader2 className={cn("w-3.5 h-3.5 animate-spin", mode === "native" ? "text-emerald-400" : "text-primary")} />
              </div>
              <div className="px-4 py-3 rounded-xl border bg-card/60 border-border/30">
                <div className="flex gap-1 items-center">
                  {[0, 0.2, 0.4].map(d => (
                    <div key={d} className={cn(
                      "w-1.5 h-1.5 rounded-full animate-bounce",
                      mode === "native" ? "bg-emerald-400/60" : "bg-primary/60"
                    )} style={{ animationDelay: `${d}s` }} />
                  ))}
                  {mode === "native" && (
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground/50">searching knowledge…</span>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border/40 bg-card/20 backdrop-blur p-4">
          <div className="max-w-4xl mx-auto flex gap-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={mode === "native"
                ? "Message OmniLearn Native… everything you say becomes knowledge"
                : "Message OmniLearn… (Enter to send, Shift+Enter for newline)"}
              rows={1}
              disabled={streaming}
              className="flex-1 bg-background border border-border/50 rounded-xl px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/40 disabled:opacity-50 transition-all max-h-48 overflow-y-auto"
              style={{ lineHeight: "1.5" }}
            />
            <button
              onClick={sendMessage}
              disabled={streaming || !input.trim()}
              className={cn(
                "px-4 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-mono text-sm shrink-0",
                mode === "native"
                  ? "bg-emerald-500 text-background hover:bg-emerald-400"
                  : "bg-primary text-background hover:bg-primary/80"
              )}
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Skills panel (only in non-native modes) ── */}
      {mode !== "native" && (
        <div className="hidden lg:flex w-64 border-l border-border/40 bg-card/30 flex-col shrink-0">
          <div className="px-4 py-4 border-b border-border/40 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Skills</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => { setShowSkillCreator(true); setShowCatalog(false); }}
                className="p-1 rounded hover:bg-secondary/40 text-muted-foreground hover:text-primary transition-colors"
                title="Create skill"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setShowCatalog(c => !c); setShowSkillCreator(false); }}
                className={cn(
                  "p-1 rounded hover:bg-secondary/40 transition-colors",
                  showCatalog ? "text-primary" : "text-muted-foreground hover:text-primary"
                )}
                title="Browse catalog"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {/* Skill Creator */}
            <AnimatePresence>
              {showSkillCreator && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-lg border border-primary/20 bg-card/60 p-3 space-y-2 overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-primary">New skill</span>
                    <button onClick={() => setShowSkillCreator(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    value={newSkill.name}
                    onChange={e => setNewSkill(p => ({ ...p, name: e.target.value }))}
                    placeholder="Skill name"
                    className="w-full bg-background border border-border/50 rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-primary/50"
                  />
                  <input
                    value={newSkill.description}
                    onChange={e => setNewSkill(p => ({ ...p, description: e.target.value }))}
                    placeholder="Description"
                    className="w-full bg-background border border-border/50 rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-primary/50"
                  />
                  <textarea
                    value={newSkill.systemPrompt}
                    onChange={e => setNewSkill(p => ({ ...p, systemPrompt: e.target.value }))}
                    placeholder="System prompt…"
                    rows={3}
                    className="w-full bg-background border border-border/50 rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-primary/50 resize-none"
                  />
                  <button
                    onClick={createCustomSkill}
                    disabled={!newSkill.name || !newSkill.systemPrompt}
                    className="w-full py-1.5 bg-primary/10 border border-primary/30 text-primary rounded-md font-mono text-xs hover:bg-primary/20 disabled:opacity-40 transition-all"
                  >
                    Create skill
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Catalog */}
            <AnimatePresence>
              {showCatalog && uninstalledCatalog.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-1"
                >
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 px-1">Catalog</p>
                  {uninstalledCatalog.map(skill => (
                    <button
                      key={skill.name}
                      onClick={() => installSkill(skill)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-secondary/30 text-left group transition-all"
                    >
                      <div className="w-5 h-5 rounded border border-border/40 bg-card/40 flex items-center justify-center shrink-0">
                        <SkillIcon icon={skill.icon} className="w-2.5 h-2.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground truncate">{skill.name}</span>
                      <Plus className="w-2.5 h-2.5 text-primary opacity-0 group-hover:opacity-100 ml-auto shrink-0 transition-opacity" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Installed skills */}
            {skills.filter(s => s.isInstalled).length === 0 && !showCatalog ? (
              <div className="py-8 text-center space-y-2">
                <Sparkles className="w-5 h-5 text-muted-foreground/30 mx-auto" />
                <p className="font-mono text-xs text-muted-foreground/40">No skills installed</p>
                <button
                  onClick={() => setShowCatalog(true)}
                  className="font-mono text-xs text-primary/60 hover:text-primary transition-colors"
                >
                  Browse catalog
                </button>
              </div>
            ) : (
              skills.filter(s => s.isInstalled).map(skill => (
                <div
                  key={skill.id}
                  className="flex items-center gap-2 px-2 py-2 rounded-md bg-primary/5 border border-primary/10 group"
                >
                  <div className="w-5 h-5 rounded border border-primary/20 bg-primary/10 flex items-center justify-center shrink-0">
                    <SkillIcon icon={skill.icon} className="w-2.5 h-2.5 text-primary" />
                  </div>
                  <span className="font-mono text-xs text-foreground truncate flex-1">{skill.name}</span>
                  <button
                    onClick={() => removeSkill(skill.id)}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-muted-foreground/40 transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Native mode right panel ── */}
      {mode === "native" && (
        <div className="hidden lg:flex w-64 border-l border-border/40 bg-card/30 flex-col shrink-0">
          <div className="px-4 py-4 border-b border-border/40">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Intelligence</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">Engine</p>
              <div className="space-y-1.5 font-mono text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  TF-IDF retrieval
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Fact extraction
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Character synthesis
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Persistent learning
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">How to teach it</p>
              <ul className="space-y-2 font-mono text-xs text-muted-foreground">
                <li className="flex gap-2"><span className="text-primary shrink-0">1.</span>Say facts: "X is Y"</li>
                <li className="flex gap-2"><span className="text-primary shrink-0">2.</span>Use Training at /intelligence</li>
                <li className="flex gap-2"><span className="text-primary shrink-0">3.</span>Ask questions — it will honestly say what it doesn't know</li>
              </ul>
            </div>

            <a
              href={`${BASE}/intelligence`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 font-mono text-xs transition-all"
            >
              <Brain className="w-3.5 h-3.5" /> Open Intelligence
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
