---
name: craft.js Frame data is read once
description: Why changing the craftState prop does not update a rendered canvas, and what to do instead for live/read-only views.
---

`<Frame data={...}>` consumes its data **only when it mounts**. Passing a new
state into an already-mounted editor changes nothing on screen, and craft.js
reports no error — the canvas simply keeps rendering what it first received.

**Why:** a read-only viewer of a shared design was fed fresh state from a live
channel and kept showing the original content. Everything looked correct: the
payload arrived, the prop changed, React re-rendered, and the canvas ignored it.

**How to apply:** to apply external state to a live editor, call
`actions.deserialize(...)` from a small component inside the `<Editor>` context
rather than re-keying or remounting. Deserializing swaps the node tree without
tearing down the container, which is also what preserves the viewer's scroll and
pan/zoom. Seed the "last applied" marker with the mount value so the first paint
does not deserialize what `<Frame>` just rendered.

Guard it to read-only sessions. Running the same sync in an editable session
lets a stale prop overwrite the user's in-progress edits. Route both the initial
mount and the live path through one normalize helper, so a live update cannot
skip validation or repair that the first load performs.
