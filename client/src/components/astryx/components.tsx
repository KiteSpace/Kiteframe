import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

type AstryxProps = Record<string, any>;

function pick<T>(map: Record<string, T>, key: any, fallback: T): T {
  return (map[key as string] ?? fallback) as T;
}

export function AstryxButton({ children = "Button", variant = "primary", size = "md", disabled, borderRadius }: AstryxProps) {
  const sizeClass    = pick({ sm: "px-2 py-1 text-xs", md: "px-3 py-1.5 text-sm", lg: "px-4 py-2 text-base" }, size, "px-3 py-1.5 text-sm");
  const variantClass = pick({
    primary:   "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    outline:   "border border-gray-300 text-gray-700 hover:bg-gray-50",
    ghost:     "text-gray-700 hover:bg-gray-100",
  }, variant, "bg-blue-600 text-white");
  return (
    <button
      className={`w-full inline-flex items-center justify-center rounded-md font-medium transition-colors ${sizeClass} ${variantClass} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      style={borderRadius !== undefined ? { borderRadius } : undefined}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function AstryxCard({ children = "Card content", variant = "elevated", borderRadius }: AstryxProps) {
  const variantClass = pick({ elevated: "bg-white shadow-md border border-gray-100", outlined: "bg-white border border-gray-300", ghost: "bg-gray-50" }, variant, "bg-white shadow-md");
  return <div className={`w-full rounded-lg p-4 ${variantClass}`} style={borderRadius !== undefined ? { borderRadius } : undefined}>{children}</div>;
}

export function AstryxBadge({ children = "Badge", color = "blue" }: AstryxProps) {
  const colorClass = pick({ blue: "bg-blue-100 text-blue-800", green: "bg-green-100 text-green-800", amber: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-800", gray: "bg-gray-100 text-gray-700" }, color, "bg-blue-100 text-blue-800");
  return (
    <div className="w-full flex">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>{children}</span>
    </div>
  );
}

export function AstryxText({ children = "Text", size = "md", muted, color }: AstryxProps) {
  const sizeClass = pick({ xs: "text-xs", sm: "text-sm", md: "text-base", lg: "text-lg" }, size, "text-base");
  return <p className={`w-full ${sizeClass} ${muted ? "text-gray-500" : "text-gray-900"}`} style={color ? { color } : undefined}>{children}</p>;
}

export function AstryxHeading({ children = "Heading", size = "lg", color }: AstryxProps) {
  const sizeClass = pick({ sm: "text-base font-semibold", md: "text-lg font-semibold", lg: "text-xl font-bold", xl: "text-2xl font-bold", "2xl": "text-3xl font-bold" }, size, "text-xl font-bold");
  return <h2 className={`w-full ${sizeClass} text-gray-900`} style={color ? { color } : undefined}>{children}</h2>;
}

export function AstryxAvatar({ name = "?", src, size = "md" }: AstryxProps) {
  const sizeClass = pick({ xs: "w-6 h-6 text-xs", sm: "w-8 h-8 text-sm", md: "w-10 h-10 text-base", lg: "w-14 h-14 text-lg" }, size, "w-10 h-10 text-base");
  const initials = String(name).split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-full flex justify-center">
      <div className={`${sizeClass} rounded-full bg-blue-500 text-white flex items-center justify-center font-medium overflow-hidden`}>
        {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : initials}
      </div>
    </div>
  );
}

export function AstryxSpinner({ size = "md" }: AstryxProps) {
  const sizeClass = pick({ sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" }, size, "w-6 h-6");
  return (
    <div className="w-full flex justify-center">
      <div className={`${sizeClass} border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin`} />
    </div>
  );
}

export function AstryxDivider({ label }: AstryxProps) {
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-px bg-gray-200" />
      {label && <span className="text-xs text-gray-500 whitespace-nowrap">{label}</span>}
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

export function AstryxProgressBar({ value = 50, color = "blue", borderRadius }: AstryxProps) {
  const colorClass   = pick({ blue: "bg-blue-500", green: "bg-green-500", amber: "bg-amber-500", red: "bg-red-500" }, color, "bg-blue-500");
  const clampedValue = Math.max(0, Math.min(100, Number(value)));
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden" style={borderRadius !== undefined ? { borderRadius } : undefined}>
      <div className={`h-full ${colorClass} rounded-full transition-all`} style={{ width: `${clampedValue}%` }} />
    </div>
  );
}

export function AstryxStatusDot({ status = "online", size = "md" }: AstryxProps) {
  const colorClass = pick({ online: "bg-green-500", offline: "bg-gray-400", busy: "bg-red-500", away: "bg-amber-500" }, status, "bg-green-500");
  const sizeClass  = pick({ sm: "w-2 h-2", md: "w-2.5 h-2.5", lg: "w-3.5 h-3.5" }, size, "w-2.5 h-2.5");
  return (
    <div className="w-full flex justify-center">
      <div className={`${sizeClass} rounded-full ${colorClass}`} />
    </div>
  );
}

export function AstryxSkeleton({ height = 16 }: AstryxProps) {
  return <div className="w-full rounded animate-pulse bg-gray-200" style={{ height }} />;
}

export function AstryxBanner({ children = "Banner message", variant = "info", borderRadius }: AstryxProps) {
  const variantClass = pick({
    info:    "bg-blue-50 border-blue-200 text-blue-800",
    success: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    error:   "bg-red-50 border-red-200 text-red-800",
  }, variant, "bg-blue-50 border-blue-200 text-blue-800");
  return <div className={`w-full px-3 py-2 rounded-md border text-sm ${variantClass}`} style={borderRadius !== undefined ? { borderRadius } : undefined}>{children}</div>;
}

export function AstryxEmptyState({ title = "Nothing here", description, action }: AstryxProps) {
  return (
    <div className="w-full flex flex-col items-center gap-2 p-6 text-center">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl">○</div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description && <p className="text-xs text-gray-500">{description}</p>}
      {action && <button className="mt-1 text-xs text-blue-600 hover:underline">{action}</button>}
    </div>
  );
}

export function AstryxChatMessage({ children = "Message", sender = "User", timestamp, isOwn }: AstryxProps) {
  return (
    <div className={`w-full flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}>
      <span className="text-xs text-gray-500">{sender}{timestamp ? ` · ${timestamp}` : ""}</span>
      <div className={`px-3 py-2 rounded-2xl text-sm max-w-xs ${isOwn ? "bg-blue-600 text-white rounded-tr-sm" : "bg-gray-100 text-gray-900 rounded-tl-sm"}`}>
        {children}
      </div>
    </div>
  );
}

