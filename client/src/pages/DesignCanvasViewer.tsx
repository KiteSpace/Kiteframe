import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Astryx component registry
// Each entry renders a lightweight Tailwind-styled approximation of the
// named Astryx component. Props are passed through as-is.
// ---------------------------------------------------------------------------

type AstryxProps = Record<string, any>;

function AstryxButton({ children = "Button", variant = "primary", size = "md", disabled }: AstryxProps) {
  const sizeClasses = { sm: "px-2 py-1 text-xs", md: "px-3 py-1.5 text-sm", lg: "px-4 py-2 text-base" }[size] ?? "px-3 py-1.5 text-sm";
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50",
    ghost: "text-gray-700 hover:bg-gray-100",
  }[variant] ?? "bg-blue-600 text-white";
  return (
    <button className={`inline-flex items-center justify-center rounded-md font-medium transition-colors ${sizeClasses} ${variantClasses} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`} disabled={disabled}>
      {children}
    </button>
  );
}

function AstryxCard({ children = "Card content", variant = "elevated" }: AstryxProps) {
  const variantClasses = {
    elevated: "bg-white shadow-md border border-gray-100",
    outlined: "bg-white border border-gray-300",
    ghost: "bg-gray-50",
  }[variant] ?? "bg-white shadow-md";
  return <div className={`rounded-lg p-4 ${variantClasses}`}>{children}</div>;
}

function AstryxBadge({ children = "Badge", color = "blue" }: AstryxProps) {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-800",
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    gray: "bg-gray-100 text-gray-700",
  }[color] ?? "bg-blue-100 text-blue-800";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses}`}>{children}</span>;
}

function AstryxText({ children = "Text", size = "md", muted }: AstryxProps) {
  const sizeClasses = { xs: "text-xs", sm: "text-sm", md: "text-base", lg: "text-lg" }[size] ?? "text-base";
  return <p className={`${sizeClasses} ${muted ? "text-gray-500" : "text-gray-900"}`}>{children}</p>;
}

function AstryxHeading({ children = "Heading", size = "lg" }: AstryxProps) {
  const sizeClasses = { sm: "text-base font-semibold", md: "text-lg font-semibold", lg: "text-xl font-bold", xl: "text-2xl font-bold", "2xl": "text-3xl font-bold" }[size] ?? "text-xl font-bold";
  return <h2 className={`${sizeClasses} text-gray-900`}>{children}</h2>;
}

function AstryxAvatar({ name = "?", src, size = "md" }: AstryxProps) {
  const sizeClasses = { xs: "w-6 h-6 text-xs", sm: "w-8 h-8 text-sm", md: "w-10 h-10 text-base", lg: "w-14 h-14 text-lg" }[size] ?? "w-10 h-10 text-base";
  const initials = name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={`${sizeClasses} rounded-full bg-blue-500 text-white flex items-center justify-center font-medium overflow-hidden`}>
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : initials}
    </div>
  );
}

function AstryxSpinner({ size = "md" }: AstryxProps) {
  const sizeClasses = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" }[size] ?? "w-6 h-6";
  return <div className={`${sizeClasses} border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin`} />;
}

function AstryxDivider({ label }: AstryxProps) {
  return (
    <div className="flex items-center gap-2 w-40">
      <div className="flex-1 h-px bg-gray-200" />
      {label && <span className="text-xs text-gray-500 whitespace-nowrap">{label}</span>}
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

function AstryxProgressBar({ value = 50, color = "blue" }: AstryxProps) {
  const colorClasses = { blue: "bg-blue-500", green: "bg-green-500", amber: "bg-amber-500", red: "bg-red-500" }[color] ?? "bg-blue-500";
  const clampedValue = Math.max(0, Math.min(100, Number(value)));
  return (
    <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full ${colorClasses} rounded-full transition-all`} style={{ width: `${clampedValue}%` }} />
    </div>
  );
}

function AstryxStatusDot({ status = "online" }: AstryxProps) {
  const colorClasses = { online: "bg-green-500", offline: "bg-gray-400", busy: "bg-red-500", away: "bg-amber-500" }[status] ?? "bg-green-500";
  return <div className={`w-2.5 h-2.5 rounded-full ${colorClasses}`} />;
}

