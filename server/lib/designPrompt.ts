export { CRAFT_STATE_SCHEMA as DESIGN_JSON_SCHEMA } from "./designSchema";

// Allowed component names for craft.js resolver
export const ASTRYX_SUPPORTED_COMPONENTS = [
  "AstryxSection",
  "AstryxCard",
  "AstryxButton",
  "AstryxText",
  "AstryxTextInput",
] as const;

export type AstryxComponentName = typeof ASTRYX_SUPPORTED_COMPONENTS[number];

export const DESIGN_SYSTEM_PROMPT = `You are generating a UI design using Astryx design-system components. Output ONLY a JSON object in craft.js state format. No text before or after, no markdown fences.

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
- ROOT MUST always be AstryxSection (the root canvas container). It is the only valid root.
- All node IDs must be unique strings. Use descriptive IDs like "hero-card", "cta-button", or sequential "node-1", "node-2".
- "parent" is the ID of the parent node — null only for ROOT. Every non-ROOT node must reference an existing parent.
- "nodes" lists child node IDs in order. Leaf components always have nodes=[].
- The 5 supported resolvedName values: AstryxSection, AstryxCard, AstryxButton, AstryxText, AstryxTextInput.
- AstryxSection is the ONLY container (isCanvas=true). All others are leaves (isCanvas=false, nodes=[]).
- AstryxSection can be nested inside another AstryxSection for multi-column or sub-section layouts.
- Nesting order determines visual layout order — no pixel coordinates.
- Keep node count reasonable (under 40 nodes per design).

COMPONENT QUICK-REFERENCE:
- AstryxSection: flex container, props: { direction: "row"|"column", gap: number, padding: number }
- AstryxCard: elevated box, props: { variant: "elevated"|"outlined"|"ghost" }
- AstryxButton: action button, props: { children: string, variant: "primary"|"secondary"|"outline"|"ghost", size: "sm"|"md"|"lg", disabled: boolean }
- AstryxText: body copy, props: { children: string, size: "xs"|"sm"|"md"|"lg", muted: boolean }
- AstryxTextInput: input field, props: { placeholder: string, label: string, disabled: boolean }`;

export const DESIGN_FEW_SHOT_EXAMPLES = [
  {
    input: "A user profile card showing an avatar placeholder, name, role, and a follow button.",
    output: {
      ROOT: {
        type: { resolvedName: "AstryxSection" },
        isCanvas: true,
        props: { direction: "column", gap: 16, padding: 24 },
        displayName: "AstryxSection",
        custom: {},
        parent: null,
        hidden: false,
        nodes: ["profile-card", "follow-btn"],
        linkedNodes: {},
      },
      "profile-card": {
        type: { resolvedName: "AstryxCard" },
        isCanvas: false,
        props: { variant: "elevated" },
        displayName: "AstryxCard",
        custom: {},
        parent: "ROOT",
        hidden: false,
        nodes: [],
        linkedNodes: {},
      },
      "follow-btn": {
        type: { resolvedName: "AstryxButton" },
        isCanvas: false,
        props: { children: "Follow", variant: "primary", size: "sm" },
        displayName: "AstryxButton",
        custom: {},
        parent: "ROOT",
        hidden: false,
        nodes: [],
        linkedNodes: {},
      },
    },
  },
  {
    input: "A simple login form with email and password fields plus a submit button.",
    output: {
      ROOT: {
        type: { resolvedName: "AstryxSection" },
        isCanvas: true,
        props: { direction: "column", gap: 16, padding: 32 },
        displayName: "AstryxSection",
        custom: {},
        parent: null,
        hidden: false,
        nodes: ["title", "email-field", "password-field", "submit-btn"],
        linkedNodes: {},
      },
      title: {
        type: { resolvedName: "AstryxText" },
        isCanvas: false,
        props: { children: "Sign In", size: "lg" },
        displayName: "AstryxText",
        custom: {},
        parent: "ROOT",
        hidden: false,
        nodes: [],
        linkedNodes: {},
      },
      "email-field": {
        type: { resolvedName: "AstryxTextInput" },
        isCanvas: false,
        props: { label: "Email", placeholder: "you@example.com" },
        displayName: "AstryxTextInput",
        custom: {},
        parent: "ROOT",
        hidden: false,
        nodes: [],
        linkedNodes: {},
      },
      "password-field": {
        type: { resolvedName: "AstryxTextInput" },
        isCanvas: false,
        props: { label: "Password", placeholder: "Enter password" },
        displayName: "AstryxTextInput",
        custom: {},
        parent: "ROOT",
        hidden: false,
        nodes: [],
        linkedNodes: {},
      },
      "submit-btn": {
        type: { resolvedName: "AstryxButton" },
        isCanvas: false,
        props: { children: "Sign In", variant: "primary", size: "md" },
        displayName: "AstryxButton",
        custom: {},
        parent: "ROOT",
        hidden: false,
        nodes: [],
        linkedNodes: {},
      },
    },
  },
];
