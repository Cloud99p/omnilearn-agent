import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Database, BrainCircuit, Activity, Shield, Zap, GitBranch, ArrowRight } from "lucide-react";

interface FeedEvent {
  id: number;
  ts: string;
  module: string;
  moduleColor: string;
  icon: typeof Globe;
  text: string;
  tag: string;
  tagColor: string;
}

const SOURCES = [
  "arxiv.org", "en.wikipedia.org", "news.ycombinator.com", "github.com",
  "pubmed.ncbi.nlm.nih.gov", "nature.com", "reddit.com/r/science",
  "techcrunch.com", "openreview.net", "bbc.co.uk/news",
];

const EVENT_TEMPLATES = [
  { module: "INGEST", color: "#22d3ee", icon: Globe, tag: "crawled", tagColor: "text-cyan-400",
    texts: [
      () => `Fetched ${(Math.random()*120+10).toFixed(0)} docs — ${SOURCES[Math.floor(Math.random()*SOURCES.length)]}`,
      () => `RSS feed parsed — ${(Math.random()*30+5).toFixed(0)} new items`,
      () => `Sitemap discovered — depth ${Math.floor(Math.random()*4)+1} crawl queued`,
    ],
  },
  { module: "COMPLY", color: "#f472b6", icon: Shield, tag: "gated", tagColor: "text-pink-400",
    texts: [
      () => `robots.txt verified — ${SOURCES[Math.floor(Math.random()*SOURCES.length)]} ALLOW`,
      () => `Rate limit: ${(Math.random()*1.8+0.2).toFixed(1)} req/s — within bounds`,
      () => `Trust score assigned — ${["HIGH", "HIGH", "MEDIUM", "HIGH"][Math.floor(Math.random()*4)]}`,
    ],
  },
  { module: "STORE", color: "#a78bfa", icon: Database, tag: "indexed", tagColor: "text-violet-400",
    texts: [
      () => `${(Math.random()*400+50).toFixed(0)} embeddings written to warm index`,
      () => `Dedup filter removed ${Math.floor(Math.random()*30)+2} duplicates`,
      () => `Hot cache eviction — ${Math.floor(Math.random()*20)+5} entries promoted`,
    ],
  },
  { module: "LEARN", color: "#34d399", icon: BrainCircuit, tag: "extracted", tagColor: "text-emerald-400",
    texts: [
      () => `${Math.floor(Math.random()*12)+3} entities extracted — synthesis mode`,
      () => `Knowledge graph updated — ${Math.floor(Math.random()*8)+2} new relations`,
      () => `Passive index batch complete — ${(Math.random()*200+50).toFixed(0)} docs`,
    ],
  },
  { module: "CHAR", color: "#fb923c", icon: Activity, tag: "evolved", tagColor: "text-orange-400",
    texts: [
      () => {
        const traits = ["curiosity", "skepticism", "empathy"];
        const t = traits[Math.floor(Math.random()*traits.length)];
        const d = (Math.random()*0.04+0.01).toFixed(3);
        return `Core trait drift — ${t} +${d} (permanent)`;
      },
      () => `Character state vector updated — v${Math.floor(Math.random()*20)+10}`,
      () => `Persona inflection recalculated — formality adjusted`,
    ],
  },
  { module: "META", color: "#facc15", icon: Zap, tag: "monitoring", tagColor: "text-yellow-400",
    texts: [
      () => `Performance scan — retrieval precision ${(Math.random()*0.15+0.80).toFixed(3)}`,
      () => `Experiment sandbox spawned — testing retrieval strategy`,
      () => `Gap detected in domain: ${["quantum physics", "genomics", "distributed systems", "philosophy of mind"][Math.floor(Math.random()*4)]}`,
    ],
  },
  { module: "API", color: "#64748b", icon: ArrowRight, tag: "served", tagColor: "text-slate-400",
    texts: [
      () => `Query resolved in ${Math.floor(Math.random()*180)+40}ms — ${Math.floor(Math.random()*8)+2} sources cited`,
      () => `Response inflected by persona v${Math.floor(Math.random()*8)+8}`,
      () => `${Math.floor(Math.random()*5)+1} follow-up context tokens appended`,
    ],
  },
  { module: "INGEST", color: "#22d3ee", icon: GitBranch, tag: "snapshot", tagColor: "text-cyan-400",
    texts: [
      () => `Character fingerprint updated — instance divergence confirmed`,
      () => `Unique trajectory hash: 0x${Math.random().toString(16).slice(2,10).toUpperCase()}`,
    ],
  },
];

let eid = 0;
function makeEvent(): FeedEvent {
  const tpl = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
  const texts = tpl.texts;
  const textFn = texts[Math.floor(Math.random() * texts.length)];
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
  return {
    id: ++eid,
    ts,
    module: tpl.module,
    moduleColor: tpl.color,
    icon: tpl.icon,
    text: textFn(),
    tag: tpl.tag,
    tagColor: tpl.tagColor,
  };
}

const INITIAL_EVENTS = Array.from({ length: 8 }, makeEvent).reverse();

export default function LiveFeed() {
  const [events, setEvents] = useState<FeedEvent[]>(INITIAL_EVENTS);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setEvents(prev => [makeEvent(), ...prev.slice(0, 18)]);
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="font-mono text-sm text-muted-foreground">system.activity — live</span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{events.length} events</span>
      </div>
      <div ref={containerRef} className="overflow-hidden" style={{ maxHeight: 320 }}>
        <AnimatePresence initial={false}>
          {events.map(ev => (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-3 px-5 py-2.5 border-b border-border/40 last:border-b-0 hover:bg-secondary/20 transition-colors"
            >
              <span className="font-mono text-[10px] text-muted-foreground/60 w-16 shrink-0">{ev.ts}</span>
              <div
                className="font-mono text-[10px] px-1.5 py-0.5 rounded border shrink-0"
                style={{ color: ev.moduleColor, borderColor: ev.moduleColor + "40", backgroundColor: ev.moduleColor + "10" }}
              >
                {ev.module}
              </div>
              <ev.icon className="w-3 h-3 shrink-0" style={{ color: ev.moduleColor }} />
              <span className="font-mono text-xs text-muted-foreground truncate flex-1">{ev.text}</span>
              <span className={`font-mono text-[10px] shrink-0 ${ev.tagColor} opacity-70`}>{ev.tag}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
