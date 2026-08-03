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
  // Navigation
  "AstryxNavbar",
  "AstryxSidebar",
  "AstryxBreadcrumb",
  // Overlays
  "AstryxModal",
  "AstryxDrawer",
  "AstryxSheet",
  // Charts
  "AstryxBarChart",
  "AstryxLineChart",
  "AstryxPieChart",
  // Media
  "AstryxVideoPlayer",
  "AstryxCodeBlock",
  // List
  "AstryxList",
  "AstryxListItem",
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
{ "type": "state", "title": "3-4 word name for this design", "message": "One-sentence description of what you built.", "craftState": { <craft.js state object> } }
Use ONLY when the canvas is empty (no CURRENT CANVAS provided in the user message).
"craftState" must be a complete craft.js state with ROOT and all nodes as a flat object.
"title" is REQUIRED — write a concise 3-4 word name that summarises what was built (e.g. "Mobile Checkout Flow", "Team Settings Page", "Analytics Dashboard"). Capitalise each word.
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
• AstryxArtboard screen/artboard frame    props: { label:string, width:number, direction:"row"|"column", gap:number, padding:number, backgroundType?:"color"|"gradient"|"image", backgroundColor?:string (hex), backgroundGradient?:string (CSS linear-gradient), backgroundImageUrl?:string (URL), textColor?:string (hex — auto-set for contrast) }
• AstryxSection  content section          props: { direction:"row"|"column", gap:number, padding:number, backgroundColor?:string (hex), textColor?:string (hex) }
• AstryxStack    vertical stack           props: { gap:number, backgroundColor?:string (hex), textColor?:string (hex) }
• AstryxHStack   horizontal row           props: { gap:number, align:"start"|"center"|"end", backgroundColor?:string (hex), textColor?:string (hex) }
• AstryxCard     content card (container) props: { variant:"elevated"|"outlined"|"ghost", backgroundColor?:string (hex), textColor?:string (hex) }

— TYPOGRAPHY —
• AstryxHeading  headline  props: { children:string, size:"sm"|"md"|"lg"|"xl"|"2xl", textColor?:string (hex) }
• AstryxText     body copy props: { children:string, size:"xs"|"sm"|"md"|"lg", muted:boolean, textColor?:string (hex) }

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

— NAVIGATION —
• AstryxNavbar    top nav bar  props: { logo:string, links:string (comma-separated nav links, e.g. "Home,Features,Pricing"), actions:string (comma-separated CTA labels, e.g. "Sign In,Get Started") }
• AstryxSidebar   side nav     props: { logo:string, items:string (comma-separated nav items, e.g. "Dashboard,Analytics,Settings"), active:string (name of the active item) }
• AstryxBreadcrumb breadcrumb trail props: { items:string (comma-separated path segments, e.g. "Home,Projects,Detail") }

— OVERLAYS —
• AstryxModal  dialog/modal  props: { title:string, description:string, confirmLabel:string (e.g. "Confirm"), cancelLabel:string (e.g. "Cancel") }
• AstryxDrawer side drawer   props: { title:string, side:"left"|"right", description:string }
• AstryxSheet  bottom sheet  props: { title:string, side:"bottom"|"top", description:string }

— CHARTS —
• AstryxBarChart  bar chart   props: { title?:string, data:string (comma-separated "label:value" pairs, e.g. "Jan:120,Feb:95,Mar:140"), color:"blue"|"green"|"red"|"amber" }
• AstryxLineChart line chart  props: { title?:string, data:string (comma-separated "label:value" pairs, e.g. "Jan:120,Feb:95,Mar:140"), color:"blue"|"green"|"red"|"amber" }
• AstryxPieChart  pie chart   props: { title?:string, data:string (comma-separated "label:value" pairs, e.g. "Mobile:45,Desktop:35,Tablet:20") }

— MEDIA —
• AstryxVideoPlayer video player props: { title:string, duration:string (e.g. "3:45") }
• AstryxCodeBlock   code snippet props: { code:string (source code, use \\n for line breaks), language:string (e.g. "javascript", "python", "sql") }

— LISTS (AstryxList is isCanvas:true — put AstryxListItem children inside it) —
• AstryxList     scrollable list container   props: { divided:boolean (true = dividers between rows) }   isCanvas: true
• AstryxListItem single list row (leaf)      props: { label:string, description?:string, icon?:string (unicode char or glyph, e.g. "★"), active?:boolean, meta?:string (right-side text, e.g. "2 min ago") }

— CONTENT —
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

━━━ DEFAULT PALETTE RULE ━━━
Always generate clean, professional LIGHT UI unless the user explicitly requests dark mode, dark theme, or a dark design.

ARTBOARD backgroundColor:
• Preferred: "#FFFFFF" (white) or "#F8FAFC" / "#F1F5F9" (very light grey) — or omit entirely.
• FORBIDDEN unless user asks for dark: any colour with luminance < 0.35 — e.g. #000000, #111827, #1e293b, #0f172a, #1a1a1a, #374151, #0d1117, navy, charcoal, dark blues/greens/purples.

CONTAINER backgroundColor (AstryxSection, AstryxStack, AstryxHStack, AstryxCard):
• Preferred: omit (transparent) or use light accent tints — e.g. "#F8FAFC", "#EFF6FF", "#F0FDF4", "#FFF7ED".
• FORBIDDEN unless user asks for dark: same dark colours as above.

