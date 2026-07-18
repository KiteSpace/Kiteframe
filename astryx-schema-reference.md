# Astryx Design Component Schema Reference

> Source of truth as of July 2026. Verified directly from
> `server/lib/designSchema.ts`, `server/lib/designPrompt.ts`, and `server/externalWorkflowRoutes.ts`.

---

## Q1 & Q2 — Full component list with props

The authoritative list is `SERVER_ALLOWED_CRAFT_COMPONENTS` in
`server/lib/designSchema.ts`. Any `resolvedName` not on this list causes a
server-side 422.

### Containers

| Component | Props |
|---|---|
| `AstryxArtboard` | `label:string, width:number, direction:"row"\|"column", gap:number, padding:number` |
| `AstryxSection` | `direction:"row"\|"column", gap:number, padding:number` |
| `AstryxStack` | `gap:number` |
| `AstryxHStack` | `gap:number, align:"start"\|"center"\|"end"` |

### Typography

| Component | Props |
|---|---|
| `AstryxHeading` | `children:string, size:"sm"\|"md"\|"lg"\|"xl"\|"2xl"` |
| `AstryxText` | `children:string, size:"xs"\|"sm"\|"md"\|"lg", muted:boolean` |

### Inputs & Actions

| Component | Props |
|---|---|
| `AstryxButton` | `children:string, variant:"primary"\|"secondary"\|"outline"\|"ghost", size:"sm"\|"md"\|"lg", disabled:boolean` |
| `AstryxTextInput` | `placeholder:string, label:string, disabled:boolean` |
| `AstryxSelect` | `label:string, placeholder:string, options:string[]` |
| `AstryxCheckbox` | `label:string, checked:boolean` |
| `AstryxRadioGroup` | `options:string (comma-separated), selected:string` |
| `AstryxSlider` | `value:number, min:number, max:number` |

### Status & Feedback

| Component | Props |
|---|---|
| `AstryxBadge` | `children:string, color:"blue"\|"green"\|"amber"\|"red"\|"gray"` |
| `AstryxBanner` | `children:string, variant:"info"\|"success"\|"warning"\|"error"` |
| `AstryxProgressBar` | `value:number (0–100), color:"blue"\|"green"\|"amber"\|"red"` |
| `AstryxStatusDot` | `status:"online"\|"offline"\|"busy"\|"away"` |
| `AstryxSpinner` | `size:"sm"\|"md"\|"lg"` |
| `AstryxSkeleton` | `width:number, height:number` |

### Media & Identity

| Component | Props |
|---|---|
| `AstryxAvatar` | `name:string, src:string (optional), size:"xs"\|"sm"\|"md"\|"lg"` |
| `AstryxIcon` | `name:string, size:"sm"\|"md"\|"lg"` |

### Data Display

| Component | Props |
|---|---|
| `AstryxTable` | `rows:number (1–10), columns:number (1–6), headers:string[], cellData:string[][]` |
| `AstryxTabs` | `tabs:string[]` |
| `AstryxAccordion` | `title:string` |
| `AstryxCalendar` | `month:string (e.g. "July 2026")` |
| `AstryxCommand` | `placeholder:string` |
| `AstryxCarousel` | `slides:string (comma-separated)` |

### Layout

| Component | Props |
|---|---|
| `AstryxResizable` | `direction:"horizontal"\|"vertical"` |

### Content

| Component | Props |
|---|---|
| `AstryxCard` | `variant:"elevated"\|"outlined"\|"ghost"` |
| `AstryxChatMessage` | `children:string, sender:string, timestamp:string (optional), isOwn:boolean` |
| `AstryxEmptyState` | `title:string, description:string (optional), action:string (optional)` |
| `AstryxToken` | `children:string` |
| `AstryxDivider` | `label:string (optional)` |

### Internal / fallback

| Component | Notes |
|---|---|
| `AstryxUnknown` | Server-allowed for display safety; never emit in generated JSON |

---

## Q3 — Containers vs leaves

Exactly **four** containers (`isCanvas: true`, accept children via `nodes[]`):

```
AstryxArtboard, AstryxSection, AstryxStack, AstryxHStack
```

Everything else is a **leaf** (`isCanvas: false, nodes: []`).

> **AstryxCard nuance:** the editor's drag-and-drop rules allow dropping into it
> (`canMoveIn: () => true`), but the AI system prompt treats it as a leaf. Skill
> JSON should treat it as a leaf.

### Mandatory tree structure

```
ROOT  (AstryxSection, parent: null)
  └── AstryxArtboard  "Screen 1"  (parent: "ROOT")
        └── AstryxStack / AstryxHStack / leaves …
  └── AstryxArtboard  "Screen 2"  (parent: "ROOT")
        └── …
```

---

