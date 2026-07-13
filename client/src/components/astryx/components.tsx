type AstryxProps = Record<string, any>;

// Helper so TypeScript doesn't choke when indexing a literal-object with an `any` key.
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
};
