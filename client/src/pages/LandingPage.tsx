import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import {
  Chrome,
  Github,
  Check,
  Loader2,
  ArrowRight,
  Zap,
  Shield,
  Download,
  Users,
  Palette,
  Code,
  Rocket,
  Terminal,
  Play,
  MessageSquare,
  StickyNote,
  Shapes,
  Type,
  Link2,
  Image as ImageIcon,
  Figma,
  FlaskConical,
  Pencil,
} from "lucide-react";
import { BugReportModal } from "@/components/BugReportModal";
import { GradientOrbs } from "@/components/landing/GradientOrbs";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

const LandingPreviewCanvas = lazy(
  () => import("@/components/landing/LandingPreviewCanvas"),
);
const TypingPrompt = lazy(() => import("@/components/landing/TypingPrompt"));

function LazyCanvasLoader({
  variant,
  className,
}: {
  variant: "hero" | "features" | "objects" | "kiteframe-demo";
  className?: string;
}) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
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
      { rootMargin: "100px" },
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={className}>
      {shouldLoad ? (
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-xl">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <LandingPreviewCanvas variant={variant} />
        </Suspense>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Play className="h-5 w-5" />
            <span className="text-sm">Interactive preview loading…</span>
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
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const { data: user } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: providersData, isLoading: providersLoading } = useQuery<{
    providers: string[];
  }>({
    queryKey: ["/api/auth/available-providers"],
  });

  const availableProviders = providersData?.providers || [];

  const handleOAuthLogin = (provider: string) => {
    if (provider === "google") window.location.href = "/api/auth/google";
    else if (provider === "github") window.location.href = "/api/auth/github";
    else if (provider === "replit") window.location.href = "/api/login";
  };

  const isAuthenticated = !!user;
  const isOnWaitlist = user?.waitlistRequestedAt;

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between bg-[#ffffff]">
          <div className="flex items-center gap-2.5">
            <span className="text-[17px] font-bold text-gray-900 tracking-tight" data-testid="text-logo">
              Kiteframe
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide bg-violet-100 text-violet-700 rounded-full uppercase" data-testid="badge-beta">
              Early Access
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (window.location.href = "/faq")}
              className="text-gray-500 hover:text-gray-900"
              data-testid="button-faq-header"
            >
              FAQ
            </Button>
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFeedbackModal(true)}
                className="text-gray-500 hover:text-gray-900"
                data-testid="button-feedback"
              >
                <MessageSquare className="h-4 w-4 mr-1.5" />
                Feedback
              </Button>
            )}
            {isAuthenticated && user?.isBeta ? (
              <Button
                size="sm"
                onClick={() => (window.location.href = "/app")}
                className="ml-1"
                data-testid="button-enter-app"
              >
                Enter App <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            ) : isAuthenticated && isOnWaitlist ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (window.location.href = "/waitlist")}
                data-testid="button-view-status"
              >
                View Status
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (window.location.href = "/signin")}
                className="text-gray-500 hover:text-gray-900"
                data-testid="button-signin-header"
              >
                Already have an account?{" "}
                <span className="text-violet-600 font-medium ml-1">Sign in</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-16 pb-16">
        <GradientOrbs />

        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-[1fr_1.15fr] gap-12 items-center">

            {/* Left: copy */}
            <div>
              <h1
                className="text-[50px] leading-[1.08] font-extrabold text-gray-900 tracking-tight mb-5"
                data-testid="text-hero-headline"
              >
                Kiteframe helps<br />
                ideas{" "}
                <span style={{ color: "#7c3aed" }}>take flight</span>
              </h1>

              <p
                className="text-lg text-gray-500 leading-relaxed mb-8 max-w-[480px]"
                data-testid="text-hero-subhead"
              >
                An AI-powered visual workflow editor for product alignment,
                connecting designs to execution, and generating PRDs — all in
                one place.
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  size="lg"
                  className="h-12 px-6 gap-2"
                  style={{ backgroundColor: "#7c3aed" }}
                  onClick={() =>
                    document
                      .getElementById("waitlist-section")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  data-testid="button-hero-cta"
                >
                  Create an Account
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-6"
                  onClick={() =>
                    document
                      .getElementById("features-section")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  data-testid="button-hero-learn"
                >
                  Learn More
                </Button>
              </div>
            </div>

            {/* Right: live Kiteframe canvas in window chrome */}
            <div className="relative hidden lg:block">
              <div
                className="rounded-2xl overflow-hidden border border-gray-200"
                style={{ boxShadow: "0 32px 64px -12px rgba(124,58,237,0.13), 0 8px 24px -4px rgba(0,0,0,0.09), 0 0 0 1px rgba(0,0,0,0.04)" }}
              >
                <div className="bg-[#f1f2f4] px-4 py-2.5 flex items-center gap-2 border-b border-gray-200">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                  </div>
                  <span className="text-xs text-gray-400 ml-2">Max Altitude · Kiteframe</span>
                </div>
                <LazyCanvasLoader
                  variant="hero"
                  className="h-[340px] w-full bg-white"
                />
              </div>

              {/* Floating PRD badge */}
              <div
                className="absolute -bottom-4 -left-4 bg-white rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)" }}
              >
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-900">PRD Generated</div>
                  <div className="text-[10px] text-gray-400">2s ago · 1,240 words</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section className="border-y border-gray-100 bg-gray-50/50 py-6">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-3 divide-x divide-gray-200">
            <div className="flex items-center gap-4 px-8 justify-center" data-testid="stat-beta">
              <Shield className="w-5 h-5 text-violet-500 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-gray-900">Early Access</div>
                <div className="text-xs text-gray-500">Exclusive early access</div>
              </div>
            </div>
            <div className="flex items-center gap-4 px-8 justify-center" data-testid="stat-ai">
              <Zap className="w-5 h-5 text-violet-500 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-gray-900">AI-Powered</div>
                <div className="text-xs text-gray-500">Intelligent generation</div>
              </div>
            </div>
            <div className="flex items-center gap-4 px-8 justify-center" data-testid="stat-export">
              <Download className="w-5 h-5 text-violet-500 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-gray-900">Export Everything</div>
                <div className="text-xs text-gray-500">No lock-in, ever</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION A: Ready out-of-the-box ── */}
      <section id="features-section" className="max-w-7xl mx-auto px-6 py-24">
        <div className="flex flex-col gap-12">
          {/* Top row: copy left, checklist right */}
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-xs font-semibold tracking-widest text-violet-600 uppercase mb-3">Canvas</p>
              <h2
                className="text-4xl font-bold text-gray-900 tracking-tight mb-4 leading-tight"
                data-testid="heading-section-a"
              >
                Ready out-of-the-box
              </h2>
              <p className="text-lg text-gray-500 leading-relaxed">
                Drag, zoom, pan, select multiple nodes — everything works from the
                start. No setup required. Just open and start building your workflows.
              </p>
            </div>
            <ul className="space-y-3.5">
              {[
                "Intuitive drag-and-drop interface",
                "Smooth zoom and pan controls",
                "Multi-select and batch editing",
                "Keyboard shortcuts for power users",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-gray-600 text-sm">
                  <span className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-emerald-600" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom row: full-width canvas demo in window chrome */}
          <div
            className="rounded-2xl overflow-hidden border border-gray-200 shadow-lg w-full"
            data-testid="img-workflow-example"
          >
            <div className="bg-[#f1f2f4] px-4 py-2.5 flex items-center gap-2 border-b border-gray-200">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              </div>
              <span className="text-xs text-gray-400 ml-2">Elevating Your Workflows · Kiteframe</span>
            </div>
            <LazyCanvasLoader
              variant="features"
              className="h-[440px] w-full bg-white"
            />
          </div>
        </div>
      </section>

      {/* ── CALLOUT: Not just diagramming ── */}
      <section className="relative overflow-hidden bg-gray-50 border-y border-gray-100 py-20">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px]"
          style={{ background: "radial-gradient(ellipse at center, rgba(139,92,246,0.07) 0%, transparent 70%)" }} />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2
            className="text-4xl font-bold text-gray-900 tracking-tight mb-3 leading-tight"
            data-testid="heading-diagram-nodes"
          >
            Not just the basic diagramming nodes
          </h2>
          <p className="text-lg font-medium text-violet-600 mb-5">A canvas built for real product work</p>
          <p className="text-gray-500 leading-relaxed">
            Kiteframe goes beyond basic boxes and arrows with rich, extensible building blocks designed
            for how teams actually work—supporting structure, logic, data, and context in one unified
            workflow. This isn't just diagramming; it's a system for thinking, aligning, and shipping together.
          </p>
        </div>
      </section>

      {/* ── SECTION B: More than just nodes ── */}
      <section className="bg-gray-50/50 border-b border-gray-100 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Static objects showcase */}
            <div className="order-2 lg:order-1 grid grid-cols-2 gap-3">
              {[
                {
                  icon: StickyNote,
                  iconColor: "#d97706",
                  bg: "#fffbeb",
                  border: "#fde68a",
                  title: "Sticky Notes",
                  sub: "Pin quick thoughts, decisions, or open questions directly onto the canvas.",
                },
                {
                  icon: Shapes,
                  iconColor: "#7c3aed",
                  bg: "#f5f3ff",
                  border: "#ddd6fe",
                  title: "Shapes",
                  sub: "Use boxes, circles, and arrows to group or visually separate areas of your workflow.",
                },
                {
                  icon: Type,
                  iconColor: "#475569",
                  bg: "#f8fafc",
                  border: "#e2e8f0",
                  title: "Text Blocks",
                  sub: "Add headings, labels, and inline commentary anywhere on the canvas.",
                },
                {
                  icon: Link2,
                  iconColor: "#4f46e5",
                  bg: "#eef2ff",
                  border: "#c7d2fe",
                  title: "Link Previews",
                  sub: "Add any URL to embed a live preview card with title, description, and favicon.",
                },
                {
                  icon: ImageIcon,
                  iconColor: "#0891b2",
                  bg: "#ecfeff",
                  border: "#a5f3fc",
                  title: "Images",
                  sub: "Add screenshots, mockups, or diagrams directly on the canvas for context.",
                },
                {
                  icon: Figma,
                  iconColor: "#e95d46",
                  bg: "#fff5f2",
                  border: "#fed7cc",
                  title: "Figma Import",
                  sub: "Import Figma frames as image nodes for easy reference.",
                },
                {
                  icon: FlaskConical,
                  iconColor: "#7c3aed",
                  bg: "#f5f3ff",
                  border: "#ddd6fe",
                  title: "Experiment Nodes",
                  sub: "Explore what-if branches and speculative paths without committing to your main flow.",
                },
                {
                  icon: Pencil,
                  iconColor: "#059669",
                  bg: "#f0fdf4",
                  border: "#a7f3d0",
                  title: "Drawing",
                  sub: "Sketch freehand annotations and shapes directly on the canvas.",
                },
              ].map(({ icon: Icon, iconColor, bg, border, title, sub }) => (
                <div
                  key={title}
                  className="p-4 rounded-xl border flex flex-col gap-3"
                  style={{ backgroundColor: bg, borderColor: border }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "white", border: `1.5px solid ${border}` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: iconColor }} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm mb-1">{title}</div>
                    <div className="text-xs text-gray-500 leading-relaxed">{sub}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="order-1 lg:order-2">
              <p className="text-xs font-semibold tracking-widest text-violet-600 uppercase mb-3">Context</p>
              <h2
                className="text-4xl font-bold text-gray-900 tracking-tight mb-4 leading-tight"
                data-testid="heading-section-b"
              >
                More than just nodes
              </h2>
              <p className="text-lg text-gray-500 mb-6 leading-relaxed">
                Add context to your workflows with sticky notes, shapes, text
                blocks, link previews, images, and Figma imports. Everything
                you need to communicate ideas clearly in one place.
              </p>
              <ul className="space-y-3.5">
                {[
                  "Annotate decisions directly on the canvas",
                  "Embed live link previews from any URL",
                  "Import Figma frames as workflow nodes",
                  "Mix diagrams, images, and text freely",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-600 text-sm">
                    <span className="w-5 h-5 rounded-full bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-violet-600" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION C: AI-assisted ── */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px]"
          style={{ background: "radial-gradient(ellipse at bottom right, rgba(139,92,246,0.07) 0%, transparent 65%)" }} />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-semibold tracking-widest text-violet-600 uppercase mb-3">Intelligence</p>
              <h2
                className="text-4xl font-bold text-gray-900 tracking-tight mb-4 leading-tight"
                data-testid="heading-section-c"
              >
                AI-assisted,<br />human-controlled
              </h2>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Generate workflows from natural language prompts. Analyze Figma
                designs. Create PRDs automatically. The AI helps you move faster
                while you stay in control.
              </p>
              <ul className="space-y-3.5">
                {[
                  "Generate workflows from text descriptions and sketches",
                  "Auto-generate PRDs from workflows",
                  "Test Flight for workflow diagnostics",
                  "Chat with KiteAI to refine and explore ideas",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-600 text-sm">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "#f5f3ff", border: "1px solid #ddd6fe" }}>
                      <Check className="w-3 h-3" style={{ color: "#7c3aed" }} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="flex items-center justify-center h-[280px]"
              data-testid="canvas-section-c"
            >
              <Suspense
                fallback={
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <TypingPrompt />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      {/* ── BUILT FOR SECTION ── */}
      <section className="bg-gray-50/50 border-y border-gray-100 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2
              className="text-4xl font-bold text-gray-900 tracking-tight mb-3"
              data-testid="heading-built-for"
            >
              Built for cross-functional teams
            </h2>
            <p className="text-lg text-gray-500">
              A shared language for everyone involved in building products.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Users,   color: "#3b82f6", bg: "#eff6ff", border: "#dbeafe", title: "Product Managers", sub: "From concept to PRD in one tool",    testid: "card-pm" },
              { icon: Palette, color: "#ec4899", bg: "#fdf2f8", border: "#fce7f3", title: "Designers",        sub: "Connect Figma to execution",          testid: "card-design" },
              { icon: Code,    color: "#10b981", bg: "#f0fdf4", border: "#d1fae5", title: "Engineers",        sub: "Clear requirements, no ambiguity",    testid: "card-engineering" },
              { icon: Rocket,  color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", title: "Founders",         sub: "Move fast without losing context",    testid: "card-founder" },
            ].map(({ icon: Icon, color, bg, border, title, sub, testid }) => (
              <div
                key={title}
                className="rounded-2xl p-6 border text-center"
                style={{ backgroundColor: bg, borderColor: border }}
                data-testid={testid}
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: "white", border: `1.5px solid ${border}` }}>
                  <Icon className="w-6 h-6" style={{ color }} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1.5">{title}</h3>
                <p className="text-sm text-gray-500">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WAITLIST / CREATE ACCOUNT ── */}
      <section id="waitlist-section" className="bg-violet-50 py-24">
        <div className="max-w-lg mx-auto px-6 text-center">
          <h2
            className="text-4xl font-bold text-gray-900 tracking-tight mb-8"
            data-testid="heading-waitlist"
          >
            Create an Account
          </h2>

          {!isOnWaitlist && (
            <div data-testid="waitlist-container" className="space-y-3 mb-6">
              {providersLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  {availableProviders.includes("google") && (
                    <button
                      className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl text-sm font-medium text-gray-900 border border-gray-200 hover:border-gray-400 hover:bg-white transition-colors"
                      onClick={() => handleOAuthLogin("google")}
                      data-testid="button-waitlist-google"
                    >
                      <Chrome className="w-5 h-5" />
                      Continue with Google
                    </button>
                  )}
                  {availableProviders.includes("github") && (
                    <button
                      className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl text-sm font-medium text-gray-900 border border-gray-200 hover:border-gray-400 hover:bg-white transition-colors"
                      onClick={() => handleOAuthLogin("github")}
                      data-testid="button-waitlist-github"
                    >
                      <Github className="w-5 h-5" />
                      Continue with GitHub
                    </button>
                  )}
                  {availableProviders.includes("replit") && (
                    <button
                      className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl text-sm font-medium text-gray-900 border border-gray-200 hover:border-gray-400 hover:bg-white transition-colors"
                      onClick={() => handleOAuthLogin("replit")}
                      data-testid="button-waitlist-replit"
                    >
                      <Terminal className="w-5 h-5" />
                      Continue with Replit
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {isOnWaitlist && (
            <div
              className="mb-6 rounded-2xl border border-gray-200 bg-white p-8 text-center"
              data-testid="waitlist-success"
            >
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">You're on the list!</h3>
              <p className="text-gray-500 mb-4">We'll notify you when your access is ready.</p>
              <button
                className="px-5 py-2 rounded-lg text-sm font-medium text-gray-900 border border-gray-200 hover:border-gray-400 transition-colors"
                onClick={() => (window.location.href = "/waitlist")}
                data-testid="button-view-waitlist-status"
              >
                View Your Status
              </button>
            </div>
          )}

          <p className="text-xs text-gray-500 mb-2">Already have an account? Just sign in above.</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            By continuing, you acknowledge that you agree to Kiteframe's{" "}
            <a href="/legal#terms" className="underline cursor-pointer hover:text-gray-600 transition-colors" data-testid="link-waitlist-terms">
              Terms and Conditions
            </a>{" "}
            and{" "}
            <a href="/legal#privacy" className="underline cursor-pointer hover:text-gray-600 transition-colors" data-testid="link-waitlist-privacy">
              Privacy Policy
            </a>.
          </p>
        </div>
      </section>

      <SiteFooter />

      {showFeedbackModal && (
        <BugReportModal onClose={() => setShowFeedbackModal(false)} />
      )}
    </div>
  );
}
