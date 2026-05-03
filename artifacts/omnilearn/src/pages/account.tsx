import { useUser, useClerk, Show } from "@clerk/react";
import { Redirect } from "wouter";
import { useState, useEffect } from "react";
import {
  User, Mail, Github, Chrome, LogOut, Shield, Bell,
  Check, ExternalLink, Cpu, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface UserProfile {
  clerkId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  githubUsername: string | null;
  hasGitHub: boolean;
  hasGoogle: boolean;
  githubEmail: string | null;
  googleEmail: string | null;
}

function AccountContent() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "connections" | "security">("profile");

  useEffect(() => {
    fetch(`${basePath}/api/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setProfile(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "connections", label: "Connected Accounts" },
    { id: "security", label: "Security" },
  ] as const;

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <User className="w-5 h-5 text-primary" />
          <h1 className="font-mono text-xl font-bold text-foreground">Account</h1>
        </div>
        <p className="font-mono text-sm text-muted-foreground ml-8">
          Manage your identity and connected services
        </p>
      </div>

      {/* Avatar + display name */}
      <div className="flex items-center gap-5 p-5 rounded-xl bg-card border border-border/40">
        {profile?.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt="Avatar"
            className="w-16 h-16 rounded-full border-2 border-primary/30"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
            <Cpu className="w-7 h-7 text-primary" />
          </div>
        )}
        <div>
          <div className="font-mono text-base font-semibold text-foreground">
            {profile?.displayName ?? user?.fullName ?? "OmniLearn User"}
          </div>
          <div className="font-mono text-sm text-muted-foreground mt-0.5">
            {profile?.email ?? user?.primaryEmailAddress?.emailAddress ?? ""}
          </div>
          {profile?.githubUsername && (
            <a
              href={`https://github.com/${profile.githubUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-1.5 font-mono text-xs text-primary hover:underline"
            >
              <Github className="w-3 h-3" />
              @{profile.githubUsername}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-card/60 rounded-lg border border-border/40">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 font-mono text-xs py-2 px-3 rounded-md transition-all duration-150",
              activeTab === tab.id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {activeTab === "profile" && (
        <div className="space-y-4">
          <Field label="Display Name" value={profile?.displayName ?? user?.fullName ?? "—"} icon={User} />
          <Field label="Email" value={profile?.email ?? user?.primaryEmailAddress?.emailAddress ?? "—"} icon={Mail} />
          {profile?.githubUsername && (
            <Field label="GitHub Username" value={`@${profile.githubUsername}`} icon={Github} />
          )}
          <div className="pt-2">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 font-mono text-xs text-muted-foreground">
              Profile information is synced from your connected accounts. To update your name or email,
              edit them in the connected account provider.
            </div>
          </div>
        </div>
      )}

      {/* Connections tab */}
      {activeTab === "connections" && (
        <div className="space-y-3">
          <ConnectionCard
            icon={Github}
            provider="GitHub"
            connected={profile?.hasGitHub ?? false}
            detail={profile?.hasGitHub ? `@${profile.githubUsername ?? "connected"}` : undefined}
            connectHref={`${basePath}/sign-in`}
            color="text-foreground"
            bg="bg-foreground/5"
          />
          <ConnectionCard
            icon={Chrome}
            provider="Google"
            connected={profile?.hasGoogle ?? false}
            detail={profile?.hasGoogle ? profile.googleEmail ?? "connected" : undefined}
            connectHref={`${basePath}/sign-in`}
            color="text-blue-400"
            bg="bg-blue-400/5"
          />
          <div className="p-4 rounded-lg bg-card border border-border/40 font-mono text-xs text-muted-foreground">
            Connect GitHub to browse, create, fork, and share repositories directly from OmniLearn.
            Connect Google for quick sign-in across devices.
          </div>
        </div>
      )}

      {/* Security tab */}
      {activeTab === "security" && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-card border border-border/40 space-y-3">
            <div className="flex items-center gap-2 font-mono text-sm font-semibold text-foreground">
              <Shield className="w-4 h-4 text-primary" />
              Session Security
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="text-muted-foreground mb-1">Auth method</div>
                <div className="text-foreground">
                  {profile?.hasGitHub ? "GitHub OAuth" : profile?.hasGoogle ? "Google OAuth" : "Email"}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="text-muted-foreground mb-1">Session type</div>
                <div className="text-foreground">Browser cookie</div>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border/40 font-mono text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2 text-foreground font-medium mb-2">
              <Bell className="w-3.5 h-3.5 text-primary" />
              Security recommendations
            </div>
            <SecItem text="Connect multiple providers for account recovery" done={
              (profile?.hasGitHub ? 1 : 0) + (profile?.hasGoogle ? 1 : 0) >= 2
            } />
            <SecItem text="Use a verified primary email address" done={!!profile?.email} />
            <SecItem text="Keep your GitHub token scopes minimal" done />
          </div>
        </div>
      )}

      {/* Sign out */}
      <div className="pt-2 border-t border-border/30">
        <button
          onClick={() => signOut({ redirectUrl: `${basePath}/` })}
          className="flex items-center gap-2 font-mono text-sm text-muted-foreground hover:text-red-400 transition-colors py-2 px-3 rounded-lg hover:bg-red-400/5"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border/40">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="font-mono text-xs text-muted-foreground">{label}</div>
        <div className="font-mono text-sm text-foreground truncate">{value}</div>
      </div>
    </div>
  );
}

function ConnectionCard({ icon: Icon, provider, connected, detail, connectHref, color, bg }: {
  icon: React.ElementType;
  provider: string;
  connected: boolean;
  detail?: string;
  connectHref: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 p-4 rounded-xl border border-border/40", bg)}>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bg, "border border-border/30")}>
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm font-medium text-foreground">{provider}</div>
        {detail && <div className="font-mono text-xs text-muted-foreground truncate">{detail}</div>}
        {!connected && <div className="font-mono text-xs text-muted-foreground/60">Not connected</div>}
      </div>
      {connected ? (
        <div className="flex items-center gap-1.5 font-mono text-xs text-primary">
          <Check className="w-3.5 h-3.5" />
          Connected
        </div>
      ) : (
        <a
          href={connectHref}
          className="font-mono text-xs text-muted-foreground hover:text-primary border border-border/40 hover:border-primary/30 px-3 py-1.5 rounded-lg transition-colors"
        >
          Connect
        </a>
      )}
    </div>
  );
}

function SecItem({ text, done }: { text: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-3 h-3 rounded-full border flex-shrink-0",
        done ? "bg-primary/20 border-primary/40" : "border-muted-foreground/20"
      )}>
        {done && <div className="w-full h-full rounded-full flex items-center justify-center">
          <Check className="w-2 h-2 text-primary" />
        </div>}
      </div>
      <span className={done ? "text-foreground" : "text-muted-foreground/60"}>{text}</span>
    </div>
  );
}

export default function AccountPage() {
  return (
    <>
      <Show when="signed-in">
        <AccountContent />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}
