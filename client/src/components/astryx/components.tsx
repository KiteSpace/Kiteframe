type AstryxProps = Record<string, any>;

function pick<T>(map: Record<string, T>, key: any, fallback: T): T {
  return (map[key as string] ?? fallback) as T;
}

export function AstryxButton({ children = "Button", variant = "primary", size = "md", disabled }: AstryxProps) {
  const sizeClass    = pick({ sm: "px-2 py-1 text-xs", md: "px-3 py-1.5 text-sm", lg: "px-4 py-2 text-base" }, size, "px-3 py-1.5 text-sm");
  const variantClass = pick({
    primary:   "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    outline:   "border border-gray-300 text-gray-700 hover:bg-gray-50",
    ghost:     "text-gray-700 hover:bg-gray-100",
  }, variant, "bg-blue-600 text-white");
  return (
    <button className={`inline-flex items-center justify-center rounded-md font-medium transition-colors ${sizeClass} ${variantClass} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`} disabled={disabled}>
      {children}
    </button>
  );
}

export function AstryxCard({ children = "Card content", variant = "elevated" }: AstryxProps) {
  const variantClass = pick({ elevated: "bg-white shadow-md border border-gray-100", outlined: "bg-white border border-gray-300", ghost: "bg-gray-50" }, variant, "bg-white shadow-md");
  return <div className={`rounded-lg p-4 ${variantClass}`}>{children}</div>;
}

export function AstryxBadge({ children = "Badge", color = "blue" }: AstryxProps) {
  const colorClass = pick({ blue: "bg-blue-100 text-blue-800", green: "bg-green-100 text-green-800", amber: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-800", gray: "bg-gray-100 text-gray-700" }, color, "bg-blue-100 text-blue-800");
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>{children}</span>;
}

export function AstryxText({ children = "Text", size = "md", muted }: AstryxProps) {
  const sizeClass = pick({ xs: "text-xs", sm: "text-sm", md: "text-base", lg: "text-lg" }, size, "text-base");
  return <p className={`${sizeClass} ${muted ? "text-gray-500" : "text-gray-900"}`}>{children}</p>;
}

export function AstryxHeading({ children = "Heading", size = "lg" }: AstryxProps) {
  const sizeClass = pick({ sm: "text-base font-semibold", md: "text-lg font-semibold", lg: "text-xl font-bold", xl: "text-2xl font-bold", "2xl": "text-3xl font-bold" }, size, "text-xl font-bold");
  return <h2 className={`${sizeClass} text-gray-900`}>{children}</h2>;
}

export function AstryxAvatar({ name = "?", src, size = "md" }: AstryxProps) {
  const sizeClass = pick({ xs: "w-6 h-6 text-xs", sm: "w-8 h-8 text-sm", md: "w-10 h-10 text-base", lg: "w-14 h-14 text-lg" }, size, "w-10 h-10 text-base");
  const initials = String(name).split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={`${sizeClass} rounded-full bg-blue-500 text-white flex items-center justify-center font-medium overflow-hidden`}>
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : initials}
    </div>
  );
}

export function AstryxSpinner({ size = "md" }: AstryxProps) {
  const sizeClass = pick({ sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" }, size, "w-6 h-6");
  return <div className={`${sizeClass} border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin`} />;
}

export function AstryxDivider({ label }: AstryxProps) {
  return (
    <div className="flex items-center gap-2 w-40">
      <div className="flex-1 h-px bg-gray-200" />
      {label && <span className="text-xs text-gray-500 whitespace-nowrap">{label}</span>}
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

export function AstryxProgressBar({ value = 50, color = "blue" }: AstryxProps) {
  const colorClass   = pick({ blue: "bg-blue-500", green: "bg-green-500", amber: "bg-amber-500", red: "bg-red-500" }, color, "bg-blue-500");
  const clampedValue = Math.max(0, Math.min(100, Number(value)));
  return (
    <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full ${colorClass} rounded-full transition-all`} style={{ width: `${clampedValue}%` }} />
    </div>
  );
}

export function AstryxStatusDot({ status = "online" }: AstryxProps) {
  const colorClass = pick({ online: "bg-green-500", offline: "bg-gray-400", busy: "bg-red-500", away: "bg-amber-500" }, status, "bg-green-500");
  return <div className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />;
}

export function AstryxSkeleton({ width = 120, height = 16 }: AstryxProps) {
  return <div className="rounded animate-pulse bg-gray-200" style={{ width, height }} />;
}

export function AstryxBanner({ children = "Banner message", variant = "info" }: AstryxProps) {
  const variantClass = pick({
    info:    "bg-blue-50 border-blue-200 text-blue-800",
    success: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    error:   "bg-red-50 border-red-200 text-red-800",
  }, variant, "bg-blue-50 border-blue-200 text-blue-800");
  return <div className={`px-3 py-2 rounded-md border text-sm ${variantClass}`}>{children}</div>;
}

export function AstryxEmptyState({ title = "Nothing here", description, action }: AstryxProps) {
  return (
    <div className="flex flex-col items-center gap-2 p-6 text-center">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl">○</div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description && <p className="text-xs text-gray-500">{description}</p>}
      {action && <button className="mt-1 text-xs text-blue-600 hover:underline">{action}</button>}
    </div>
  );
}

export function AstryxChatMessage({ children = "Message", sender = "User", timestamp, isOwn }: AstryxProps) {
  return (
    <div className={`flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}>
      <span className="text-xs text-gray-500">{sender}{timestamp ? ` · ${timestamp}` : ""}</span>
      <div className={`px-3 py-2 rounded-2xl text-sm max-w-xs ${isOwn ? "bg-blue-600 text-white rounded-tr-sm" : "bg-gray-100 text-gray-900 rounded-tl-sm"}`}>
        {children}
      </div>
    </div>
  );
}

export function AstryxToken({ children = "Tag" }: AstryxProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
      {children}
      <span className="text-gray-400 hover:text-gray-600 cursor-pointer">×</span>
    </span>
  );
}

export function AstryxTextInput({ placeholder = "Enter text…", label, value, disabled }: AstryxProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-gray-700">{label}</label>}
      <input
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 w-40"
        placeholder={placeholder}
        defaultValue={value}
        disabled={disabled}
        readOnly
      />
    </div>
  );
}

export function AstryxStack({ children, gap = 8 }: AstryxProps) {
  return <div className="flex flex-col" style={{ gap }}>{children}</div>;
}

export function AstryxHStack({ children, gap = 8, align = "center" }: AstryxProps) {
  const alignClass = pick({ start: "items-start", center: "items-center", end: "items-end" }, align, "items-center");
  return <div className={`flex flex-row ${alignClass}`} style={{ gap }}>{children}</div>;
}

export function AstryxIcon({ name = "★", size = "md" }: AstryxProps) {
  const sizeClass = pick({ sm: "text-base", md: "text-xl", lg: "text-2xl" }, size, "text-xl");
  return <span className={`${sizeClass} text-gray-500 select-none`} title={name}>⬡</span>;
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
    <div className="border border-dashed border-gray-300 rounded-md px-3 py-2 text-xs text-gray-400 bg-gray-50">
      [{astryxComponent}]
    </div>
  );
}