export function AstryxToken({ children = "Tag" }: AstryxProps) {
  return (
    <div className="w-full flex">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
        {children}
        <span className="text-gray-400 hover:text-gray-600 cursor-pointer">×</span>
      </span>
    </div>
  );
}

export function AstryxTextInput({ placeholder = "Enter text…", label, value, disabled, borderRadius }: AstryxProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && <label className="text-xs font-medium text-gray-700">{label}</label>}
      <input
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 w-full"
        style={borderRadius !== undefined ? { borderRadius } : undefined}
        placeholder={placeholder}
        defaultValue={value}
        disabled={disabled}
        readOnly
      />
    </div>
  );
}

export function AstryxStack({ children, gap = 8 }: AstryxProps) {
  return <div className="w-full flex flex-col" style={{ gap }}>{children}</div>;
}

export function AstryxHStack({ children, gap = 8, align = "center" }: AstryxProps) {
  const alignClass = pick({ start: "items-start", center: "items-center", end: "items-end" }, align, "items-center");
  return <div className={`w-full flex flex-row ${alignClass}`} style={{ gap }}>{children}</div>;
}

export const ICON_GLYPHS: Record<string, string> = {
  star: "★", check: "✓", heart: "♥", arrow: "→", chevron: "›",
  home: "⌂", user: "○", search: "⌕", close: "✕", x: "✕",
  plus: "+", minus: "−", settings: "⚙", mail: "✉", lock: "⊕",
  info: "ⓘ", warning: "⚠", edit: "✎", trash: "⊘", upload: "↑",
  download: "↓", menu: "☰", grid: "⊞", share: "↗", eye: "◉",
  send: "➤", bookmark: "⬟", pin: "⊙", link: "⊗", image: "▣",
  bell: "◎", calendar: "◪", phone: "☎", tag: "◈",
};
export function AstryxIcon({ name = "star", size = "md" }: AstryxProps) {
  const sizeClass = pick({ sm: "text-base", md: "text-xl", lg: "text-2xl" }, size, "text-xl");
  const key = String(name).toLowerCase().trim();
  const glyph = ICON_GLYPHS[key] ?? (String(name).charAt(0).toUpperCase() || "⬡");
  return (
    <div className="w-full flex justify-center">
      <span className={`${sizeClass} text-gray-500 select-none`} title={name}>{glyph}</span>
    </div>
  );
}

