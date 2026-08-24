---
name: Partial writes to a shared JSONB blob
description: Why a per-key update of savedProjects.workflowData needs a DB row lock, and why debounced client saves need per-document ordering.
---

When one column holds a whole aggregate (here `saved_projects.workflow_data`:
canvas + notes + details + every PRD) and more than one endpoint writes it,
**any endpoint that updates a single key must read-modify-write under a database
row lock** (`SELECT … FOR UPDATE` inside a transaction).

**Why:** the other writer is a *wholesale* overwrite (the full-project PUT sends
the entire blob). Unlocked, the sequence is: partial-writer reads the blob →
wholesale-writer commits a new canvas → partial-writer writes back the blob it
read, reverting the canvas. The user loses canvas edits and nothing errors. An
in-process promise chain looks like it fixes this in testing but does not: it
serialises only same-process requests of the *same* route, so it protects
neither the other endpoint nor a second server instance. It also gives a false
green on concurrency tests.

**How to apply:** put the read, the ownership check and the write in one
transaction (`storage.mutateProjectWorkflowData` is the shape). Test it by
racing the partial write against the wholesale write repeatedly and asserting
the wholesale writer's value is never *older* than a previously observed one —
either commit order is legal, resurrection is not.

## Client side: debounced saves need ordering, not just coalescing

Two ways a save is silently undone once writes are debounced:

1. A queued edit runs *after* a newer immediate save (generate / restore /
   import). An immediate save must **cancel** the queued one for that document.
2. Two in-flight saves land out of order (slow request, then fast one).
   Chain saves per document so they apply in submission order.

**Why:** the loser is not just "an old write" — the server stamps whatever
arrives last, so the stale copy ends up with the newest `updatedAt` and then
wins every subsequent last-write-wins hydration. The bad text becomes sticky
rather than transient.

**How to apply:** one promise chain per document id, plus cancel-pending on
immediate saves. When clearing the chain map, compare against the promise you
actually stored (the derived `.catch().finally()` one, not the original), or
entries never clear and the map leaks.

## Hydration

Distinguish "server has no such document" from "server unreachable". Collapsing
them blanks a cached document on a network blip. Compare content ignoring the
save stamp before writing anything back, or every hydrate looks like an edit and
retriggers the project's auto-save.