// ─── New components ────────────────────────────────────────────────────────────

export function AstryxTable({ rows = 3, columns = 3 }: AstryxProps) {
  const headers = ["Name", "Status", "Value"].slice(0, Math.min(Number(columns), 3));
  const data = [
    ["Alice", "Active", "$120"],
    ["Bob", "Pending", "$80"],
    ["Carol", "Inactive", "$200"],
  ].slice(0, Math.min(Number(rows), 3));
  return (
    <div className="rounded-md border border-gray-200 overflow-hidden w-full">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
              {row.slice(0, Math.min(Number(columns), 3)).map((cell, j) => (
                <td key={j} className="px-3 py-2 text-gray-700">{cell}</td>
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
  return (
    <div className="w-full">
      <div className="inline-flex h-9 items-center rounded-lg bg-gray-100 p-1 gap-0.5">
        {tabList.map((tab) => (
          <div
            key={tab}
            className={`px-3 py-1 rounded-md text-sm font-medium cursor-pointer transition-colors ${tab === active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
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
  return (
    <div className="w-full divide-y divide-gray-200 border border-gray-200 rounded-md overflow-hidden">
      {itemList.map((item) => (
        <div key={item}>
          <div className="flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-800 bg-white cursor-pointer hover:bg-gray-50">
            {item}
            <span className="text-gray-400 text-xs">{item === open ? "▲" : "▼"}</span>
          </div>
          {item === open && (
            <div className="px-4 py-3 text-sm text-gray-600 bg-gray-50 border-t border-gray-100">
              Content for {item}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function AstryxSelect({ placeholder = "Select option…", options = "Option 1,Option 2,Option 3" }: AstryxProps) {
  return (
    <div className="flex h-9 w-44 items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-500 cursor-pointer hover:border-gray-400">
      <span>{placeholder}</span>
      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

export function AstryxCheckbox({ label = "Checkbox label", checked = false }: AstryxProps) {
  return (
    <div className="flex items-center gap-2">
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
    <div className="flex flex-col gap-2">
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
    <div className="w-40 flex flex-col gap-1.5">
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
    <div className="rounded-md border border-gray-200 bg-white p-3 w-56 text-sm">
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
    <div className="w-56 rounded-lg border border-gray-200 bg-white shadow-md overflow-hidden">
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
  return (
    <div className="relative w-56 overflow-hidden rounded-lg border border-gray-200">
      <div className="flex items-center justify-center h-24 bg-gradient-to-br from-blue-50 to-blue-100">
        <span className="text-sm text-blue-600 font-medium">{slideList[0]}</span>
      </div>
      <div className="absolute inset-y-0 left-1 flex items-center">
        <button className="w-6 h-6 rounded-full bg-white/90 shadow text-gray-600 text-xs flex items-center justify-center">◀</button>
      </div>
      <div className="absolute inset-y-0 right-1 flex items-center">
        <button className="w-6 h-6 rounded-full bg-white/90 shadow text-gray-600 text-xs flex items-center justify-center">▶</button>
      </div>
      <div className="flex justify-center gap-1 py-1.5 bg-white border-t border-gray-100">
        {slideList.map((_, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-blue-600" : "bg-gray-300"}`} />
        ))}
      </div>
    </div>
  );
}

export function AstryxResizable({ direction = "horizontal" }: AstryxProps) {
  const isH = direction === "horizontal";
  return (
    <div className={`flex ${isH ? "flex-row" : "flex-col"} w-56 h-20 rounded-md border border-gray-200 overflow-hidden`}>
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
};
