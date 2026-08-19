---
name: Drag-handle gestures in the editor
description: Why a resize/drag handle must preventDefault on mousedown and listen on document in the capture phase, or the gesture silently dies part-way.
---

A mouse-driven drag handle (pane resizer, splitter, custom slider) needs **both**
of these or it will work once and then behave erratically:

1. `e.preventDefault()` in the handle's `onMouseDown`.
2. `document.addEventListener('mousemove' | 'mouseup', fn, true)` — capture phase.

**Why:**

- Without `preventDefault`, the press starts a text selection. The first drag
  therefore leaves a selection behind it; on the *next* drag, if the press lands
  inside that selection, the browser starts a **native text drag** instead. A
  native drag stops dispatching `mousemove` *and* `mouseup` entirely (only
  `dragover`/`dragend` fire), so the pane freezes a few pixels from where it
  started and the resize state is never cleaned up. The failure looks like
  "sometimes the drag only moves ~20px", which reads as a maths bug and is not.
- Without capture, the drag dies whenever the pointer crosses a region whose
  React handlers call `stopPropagation()` — the canvas does. React attaches its
  listeners at the app root, so stopping propagation there means a bubbling
  `document` listener never sees the move.

Also set `document.body.style.userSelect = 'none'` for the duration and restore
it in the effect cleanup, so the gesture does not paint a selection behind it.

**How to apply:** any new drag affordance in the editor, and the first thing to
check when a drag "stalls part-way" or "only works the first time". Diagnose it
by logging `mousemove` from a capture listener during the gesture: two events
and no `mouseup` is the native-drag signature.
