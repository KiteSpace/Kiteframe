# Kiteframe External API Skill

This skill lets you create, update, and resume visual workflow diagrams on
[Kiteframe](https://kiteframe.space) directly from Claude Code (or any tool
with an API key).

---

## Quick-start

### 1 — Get the prompt template

```bash
curl -s https://kiteframe.space/api/external/workflows/prompt-template \
  -H "Authorization: Bearer $KITEFRAME_API_KEY"
```

The response contains `system_prompt`, `output_schema`, and `few_shot_examples`
that describe the exact JSON shape for nodes and edges.

### 2 — Create a workflow

```bash
curl -s -X POST https://kiteframe.space/api/external/workflows \
  -H "Authorization: Bearer $KITEFRAME_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "data": { "title": "My workflow", "nodes": [...], "edges": [...] } }'
```

Response: `{ "id": "<uuid>", "url": "https://kiteframe.space/workflows/<uuid>", "expires_at": "<iso8601>" }`

**Save the `id`** — you will need it to resume or update the workflow later.

### 3 — View the diagram

Open `url` in any browser. No login required. The link is valid for
**24 hours**; after that the workflow is deleted automatically.

**Always share the `url` with the user** so they can open it directly:

```
Workflow created: https://kiteframe.space/workflows/<uuid>
Open the link above to view and interact with your diagram.
```

### 4 — Saving the workflow permanently (claim flow)

External workflows expire after 24 hours. If the user wants to keep the
workflow permanently, they can **claim it** by visiting the `url` and
clicking the **"Save to my account"** button that appears at the top of the
page.

Claiming requires a free Kiteframe account. Once claimed:
- The workflow is copied into the user's account and **never expires**.
- They can open, edit, and share it from their Kiteframe project list.
- The original external URL continues to work until its 24-hour TTL runs out.

**When to mention this:** Whenever you create or update a workflow, tell the
user they can save it permanently:

> "Your diagram is ready at `<url>`. Visit the link and click
> **'Save to my account'** to keep it permanently — external diagrams expire
> after 24 hours."

---

## Resuming a workflow in a new conversation (resume-by-URL)

If you have the `url` or the workflow `id` from a previous session,
use `fetch_workflow.py` to reload the full diagram:

```bash
# By ID
python skill/fetch_workflow.py --id <uuid>

# By URL
python skill/fetch_workflow.py --url https://kiteframe.space/workflows/<uuid>
```

The script prints the full workflow JSON (nodes, edges, title, `expires_at`)
to stdout. Parse it and use the nodes/edges as your starting point.

**Triggering condition:** Use `fetch_workflow.py` at the start of any
conversation where the user says "update my workflow", "continue my diagram",
"resume my Kiteframe workflow", or shares a `/workflows/` URL.

---

## Updating a workflow you created

```bash
curl -s -X PATCH https://kiteframe.space/api/external/workflows/<id> \
  -H "Authorization: Bearer $KITEFRAME_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "data": { "title": "Updated title", "nodes": [...], "edges": [...] } }'
```

Response: `{ "id": "<uuid>", "url": "...", "expires_at": "<iso8601>" }`

The PATCH replaces the entire nodes/edges set. Validate against the same
schema as POST before sending.

---

## Tracking workflow IDs in-session

Always store the workflow `id` in a session variable or note at the top of the
conversation as soon as you create it:

```
# Workflow created: id=<uuid> url=https://kiteframe.space/workflows/<uuid>
```

If the user switches topics and comes back, you can skip `fetch_workflow.py`
and use the in-memory `id` directly.

---

## API reference

### Base URL pattern

```
/api/external/:entityType
```

