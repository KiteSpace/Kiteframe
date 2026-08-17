---
name: Graphite theme tokens
description: Authoritative source of truth for the Kiteframe Graphite color system, shadow values, font stack, and editor-scoped kf tokens.
---

## The rule
All product color comes from `client/src/index.css` `:root` / `.dark`. `tailwind.config.ts` maps every custom property to a Tailwind color name. The `--kf-*` tokens are editor-only and scoped to the canvas layer.

## Five original bugs (now fixed)
1. `--sidebar-background` was missing → `bg-sidebar` was transparent. Fixed: alias both `--sidebar` and `--sidebar-background`.
2. Shadows had alpha 0 (`rgba(0,0,0,0)`) → invisible everywhere. Fixed: real values in all light and dark stops.
3. Dark `--secondary` was `hsl(240 4% 91%)` → near-white on near-white. Fixed: `hsl(240,6%,16%)`.
4. `--primary` and `--ring` were both the same blue → focus ring was invisible. Fixed: `--primary` = ink (#131316 / near-white), `--ring` = Violet Flash (#9B6BFF).
5. `--font-mono` lacked `ui-monospace` and `SF Mono`. Fixed: `ui-monospace, "SF Mono", Menlo, monospace`.

## Semantic intent
- `--primary` is action **ink** (dark in light mode, near-white in dark mode), NOT the brand color.
- `--brand` is Violet Flash (`hsl(262,100%,71%)`) — identity color, never shifts.
- `--ring` is Violet Flash — always the same as `--brand` for consistent focus rings.
- `--accent` is the hover/selected surface, NOT brand.

## Canvas tokens (--kf-*)
- `--kf-canvas` / `--kf-canvas-dot` — the design canvas background and dot grid. Light in BOTH modes.
- `--kf-canvas-preview` — preview mode backdrop (`#EFEFEC` equivalent).
- `--kf-artboard` — always `hsl(0,0%,100%)` — user content, NEVER inverted in dark mode.
- `--kf-tile` / `--kf-tile-fill` / `--kf-tile-stroke` — palette glyph tile geometry.
- `--kf-cat-*` — category dot/marker colors shared by palette headers and layer tree icons.

**Why:** The canvas stays light in dark mode because artboards contain user-authored content (white backgrounds, designed colors). Inverting them would corrupt every design made in light mode.

## Tailwind additions
`brand`, `info`, `success`, `warning` as top-level color groups with `.DEFAULT`, `.soft`, `.foreground`, `.strong` variants. `kf.canvas`, `kf.preview`, `kf.artboard`, `kf.tile` as editor-scoped Tailwind names.
