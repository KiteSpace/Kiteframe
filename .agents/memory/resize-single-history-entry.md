---
name: Resize single history entry
description: How to make a drag gesture (resize/move) produce exactly one craft.js undo step instead of one per mousemove.
---

# Resize / drag → one undo step

Live drag gestures fire many mousemove events. If each calls a plain
`setProp`, every pixel-step becomes its own undo entry, so undoing a resize
takes dozens of Ctrl+Z presses.

## The pattern
- During `mousemove`: update the canvas with `history.ignore().setProp(...)` —
  live visual feedback with **no** history entry.
- On `mouseup`: if the gesture actually changed geometry, commit the final
  values **once** with a plain (non-ignored) `setProp` → exactly one undo step.
- No-op gestures (mousedown+mouseup, or drag back to origin) commit nothing.

## Critical gotcha — empty-patch skip
`@craftjs/utils` `History.add()` **silently drops empty patch sets**. After
the last ignored move the props already hold the final values, so a plain
`setProp` to those same values produces empty immer patches and records **no**
history entry — undo would then do nothing.
**Fix:** on mouseup, first `history.ignore().setProp(...)` back to the START
values, then a plain `setProp(...)` to the FINAL values. Both run
synchronously in the same handler, so nothing flickers on screen, and the
commit now has real patches.

## Node-scoped vs editor-scoped actions
`useNode().actions.setProp` does **not** expose `history.ignore()`. Only the
editor-scoped `useEditor().actions.history.ignore().setProp(nodeId, cb)` does.
Any resize handler living in a `useNode` hook must also pull `useEditor`
actions (kept in a ref for native event handlers) to get the ignore path.

**Why:** verified with `new History()` in node — `add([],[])` leaves
`canUndo()` false; only non-empty patches count.

**How to apply:** applies to every drag-style gesture that mutates props on
mousemove (component resize, artboard resize, drag-to-move). The design editor
tracks undo availability by a serialized-node fingerprint, so one committed
`setProp` = one fingerprint bump = one undo step.
