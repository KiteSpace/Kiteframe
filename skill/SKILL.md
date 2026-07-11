# Kiteframe External Workflow Skill

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
  -d '{ "title": "My workflow", "nodes": [...], "edges": [...] }'
```

Response: `{ "id": "<uuid>", "diagram_url": "https://kiteframe.space/workflows/<uuid>" }`

**Save the `id`** — you will need it to resume or update the workflow later.

### 3 — View the diagram

Open `diagram_url` in any browser. No login required. The link is valid for
**24 hours**; after that the workflow is deleted automatically.

---

## Resuming a workflow in a new conversation (resume-by-URL)

If you have the `diagram_url` or the workflow `id` from a previous session,
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
  -d '{ "title": "Updated title", "nodes": [...], "edges": [...] }'
```

Response: `{ "id": "<uuid>", "diagram_url": "...", "expires_at": "<iso8601>" }`

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

## Error handling

| Status | Meaning | What to do |
|--------|---------|------------|
| `401`  | Invalid or missing API key | Check `KITEFRAME_API_KEY` |
| `403`  | Your key didn't create this workflow | You cannot read or modify it; create a new workflow instead |
| `404`  | Workflow not found or expired | The workflow was deleted (24h TTL); create a new one |
| `422`  | Schema validation failed | Fix the nodes/edges shape; re-fetch the prompt template |
| `429`  | Rate limited | Wait 60 s then retry |
| `5xx`  | Server error | Retry once; if it persists, report to the user |

### 403 handling

A `403` means the workflow was created by a **different API key**. This can
happen when a user shares a URL from a session that used a different key. You
cannot resume or update that workflow. Tell the user:

> "I can view the diagram at the URL, but I can't modify it because it was
> created by a different API key. I can create a new workflow based on the
> current diagram instead — just confirm and I'll recreate it."

### 404 handling

A `404` means the workflow has **expired** (>24 h old) or the ID is wrong.
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
