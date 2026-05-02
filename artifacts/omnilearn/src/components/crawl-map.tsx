import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, BookOpen, Newspaper, Code, Library, Users, Fingerprint } from "lucide-react";

// ── coordinate helpers ──────────────────────────────────────────────────────
// viewBox is 1000 × 500; world mapped via equirectangular projection
function project(lon: number, lat: number) {
  return {
    x: ((lon + 180) / 360) * 1000,
    y: ((90 - lat) / 180) * 500,
  };
}

// ── continent outlines ───────────────────────────────────────────────────────
const CONTINENTS = [
  {
    id: "na",
    points:
      "50,28 155,22 210,28 280,32 338,62 345,105 315,185 275,225 255,205 245,225 215,272 188,302 152,282 92,252 52,202 32,152 42,82",
  },
  {
    id: "sa",
    points:
      "202,222 262,222 292,252 302,302 292,362 262,432 222,452 192,422 177,362 182,282 192,242",
  },
  {
    id: "eu",
    points:
      "452,32 582,22 600,62 572,102 542,122 512,112 482,122 465,102 452,82 462,62",
  },
  {
    id: "af",
    points:
      "452,122 562,122 578,152 568,202 558,282 532,382 502,442 462,442 432,382 432,282 442,202 442,152",
  },
  {
    id: "asia",
    points:
      "562,22 978,22 980,52 952,102 902,132 852,152 802,142 762,162 722,152 702,132 662,142 622,132 602,102 572,82 558,62",
  },
  {
    id: "au",
    points:
      "802,282 952,272 970,312 960,382 922,422 862,422 812,382 792,322",
  },
  {
    id: "uk",
    points: "482,72 500,62 510,78 506,102 492,107 482,92",
  },
  {
    id: "japan",
    points: "882,142 902,132 912,152 906,182 892,187 877,168",
  },
  {
    id: "nz",
    points: "952,378 965,372 968,392 958,402 948,395",
  },
];

// ── crawled domains (this instance's personal footprint) ─────────────────────
type Category = "academic" | "tech" | "news" | "encyclopedic" | "social";

interface CrawledDomain {
  domain: string;
  lon: number;
  lat: number;
  docs: number;
  category: Category;
  region: string;
  jitter: [number, number];
}

const INITIAL_DOMAINS: CrawledDomain[] = [
  { domain: "arxiv.org",             lon: -76.5,  lat: 42.4,  docs: 12400, category: "academic",     region: "Ithaca, NY",      jitter: [0, 0] },
  { domain: "pubmed.ncbi.nih.gov",   lon: -77.1,  lat: 38.9,  docs: 8200,  category: "academic",     region: "Bethesda, MD",    jitter: [4, -3] },
  { domain: "en.wikipedia.org",      lon: -77.5,  lat: 38.9,  docs: 41000, category: "encyclopedic", region: "Ashburn, VA",     jitter: [-5, 4] },
  { domain: "news.ycombinator.com",  lon: -122.4, lat: 37.7,  docs: 16000, category: "social",       region: "San Francisco, CA", jitter: [0, 0] },
  { domain: "github.com",            lon: -122.4, lat: 37.7,  docs: 22000, category: "tech",         region: "San Francisco, CA", jitter: [6, -5] },
  { domain: "nature.com",            lon: -0.1,   lat: 51.5,  docs: 3100,  category: "academic",     region: "London, UK",      jitter: [0, 0] },
  { domain: "bbc.co.uk",             lon: -0.1,   lat: 51.5,  docs: 9800,  category: "news",         region: "London, UK",      jitter: [6, 5] },
  { domain: "openreview.net",        lon: -72.5,  lat: 42.3,  docs: 4800,  category: "academic",     region: "Amherst, MA",     jitter: [3, -6] },
  { domain: "springer.com",          lon: 13.4,   lat: 52.5,  docs: 2200,  category: "academic",     region: "Berlin, DE",      jitter: [0, 0] },
  { domain: "ieee.org",              lon: -74.4,  lat: 40.6,  docs: 3800,  category: "academic",     region: "Piscataway, NJ",  jitter: [-4, 5] },
  { domain: "mit.edu",               lon: -71.1,  lat: 42.3,  docs: 5100,  category: "tech",         region: "Cambridge, MA",   jitter: [5, 3] },
  { domain: "reuters.com",           lon: -0.1,   lat: 51.5,  docs: 11200, category: "news",         region: "London, UK",      jitter: [-6, -4] },
  { domain: "techcrunch.com",        lon: -122.4, lat: 37.7,  docs: 4400,  category: "tech",         region: "San Francisco, CA", jitter: [-5, 7] },
  { domain: "reddit.com",            lon: -122.4, lat: 37.7,  docs: 8900,  category: "social",       region: "San Francisco, CA", jitter: [8, 3] },
  { domain: "elsevier.com",          lon: 4.9,    lat: 52.4,  docs: 1900,  category: "academic",     region: "Amsterdam, NL",   jitter: [0, 0] },
  { domain: "stanford.edu",          lon: -122.2, lat: 37.4,  docs: 6200,  category: "academic",     region: "Stanford, CA",    jitter: [4, -8] },
  { domain: "acm.org",               lon: -74.0,  lat: 40.7,  docs: 2800,  category: "tech",         region: "New York, NY",    jitter: [-3, -5] },
  { domain: "ap.org",                lon: -74.0,  lat: 40.7,  docs: 7600,  category: "news",         region: "New York, NY",    jitter: [5, 6] },
];

