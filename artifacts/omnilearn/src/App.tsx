import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";

import Home from "@/pages/home";
import Architecture from "@/pages/architecture";
import ComponentsPage from "@/pages/components-page";
import Configuration from "@/pages/configuration";
import Onboarding from "@/pages/onboarding";
import Personality from "@/pages/personality";
import Compliance from "@/pages/compliance";
import Network from "@/pages/network";
import Compare from "@/pages/compare";
import DnaPage from "@/pages/dna";
import Governance from "@/pages/governance";
import Ingestion from "@/pages/ingestion";
import StoragePage from "@/pages/storage";
import MemoryPage from "@/pages/memory";
import Chat from "@/pages/chat";
import AccountPage from "@/pages/account";
import RepositoriesPage from "@/pages/repositories";
import IntelligencePage from "@/pages/intelligence";
import GhostNetworkPage from "@/pages/ghost-network";
import WorkerPage from "@/pages/worker";
import BenchmarkPage from "@/pages/benchmark";
import SmarterPage from "@/pages/smarter";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? import.meta.env.CLERK_PUBLISHABLE_KEY) as string;

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#22d3ee",
    colorForeground: "#f1f5f9",
    colorMutedForeground: "#94a3b8",
    colorDanger: "#f87171",
    colorBackground: "#0f172a",
    colorInput: "#1e293b",
    colorInputForeground: "#f1f5f9",
    colorNeutral: "#334155",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#0f172a] border border-[#334155]/60 rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#f1f5f9] font-mono font-bold",
    headerSubtitle: "text-[#94a3b8] font-mono",
    socialButtonsBlockButtonText: "text-[#f1f5f9] font-mono font-medium",
    formFieldLabel: "text-[#94a3b8] font-mono text-xs",
    footerActionLink: "text-[#22d3ee] font-mono hover:text-[#22d3ee]/80",
    footerActionText: "text-[#64748b] font-mono",
    dividerText: "text-[#475569] font-mono text-xs",
    identityPreviewEditButton: "text-[#22d3ee] font-mono",
    formFieldSuccessText: "text-[#22d3ee] font-mono text-xs",
    alertText: "text-[#f87171] font-mono text-xs",
    logoBox: "flex justify-center py-2",
    logoImage: "w-10 h-10",
    socialButtonsBlockButton: "border border-[#334155] bg-[#1e293b] hover:bg-[#1e293b]/80 rounded-xl transition-colors",
    formButtonPrimary: "bg-[#22d3ee] text-[#0f172a] hover:bg-[#22d3ee]/90 font-mono font-bold rounded-xl",
    formFieldInput: "bg-[#1e293b] border-[#334155] text-[#f1f5f9] font-mono rounded-xl focus:border-[#22d3ee]",
    footerAction: "border-t border-[#1e293b]",
    dividerLine: "bg-[#1e293b]",
    alert: "bg-[#1e293b] border border-[#f87171]/20 rounded-xl",
    otpCodeFieldInput: "bg-[#1e293b] border-[#334155] text-[#f1f5f9] font-mono rounded-xl",
    formFieldRow: "gap-2",
    main: "gap-5",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function AuthLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span className="font-mono text-xs text-muted-foreground tracking-widest">INITIALISING</span>
      </div>
    </div>
  );
}

function WrappedSignIn() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        forceRedirectUrl={`${basePath}/account`}
        fallback={<AuthLoader />}
      />
    </div>
  );
}

function WrappedSignUp() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        forceRedirectUrl={`${basePath}/account`}
        fallback={<AuthLoader />}
      />
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/architecture" component={Architecture} />
        <Route path="/components" component={ComponentsPage} />
        <Route path="/configuration" component={Configuration} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/personality" component={Personality} />
        <Route path="/compliance" component={Compliance} />
        <Route path="/network" component={Network} />
        <Route path="/compare" component={Compare} />
        <Route path="/dna" component={DnaPage} />
        <Route path="/governance" component={Governance} />
        <Route path="/ingestion" component={Ingestion} />
        <Route path="/storage" component={StoragePage} />
        <Route path="/memory" component={MemoryPage} />
        <Route path="/chat" component={Chat} />
        <Route path="/account" component={AccountPage} />
        <Route path="/repositories" component={RepositoriesPage} />
        <Route path="/intelligence" component={IntelligencePage} />
        <Route path="/ghost-network" component={GhostNetworkPage} />
        <Route path="/benchmark" component={BenchmarkPage} />
        <Route path="/smarter" component={SmarterPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your OmniLearn account",
          },
        },
        signUp: {
          start: {
            title: "Create account",
            subtitle: "Join OmniLearn — open-source AI agent hub",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/sign-in/*?" component={WrappedSignIn} />
            <Route path="/sign-up/*?" component={WrappedSignUp} />
            <Route path="/worker" component={WorkerPage} />
            <Route component={Router} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
