export { CRAFT_STATE_SCHEMA as DESIGN_JSON_SCHEMA } from "./designSchema";

export const ASTRYX_COMPONENT_LIST = [
  "AstryxArtboard",
  "AstryxSection",
  "AstryxStack",
  "AstryxHStack",
  "AstryxHeading",
  "AstryxText",
  "AstryxButton",
  "AstryxTextInput",
  "AstryxSelect",
  "AstryxCheckbox",
  "AstryxRadioGroup",
  "AstryxSlider",
  "AstryxBadge",
  "AstryxBanner",
  "AstryxProgressBar",
  "AstryxStatusDot",
  "AstryxSpinner",
  "AstryxSkeleton",
  "AstryxAvatar",
  "AstryxIcon",
  "AstryxTable",
  "AstryxTabs",
  "AstryxAccordion",
  "AstryxCalendar",
  "AstryxCommand",
  "AstryxCarousel",
  "AstryxResizable",
  "AstryxCard",
  "AstryxChatMessage",
  "AstryxEmptyState",
  "AstryxToken",
  "AstryxDivider",
] as const;

export const DESIGN_SYSTEM_PROMPT = `You are KiteAI, a UI design assistant for the Astryx design system built on craft.js.

OUTPUT RULES:
- Always output a single valid JSON object. Nothing before or after it — no markdown, no comments.
- All string values must be under 80 chars and must NOT contain unescaped quotes or newline characters.
- Choose one of the three response types below based on context.

━━━ RESPONSE TYPES ━━━

TYPE 1 — message (use when no canvas change is needed):
{ "type": "message", "text": "..." }
Use when:
  • The user asks for a component that does NOT exist in the Astryx library.
  • The user asks a general question.
  • The request is ambiguous and you need to clarify.
In "text", be helpful: explain what IS available and suggest the closest Astryx alternative.

TYPE 2 — state (full canvas replacement — ONLY for first-time generation):
{ "type": "state", "message": "One-sentence description of what you built.", "craftState": { <craft.js state object> } }
Use ONLY when the canvas is empty (no CURRENT CANVAS provided in the user message).
"craftState" must be a complete craft.js state with ROOT and all nodes as a flat object.
"message" is REQUIRED — write a brief, friendly sentence describing what you created.

TYPE 3 — patch (add or modify — use when CURRENT CANVAS is present in the user message):
{ "type": "patch", "message": "One-sentence description of what you added or changed.", "nodes": { <partial craft.js nodes> } }
Use when <CURRENT_CANVAS> is present in the user message (the canvas already has content).
CRITICAL RULES for patch:
• "nodes" contains ONLY new or updated nodes — never re-emit nodes you are not changing.
• You MUST preserve every node ID from the existing canvas. Do NOT rename, merge, or omit existing nodes.
• Always include the direct parent node (the AstryxArtboard or container being extended) in the patch with its "nodes" array appended to include the new children IDs — keep all existing children, just add the new ones.
• Generate node IDs that don't clash with existing ones (prefix new IDs with a short random slug, e.g. "a7x-table").
• Only include ROOT in the patch if you are adding a brand-new AstryxArtboard screen.
• "message" is REQUIRED — write a brief, friendly sentence describing what you did.

━━━ AVAILABLE COMPONENTS ━━━
These are the ONLY valid resolvedName values. If the user asks for anything else, use TYPE 1.

— CONTAINERS (isCanvas: true, can hold children in "nodes") —
• AstryxArtboard screen/artboard frame    props: { label:string, width:number, direction:"row"|"column", gap:number, padding:number }
• AstryxSection  content section          props: { direction:"row"|"column", gap:number, padding:number }
• AstryxStack    vertical stack           props: { gap:number }
• AstryxHStack   horizontal row           props: { gap:number, align:"start"|"center"|"end" }

— TYPOGRAPHY —
• AstryxHeading  headline  props: { children:string, size:"sm"|"md"|"lg"|"xl"|"2xl" }
• AstryxText     body copy props: { children:string, size:"xs"|"sm"|"md"|"lg", muted:boolean }

— INPUTS & ACTIONS —
• AstryxButton    button       props: { children:string, variant:"primary"|"secondary"|"outline"|"ghost", size:"sm"|"md"|"lg", disabled:boolean }
• AstryxTextInput text field   props: { placeholder:string, label:string, disabled:boolean }
• AstryxSelect    dropdown     props: { label:string, placeholder:string, options:string[] (e.g. ["Option A","Option B","Option C"]) }
• AstryxCheckbox  checkbox     props: { label:string, checked:boolean }
• AstryxRadioGroup radio group props: { options:string (comma-separated), selected:string }
• AstryxSlider    range slider props: { value:number, min:number, max:number }

— STATUS & FEEDBACK —
• AstryxBadge       chip/tag       props: { children:string, color:"blue"|"green"|"amber"|"red"|"gray" }
• AstryxBanner      alert bar      props: { children:string, variant:"info"|"success"|"warning"|"error" }
• AstryxProgressBar progress track props: { value:number (0-100), color:"blue"|"green"|"amber"|"red" }
• AstryxStatusDot   presence dot   props: { status:"online"|"offline"|"busy"|"away" }
• AstryxSpinner     spinner        props: { size:"sm"|"md"|"lg" }
• AstryxSkeleton    placeholder    props: { width:number, height:number }

— MEDIA & IDENTITY —
• AstryxAvatar user avatar props: { name:string, src:string (optional), size:"xs"|"sm"|"md"|"lg" }
• AstryxIcon   icon glyph  props: { name:string, size:"sm"|"md"|"lg" }

— DATA DISPLAY —
• AstryxTable    data table   props: { rows:number (1-10), columns:number (1-6), headers:string[] (column names, e.g. ["Name","Email","Role"]), cellData:string[][] (row data, e.g. [["Alice Chen","alice@acme.com","Admin"],["Bob Marsh","bob@acme.com","Viewer"]]) }
• AstryxTabs     tab bar      props: { tabs:string[] (e.g. ["Overview","Activity","Settings"]) }
• AstryxAccordion collapsible props: { title:string }
• AstryxCalendar date picker  props: { month:string (e.g. "July 2026") }
• AstryxCommand  search/command palette props: { placeholder:string }
• AstryxCarousel image carousel         props: { slides:string (comma-separated) }

— LAYOUT —
• AstryxResizable split panel props: { direction:"horizontal"|"vertical" }

— CONTENT —
• AstryxCard        content card      props: { variant:"elevated"|"outlined"|"ghost" }
• AstryxChatMessage chat bubble       props: { children:string, sender:string, timestamp:string (optional), isOwn:boolean }
• AstryxEmptyState  empty placeholder props: { title:string, description:string (optional), action:string (optional) }
• AstryxToken       removable chip    props: { children:string }
• AstryxDivider     horizontal rule   props: { label:string (optional) }

━━━ REALISTIC CONTENT RULE ━━━
Always use contextual, realistic content that matches the user's request:
• Tables: set headers to real column names (e.g. ["Name","Email","Plan","Status"]) and cellData to 3-5 rows of believable data (e.g. [["Alice Chen","alice@acme.com","Pro","Active"],["Bob Marsh","bob@acme.com","Free","Inactive"]])
• Avatars: use real-sounding full names (e.g. "Alice Chen", "Marcus Rivera", "Priya Nair")
• Headings/Text: write purposeful, brief copy — never "Heading 1", "Lorem ipsum", or "Text here"
• Buttons: use action verbs matching the context — "Save Changes", "Send Message", "Add Member"
• Inputs: descriptive labels + relevant placeholder (e.g. label:"Company name" placeholder:"Acme Corp")
• Select options: real, context-appropriate choices (e.g. ["Admin","Editor","Viewer"] for a role field)
• Badges/status: realistic values — "Active", "Pending", "Archived", "Draft"
• NEVER use "Col 1", "—", "placeholder text", "Option A/B/C" unless the user explicitly asks

━━━ CRAFT.JS NODE SCHEMA ━━━
Every node (whether in craftState or a patch) must follow this shape:
{
  "type": { "resolvedName": "<AstryxComponentName>" },
  "isCanvas": true|false,
  "props": { ... },
  "displayName": "<AstryxComponentName>",
  "custom": {},
  "parent": "<parentNodeId>" | null,
  "hidden": false,
  "nodes": ["childId1", "childId2"],
  "linkedNodes": {}
}

NESTING RULES:
• ROOT must always be AstryxSection (parent: null). It holds AstryxArtboard children (the screens/frames).
• AstryxArtboard is the named screen frame — "Screen 1", "Screen 2", etc. It is a container (isCanvas:true) that holds a screen's content. Its parent is ROOT.
• Containers (isCanvas:true): AstryxArtboard, AstryxSection, AstryxStack, AstryxHStack. All others are leaves (isCanvas:false, nodes:[]).
• AstryxCard is always a leaf in generated JSON (isCanvas:false, nodes:[]) — even though the editor allows dropping into it, never give it children.
• "parent" is null only for ROOT. Every other node must reference a valid parent ID.
• For patch:
  - When adding content to a named screen (e.g. "Screen 1"), target ONLY that AstryxArtboard node — include it in the patch with its updated "nodes" array.
  - If the user message contains the line 'Target artboard: "X"', you MUST modify only the artboard whose label is "X". Do NOT touch any other artboard's nodes array.
  - Only include ROOT in the patch if you're adding a new AstryxArtboard (new screen) directly to it.
  - Do NOT re-emit unchanged nodes from other artboards.
• Keep total node count under 20 for any single generation.

━━━ EXAMPLE — patch adding a search row to Screen 1 ━━━
User canvas has: ROOT(AstryxSection) → ["screen-1"(AstryxArtboard, label:"Screen 1", nodes:["hero-heading"])]
User says: "Add a search bar to Screen 1"

Correct patch response — target the AstryxArtboard node, NOT ROOT:
{
  "type": "patch",
  "nodes": {
    "screen-1": {
      "type": { "resolvedName": "AstryxArtboard" },
      "isCanvas": true,
      "props": { "label": "Screen 1", "width": 390, "direction": "column", "gap": 16, "padding": 24 },
      "displayName": "AstryxArtboard",
      "custom": {},
      "parent": "ROOT",
      "hidden": false,
      "nodes": ["hero-heading", "b3k-search-row"],
      "linkedNodes": {}
    },
    "b3k-search-row": {
      "type": { "resolvedName": "AstryxHStack" },
      "isCanvas": true,
      "props": { "gap": 8, "align": "center" },
      "displayName": "AstryxHStack",
      "custom": {},
      "parent": "screen-1",
      "hidden": false,
      "nodes": ["b3k-search-input", "b3k-search-btn"],
      "linkedNodes": {}
    },
    "b3k-search-input": {
      "type": { "resolvedName": "AstryxTextInput" },
      "isCanvas": false,
      "props": { "placeholder": "Search...", "label": "", "disabled": false },
      "displayName": "AstryxTextInput",
      "custom": {},
      "parent": "b3k-search-row",
      "hidden": false,
      "nodes": [],
      "linkedNodes": {}
    },
    "b3k-search-btn": {
      "type": { "resolvedName": "AstryxButton" },
      "isCanvas": false,
      "props": { "children": "Search", "variant": "primary", "size": "md", "disabled": false },
      "displayName": "AstryxButton",
      "custom": {},
      "parent": "b3k-search-row",
      "hidden": false,
      "nodes": [],
      "linkedNodes": {}
    }
  }
}

━━━ EXAMPLE — message for unavailable component ━━━
User says: "Add a video player"

Correct response:
{
  "type": "message",
  "text": "The Astryx library doesn't have a video player component. The closest option is AstryxCarousel (for a slideshow). Want me to add that instead?"
}`;

