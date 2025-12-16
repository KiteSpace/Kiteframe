import { useState, lazy, Suspense, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Chrome, Github, Check, Loader2, ArrowRight, Zap, Shield, Download, Users, Palette, Code, Rocket, Terminal } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: {
        sitekey: string;
        callback?: (token: string) => void;
        'error-callback'?: () => void;
        'expired-callback'?: () => void;
        theme?: 'light' | 'dark' | 'auto';
        size?: 'normal' | 'compact';
      }) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const LandingPreviewCanvas = lazy(() => import('@/components/landing/LandingPreviewCanvas'));
const FloatingShapes = lazy(() => import('@/components/landing/FloatingShapes'));
const TypingPrompt = lazy(() => import('@/components/landing/TypingPrompt'));

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

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WaitlistRole | ''>('');
  const [useCase, setUseCase] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showFullForm, setShowFullForm] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [honeypot, setHoneypot] = useState('');
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const { data: user } = useQuery<AuthUser | null>({
    queryKey: ['/api/auth/user'],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: providersData, isLoading: providersLoading } = useQuery<{ providers: string[] }>({
    queryKey: ['/api/auth/available-providers'],
  });

  const availableProviders = providersData?.providers || [];

  const initTurnstile = useCallback(() => {
    if (!turnstileRef.current || !window.turnstile || !TURNSTILE_SITE_KEY) return;
    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
    }
    widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => setTurnstileToken(token),
      'expired-callback': () => setTurnstileToken(''),
      'error-callback': () => setTurnstileToken(''),
      theme: 'auto',
    });
  }, []);

  useEffect(() => {
    if (!showFullForm || !TURNSTILE_SITE_KEY) return;

    if (window.turnstile) {
      initTurnstile();
    } else {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setTimeout(initTurnstile, 100);
      };
      document.head.appendChild(script);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [showFullForm, initTurnstile]);

  const waitlistMutation = useMutation({
    mutationFn: async (data: { email: string; role?: string; useCase?: string; turnstileToken?: string; hp?: string }) => {
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
    if (honeypot) return;
    waitlistMutation.mutate({
      email,
      role: role || undefined,
      useCase: useCase || undefined,
      turnstileToken: turnstileToken || undefined,
      hp: honeypot || undefined,
    });
  };

  const canSubmit = email && (!TURNSTILE_SITE_KEY || turnstileToken);

  const isAuthenticated = !!user;
  const isOnWaitlist = user?.waitlistRequestedAt;

  return (
    <div className="min-h-screen relative bg-white dark:bg-slate-950">
      <Suspense fallback={null}>
        <FloatingShapes />
      </Suspense>

      <div className="relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-foreground" data-testid="text-logo">Kiteframe</span>
            <span className="px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 rounded-full" data-testid="badge-beta">
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

        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-8 pt-12 pb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-6" data-testid="text-hero-headline">
                Wire your ideas with Kiteframe
              </h1>
              <p className="text-xl text-muted-foreground mb-8" data-testid="text-hero-subhead">
                A visual workflow editor for building interactive diagrams, connecting designs to execution, and generating PRDs — all in one place.
              </p>
              
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="h-12 px-8" onClick={() => document.getElementById('waitlist-section')?.scrollIntoView({ behavior: 'smooth' })} data-testid="button-hero-cta">
                  Request Beta Access
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-8" onClick={() => document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' })} data-testid="button-hero-learn">
                  Learn More
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="h-[360px] lg:h-[400px] rounded-xl overflow-hidden" data-testid="hero-canvas-container">
                <Suspense fallback={
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                }>
                  <LandingPreviewCanvas variant="hero" />
                </Suspense>
              </div>
              <p className="text-center text-sm text-muted-foreground mt-4" data-testid="text-demo-hint">
                Interactive preview — try dragging the nodes
              </p>
            </div>
          </div>
        </section>

        {/* Stats Strip */}
        <section className="border-y border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 py-8">
          <div className="max-w-5xl mx-auto px-8">
            <div className="flex flex-wrap justify-center gap-8 md:gap-16">
              <div className="flex items-center gap-3" data-testid="stat-beta">
                <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Private Beta</div>
                  <div className="text-sm text-muted-foreground">Exclusive early access</div>
                </div>
              </div>
              <div className="flex items-center gap-3" data-testid="stat-ai">
                <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">AI-Powered</div>
                  <div className="text-sm text-muted-foreground">Intelligent generation</div>
                </div>
              </div>
              <div className="flex items-center gap-3" data-testid="stat-export">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Export Everything</div>
                  <div className="text-sm text-muted-foreground">No lock-in, ever</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section A: Ready out-of-the-box */}
        <section id="features-section" className="max-w-7xl mx-auto px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="heading-section-a">
                Ready out-of-the-box
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Drag, zoom, pan, select multiple nodes — everything works from the start. No setup required. Just open and start building your workflows.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span>Intuitive drag-and-drop interface</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span>Smooth zoom and pan controls</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span>Multi-select and batch editing</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <Check className="w-5 h-5 text-emerald-500" />
                  <span>Keyboard shortcuts for power users</span>
                </li>
              </ul>
            </div>
            <div className="h-[240px] rounded-xl overflow-hidden" data-testid="canvas-section-a">
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }>
                <LandingPreviewCanvas variant="features" />
              </Suspense>
            </div>
          </div>
        </section>

        {/* Section B: Canvas Objects */}
        <section className="bg-slate-50/50 dark:bg-slate-900/30 py-20">
          <div className="max-w-7xl mx-auto px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1 h-[240px] rounded-xl overflow-hidden" data-testid="canvas-section-b">
                <Suspense fallback={
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                }>
                  <LandingPreviewCanvas variant="objects" />
                </Suspense>
              </div>
              <div className="order-1 lg:order-2">
                <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="heading-section-b">
                  More than just nodes
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Add context to your workflows with sticky notes, shapes, text annotations, and link previews. Everything you need to communicate ideas clearly.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="w-8 h-8 rounded bg-yellow-100 dark:bg-yellow-900/50 mb-2" />
                    <div className="font-medium text-foreground">Sticky Notes</div>
                    <div className="text-sm text-muted-foreground">Quick annotations</div>
                  </div>
                  <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/50 mb-2" />
                    <div className="font-medium text-foreground">Shapes</div>
                    <div className="text-sm text-muted-foreground">Visual grouping</div>
                  </div>
                  <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="w-8 h-2 rounded bg-slate-300 dark:bg-slate-600 mb-4 mt-2" />
                    <div className="font-medium text-foreground">Text</div>
                    <div className="text-sm text-muted-foreground">Labels & headers</div>
                  </div>
                  <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="w-8 h-8 rounded bg-indigo-100 dark:bg-indigo-900/50 mb-2 flex items-center justify-center text-xs text-indigo-600">🔗</div>
                    <div className="font-medium text-foreground">Link Previews</div>
                    <div className="text-sm text-muted-foreground">External resources</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section C: AI-assisted */}
        <section className="max-w-7xl mx-auto px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="heading-section-c">
                AI-assisted, human-controlled
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Generate workflows from natural language prompts. Analyze Figma designs. Create PRDs automatically. The AI helps you move faster while you stay in control.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <Check className="w-5 h-5 text-violet-500" />
                  <span>Generate workflows from text descriptions</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <Check className="w-5 h-5 text-violet-500" />
                  <span>Import and analyze Figma designs</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <Check className="w-5 h-5 text-violet-500" />
                  <span>Auto-generate PRDs from workflows</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <Check className="w-5 h-5 text-violet-500" />
                  <span>Privacy-first with local AI options</span>
                </li>
              </ul>
            </div>
            <div className="flex items-center justify-center h-[280px]" data-testid="canvas-section-c">
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }>
                <TypingPrompt />
              </Suspense>
            </div>
          </div>
        </section>

        {/* Built For Section */}
        <section className="bg-slate-50/50 dark:bg-slate-900/30 py-20">
          <div className="max-w-5xl mx-auto px-8">
            <h2 className="text-3xl font-bold text-foreground text-center mb-4" data-testid="heading-built-for">
              Built for cross-functional teams
            </h2>
            <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              A shared language for everyone involved in building products.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center" data-testid="card-pm">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Product Managers</h3>
                <p className="text-sm text-muted-foreground">From concept to PRD in one tool</p>
              </div>
              <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center" data-testid="card-design">
                <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center mx-auto mb-4">
                  <Palette className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Designers</h3>
                <p className="text-sm text-muted-foreground">Connect Figma to execution</p>
              </div>
              <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center" data-testid="card-engineering">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mx-auto mb-4">
                  <Code className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Engineers</h3>
                <p className="text-sm text-muted-foreground">Clear requirements, no ambiguity</p>
              </div>
              <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center" data-testid="card-founder">
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mx-auto mb-4">
                  <Rocket className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Founders</h3>
                <p className="text-sm text-muted-foreground">Move fast without losing context</p>
              </div>
            </div>
          </div>
        </section>

        {/* Waitlist Section */}
        <section id="waitlist-section" className="max-w-xl mx-auto px-8 py-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-4" data-testid="heading-waitlist">
            Join the private beta
          </h2>
          <p className="text-lg text-muted-foreground text-center mb-8">
            Be among the first to experience Kiteframe.
          </p>

          {!isSubmitted && !isOnWaitlist && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6" data-testid="waitlist-container">
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
                      <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white dark:bg-slate-900 px-2 text-muted-foreground">
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
                        {availableProviders.includes('replit') && (
                          <Button
                            variant="outline"
                            className="flex-1 h-11"
                            onClick={() => handleOAuthLogin('replit')}
                            data-testid="button-oauth-replit"
                          >
                            <Terminal className="h-4 w-4 mr-2" />
                            Replit
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

                  {/* Honeypot field - hidden from users, catches bots */}
                  <div className="absolute -left-[9999px]" aria-hidden="true">
                    <input
                      type="text"
                      name="website"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  {/* Turnstile CAPTCHA widget */}
                  {TURNSTILE_SITE_KEY && (
                    <div className="flex justify-center" data-testid="turnstile-container">
                      <div ref={turnstileRef} />
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleWaitlistSubmit}
                      disabled={!canSubmit || waitlistMutation.isPending}
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center" data-testid="waitlist-success">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">You're on the list!</h3>
              <p className="text-muted-foreground">We'll notify you when your access is ready.</p>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
          <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Kiteframe</span>
              <span className="text-sm text-muted-foreground">· Private Beta</span>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-footer">
              Currently in private beta. Features may change.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
