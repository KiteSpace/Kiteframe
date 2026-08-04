---
name: craft.js pointer-events hit-testing
description: Never set pointer-events:none on craft.js-connected elements or their ancestors; fix hit-testing in canvas mouse handlers instead.
---

**Rule:** Never set `pointer-events: none` on any element that craft.js `connect()`s, or on any element between a craft node and its children.

**Why:** craft.js resolves selection and drop targets via `document.elementFromPoint` + DOM ancestor traversal. A pointer-events-disabled element in that chain silently breaks clicks, selection, and drag-drop for everything inside it. This regression happened twice: once on the InfiniteCanvas transform wrapper, once on the ROOT section's giant wrapper div (the "dead zone" fix).

**How to apply:** When empty-canvas clicks need to trigger panning/deselection instead of hitting a large invisible craft element, keep the element pointer-active and identify it in the canvas mousedown handler instead (e.g. a `data-canvas-root` attribute checked in the background-click detection).
