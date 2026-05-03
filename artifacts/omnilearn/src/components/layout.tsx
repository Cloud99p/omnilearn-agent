import { useState } from "react";
import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Network, Blocks, Cpu, Settings, BookOpen, Terminal, Activity,
  Shield, Globe, GitBranch, Dna, Gavel, Database, HardDrive,
  Brain, ChevronDown, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Manifesto", icon: Terminal },
      { href: "/architecture", label: "Architecture", icon: Network },
      { href: "/onboarding", label: "Onboarding", icon: BookOpen },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/personality", label: "Personality", icon: Activity },
      { href: "/dna", label: "Instance DNA", icon: Dna },
      { href: "/compare", label: "Compare", icon: GitBranch },
    ],
  },
  {
    label: "Data & Memory",
    items: [
      { href: "/ingestion", label: "Ingestion", icon: Database },
      { href: "/storage", label: "Storage", icon: HardDrive },
      { href: "/memory", label: "Memory", icon: Brain },
    ],
  },
  {
    label: "Network",
    items: [
      { href: "/network", label: "Distributed", icon: Globe },
      { href: "/governance", label: "Governance", icon: Gavel },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/components", label: "Components", icon: Blocks },
      { href: "/configuration", label: "Configuration", icon: Settings },
      { href: "/compliance", label: "Compliance", icon: Shield },
    ],
  },
];

function NavGroup({ group, location, defaultOpen }: { group: NavGroup; location: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-left group"
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
          {group.label}
        </span>
        <ChevronDown
          className={cn(
            "w-3 h-3 text-muted-foreground/30 transition-transform duration-200",
            open ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map(item => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md font-mono text-sm transition-all duration-150",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-transparent"
                )}
              >
                <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeGroup = NAV_GROUPS.find(g => g.items.some(i => i.href === location));

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-border/40">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-primary hover:text-primary/80 transition-colors group"
          onClick={() => setMobileOpen(false)}
        >
          <Cpu className="w-7 h-7 group-hover:rotate-90 transition-transform duration-300" />
          <span className="font-mono text-lg font-bold tracking-tight">OmniLearn</span>
        </Link>
        <div className="mt-2.5 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">System Active</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
        {NAV_GROUPS.map(group => (
          <NavGroup
            key={group.label}
            group={group}
            location={location}
            defaultOpen={group === activeGroup || group.label === "Overview"}
          />
        ))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 border-r border-border/40 bg-card/40 backdrop-blur-sm shrink-0 sticky top-0 h-screen flex-col z-40">
        {sidebar}
      </aside>

      {/* Mobile header */}
      <div className="md:hidden sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur border-b border-border/40">
        <Link href="/" className="flex items-center gap-2 text-primary font-mono font-bold text-base">
          <Cpu className="w-5 h-5" />
          OmniLearn
        </Link>
        <button onClick={() => setMobileOpen(o => !o)} className="text-muted-foreground hover:text-foreground p-1">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-background/90 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute top-0 left-0 w-64 h-full bg-card border-r border-border/40 overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {sidebar}
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 bg-grid-pattern" onClick={() => setMobileOpen(false)}>
        {children}
      </main>
    </div>
  );
}
