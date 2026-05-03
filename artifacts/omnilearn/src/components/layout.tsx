import { useState } from "react";
import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Cpu, Terminal, BookOpen, Activity,
  Network, Globe, Dna, GitBranch,
  Database, HardDrive, Brain, Shield, Settings, Blocks, Gavel,
  ChevronDown, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Top-level links — always visible, no group header
const TOP_LINKS = [
  { href: "/", label: "Home", icon: Terminal },
  { href: "/onboarding", label: "Get Started", icon: BookOpen },
  { href: "/personality", label: "Personality", icon: Activity },
];

// Collapsible groups — hidden until the user wants more
const GROUPS = [
  {
    id: "explore",
    label: "Explore",
    items: [
      { href: "/architecture", label: "Architecture", icon: Network },
      { href: "/network", label: "Distributed", icon: Globe },
      { href: "/dna", label: "Instance DNA", icon: Dna },
      { href: "/compare", label: "Compare", icon: GitBranch },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    items: [
      { href: "/ingestion", label: "Ingestion", icon: Database },
      { href: "/storage", label: "Storage", icon: HardDrive },
      { href: "/memory", label: "Memory", icon: Brain },
      { href: "/compliance", label: "Compliance", icon: Shield },
      { href: "/configuration", label: "Configuration", icon: Settings },
      { href: "/components", label: "Components", icon: Blocks },
      { href: "/governance", label: "Governance", icon: Gavel },
    ],
  },
];

function NavLink({ href, label, icon: Icon, location, onClick }: {
  href: string; label: string; icon: React.ElementType; location: string; onClick?: () => void;
}) {
  const isActive = location === href;
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg font-mono text-sm transition-all duration-150",
        isActive
          ? "bg-primary/10 text-primary border border-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/30 border border-transparent"
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "")} />
      {label}
    </Link>
  );
}

function CollapsibleGroup({ group, location, onNavClick }: {
  group: typeof GROUPS[0]; location: string; onNavClick?: () => void;
}) {
  const hasActive = group.items.some(i => i.href === location);
  const [open, setOpen] = useState(hasActive);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 rounded-md group hover:bg-secondary/20 transition-colors"
      >
        <span className={cn(
          "font-mono text-xs transition-colors",
          open ? "text-muted-foreground" : "text-muted-foreground/50 group-hover:text-muted-foreground"
        )}>
          {group.label}
        </span>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 text-muted-foreground/30 transition-transform duration-200",
          open ? "rotate-0" : "-rotate-90"
        )} />
      </button>

      {open && (
        <div className="mt-1 space-y-0.5 pl-1">
          {group.items.map(item => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              location={location}
              onClick={onNavClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Sidebar({ location, onNavClick }: { location: string; onNavClick?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-border/40">
        <Link
          href="/"
          onClick={onNavClick}
          className="flex items-center gap-2.5 text-primary hover:text-primary/80 transition-colors group"
        >
          <Cpu className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
          <span className="font-mono text-base font-bold tracking-tight">OmniLearn</span>
        </Link>
        <div className="mt-2 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
            System Active
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 overflow-y-auto flex flex-col gap-6">
        {/* Top-level always-visible links */}
        <div className="space-y-0.5">
          {TOP_LINKS.map(item => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              location={location}
              onClick={onNavClick}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-border/30" />

        {/* Collapsible groups */}
        <div className="space-y-4">
          {GROUPS.map(group => (
            <CollapsibleGroup
              key={group.id}
              group={group}
              location={location}
              onNavClick={onNavClick}
            />
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 border-r border-border/40 bg-card/40 backdrop-blur-sm shrink-0 sticky top-0 h-screen flex-col z-40">
        <Sidebar location={location} />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur border-b border-border/40">
        <Link href="/" className="flex items-center gap-2 text-primary font-mono font-bold text-sm">
          <Cpu className="w-4 h-4" />
          OmniLearn
        </Link>
        <button
          onClick={() => setMobileOpen(o => !o)}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute top-0 left-0 w-60 h-full bg-card border-r border-border/40 overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <Sidebar location={location} onNavClick={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 bg-grid-pattern">
        {children}
      </main>
    </div>
  );
}
