import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import WorkflowEditor from "@/pages/workflow-editor";
import KitelineDemo from "@/pages/kiteline-demo";
import KitelineDocs from "@/pages/kiteline-docs";
import AdminCodes from "@/pages/AdminCodes";
import Pricing from "@/pages/Pricing";
import Account from "@/pages/Account";
import MockupCodeDataReference from "@/pages/mockup-code-data-reference";
import ViewOnlyEditor from "@/pages/ViewOnlyEditor";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={WorkflowEditor} />
      <Route path="/demo" component={KitelineDemo} />
      <Route path="/docs" component={KitelineDocs} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/account" component={Account} />
      <Route path="/checkout/success" component={Account} />
      <Route path="/internal/x9k7m2p4" component={AdminCodes} />
      <Route path="/mockup/code-data" component={MockupCodeDataReference} />
      <Route path="/view/:shareId" component={ViewOnlyEditor} />
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
