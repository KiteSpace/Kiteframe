/**
 * Builder Shell component registry.
 *
 * One typed entry per palette component — stable IDs, display metadata, and
 * category membership.  The toolbox items (getElement / preview) remain in
 * DesignEditor.tsx because they reference craft.js JSX; this module owns
 * only the metadata that drives search, grouping, and keyboard insertion.
 */

import type { ReactNode } from "react";

export type ComponentCategory =
  | "layout"
  | "typography"
  | "controls"
  | "data"
  | "media"
  | "feedback";

export interface ComponentDef {
  /** Stable, unique slug — used as localStorage key and drag payload. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** One-line description. */
  description: string;
  /** 3-character monospace glyph shown in grid and list tiles. */
  glyph: string;
  /** Fixed category this component belongs to. */
  category: ComponentCategory;
  /** Extra search terms (lowercase). */
  keywords?: string[];
  /**
   * Grid-tile thumbnail contract.
   * - A ReactNode: registry-authored mini preview, rendered as-is (highest priority).
   * - `'auto'` (or omitted): resolve the editor's authored/live preview for this id.
   * The editor always falls back to the 3-char glyph when nothing resolves,
   * so no tile can ever be blank.
   */
  preview?: "auto" | ReactNode;
  /**
   * Optional deterministic props merged onto the resolved preview element.
   * Keep values short and static — previews must never fetch, animate, or
   * enter loading/error states.
   */
  previewProps?: Record<string, unknown>;
}

// Fixed rendering order — empty groups are hidden.
export const CATEGORY_ORDER: ComponentCategory[] = [
  "layout",
  "typography",
  "controls",
  "data",
  "media",
  "feedback",
];

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  layout: "Layout",
  typography: "Typography",
  controls: "Controls",
  data: "Data",
  media: "Media",
  feedback: "Feedback",
};

// Dot colours that appear next to category headers.
// Values match the --kf-cat-* tokens in index.css (Graphite palette).
export const CATEGORY_COLORS: Record<ComponentCategory, string> = {
  layout:     "var(--kf-cat-layout)",
  typography: "var(--kf-cat-typography)",
  controls:   "var(--kf-cat-controls)",
  data:       "var(--kf-cat-data)",
  media:      "var(--kf-cat-media)",
  feedback:   "var(--kf-cat-feedback)",
};

/**
 * Full flat registry.  IDs match the TOOLBOX_CATEGORIES `name` field so the
 * two structures can be zipped by name without renaming anything.
 */
