import { useState } from "react";

const DOMAIN = "a3695e9e-75a3-493f-96e8-c7b25c2638e2-00-1k0bblkfh8jgm.worf.replit.dev";

const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#1f2937","#ffffff"];

const SPACING_PRESETS = [
  { label: "Compact",    gap: 4,  pad: 8  },
  { label: "Default",    gap: 8,  pad: 12 },
  { label: "Comfortable",gap: 12, pad: 16 },
  { label: "Spacious",   gap: 20, pad: 24 },
];

const FONT_SIZES = ["xs","sm","md","lg","xl","2xl"];

const CATEGORIES = [
  {
    name: "Layout",
    items: [
      { name: "Section",   preview: <LayoutPreview type="section" /> },
      { name: "Stack",     preview: <LayoutPreview type="stack" /> },
      { name: "HStack",    preview: <LayoutPreview type="hstack" /> },
      { name: "Card",      preview: <LayoutPreview type="card" /> },
    ],
  },
  {
    name: "Typography",
    items: [
      { name: "Heading",   preview: <LayoutPreview type="heading" /> },
      { name: "Text",      preview: <LayoutPreview type="text" /> },
    ],
  },
  {
    name: "Controls",
    items: [
      { name: "Button",    preview: <LayoutPreview type="button" /> },
      { name: "Input",     preview: <LayoutPreview type="input" /> },
      { name: "Checkbox",  preview: <LayoutPreview type="checkbox" /> },
      { name: "Select",    preview: <LayoutPreview type="select" /> },
    ],
  },
  {
    name: "Display",
    items: [
      { name: "Badge",     preview: <LayoutPreview type="badge" /> },
      { name: "Avatar",    preview: <LayoutPreview type="avatar" /> },
    ],
  },
];

function LayoutPreview({ type }: { type: string }) {
  const base = "w-full h-full flex items-center justify-center";
  switch (type) {
    case "section":
      return <div className={base}><div className="w-full space-y-1 px-1"><div className="h-1.5 bg-gray-200 rounded w-full"/><div className="h-1.5 bg-gray-200 rounded w-full"/><div className="h-1.5 bg-gray-200 rounded w-4/5"/></div></div>;
    case "stack":
      return <div className={base}><div className="space-y-1 w-10"><div className="h-2 bg-gray-200 rounded"/><div className="h-2 bg-gray-200 rounded"/><div className="h-2 bg-gray-200 rounded"/></div></div>;
    case "hstack":
      return <div className={base}><div className="flex gap-1"><div className="h-5 w-5 bg-gray-200 rounded"/><div className="h-5 w-5 bg-gray-200 rounded"/><div className="h-5 w-5 bg-gray-200 rounded"/></div></div>;
    case "card":
      return <div className={base}><div className="w-12 h-8 bg-white rounded border border-gray-200 shadow-sm"/></div>;
    case "heading":
      return <div className={base}><span className="text-sm font-black text-gray-400">Aa</span></div>;
    case "text":
      return <div className={base}><div className="space-y-0.5 w-12"><div className="h-1 bg-gray-200 rounded w-full"/><div className="h-1 bg-gray-200 rounded w-4/5"/><div className="h-1 bg-gray-200 rounded w-3/5"/></div></div>;
    case "button":
      return <div className={base}><div className="h-4 w-12 bg-blue-500 rounded text-[7px] text-white flex items-center justify-center font-medium">Button</div></div>;
    case "input":
      return <div className={base}><div className="h-4 w-12 bg-white border border-gray-300 rounded px-1"><div className="h-full flex items-center"><div className="h-1 w-6 bg-gray-200 rounded"/></div></div></div>;
    case "checkbox":
      return <div className={base}><div className="flex items-center gap-1"><div className="w-3 h-3 border-2 border-gray-300 rounded"/><div className="h-1.5 w-6 bg-gray-200 rounded"/></div></div>;
    case "select":
      return <div className={base}><div className="h-4 w-12 bg-white border border-gray-300 rounded px-1 flex items-center justify-between"><div className="h-1 w-5 bg-gray-200 rounded"/><span className="text-[7px] text-gray-300">▾</span></div></div>;
    case "badge":
      return <div className={base}><div className="px-1.5 py-0.5 bg-blue-100 rounded-full text-[7px] text-blue-600 font-medium">Badge</div></div>;
    case "avatar":
      return <div className={base}><div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[8px] font-bold">AB</div></div>;
    default:
      return <div className={base}><div className="w-8 h-8 bg-gray-100 rounded"/></div>;
  }
}