const UNDISCOVERED: CrawledDomain[] = [
  { domain: "csiro.au",              lon: 149.1,  lat: -35.3, docs: 1400,  category: "academic",     region: "Canberra, AU",    jitter: [0, 0] },
  { domain: "lemonde.fr",            lon: 2.3,    lat: 48.9,  docs: 3200,  category: "news",         region: "Paris, FR",       jitter: [0, 0] },
  { domain: "cambridge.org",         lon: 0.1,    lat: 52.2,  docs: 2700,  category: "academic",     region: "Cambridge, UK",   jitter: [5, -4] },
  { domain: "cnn.com",               lon: -84.4,  lat: 33.7,  docs: 6100,  category: "news",         region: "Atlanta, GA",     jitter: [0, 0] },
  { domain: "tum.de",                lon: 11.6,   lat: 48.1,  docs: 1800,  category: "academic",     region: "Munich, DE",      jitter: [0, 0] },
  { domain: "nytimes.com",           lon: -74.0,  lat: 40.7,  docs: 8800,  category: "news",         region: "New York, NY",    jitter: [7, -7] },
  { domain: "u-tokyo.ac.jp",         lon: 139.7,  lat: 35.7,  docs: 2100,  category: "academic",     region: "Tokyo, JP",       jitter: [0, 0] },
  { domain: "smh.com.au",            lon: 151.2,  lat: -33.9, docs: 2900,  category: "news",         region: "Sydney, AU",      jitter: [0, 0] },
  { domain: "medium.com",            lon: -122.4, lat: 37.7,  docs: 7300,  category: "social",       region: "San Francisco, CA", jitter: [-7, -6] },
  { domain: "towardsdatascience.com",lon: -122.4, lat: 37.7,  docs: 5600,  category: "tech",         region: "San Francisco, CA", jitter: [3, 9] },
  { domain: "sciencedaily.com",      lon: -77.1,  lat: 39.1,  docs: 3300,  category: "academic",     region: "Rockville, MD",   jitter: [6, -2] },
  { domain: "theguardian.com",       lon: -0.1,   lat: 51.5,  docs: 7100,  category: "news",         region: "London, UK",      jitter: [4, -7] },
];

const CATEGORY_STYLE: Record<Category, { color: string; stroke: string; icon: typeof BookOpen; label: string }> = {
  academic:     { color: "#22d3ee", stroke: "#22d3ee", icon: BookOpen,  label: "Academic" },
  tech:         { color: "#34d399", stroke: "#34d399", icon: Code,      label: "Tech" },
  news:         { color: "#f472b6", stroke: "#f472b6", icon: Newspaper, label: "News" },
  encyclopedic: { color: "#a78bfa", stroke: "#a78bfa", icon: Library,   label: "Encyclopedic" },
  social:       { color: "#facc15", stroke: "#facc15", icon: Users,     label: "Social" },
};

function dotRadius(docs: number): number {
  // Scale between 4 and 14 based on doc count
  return 4 + Math.min(10, Math.log10(docs + 1) * 2.5);
}

