import { Check, ArrowRight, Zap, Shield, Download, Users, Palette, Code, Rocket, Github, Chrome, Terminal, MessageSquare } from "lucide-react";

// Inline SVG workflow diagram for hero visual
function WorkflowDiagram() {
  return (
    <svg viewBox="0 0 520 380" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <filter id="shadow1" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#0000001a" />
        </filter>
        <filter id="shadow2" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#0000001a" />
        </filter>
      </defs>

      {/* Background canvas hint */}
      <rect width="520" height="380" rx="16" fill="#f8f9fb" />

      {/* Grid dots */}
      {Array.from({ length: 8 }).map((_, row) =>
        Array.from({ length: 11 }).map((_, col) => (
          <circle key={`${row}-${col}`} cx={col * 52 + 8} cy={row * 50 + 8} r="1.5" fill="#d1d5db" />
        ))
      )}

      {/* Edge: Start → Process */}
      <path d="M 145 80 C 185 80 195 120 235 120" stroke="#c4b5fd" strokeWidth="2" strokeDasharray="none" fill="none" />
      <polygon points="233,115 240,120 233,125" fill="#c4b5fd" />

      {/* Edge: Process → AI Node */}
      <path d="M 335 120 C 375 120 375 195 350 210" stroke="#c4b5fd" strokeWidth="2" fill="none" />
      <polygon points="347,207 354,213 348,218" fill="#c4b5fd" />

      {/* Edge: AI Node → Output */}
      <path d="M 350 250 C 350 270 380 280 400 290" stroke="#7c3aed" strokeWidth="2" fill="none" />
      <polygon points="398,286 404,292 397,295" fill="#7c3aed" />

      {/* Edge: Start → Condition */}
      <path d="M 80 100 C 80 185 110 210 120 230" stroke="#c4b5fd" strokeWidth="2" strokeDasharray="5,3" fill="none" />

      {/* Node: Start */}
      <rect x="20" y="54" width="125" height="52" rx="12" fill="white" filter="url(#shadow2)" />
      <rect x="20" y="54" width="125" height="52" rx="12" stroke="#e5e7eb" strokeWidth="1.5" />
      <rect x="20" y="54" width="4" height="52" rx="2" fill="#7c3aed" />
      <text x="38" y="74" fontSize="10" fill="#6b7280" fontFamily="system-ui">INPUT</text>
      <text x="38" y="90" fontSize="12" fontWeight="600" fill="#111827" fontFamily="system-ui">User Request</text>
      <circle cx="131" cy="80" r="4" fill="white" stroke="#d1d5db" strokeWidth="1.5" />

      {/* Node: Process */}
      <rect x="235" y="94" width="100" height="52" rx="12" fill="white" filter="url(#shadow2)" />
      <rect x="235" y="94" width="100" height="52" rx="12" stroke="#e5e7eb" strokeWidth="1.5" />
      <rect x="235" y="94" width="4" height="52" rx="2" fill="#3b82f6" />
      <text x="253" y="114" fontSize="10" fill="#6b7280" fontFamily="system-ui">PROCESS</text>
      <text x="253" y="130" fontSize="12" fontWeight="600" fill="#111827" fontFamily="system-ui">Validate</text>

      {/* Node: AI (highlighted) */}
      <rect x="295" y="204" width="115" height="58" rx="12" fill="white" filter="url(#shadow1)" />
      <rect x="295" y="204" width="115" height="58" rx="12" stroke="#7c3aed" strokeWidth="2" />
      <rect x="295" y="204" width="4" height="58" rx="2" fill="#7c3aed" />
      <text x="313" y="224" fontSize="10" fill="#7c3aed" fontFamily="system-ui" fontWeight="600">AI</text>
      <text x="313" y="242" fontSize="12" fontWeight="600" fill="#111827" fontFamily="system-ui">Generate PRD</text>
      <text x="313" y="256" fontSize="9" fill="#9ca3af" fontFamily="system-ui">Claude Sonnet</text>

      {/* Node: Output */}
      <rect x="380" y="272" width="120" height="52" rx="12" fill="#faf5ff" filter="url(#shadow2)" />
      <rect x="380" y="272" width="120" height="52" rx="12" stroke="#ddd6fe" strokeWidth="1.5" />
      <rect x="380" y="272" width="4" height="52" rx="2" fill="#10b981" />
      <text x="398" y="292" fontSize="10" fill="#6b7280" fontFamily="system-ui">OUTPUT</text>
      <text x="398" y="308" fontSize="12" fontWeight="600" fill="#111827" fontFamily="system-ui">PRD Ready</text>

      {/* Node: Condition */}
      <rect x="40" y="218" width="110" height="52" rx="12" fill="white" filter="url(#shadow2)" />
      <rect x="40" y="218" width="110" height="52" rx="12" stroke="#e5e7eb" strokeWidth="1.5" />
      <rect x="40" y="218" width="4" height="52" rx="2" fill="#f59e0b" />
      <text x="58" y="238" fontSize="10" fill="#6b7280" fontFamily="system-ui">CONDITION</text>
      <text x="58" y="254" fontSize="12" fontWeight="600" fill="#111827" fontFamily="system-ui">Review?</text>

      {/* Connecting note */}
      <rect x="160" y="290" width="118" height="48" rx="8" fill="#fffbeb" />
      <rect x="160" y="290" width="118" height="48" rx="8" stroke="#fde68a" strokeWidth="1.5" />
      <text x="172" y="308" fontSize="10" fill="#92400e" fontFamily="system-ui">💡 Auto-layout</text>
      <text x="172" y="323" fontSize="10" fill="#92400e" fontFamily="system-ui">available</text>

      {/* Mini toolbar hint */}
      <rect x="190" y="20" width="148" height="28" rx="14" fill="white" filter="url(#shadow2)" />
      <rect x="190" y="20" width="148" height="28" rx="14" stroke="#e5e7eb" strokeWidth="1" />
      <circle cx="210" cy="34" r="7" fill="#f3f4f6" />
      <circle cx="228" cy="34" r="7" fill="#f3f4f6" />
      <circle cx="246" cy="34" r="7" fill="#7c3aed" />
      <circle cx="264" cy="34" r="7" fill="#f3f4f6" />
      <circle cx="282" cy="34" r="7" fill="#f3f4f6" />
      <text x="298" y="38" fontSize="9" fill="#9ca3af" fontFamily="system-ui">zoom 100%</text>
    </svg>
  );
}