export const COMPONENT_REGISTRY: ComponentDef[] = [
  // ── Layout ──────────────────────────────────────────────────────────────────
  { id: "Section",    name: "Section",    description: "Flex container",       glyph: "SEC", category: "layout",     keywords: ["container", "wrapper", "flex", "column", "row"] },
  { id: "Stack",      name: "Stack",      description: "Vertical stack",        glyph: "STK", category: "layout",     keywords: ["column", "vertical", "list"] },
  { id: "HStack",     name: "HStack",     description: "Horizontal stack",      glyph: "HST", category: "layout",     keywords: ["row", "horizontal", "inline"] },
  { id: "Grid",       name: "Grid",       description: "Equal-column grid",     glyph: "GRD", category: "layout",     keywords: ["columns", "masonry", "gallery"] },
  { id: "Resizable",  name: "Resizable",  description: "Split panels",          glyph: "RES", category: "layout",     keywords: ["split", "pane", "divider", "resize"] },
  { id: "Card",       name: "Card",       description: "Elevated box",          glyph: "CRD", category: "layout",     keywords: ["surface", "paper", "elevated", "box"] },
  { id: "ClickableCard",  name: "ClickableCard",  description: "Card that reads as clickable", glyph: "CLC", category: "layout", keywords: ["card", "hover", "link"] },
  { id: "SelectableCard", name: "SelectableCard", description: "Card with a selected state",   glyph: "SLC", category: "layout", keywords: ["card", "selected", "radio"] },
  { id: "Overlay",    name: "Overlay",    description: "Scrim container",       glyph: "OVL", category: "layout",     keywords: ["backdrop", "scrim", "modal"] },
  { id: "List",       name: "List",       description: "List container",        glyph: "LST", category: "layout",     keywords: ["items", "rows", "divided"] },
  { id: "ListItem",   name: "ListItem",   description: "List row",              glyph: "LIT", category: "layout",     keywords: ["row", "item", "entry"] },
  { id: "FormLayout", name: "FormLayout", description: "Form field grid",       glyph: "FLY", category: "layout",     keywords: ["form", "fields", "grid"] },
  { id: "Field",      name: "Field",      description: "Labelled field wrapper",glyph: "FLD", category: "layout",     keywords: ["label", "input", "form"] },
  { id: "InputGroup", name: "InputGroup", description: "Joined input row",      glyph: "IGP", category: "layout",     keywords: ["input", "button", "row", "inline"] },

  // ── Typography ──────────────────────────────────────────────────────────────
  { id: "Heading",    name: "Heading",    description: "Bold heading",          glyph: "HDG", category: "typography", keywords: ["title", "h1", "h2", "h3", "text"] },
  { id: "Text",       name: "Text",       description: "Body copy",             glyph: "TXT", category: "typography", keywords: ["paragraph", "copy", "label"] },
  { id: "Link",       name: "Link",       description: "Inline text link",      glyph: "LNK", category: "typography", keywords: ["anchor", "url", "href"] },

  // ── Controls ────────────────────────────────────────────────────────────────
  { id: "Button",          name: "Button",          description: "Action button",       glyph: "BTN", category: "controls", keywords: ["click", "action", "submit", "cta"] },
  { id: "IconButton",      name: "IconButton",      description: "Icon-only button",    glyph: "ICB", category: "controls", keywords: ["icon", "action", "button"] },
  { id: "ToggleButton",    name: "ToggleButton",    description: "Toggleable button",   glyph: "TGB", category: "controls", keywords: ["toggle", "active", "pressed"] },
  { id: "SegmentedControl",name: "SegmentedControl",description: "Segmented picker",    glyph: "SEG", category: "controls", keywords: ["tabs", "segment", "switcher"] },
  { id: "TextInput",       name: "TextInput",       description: "Input field",         glyph: "INP", category: "controls", keywords: ["input", "text", "field", "form"] },
  { id: "TextArea",        name: "TextArea",        description: "Multi-line text",     glyph: "TXA", category: "controls", keywords: ["textarea", "multiline", "input"] },
  { id: "NumberInput",     name: "NumberInput",     description: "Stepper field",       glyph: "NUM", category: "controls", keywords: ["number", "stepper", "quantity"] },
  { id: "Select",          name: "Select",          description: "Dropdown",            glyph: "SEL", category: "controls", keywords: ["dropdown", "option", "picker"] },
  { id: "Checkbox",        name: "Checkbox",        description: "Checkbox",            glyph: "CHK", category: "controls", keywords: ["check", "tick", "boolean"] },
  { id: "CheckboxList",    name: "CheckboxList",    description: "Multi-select list",   glyph: "CKL", category: "controls", keywords: ["multiselect", "checkboxes", "list"] },
  { id: "RadioGroup",      name: "RadioGroup",      description: "Radio buttons",       glyph: "RDO", category: "controls", keywords: ["radio", "option", "exclusive"] },
  { id: "Switch",          name: "Switch",          description: "On/off toggle",       glyph: "SWT", category: "controls", keywords: ["toggle", "on", "off", "boolean"] },
  { id: "Slider",          name: "Slider",          description: "Range slider",        glyph: "SLD", category: "controls", keywords: ["range", "value", "drag"] },
  { id: "DateInput",       name: "DateInput",       description: "Date picker field",   glyph: "DAT", category: "controls", keywords: ["date", "calendar", "picker"] },
  { id: "TimeInput",       name: "TimeInput",       description: "Time picker field",   glyph: "TIM", category: "controls", keywords: ["time", "clock", "hour"] },
  { id: "DateTimeInput",   name: "DateTimeInput",   description: "Date and time field", glyph: "DTI", category: "controls", keywords: ["datetime", "schedule", "picker"] },
  { id: "DateRangeInput",  name: "DateRangeInput",  description: "Date range field",    glyph: "DRI", category: "controls", keywords: ["daterange", "period", "from to"] },
  { id: "FileInput",       name: "FileInput",       description: "File upload field",   glyph: "FIL", category: "controls", keywords: ["upload", "file", "attachment"] },
  { id: "Typeahead",       name: "Typeahead",       description: "Search-as-you-type",  glyph: "TAH", category: "controls", keywords: ["autocomplete", "search", "suggest"] },
  { id: "MultiSelector",   name: "MultiSelector",   description: "Multi-select dropdown",glyph:"MSL", category: "controls", keywords: ["multiselect", "dropdown", "tags"] },
  { id: "ComplexSelector", name: "ComplexSelector", description: "Rich option list",    glyph: "CSL", category: "controls", keywords: ["selector", "option", "rich"] },
  { id: "PowerSearch",     name: "PowerSearch",     description: "Search with filters", glyph: "PSR", category: "controls", keywords: ["search", "filter", "query"] },
  { id: "Tokenizer",       name: "Tokenizer",       description: "Tag entry field",     glyph: "TOK", category: "controls", keywords: ["tag", "chip", "multi", "input"] },
  { id: "FieldStatus",     name: "FieldStatus",     description: "Validation message",  glyph: "FST", category: "controls", keywords: ["error", "hint", "validation"] },

  // ── Data ────────────────────────────────────────────────────────────────────
  { id: "Table",      name: "Table",      description: "Data table",            glyph: "TBL", category: "data",       keywords: ["grid", "rows", "columns", "spreadsheet"] },
  { id: "Tabs",       name: "Tabs",       description: "Tab bar",               glyph: "TAB", category: "data",       keywords: ["navigation", "section", "panel"] },
  { id: "Accordion",  name: "Accordion",  description: "Collapsible",           glyph: "ACC", category: "data",       keywords: ["collapse", "expand", "disclosure"] },
  { id: "Calendar",   name: "Calendar",   description: "Date picker",           glyph: "CAL", category: "data",       keywords: ["date", "month", "schedule"] },
  { id: "Command",    name: "Command",    description: "Search palette",        glyph: "CMD", category: "data",       keywords: ["search", "command", "spotlight"] },
  { id: "Carousel",   name: "Carousel",   description: "Slide viewer",          glyph: "CAR", category: "data",       keywords: ["slides", "gallery", "scroll"] },
  { id: "BarChart",   name: "BarChart",   description: "Bar chart",             glyph: "BAR", category: "data",       keywords: ["chart", "graph", "analytics"] },
  { id: "LineChart",  name: "LineChart",  description: "Line chart",            glyph: "LIN", category: "data",       keywords: ["chart", "graph", "trend"] },
  { id: "PieChart",   name: "PieChart",   description: "Pie / donut chart",     glyph: "PIE", category: "data",       keywords: ["chart", "donut", "proportion"] },
  { id: "Navbar",     name: "Navbar",     description: "Top navigation bar",    glyph: "NAV", category: "data",       keywords: ["navigation", "header", "top bar"] },
  { id: "Sidebar",    name: "Sidebar",    description: "Side navigation",       glyph: "SDB", category: "data",       keywords: ["navigation", "sidebar", "menu"] },
  { id: "Breadcrumb", name: "Breadcrumb", description: "Page breadcrumb",       glyph: "BRD", category: "data",       keywords: ["navigation", "path", "trail"] },
  { id: "NavMenu",    name: "NavMenu",    description: "Nav item row",          glyph: "NVM", category: "data",       keywords: ["navigation", "menu", "items"] },
  { id: "MobileNav",  name: "MobileNav",  description: "Bottom tab bar",        glyph: "MNV", category: "data",       keywords: ["navigation", "mobile", "bottom"] },
  { id: "NavIcon",    name: "NavIcon",    description: "Single nav icon",       glyph: "NVI", category: "data",       keywords: ["navigation", "icon", "badge"] },
  { id: "Pagination", name: "Pagination", description: "Page control",          glyph: "PGN", category: "data",       keywords: ["paging", "pages", "next prev"] },

  // ── Media ───────────────────────────────────────────────────────────────────
  { id: "Avatar",      name: "Avatar",      description: "User avatar",          glyph: "AVT", category: "media",      keywords: ["user", "profile", "image", "initials"] },
  { id: "AvatarGroup", name: "AvatarGroup", description: "Stacked avatars",      glyph: "AVG", category: "media",      keywords: ["users", "stack", "team"] },
  { id: "Badge",       name: "Badge",       description: "Colour label",         glyph: "BGE", category: "media",      keywords: ["tag", "label", "pill", "chip"] },
  { id: "Token",       name: "Token",       description: "Tag / chip",           glyph: "TKN", category: "media",      keywords: ["tag", "chip", "pill"] },
  { id: "Icon",        name: "Icon",        description: "Icon placeholder",     glyph: "ICO", category: "media",      keywords: ["svg", "symbol", "glyph"] },
  { id: "Thumbnail",   name: "Thumbnail",   description: "Image tile",           glyph: "THB", category: "media",      keywords: ["image", "picture", "tile"] },
  { id: "VideoPlayer", name: "VideoPlayer", description: "Video embed",          glyph: "VID", category: "media",      keywords: ["video", "player", "media"] },
  { id: "CodeBlock",   name: "CodeBlock",   description: "Code snippet",         glyph: "COD", category: "media",      keywords: ["code", "syntax", "snippet"] },
  { id: "Divider",     name: "Divider",     description: "Horizontal rule",      glyph: "DVR", category: "media",      keywords: ["separator", "line", "rule", "hr"] },
  { id: "ChatMessage", name: "ChatMessage", description: "Chat bubble",          glyph: "CHT", category: "media",      keywords: ["message", "bubble", "chat"] },
  { id: "Timestamp",   name: "Timestamp",   description: "Relative time",        glyph: "TSP", category: "media",      keywords: ["time", "date", "relative", "ago"] },
  { id: "Indicator",   name: "Indicator",   description: "Status dot / count",   glyph: "IND", category: "media",      keywords: ["badge", "count", "notification"] },

  // ── Feedback ─────────────────────────────────────────────────────────────────
  { id: "Banner",      name: "Banner",      description: "Alert banner",         glyph: "BNR", category: "feedback",   keywords: ["alert", "info", "warning", "error"] },
  { id: "Spinner",     name: "Spinner",     description: "Loading spinner",      glyph: "SPN", category: "feedback",   keywords: ["loading", "progress", "wait"] },
  { id: "Skeleton",    name: "Skeleton",    description: "Loading skeleton",     glyph: "SKL", category: "feedback",   keywords: ["loading", "placeholder", "shimmer"] },
  { id: "ProgressBar", name: "ProgressBar", description: "Progress bar",         glyph: "PRG", category: "feedback",   keywords: ["progress", "loading", "percent"] },
  { id: "StatusDot",   name: "StatusDot",   description: "Status indicator",     glyph: "SDT", category: "feedback",   keywords: ["status", "online", "active"] },
  { id: "EmptyState",  name: "EmptyState",  description: "Empty state",          glyph: "EMP", category: "feedback",   keywords: ["empty", "no results", "blank"] },
  { id: "Modal",       name: "Modal",       description: "Dialog modal",         glyph: "MOD", category: "feedback",   keywords: ["dialog", "popup", "confirm"] },
  { id: "Drawer",      name: "Drawer",      description: "Side drawer",          glyph: "DRW", category: "feedback",   keywords: ["slide", "panel", "side", "sheet"] },
  { id: "Sheet",       name: "Sheet",       description: "Bottom sheet",         glyph: "SHT", category: "feedback",   keywords: ["bottom", "panel", "slide"] },
  { id: "Popover",     name: "Popover",     description: "Anchored panel",       glyph: "POP", category: "feedback",   keywords: ["tooltip", "floating", "anchor"] },
  { id: "Tooltip",     name: "Tooltip",     description: "Hover hint",           glyph: "TTP", category: "feedback",   keywords: ["hint", "hover", "info"] },
  { id: "HoverCard",   name: "HoverCard",   description: "Profile preview",      glyph: "HVC", category: "feedback",   keywords: ["card", "hover", "preview", "profile"] },
  { id: "DropdownMenu",name: "DropdownMenu",description: "Button menu",          glyph: "DDM", category: "feedback",   keywords: ["menu", "dropdown", "actions"] },
  { id: "ContextMenu", name: "ContextMenu", description: "Right-click menu",     glyph: "CTX", category: "feedback",   keywords: ["menu", "right click", "context"] },
  { id: "MoreMenu",    name: "MoreMenu",    description: "Overflow menu",        glyph: "MRM", category: "feedback",   keywords: ["overflow", "more", "actions", "ellipsis"] },
  { id: "AlertDialog", name: "AlertDialog", description: "Confirm dialog",       glyph: "ALD", category: "feedback",   keywords: ["confirm", "destructive", "alert", "dialog"] },
  { id: "Toast",       name: "Toast",       description: "Notification",         glyph: "TST", category: "feedback",   keywords: ["notification", "snackbar", "toast"] },
  { id: "Lightbox",    name: "Lightbox",    description: "Image viewer",         glyph: "LBX", category: "feedback",   keywords: ["image", "gallery", "viewer", "zoom"] },
];

