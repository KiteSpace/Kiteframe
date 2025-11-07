import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import WorkflowEditor from "@/pages/workflow-editor";
import KitelineDemo from "@/pages/kiteline-demo";
import KitelineDocs from "@/pages/kiteline-docs";
import AdminCodes from "@/pages/AdminCodes";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={WorkflowEditor} />
      <Route path="/demo" component={KitelineDemo} />
      <Route path="/docs" component={KitelineDocs} />
      <Route path="/internal/ops-codes" component={AdminCodes} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