## Q4 — Node shape (stable)

Every node in `craftState` or a `patch` must follow this exact shape:

```json
{
  "type": { "resolvedName": "AstryxButton" },
  "isCanvas": false,
  "props": {
    "children": "Submit",
    "variant": "primary",
    "size": "md",
    "disabled": false
  },
  "displayName": "AstryxButton",
  "custom": {},
  "parent": "some-parent-id",
  "hidden": false,
  "nodes": [],
  "linkedNodes": {}
}
```

Server-required fields: `type`, `props`, `parent`, `nodes`, `linkedNodes`.
`isCanvas`, `displayName`, `custom`, `hidden` are optional but always present in
practice. This shape is validated by AJV in `server/lib/designSchema.ts` and is
not expected to change.

---

## Q5 — Validation behavior

**Server hard-rejects on save.**

`validateCraftState()` in `server/lib/designSchema.ts` runs on every
`POST /api/external/designs`. It enforces:

1. ROOT node must exist
2. `resolvedName` must be in the `SERVER_ALLOWED_CRAFT_COMPONENTS` enum (strict AJV)
3. Every `parent` reference must point to a real node in the map
4. Every child in `nodes[]` must point to a real node in the map
5. No cycles in the `nodes[]` graph

Unknown component types → **422**, not silent degradation.

The **client** `sanitizeCraftState()` (in `resolver.tsx`) is a separate, lenient
path: it replaces unknown `resolvedName` values with `AstryxUnknown` so stale
saved data can still render. This does not affect what the server accepts.

**Skill validator should match server strictness** — enum check, ROOT required,
parent/child reference integrity, cycle detection.

---

## Q6 — External API routes — current status

**Both workflow and design external routes exist and are live.**

All routes are registered in `server/externalWorkflowRoutes.ts` via
`registerExternalEntityRoutes`. Auth is handled by `requireExternalApiKey`
middleware (checks `Authorization: Bearer <key>` against the `external_api_keys`
table).

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/api/external/workflows/prompt-template` | API key | Returns workflow system prompt + schema + examples |
| `POST` | `/api/external/workflows` | API key | Create unclaimed workflow (writes to `external_entities`, 24h TTL) |
| `GET` | `/api/external/workflows/:id` | API key (owner) | Fetch workflow by ID |
| `PATCH` | `/api/external/workflows/:id` | API key (owner) | Update workflow |
| `GET` | `/api/external/designs/prompt-template` | API key | Returns design system prompt + craft.js schema + examples |
| `POST` | `/api/external/designs` | API key | Create unclaimed design (writes to `designs` table, no TTL) |
| `GET` | `/api/external/designs/:id` | API key (owner) | Fetch design by ID |
| `PATCH` | `/api/external/designs/:id` | API key (owner) | Update design |

**Request body shape for POST/PATCH:**
```json
{ "data": { ... entity payload ... } }
```

For designs, the `data` field must be a complete, valid craft.js state object
(ROOT + all nodes). For workflows, `data` must match the workflow schema
returned by the prompt-template endpoint.

---

## Q7 — Write behavior & ownership

**`POST /api/external/designs` creates an unclaimed design.**

The route writes to the `designs` table with `source: "skill"` and `apiKeyId`
set to the caller's API key. There is no `claimedByUserId` set at create time —
the record is unclaimed until the user visits the view URL and clicks
"Save to my account".

**TTL:** Designs created via the external API currently have no expiry
(unlike external workflows which expire after 24 hours). The user can claim
them at any time by visiting the view URL while signed in.

---

## Q8 — Successful response shapes

| Route | Response |
|---|---|
| `POST /api/external/workflows` | `{ "id": "<uuid>", "url": "https://…/workflows/<uuid>", "expires_at": "<iso8601>" }` |
| `POST /api/external/designs` | `{ "id": "<uuid>", "url": "https://…/designs/<uuid>" }` |

Note: designs do not include `expires_at` in the response (no TTL).

---

## Q9 — Stability

The **craft.js node shape** and **component enum** are stable and server-validated.
Safe to write against.

**Previously known issues — now resolved:**

| Issue | Status |
|---|---|
| `AstryxImage` in AI prompt but not in server validator | **Fixed** — `AstryxImage` has been removed from `DESIGN_SYSTEM_PROMPT` and `ASTRYX_COMPONENT_LIST` in `server/lib/designPrompt.ts`; it was never in `SERVER_ALLOWED_CRAFT_COMPONENTS` |
| `/api/external/designs` didn't exist | **Fixed** — route now exists in `server/externalWorkflowRoutes.ts` |
| `AstryxCard` container behaviour ambiguous | **Documented** — treat as leaf in skill-generated JSON (server doesn't reject children, but skill convention is leaf-only) |
