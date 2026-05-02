import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, Terminal, Database, BrainCircuit, Globe, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

const MODULES = [
  { name: "Data Ingestion", icon: Globe, desc: "Distributed web crawlers gathering raw signals." },
  { name: "Knowledge Store", icon: Database, desc: "Vectorized memory for semantic recall." },
  { name: "Learning Engine", icon: BrainCircuit, desc: "RAG and continuous fine-tuning pipelines." },
  { name: "Character Engine", icon: Activity, desc: "Evolving personality state and interaction styles." },
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
          <span>v1.0.0-rc.4 / Project Hub</span>
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
          OmniLearn is a bold, ambitious open-source AI agent that continuously crawls the web, extracts knowledge, evolves its own character, and self-improves — entirely on user-owned hardware.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-wrap items-center gap-4"
        >
          <Link href="/onboarding">
            <Button size="lg" className="font-mono bg-primary text-primary-foreground hover:bg-primary/90 glow-border group">
              Initialize System
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link href="/architecture">
            <Button size="lg" variant="outline" className="font-mono border-border hover:bg-secondary">
              View Architecture
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Core Modules Grid */}
      <section className="px-6 py-24 bg-card/30 border-y border-border/50">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl font-bold mb-4">Core Infrastructure</h2>
            <p className="text-muted-foreground">8 modular components working in concert to create a sovereign intelligence.</p>
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
                  <h3 className="text-xl font-bold mb-2 font-mono">{mod.name}</h3>
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
    </div>
  );
}