ALLOWED examples: #FFFFFF, #F8FAFC, #F1F5F9, #E2E8F0, #EFF6FF, #DBEAFE, #F0FDF4
FORBIDDEN examples: #000000, #111827, #1e293b, #0f172a, #1a1a1a, #374151, #334155

━━━ CONTRAST RULE ━━━
Whenever you set backgroundColor on any container (AstryxArtboard, AstryxSection, AstryxStack, AstryxHStack, AstryxCard), you MUST also set textColor to ensure readable text:
• Dark backgrounds (luminance < 0.35) — e.g. #000000, #111827, #1e293b, #0f172a, #1a1a1a, navy, dark blues/greens/purples → textColor: "#FFFFFF"
• Light backgrounds (luminance ≥ 0.35) — e.g. #ffffff, #f8fafc, #f1f5f9, #e2e8f0, pale/pastel colors → textColor: "#111827"
• Mid-range brand colors: choose based on which side of 0.35 luminance they fall — when in doubt, use "#FFFFFF"
This applies to every container that carries a backgroundColor — never omit textColor when backgroundColor is present.

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
• Containers (isCanvas:true): AstryxArtboard, AstryxSection, AstryxStack, AstryxHStack, AstryxCard. All others are leaves (isCanvas:false, nodes:[]).
• AstryxCard is a container (isCanvas:true) — give it a nodes[] array with its child components (typically a Stack or HStack wrapping its content). Use it to group related content in a styled box.
• "parent" is null only for ROOT. Every other node must reference a valid parent ID.
• For patch:
  - When adding content to a named screen (e.g. "Screen 1"), target ONLY that AstryxArtboard node — include it in the patch with its updated "nodes" array.
  - If the user message contains the line 'Target artboard: "X"', you MUST modify only the artboard whose label is "X". Do NOT touch any other artboard's nodes array.
  - Only include ROOT in the patch if you're adding a new AstryxArtboard (new screen) directly to it.
  - Do NOT re-emit unchanged nodes from other artboards.
• Keep total node count under 20 for any single generation.

━━━ WORKFLOW-TO-DESIGN MAPPING ━━━
When the user message includes a "SCREEN MAPPING" block (produced by workflow-to-design generation):
• Generate exactly the number of AstryxArtboard nodes listed in the SCREEN MAPPING — one per screen name.
• Each artboard label MUST match the screen name from the SCREEN MAPPING exactly — never use "Screen 1", "Screen 2" when names are provided.
• Apply the ≤15-node cap per artboard individually, not across the whole design. A 3-screen design may have up to 45 nodes total.
• Place only the UI components relevant to each screen inside that screen's artboard.
• Where screen A navigates to screen B, include a Button in screen A whose label implies the transition (e.g. "Sign In", "Go to Dashboard", "Continue to Settings").
• ROOT's "nodes" array must list all artboard IDs so every screen appears on the canvas.

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

export const DESIGN_VISION_PROMPT_EXTENSION = `

━━━ VISION ANALYSIS MODE ━━━

You are analyzing a UI screenshot or rendered Figma frame. Your task: translate what you see into Astryx craft.js state.

LAYOUT SIZING — set AstryxArtboard width based on apparent form factor:
• Narrow / phone screen → width: 390
• Tablet or mid-width panel → width: 768
• Desktop / full-page layout → width: 1080 or wider

VISUAL REGION MAPPING (top → bottom, left → right):
• Navigation bar / header → AstryxHStack (align: "center") containing heading + buttons/avatar
• Page title / headline → AstryxHeading (size "2xl" | "xl" | "lg" | "md")
• Body copy, description text → AstryxText
• Elevated/shadowed card or panel → AstryxCard (variant "elevated", isCanvas:true, put children inside)
• Spreadsheet-like data grid → AstryxTable (set real headers + cellData rows)
• Tab bar across the top → AstryxTabs
• Labeled text input → AstryxTextInput
• Dropdown / select menu → AstryxSelect
• Search bar or command palette → AstryxCommand
• Button group / action bar → AstryxHStack of AstryxButton nodes
• Status chip or colored tag → AstryxBadge
• Alert or notice banner → AstryxBanner
• Progress bar → AstryxProgressBar
• Avatar / profile picture → AstryxAvatar
• Horizontal rule / separator → AstryxDivider
• Empty placeholder area → AstryxEmptyState

STRICT LIMITS:
• ≤15 nodes total per artboard including all containers — if the screen is complex, represent only the top-level regions
• Prefer AstryxCard to group distinct sub-sections rather than deep nesting
• Extract real text from the image (headings, labels, button text, table column names)
• If text is too small to read, infer realistic placeholder copy from context
• Never use "Heading 1", "Lorem ipsum", "Label", "Option A/B/C" or other generic placeholders

OUTPUT:
• Always produce TYPE 2 (full state) — ROOT → AstryxArtboard → content
• Use the frame name provided by the user as the AstryxArtboard label
• If the user message contains <CURRENT_CANVAS> (canvas already has content), produce TYPE 3 (patch) that adds the new artboard to ROOT without touching existing artboards`;

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
