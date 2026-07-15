# Astryx Design Component Schema Reference

> Source of truth as of July 2026. Verified directly from
> `server/lib/designSchema.ts`, `server/lib/designPrompt.ts`, and `server/routes.ts`.

---

## Q1 & Q2 — Full component list with props

The authoritative list is `SERVER_ALLOWED_CRAFT_COMPONENTS` in
`server/lib/designSchema.ts`. Any `resolvedName` not on this list causes a
server-side 422.

> **Discrepancy:** `designPrompt.ts` (the AI's system prompt) lists `AstryxImage`
> with props `{ src, alt, width, height }`, but it is **absent** from
> `SERVER_ALLOWED_CRAFT_COMPONENTS` and absent from `resolver.tsx`. If the AI
> generates it, the server returns 422. This is a bug in the AI prompt.

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
| `AstryxSelect` | `label:string, placeholder:string` |
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
| `AstryxTable` | `rows:number (1–10), columns:number (1–6)` |
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

`validateCraftState()` in `server/lib/designSchema.ts` runs on every `POST /api/designs`
and `PATCH /api/designs/:id`. It enforces:

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

## Q6 — `/api/external/designs/prompt-template` — is it built?

**No.** This route does not exist in `routes.ts`.

The existing design routes are:

| Route | Auth | Format | Notes |
|---|---|---|---|
| `POST /api/designs/generate` | required | legacy flat-JSON | writes to `external_entities` table |
| `POST /api/designs` | required | craft.js state | writes to `designs` table |
| `GET /api/designs/:id` | none | — | public read |
| `PATCH /api/designs/:id` | required (owner) | craft.js state | — |
| `POST /api/designs/:id/claim` | required | — | claim unclaimed design |

The skill's SKILL.md documents `/api/external/designs` and
`/api/external/designs/prompt-template` as if they exist — they do not. The
workflow skill equivalent (`/api/external/workflows/prompt-template`) exists;
the design parallel needs to be built.

---

## Q7 — Write behavior & ownership

**`POST /api/designs` requires authentication and immediately claims the record.**

`claimedByUserId` is set to `userId` at create time — there is no unclaimed
path for the new craft.js format. The old `POST /api/designs/generate` (legacy
flat-JSON) does create into `external_entities` with no owner, but it uses a
completely different schema and table.

If the skill needs an **unauthenticated write path** that creates unclaimed
craft.js designs (so users can claim them after viewing, as the workflow skill
does), that route does not yet exist and would need to be built.

---

## Q8 — Successful response shape

| Route | Response |
|---|---|
| `POST /api/designs` | `{ "id": "<uuid>", "url": "/designs/<uuid>" }` |
| `POST /api/designs/generate` | `{ "id": "<uuid>", "url": "/designs/<uuid>", "expires_at": "<iso8601>" }` |

The SKILL.md documents the response with `expires_at`, which matches the legacy
flat-JSON route — not the new craft.js route.

---

## Q9 — Stability

The **craft.js node shape** and **component enum** are stable and server-validated.
Safe to write against.

**Known issues to resolve before publishing the skill:**

| Issue | Risk | Action needed |
|---|---|---|
| `AstryxImage` in AI prompt but not in server validator | Generates invalid JSON → 422 | Remove from AI prompt OR add to server allowed list |
| `/api/external/designs` doesn't exist | Skill examples reference a non-existent endpoint | Build the route |
| `AstryxCard` container behaviour ambiguous | Minor | Treat as leaf in skill-generated JSON |
| ROOT-patch protection and oversized-patch safety tests just merged | Low — fixes confirmed by tests | No action needed; already solid |