export default function CrawlMap() {
  const [domains, setDomains] = useState<CrawledDomain[]>(INITIAL_DOMAINS);
  const [hovered, setHovered] = useState<CrawledDomain | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [newlyAdded, setNewlyAdded] = useState<string | null>(null);
  const undiscoveredRef = useRef([...UNDISCOVERED]);
  const svgRef = useRef<SVGSVGElement>(null);

  // Periodically discover a new domain
  useEffect(() => {
    if (undiscoveredRef.current.length === 0) return;
    const t = setInterval(() => {
      if (undiscoveredRef.current.length === 0) return;
      const idx = Math.floor(Math.random() * undiscoveredRef.current.length);
      const next = undiscoveredRef.current[idx];
      undiscoveredRef.current = undiscoveredRef.current.filter((_, i) => i !== idx);
      setDomains(prev => [...prev, next]);
      setNewlyAdded(next.domain);
      setTimeout(() => setNewlyAdded(null), 2500);
    }, 3800);
    return () => clearInterval(t);
  }, []);

  const totalDocs = domains.reduce((a, d) => a + d.docs, 0);
  const uniqueRegions = new Set(domains.map(d => d.region.split(",")[1]?.trim() || d.region)).size;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono text-xs mb-3">
            <Fingerprint className="w-3.5 h-3.5" />
            <span>this instance only — personal footprint</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Where This Agent Has Been</h2>
          <p className="text-sm text-muted-foreground font-mono">
            Domains crawled by this specific instance, plotted at their real server coordinates. No other agent has the same map.
          </p>
        </div>
        {/* Stats */}
        <div className="flex gap-4">
          {[
            { label: "Domains", value: domains.length },
            { label: "Docs indexed", value: (totalDocs / 1000).toFixed(0) + "k" },
            { label: "Regions", value: uniqueRegions },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="font-mono text-xl font-bold text-primary">{s.value}</p>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* New domain toast */}
      <AnimatePresence>
        {newlyAdded && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs"
          >
            <MapPin className="w-3 h-3" />
            <span>New domain discovered — <span className="font-bold">{newlyAdded}</span></span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map */}
      <div
        className="relative bg-background border border-border rounded-xl overflow-hidden"
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onMouseLeave={() => setHovered(null)}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 1000 500"
          className="w-full"
          style={{ height: "clamp(220px, 42vw, 400px)" }}
        >
          {/* Grid lines */}
          {Array.from({ length: 9 }, (_, i) => (i + 1) * 100).map(x => (
            <line key={`vg-${x}`} x1={x} y1={0} x2={x} y2={500} stroke="hsl(214 31% 14%)" strokeWidth={0.5} />
          ))}
          {Array.from({ length: 4 }, (_, i) => (i + 1) * 100).map(y => (
            <line key={`hg-${y}`} x1={0} y1={y} x2={1000} y2={y} stroke="hsl(214 31% 14%)" strokeWidth={0.5} />
          ))}

          {/* Equator + prime meridian */}
          <line x1={0} y1={250} x2={1000} y2={250} stroke="hsl(214 31% 18%)" strokeWidth={1} strokeDasharray="4 4" />
          <line x1={500} y1={0} x2={500} y2={500} stroke="hsl(214 31% 18%)" strokeWidth={1} strokeDasharray="4 4" />

          {/* Region labels */}
          {[
            { label: "AMERICAS", x: 190, y: 480 },
            { label: "EUROPE", x: 510, y: 480 },
            { label: "AFRICA", x: 510, y: 470 },
            { label: "ASIA-PAC", x: 780, y: 480 },
          ].map(l => (
            <text key={l.label} x={l.x} y={l.y} textAnchor="middle" fontSize={10} fill="hsl(215 20% 22%)" fontFamily="monospace">{l.label}</text>
          ))}

          {/* Continent fills */}
          {CONTINENTS.map(c => (
            <polygon
              key={c.id}
              points={c.points}
              fill="hsl(224 40% 10%)"
              stroke="hsl(214 31% 18%)"
              strokeWidth={1}
            />
          ))}

          {/* Domain dots */}
          {domains.map(d => {
            const { x, y } = project(d.lon, d.lat);
            const px = x + d.jitter[0];
            const py = y + d.jitter[1];
            const r = dotRadius(d.docs);
            const style = CATEGORY_STYLE[d.category];
            const isNew = d.domain === newlyAdded;
            const isHov = hovered?.domain === d.domain;

            return (
              <g key={d.domain}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHovered(d)}
              >
                {/* Pulse ring for new/hovered */}
                {(isNew || isHov) && (
                  <circle cx={px} cy={py} r={r + 6} fill="none" stroke={style.color} strokeWidth={1} opacity={0.4}>
                    {isNew && (
                      <animate attributeName="r" from={r} to={r + 14} dur="1s" repeatCount="indefinite" />
                    )}
                    {isNew && (
                      <animate attributeName="opacity" from={0.5} to={0} dur="1s" repeatCount="indefinite" />
                    )}
                  </circle>
                )}
                {/* Glow */}
                <circle cx={px} cy={py} r={r + 3} fill={style.color} opacity={0.12} />
                {/* Main dot */}
                <circle
                  cx={px} cy={py} r={r}
                  fill={style.color}
                  opacity={isHov ? 1 : 0.75}
                  stroke={style.color}
                  strokeWidth={isHov ? 1.5 : 0.5}
                />
              </g>
            );
          })}
        </svg>

        {/* Hover tooltip */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute z-10 bg-card border border-border rounded-lg px-3 py-2.5 shadow-xl"
              style={{
                left: Math.min(mousePos.x + 12, 999),
                top: Math.max(mousePos.y - 60, 4),
                maxWidth: 220,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_STYLE[hovered.category].color }} />
                <span className="font-mono text-xs font-bold text-foreground truncate">{hovered.domain}</span>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">{hovered.region}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{hovered.docs.toLocaleString()} docs indexed</p>
              <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
                style={{ backgroundColor: CATEGORY_STYLE[hovered.category].color + "15", color: CATEGORY_STYLE[hovered.category].color }}>
                {CATEGORY_STYLE[hovered.category].label}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4">
        {(Object.entries(CATEGORY_STYLE) as [Category, typeof CATEGORY_STYLE[Category]][]).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="font-mono text-[11px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[10px] text-muted-foreground">discovering…</span>
        </div>
      </div>
    </div>
  );
}