// ─── Search ────────────────────────────────────────────────────────────────────

function scoreComponent(def: ComponentDef, q: string): number {
  const nameLow = def.name.toLowerCase();
  const descLow = def.description.toLowerCase();
  if (nameLow === q)                      return 100;
  if (nameLow.startsWith(q))              return 80;
  if (nameLow.includes(q))               return 60;
  if (def.keywords?.some((k) => k.includes(q))) return 40;
  if (descLow.includes(q))               return 20;
  return 0;
}

export function searchRegistry(query: string): ComponentDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return COMPONENT_REGISTRY;
  return COMPONENT_REGISTRY
    .map((def) => ({ def, score: scoreComponent(def, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.def.name.localeCompare(b.def.name))
    .map(({ def }) => def);
}

/** Group a list by category in CATEGORY_ORDER, dropping empty groups. */
export function groupByCategory(
  defs: ComponentDef[],
): Array<{ category: ComponentCategory; items: ComponentDef[] }> {
  const map = new Map<ComponentCategory, ComponentDef[]>();
  for (const d of defs) {
    const arr = map.get(d.category) ?? [];
    arr.push(d);
    map.set(d.category, arr);
  }
  return CATEGORY_ORDER
    .filter((cat) => map.has(cat))
    .map((cat) => ({ category: cat, items: map.get(cat)! }));
}

// ─── Recent components (localStorage) ─────────────────────────────────────────

const RECENT_KEY = "builder.recentComponents";
const RECENT_CAP = 12;

export function readRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_CAP) : [];
  } catch {
    return [];
  }
}

export function pushRecentId(id: string): void {
  try {
    const prev = readRecentIds().filter((x) => x !== id);
    const next = [id, ...prev].slice(0, RECENT_CAP);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

// ─── Panel view mode (localStorage) ───────────────────────────────────────────

const VIEW_KEY = "builder.panelView";
export type PanelView = "grid" | "list";

export function readPanelView(): PanelView {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

export function writePanelView(v: PanelView): void {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
}
