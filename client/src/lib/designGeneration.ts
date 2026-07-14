// ─── craft.js prompt (for KiteAI design generation) ─────────────────────────

export const DESIGN_SYSTEM_PROMPT_CLIENT = `You are generating a UI design using Astryx design-system components. Output ONLY a JSON object in craft.js state format. No text before or after, no markdown fences.

Format (example: user profile card with nested containers):
{
  "ROOT": {
    "type": { "resolvedName": "AstryxSection" },
    "isCanvas": true,
    "props": { "direction": "column", "gap": 16, "padding": 24 },
    "displayName": "AstryxSection",
    "custom": {},
    "parent": null,
    "hidden": false,
    "nodes": ["identity-row", "actions-row"],
    "linkedNodes": {}
  },
  "identity-row": {
    "type": { "resolvedName": "AstryxHStack" },
    "isCanvas": true,
    "props": { "gap": 12, "align": "center" },
    "displayName": "AstryxHStack",
    "custom": {},
    "parent": "ROOT",
    "hidden": false,
    "nodes": ["user-avatar", "user-info"],
    "linkedNodes": {}
  },
  "user-avatar": {
    "type": { "resolvedName": "AstryxAvatar" },
    "isCanvas": false,
    "props": { "name": "Jane Smith", "size": "md" },
    "displayName": "AstryxAvatar",
    "custom": {},
    "parent": "identity-row",
    "hidden": false,
    "nodes": [],
    "linkedNodes": {}
  },
  "user-info": {
    "type": { "resolvedName": "AstryxStack" },
    "isCanvas": true,
    "props": { "gap": 4 },
    "displayName": "AstryxStack",
    "custom": {},
    "parent": "identity-row",
    "hidden": false,
    "nodes": ["user-name", "user-role"],
    "linkedNodes": {}
  },
  "user-name": {
    "type": { "resolvedName": "AstryxHeading" },
    "isCanvas": false,
    "props": { "children": "Jane Smith", "size": "md" },
    "displayName": "AstryxHeading",
    "custom": {},
    "parent": "user-info",
    "hidden": false,
    "nodes": [],
    "linkedNodes": {}
  },
  "user-role": {
    "type": { "resolvedName": "AstryxText" },
    "isCanvas": false,
    "props": { "children": "Product Designer", "size": "sm", "muted": true },
    "displayName": "AstryxText",
    "custom": {},
    "parent": "user-info",
    "hidden": false,
    "nodes": [],
    "linkedNodes": {}
  },
  "actions-row": {
    "type": { "resolvedName": "AstryxHStack" },
    "isCanvas": true,
    "props": { "gap": 8, "align": "center" },
    "displayName": "AstryxHStack",
    "custom": {},
    "parent": "ROOT",
    "hidden": false,
    "nodes": ["btn-follow", "btn-message"],
    "linkedNodes": {}
  },
  "btn-follow": {
    "type": { "resolvedName": "AstryxButton" },
    "isCanvas": false,
    "props": { "children": "Follow", "variant": "primary", "size": "sm", "disabled": false },
    "displayName": "AstryxButton",
    "custom": {},
    "parent": "actions-row",
    "hidden": false,
    "nodes": [],
    "linkedNodes": {}
  },
  "btn-message": {
    "type": { "resolvedName": "AstryxButton" },
    "isCanvas": false,
    "props": { "children": "Message", "variant": "outline", "size": "sm", "disabled": false },
    "displayName": "AstryxButton",
    "custom": {},
    "parent": "actions-row",
    "hidden": false,
    "nodes": [],
    "linkedNodes": {}
  }
}

Key nesting patterns shown above:
- AstryxHStack ("identity-row") holds both a leaf (AstryxAvatar) and a container (AstryxStack "user-info")
- AstryxStack ("user-info") holds two leaves (AstryxHeading + AstryxText) — nested inside an HStack
- AstryxHStack ("actions-row") holds two leaf buttons side-by-side
- Always set "isCanvas": true on AstryxStack/AstryxHStack so they accept children

RULES:
- ROOT MUST always be AstryxSection. It is the only valid root.
- All node IDs must be unique strings (e.g. "hero-card", "cta-button", or "node-1").
- "parent" is null only for ROOT. Every other node must reference an existing parent.
- "nodes" lists child IDs in order. Leaf components always have nodes=[].
- CONTAINERS (isCanvas=true, can have children in "nodes"): AstryxSection, AstryxStack, AstryxHStack.
- LEAVES (isCanvas=false, nodes=[]): all other 17 components.
- Use AstryxStack for vertical grouping and AstryxHStack for horizontal rows inside a section.
- Keep node count under 40.
- Use the full palette — don't default to only Section/Button/Text. Pick components that best suit the UI being described.

COMPONENT QUICK-REFERENCE:

— CONTAINERS —
- AstryxSection: top-level flex container, props: { direction: "row"|"column", gap: number, padding: number }
- AstryxStack:   vertical stack, props: { gap: number }
- AstryxHStack:  horizontal row, props: { gap: number, align: "start"|"center"|"end" }

— TYPOGRAPHY —
- AstryxHeading: title/headline, props: { children: string, size: "sm"|"md"|"lg"|"xl"|"2xl" }
- AstryxText:    body copy, props: { children: string, size: "xs"|"sm"|"md"|"lg", muted: boolean }

— INPUTS & ACTIONS —
- AstryxButton:    action button, props: { children: string, variant: "primary"|"secondary"|"outline"|"ghost", size: "sm"|"md"|"lg", disabled: boolean }
- AstryxTextInput: text field, props: { placeholder: string, label: string, disabled: boolean }

— STATUS & FEEDBACK —
- AstryxBadge:       label chip, props: { children: string, color: "blue"|"green"|"amber"|"red"|"gray" }
- AstryxBanner:      alert bar, props: { children: string, variant: "info"|"success"|"warning"|"error" }
- AstryxProgressBar: progress track, props: { value: number (0-100), color: "blue"|"green"|"amber"|"red" }
- AstryxStatusDot:   presence dot, props: { status: "online"|"offline"|"busy"|"away" }
- AstryxSpinner:     loading spinner, props: { size: "sm"|"md"|"lg" }
- AstryxSkeleton:    loading placeholder, props: { width: number, height: number }

— MEDIA & IDENTITY —
- AstryxAvatar: user avatar, props: { name: string, src: string (optional), size: "xs"|"sm"|"md"|"lg" }
- AstryxIcon:   icon glyph, props: { name: string, size: "sm"|"md"|"lg" }

— CONTENT —
- AstryxCard:        content card, props: { variant: "elevated"|"outlined"|"ghost" }
- AstryxChatMessage: chat bubble, props: { children: string, sender: string, timestamp: string (optional), isOwn: boolean }
- AstryxEmptyState:  empty placeholder, props: { title: string, description: string (optional), action: string (optional) }
- AstryxToken:       removable tag chip, props: { children: string }
- AstryxDivider:     horizontal rule, props: { label: string (optional) }`;

