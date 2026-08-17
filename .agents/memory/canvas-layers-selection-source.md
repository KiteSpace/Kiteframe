---
name: Canvas-vs-layers selection source
description: How the left rail decides whether to show the inspector or the palette when a Craft node is selected.
---

## The rule
The inspector replaces the palette **only when a node is selected on the canvas**. A click in the Layers panel navigates to the node but must not take over the left rail.

## Why
The layers panel is on the far right and the palette is on the far left. A 1,400px cause-and-effect is surprising. More importantly, mid-drag palette state should not be destroyed just because the user browsed the layer tree.

## Implementation (as of this refactor)
- Module-level ref: `const _selectionSource = { current: "canvas" as "canvas" | "layers" }`.
- `markSelectionFromLayers()` (exported from `DesignEditor.tsx`) sets it to `"layers"`.
- `LayersView.selectNode()` calls `markSelectionFromLayers()` **before** `actions.selectNode()`.
- `LeftRail` useEffect on `selected?.id`: reads `_selectionSource.current`, sets `selectionSourceCanvas` state, then resets the ref back to `"canvas"` for the next event.
- `showInspect = !!selected && selectionSourceCanvas && !forceComponents`.

## Three ways back to palette
1. `‹ Components` button in the inspect header.
2. `×` button in the InspectPanel (deselects via `actions.selectNode(undefined)`).
3. `Escape` key (existing keyboard handler).

## Pitfall
The ref must be reset to `"canvas"` immediately after reading it, not on deselect, or consecutive canvas clicks after a layers click would incorrectly stay on palette.