function AstryxSkeleton({ width = 120, height = 16 }: AstryxProps) {
  return <div className="rounded animate-pulse bg-gray-200" style={{ width, height }} />;
}

function AstryxBanner({ children = "Banner message", variant = "info" }: AstryxProps) {
  const variantClasses = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    success: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    error: "bg-red-50 border-red-200 text-red-800",
  }[variant] ?? "bg-blue-50 border-blue-200 text-blue-800";
  return <div className={`px-3 py-2 rounded-md border text-sm ${variantClasses}`}>{children}</div>;
}

function AstryxEmptyState({ title = "Nothing here", description, action }: AstryxProps) {
  return (
    <div className="flex flex-col items-center gap-2 p-6 text-center">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl">○</div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description && <p className="text-xs text-gray-500">{description}</p>}
      {action && <button className="mt-1 text-xs text-blue-600 hover:underline">{action}</button>}
    </div>
  );
}

function AstryxChatMessage({ children = "Message", sender = "User", timestamp, isOwn }: AstryxProps) {
  return (
    <div className={`flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}>
      <span className="text-xs text-gray-500">{sender}{timestamp ? ` · ${timestamp}` : ""}</span>
      <div className={`px-3 py-2 rounded-2xl text-sm max-w-xs ${isOwn ? "bg-blue-600 text-white rounded-tr-sm" : "bg-gray-100 text-gray-900 rounded-tl-sm"}`}>
        {children}
      </div>
    </div>
  );
}

function AstryxToken({ children = "Tag" }: AstryxProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
      {children}
      <span className="text-gray-400 hover:text-gray-600 cursor-pointer">×</span>
    </span>
  );
}

function AstryxTextInput({ placeholder = "Enter text…", label, value, disabled }: AstryxProps) {
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

function AstryxStack({ children, gap = 8 }: AstryxProps) {
  return <div className="flex flex-col" style={{ gap }}>{children}</div>;
}

function AstryxHStack({ children, gap = 8, align = "center" }: AstryxProps) {
  const alignClasses = { start: "items-start", center: "items-center", end: "items-end" }[align] ?? "items-center";
  return <div className={`flex flex-row ${alignClasses}`} style={{ gap }}>{children}</div>;
}

function AstryxIcon({ name = "★", size = "md" }: AstryxProps) {
  const sizeClasses = { sm: "text-base", md: "text-xl", lg: "text-2xl" }[size] ?? "text-xl";
  return <span className={`${sizeClasses} text-gray-500 select-none`} title={name}>⬡</span>;
}

function AstryxUnknown({ astryxComponent }: { astryxComponent: string }) {
  return (
    <div className="border border-dashed border-gray-300 rounded-md px-3 py-2 text-xs text-gray-400 bg-gray-50">
      [{astryxComponent}]
    </div>
  );
}

// ---------------------------------------------------------------------------
// Registry map
// ---------------------------------------------------------------------------

const COMPONENT_REGISTRY: Record<string, (props: AstryxProps) => JSX.Element> = {
  Button: AstryxButton,
  Card: AstryxCard,
  Badge: AstryxBadge,
  Text: AstryxText,
  Heading: AstryxHeading,
  Avatar: AstryxAvatar,
  Spinner: AstryxSpinner,
  Divider: AstryxDivider,
  ProgressBar: AstryxProgressBar,
  StatusDot: AstryxStatusDot,
  Skeleton: AstryxSkeleton,
  Banner: AstryxBanner,
  EmptyState: AstryxEmptyState,
  ChatMessage: AstryxChatMessage,
  Token: AstryxToken,
  TextInput: AstryxTextInput,
  Stack: AstryxStack,
  HStack: AstryxHStack,
  VStack: AstryxStack,
  Icon: AstryxIcon,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DesignComponent {
  id: string;
  astryxComponent: string;
  x: number;
  y: number;
  props?: Record<string, any>;
}

interface DesignEntityResponse {
  id: string;
  entity_type: string;
  data: {
    title?: string | null;
    components?: DesignComponent[];
  };
  expires_at?: string | null;
}

const DESIGN_MAX = 150;
const DESIGN_WARN = 120;

// ---------------------------------------------------------------------------
// Expiry countdown (shared pattern with ExternalWorkflowViewer)
// ---------------------------------------------------------------------------

function useExpiryCountdown(expiresAt: string | null | undefined) {
  const [msLeft, setMsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => setMsLeft(new Date(expiresAt).getTime() - Date.now());
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return msLeft;
}

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "expired";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

// ---------------------------------------------------------------------------
// Component count badge
// ---------------------------------------------------------------------------

function ComponentCountBadge({ count }: { count: number }) {
  if (count < DESIGN_WARN) {
    return (
      <div className="fixed bottom-4 right-4 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 shadow-sm select-none" data-testid="component-count-badge">
        {count}/{DESIGN_MAX} components
      </div>
    );
  }
  if (count < DESIGN_MAX) {
    return (
      <div className="fixed bottom-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 shadow-sm select-none" data-testid="component-count-badge">
        <AlertTriangle className="w-3 h-3" />
        {count}/{DESIGN_MAX} components — approaching limit
      </div>
    );
  }
  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 shadow-sm select-none" data-testid="component-count-badge">
      <AlertTriangle className="w-3 h-3" />
      Limit reached ({DESIGN_MAX}/{DESIGN_MAX})
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main viewer
// ---------------------------------------------------------------------------

export default function DesignCanvasViewer() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<DesignEntityResponse>({
    queryKey: ["/api/public/entities/designs", id],
    enabled: !!id,
    refetchOnWindowFocus: false,
  });

  const msLeft = useExpiryCountdown(data?.expires_at);
  const components = data?.data?.components ?? [];
  const componentCount = components.length;

  // Compute canvas bounding box for scroll container sizing
  const canvasWidth = Math.max(
    1200,
    ...components.map((c) => c.x + 400)
  );
  const canvasHeight = Math.max(
    900,
    ...components.map((c) => c.y + 200)
  );

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background" data-testid="loading-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading design…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    const is404 = error && (error as any)?.message?.includes("404");
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background" data-testid="error-screen">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-xl font-semibold">
            {is404 ? "This design has expired" : "Design not found"}
          </h2>
          <p className="text-muted-foreground">
            {is404
              ? "External designs expire after 24 hours and are automatically deleted."
              : "This design may not exist or may have been removed."}
          </p>
          <Button onClick={() => setLocation("/")} data-testid="button-go-home">
            Go to Kiteframe
          </Button>
        </div>
      </div>
    );
  }

  const showExpiryBanner = msLeft !== null && msLeft > 0;
  const title = data.data?.title || "Design Canvas";

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden" data-testid="design-canvas-viewer">
      {showExpiryBanner && (
        <div
          className="shrink-0 flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-2 text-sm"
          data-testid="expiry-banner"
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            This design expires in <strong>{formatTimeLeft(msLeft)}</strong>. Sign in to Kiteframe to save it permanently.
          </span>
        </div>
      )}

      <div className="h-14 flex items-center px-4 border-b border-border shrink-0 gap-3">
        <h1 className="text-sm font-medium truncate flex-1">{title}</h1>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
          Design Canvas · Read Only
        </span>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        <div
          className="relative"
          style={{ width: canvasWidth, height: canvasHeight }}
          data-testid="design-canvas"
        >
          {components.map((comp) => {
            const Renderer = COMPONENT_REGISTRY[comp.astryxComponent];
            return (
              <div
                key={comp.id}
                className="absolute"
                style={{ left: comp.x, top: comp.y }}
                data-testid={`design-component-${comp.id}`}
              >
                {Renderer ? (
                  <Renderer {...(comp.props ?? {})} />
                ) : (
                  <AstryxUnknown astryxComponent={comp.astryxComponent} />
                )}
              </div>
            );
          })}

          {componentCount === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-gray-400">No components in this design.</p>
            </div>
          )}
        </div>
      </div>

      <ComponentCountBadge count={componentCount} />
    </div>
  );
}