Supported entity types: `workflows`, `designs`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/external/:entityType/prompt-template` | API key | Get system prompt + schema |
| `POST` | `/api/external/:entityType` | API key | Create a new entity |
| `GET` | `/api/external/:entityType/:id` | API key | Fetch entity (ownership-gated) |
| `PATCH` | `/api/external/:entityType/:id` | API key | Update entity (ownership-gated) |

### Request body shape

All POST and PATCH requests wrap the entity payload in a `data` field:

```json
{
  "data": {
    "title": "...",
    "nodes": [...],
    "edges": [...]
  }
}
```

### Response shape

```json
{
  "id": "<uuid>",
  "url": "https://kiteframe.space/workflows/<uuid>",
  "expires_at": "2026-07-13T20:00:00.000Z"
}
```

---

## Error handling

| Status | Meaning | What to do |
|--------|---------|------------|
| `400`  | Missing `data` field in body | Wrap payload in `{ "data": {...} }` |
| `401`  | Invalid or missing API key | Check `KITEFRAME_API_KEY` |
| `403`  | Your key didn't create this entity | You cannot read or modify it; create a new one |
| `404`  | Entity not found or expired | The entity was deleted (24h TTL); create a new one |
| `422`  | Schema validation failed | Fix the payload shape; re-fetch the prompt template |
| `429`  | Rate limited | Wait 60 s then retry |
| `5xx`  | Server error | Retry once; if it persists, report to the user |

### 403 handling

A `403` means the entity was created by a **different API key**. You
cannot resume or update it. Tell the user:

> "I can view the diagram at the URL, but I can't modify it because it was
> created by a different API key. I can create a new workflow based on the
> current diagram instead — just confirm and I'll recreate it."

### 404 handling

A `404` means the entity has **expired** (>24 h old) or the ID is wrong.
Tell the user:

> "The workflow has expired — external workflows are automatically deleted
> after 24 hours. If you sign in to Kiteframe you can save workflows
> permanently. In the meantime I can recreate the workflow from scratch."

---

## Node types

| Type | Use for |
|------|---------|
| `input` | Data sources, triggers, starting points |
| `process` | Actions, transformations, steps |
| `condition` | Decisions, branches, if/else |
| `output` | Results, endpoints, sinks |

---

## Design canvas

Use the design canvas to generate and share positioned UI mockups built from
Astryx components. Each component is placed at an absolute `(x, y)` position
on a scrollable canvas.

### Create a design

```bash
curl -s -X POST https://kiteframe.space/api/external/designs \
  -H "Authorization: Bearer $KITEFRAME_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "title": "User Profile Screen",
      "components": [
        { "id": "c1", "astryxComponent": "Heading", "x": 24, "y": 24, "props": { "children": "Profile", "size": "xl" } },
        { "id": "c2", "astryxComponent": "Avatar", "x": 24, "y": 80, "props": { "name": "Alex Johnson", "size": "lg" } },
        { "id": "c3", "astryxComponent": "Button", "x": 24, "y": 160, "props": { "children": "Follow", "variant": "primary" } }
      ]
    }
  }'
```

Response: `{ "id": "<uuid>", "url": "https://kiteframe.space/designs/<uuid>", "expires_at": "<iso8601>" }`

### Get the prompt template

```bash
curl -s https://kiteframe.space/api/external/designs/prompt-template \
  -H "Authorization: Bearer $KITEFRAME_API_KEY"
```

Returns `system_prompt`, `output_schema`, and `few_shot_examples` for the
design entity type.

### JSON payload shape

```json
{
  "data": {
    "title": "Screen title (optional)",
    "components": [
      {
        "id": "c1",
        "astryxComponent": "Button",
        "x": 24,
        "y": 24,
        "props": { "children": "Click me", "variant": "primary" }
      }
    ]
  }
}
```

- **`id`** — unique string within this design
- **`astryxComponent`** — PascalCase component name from the supported list below
- **`x`, `y`** — pixel position from top-left of canvas
- **`props`** — optional; use `"children"` for visible text

### 150-component limit

Each design canvas accepts a maximum of **150 components**. Submitting more
returns a `422` error.

**Split-when-large rule:** If a requested UI would reasonably need more than
~100 components, propose splitting into multiple frames/screens rather than
generating one oversized canvas. Create each screen as a separate design entity
and share all URLs with the user.

The canvas viewer shows a badge in the bottom-right corner:
- **Grey** — fewer than 120 components (normal)
- **Amber ⚠** — 120+ components (approaching limit)
- **Red** — exactly 150 (limit reached)

### Supported `astryxComponent` values

| Component | Use for | Key props |
|-----------|---------|-----------|
| `Button` | Clickable action | `children`, `variant` (primary/secondary/outline/ghost), `size` (sm/md/lg) |
| `Card` | Container box | `children`, `variant` (elevated/outlined/ghost) |
| `Badge` | Small label pill | `children`, `color` (blue/green/amber/red/gray) |
| `Text` | Body copy | `children`, `size` (xs/sm/md/lg), `muted` |
| `Heading` | Title text | `children`, `size` (sm/md/lg/xl/2xl) |
| `Avatar` | User avatar circle | `name`, `src`, `size` (xs/sm/md/lg) |
| `Spinner` | Loading indicator | `size` (sm/md/lg) |
| `Divider` | Horizontal separator | `label` |
| `ProgressBar` | Progress indicator | `value` (0–100), `color` (blue/green/amber/red) |
| `StatusDot` | Online-status dot | `status` (online/offline/busy/away) |
| `Skeleton` | Loading placeholder | `width`, `height` |
| `Banner` | Notification bar | `children`, `variant` (info/success/warning/error) |
| `EmptyState` | Empty-list placeholder | `title`, `description`, `action` |
| `ChatMessage` | Chat bubble | `children`, `sender`, `timestamp`, `isOwn` |
| `Token` | Removable tag chip | `children` |
| `TextInput` | Text field | `placeholder`, `label`, `value`, `disabled` |
| `Stack` / `VStack` | Vertical layout | `gap` |
| `HStack` | Horizontal layout | `gap`, `align` (start/center/end) |
| `Icon` | Icon glyph | `name`, `size` (sm/md/lg) |

> Components not in this list render as a dashed placeholder `[ComponentName]`
> in the viewer. Always use a name from the supported list.