// Dot-grid hero background
const dotGridStyle: React.CSSProperties = {
  backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
  backgroundSize: "28px 28px",
};

export function Sleek() {
  return (
    <div className="min-h-screen bg-white font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[17px] font-bold text-gray-900 tracking-tight">Kiteframe</span>
            <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide bg-violet-100 text-violet-700 rounded-full uppercase">
              Early Access
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <a href="#" className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-50">FAQ</a>
            <a href="#" className="ml-2 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors rounded-md hover:bg-gray-50">
              Already have an account? <span className="text-violet-600 font-medium">Sign in</span>
            </a>
          </nav>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-20 pb-16">
        {/* Dot-grid background */}
        <div className="absolute inset-0 opacity-60" style={dotGridStyle} />
        {/* Gradient fade */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/0 to-white" />

        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">

            {/* Left: Copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-xs font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />
                AI-powered workflow editor
              </div>

              <h1 className="text-[52px] leading-[1.08] font-extrabold text-gray-900 tracking-tight mb-5">
                Kiteframe helps<br />
                ideas{" "}
                <span style={{ color: "#7c3aed" }}>take flight</span>
              </h1>

              <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-[480px]">
                An AI-powered visual workflow editor for product alignment,
                connecting designs to execution, and generating PRDs — all in
                one place.
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: "#7c3aed" }}
                >
                  Create an Account
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 transition-all active:scale-[0.98]">
                  Learn More
                </button>
              </div>

              <p className="mt-5 text-xs text-gray-400">
                From idea to handoff — powered by AI
              </p>
            </div>

            {/* Right: Workflow diagram */}
            <div className="relative">
              <div
                className="rounded-2xl overflow-hidden border border-gray-100 shadow-2xl"
                style={{ boxShadow: "0 32px 64px -12px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.05)" }}
              >
                <div className="bg-[#f1f2f4] px-4 py-2.5 flex items-center gap-2 border-b border-gray-200">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                  </div>
                  <span className="text-xs text-gray-400 ml-1">Untitled Workflow</span>
                </div>
                <div className="bg-white p-2" style={{ height: 340 }}>
                  <WorkflowDiagram />
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl px-4 py-3 shadow-lg border border-gray-100 flex items-center gap-3">
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
            <div className="flex items-center gap-4 px-8 justify-center">
              <Shield className="w-5 h-5 text-violet-500 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-gray-900">Early Access</div>
                <div className="text-xs text-gray-500">Exclusive early access</div>
              </div>
            </div>
            <div className="flex items-center gap-4 px-8 justify-center">
              <Zap className="w-5 h-5 text-violet-500 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-gray-900">AI-Powered</div>
                <div className="text-xs text-gray-500">Intelligent generation</div>
              </div>
            </div>
            <div className="flex items-center gap-4 px-8 justify-center">
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
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-semibold tracking-widest text-violet-600 uppercase mb-3">Canvas</p>
            <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-4 leading-tight">
              Ready out-of-the-box
            </h2>
            <p className="text-lg text-gray-500 mb-8 leading-relaxed">
              Drag, zoom, pan, select multiple nodes — everything works from the
              start. No setup required. Just open and start building your workflows.
            </p>
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

          {/* Visual: mini canvas mockup */}
          <div className="rounded-2xl bg-[#f8f9fb] border border-gray-200 overflow-hidden" style={{ height: 320 }}>
            <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
              </div>
              <div className="flex gap-1 ml-auto">
                {["Grid", "Flow", "Circular"].map(l => (
                  <span key={l} className="px-2 py-0.5 text-[10px] bg-white border border-gray-200 rounded text-gray-500">{l}</span>
                ))}
              </div>
            </div>
            <div className="p-6 flex flex-wrap gap-4 items-start">
              {[
                { label: "Start", color: "#7c3aed", type: "INPUT" },
                { label: "Process", color: "#3b82f6", type: "PROCESS" },
                { label: "Decision", color: "#f59e0b", type: "CONDITION" },
                { label: "Output", color: "#10b981", type: "OUTPUT" },
              ].map(({ label, color, type }, i) => (
                <div key={label} className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm flex items-center gap-3 min-w-[130px]"
                  style={{ outline: i === 1 ? `2px solid ${color}` : "none", outlineOffset: 2 }}>
                  <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <div>
                    <div className="text-[9px] text-gray-400 font-medium uppercase">{type}</div>
                    <div className="text-sm font-semibold text-gray-900">{label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 pt-0">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> 4 nodes selected
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg">
                  ⌘ + A to select all
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CALLOUT: Not just diagramming ── */}
      <section className="bg-gray-50 border-y border-gray-100 py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-3 leading-tight">
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
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Visual */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { emoji: "🟡", title: "Sticky Notes", sub: "Quick annotations", bg: "#fffbeb", border: "#fde68a" },
              { emoji: "🔵", title: "Shapes", sub: "Visual grouping", bg: "#f5f3ff", border: "#ddd6fe" },
              { emoji: "📝", title: "Text", sub: "Labels & headers", bg: "#f8fafc", border: "#e2e8f0" },
              { emoji: "🔗", title: "Link Previews", sub: "External resources", bg: "#eef2ff", border: "#c7d2fe" },
            ].map(({ emoji, title, sub, bg, border }) => (
              <div key={title} className="p-5 rounded-2xl border" style={{ backgroundColor: bg, borderColor: border }}>
                <div className="text-2xl mb-3">{emoji}</div>
                <div className="font-semibold text-gray-900 text-sm">{title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          {/* Text */}
          <div>
            <p className="text-xs font-semibold tracking-widest text-violet-600 uppercase mb-3">Context</p>
            <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-4 leading-tight">
              More than just nodes
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed">
              Add context to your workflows with sticky notes, shapes, text
              annotations, and link previews. Everything you need to
              communicate ideas clearly.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION C: AI-assisted ── */}
      <section className="bg-gray-50 border-y border-gray-100 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-semibold tracking-widest text-violet-600 uppercase mb-3">Intelligence</p>
              <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-4 leading-tight">
                AI-assisted,<br />human-controlled
              </h2>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                Generate workflows from natural language prompts. Analyze Figma
                designs. Create PRDs automatically. The AI helps you move faster
                while you stay in control.
              </p>
              <ul className="space-y-3.5">
                {[
                  "Generate workflows from text descriptions",
                  "Import and analyze Figma designs",
                  "Auto-generate PRDs from workflows",
                  "Privacy-first with local AI options",
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

            {/* AI prompt mockup */}
            <div className="space-y-3">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-xs text-gray-500 font-medium">KiteAI</span>
                </div>
                <div className="text-sm text-gray-400 mb-2 font-mono">
                  &gt; Generate a user onboarding workflow with email verification and welcome screen
                </div>
                <div className="flex items-center gap-2 text-xs text-violet-600 font-medium">
                  <Zap className="w-3 h-3" />
                  Generating 6 nodes...
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Welcome", color: "#7c3aed" },
                  { label: "Email verify", color: "#3b82f6" },
                  { label: "Onboarding", color: "#10b981" },
                ].map(({ label, color }) => (
                  <div key={label} className="bg-white rounded-xl border border-gray-200 px-3 py-2.5 shadow-sm">
                    <div className="w-full h-1 rounded-full mb-2" style={{ backgroundColor: color }} />
                    <div className="text-xs font-medium text-gray-900">{label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-violet-50 rounded-xl border border-violet-100 px-4 py-3 flex items-center gap-3">
                <span className="text-violet-600 font-medium text-xs">✓</span>
                <span className="text-xs text-violet-700 font-medium">PRD auto-generated — 1,180 words</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TEAM SECTION ── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-gray-900 tracking-tight mb-3">Built for cross-functional teams</h2>
          <p className="text-lg text-gray-500">A shared language for everyone involved in building products.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: Users, color: "#3b82f6", bg: "#eff6ff", border: "#dbeafe", title: "Product Managers", sub: "From concept to PRD in one tool" },
            { icon: Palette, color: "#ec4899", bg: "#fdf2f8", border: "#fce7f3", title: "Designers", sub: "Connect Figma to execution" },
            { icon: Code, color: "#10b981", bg: "#f0fdf4", border: "#d1fae5", title: "Engineers", sub: "Clear requirements, no ambiguity" },
            { icon: Rocket, color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", title: "Founders", sub: "Move fast without losing context" },
          ].map(({ icon: Icon, color, bg, border, title, sub }) => (
            <div key={title} className="rounded-2xl p-6 border text-center" style={{ backgroundColor: bg, borderColor: border }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "white", border: `1.5px solid ${border}` }}>
                <Icon className="w-6 h-6" style={{ color }} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1.5">{title}</h3>
              <p className="text-sm text-gray-500">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── DARK CTA SECTION ── */}
      <section className="bg-[#0a0a0f] py-24">
        <div className="max-w-lg mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white tracking-tight mb-8">Create an Account</h2>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl text-sm font-medium text-white border border-white/20 hover:border-white/40 transition-colors">
              <Chrome className="w-5 h-5" />
              Continue with Google
            </button>
            <button className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl text-sm font-medium text-white border border-white/20 hover:border-white/40 transition-colors">
              <Github className="w-5 h-5" />
              Continue with GitHub
            </button>
            <button className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl text-sm font-medium text-white border border-white/20 hover:border-white/40 transition-colors">
              <Terminal className="w-5 h-5" />
              Continue with Replit
            </button>
          </div>
          <p className="mt-5 text-xs text-white/40">Already have an account? Just sign in above.</p>
          <p className="mt-2 text-xs text-white/30 leading-relaxed">
            By continuing, you acknowledge that you agree to Kiteframe's{" "}
            <span className="underline cursor-pointer">Terms and Conditions</span> and{" "}
            <span className="underline cursor-pointer">Privacy Policy</span>.
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">Kiteframe</span>
          <span className="text-sm text-gray-400">© 2025</span>
          <div className="flex gap-5">
            {["Terms", "Privacy", "FAQ"].map(l => (
              <a key={l} href="#" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}