function ComponentTile({ name, preview }: { name: string; preview: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-50 hover:bg-blue-50 border border-transparent hover:border-blue-200 cursor-grab transition-all group">
      <div className="w-full h-[54px] bg-white rounded-md border border-gray-100 group-hover:border-blue-100 overflow-hidden">
        {preview}
      </div>
      <span className="text-[9px] text-gray-500 group-hover:text-blue-600 font-medium leading-none">{name}</span>
    </div>
  );
}

function PropertiesPanel({ onClose }: { onClose: () => void }) {
  const [bg, setBg] = useState("#3b82f6");
  const [fontSize, setFontSize] = useState("md");
  const [spacing, setSpacing] = useState("Default");
  const [align, setAlign] = useState("left");
  const [opacity, setOpacity] = useState(100);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-[11px] font-semibold text-gray-800">Button</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">primary</span>
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 text-xs font-medium">✕</button>
      </div>

      {/* Appearance */}
      <section className="px-3 py-3 border-b border-gray-100">
        <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Appearance</div>
        <div className="text-[10px] text-gray-500 mb-1.5">Color</div>
        <div className="flex gap-1.5 flex-wrap mb-3">
          {COLORS.map(c => (
            <button key={c} onClick={() => setBg(c)}
              style={{ background: c, borderColor: bg === c ? "#3b82f6" : c === "#ffffff" ? "#e5e7eb" : c }}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${bg === c ? "scale-110 ring-2 ring-blue-400 ring-offset-1" : ""}`} />
          ))}
          <button className="w-5 h-5 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-[8px] hover:border-blue-300">+</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-12">Opacity</span>
          <input type="range" min={0} max={100} value={opacity} onChange={e => setOpacity(+e.target.value)}
            className="flex-1 h-1 appearance-none bg-gray-200 rounded-full accent-blue-500" />
          <span className="text-[10px] text-gray-600 w-8 text-right">{opacity}%</span>
        </div>
      </section>

      {/* Size & Position */}
      <section className="px-3 py-3 border-b border-gray-100">
        <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Size & Position</div>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {[["W","240"],["H","44"],["X","80"],["Y","200"]].map(([l, v]) => (
            <label key={l} className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 w-3">{l}</span>
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-[10px] text-gray-700 font-mono">{v}</div>
            </label>
          ))}
        </div>
        <div className="text-[10px] text-gray-500 mb-1.5">Alignment</div>
        <div className="flex gap-1">
          {[["⇤","left"],["⇔","center"],["⇥","right"],["↕","stretch"]].map(([icon, a]) => (
            <button key={a} onClick={() => setAlign(a)}
              className={`flex-1 h-6 text-[11px] rounded border transition-all ${align === a ? "bg-blue-500 border-blue-500 text-white" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
              {icon}
            </button>
          ))}
        </div>
      </section>

      {/* Spacing Presets */}
      <section className="px-3 py-3 border-b border-gray-100">
        <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Spacing Preset</div>
        <div className="grid grid-cols-2 gap-1.5">
          {SPACING_PRESETS.map(p => (
            <button key={p.label} onClick={() => setSpacing(p.label)}
              className={`py-2 px-2 rounded-lg border text-left transition-all ${spacing === p.label ? "bg-blue-50 border-blue-300 shadow-sm" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
              <div className={`text-[10px] font-semibold mb-0.5 ${spacing === p.label ? "text-blue-600" : "text-gray-700"}`}>{p.label}</div>
              <div className="text-[9px] text-gray-400">gap {p.gap} · pad {p.pad}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Typography */}
      <section className="px-3 py-3">
        <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Typography</div>
        <div className="text-[10px] text-gray-500 mb-1.5">Font size</div>
        <div className="flex gap-1 mb-3">
          {FONT_SIZES.map(s => (
            <button key={s} onClick={() => setFontSize(s)}
              className={`flex-1 h-6 text-[9px] rounded border transition-all ${fontSize === s ? "bg-blue-500 border-blue-500 text-white font-semibold" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>{s}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {[["B","font-bold"],["I","italic"],["U","underline"]].map(([l, c]) => (
            <button key={l} className={`w-6 h-6 text-[10px] ${c} border border-gray-200 rounded hover:bg-gray-50 text-gray-600`}>{l}</button>
          ))}
          <div className="flex-1" />
          <div className="text-[10px] text-gray-400 bg-gray-50 border border-gray-200 rounded px-2 py-0.5">Inter</div>
        </div>
      </section>
    </div>
  );
}

function ChatPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const messages = [
    { role: "ai", text: "What would you like to change about this design?" },
    { role: "user", text: "Make the hero heading bigger and bolder" },
    { role: "ai", text: "Done — increased heading to 2XL with font-weight 800. Want to also adjust the subheading?" },
  ];

  return (
    <div className={`relative flex-shrink-0 border-l border-gray-200 bg-white flex flex-col transition-all duration-200 ease-in-out ${collapsed ? "w-10" : "w-60"}`}>
      <button onClick={onToggle}
        className="absolute -left-3 top-20 w-6 h-8 bg-white border border-gray-200 rounded-l-lg flex items-center justify-center shadow-sm hover:bg-blue-50 z-10 text-gray-400 hover:text-blue-500 text-sm font-bold">
        {collapsed ? "〈" : "〉"}
      </button>
      {collapsed ? (
        <div className="flex flex-col items-center pt-3 gap-3 px-1.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[9px] font-bold">AI</div>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
        </div>
      ) : (
        <div className="flex flex-col h-full min-h-0">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[8px] font-bold">AI</div>
              <span className="text-[11px] font-semibold text-gray-800">KiteAI</span>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            </div>
            <span className="text-[9px] text-gray-400">Design mode</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-1.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "ai" && <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0 mt-0.5" />}
                <div className={`max-w-[82%] px-2.5 py-2 rounded-xl text-[10px] leading-snug ${m.role === "user" ? "bg-blue-500 text-white rounded-br-sm" : "bg-gray-100 text-gray-700 rounded-bl-sm"}`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div className="p-2.5 border-t border-gray-100">
            <div className="flex gap-1.5 items-center bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-2 focus-within:border-blue-300">
              <input className="flex-1 bg-transparent text-[10px] text-gray-700 outline-none placeholder:text-gray-400" placeholder="Ask KiteAI…" readOnly />
              <button className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[9px]">↑</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function VariantA() {
  const [showProps, setShowProps] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-white overflow-hidden text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ─── Left Rail: 280px ─────────────────────────────────── */}
      <div className="w-[280px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col" style={{ boxShadow: "1px 0 0 #e5e7eb" }}>
        <div className="px-3 py-2.5 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-800">
              {showProps ? "Properties" : "Components"}
            </span>
            {showProps && (
              <button onClick={() => setShowProps(false)} className="text-[9px] text-blue-500 hover:text-blue-700 flex items-center gap-1">
                ← Components
              </button>
            )}
          </div>
          {!showProps && (
            <div className="mt-2 flex items-center gap-1.5 bg-gray-100 rounded-lg px-2 py-1.5">
              <span className="text-gray-400 text-[11px]">⌕</span>
              <span className="text-[10px] text-gray-400">Search components…</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {showProps ? (
            <PropertiesPanel onClose={() => setShowProps(false)} />
          ) : (
            <div className="p-2.5 space-y-3">
              {CATEGORIES.map(cat => (
                <div key={cat.name}>
                  <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 px-1">{cat.name}</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {cat.items.map(item => <ComponentTile key={item.name} {...item} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Canvas ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-50">
        {/* Toolbar */}
        <div className="h-9 bg-white border-b border-gray-200 flex items-center px-3 gap-2 flex-shrink-0">
          <button className="flex items-center gap-1 text-[10px] bg-gray-100 hover:bg-gray-200 rounded-md px-2 py-1 text-gray-600 transition-colors">
            <span className="text-[11px]">+</span> Artboard
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button className="text-[10px] text-gray-500 hover:bg-gray-100 rounded px-2 py-1">Layers</button>
          <div className="flex-1" />
          <div className="flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-100 rounded-md px-1">
            <button className="w-5 h-5 flex items-center justify-center hover:text-gray-700">−</button>
            <span className="w-8 text-center">100%</span>
            <button className="w-5 h-5 flex items-center justify-center hover:text-gray-700">+</button>
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 relative overflow-hidden"
          style={{ backgroundImage: "radial-gradient(circle, #d4d4d8 1px, transparent 1px)", backgroundSize: "20px 20px" }}>
          {/* Artboard */}
          <div className="absolute" style={{ left: 60, top: 48 }}>
            <div className="text-[9px] text-gray-400 mb-1 flex items-center gap-1.5">
              <span>◻</span> Screen 1 <span className="text-gray-300">390×844</span>
            </div>
            <div className="w-[320px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-900 h-7 flex items-center px-3 gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-400"/><div className="w-2 h-2 rounded-full bg-yellow-400"/><div className="w-2 h-2 rounded-full bg-green-400"/>
                <div className="flex-1 mx-3 h-3 bg-gray-700 rounded-full"/>
              </div>
              <div className="p-5 space-y-3.5">
                <div className="space-y-1.5">
                  <div className="h-5 bg-gray-900 rounded-md w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-4/5" />
                </div>
                <button
                  onClick={() => setShowProps(true)}
                  className={`w-full h-9 rounded-lg text-[11px] font-semibold transition-all cursor-pointer relative ${
                    showProps
                      ? "bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}>
                  {showProps ? "✓ Selected — see left panel" : "Click to select this button"}
                  {showProps && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-ping" />
                  )}
                </button>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="h-16 bg-gray-50 rounded-lg border border-gray-100 flex flex-col p-2 gap-1">
                    <div className="h-2 w-8 bg-gray-200 rounded"/>
                    <div className="h-1.5 w-full bg-gray-100 rounded"/>
                    <div className="h-1.5 w-3/4 bg-gray-100 rounded"/>
                  </div>
                  <div className="h-16 bg-gray-50 rounded-lg border border-gray-100 flex flex-col p-2 gap-1">
                    <div className="h-2 w-8 bg-gray-200 rounded"/>
                    <div className="h-1.5 w-full bg-gray-100 rounded"/>
                    <div className="h-1.5 w-3/4 bg-gray-100 rounded"/>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Selection tooltip */}
          {showProps && (
            <div className="absolute" style={{ left: 60, top: 224 }}>
              <div className="flex items-center gap-1.5 bg-blue-600 text-white text-[9px] px-2.5 py-1 rounded-full shadow-lg">
                <span>●</span> Button selected — Properties open in left panel
              </div>
            </div>
          )}

          {!showProps && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-sm text-white text-[10px] px-3.5 py-2 rounded-full">
              Click the button in the artboard to see the properties panel swap in →
            </div>
          )}

          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-1">
            {["⊕","⊖","⊡"].map((icon, i) => (
              <button key={i} className="w-7 h-7 bg-white border border-gray-200 rounded-lg shadow-sm flex items-center justify-center text-gray-500 hover:bg-gray-50 text-sm">{icon}</button>
            ))}
          </div>
        </div>

        {/* Bottom AI bar */}
        <div className="h-11 bg-white border-t border-gray-200 flex items-center px-3 gap-2 flex-shrink-0">
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />
          <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <span className="text-[10px] text-gray-400">✦ Generate or describe changes to your design…</span>
          </div>
          <button className="h-7 px-3 bg-blue-500 hover:bg-blue-600 text-white text-[10px] rounded-lg transition-colors">Generate</button>
        </div>
      </div>

      {/* ─── Right Rail: AI Chat ───────────────────────────────── */}
      <ChatPanel collapsed={chatCollapsed} onToggle={() => setChatCollapsed(v => !v)} />
    </div>
  );
}
