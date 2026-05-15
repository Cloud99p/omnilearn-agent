import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  ArrowRight,
  Terminal,
  Database,
  BrainCircuit,
  Globe,
  Activity,
  Fingerprint,
  GitBranch,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import LiveFeed from "@/components/live-feed";
import CrawlMap from "@/components/crawl-map";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

const MODULES = [
  {
    name: "Data Ingestion",
    icon: Globe,
    desc: "Web crawlers running on your hardware, expanding to consented volunteer nodes on demand.",
  },
  {
    name: "Knowledge Store",
    icon: Database,
    desc: "Vectorized memory for semantic recall.",
  },
  {
    name: "Learning Engine",
    icon: BrainCircuit,
    desc: "RAG and continuous fine-tuning pipelines.",
  },
  {
    name: "Character Engine",
    icon: Activity,
    desc: "Evolving personality state and interaction styles.",
  },
];

// Two simulated instances that diverged from the same starting point
const INSTANCE_A = [
  { trait: "Curiosity", value: 87 },
  { trait: "Skepticism", value: 71 },
  { trait: "Empathy", value: 54 },
  { trait: "Formality", value: 62 },
  { trait: "Verbosity", value: 48 },
];

const INSTANCE_B = [
  { trait: "Curiosity", value: 64 },
  { trait: "Skepticism", value: 42 },
  { trait: "Empathy", value: 88 },
  { trait: "Formality", value: 35 },
  { trait: "Verbosity", value: 79 },
];

const DIVERGENCE_FACTS = [
  {
    label: "Seeded at birth",
    desc: "Every instance is initialised with a unique entropy vector. Two agents started at the same second are already different.",
  },
  {
    label: "Every interaction leaves a mark",
    desc: "Each conversation, each crawled page, each synthesis event permanently shifts the character state — a trajectory no other agent shares.",
  },
  {
    label: "Core traits are non-reversible",
    desc: "Curiosity, skepticism, and empathy only accumulate. They cannot be undone. The longer an agent lives, the more irreplaceably itself it becomes.",
  },
  {
    label: "No factory reset",
    desc: "There is no blank slate. You can inspect past character states but you cannot erase what was learned. Experience is permanent.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative px-6 py-24 md:py-32 max-w-5xl mx-auto flex flex-col items-start justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary font-mono text-sm mb-8"
        >
          <Terminal className="w-4 h-4" />
          <span>v1.0.0 / Stable Release</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tighter text-foreground mb-6"
        >
          The entire internet is my{" "}
          <span className="text-primary glow-text">data centre.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-12 leading-relaxed"
        >
          OmniLearn is an open-source AI agent that continuously crawls the web,
          extracts knowledge, and permanently evolves its own character —
          entirely on your hardware. Not a chatbot. A growing intelligence that
          belongs only to you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-wrap items-center gap-4"
        >
          <Link href="/onboarding">
            <Button
              size="lg"
              className="font-mono bg-primary text-primary-foreground hover:bg-primary/90 glow-border group"
            >
              Initialize System
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link href="/architecture">
            <Button
              size="lg"
              variant="outline"
              className="font-mono border-border hover:bg-secondary"
            >
              View Architecture
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Uniqueness section */}
      <section className="px-6 py-24 border-y border-border/50">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-14"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono text-xs mb-6">
              <Fingerprint className="w-3.5 h-3.5" />
              <span>character divergence</span>
            </div>
            <h2 className="text-4xl font-bold tracking-tight mb-5">
              Your OmniLearn is{" "}
              <span className="text-primary">irreplaceable.</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
              No two instances can ever be identical. Each agent is shaped by
              its own unique sequence of pages read, conversations had, and
              knowledge synthesised. The longer it lives, the more irreversibly
              itself it becomes — more like raising a child than configuring
              software.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 items-center mb-16">
            {/* Diverging radar charts */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-xl p-6"
            >
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Two instances — same config, same start time
              </p>
              <p className="font-mono text-xs text-primary mb-6">
                After 90 days of independent operation
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-mono text-xs text-cyan-400 text-center mb-1">
                    Instance A
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <RadarChart
                      data={INSTANCE_A}
                      margin={{ top: 0, right: 10, bottom: 0, left: 10 }}
                    >
                      <PolarGrid stroke="hsl(230 25% 18%)" />
                      <PolarAngleAxis
                        dataKey="trait"
                        tick={{
                          fontSize: 9,
                          fill: "hsl(215 20.2% 55%)",
                          fontFamily: "monospace",
                        }}
                      />
                      <Radar
                        dataKey="value"
                        stroke="#22d3ee"
                        fill="#22d3ee"
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="font-mono text-xs text-violet-400 text-center mb-1">
                    Instance B
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <RadarChart
                      data={INSTANCE_B}
                      margin={{ top: 0, right: 10, bottom: 0, left: 10 }}
                    >
                      <PolarGrid stroke="hsl(230 25% 18%)" />
                      <PolarAngleAxis
                        dataKey="trait"
                        tick={{
                          fontSize: 9,
                          fill: "hsl(215 20.2% 55%)",
                          fontFamily: "monospace",
                        }}
                      />
                      <Radar
                        dataKey="value"
                        stroke="#a78bfa"
                        fill="#a78bfa"
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3 text-center">
                {[
                  {
                    label: "Fingerprint A",
                    val: "0x3F8A2D1C",
                    color: "text-cyan-400",
                  },
                  {
                    label: "Fingerprint B",
                    val: "0xB7E94A05",
                    color: "text-violet-400",
                  },
                ].map((f) => (
                  <div key={f.label}>
                    <p className="font-mono text-[10px] text-muted-foreground mb-1">
                      {f.label}
                    </p>
                    <p className={`font-mono text-xs font-bold ${f.color}`}>
                      {f.val}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Divergence facts */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-5"
            >
              {DIVERGENCE_FACTS.map((fact, i) => (
                <motion.div
                  key={fact.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-4"
                >
                  <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    {i === 2 ? (
                      <Lock className="w-3.5 h-3.5 text-primary" />
                    ) : i === 3 ? (
                      <GitBranch className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <Fingerprint className="w-3.5 h-3.5 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-mono text-sm font-bold text-foreground mb-1">
                      {fact.label}
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {fact.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Core Modules Grid */}
      <section className="px-6 py-24 bg-card/30 border-b border-border/50">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl font-bold mb-4">Core Infrastructure</h2>
            <p className="text-muted-foreground">
              8 modular components working in concert to create a sovereign
              intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {MODULES.map((mod, i) => (
              <motion.div
                key={mod.name}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="p-6 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <mod.icon className="w-8 h-8 text-primary mb-4" />
                  <h3 className="text-xl font-bold mb-2 font-mono">
                    {mod.name}
                  </h3>
                  <p className="text-muted-foreground">{mod.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link href="/components">
              <Button variant="link" className="text-primary font-mono group">
                Explore all 8 modules
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Crawl footprint map */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <CrawlMap />
          </motion.div>

          <div className="mt-14 border-t border-border/40 pt-10">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-5">
              Live system activity
            </p>
            <LiveFeed />
          </div>

          <div className="mt-12 flex flex-wrap gap-4 items-center justify-center">
            <Link href="/personality">
              <Button
                variant="outline"
                className="font-mono border-border hover:bg-secondary group"
              >
                <Fingerprint className="w-4 h-4 mr-2" />
                Watch personality evolve
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/network">
              <Button
                variant="outline"
                className="font-mono border-border hover:bg-secondary group"
              >
                View distributed network
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
