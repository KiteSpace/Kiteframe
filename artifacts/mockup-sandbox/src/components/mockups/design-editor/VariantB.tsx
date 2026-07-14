import { useState } from "react";

const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#1f2937","#f8fafc"];
const BORDER_RADIUS_TOKENS = ["None","S","M","L","Full"];
const SPACING_TOKENS = ["S","M","L","XL"];
const SIZE_TOKENS = ["XS","S","M","L","XL"];

const CATEGORIES = [
  {
    name: "Layout",
    items: [
      { name: "Section",   preview: <TilePreview type="section" /> },
      { name: "Stack",     preview: <TilePreview type="stack" /> },
      { name: "HStack",    preview: <TilePreview type="hstack" /> },
      { name: "Card",      preview: <TilePreview type="card" /> },
    ],
  },
  {
    name: "Typography",
    items: [
      { name: "Heading",   preview: <TilePreview type="heading" /> },
      { name: "Text",      preview: <TilePreview type="text" /> },
    ],
  },
  {
    name: "Controls",
    items: [
      { name: "Button",    preview: <TilePreview type="button" /> },
      { name: "Input",     preview: <TilePreview type="input" /> },
      { name: "Checkbox",  preview: <TilePreview type="checkbox" /> },
      { name: "Select",    preview: <TilePreview type="select" /> },
    ],
  },
  {
    name: "Display",
    items: [
      { name: "Badge",     preview: <TilePreview type="badge" /> },
      { name: "Avatar",    preview: <TilePreview type="avatar" /> },
      { name: "Progress",  preview: <TilePreview type="progress" /> },
      { name: "Divider",   preview: <TilePreview type="divider" /> },
    ],
  },
];

function TilePreview({ type }: { type: string }) {
  const base = "w-full h-full flex items-center justify-center bg-white";
  switch (type) {
    case "section":
      return <div className={base}><div className="w-full px-2 space-y-1"><div className="h-1.5 bg-gray-200 rounded-sm w-full"/><div className="h-1.5 bg-gray-200 rounded-sm w-full"/><div className="h-1.5 bg-gray-100 rounded-sm w-4/5"/></div></div>;
    case "stack":
      return <div className={base}><div className="flex flex-col gap-1 w-10"><div className="h-2.5 bg-gray-200 rounded-sm"/><div className="h-2.5 bg-gray-200 rounded-sm"/><div className="h-2.5 bg-gray-200 rounded-sm"/></div></div>;
    case "hstack":
      return <div className={base}><div className="flex gap-1.5"><div className="h-5 w-5 bg-gray-200 rounded-sm"/><div className="h-5 w-5 bg-gray-200 rounded-sm"/><div className="h-5 w-5 bg-gray-200 rounded-sm"/></div></div>;
    case "card":
      return <div className={base}><div className="w-12 h-9 bg-white border border-gray-200 rounded-md shadow-sm"/></div>;
    case "heading":
      return <div className={base}><span className="text-[15px] font-black text-gray-500 tracking-tight">Aa</span></div>;
    case "text":
      return <div className={base}><div className="w-12 space-y-0.5"><div className="h-1 bg-gray-200 rounded-sm"/><div className="h-1 bg-gray-200 rounded-sm w-4/5"/><div className="h-1 bg-gray-100 rounded-sm w-3/5"/></div></div>;
    case "button":
      return <div className={base}><div className="h-4 w-14 bg-blue-500 rounded text-[7px] text-white flex items-center justify-center font-semibold">Button</div></div>;
    case "input":
      return <div className={base}><div className="h-5 w-14 bg-white border border-gray-300 rounded-sm px-1.5 flex items-center"><div className="h-1 w-6 bg-gray-200 rounded-sm"/></div></div>;
    case "checkbox":
      return <div className={base}><div className="flex items-center gap-1.5"><div className="w-3 h-3 border-2 border-blue-500 rounded-sm bg-blue-50 flex items-center justify-center"><div className="w-1.5 h-1 border-b-2 border-r-2 border-blue-500 rotate-45 -mt-0.5"/></div><div className="h-1.5 w-7 bg-gray-200 rounded-sm"/></div></div>;
    case "select":
      return <div className={base}><div className="h-5 w-14 bg-white border border-gray-300 rounded-sm px-1.5 flex items-center justify-between"><div className="h-1 w-5 bg-gray-200 rounded-sm"/><span className="text-[7px] text-gray-400">▾</span></div></div>;
    case "badge":
      return <div className={base}><span className="px-2 py-0.5 bg-violet-100 text-violet-600 text-[8px] font-semibold rounded-full">Label</span></div>;
    case "avatar":
      return <div className={base}><div className="flex -space-x-1.5"><div className="w-6 h-6 rounded-full bg-blue-400 border-2 border-white"/><div className="w-6 h-6 rounded-full bg-purple-400 border-2 border-white"/><div className="w-6 h-6 rounded-full bg-green-400 border-2 border-white"/></div></div>;
    case "progress":
      return <div className={base}><div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full w-3/5"/></div></div>;
    case "divider":
      return <div className={base}><div className="w-12 border-t border-dashed border-gray-300"/></div>;
    default:
      return <div className={base}><div className="w-8 h-8 bg-gray-100 rounded-sm"/></div>;
  }
}

