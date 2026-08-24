---
name: A side pane that shares space with the canvas
description: Measure the canvas's own interval, not the viewport, and derive the rendered width during render rather than on resize events.
---

When a pane sits in the editor row and takes room from the canvas (reader,
inspector, any future docked panel):

- **Measure the shared interval, not the viewport.** The left sidebar and the
  right rail are flex siblings that own real width and are independently
  resizable/collapsible. Deriving "available room" from the pane slot's
  viewport-relative right edge counts the sidebar as canvas space, so the pane
  keeps compressing past the canvas minimum and, in overlay mode, hangs over the
  sidebar. Take the interval between the canvas element's left edge and the
  pane slot's right edge.
- **Clamp during render, not in a resize handler.** Keep the user's stored width
  in state untouched and compute an `effectiveWidth` while rendering. A pane
  that only re-clamps on `window.resize` stays too wide when the sidebar expands
  or the rail is dragged — neither of which fires a window resize.

**Why:** both bugs are invisible to a test run with the sidebar collapsed, which
is the default; they only show up in the layout users actually have.

**How to apply:** assert on measured rects (canvas width ≥ its minimum, pane
left ≥ canvas left) with the sidebar *expanded*, not just collapsed.
