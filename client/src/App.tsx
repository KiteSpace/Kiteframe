import { useEffect, lazy, Suspense } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient, getQueryFn } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PromptContextStoreProvider } from "@/contexts/PromptContextStore";
import { FeatureFlagProvider } from "@/contexts/FeatureFlagContext";
import { AiJobsProvider, useAiJobs } from "@/contexts/AiJobsContext";
import { AiJobsIndicator } from "@/components/AiJobsIndicator";
import { setAiJobHooks } from "@/ai/OpenAICompatClient";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import { PageViewTracker } from "@/components/PageViewTracker";
import { CookieBanner } from "@/components/CookieBanner";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { WelcomeModal } from "@/components/WelcomeModal";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const WorkflowEditor = lazy(() => import("@/pages/workflow-editor"));
const KitelineDemo = lazy(() => import("@/pages/kiteline-demo"));
const KitelineDocs = lazy(() => import("@/pages/kiteline-docs"));
const AdminCodes = lazy(() => import("@/pages/AdminCodes"));
const AdminUserDetails = lazy(() => import("@/pages/AdminUserDetails"));
const AdminGroupDetails = lazy(() => import("@/pages/AdminGroupDetails"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const CheckoutSuccess = lazy(() => import("@/pages/CheckoutSuccess"));
const Account = lazy(() => import("@/pages/Account"));
const SignIn = lazy(() => import("@/pages/SignIn"));
const WaitlistDashboard = lazy(() => import("@/pages/WaitlistDashboard"));
const AuthComplete = lazy(() => import("@/pages/AuthComplete"));
const MockupCodeDataReference = lazy(() => import("@/pages/mockup-code-data-reference"));
const ViewOnlyViewer = lazy(() => import("@/pages/ViewOnlyViewer"));
const Benchmark = lazy(() => import("@/pages/Benchmark"));
const DevDocs = lazy(() => import("@/pages/DevDocs"));
const Legal = lazy(() => import("@/pages/Legal"));
const FullScreenChat = lazy(() => import("@/pages/FullScreenChat"));
const FAQ = lazy(() => import("@/pages/FAQ"));

interface AuthUser {
  id: string;
  email?: string;
  firstName?: string;
  isBeta?: boolean;
  isAdmin?: boolean;
  isNewUser?: boolean;
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
    return <Redirect to="/signin" />;
  }

  // Admin users always have full access, regardless of beta status
  if (!user.isBeta && !user.isAdmin) {
    return <Redirect to="/waitlist" />;
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

  // Admin or beta users go directly to app
  if (user?.isBeta || user?.isAdmin) {
    return <Redirect to="/app" />;
  }

  // Authenticated non-beta/non-admin users go to waitlist dashboard
  if (user && !user.isBeta && !user.isAdmin) {
    return <Redirect to="/waitlist" />;
  }

  return <LandingPage />;
}

function Router() {
  return (
    <>
      <PageViewTracker />
      <Suspense fallback={<LoadingFallback />}>
        <Switch>
        <Route path="/">
          <LandingRoute />
        </Route>
        <Route path="/app/chat">
          <BetaProtectedRoute component={FullScreenChat} />
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
        <Route path="/signin" component={SignIn} />
        <Route path="/auth-complete" component={AuthComplete} />
        <Route path="/waitlist" component={WaitlistDashboard} />
        <Route path="/demo" component={KitelineDemo} />
        <Route path="/docs" component={KitelineDocs} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/account">
          <BetaProtectedRoute component={Account} />
        </Route>
        <Route path="/checkout/success">
          <BetaProtectedRoute component={CheckoutSuccess} />
        </Route>
        <Route path="/internal/x9k7m2p4" component={AdminCodes} />
        <Route path="/internal/x9k7m2p4/users/:userId" component={AdminUserDetails} />
        <Route path="/internal/x9k7m2p4/groups/:groupId" component={AdminGroupDetails} />
        <Route path="/internal/docs" component={DevDocs} />
        <Route path="/mockup/code-data" component={MockupCodeDataReference} />
        <Route path="/view/:shareId" component={ViewOnlyViewer} />
        <Route path="/benchmark" component={Benchmark} />
        <Route path="/legal" component={Legal} />
        <Route path="/faq" component={FAQ} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
    </>
  );
}

// Bridges the AiJobs context into the OpenAICompatClient module so that the
// client (which is plain JS, not a React component) can register/clear pending
// jobs and rehydrate them after navigation via the persistent indicator.
function AiJobHooksBridge() {
  const { registerJob, clearJob } = useAiJobs();
  useEffect(() => {
    setAiJobHooks({ register: registerJob, clear: clearJob });
    return () => setAiJobHooks(null);
  }, [registerJob, clearJob]);
  return null;
}

function App() {
  useCleanupQueryParams();
  
  return (
    <QueryClientProvider client={queryClient}>
      <FeatureFlagProvider>
        <AiJobsProvider>
          <PromptContextStoreProvider>
            <TooltipProvider>
              <AiJobHooksBridge />
              <Toaster />
              <AnnouncementBanner />
              <WelcomeModal />
              <Router />
              <CookieBanner />
              <AiJobsIndicator />
            </TooltipProvider>
          </PromptContextStoreProvider>
        </AiJobsProvider>
      </FeatureFlagProvider>
    </QueryClientProvider>
  );
}

export default App;