function ComponentTile({ name, preview }: { name: string; preview: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white hover:bg-blue-50/60 border border-gray-100 hover:border-blue-200/80 cursor-grab transition-all group shadow-sm hover:shadow-md">
      <div className="w-full h-[52px] rounded-lg border border-gray-100 group-hover:border-blue-100 overflow-hidden bg-gray-50/50">
        {preview}
      </div>
      <span className="text-[9.5px] text-gray-500 group-hover:text-blue-600 font-medium leading-none">{name}</span>
    </div>
  );
}

function TokenRow({ label, tokens, active, onSelect }: {
  label: string;
  tokens: string[];
  active: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-14 flex-shrink-0">{label}</span>
      <div className="flex gap-1">
        {tokens.map(t => (
          <button key={t} onClick={() => onSelect(t)}
            className={`min-w-[28px] h-6 px-1.5 text-[9.5px] rounded-md border font-medium transition-all ${
              active === t
                ? "bg-gray-900 border-gray-900 text-white shadow-sm"
                : "border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 bg-white"
            }`}>{t}</button>
        ))}
      </div>
    </div>
  );
}

function PropertiesPanelB({ onClose }: { onClose: () => void }) {
  const [bg, setBg] = useState("#3b82f6");
  const [textColor, setTextColor] = useState("#ffffff");
  const [radius, setRadius] = useState("M");
  const [spacing, setSpacing] = useState("M");
  const [size, setSize] = useState("M");
  const [fontSize, setFontSize] = useState("M");
  const [weight, setWeight] = useState("M");
  const [align, setAlign] = useState("center");

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: bg }} />
          <span className="text-[11.5px] font-semibold text-gray-900">Button</span>
          <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md font-medium">primary</span>
        </div>
        <button onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 text-[11px]">✕</button>
      </div>

      {/* Color section */}
      <section className="px-3 py-3 border-b border-gray-100">
        <div className="text-[9.5px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Color</div>
        <div className="mb-2">
          <div className="text-[10px] text-gray-500 mb-1.5">Background</div>
          <div className="flex gap-1.5 flex-wrap">
            {COLORS.map(c => (
              <button key={c} onClick={() => setBg(c)}
                style={{ background: c, boxShadow: bg === c ? `0 0 0 2px white, 0 0 0 3.5px ${c}` : undefined, borderColor: c === "#f8fafc" ? "#e5e7eb" : c }}
                className="w-6 h-6 rounded-lg border transition-all hover:scale-110" />
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 mb-1.5">Text color</div>
          <div className="flex gap-1.5 flex-wrap">
            {["#ffffff","#1f2937","#3b82f6","#6b7280"].map(c => (
              <button key={c} onClick={() => setTextColor(c)}
                style={{ background: c, boxShadow: textColor === c ? `0 0 0 2px white, 0 0 0 3.5px #3b82f6` : undefined, borderColor: c === "#ffffff" ? "#e5e7eb" : c }}
                className="w-6 h-6 rounded-lg border transition-all hover:scale-110" />
            ))}
          </div>
        </div>
      </section>

      {/* Preview chip */}
      <section className="px-3 py-2.5 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-center py-1">
          <div className={`h-8 px-5 text-[11px] font-semibold flex items-center rounded-lg transition-all`}
            style={{ background: bg, color: textColor, borderRadius: radius === "None" ? 0 : radius === "S" ? 4 : radius === "M" ? 8 : radius === "L" ? 12 : 9999 }}>
            Preview
          </div>
        </div>
      </section>

      {/* Tokens */}
      <section className="px-3 py-3 border-b border-gray-100">
        <div className="text-[9.5px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Size & Shape</div>
        <div className="space-y-2">
          <TokenRow label="Element" tokens={SIZE_TOKENS} active={size} onSelect={setSize} />
          <TokenRow label="Radius" tokens={BORDER_RADIUS_TOKENS} active={radius} onSelect={setRadius} />
          <TokenRow label="Spacing" tokens={SPACING_TOKENS} active={spacing} onSelect={setSpacing} />
        </div>
      </section>

      {/* Position & Alignment */}
      <section className="px-3 py-3 border-b border-gray-100">
        <div className="text-[9.5px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Layout</div>
        <div className="grid grid-cols-2 gap-1.5 mb-2.5">
          {[["W","240px"],["H","40px"],["X","80"],["Y","200"]].map(([l, v]) => (
            <div key={l} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
              <span className="text-[9.5px] text-gray-400 font-medium w-3">{l}</span>
              <span className="text-[10px] text-gray-700 font-mono">{v}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          {[["⇤","left"],["⇔","center"],["⇥","right"],["↕","stretch"]].map(([icon, a]) => (
            <button key={a} onClick={() => setAlign(a)}
              className={`flex-1 h-6 text-[12px] rounded-lg border transition-all ${align === a ? "bg-gray-900 border-gray-900 text-white" : "border-gray-200 text-gray-400 hover:border-gray-400"}`}>
              {icon}
            </button>
          ))}
        </div>
      </section>

      {/* Typography */}
      <section className="px-3 py-3">
        <div className="text-[9.5px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Typography</div>
        <div className="space-y-2">
          <TokenRow label="Size" tokens={SIZE_TOKENS} active={fontSize} onSelect={setFontSize} />
          <TokenRow label="Weight" tokens={["L","M","SB","B","XB"]} active={weight} onSelect={setWeight} />
        </div>
        <div className="flex items-center gap-1.5 mt-2.5">
          <div className="flex-1 flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
            <span className="text-[10px] text-gray-700">Inter</span>
            <span className="text-gray-300 text-[10px]">▾</span>
          </div>
          <div className="flex gap-0.5">
            {[["B","font-bold"],["I","italic"],["U","underline"]].map(([l, c]) => (
              <button key={l} className={`w-6 h-7 text-[10px] ${c} border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600`}>{l}</button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function VariantB() {
  const [showProps, setShowProps] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);

  const messages = [
    { role: "ai", text: "I can help you design this screen. What would you like to adjust?" },
    { role: "user", text: "Center the button and make the card shadow stronger" },
    { role: "ai", text: "Done — aligned button to center and bumped shadow to lg. Looking good!" },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#fafafa" }}>

      {/* ─── Left Rail: 296px ─────────────────────────────────── */}
      <div className="w-[296px] flex-shrink-0 flex flex-col border-r border-gray-200 bg-white"
        style={{ boxShadow: "1px 0 0 #f0f0f0" }}>
        <div className="px-3 py-2.5 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-gray-900">
              {showProps ? "Inspect" : "Components"}
            </span>
            {showProps ? (
              <button onClick={() => setShowProps(false)} className="flex items-center gap-1 text-[9.5px] text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-2 py-1 transition-colors">
                ← Back
              </button>
            ) : (
              <button className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-sm">⊞</button>
            )}
          </div>
          {!showProps && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
              <span className="text-gray-400 text-xs">⌕</span>
              <span className="text-[10px] text-gray-400">Search…</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {showProps ? (
            <PropertiesPanelB onClose={() => setShowProps(false)} />
          ) : (
            <div className="p-2.5 space-y-3.5">
              {CATEGORIES.map(cat => (
                <div key={cat.name}>
                  <div className="flex items-center gap-2 mb-1.5 px-0.5">
                    <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">{cat.name}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
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
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Toolbar */}
        <div className="h-9 bg-white border-b border-gray-200 flex items-center px-3 gap-1.5 flex-shrink-0 z-10">
          <button className="flex items-center gap-1 text-[10px] text-gray-600 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors border border-transparent hover:border-gray-200">
            <span>＋</span> Artboard
          </button>
          <div className="w-px h-4 bg-gray-200 mx-0.5" />
          {["Layers","Notes"].map(tab => (
            <button key={tab} className="text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors">{tab}</button>
          ))}
          <div className="flex-1" />
          <div className="flex items-center gap-1 text-[10px] text-gray-500 border border-gray-200 rounded-lg px-1.5 bg-white">
            <button className="w-5 h-5 flex items-center justify-center hover:text-gray-800">−</button>
            <span className="w-9 text-center font-medium">100%</span>
            <button className="w-5 h-5 flex items-center justify-center hover:text-gray-800">+</button>
          </div>
        </div>

        {/* Canvas bg */}
        <div className="flex-1 relative overflow-hidden"
          style={{ backgroundImage: "radial-gradient(circle, #e4e4e7 1px, transparent 1px)", backgroundSize: "20px 20px" }}>

          {/* Artboard */}
          <div className="absolute" style={{ left: 56, top: 44 }}>
            <div className="text-[9px] text-gray-400 mb-1 flex items-center gap-2">
              <span className="font-medium text-gray-600">Screen 1</span>
              <span>390 × 844</span>
            </div>
            <div className="w-[330px] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-900 h-7 flex items-center px-3 gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-400"/><div className="w-2 h-2 rounded-full bg-yellow-400"/><div className="w-2 h-2 rounded-full bg-green-400"/>
                <div className="flex-1 mx-4 h-3 bg-gray-700 rounded-full"/>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-2">
                  <div className="h-6 bg-gray-900 rounded-lg w-3/5" />
                  <div className="h-2.5 bg-gray-100 rounded-lg w-full" />
                  <div className="h-2.5 bg-gray-100 rounded-lg w-4/5" />
                </div>
                <button
                  onClick={() => setShowProps(true)}
                  className={`w-full h-10 rounded-xl text-[11px] font-semibold transition-all cursor-pointer relative ${
                    showProps
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400 ring-offset-2"
                      : "bg-blue-500 text-white hover:bg-blue-600 shadow-md shadow-blue-500/20"
                  }`}>
                  {showProps ? "✓ Button Selected" : "Click to inspect this button"}
                </button>
                <div className="grid grid-cols-2 gap-2.5">
                  {[0,1].map(i => (
                    <div key={i} className="h-16 bg-gray-50 rounded-xl border border-gray-100 p-2.5 flex flex-col gap-1.5">
                      <div className="h-2 w-8 bg-gray-200 rounded-md"/>
                      <div className="h-1.5 w-full bg-gray-100 rounded-md"/>
                      <div className="h-1.5 w-3/4 bg-gray-100 rounded-md"/>
                    </div>
                  ))}
                </div>
                <div className="h-10 bg-gray-50 rounded-xl border border-gray-100 flex items-center px-3 gap-2">
                  <div className="w-4 h-4 rounded-full bg-gray-200"/><div className="h-1.5 w-20 bg-gray-200 rounded-md"/>
                </div>
              </div>
            </div>
          </div>

          {showProps && (
            <div className="absolute" style={{ left: 56, top: 240 }}>
              <div className="flex items-center gap-2 bg-blue-600 text-white text-[9.5px] px-3 py-1.5 rounded-full shadow-lg shadow-blue-500/30 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-200 animate-pulse"/>
                Properties visible in left panel
              </div>
            </div>
          )}

          {!showProps && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <div className="bg-gray-900/80 backdrop-blur-sm text-white text-[10px] px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                <span>👆</span> Click the button in the artboard to see Inspect panel
              </div>
            </div>
          )}

          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-1">
            {["⊕","⊖","⊡","⤢"].map((icon, i) => (
              <button key={i} className="w-7 h-7 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:shadow-md transition-all text-sm">{icon}</button>
            ))}
          </div>
        </div>

        {/* Bottom AI bar */}
        <div className="h-12 bg-white border-t border-gray-200 flex items-center px-3 gap-2 flex-shrink-0">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex-shrink-0" />
          <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 hover:border-blue-300 transition-colors cursor-text">
            <span className="text-[10px] text-gray-400">✦ Describe changes or generate a new design…</span>
          </div>
          <button className="h-8 w-8 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm flex items-center justify-center shadow-sm transition-colors">↑</button>
        </div>
      </div>

      {/* ─── Right Rail: Chat drawer ─────────────────────────── */}
      <div className={`relative flex-shrink-0 border-l border-gray-200 bg-white flex flex-col transition-all duration-200 ease-in-out ${chatOpen ? "w-[252px]" : "w-12"}`}>
        {/* Toggle tab */}
        <button
          onClick={() => setChatOpen(v => !v)}
          className="absolute -left-3.5 top-16 w-7 h-9 bg-white border border-gray-200 rounded-l-xl flex items-center justify-center shadow-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-500 text-gray-400 z-20 transition-all text-xs font-bold">
          {chatOpen ? "›" : "‹"}
        </button>

        {!chatOpen ? (
          <div className="flex flex-col items-center pt-4 gap-4 px-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-[9px] font-bold shadow-md">AI</div>
            <div className="w-2 h-2 rounded-full bg-green-400 shadow-sm" />
            <div className="w-5 h-5 text-gray-300 flex items-center justify-center text-xs mt-1">💬</div>
          </div>
        ) : (
          <div className="flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
              <div className="w-6 h-6 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-[9px] font-bold shadow-sm">AI</div>
              <div>
                <div className="text-[11px] font-semibold text-gray-900 leading-none">KiteAI</div>
                <div className="text-[9px] text-green-500 font-medium leading-none mt-0.5">● Active</div>
              </div>
              <div className="flex-1" />
              <button className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-[10px]">⋮</button>
            </div>

            {/* Mode tabs */}
            <div className="flex border-b border-gray-100 px-2 pt-1.5 gap-0.5">
              {["Chat","Suggest","History"].map((t, i) => (
                <button key={t} className={`text-[9.5px] px-2 py-1 rounded-t-lg font-medium transition-colors ${i === 0 ? "text-blue-600 border-b-2 border-blue-500" : "text-gray-400 hover:text-gray-600"}`}>{t}</button>
              ))}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-1.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "ai" && (
                    <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex-shrink-0 mt-0.5 shadow-sm" />
                  )}
                  <div className={`max-w-[80%] px-2.5 py-2 text-[10px] leading-snug ${
                    m.role === "user"
                      ? "bg-blue-500 text-white rounded-2xl rounded-br-sm shadow-sm"
                      : "bg-gray-100 text-gray-700 rounded-2xl rounded-bl-sm"
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {/* Typing indicator */}
              <div className="flex gap-1.5 justify-start">
                <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex-shrink-0 mt-0.5 opacity-40" />
                <div className="bg-gray-100 px-3 py-2 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                  {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                </div>
              </div>
            </div>

            {/* Input */}
            <div className="p-2.5 border-t border-gray-100">
              <div className="flex gap-1.5 items-end bg-gray-50 border border-gray-200 rounded-2xl px-2.5 py-2 focus-within:border-blue-300 focus-within:bg-white transition-all">
                <input className="flex-1 bg-transparent text-[10px] text-gray-700 outline-none placeholder:text-gray-400 resize-none" placeholder="Ask KiteAI anything…" readOnly />
                <button className="w-6 h-6 rounded-xl bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white text-[10px] shadow-sm transition-colors flex-shrink-0">↑</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
