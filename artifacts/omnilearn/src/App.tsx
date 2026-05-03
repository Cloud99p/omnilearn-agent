import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const queryClient = new QueryClient();

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
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
