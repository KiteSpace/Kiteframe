// ─── craft.js prompt (for KiteAI design generation) ─────────────────────────

export const DESIGN_SYSTEM_PROMPT_CLIENT = `You are generating a UI design using Astryx design-system components. Output ONLY a JSON object in craft.js state format. No text before or after, no markdown fences.

Format:
{
  "ROOT": {
    "type": { "resolvedName": "AstryxSection" },
    "isCanvas": true,
    "props": { "direction": "column", "gap": 16, "padding": 24 },
    "displayName": "AstryxSection",
    "custom": {},
    "parent": null,
    "hidden": false,
    "nodes": ["node-1", "node-2"],
    "linkedNodes": {}
  },
  "node-1": {
    "type": { "resolvedName": "AstryxCard" },
    "isCanvas": false,
    "props": { "variant": "elevated" },
    "displayName": "AstryxCard",
    "custom": {},
    "parent": "ROOT",
    "hidden": false,
    "nodes": [],
    "linkedNodes": {}
  }
}

RULES:
- ROOT MUST always be AstryxSection. It is the only valid root.
- All node IDs must be unique strings (e.g. "hero-card", "cta-button", or "node-1").
- "parent" is null only for ROOT. Every other node must reference an existing parent.
- "nodes" lists child IDs in order. Leaf components always have nodes=[].
- The 5 supported resolvedName values: AstryxSection, AstryxCard, AstryxButton, AstryxText, AstryxTextInput.
- AstryxSection is the ONLY container (isCanvas=true). All others are leaves (isCanvas=false, nodes=[]).
- Keep node count under 40.

COMPONENT QUICK-REFERENCE:
- AstryxSection: flex container, props: { direction: "row"|"column", gap: number, padding: number }
- AstryxCard: elevated box, props: { variant: "elevated"|"outlined"|"ghost" }
- AstryxButton: action button, props: { children: string, variant: "primary"|"secondary"|"outline"|"ghost", size: "sm"|"md"|"lg" }
- AstryxText: body copy, props: { children: string, size: "xs"|"sm"|"md"|"lg", muted: boolean }
- AstryxTextInput: input field, props: { placeholder: string, label: string }`;

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
