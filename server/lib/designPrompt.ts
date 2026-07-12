import { DESIGN_MAX_COMPONENTS, designJsonSchema } from "./designSchema";

export { designJsonSchema as DESIGN_JSON_SCHEMA };

// Supported Astryx component names (PascalCase).
// This list mirrors the client-side registry in DesignCanvasViewer.tsx.
export const ASTRYX_SUPPORTED_COMPONENTS = [
  "Button",
  "Card",
  "Badge",
  "Text",
  "Heading",
  "Avatar",
  "Spinner",
  "Divider",
  "ProgressBar",
  "StatusDot",
  "Skeleton",
  "Banner",
  "EmptyState",
  "ChatMessage",
  "Token",
  "TextInput",
  "Stack",
  "HStack",
  "VStack",
  "Icon",
] as const;

export type AstryxComponentName = typeof ASTRYX_SUPPORTED_COMPONENTS[number];

export const DESIGN_SYSTEM_PROMPT = `You are laying out a UI screen using Astryx design-system components. ONLY return JSON. No text before or after, no markdown code fences.

Output schema:
{
  "title": "Screen title",
  "components": [
    {
      "id": "comp-1",
      "astryxComponent": "Heading",
      "x": 24,
      "y": 24,
      "props": { "children": "Dashboard", "size": "xl" }
    },
    {
      "id": "comp-2",
      "astryxComponent": "Card",
      "x": 24,
      "y": 80,
      "props": { "children": "Card content here", "variant": "elevated" }
    }
  ]
}

RULES:
- Coordinate system: (0,0) is top-left. x increases right, y increases down. Use pixel values.
- Keep components within a 1200×900 canvas area where possible.
- Supported astryxComponent values: ${ASTRYX_SUPPORTED_COMPONENTS.join(", ")}.
- Each component MUST have a unique "id" string.
- "props" is optional but recommended; use "children" for visible text content.
- Maximum ${DESIGN_MAX_COMPONENTS} components per canvas. If a design would exceed ~100 components, propose splitting into multiple screens.
- Group related components visually: align elements on a consistent grid (multiples of 8px or 16px).
- For lists, repeat the same component type with incrementing y coordinates.
- Do NOT invent astryxComponent names outside the supported list — use the closest available component instead.

COMPONENT QUICK-REFERENCE:
- Button: clickable button, props: { children, variant: "primary"|"secondary"|"outline"|"ghost", size: "sm"|"md"|"lg", disabled }
- Card: container box, props: { children, variant: "elevated"|"outlined"|"ghost" }
- Badge: small label pill, props: { children, color: "blue"|"green"|"amber"|"red"|"gray" }
- Text: body copy, props: { children, size: "xs"|"sm"|"md"|"lg", muted }
- Heading: title text, props: { children, size: "sm"|"md"|"lg"|"xl"|"2xl" }
- Avatar: user avatar circle, props: { name, src, size: "xs"|"sm"|"md"|"lg" }
- Spinner: loading indicator, props: { size: "sm"|"md"|"lg" }
- Divider: horizontal line separator, props: { label }
- ProgressBar: progress indicator, props: { value: 0-100, color: "blue"|"green"|"amber"|"red" }
- StatusDot: small colored dot, props: { status: "online"|"offline"|"busy"|"away" }
- Skeleton: loading placeholder, props: { width, height }
- Banner: notification banner, props: { children, variant: "info"|"success"|"warning"|"error" }
- EmptyState: empty-list placeholder, props: { title, description, action }
- ChatMessage: chat bubble, props: { children, sender, timestamp, isOwn }
- Token: removable tag chip, props: { children }
- TextInput: text field, props: { placeholder, label, value, disabled }
- Stack: vertical stack layout, props: { gap: 4|8|12|16 }
- HStack: horizontal stack layout, props: { gap: 4|8|12|16, align: "start"|"center"|"end" }
- VStack: vertical stack layout alias, props: { gap: 4|8|12|16 }
- Icon: icon glyph, props: { name, size: "sm"|"md"|"lg" }`;

export const DESIGN_FEW_SHOT_EXAMPLES = [
  {
    input: "A user profile card showing an avatar, name, role badge, and a follow button.",
    output: {
      title: "User Profile Card",
      components: [
        { id: "c1", astryxComponent: "Card", x: 40, y: 40, props: { variant: "elevated" } },
        { id: "c2", astryxComponent: "Avatar", x: 80, y: 80, props: { name: "Alex Johnson", size: "lg" } },
        { id: "c3", astryxComponent: "Heading", x: 152, y: 84, props: { children: "Alex Johnson", size: "md" } },
        { id: "c4", astryxComponent: "Badge", x: 152, y: 116, props: { children: "Designer", color: "blue" } },
        { id: "c5", astryxComponent: "Button", x: 80, y: 168, props: { children: "Follow", variant: "primary", size: "sm" } },
      ],
    },
  },
  {
    input: "A simple chat thread with two messages.",
    output: {
      title: "Chat Thread",
      components: [
        { id: "c1", astryxComponent: "ChatMessage", x: 16, y: 16, props: { children: "Hey! How are you?", sender: "Taylor", timestamp: "2:30 PM", isOwn: false } },
        { id: "c2", astryxComponent: "ChatMessage", x: 16, y: 100, props: { children: "Doing great, thanks!", sender: "You", timestamp: "2:31 PM", isOwn: true } },
      ],
    },
  },
];
