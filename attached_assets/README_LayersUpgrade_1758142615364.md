
# Layers Panel Upgrade Package

This bundle adds:
- Multi-view Layers Panel (Structure / Topology / Spatial / Links)
- Global tri-state visibility/lock with inheritance
- Canvas guards (hide + lock)
- Floating "Layers" widget (ListTree icon) that toggles a floating pane

## Install
1) `npm i react-window`
2) Copy the files from `src/components/layers/` into your project at the same path.
3) Apply the patch in `layers_patch.txt` (or manually edit the two files).

## Files included
[
  "src/components/layers/visibilityLockStore.ts",
  "src/components/layers/triStateUtils.ts",
  "src/components/layers/ancestorsStore.ts",
  "src/components/layers/graphAlgorithms.ts",
  "src/components/layers/graphWorker.ts",
  "src/components/layers/linkGroups.ts",
  "src/components/layers/multiViewBuilder.ts",
  "src/components/layers/LayerModeTabs.tsx",
  "src/components/layers/VirtualTree.tsx",
  "src/components/layers/TreeRow.tsx",
  "src/components/layers/LayersPanel.tsx",
  "src/components/layers/FloatingLayersWidget.tsx",
  "src/components/layers/index.ts"
]

## Notes
- Worker import path uses Vite-style module workers. If your bundler differs, adjust `new URL('./graphWorker.ts', import.meta.url)` accordingly.
- Replace `YourCanvasLibrary` with your actual canvas component (we only change props).

## QA
- Toggle workflow visibility: nodes vanish across tabs and on canvas.
- Lock node: dragging/connecting is blocked.
- Links tab groups cross-workflow edges as "Between A↔B".
