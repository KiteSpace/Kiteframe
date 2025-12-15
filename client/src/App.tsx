import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PromptContextStoreProvider } from "@/contexts/PromptContextStore";
import WorkflowEditor from "@/pages/workflow-editor";
import KitelineDemo from "@/pages/kiteline-demo";
import KitelineDocs from "@/pages/kiteline-docs";
import AdminCodes from "@/pages/AdminCodes";
import Pricing from "@/pages/Pricing";
import Account from "@/pages/Account";
import Usage from "@/pages/Usage";
import MockupCodeDataReference from "@/pages/mockup-code-data-reference";
import ViewOnlyViewer from "@/pages/ViewOnlyViewer";
import NotFound from "@/pages/not-found";

function useCleanupQueryParams() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const paramsToRemove = ['figma_error', 'figma_connected'];
    let shouldClean = false;
    
    paramsToRemove.forEach(param => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        shouldClean = true;
      }
    });
    
    if (shouldClean) {
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, []);
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={WorkflowEditor} />
      <Route path="/project/:projectUuid" component={WorkflowEditor} />
      <Route path="/demo" component={KitelineDemo} />
      <Route path="/docs" component={KitelineDocs} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/account" component={Account} />
      <Route path="/account/usage" component={Usage} />
      <Route path="/checkout/success" component={Account} />
      <Route path="/internal/x9k7m2p4" component={AdminCodes} />
      <Route path="/mockup/code-data" component={MockupCodeDataReference} />
      <Route path="/view/:shareId" component={ViewOnlyViewer} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useCleanupQueryParams();
  
  return (
    <QueryClientProvider client={queryClient}>
      <PromptContextStoreProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </PromptContextStoreProvider>
    </QueryClientProvider>
  );
}

export default App;