// ─── craft.js types ────────────────────────────────────────────────────────────

export interface CraftNodeType {
  resolvedName: string;
}

export interface CraftNode {
  type: CraftNodeType;
  isCanvas?: boolean;
  props: Record<string, unknown>;
  displayName?: string;
  custom?: Record<string, unknown>;
  parent: string | null;
  hidden?: boolean;
  nodes: string[];
  linkedNodes?: Record<string, string>;
}

export interface CraftJsState {
  ROOT: CraftNode;
  [nodeId: string]: CraftNode;
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isCraftJsDesignState(obj: unknown): obj is CraftJsState {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  if (!o['ROOT'] || typeof o['ROOT'] !== 'object') return false;
  const root = o['ROOT'] as Record<string, unknown>;
  if (!root['type'] || typeof root['type'] !== 'object') return false;
  const rootType = root['type'] as Record<string, unknown>;
  return typeof rootType['resolvedName'] === 'string';
}

// Kept for backward compatibility with old external_entities flat-JSON designs
export interface DesignComponent {
  id: string;
  astryxComponent: string;
  x: number;
  y: number;
  props?: Record<string, unknown>;
}

export interface DesignData {
  title: string;
  components: DesignComponent[];
}

export function isDesignJson(obj: unknown): obj is DesignData {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return Array.isArray(o.components) && typeof o.title === 'string';
}
