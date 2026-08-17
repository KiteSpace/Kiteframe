---
name: Preview mode must override ROOT rendering too
description: A clean preview branch on leaf/artboard components is not enough — design-canvas sizing on ROOT leaks into preview and pushes content off-screen.
---

**Rule:** When adding a "clean render" mode (preview, export, thumbnail) to the design components, every component in the render path needs the mode branch — especially ROOT/section, whose design-mode style forces a huge fixed canvas (min 3000×2000). A preview branch only on the artboard leaves the giant ROOT box in place; a centered flex parent then centers the 3000px box, and the artboard lands at negative x, fully off-screen.

**Why:** Hit this building the Preview surface: DOM-text assertions passed (content existed) while the screen was visually blank because the artboard rendered at x≈-860. Only a bounding-rect/screenshot check caught it.

**How to apply:**
- Gate the ROOT section renderer on the preview context and render a plain content-sized wrapper there.
- When browser-testing "does it render", assert on `getBoundingClientRect()` being inside the viewport, not just on `textContent`.
