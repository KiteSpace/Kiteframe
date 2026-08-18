---
name: Workflow editor undo is off by one
description: Why the first Ctrl+Z in the workflow editor appears to do nothing, for every action — do not mistake it for a bug in the feature you just built.
---

The workflow editor's history stores only **"before"** snapshots: each action
calls `saveToHistory()`, which captures the state *prior* to the mutation and
pushes it, leaving `historyIndex` pointing at that newest entry. The live state
is therefore never itself in the history array.

Undo moves to `historyIndex - 1`, which is the state before the *previous*
action — identical to the live state. So **the first Ctrl+Z is always a no-op
and the second one skips a step back**, for every action in the editor, not
just the one you are working on.

**Why this matters:** when you add a feature and test "undo reverts my change in
one step", it will fail, and the obvious conclusion — "my feature isn't
recording history" — is wrong. Check whether `saveToHistory` is being called at
all before touching anything else; if it is, the failure is this pre-existing
defect.

**How to apply:**
- Do not assert single-press undo in a browser test for a new feature. Assert
  that the change *is undoable* (loop a bounded number of presses) instead.
- Fixing it properly means recording the post-action state as well, or shifting
  the index semantics — an app-wide change to core history behaviour that will
  alter the feel of undo for every existing action. Do not fold it into an
  unrelated feature task.
- Undo restores whole `canvasObjects` arrays, so stepping back far enough in a
  test will also revert unrelated things (auto-grown heights, list formatting)
  and quietly break later assertions. Bound the loop.
