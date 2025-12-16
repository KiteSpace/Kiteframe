import { useState, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Chrome, Github, Check, Loader2, ArrowRight } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';

const LandingPreviewCanvas = lazy(() => import('@/components/landing/LandingPreviewCanvas'));

type WaitlistRole = 'pm' | 'design' | 'engineering' | 'founder';

const ROLE_LABELS: Record<WaitlistRole, string> = {
  pm: 'Product Management',
  design: 'Design',
  engineering: 'Engineering',
  founder: 'Founder / Solo Builder',
};

interface AuthUser {
  id: string;
  email?: string;
  isBeta?: boolean;
  waitlistRequestedAt?: string | null;
}

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WaitlistRole | ''>('');
  const [useCase, setUseCase] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showFullForm, setShowFullForm] = useState(false);

  const { data: user } = useQuery<AuthUser | null>({
    queryKey: ['/api/auth/user'],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: providersData, isLoading: providersLoading } = useQuery<{ providers: string[] }>({
    queryKey: ['/api/auth/available-providers'],
  });

  const availableProviders = providersData?.providers || [];

  const waitlistMutation = useMutation({
    mutationFn: async (data: { email: string; role?: string; useCase?: string }) => {
      return apiRequest('POST', '/api/waitlist', data);
    },
    onSuccess: () => {
      setIsSubmitted(true);
    },
  });

  const handleOAuthLogin = (provider: string) => {
    if (provider === 'google') {
      window.location.href = '/api/auth/google';
    } else if (provider === 'github') {
      window.location.href = '/api/auth/github';
    } else if (provider === 'replit') {
      window.location.href = '/api/login';
    }
  };

  const handleWaitlistSubmit = () => {
    if (!email) return;
    waitlistMutation.mutate({
      email,
      role: role || undefined,
      useCase: useCase || undefined,
    });
  };

  const isAuthenticated = !!user;
  const isOnWaitlist = user?.waitlistRequestedAt;

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 kiteframe-ambient-gradient" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

      <div className="relative z-10">
        <header className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-foreground" data-testid="text-logo">Kiteframe</span>
            <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full" data-testid="badge-beta">
              Private Beta
            </span>
          </div>
          <div>
            {isAuthenticated && user?.isBeta ? (
              <Button onClick={() => window.location.href = '/app'} data-testid="button-enter-app">
                Enter App <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : isAuthenticated && isOnWaitlist ? (
              <span className="text-sm text-muted-foreground" data-testid="text-waitlist-status">
                On the waitlist
              </span>
            ) : null}
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-8 pt-12 pb-24">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div className="pt-8">
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-6" data-testid="text-hero-headline">
                Kiteframe connects design, product, and execution — in one shared workflow.
              </h1>
              <p className="text-xl text-muted-foreground mb-10" data-testid="text-hero-subhead">
                Turn ideas, Figma designs, and conversations into living workflows and PRDs.
              </p>

              {!isSubmitted && !isOnWaitlist && (
                <div className="bg-white dark:bg-card rounded-2xl shadow-xl border border-border/50 p-6" data-testid="waitlist-container">
                  {!showFullForm ? (
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <Input
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-12 flex-1 text-base"
                          data-testid="input-waitlist-email"
                        />
                        <Button
                          onClick={() => email ? setShowFullForm(true) : null}
                          disabled={!email}
                          className="h-12 px-6"
                          data-testid="button-request-access"
                        >
                          Request Access
                        </Button>
                      </div>
                      
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-white dark:bg-card px-2 text-muted-foreground">
                            or sign in with beta access
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        {providersLoading ? (
                          <div className="flex items-center justify-center py-2 w-full">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <>
                            {availableProviders.includes('google') && (
                              <Button
                                variant="outline"
                                className="flex-1 h-11"
                                onClick={() => handleOAuthLogin('google')}
                                data-testid="button-oauth-google"
                              >
                                <Chrome className="h-4 w-4 mr-2" />
                                Google
                              </Button>
                            )}
                            {availableProviders.includes('github') && (
                              <Button
                                variant="outline"
                                className="flex-1 h-11"
                                onClick={() => handleOAuthLogin('github')}
                                data-testid="button-oauth-github"
                              >
                                <Github className="h-4 w-4 mr-2" />
                                GitHub
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4" data-testid="waitlist-form-full">
                      <Input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11"
                        data-testid="input-waitlist-email-full"
                      />

                      <Select value={role} onValueChange={(v) => setRole(v as WaitlistRole)}>
                        <SelectTrigger className="h-11" data-testid="select-waitlist-role">
                          <SelectValue placeholder="How will you use Kiteframe? (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ROLE_LABELS) as WaitlistRole[]).map((r) => (
                            <SelectItem key={r} value={r} data-testid={`option-role-${r}`}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Textarea
                        placeholder="What are you hoping to build? (optional)"
                        value={useCase}
                        onChange={(e) => setUseCase(e.target.value)}
                        className="min-h-[80px] resize-none"
                        data-testid="input-waitlist-usecase"
                      />

                      <div className="flex items-center gap-3">
                        <Button
                          onClick={handleWaitlistSubmit}
                          disabled={!email || waitlistMutation.isPending}
                          className="flex-1 h-11"
                          data-testid="button-join-waitlist"
                        >
                          {waitlistMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Join the Waitlist
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setShowFullForm(false)}
                          className="h-11"
                          data-testid="button-back"
                        >
                          Back
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(isSubmitted || isOnWaitlist) && (
                <div className="bg-white dark:bg-card rounded-2xl shadow-xl border border-border/50 p-8 text-center" data-testid="waitlist-success">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">You're on the list!</h3>
                  <p className="text-muted-foreground">We'll notify you when your access is ready.</p>
                </div>
              )}
            </div>

            <div className="relative">
              <div className="h-[400px] lg:h-[480px] border border-border/50 rounded-xl overflow-hidden shadow-lg bg-white dark:bg-card">
                <Suspense fallback={
                  <div className="w-full h-full flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/50">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                }>
                  <LandingPreviewCanvas />
                </Suspense>
              </div>
              <p className="text-center text-sm text-muted-foreground mt-4" data-testid="text-demo-hint">
                Interactive preview — try dragging the nodes
              </p>
            </div>
          </div>
        </main>

        <section className="max-w-4xl mx-auto px-8 py-16">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-2" data-testid="feature-1">
              <h3 className="font-semibold text-foreground">Design → Workflow → PRD</h3>
              <p className="text-muted-foreground text-sm">Connect your design files directly to product documentation.</p>
            </div>
            <div className="space-y-2" data-testid="feature-2">
              <h3 className="font-semibold text-foreground">AI-assisted, human-controlled</h3>
              <p className="text-muted-foreground text-sm">AI helps generate and refine, but you stay in control.</p>
            </div>
            <div className="space-y-2" data-testid="feature-3">
              <h3 className="font-semibold text-foreground">Built for PMs, Designers, and Builders</h3>
              <p className="text-muted-foreground text-sm">A shared language for cross-functional collaboration.</p>
            </div>
            <div className="space-y-2" data-testid="feature-4">
              <h3 className="font-semibold text-foreground">No lock-in, export everything</h3>
              <p className="text-muted-foreground text-sm">Your workflows and PRDs are always yours to take.</p>
            </div>
          </div>
        </section>

        <footer className="border-t border-border/50 py-8">
          <p className="text-center text-sm text-muted-foreground" data-testid="text-footer">
            Currently in private beta. Features may change.
          </p>
        </footer>
      </div>
    </div>
  );
}
