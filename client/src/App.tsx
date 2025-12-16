import { useEffect, lazy, Suspense } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient, getQueryFn } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PromptContextStoreProvider } from "@/contexts/PromptContextStore";
import { Loader2 } from "lucide-react";
import WorkflowEditor from "@/pages/workflow-editor";
import KitelineDemo from "@/pages/kiteline-demo";
import KitelineDocs from "@/pages/kiteline-docs";
import AdminCodes from "@/pages/AdminCodes";
import Pricing from "@/pages/Pricing";
import Account from "@/pages/Account";
import MockupCodeDataReference from "@/pages/mockup-code-data-reference";
import ViewOnlyViewer from "@/pages/ViewOnlyViewer";
import NotFound from "@/pages/not-found";

const LandingPage = lazy(() => import("@/pages/LandingPage"));

interface AuthUser {
  id: string;
  email?: string;
  isBeta?: boolean;
  waitlistRequestedAt?: string | null;
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function BetaProtectedRoute<P extends object>({ 
  component: Component,
  componentProps 
}: { 
  component: React.ComponentType<P>;
  componentProps?: P;
}) {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ['/api/auth/user'],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Redirect to="/" />;
  }

  if (!user.isBeta) {
    return <Redirect to="/" />;
  }

  return <Component {...(componentProps as P)} />;
}

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

function LandingRoute() {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ['/api/auth/user'],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (user?.isBeta) {
    return <Redirect to="/app" />;
  }

  return <LandingPage />;
}

function Router() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        <Route path="/">
          <LandingRoute />
        </Route>
        <Route path="/app">
          <BetaProtectedRoute component={WorkflowEditor} />
        </Route>
        <Route path="/project/:projectUuid">
          {(params: { projectUuid: string }) => (
            <BetaProtectedRoute 
              component={WorkflowEditor}
            />
          )}
        </Route>
        <Route path="/demo" component={KitelineDemo} />
        <Route path="/docs" component={KitelineDocs} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/account">
          <BetaProtectedRoute component={Account} />
        </Route>
        <Route path="/checkout/success">
          <BetaProtectedRoute component={Account} />
        </Route>
        <Route path="/internal/x9k7m2p4" component={AdminCodes} />
        <Route path="/mockup/code-data" component={MockupCodeDataReference} />
        <Route path="/view/:shareId" component={ViewOnlyViewer} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
