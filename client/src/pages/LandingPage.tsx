import { useState, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Chrome, Github, Check, Loader2 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FullBleedSection } from '@/components/layout/FullBleedSection';
import { apiRequest } from '@/lib/queryClient';

const LandingPreviewCanvas = lazy(() => import('@/components/landing/LandingPreviewCanvas'));

type WaitlistRole = 'pm' | 'design' | 'engineering' | 'founder';

const ROLE_LABELS: Record<WaitlistRole, string> = {
  pm: 'Product Management',
  design: 'Design',
  engineering: 'Engineering',
  founder: 'Founder / Solo Builder',
};

export default function LandingPage() {
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WaitlistRole | ''>('');
  const [useCase, setUseCase] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

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

  return (
    <div className="min-h-screen bg-background">
      <FullBleedSection className="min-h-[70vh]">
        <div className="absolute inset-0 kiteframe-ambient-gradient" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

        <div className="relative z-10 py-20 pb-32 flex flex-col items-center max-w-6xl mx-auto px-6">
          <div
            className="relative w-full max-w-3xl bg-white dark:bg-card rounded-2xl shadow-xl border border-border/50"
            style={{ minHeight: '320px' }}
          >
            <div className="p-8">
              <h1 className="text-2xl font-bold text-foreground mb-3" data-testid="text-landing-headline">
                What would you like to build with Kiteframe?
              </h1>
              <p className="text-muted-foreground mb-8" data-testid="text-landing-subhead">
                Kiteframe is currently in private beta. Sign in if you have access, or request early access below.
              </p>

              {!showWaitlistForm && !isSubmitted && (
                <>
                  <div className="space-y-3 mb-6">
                    {providersLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        {availableProviders.includes('google') && (
                          <Button
                            variant="outline"
                            className="w-full h-12"
                            onClick={() => handleOAuthLogin('google')}
                            data-testid="button-beta-google"
                          >
                            <Chrome className="h-5 w-5 mr-3" />
                            Continue with Beta Access
                          </Button>
                        )}
                        {!availableProviders.includes('google') && availableProviders.includes('github') && (
                          <Button
                            variant="outline"
                            className="w-full h-12"
                            onClick={() => handleOAuthLogin('github')}
                            data-testid="button-beta-github"
                          >
                            <Github className="h-5 w-5 mr-3" />
                            Continue with Beta Access
                          </Button>
                        )}
                        {availableProviders.length === 0 && (
                          <Button
                            variant="outline"
                            className="w-full h-12"
                            onClick={() => handleOAuthLogin('google')}
                            data-testid="button-beta-default"
                          >
                            Continue with Beta Access
                          </Button>
                        )}
                      </>
                    )}
                  </div>

                  <div className="text-center">
                    <button
                      onClick={() => setShowWaitlistForm(true)}
                      className="text-sm text-primary hover:underline font-medium"
                      data-testid="button-request-access"
                    >
                      Request Early Access
                    </button>
                  </div>
                </>
              )}

              {showWaitlistForm && !isSubmitted && (
                <div className="space-y-4" data-testid="waitlist-form">
                  <div>
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11"
                      data-testid="input-waitlist-email"
                    />
                  </div>

                  <div>
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
                  </div>

                  <div>
                    <Textarea
                      placeholder="What are you hoping to build? (optional)"
                      value={useCase}
                      onChange={(e) => setUseCase(e.target.value)}
                      className="min-h-[80px] resize-none"
                      data-testid="input-waitlist-usecase"
                    />
                  </div>

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
                      onClick={() => setShowWaitlistForm(false)}
                      className="h-11"
                      data-testid="button-cancel-waitlist"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {isSubmitted && (
                <div className="text-center py-8" data-testid="waitlist-success">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">You're on the list!</h3>
                  <p className="text-muted-foreground">We'll be in touch when your access is ready.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </FullBleedSection>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold mb-4" data-testid="text-preview-headline">
            From design to PRD — without the disconnect
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto" data-testid="text-preview-body">
            Kiteframe connects design intent, product reasoning, and execution into a single workflow. No more lost context between tools.
          </p>
        </div>

        <div className="h-[300px] border border-border/50 rounded-xl overflow-hidden shadow-lg">
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/50">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }>
            <LandingPreviewCanvas />
          </Suspense>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Interactive preview — try dragging the nodes
        </p>
      </div>
    </div>
  );
}
