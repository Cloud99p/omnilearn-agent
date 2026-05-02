import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Network, Blocks, Cpu, Settings, BookOpen, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Manifesto", icon: Terminal },
  { href: "/architecture", label: "Architecture", icon: Network },
  { href: "/components", label: "Components", icon: Blocks },
  { href: "/configuration", label: "Configuration", icon: Settings },
  { href: "/onboarding", label: "Onboarding", icon: BookOpen },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border/50 bg-card/50 backdrop-blur-sm shrink-0 sticky top-0 md:h-screen flex flex-col z-50">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-3 text-primary transition-colors hover:text-primary/80 group">
            <Cpu className="w-8 h-8 group-hover:animate-spin-slow" />
            <span className="font-mono text-xl font-bold tracking-tight">OmniLearn</span>
          </Link>
          <div className="mt-2 text-xs font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            System Active
          </div>
        </div>

        <nav className="flex-1 px-4 pb-6 overflow-y-auto space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md font-mono text-sm transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20 glow-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 bg-grid-pattern">
        {children}
      </main>
    </div>
  );
}
