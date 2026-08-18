---
name: Bottom toolbar dock geometry
description: How the canvas toolbar dock is structured to avoid eating canvas pointer events while still being interactive itself.
---

## The rule
The dock wrapper (`absolute left-0 right-0 bottom:20px`) must have `pointer-events:none`. Only the toolbar pill re-enables it (`pointer-events:auto`). Without this, the full-width overlay eats every click in the bottom band of the canvas.

## Why this matters twice
1. Canvas drag-to-pan would stop working in the bottom 80px.
2. Craft.js hit-testing (which uses pointer events) would silently fail for artboards near the bottom edge.

## Geometry (from `canvas-toolbar-bottom_1787006476202.html`)
- Pill height: **44px**
- Bottom inset: **20px** (not 16px — a bar docked at the window edge reads cramped at 16)
- Shadow: **upward** (`0 -6px 20px rgba(20,20,24,.12)`) — light comes from above
- Zoom/screen menus: open **upward** (`bottom: calc(100% + 8px)`) or they render off-canvas
- Every direct child needs `flex: none; white-space: nowrap` — without this, labels wrap inside their pills on narrow canvases (the #1 breakage mode)

## Mode switching
The same pill is shown in both Design and Preview modes. Design-only controls (`+ Artboard`, `Import`, undo, redo, zoom cluster) are conditionally rendered with `{!isPreview && ...}`. No re-mount on mode switch.
