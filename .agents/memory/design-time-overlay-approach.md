---
name: Design-time overlays in the Astryx palette
description: Why palette overlays (popover/tooltip/menu/dialog/toast/lightbox) render inline as flex siblings on a bounded stage instead of portalling, and what that forces on every future overlay.
---

A palette overlay is a **picture of** an overlay, not an overlay. The user is drawing an
interface, so the thing must be visible, selectable, movable and stylable like any other node.
That inverts every instinct from real component libraries.

## The rules

1. **Never portal, never `position: fixed`.** The canvas pan/zoom transform makes a transformed
   ancestor the containing block for fixed descendants, so a fixed panel is positioned against
   the canvas layer: it escapes its artboard and eats clicks. Note the opposite rule applies to
   *editor chrome* (floating toolbars must portal to `<body>`) — see
   `fixed-overlay-inside-transformed-canvas.md`. Inside the artboard, inline; outside it, portal.
2. **Every overlay owns its own bounds.**
   - *Anchored* (popover, tooltip, hovercard, all menus): anchor and panel are **flex siblings**.
     `placement` picks the flex direction, `align` the cross axis. The panel is inside the
     component's own box by construction, so it cannot leave the artboard however it is placed.
   - *Scrim-based* (dialog, toast, lightbox): a bounded **stage** — `position: relative` +
     explicit min-height + `overflow: hidden` — so the absolutely positioned scrim and surface
     resolve against the stage.
   - *Container overlay*: children in normal flow, so the box grows with them.
3. **Bounds discipline covers both halves.** Panels shrink (`minWidth: 0`, `maxWidth: 100%`) and
   wrap (`overflowWrap: anywhere`) — and so must the **anchor**, which also carries user text. An
   anchor pinned at `flexShrink: 0` pushes a long unbroken label straight out of the artboard;
   the side placements are the worst case, because anchor and panel share a row.

**Why:** all three exist to make one guarantee testable — an overlay is always drawn inside the
artboard it belongs to, at any zoom, with any content.

**How to apply:** adding another overlay means reusing the shared anchored/stage helpers rather
than writing new positioning. `open` is an inspector prop meaning "draw the open state", not
"mounted on trigger"; there is deliberately no trigger, dismiss, focus-trap or timer behaviour,
and nothing may set `pointer-events: none` (it breaks craft.js hit-testing).

## Testing it

Source-level guards (no `createPortal`, no `fixed`, no `pointer-events: none`) are cheap but
prove nothing about layout — jsdom has no geometry. The real proof is a browser run that measures
each overlay's rect against the artboard rect **and repeats it after zooming and panning**: at
100% zoom a fixed panel can look perfectly placed and still be wrong. Include a long unbroken
string and the left/right placements; that combination is what actually breaks bounds.
