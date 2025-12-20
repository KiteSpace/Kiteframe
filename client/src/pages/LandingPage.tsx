import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Chrome, Github, Check, Loader2, ArrowRight, Zap, Shield, Download, Users, Palette, Code, Rocket, Terminal, Play } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import workflowScreenshot from '@assets/Screenshot_2025-12-19_at_3.34.24_PM_1766188467311.png';
import nodeRadialMenu from '@assets/Screenshot_2025-12-19_at_4.20.12_PM_1766190106510.png';
import compoundNode from '@assets/Screenshot_2025-12-19_at_4.20.29_PM_1766190106509.png';

const LandingPreviewCanvas = lazy(() => import('@/components/landing/LandingPreviewCanvas'));
const FloatingShapes = lazy(() => import('@/components/landing/FloatingShapes'));
const TypingPrompt = lazy(() => import('@/components/landing/TypingPrompt'));

function LazyCanvasLoader({ variant, className }: { variant: 'hero' | 'features' | 'objects'; className?: string }) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Feature detect IntersectionObserver - fall back to immediate load if unavailable
    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <div ref={containerRef} className={className}>
      {shouldLoad ? (
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-xl">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }>
          <LandingPreviewCanvas variant={variant} />
        </Suspense>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Play className="h-5 w-5" />
            <span className="text-sm">Interactive preview loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface AuthUser {
  id: string;
  email?: string;
  isBeta?: boolean;
  isAdmin?: boolean;
  waitlistRequestedAt?: string | null;
}

export default function LandingPage() {
  const { data: user } = useQuery<AuthUser | null>({
    queryKey: ['/api/auth/user'],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: providersData, isLoading: providersLoading } = useQuery<{ providers: string[] }>({
    queryKey: ['/api/auth/available-providers'],
  });

  const availableProviders = providersData?.providers || [];

  const handleOAuthLogin = (provider: string) => {
    if (provider === 'google') {
      window.location.href = '/api/auth/google';
    } else if (provider === 'github') {
      window.location.href = '/api/auth/github';
    } else if (provider === 'replit') {
      window.location.href = '/api/login';
    }
  };

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
              <Button variant="ghost" onClick={() => window.location.href = '/waitlist'} data-testid="button-view-status">
                View Status
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => window.location.href = '/signin'} data-testid="button-signin-header">
                Already a Beta user? Sign in
              </Button>
            )}
          </div>
        </header>

        {/* Hero Section */}
        <section className="pt-12 pb-8">
          <div className="max-w-7xl mx-auto px-8">
            <div className="text-center max-w-3xl mx-auto mb-8">
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-6" data-testid="text-hero-headline">
                Wire your ideas with Kiteframe
              </h1>
              <p className="text-xl text-muted-foreground mb-8" data-testid="text-hero-subhead">
                A visual workflow editor for building interactive diagrams, connecting designs to execution, and generating PRDs — all in one place.
              </p>
              
              <div className="flex flex-wrap gap-3 justify-center">
                <Button size="lg" className="h-12 px-8" onClick={() => document.getElementById('waitlist-section')?.scrollIntoView({ behavior: 'smooth' })} data-testid="button-hero-cta">
                  Request Beta Access
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-8" onClick={() => document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' })} data-testid="button-hero-learn">
                  Learn More
                </Button>
              </div>
              
              {!isAuthenticated && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Already a Beta user?{' '}
                  <a 
                    href="/signin" 
                    className="text-violet-600 hover:text-violet-700 dark:text-violet-400 font-medium underline-offset-4 hover:underline"
                    data-testid="link-signin-hero"
                  >
                    Sign in
                  </a>
                </p>
              )}
            </div>
          </div>

          <div className="w-full mt-8">
            <LazyCanvasLoader variant="hero" className="h-[400px] md:h-[500px] lg:h-[600px] w-full" />
            <p className="text-center text-sm text-muted-foreground mt-4" data-testid="text-demo-hint">
              Mission Critical Initiative — Two paths, one outcome
            </p>
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
            <div className="flex items-center justify-center">
              <img 
                src={workflowScreenshot} 
                alt="Kiteframe workflow example showing connected nodes" 
                className="rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 max-h-[300px] object-contain"
                data-testid="img-workflow-example"
              />
            </div>
          </div>
        </section>

        {/* Section: More Than Standard Diagram Nodes */}
        <section className="bg-slate-50/50 dark:bg-slate-900/30 py-20">
          <div className="max-w-5xl mx-auto px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-2" data-testid="heading-diagram-nodes">
                More Than Standard Diagram Nodes
              </h2>
              <p className="text-xl text-muted-foreground mb-4">
                A canvas built for real product work
              </p>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Kiteframe goes beyond basic boxes and arrows with rich, extensible building blocks designed for how teams actually work—supporting structure, logic, data, and context in one unified workflow. This isn't just diagramming; it's a system for thinking, aligning, and shipping together.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex items-center justify-center">
                <img 
                  src={nodeRadialMenu} 
                  alt="Node with radial editing menu" 
                  className="rounded-xl max-h-[400px] object-contain"
                  data-testid="img-radial-menu"
                />
              </div>
              <div className="flex items-center justify-center">
                <img 
                  src={compoundNode} 
                  alt="Compound node with embedded content" 
                  className="rounded-xl max-h-[400px] object-contain"
                  data-testid="img-compound-node"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section B: Canvas Objects */}
        <section className="bg-slate-50/50 dark:bg-slate-900/30 py-20">
          <div className="max-w-7xl mx-auto px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <LazyCanvasLoader variant="objects" className="order-2 lg:order-1 h-[240px] rounded-xl overflow-hidden" />
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
            Sign in to request access. We'll notify you when your spot is ready.
          </p>

          {!isOnWaitlist && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6" data-testid="waitlist-container">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center mb-2">
                  Choose how you'd like to sign in to join the waitlist
                </p>

                {providersLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableProviders.includes('google') && (
                      <Button
                        variant="outline"
                        className="w-full h-12 text-base font-medium border-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => handleOAuthLogin('google')}
                        data-testid="button-waitlist-google"
                      >
                        <Chrome className="h-5 w-5 mr-3" />
                        Continue with Google
                      </Button>
                    )}
                    {availableProviders.includes('github') && (
                      <Button
                        variant="outline"
                        className="w-full h-12 text-base font-medium border-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => handleOAuthLogin('github')}
                        data-testid="button-waitlist-github"
                      >
                        <Github className="h-5 w-5 mr-3" />
                        Continue with GitHub
                      </Button>
                    )}
                    {availableProviders.includes('replit') && (
                      <Button
                        variant="outline"
                        className="w-full h-12 text-base font-medium border-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => handleOAuthLogin('replit')}
                        data-testid="button-waitlist-replit"
                      >
                        <Terminal className="h-5 w-5 mr-3" />
                        Continue with Replit
                      </Button>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-center pt-2">
                  Already have beta access? Just sign in above.
                </p>
              </div>
            </div>
          )}

          {isOnWaitlist && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center" data-testid="waitlist-success">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">You're on the list!</h3>
              <p className="text-muted-foreground mb-4">We'll notify you when your access is ready.</p>
              <Button variant="outline" onClick={() => window.location.href = '/waitlist'} data-testid="button-view-waitlist-status">
                View Your Status
              </Button>
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
