---
name: Theme CSS variables already include hsl()
description: Why `hsl(var(--primary))` silently removes a border/colour in this project, and what to write instead.
---

The theme variables in `client/src/index.css` are declared with the colour
function already applied — e.g. `--primary: hsl(221.2, 83.2%, 53.3%)`, not the
shadcn-style bare triple `221.2 83.2% 53.3%`.

**Rule:** reference them as `var(--primary)`. Never write `hsl(var(--primary))`
or `hsl(var(--x) / 0.4)` in inline styles or CSS.

**Why:** `hsl(hsl(...))` is invalid, so the *entire declaration* is discarded at
computed-value time. There is no console warning and no visible error — the
property just falls back to its initial value. A `border: 2px solid
hsl(var(--primary))` computes to `border-style: none; border-width: 0`, i.e. the
element silently has no border at all. This shipped unnoticed on the canvas text
field for a long time because "no border" reads as a styling choice, not a bug.

**How to apply:**
- Inline styles and CSS: `var(--primary)`.
- Need transparency? `color-mix(in srgb, var(--primary) 30%, transparent)`.
  Tailwind's `hsl(var(--x) / <alpha>)` opacity syntax does not work here either.
- Tailwind utility classes (`bg-primary`, `border-border`) are fine — the config
  maps them correctly.
- When a border/ring/shadow "does not appear", read `getComputedStyle(el)
  .borderTopStyle` before assuming a layout or z-index problem: `none` on an
  element you gave a border to is this bug.