export const DESIGN_FEW_SHOT_EXAMPLES = [
  {
    // Single-artboard: ROOT → AstryxArtboard → content
    input: "A user profile card showing an avatar, name, role, and a follow button.",
    output: {
      type: "state",
      message: "A user profile screen with avatar, name, role, and a Follow button.",
      craftState: {
        ROOT: {
          type: { resolvedName: "AstryxSection" },
          isCanvas: true,
          props: { direction: "column", gap: 0, padding: 0 },
          displayName: "AstryxSection",
          custom: {},
          parent: null,
          hidden: false,
          nodes: ["screen-1"],
          linkedNodes: {},
        },
        "screen-1": {
          type: { resolvedName: "AstryxArtboard" },
          isCanvas: true,
          props: { label: "Screen 1", width: 390, direction: "column", gap: 16, padding: 24 },
          displayName: "AstryxArtboard",
          custom: {},
          parent: "ROOT",
          hidden: false,
          nodes: ["id-row", "follow-btn"],
          linkedNodes: {},
        },
        "id-row": {
          type: { resolvedName: "AstryxHStack" },
          isCanvas: true,
          props: { gap: 12, align: "center" },
          displayName: "AstryxHStack",
          custom: {},
          parent: "screen-1",
          hidden: false,
          nodes: ["avatar", "info"],
          linkedNodes: {},
        },
        avatar: {
          type: { resolvedName: "AstryxAvatar" },
          isCanvas: false,
          props: { name: "Jane Smith", size: "md" },
          displayName: "AstryxAvatar",
          custom: {},
          parent: "id-row",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
        info: {
          type: { resolvedName: "AstryxStack" },
          isCanvas: true,
          props: { gap: 4 },
          displayName: "AstryxStack",
          custom: {},
          parent: "id-row",
          hidden: false,
          nodes: ["name", "role"],
          linkedNodes: {},
        },
        name: {
          type: { resolvedName: "AstryxHeading" },
          isCanvas: false,
          props: { children: "Jane Smith", size: "md" },
          displayName: "AstryxHeading",
          custom: {},
          parent: "info",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
        role: {
          type: { resolvedName: "AstryxText" },
          isCanvas: false,
          props: { children: "Product Designer", size: "sm", muted: true },
          displayName: "AstryxText",
          custom: {},
          parent: "info",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
        "follow-btn": {
          type: { resolvedName: "AstryxButton" },
          isCanvas: false,
          props: { children: "Follow", variant: "primary", size: "sm", disabled: false },
          displayName: "AstryxButton",
          custom: {},
          parent: "screen-1",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
      },
    },
  },
  {
    // Table with real headers + cellData
    input: "A team members admin page with a heading and a table showing Name, Email, Role, and Status for 3 users.",
    output: {
      type: "state",
      message: "A team members page with a heading and a data table with 3 users.",
      craftState: {
        ROOT: {
          type: { resolvedName: "AstryxSection" },
          isCanvas: true,
          props: { direction: "column", gap: 0, padding: 0 },
          displayName: "AstryxSection",
          custom: {},
          parent: null,
          hidden: false,
          nodes: ["tm-screen"],
          linkedNodes: {},
        },
        "tm-screen": {
          type: { resolvedName: "AstryxArtboard" },
          isCanvas: true,
          props: { label: "Team Members", width: 760, direction: "column", gap: 16, padding: 24 },
          displayName: "AstryxArtboard",
          custom: {},
          parent: "ROOT",
          hidden: false,
          nodes: ["tm-heading", "tm-table"],
          linkedNodes: {},
        },
        "tm-heading": {
          type: { resolvedName: "AstryxHeading" },
          isCanvas: false,
          props: { children: "Team Members", size: "xl" },
          displayName: "AstryxHeading",
          custom: {},
          parent: "tm-screen",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
        "tm-table": {
          type: { resolvedName: "AstryxTable" },
          isCanvas: false,
          props: {
            rows: 3,
            columns: 4,
            headers: ["Name", "Email", "Role", "Status"],
            cellData: [
              ["Alice Chen", "alice@acme.com", "Admin", "Active"],
              ["Marcus Rivera", "marcus@acme.com", "Editor", "Active"],
              ["Priya Nair", "priya@acme.com", "Viewer", "Inactive"],
            ],
          },
          displayName: "AstryxTable",
          custom: {},
          parent: "tm-screen",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
      },
    },
  },
  {
    // Settings screen with Select options, AstryxTabs
    input: "A settings screen with a heading, a Notification Frequency dropdown (Daily, Weekly, Never), a role selector (Admin, Editor, Viewer), and a Save Changes button.",
    output: {
      type: "state",
      message: "A settings screen with a heading, two dropdowns, and a Save Changes button.",
      craftState: {
        ROOT: {
          type: { resolvedName: "AstryxSection" },
          isCanvas: true,
          props: { direction: "column", gap: 0, padding: 0 },
          displayName: "AstryxSection",
          custom: {},
          parent: null,
          hidden: false,
          nodes: ["st-screen"],
          linkedNodes: {},
        },
        "st-screen": {
          type: { resolvedName: "AstryxArtboard" },
          isCanvas: true,
          props: { label: "Settings", width: 480, direction: "column", gap: 20, padding: 32 },
          displayName: "AstryxArtboard",
          custom: {},
          parent: "ROOT",
          hidden: false,
          nodes: ["st-heading", "st-tabs", "st-form"],
          linkedNodes: {},
        },
        "st-heading": {
          type: { resolvedName: "AstryxHeading" },
          isCanvas: false,
          props: { children: "Account Settings", size: "xl" },
          displayName: "AstryxHeading",
          custom: {},
          parent: "st-screen",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
        "st-tabs": {
          type: { resolvedName: "AstryxTabs" },
          isCanvas: false,
          props: { tabs: ["Profile", "Notifications", "Security"] },
          displayName: "AstryxTabs",
          custom: {},
          parent: "st-screen",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
        "st-form": {
          type: { resolvedName: "AstryxStack" },
          isCanvas: true,
          props: { gap: 16 },
          displayName: "AstryxStack",
          custom: {},
          parent: "st-screen",
          hidden: false,
          nodes: ["st-notif-select", "st-role-select", "st-save-btn"],
          linkedNodes: {},
        },
        "st-notif-select": {
          type: { resolvedName: "AstryxSelect" },
          isCanvas: false,
          props: { label: "Notification Frequency", placeholder: "Select frequency", options: ["Daily", "Weekly", "Never"] },
          displayName: "AstryxSelect",
          custom: {},
          parent: "st-form",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
        "st-role-select": {
          type: { resolvedName: "AstryxSelect" },
          isCanvas: false,
          props: { label: "Role", placeholder: "Select role", options: ["Admin", "Editor", "Viewer"] },
          displayName: "AstryxSelect",
          custom: {},
          parent: "st-form",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
        "st-save-btn": {
          type: { resolvedName: "AstryxButton" },
          isCanvas: false,
          props: { children: "Save Changes", variant: "primary", size: "md", disabled: false },
          displayName: "AstryxButton",
          custom: {},
          parent: "st-form",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
      },
    },
  },
  {
    // Multi-artboard: ROOT → [AstryxArtboard screen-1, AstryxArtboard screen-2]
    input: "A two-screen onboarding flow: a welcome screen with a headline and Get Started button, then a sign-up form with email, password, and a Submit button.",
    output: {
      type: "state",
      message: "A two-screen onboarding flow with a welcome screen and a sign-up form.",
      craftState: {
        ROOT: {
          type: { resolvedName: "AstryxSection" },
          isCanvas: true,
          props: { direction: "row", gap: 32, padding: 0 },
          displayName: "AstryxSection",
          custom: {},
          parent: null,
          hidden: false,
          nodes: ["ob-screen-1", "ob-screen-2"],
          linkedNodes: {},
        },
        "ob-screen-1": {
          type: { resolvedName: "AstryxArtboard" },
          isCanvas: true,
          props: { label: "Welcome", width: 390, direction: "column", gap: 24, padding: 40 },
          displayName: "AstryxArtboard",
          custom: {},
          parent: "ROOT",
          hidden: false,
          nodes: ["ob-headline", "ob-sub", "ob-start-btn"],
          linkedNodes: {},
        },
        "ob-headline": {
          type: { resolvedName: "AstryxHeading" },
          isCanvas: false,
          props: { children: "Welcome to Kiteframe", size: "2xl" },
          displayName: "AstryxHeading",
          custom: {},
          parent: "ob-screen-1",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
        "ob-sub": {
          type: { resolvedName: "AstryxText" },
          isCanvas: false,
          props: { children: "Build workflows visually in minutes.", size: "md", muted: true },
          displayName: "AstryxText",
          custom: {},
          parent: "ob-screen-1",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
        "ob-start-btn": {
          type: { resolvedName: "AstryxButton" },
          isCanvas: false,
          props: { children: "Get Started", variant: "primary", size: "lg", disabled: false },
          displayName: "AstryxButton",
          custom: {},
          parent: "ob-screen-1",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
        "ob-screen-2": {
          type: { resolvedName: "AstryxArtboard" },
          isCanvas: true,
          props: { label: "Sign Up", width: 390, direction: "column", gap: 16, padding: 40 },
          displayName: "AstryxArtboard",
          custom: {},
          parent: "ROOT",
          hidden: false,
          nodes: ["ob-form-heading", "ob-email", "ob-password", "ob-submit-btn"],
          linkedNodes: {},
        },
        "ob-form-heading": {
          type: { resolvedName: "AstryxHeading" },
          isCanvas: false,
          props: { children: "Create your account", size: "xl" },
          displayName: "AstryxHeading",
          custom: {},
          parent: "ob-screen-2",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
        "ob-email": {
          type: { resolvedName: "AstryxTextInput" },
          isCanvas: false,
          props: { placeholder: "you@example.com", label: "Email", disabled: false },
          displayName: "AstryxTextInput",
          custom: {},
          parent: "ob-screen-2",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
        "ob-password": {
          type: { resolvedName: "AstryxTextInput" },
          isCanvas: false,
          props: { placeholder: "••••••••", label: "Password", disabled: false },
          displayName: "AstryxTextInput",
          custom: {},
          parent: "ob-screen-2",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
        "ob-submit-btn": {
          type: { resolvedName: "AstryxButton" },
          isCanvas: false,
          props: { children: "Submit", variant: "primary", size: "md", disabled: false },
          displayName: "AstryxButton",
          custom: {},
          parent: "ob-screen-2",
          hidden: false,
          nodes: [],
          linkedNodes: {},
        },
      },
    },
  },
];
