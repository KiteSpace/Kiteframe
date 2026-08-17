---
name: Palette grid virtualization via content-visibility
description: Why the component palette uses CSS content-visibility instead of react-window for large grids.
---

The Builder Shell palette virtualizes large grids (>60 cells) with `content-visibility: auto` + `contain-intrinsic-size` on each tile, not a windowing library.

**Why:** windowing (react-window) removes offscreen tiles from the DOM, which breaks sticky category headers, flat keyboard-nav indexing (`data-nav-idx`), craft.js drag connectors, and `data-component-id` test selectors. `content-visibility` keeps every tile in the DOM (all wiring intact) while letting the browser skip render work for offscreen thumbnails.

**How to apply:** for any future large scrolling list in the editor that carries craft.js connectors or flat-index keyboard navigation, prefer `content-visibility: auto` with a fixed `contain-intrinsic-size` matching the row height over DOM-removal windowing. Threshold + gate live next to the palette tile component (`shouldVirtualizePreviews`).

Also: palette thumbnails resolve registry `preview` (ReactNode > 'auto' > glyph); `resolvePreviewNode` is exported for tests, and the e2e builder-shell script asserts no blank tiles and `pointer-events: none` stages.