export function AstryxSection({ children, direction = "column", gap = 16, padding = 16 }: AstryxProps) {
  return (
    <div style={{ display: "flex", flexDirection: direction as "row" | "column", gap, padding, minHeight: 32, width: "100%" }}>
      {children}
    </div>
  );
}

export function AstryxUnknown({ astryxComponent }: { astryxComponent: string }) {
  return (
    <div className="w-full border border-dashed border-gray-300 rounded-md px-3 py-2 text-xs text-gray-400 bg-gray-50">
      [{astryxComponent}]
    </div>
  );
}

// ─── New components ────────────────────────────────────────────────────────────

export function AstryxTable({ rows = 3, columns = 3, cellData: cellDataProp, headers: headersProp }: AstryxProps) {
  const numCols = Math.min(Math.max(1, Number(columns)), 6);
  const numRows = Math.min(Math.max(1, Number(rows)), 10);
  const headers = Array.from({ length: numCols }, (_, i) =>
    (headersProp as string[] | undefined)?.[i] ?? `Col ${i + 1}`
  );
  const bodyRows = Array.from({ length: numRows }, (_, r) =>
    Array.from({ length: numCols }, (_, c) =>
      (cellDataProp as string[][] | undefined)?.[r]?.[c] ?? "—"
    )
  );
  return (
    <div className="rounded-md border border-gray-200 overflow-hidden w-full">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-gray-400">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AstryxTabs({ tabs = "Tab 1,Tab 2,Tab 3", active = "Tab 1" }: AstryxProps) {
  const tabList = String(tabs).split(",").map((t) => t.trim()).filter(Boolean);
  const [activeTab, setActiveTab] = useState<string>(active);
  useEffect(() => { setActiveTab(active); }, [active]);
  return (
    <div className="w-full">
      <div className="inline-flex h-9 items-center rounded-lg bg-gray-100 p-1 gap-0.5">
        {tabList.map((tab) => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded-md text-sm font-medium cursor-pointer transition-colors ${tab === activeTab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {tab}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AstryxAccordion({ items = "Section 1,Section 2,Section 3", open = "Section 1" }: AstryxProps) {
  const itemList = String(items).split(",").map((t) => t.trim()).filter(Boolean);
  const [openItem, setOpenItem] = useState<string>(open);
  useEffect(() => { setOpenItem(open); }, [open]);
  return (
    <div className="w-full divide-y divide-gray-200 border border-gray-200 rounded-md overflow-hidden">
      {itemList.map((item) => (
        <div key={item}>
          <div
            onClick={() => setOpenItem(item === openItem ? "" : item)}
            className="flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-800 bg-white cursor-pointer hover:bg-gray-50"
          >
            {item}
            <span className="text-gray-400 text-xs">{item === openItem ? "▲" : "▼"}</span>
          </div>
          {item === openItem && (
            <div className="px-4 py-3 text-sm text-gray-600 bg-gray-50 border-t border-gray-100">
              Content for {item}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function AstryxSelect({ placeholder = "Select option…", options = "Option 1,Option 2,Option 3", size = "md", borderRadius }: AstryxProps) {
  const optionList = Array.isArray(options)
    ? options.map(String)
    : String(options).split(",").map((o) => o.trim()).filter(Boolean);
  const heightClass = pick({ sm: "h-7 text-xs", md: "h-9 text-sm", lg: "h-11 text-base" }, size, "h-9 text-sm");
  const preview = optionList.slice(0, 3);
  return (
    <div className="flex flex-col w-full">
      <div
        className={`flex ${heightClass} w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-500 cursor-pointer hover:border-gray-400`}
        style={borderRadius !== undefined ? { borderRadius } : undefined}
      >
        <span>{placeholder}</span>
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {preview.length > 0 && (
        <div className="mt-0.5 border border-gray-200 rounded-md bg-white shadow-sm overflow-hidden">
          {preview.map((opt, i) => (
            <div key={i} className="px-3 py-1.5 text-xs text-gray-600 border-b border-gray-100 last:border-0 hover:bg-gray-50">
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AstryxCheckbox({ label = "Checkbox label", checked = false }: AstryxProps) {
  return (
    <div className="w-full flex items-center gap-2">
      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"}`}>
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </div>
  );
}

export function AstryxRadioGroup({ options = "Option A,Option B,Option C", selected = "Option A" }: AstryxProps) {
  const optionList = String(options).split(",").map((o) => o.trim()).filter(Boolean);
  return (
    <div className="w-full flex flex-col gap-2">
      {optionList.map((opt) => (
        <div key={opt} className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${opt === selected ? "border-blue-600" : "border-gray-300"}`}>
            {opt === selected && <div className="w-2 h-2 rounded-full bg-blue-600" />}
          </div>
          <span className="text-sm text-gray-700">{opt}</span>
        </div>
      ))}
    </div>
  );
}

export function AstryxSlider({ value = 50, min = 0, max = 100 }: AstryxProps) {
  const pct = Math.max(0, Math.min(100, ((Number(value) - Number(min)) / (Number(max) - Number(min))) * 100));
  return (
    <div className="w-full flex flex-col gap-1.5">
      <div className="relative h-1.5 w-full rounded-full bg-gray-200">
        <div className="absolute h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border border-blue-400 bg-white shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{min}</span>
        <span>{value}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function AstryxCalendar({ month = "July 2026" }: AstryxProps) {
  const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const dates = [
    null, null, 1, 2, 3, 4, 5,
    6, 7, 8, 9, 10, 11, 12,
    13, 14, 15, 16, 17, 18, 19,
    20, 21, 22, 23, 24, 25, 26,
    27, 28, 29, 30, 31, null, null,
  ];
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 w-full text-sm">
      <div className="flex items-center justify-between mb-2">
        <button className="text-gray-400 hover:text-gray-600 px-1 text-xs">◀</button>
        <span className="font-medium text-gray-800 text-xs">{month}</span>
        <button className="text-gray-400 hover:text-gray-600 px-1 text-xs">▶</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d) => (
          <div key={d} className="text-center text-[10px] text-gray-400 py-0.5">{d}</div>
        ))}
        {dates.map((d, i) => (
          <div
            key={i}
            className={`text-center text-[11px] py-0.5 rounded ${d === 14 ? "bg-blue-600 text-white" : d ? "text-gray-700 hover:bg-gray-100 cursor-pointer" : ""}`}
          >
            {d ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AstryxCommand({ placeholder = "Search commands…" }: AstryxProps) {
  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white shadow-md overflow-hidden">
      <div className="flex items-center px-3 py-2 border-b border-gray-100">
        <svg className="w-3.5 h-3.5 text-gray-400 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="text-sm text-gray-400">{placeholder}</span>
      </div>
      <div className="py-1">
        {["New Document", "Open File", "Save As…", "Export PDF"].map((item) => (
          <div key={item} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">{item}</div>
        ))}
      </div>
    </div>
  );
}

export function AstryxCarousel({ slides = "Slide 1,Slide 2,Slide 3" }: AstryxProps) {
  const slideList = String(slides).split(",").map((s) => s.trim()).filter(Boolean);
  const safeLen = slideList.length || 1;
  const [activeSlide, setActiveSlide] = useState(0);
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-gray-200">
      <div className="flex items-center justify-center h-24 bg-gradient-to-br from-blue-50 to-blue-100">
        <span className="text-sm text-blue-600 font-medium">{slideList[activeSlide] ?? slideList[0]}</span>
      </div>
      <div className="absolute inset-y-0 left-1 flex items-center">
        <button
          onClick={(e) => { e.stopPropagation(); setActiveSlide((i) => (i - 1 + safeLen) % safeLen); }}
          className="w-6 h-6 rounded-full bg-white/90 shadow text-gray-600 text-xs flex items-center justify-center"
        >◀</button>
      </div>
      <div className="absolute inset-y-0 right-1 flex items-center">
        <button
          onClick={(e) => { e.stopPropagation(); setActiveSlide((i) => (i + 1) % safeLen); }}
          className="w-6 h-6 rounded-full bg-white/90 shadow text-gray-600 text-xs flex items-center justify-center"
        >▶</button>
      </div>
      <div className="flex justify-center gap-1 py-1.5 bg-white border-t border-gray-100">
        {slideList.map((_, i) => (
          <div
            key={i}
            onClick={() => setActiveSlide(i)}
            className={`w-1.5 h-1.5 rounded-full cursor-pointer ${i === activeSlide ? "bg-blue-600" : "bg-gray-300"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function AstryxResizable({ direction = "horizontal" }: AstryxProps) {
  const isH = direction === "horizontal";
  return (
    <div className={`flex ${isH ? "flex-row" : "flex-col"} w-full h-20 rounded-md border border-gray-200 overflow-hidden`}>
      <div className="flex-1 bg-white flex items-center justify-center">
        <span className="text-xs text-gray-400">Panel 1</span>
      </div>
      <div className={`${isH ? "w-0.5 cursor-col-resize" : "h-0.5 cursor-row-resize"} bg-gray-200 hover:bg-blue-400 transition-colors`} />
      <div className="flex-1 bg-gray-50 flex items-center justify-center">
        <span className="text-xs text-gray-400">Panel 2</span>
      </div>
    </div>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export function AstryxNavbar({ logo = "AppName", links = "Home,Features,Pricing,About", actions = "Sign In,Get Started" }: AstryxProps) {
  const linkList = String(links).split(",").map((s) => s.trim()).filter(Boolean);
  const actionList = String(actions).split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <nav className="w-full flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      <span className="font-semibold text-gray-900 text-sm">{logo}</span>
      <div className="flex items-center gap-5">
        {linkList.map((l) => (
          <span key={l} className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer">{l}</span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {actionList.map((a, i) => (
          <button key={a} className={`px-3 py-1.5 rounded-md text-sm font-medium ${i === actionList.length - 1 ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}>{a}</button>
        ))}
      </div>
    </nav>
  );
}

export function AstryxSidebar({ logo = "App", items = "Dashboard,Analytics,Projects,Settings,Help", active = "Dashboard" }: AstryxProps) {
  const itemList = String(items).split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <div className="flex flex-col w-full min-h-48 bg-white border-r border-gray-200 py-3">
      <div className="px-4 pb-3 mb-1 border-b border-gray-100">
        <span className="font-semibold text-gray-900 text-sm">{logo}</span>
      </div>
      <nav className="flex flex-col gap-0.5 px-2 pt-2">
        {itemList.map((item) => (
          <div key={item} className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer ${item === active ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"}`}>
            <span className="text-xs opacity-60">◈</span>
            {item}
          </div>
        ))}
      </nav>
    </div>
  );
}

export function AstryxBreadcrumb({ items = "Home,Projects,Current Page" }: AstryxProps) {
  const itemList = String(items).split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <nav className="w-full flex items-center gap-1.5 text-sm flex-wrap">
      {itemList.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className={i === itemList.length - 1 ? "text-gray-900 font-medium" : "text-blue-600 hover:underline cursor-pointer"}>{item}</span>
          {i < itemList.length - 1 && <span className="text-gray-400 text-xs">›</span>}
        </span>
      ))}
    </nav>
  );
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

export function AstryxModal({ title = "Confirm Action", description = "Are you sure you want to continue? This action cannot be undone.", confirmLabel = "Confirm", cancelLabel = "Cancel" }: AstryxProps) {
  return (
    <div className="w-full rounded-lg bg-white border border-gray-200 shadow-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="px-5 py-4">
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
        <button className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-700 border border-gray-300 bg-white">{cancelLabel}</button>
        <button className="px-3 py-1.5 rounded-md text-sm font-medium text-white bg-blue-600">{confirmLabel}</button>
      </div>
    </div>
  );
}

export function AstryxDrawer({ title = "Drawer", side = "right", description = "Drawer content goes here." }: AstryxProps) {
  return (
    <div className={`flex ${side === "left" ? "flex-row" : "flex-row-reverse"} w-full min-h-40`}>
      <div className="w-64 bg-white border-l border-gray-200 flex flex-col shadow-xl shrink-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          <button className="text-gray-400 text-xs">✕</button>
        </div>
        <div className="px-4 py-3 text-sm text-gray-600 flex-1">{description}</div>
      </div>
      <div className="flex-1 bg-gray-100 flex items-center justify-center text-xs text-gray-400 min-h-24">page content</div>
    </div>
  );
}

export function AstryxSheet({ title = "Sheet", side = "bottom", description = "Sheet content goes here." }: AstryxProps) {
  return (
    <div className={`flex ${side === "top" ? "flex-col" : "flex-col-reverse"} w-full min-h-40`}>
      <div className="w-full bg-white border-t border-gray-200 rounded-t-xl shadow-xl">
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-8 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          <button className="text-gray-400 text-xs">✕</button>
        </div>
        <div className="px-4 py-3 text-sm text-gray-600">{description}</div>
      </div>
      <div className="flex-1 bg-gray-100 flex items-center justify-center text-xs text-gray-400 min-h-12">page content</div>
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function parseChartData(raw: string): { name: string; value: number }[] {
  return String(raw).split(",").map((s) => {
    const [n, v] = s.trim().split(":");
    return { name: n?.trim() || "?", value: Number(v) || 0 };
  }).filter((d) => d.name && d.name !== "?");
}

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#6b7280"];

function resolveColor(color: string) {
  return color === "green" ? "#10b981" : color === "red" ? "#ef4444" : color === "amber" ? "#f59e0b" : "#3b82f6";
}

export function AstryxBarChart({ data = "Jan:120,Feb:95,Mar:140,Apr:110,May:160,Jun:130", color = "blue", title }: AstryxProps) {
  const parsed = parseChartData(data);
  const fill = resolveColor(color);
  return (
    <div className="w-full">
      {title && <p className="text-sm font-medium text-gray-700 mb-2">{title}</p>}
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={parsed} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }} />
          <Bar dataKey="value" fill={fill} radius={[3, 3, 0, 0] as any} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AstryxLineChart({ data = "Jan:120,Feb:95,Mar:140,Apr:110,May:160,Jun:130", color = "blue", title }: AstryxProps) {
  const parsed = parseChartData(data);
  const stroke = resolveColor(color);
  return (
    <div className="w-full">
      {title && <p className="text-sm font-medium text-gray-700 mb-2">{title}</p>}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={parsed} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }} />
          <Line type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} dot={{ r: 3, fill: stroke }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AstryxPieChart({ data = "Category A:40,Category B:30,Category C:20,Other:10", title }: AstryxProps) {
  const parsed = parseChartData(data);
  return (
    <div className="w-full">
      {title && <p className="text-sm font-medium text-gray-700 mb-2">{title}</p>}
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={parsed} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
            {parsed.map((_: any, i: number) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }} />
          <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10, color: "#6b7280" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Media ────────────────────────────────────────────────────────────────────

export function AstryxVideoPlayer({ title = "Video Title", duration = "3:45" }: AstryxProps) {
  return (
    <div className="w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-900">
      <div className="relative w-full bg-gray-800 flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center cursor-pointer">
          <span className="text-white text-xl ml-1">▶</span>
        </div>
        <div className="absolute bottom-2 right-2 text-xs text-white/70 bg-black/40 px-1.5 py-0.5 rounded">{duration}</div>
      </div>
      <div className="px-3 py-2 bg-white border-t border-gray-200">
        <div className="flex items-center gap-2 mb-1.5">
          <button className="text-gray-600 text-sm">▶</button>
          <div className="flex-1 h-1 bg-gray-200 rounded-full">
            <div className="w-1/3 h-full bg-blue-500 rounded-full" />
          </div>
          <span className="text-xs text-gray-500">{duration}</span>
        </div>
        {title && <p className="text-xs text-gray-700 font-medium truncate">{title}</p>}
      </div>
    </div>
  );
}

export function AstryxCodeBlock({ code = 'function greet(name) {\n  return `Hello, ${name}!`;\n}', language = "javascript" }: AstryxProps) {
  return (
    <div className="w-full rounded-lg overflow-hidden border border-gray-200">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-400 font-mono">{language}</span>
        <span className="text-xs text-gray-500">copy</span>
      </div>
      <pre className="w-full bg-gray-900 px-4 py-3 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── List ─────────────────────────────────────────────────────────────────────

export function AstryxList({ children, divided = true }: AstryxProps) {
  return (
    <div className={`w-full rounded-md border border-gray-200 bg-white overflow-hidden ${divided ? "divide-y divide-gray-100" : ""}`}>
      {children}
    </div>
  );
}

export function AstryxListItem({ label = "List item", description, icon, active = false, meta }: AstryxProps) {
  return (
    <div className={`w-full flex items-center gap-3 px-4 py-3 ${active ? "bg-blue-50" : "hover:bg-gray-50"}`}>
      {icon && <span className="text-base text-gray-400 shrink-0 w-5 text-center">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${active ? "text-blue-700" : "text-gray-900"}`}>{label}</p>
        {description && <p className="text-xs text-gray-500 truncate mt-0.5">{description}</p>}
      </div>
      {meta && <span className="text-xs text-gray-400 shrink-0">{meta}</span>}
    </div>
  );
}

export const COMPONENT_REGISTRY: Record<string, (props: AstryxProps) => JSX.Element> = {
  Button:      AstryxButton,
  Card:        AstryxCard,
  Badge:       AstryxBadge,
  Text:        AstryxText,
  Heading:     AstryxHeading,
  Avatar:      AstryxAvatar,
  Spinner:     AstryxSpinner,
  Divider:     AstryxDivider,
  ProgressBar: AstryxProgressBar,
  StatusDot:   AstryxStatusDot,
  Skeleton:    AstryxSkeleton,
  Banner:      AstryxBanner,
  EmptyState:  AstryxEmptyState,
  ChatMessage: AstryxChatMessage,
  Token:       AstryxToken,
  TextInput:   AstryxTextInput,
  Stack:       AstryxStack,
  HStack:      AstryxHStack,
  VStack:      AstryxStack,
  Icon:        AstryxIcon,
  Table:       AstryxTable,
  Tabs:        AstryxTabs,
  Accordion:   AstryxAccordion,
  Select:      AstryxSelect,
  Checkbox:    AstryxCheckbox,
  RadioGroup:  AstryxRadioGroup,
  Slider:      AstryxSlider,
  Calendar:    AstryxCalendar,
  Command:     AstryxCommand,
  Carousel:    AstryxCarousel,
  Resizable:   AstryxResizable,
  // Navigation
  Navbar:      AstryxNavbar,
  Sidebar:     AstryxSidebar,
  Breadcrumb:  AstryxBreadcrumb,
  // Overlays
  Modal:       AstryxModal,
  Drawer:      AstryxDrawer,
  Sheet:       AstryxSheet,
  // Charts
  BarChart:    AstryxBarChart,
  LineChart:   AstryxLineChart,
  PieChart:    AstryxPieChart,
  // Media
  VideoPlayer: AstryxVideoPlayer,
  CodeBlock:   AstryxCodeBlock,
  // List
  List:        AstryxList,
  ListItem:    AstryxListItem,
};
