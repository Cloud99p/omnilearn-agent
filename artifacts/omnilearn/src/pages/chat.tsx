import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Server, Ghost, Plus, Trash2, Bot, User, Loader2,
  Wrench, Search, Code, Brain, Globe, Shield, ChevronRight,
  X, Sparkles, MessageSquare, Zap, FileText, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Mode = "local" | "ghost";
type Role = "user" | "assistant";

interface Message {
  id: number;
  role: Role;
  content: string;
  createdAt: string;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showSkillCreator, setShowSkillCreator] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: "", description: "", icon: "Wrench", systemPrompt: "", category: "Custom" });
  const [loadingConv, setLoadingConv] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const installedSkillIds = skills.filter(s => s.isInstalled).map(s => s.id);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages, streamingContent]);

  // Load conversations and skills on mount
  useEffect(() => {
    fetchConversations();
    fetchSkills();
  }, []);

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

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return;
    const content = input.trim();
    setInput("");

    // Optimistically add user message
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
              const assistantMsg: Message = {
                id: Date.now() + 1,
                role: "assistant",
                content: full,
                createdAt: new Date().toISOString(),
              };
              setMessages(prev => [...prev, assistantMsg]);
              setStreamingContent("");
            }
          } catch { /* parse error */ }
        }
      }
    } catch (err) {
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
  }, [input, streaming, activeConvId, mode, installedSkillIds]);

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

  const uninstalledCatalog = SKILL_CATALOG.filter(
    c => !skills.some(s => s.name === c.name)
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Conversation sidebar ── */}
      <div className="hidden md:flex w-56 border-r border-border/40 bg-card/30 flex-col shrink-0">
        <div className="px-4 py-4 border-b border-border/40">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setMode("local")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-mono text-xs border transition-all",
                mode === "local"
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border/40 text-muted-foreground hover:text-foreground"
              )}
            >
              <Server className="w-3 h-3" /> Local
            </button>
            <button
              onClick={() => setMode("ghost")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-mono text-xs border transition-all",
                mode === "ghost"
                  ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                  : "border-border/40 text-muted-foreground hover:text-foreground"
              )}
            >
              <Ghost className="w-3 h-3" /> Ghost
            </button>
          </div>
          <button
            onClick={() => { setActiveConvId(null); setMessages([]); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-primary/30 text-primary hover:bg-primary/10 font-mono text-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-muted-foreground/40 font-mono text-xs px-2 py-4 text-center">No conversations yet</p>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-2 rounded-md text-left group transition-all",
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
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-3 border-b border-border/40 flex items-center justify-between bg-card/20 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-primary" />
            <span className="font-mono text-sm font-bold text-foreground">OmniLearn Agent</span>
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-mono",
              mode === "local"
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-violet-500/10 border-violet-500/20 text-violet-400"
            )}>
              {mode === "local" ? <Server className="w-3 h-3" /> : <Ghost className="w-3 h-3" />}
              {mode === "local" ? "Local" : "Ghost"}
            </div>
            {installedSkillIds.length > 0 && (
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
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">OmniLearn is ready</h2>
              <p className="text-muted-foreground font-mono text-sm mb-8">
                Running in {mode === "local" ? "local mode — on your hardware" : "ghost mode — distributed execution"}.
                {installedSkillIds.length > 0
                  ? ` ${installedSkillIds.length} skill${installedSkillIds.length > 1 ? "s" : ""} active.`
                  : " Install skills to expand capabilities."}
              </p>
              <div className="grid grid-cols-2 gap-3 text-left max-w-lg mx-auto">
                {[
                  "What have you learned about distributed AI systems?",
                  "Explain how memory tiering works in this agent.",
                  "Summarise the federated volunteer computing model.",
                  "What makes an OmniLearn instance irreplaceable?",
                ].map(suggestion => (
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
                    : "bg-primary/10 border border-primary/20"
                )}>
                  {msg.role === "user"
                    ? <User className="w-3.5 h-3.5 text-muted-foreground" />
                    : <Bot className="w-3.5 h-3.5 text-primary" />}
                </div>
                <div className={cn(
                  "max-w-2xl px-4 py-3 rounded-xl border",
                  msg.role === "user"
                    ? "bg-secondary/40 border-border/40 text-foreground"
                    : "bg-card/60 border-border/30"
                )}>
                  {msg.role === "assistant"
                    ? <MarkdownContent text={msg.content} />
                    : <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Streaming message */}
          {streaming && streamingContent && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 max-w-4xl">
              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="max-w-2xl px-4 py-3 rounded-xl border bg-card/60 border-primary/20">
                <MarkdownContent text={streamingContent} />
                <span className="inline-block w-1.5 h-4 bg-primary/70 animate-pulse ml-0.5 align-middle" />
              </div>
            </motion.div>
          )}

          {/* Thinking indicator */}
          {streaming && !streamingContent && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              </div>
              <div className="px-4 py-3 rounded-xl border bg-card/60 border-border/30">
                <div className="flex gap-1 items-center">
                  {[0, 0.2, 0.4].map(d => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${d}s` }} />
                  ))}
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
              placeholder="Message OmniLearn… (Enter to send, Shift+Enter for newline)"
              rows={1}
              disabled={streaming}
              className="flex-1 bg-background border border-border/50 rounded-xl px-4 py-3 text-sm font-mono resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/40 disabled:opacity-50 transition-all max-h-48 overflow-y-auto"
              style={{ lineHeight: "1.5" }}
            />
            <button
              onClick={sendMessage}
              disabled={streaming || !input.trim()}
              className="px-4 py-3 bg-primary text-background rounded-xl hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-mono text-sm shrink-0"
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Skills panel ── */}
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

        <div className="flex-1 overflow-y-auto">
          {/* Installed skills */}
          {!showCatalog && !showSkillCreator && (
            <div className="p-3 space-y-2">
              {skills.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Wrench className="w-8 h-8 text-muted-foreground/20 mx-auto" />
                  <p className="text-muted-foreground/50 font-mono text-xs">No skills installed</p>
                  <button
                    onClick={() => setShowCatalog(true)}
                    className="text-primary font-mono text-xs hover:underline"
                  >
                    Browse catalog
                  </button>
                </div>
              ) : (
                skills.map(skill => (
                  <div
                    key={skill.id}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg border border-primary/10 bg-primary/5 group"
                  >
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <SkillIcon icon={skill.icon} className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs font-bold text-foreground truncate">{skill.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground/60 mt-0.5 line-clamp-2">{skill.description}</p>
                    </div>
                    <button
                      onClick={() => removeSkill(skill.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all shrink-0 mt-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
              {skills.length > 0 && (
                <button
                  onClick={() => setShowCatalog(true)}
                  className="w-full mt-2 py-2 rounded-lg border border-dashed border-border/40 text-muted-foreground/50 hover:text-muted-foreground hover:border-border font-mono text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3 h-3" /> Add more
                </button>
              )}
            </div>
          )}

          {/* Catalog */}
          {showCatalog && (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">Catalog</span>
                <button onClick={() => setShowCatalog(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {uninstalledCatalog.length === 0 ? (
                <p className="text-muted-foreground/50 font-mono text-xs text-center py-4">All skills installed</p>
              ) : (
                uninstalledCatalog.map(item => (
                  <div
                    key={item.name}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/30 bg-card/40 group hover:border-primary/20 transition-colors cursor-pointer"
                    onClick={() => installSkill(item)}
                  >
                    <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center shrink-0">
                      <SkillIcon icon={item.icon} className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-mono text-xs font-bold text-foreground truncate">{item.name}</p>
                        <Plus className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground/60 mt-0.5 line-clamp-2">{item.description}</p>
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-secondary/60 text-muted-foreground/60">{item.category}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Custom skill creator */}
          {showSkillCreator && (
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">Create Skill</span>
                <button onClick={() => setShowSkillCreator(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                value={newSkill.name}
                onChange={e => setNewSkill(s => ({ ...s, name: e.target.value }))}
                placeholder="Skill name"
                className="w-full bg-background border border-border/40 rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground/30"
              />
              <input
                value={newSkill.description}
                onChange={e => setNewSkill(s => ({ ...s, description: e.target.value }))}
                placeholder="Short description"
                className="w-full bg-background border border-border/40 rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground/30"
              />
              <select
                value={newSkill.icon}
                onChange={e => setNewSkill(s => ({ ...s, icon: e.target.value }))}
                className="w-full bg-background border border-border/40 rounded-md px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary/40 text-muted-foreground"
              >
                {Object.keys(ICON_MAP).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <textarea
                value={newSkill.systemPrompt}
                onChange={e => setNewSkill(s => ({ ...s, systemPrompt: e.target.value }))}
                placeholder="System prompt — what does this skill tell the agent to do?"
                rows={4}
                className="w-full bg-background border border-border/40 rounded-md px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground/30"
              />
              <button
                onClick={createCustomSkill}
                disabled={!newSkill.name || !newSkill.systemPrompt}
                className="w-full py-2 rounded-md bg-primary/10 border border-primary/20 text-primary font-mono text-xs hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Install skill
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
