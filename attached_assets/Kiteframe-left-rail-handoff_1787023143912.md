# Kiteframe — left rail handoff (single file)

Everything needed to build the **left rail**: the component palette and the
properties panel that replaces it on canvas selection, plus the canvas toolbar.

Generated 2026-08-18. Self-contained — no other file is required.

## How to use this document

1. Read **Part 1** (index + precedence) first. It says which document wins when two
   disagree.
2. **Part 2–4** are the specs. Numbers in them are requirements, not suggestions.
3. **Part 5–7** are working reference implementations. Copy each code block into a
   `.html` file and open it in a browser — they run standalone with no build step.
   Read geometry and behavior out of them.
4. **Part 8** is the color system for the whole app, both modes.

**Precedence:** Part 8 (`THEME.md`) is authoritative for **color**. The reference
HTML in Parts 5–7 is authoritative for **geometry, structure and behavior**.

**One number to hold onto:** the palette and the properties panel are both
**370px** and share the left column. If they ever differ, the canvas reflows on
every selection.

---

## Contents

| Part | What | Source file |
|---|---|---|
| 1 | Index, precedence, build order, common traps | `HANDOFF.md` |
| 2 | Properties panel spec — **prescriptive** | `README-properties-panel.md` |
| 3 | Component palette + canvas toolbar spec | `README.md` |
| 4 | Reference code — properties panel (3a / 3b / multi) | `properties-panel.html` |
| 5 | Reference code — component palette | `builder-panel-1b.html` |
| 6 | Reference code — canvas toolbar (bottom dock) | `canvas-toolbar-bottom.html` |
| 7 | Theme — Graphite light + dark | `THEME.md` |

---

# Part 1 — Index and precedence

<!-- source: HANDOFF.md -->

# Handoff — what to give Replit

Six files. Three are specs, three are working reference code (plus this index).
Both rails are **370px** — the palette and the properties panel share the left
column and must never differ.
Nothing else in the project is part of the handoff.

---

## The set

| # | File | Type | Covers |
|---|---|---|---|
| 1 | `THEME.md` | spec | Color, both modes. The only file that owns color. |
| 2 | `README.md` | spec | Left rail (component palette) + canvas toolbar + Design/Preview modes |
| 3 | `builder-panel-1b.html` | reference code | The palette, working standalone |
| 4 | `canvas-toolbar-bottom.html` | reference code | The bottom-docked toolbar, working standalone |
| 5 | `README-properties-panel.md` | spec | Properties panel — prescriptive: measurements, state matrix, verification |
| 6 | `properties-panel.html` | reference code | The properties panel, single pane, all 3 states, working standalone |

The three HTML files open directly in a browser and are interactive. They are
**references, not files to embed** — read values and behavior out of them.

---

## Precedence — settle this before any code is written

> **`THEME.md` is authoritative for color.
> The `.html` files are authoritative for geometry, structure and behavior.**

Each HTML file's header comment maps its local tokens (`--bp-*`, `--kf-*`,
`--ip-*`) to the variables in `THEME.md`, so the port is a rename rather than a
judgement call. The files ship light values only; dark comes from `THEME.md` §3.

---

## Order of work

Independently shippable, each reviewable on its own.

1. **`THEME.md` §6 — five bugs.** Dead `bg-sidebar`, alpha-0 shadows, near-white
   `.dark --secondary`, `--ring` === `--primary`, missing `ui-monospace`. No
   redesign, all upside. The shadow fix alone changes how today's UI reads.
2. **`THEME.md` §2–3 — land the token values.** One commit, whole app.
   Screenshot-diff dialogs, dropdowns and toasts; they consume `--popover`,
   `--accent` and `--shadow-lg` and will all shift.
3. **`THEME.md` §4 — add the `--kf-*` layer, repoint canvas + artboard.** This is
   what stops dark mode from inverting the user's own content.
4. **`THEME.md` §7 — Tailwind color entries, then the class-replacement table.**
   Doing this before step 2 means writing arbitrary values twice.
5. **`README-properties-panel.md` §1 — the left-rail swap.** Structural: one
   `LeftRail` renders Palette or Properties from `selection.source === "canvas"`,
   370px either way. Everything else is content inside it.
6. **Properties panel** — `README-properties-panel.md` §5–§8 for the sections and
   state matrix, §11 for the assertions to run, §12 for the eight known traps.
   `README-inspect-panel.md` §15 still has the step list mapped to your file and
   line numbers.
7. **Palette refactor** — `README.md` §3, using `builder-panel-1b.html`.
8. **Toolbar** — `canvas-toolbar-bottom.html`; `README.md` §3.7 for behavior.

Steps 1–4 are the theming pass and can go before or after 5–8, but not
interleaved with them.

---

## The five things most likely to get ported wrong

Each of these has already bitten this build, so they're worth stating up front.

1. **`--accent` in shadcn means "hover surface", not brand.** Violet Flash lives in
   new `--brand*` variables. Renaming `--accent` breaks every shadcn primitive.
   (`THEME.md` §1)
2. **In dark mode the canvas stays light and artboards are never themed.**
   Artboards are content — they render what the user ships. Anything inside an
   artboard uses literal colors, not theme tokens. (`THEME.md` §4)
3. **A `hidden` prop on a flex row is a no-op.** `display: flex` outranks the UA
   `[hidden]` rule. Every conditional row needs
   `[hidden] { display: none !important }` at the panel root.
4. **Flex rows of inputs need `flex: 1 1 0; min-width: 0` on the field wrapper**,
   not just the input — otherwise the input's intrinsic width floors the field and
   the second control of a pair lands off-panel.
5. **The toolbar dock must be `pointer-events: none`** with only the pill set to
   `auto`, or the full-width dock eats every canvas click in that band. Same file:
   every direct toolbar child needs `flex: none; white-space: nowrap`, or labels
   wrap inside their own pills.

---

## What is NOT in the handoff

### Alternates — hand over only if asked

`inspect-panel-3ab.html` + `README-inspect-panel.md` are the **tabbed** variant of
the properties panel, plus the refactor plan mapped to your existing file and line
numbers (§15) and the multi-select/type contracts (§12–13). The single-pane version
is the chosen design; give Replit the tabbed files only if you switch back.

`Right Rail Audit.dc.html`, `Kiteframe Themes.dc.html` and
`Builder Panel Redesign.dc.html` are the design explorations — the audit, the
theme candidates, and the option sets we chose from. Useful context for *why*, not
inputs to implementation. Don't hand them over as specs.

Still open, not yet specified for build:

- The right rail redesign (option `2b`: KiteAI · Project · Layers · Review) and its
  tab-level options `3a` / `3c` / `3e`
- The artifact-card + reader-panel work (`4a` / `4b`), including autosave and
  version snapshots
- The two decisions in `THEME.md` §11: the marketing gradient's fate, and Preview
  mode's backdrop

---

# Part 2 — Properties panel spec

<!-- source: README-properties-panel.md -->

# Properties panel — implementation spec

**Canonical file:** `properties-panel.html` — open it in a browser. It renders all
three states. **Match it pixel for pixel.**
**Alternate:** `inspect-panel-3ab.html` (tabbed variant) — not the target unless
explicitly chosen.

This document is prescriptive. Where it gives a number, use that number. Where it
says *must not*, that thing is a defect, not a preference. Anything not specified
here, read off `properties-panel.html` — it is the source of truth for geometry.

---

## 1. Placement and dimensions

The properties panel **replaces the component palette in the left rail** when a node
is selected **on the canvas**.

```
nothing selected   [ Components 370px ][ canvas ][ KiteAI/Layers rail ]
canvas selection   [ Properties 370px ][ canvas ][ KiteAI/Layers rail ]
```

| Property | Value | Notes |
|---|---|---|
| Width | **370px** | Fixed. The palette must also be 370px. |
| Border | `border-right: 1px solid #E4E4E8` | Right side only. `border-left: 0`. |
| Background | `#FBFBFC` | Not `#FFFFFF` — fields and cards are white *on* this. |
| Flex | `flex: none` | Must not grow or shrink. |
| Height | `min-height: 0` + column flex | Required or the body won't scroll. |

**Must not:** be on the right side; be a second panel alongside the palette; change
width between states; animate the swap.

### Trigger

```ts
type Selection = { nodes: SelectedNode[]; source: 'canvas' | 'layers' };
const showProperties = selection.nodes.length > 0 && selection.source === 'canvas';
```

A click in the **Layers** panel does **not** open this panel. Layers highlights the
row and reveals the node on canvas; the left rail keeps showing Components.
Escalation to a canvas selection: double-click a layer row, `Enter` on a focused
row, or a canvas click.

**No empty state.** Zero selection = the palette owns the rail. Do not build
"Select a layer to inspect it".

**Return to palette:** the `✕` on the breadcrumb line, or `Escape`. Both preserve
the palette's scroll position, filter chip and view mode — keep both trees mounted
and toggle visibility; **must not** unmount.

---

## 2. Tokens

Declare these once. **Do not inline hexes anywhere else in the panel.** Values are
Graphite · Light; `THEME.md` §3 has the dark set, and `THEME.md` §10 maps these
local names onto the app's shadcn variables.

```css
--ip-chrome: #FBFBFC;   --ip-raised: #FFFFFF;   --ip-subtle: #F3F3F5;
--ip-hover:  #F3F3F5;   --ip-track:  #EEEEF1;

--ip-line: #E4E4E8;   --ip-line-soft: #EEEEF1;   --ip-line-strong: #D6D6DC;

--ip-fg: #1E1E21;   --ip-fg-muted: #54545C;   --ip-fg-subtle: #77777F;
--ip-fg-faint: #9A9AA3;   --ip-fg-disabled: #C4C4CC;

--ip-ink: #131316;        --ip-ink-fg: #FFFFFF;
--ip-accent: #9B6BFF;     --ip-accent-soft: #F2EFFA;   --ip-accent-fg: #6D3FD6;
--ip-info: #189FDB;
--ip-warn-bg: #FFF1D0;    --ip-warn-fg: #8A5A00;

--ip-gutter: 56px;   --ip-h: 32px;   --ip-r-sm: 6px;   --ip-r: 8px;
--ip-sans: "Helvetica Neue", Helvetica, Arial, sans-serif;   /* Inter in prod */
--ip-mono: ui-monospace, "SF Mono", Menlo, monospace;
```

Three rules about color, all enforceable in review:

1. **Ink fills active pills and primary buttons.** `#131316`, never the accent.
2. **Accent marks selection and focus only.** `#9B6BFF` for focus rings, the `A`
   chip's pressed state, and selected-layer tint. It **must not** fill a button.
3. **Kite blue `#189FDB` is for links** — breadcrumb hover, "Unlock to edit".

---

## 3. Header — exactly two lines

```
Editor View / Chat / ChatMessage                    ✕     ← line 1
ChatMessage                                 [element]     ← line 2
```

| Element | Spec |
|---|---|
| Container | `padding: 12px 14px 0`, `border-bottom: 1px solid --ip-line`, `flex: none` |
| Line 1 wrapper | `display: flex; align-items: center; justify-content: space-between; gap: 10px` |
| Breadcrumb | `flex: 1; min-width: 0; display: flex; align-items: center; justify-content: flex-start; gap: 5px; overflow: hidden` · `font: 400 11px/1.3 --ip-sans` · `--ip-fg-faint` |
| Crumb button | `max-width: 96px`, ellipsis, nowrap. Hover `--ip-info`. |
| **Leaf crumb** | `:last-child { max-width: none; min-width: 0 }` — **never truncated** |
| Separator | `/` in `#D0D0D6` |
| Close `✕` | `24×24`, `radius --ip-r-sm`, `--ip-fg-faint`; hover `bg --ip-hover`, `--ip-fg-muted` |
| Line 2 wrapper | `display: flex; align-items: center; gap: 8px; padding: 5px 0 10px` |
| Node name | `font: 600 16px/1.2`, `--ip-fg`, `flex: 1; min-width: 0`, ellipsis |
| Kind chip | `font: 500 9.5px/1`, `radius 999px`, `padding: 4px 7px` |

**Breadcrumb order is root-first** (`Editor View / Chat / ChatMessage`). The DOM
order and the render path must agree.

**Must not:** use `direction: rtl` to truncate — it right-packs the whole run
whenever the row has slack. Truncate the ancestors instead.

### Kind chip colors

| Kind | Text | Background |
|---|---|---|
| `element` | `#6D5AA8` | `#F2EFFA` |
| `frame` | `#2B7A6B` | `#E9F5F2` |
| `text` | `#A06520` | `#FDF2E6` |
| `mixed` | `--ip-fg-muted` | `--ip-track` |
| `locked` | `--ip-warn-fg` | `--ip-warn-bg` |

---

## 4. Section index

A sticky chip row under the header. This is what makes a single pane navigable —
**it is not optional.**

| Element | Spec |
|---|---|
| Container | `display: flex; flex-wrap: wrap; gap: 4px; padding: 9px 14px`, `border-bottom: 1px solid --ip-line`, `flex: none` |
| Chip | `padding: 4px 9px`, `radius 999px`, `border: 1px solid --ip-line-soft`, `font: 500 11px/1`, `--ip-fg-faint`, nowrap |
| Chip hover | `bg --ip-hover`, `--ip-fg-muted` |
| Chip current | `bg --ip-track`, `border-color --ip-line-strong`, `--ip-fg`, `font-weight: 600`, `aria-current="true"` |

Behavior: click scrolls the body to that section **and expands it if collapsed**.
The current chip follows manual scrolling (compare each section's `offsetTop`
against `scrollTop + 24`).

---

## 5. Sections — one pane, no tabs

Order is fixed: **Layout · Stack · Spacing · Style · Content**.

| Element | Spec |
|---|---|
| Section | `border-bottom: 1px solid --ip-line`, `scroll-margin-top: 8px` |
| Header button | full width, `display: flex; align-items: center; gap: 9px; padding: 11px 14px`, hover `bg --ip-hover` |
| Caret | `width: 10px`, `font-size: 10px`, `--ip-fg-faint`; `⌄` open / `›` collapsed |
| Section name | `font: 700 10.5px/1`, `letter-spacing: .11em`, uppercase, `--ip-fg-muted` |
| Summary | `flex: 1; text-align: right`, `font: 500 10.5px/1 --ip-mono`, `--ip-fg-faint`, ellipsis. `visibility: hidden` while open |
| Body | `padding: 2px 14px 14px; display: flex; flex-direction: column; gap: 10px` |
| Subgroup | `padding-top: 10px; margin-top: 2px; border-top: 1px solid --ip-line-soft` |

### Collapse memory — per node kind

```ts
// localStorage key: kiteframe.inspect.collapse
// { element: { style: true }, frame: {}, ... }
```

Collapse Style on a component once and every component selected next opens the same
way; the artboard keeps its own state. **This is load-bearing** — without it the
single pane is just a long scroll, which is the problem it was built to solve.

### Collapsed summaries — required

| Section | Format | Example |
|---|---|---|
| Layout | `{w} × {h}` | `1920 × auto` |
| Stack | `{direction} · {align}` | `Column · Center` |
| Spacing | `{gap} / {pad}` | `8 / 12` |
| Style | `{fill} · {radius} · {shadow}` | `#189FDB · M · Soft` |
| Content | `{primary prop} · {n} props` | `Assistant · 4 props` |

Summaries update live as values change.

---

## 6. Row primitives

Six components. Build once, use everywhere. **Every label sits in the same 56px
gutter** — that alignment is the point of the design.

| Element | Spec |
|---|---|
| Row | `display: flex; align-items: center; gap: 10px` |
| Label | `width: 56px; flex: none`, `font: 500 12px/1.3`, `--ip-fg-muted`, a real `<label htmlFor>` — **not a `<div>`** |
| Control | `flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px` |

### Field (shared shell)

```css
.ip-field {
  flex: 1 1 0;            /* REQUIRED: paired fields share the row */
  min-width: 0;           /* REQUIRED: min-width:auto floors it at the
                             input's intrinsic width and the 2nd field
                             of a pair lands off-panel */
  height: 32px; display: flex; align-items: center; gap: 7px; padding: 0 9px;
  background: #FFFFFF; border: 1px solid #D6D6DC; border-radius: 8px;
}
.ip-field[style*="width"] { flex: none; }        /* explicit widths win */
.ip-field:focus-within { border-color: #1E1E21; box-shadow: 0 0 0 3px rgba(30,30,33,.06); }
.ip-field input { min-width: 42px; font: 500 12.5px/1 var(--ip-mono); color: #1E1E21; }
```

Also set `size="1"` on every number input, so intrinsic width never fights layout.
`min-width: 42px` is not decorative: `1920` measures 30px and `Mixed` 38px at this
font.

| Row type | Spec |
|---|---|
| **NumberRow** | Field + `.ip-prefix` (`font: 600 10.5px/1 --ip-mono`, `--ip-fg-faint`, `cursor: ew-resize`, `user-select: none`) |
| **ColorRow** | Field + `16×16` swatch button (`radius 4px`, `1px solid rgba(20,20,24,.14)`) + hex (`font: 500 12px/1 --ip-mono`, uppercase) + opacity suffix (`font: 500 10.5px/1 --ip-mono`, `--ip-fg-faint`) |
| **SwatchRow** | `display: flex; flex-wrap: wrap; gap: 6px; padding-left: 66px` (gutter + gap). Swatches `22×22`, `radius 5px`. Selected: `box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px #1E1E21` — a **ring, not a checkmark** (a check hides the color it confirms). `+` button: `border: 1px dashed --ip-line-strong` |
| **SelectRow** | `height: 32px`, `padding: 0 28px 0 9px` (`0 28px 0 32px` with a glyph), `border 1px --ip-line-strong`, `radius 8px`, `font: 500 12.5px/1`, `appearance: none`, inline-SVG caret at `right 9px` |
| **PillRow** | See §7 |
| **SwitchRow** | Title `font: 500 12.5px/1.3` + helper `font: 400 11px/1.4 --ip-fg-faint` on the left; switch `38×22`, knob `18px`, `radius 999px`. Off `bg --ip-line-strong`; on `bg --ip-ink`; mixed → knob centred. `role="switch"`, helper wired via `aria-describedby` |

Transparent color renders as an 8px checkerboard (`#DCDCE2` on white) — **never an
empty box**.

`optional` tag: `font: 400 9.5px/1`, `--ip-fg-disabled`, `margin-left: 5px`.

---

## 7. Pills and icons

```css
.ip-pills button {
  flex: 1; height: 30px; padding: 0 4px;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  border: 1px solid #D6D6DC; border-radius: 6px; background: #FFFFFF;
  font: 500 11.5px/1 var(--ip-sans); color: #54545C;
}
.ip-pills button[aria-checked="true"] {
  background: #131316; border-color: #131316; color: #FFFFFF; font-weight: 600;
}
```

`display: inline-flex` is **required** — `gap` and icon alignment do nothing on a
default `<button>`.

### Icon pills

Icon **beside** the label, label always kept. A 370px panel gives a control ~288px,
so 4-option groups lay out as a **2×2 grid** rather than shrinking words away.

```css
.ip-pills--icon { display: grid; gap: 4px; }
.ip-pills--icon.ip-g2 { grid-template-columns: repeat(2, 1fr); }  /* 2 or 4 options */
.ip-pills--icon.ip-g3 { grid-template-columns: repeat(3, 1fr); }  /* 3 or 5 options */
.ip-pills--icon button { flex: none; height: 32px; padding: 0 6px; font: 500 11px/1; }
.ip-pills--icon .ip-i { flex: none; opacity: .9; }
.ip-pills--icon button[aria-checked="true"] .ip-i { opacity: 1; }
```

| Group | Options | Columns |
|---|---|---|
| Direction | Column · Row | `ip-g2` |
| Align | Start · Center · End · Stretch | `ip-g2` (2×2) |
| Wrap | No wrap · Wrap · Reverse | `ip-g3` |
| Density | Compact · Default · Comfy · Spacious | `ip-g2` (2×2) |
| Radius | None · S · M · L · Full | `ip-g3` (3+2) |

**Icon rules:** `14×14`, `viewBox="0 0 14 14"`, `stroke-width: 1.5`,
**`currentColor`** — so the active ink pill inverts them for free. Copy the paths
from `properties-panel.html`; do not substitute an icon-font or a library set,
because none of them read correctly at 14px in this vocabulary.

Semantics (what each icon must depict):

- **Direction** — stacked bars (column) vs side-by-side bars (row)
- **Align** — a faint rule on the edge items pack to, with two bars against it;
  Stretch shows rules both sides and full-width bars
- **Wrap** — one row / wrapped to two rows / reversed
- **Density** — the same three bars with growing gaps
- **Radius** — corner curvature, sharp through to a circle for Full

**Justify keeps a `SelectRow`** (five options can't be pills at this width) and
carries a leading glyph that **reflects the current value** and updates on change:
`position: absolute; left: 9px; top: 50%; transform: translateY(-50%);
pointer-events: none`. Toggle the `<g>` children with an explicit
`display: 'block' | 'none'` — setting `display: ''` falls back to the stylesheet's
`none` and the glyph never appears.

Pill groups are `role="radiogroup"`, arrow-key navigable, `aria-checked` per option.
Keep a `data-label` on each pill and read *that* in logic — `textContent` now
contains the SVG.

---

## 8. State matrix

What renders in each state. A row that can't act is **absent**, not disabled.

| Row / section | 3a component | 3b artboard | Multi-select |
|---|---|---|---|
| Sections available | Layout · Stack · Spacing · Style · Content | Layout · Stack · Spacing · Style | Layout · Stack · Spacing · Style |
| W / H + `A` chip | ✅ | ✅ | ✅ (chip hidden) |
| Position select | ✅ | ✅ | ✅ |
| X / Y | only `position: absolute` | only `position: absolute` | only if all absolute |
| Direction / Align / Justify / Wrap | ✅ | ✅ | ✅ |
| Density + Gap / Pad | ✅ | ✅ | ✅ |
| Background type (Color/Gradient/Image) | ❌ | ✅ | ❌ |
| Fill + swatch grid | ✅ | ✅ | ColorRow only, **grid suppressed** |
| Text color | ✅ | ❌ | ❌ unless all are elements |
| Border, Radius, Shadow, Opacity | ✅ | ✅ | ✅ |
| Content | ✅ | ❌ | only if one kind **and** one component type |

Disclosure selectors — use the **negation** form, or a future kind falls through:

```css
.ip-panel:not([data-kind="element"]):not([data-kind="text"]) [data-kind-only="component"],
.ip-panel:not([data-kind="element"]):not([data-kind="text"]) [data-kind-only="element"],
.ip-panel:not([data-kind="frame"]) [data-kind-only="artboard"],
.ip-panel:not([data-position="absolute"]) [data-when="absolute"] { display: none; }

/* [hidden] loses to display:flex — without this the attribute does nothing */
.ip-panel [hidden] { display: none !important; }
```

### 3a — component selected

- Tabs/sections all five; Layout expanded by default
- `A` chip: `20×20`, `radius 4px`, `border 1px --ip-line-strong`,
  `font: 700 9px/1 --ip-mono`. Pressed: `bg --ip-accent-soft`,
  `border-color #E6DEF9`, `color --ip-accent-fg`. Pressing it clears the number;
  typing a number clears it
- Radius pills map `0 / 4 / 8 / 16 / 999`; an off-scale value reveals a Custom
  NumberRow
- Shadow writes a **token** (`None / Soft / Raised / Overlay`) — never x/y/blur/spread
- Content renders from `PropSchema` in declaration order

### 3b — artboard selected

- **No Content section, and no Content chip in the index**
- Background type appears and **swaps** the field beneath it — never stack all three
- No Text color row

### Multi-select

- Name reads `3 selected`; chip is the shared kind or `mixed`
- Breadcrumb = **nearest common ancestor**
- Note bar above the first section: `padding: 9px 14px`, `bg --ip-subtle`,
  `font: 400 11.5px/1.4`, `--ip-fg-subtle` —
  *"Showing the 12 properties these 3 nodes share. Editing writes to all."*
- Render a property only if **every** node declares it (intersection, not union)
- Differing values: `Mixed` in italic **sans** (not mono), `--ip-fg-faint`
- Numeric: empty input + `Mixed` placeholder; **hide the `A` chip** (`[data-multi="true"] .ip-auto { display: none }`) so the placeholder has room
- Color: **suppress the swatch grid** (`[data-multi="true"] .ip-swatches { display: none }`)
- Switch: `aria-checked="mixed"`, knob centred. First click turns **all on** — not "match the majority"
- **One history entry per edit, covering every node.** Setting radius on 4 nodes is one undo
- Writes are **absolute**, not relative: W = 200 makes every node 200
- Mixed clears as soon as values converge
- No shared properties → `Nothing in common — narrow the selection`

### Locked

Header shows the `locked` chip and `Unlock to edit` (`--ip-info`); body is
`opacity: .6; pointer-events: none`. Do not silently edit the unlocked subset.

---

## 9. Number field behavior

| Interaction | Behavior |
|---|---|
| Type + `Enter` / blur | Commit. Invalid input reverts silently — no error state |
| `↑` / `↓` | ±1 · `⇧` ±10 · `⌥` ±0.1 |
| Drag the prefix label | Scrub; `cursor: ew-resize` on hover |
| Math | Evaluate `12*2`, `100/3`, `8+4` on commit |
| Empty + `Enter` | Reset to inherited/default |
| Undo | One entry per commit. Coalesce a scrub into one entry on `pointerup` |

Density presets write gap+pad and stay lit **only** while both still match:
`Compact [4,8] · Default [8,12] · Comfortable [12,16] · Spacious [20,24]`. Editing
either by hand silently deselects all four.

Content text is live-bound with a **200ms debounce**; a typing burst must coalesce
into one undo entry, or commit on blur instead. **One of the two is required.**

---

## 10. Accessibility — not optional

- Every gutter label is a real `<label htmlFor>`
- Pill groups: `role="radiogroup"` / `role="radio"` / `aria-checked`, arrow-key nav
- Switch: `role="switch"` + `aria-checked` (`"mixed"` supported), helper text via
  `aria-describedby`
- Swatches: `aria-label` with the color **name and hex** — color alone is not a name
- Icons are `aria-hidden="true"`; the label carries the name
- Section headers: `aria-expanded`; index chips: `aria-current`
- Focus ring everywhere: `outline: 2px solid #9B6BFF; outline-offset: 2px`
- The rail announces the swap: `aria-live="polite"`, or move focus to the header on
  canvas selection

---

## 11. Verification — run these against your build

DOM assertions, not opinions. Each should pass in the browser console.

```js
// geometry
panel.offsetWidth === 370
getComputedStyle(panel).borderRightWidth === '1px'
getComputedStyle(panel).borderLeftWidth  === '0px'

// nothing overflows the panel, in every state
body.scrollWidth === body.clientWidth

// paired fields share the row
[...document.querySelectorAll('.ip-row')].every(r => {
  const fs = [...r.querySelectorAll('.ip-field')];
  return fs.length < 2 || fs.reduce((n, f) => n + f.offsetWidth, 0) <= r.offsetWidth;
})

// hidden means hidden
getComputedStyle(document.querySelector('[hidden]')).display === 'none'

// four-digit values and the Mixed placeholder both fit
input.scrollWidth <= input.clientWidth   // with value 1920, and with placeholder Mixed

// breadcrumb: root-first, leaf never clipped
crumbs.firstElementChild.textContent === rootName
leafCrumb.scrollWidth <= leafCrumb.clientWidth

// no unresolved tokens
[...document.styleSheets].flatMap(s => [...s.cssRules]).length > 0 &&
  getComputedStyle(panel).backgroundColor === 'rgb(251, 251, 252)'
```

### Visual checklist

**3a** — five sections; Layout expanded; `1920 × auto` in the collapsed Layout
summary; Align is a 2×2 icon grid; Justify shows a glyph matching its value;
collapsing Style persists to the next component selected.

**3b** — four sections, no Content chip in the index; Background type row present
and swapping; no Text row.

**Multi** — `3 selected` + `mixed` chip; note bar visible; `Mixed` in italic sans on
color and empty numeric fields; no swatch grid; no `A` chip; switch knob centred.

**Rail** — 370px in every state; palette returns on `✕` and `Escape` with its scroll
intact; a Layers click does not swap the rail.

---

## 12. The eight things that broke while building this

Every one of these was a real defect in the reference file. Check each explicitly.

1. **`[hidden]` does nothing on a flex row.** `display: flex` outranks the UA rule.
2. **`flex-direction` / `gap` do nothing on a `<button>`** without `display: flex`.
3. **A field wrapper needs `flex: 1 1 0; min-width: 0`**, not just the input, or the
   second control of a pair lands outside the panel.
4. **`style.display = ''` falls back to the stylesheet**, so a `display: none`
   default stays hidden. Set an explicit value.
5. **`direction: rtl` right-packs a breadcrumb** whenever the row has slack.
6. **A fixed-width chip inside a narrow field starves the input** — `AUTO` at 34px
   left 32px for the value, which clips `1920` and truncates `Mixed` to `Mixe`.
7. **`textContent` includes nothing useful once an SVG is inside** — key logic off
   `data-label`.
8. **Disclosure selectors written as `[data-kind="frame"]`** instead of a negation
   let `mixed` fall through and render element-only rows.

---

# Part 3 — Component palette + canvas toolbar spec

<!-- source: README.md -->

# Builder Shell — Implementation Guide

Two screens to build: **Design mode** (option `1b`) and **Preview mode** (option `2a`).
Reference design: `Builder Panel Redesign.dc.html` in this project.

Scope: left component panel + canvas toolbar + mode switching. The right-hand
KiteAI/Layers panel is unchanged — leave your existing component in place.

---

## 1. Design tokens

Drop these in your CSS (or map to Tailwind theme values). Everything in the design
uses only these — no other grays.

```css
:root {
  /* surfaces */
  --bg-panel:      #ffffff;   /* panel + toolbar */
  --bg-subtle:     #fafaf8;   /* thumbnails, search field */
  --bg-canvas:     #f4f4f2;   /* design canvas */
  --bg-preview:    #efefec;   /* preview backdrop (slightly darker) */
  --bg-hover:      #f5f5f2;
  --bg-track:      #f2f2ef;   /* segmented-control track */

  /* lines */
  --line:          #ebebe7;   /* panel dividers */
  --line-strong:   #d9d9d3;   /* input borders */
  --line-soft:     #f0f0ec;

  /* text */
  --fg:            #1c1c1e;
  --fg-muted:      #55554e;
  --fg-subtle:     #8a8a80;
  --fg-faint:      #a3a399;

  --accent:        #2563eb;   /* active chip / rail selection */

  --radius-sm: 6px;
  --radius:    8px;
  --radius-lg: 12px;
  --shadow-toolbar: 0 6px 20px rgba(20,20,18,.12);
  --shadow-raise:   0 1px 2px rgba(0,0,0,.07);
}
```

Type: system sans (`"Helvetica Neue", Helvetica, Arial, sans-serif`) for UI,
`ui-monospace, "SF Mono", Menlo, monospace` for glyph tiles, counts and the zoom
readout. Sizes used: 14 (search), 13 (list item), 12.5 (grid item name), 12
(chips, toolbar), 11 (descriptions, meta), 10 (section eyebrow, ⌘K badge, glyphs).

Category dot colors:

```js
const CATEGORY_COLOR = {
  layout: '#5b6b8c', typography: '#6d5aa8', controls: '#2563eb',
  data: '#2b7a6b', media: '#a06520', feedback: '#a33b52',
};
```

---

## 2. Data shape

One flat registry drives both the panel and the drop behavior.

```ts
type ComponentDef = {
  id: string;            // 'button'
  name: string;          // 'Button'
  desc: string;          // 'Action button'  — one short noun phrase, max ~18 chars
  glyph: string;         // 'BTN' — 3-letter mono tile label
  category: keyof typeof CATEGORY_COLOR;
  keywords?: string[];   // extra search terms: ['cta','submit','link']
  defaultProps: Record<string, unknown>;
  render: (props) => ReactNode;   // your existing renderer
};

export const REGISTRY: ComponentDef[] = [ /* 32 today, scales to ~100 */ ];
```

Category order is fixed and meaningful (structure → content → interaction → data →
media → feedback): `layout, typography, controls, data, media, feedback`.

Long-term (100+ components) `glyph` beats a mini-preview: it renders at any size,
never needs a screenshot pipeline, and stays legible in the 32px list tile.

---

## 3. Screen A — Design mode (`1b`)

```
┌────────────── 370px ──────────────┬──────── canvas ────────┬── 220px ──┐
│ search  [≡][⊞]                    │   ╭ floating toolbar ╮ │  Layers   │
│ chips: All Layout Typography …    │                        │ (existing)│
│ RECENT: Button  Stack  Table      │      artboards         │           │
│ ─────────────────────────────     │                        │           │
│ ▍LAYOUT              6  (sticky)  │                        │           │
│   [SEC] Section    Flex container │                        │           │
│   …                               │                        │           │
└───────────────────────────────────┴────────────────────────┴───────────┘
```

### 3.1 Panel header (fixed, does not scroll)

- Search input, 38px tall, `--line-strong` border, ⌕ leading, `⌘K` badge trailing.
  Placeholder reads `Search {N} components` where N = registry length.
- **View toggle**, icon-only, inline right of the search field. 30×30 buttons in a
  `--bg-track` pill; active gets `--bg-panel` + `--shadow-raise`.
  - list icon: three 1.5px bars, 13px wide, 2.5px gap
  - grid icon: 2×2 of 5px squares, 3px gap, 1.5px radius
  - both drawn with `background: currentColor` so the active/inactive color is one
    property on the parent.
- **Filter chips** on their own row below: `All` + one per category, pill radius,
  active = `--accent` fill + white text.

### 3.2 Recent strip

Three most recently dropped components, most recent first, as equal-width outlined
buttons. Persist to `localStorage` under `builder.recentComponents` (array of ids,
cap 12, render first 3). Hide the whole strip when empty (new project) — don't
render an empty state.

### 3.3 Grouped scroller

One block per category that survives the current filter. Header is
`position: sticky; top: 0` with a translucent white background and blur, showing a
6–7px category dot, uppercase name, and the count.

List row: 32×24 glyph tile · name · description right-aligned in `--fg-faint`.
Grid cell: 78px tall `--bg-canvas` tile with the glyph centered, name + description
stacked beneath, two columns, 14px row gap / 12px column gap.

```jsx
const groups = CATEGORIES
  .filter(c => filter === 'all' || filter === c.key)
  .map(c => ({ ...c, items: results.filter(i => i.category === c.key) }))
  .filter(g => g.items.length > 0);   // never render an empty group
```

### 3.4 Grid thumbnail previews

Add one field to `ComponentDef`, resolved in this order — first hit wins, so a new
component is never a blank tile:

```ts
preview?: 'auto' | ReactNode;   // authored mini → live render → glyph fallback
previewProps?: Record<string, unknown>;   // short strings only, see below
```

**Default is live render.** You already have canonical renderers in
`client/src/design/resolver.tsx`, so the library gets coverage for free and a
preview can never drift from its component. Authored minis are the *exception*,
not the plan — hand-authoring 100 previews is work that goes stale.

#### Which mode, by component class

| Class | Mode | Why |
|---|---|---|
| Composites — Table, Calendar, Chart, Card, Tabs, List, Accordion | **live** | Structure is the whole point; a hand-drawn approximation misleads |
| Branded atoms — Button, Badge, Alert, Avatar | **live** | Their exact radius, weight and fill are what the user is picking |
| Geometry primitives — Section, Stack, HStack, Grid, Divider, Resizable | **authored** | They have no visual self; live-rendering an empty flex box shows nothing |
| Form atoms — TextInput, Select, Checkbox, Switch, Slider | **either** | Live is fine at 240×160; the authored versions in `builder-panel-1b.html` are crisper. Pick one per component and stop |
| Anything new, or anything failing the legibility test | **glyph** | Never blocks a component from shipping |

**Legibility test, applied once per component at review:** at `scale(.34)` in a
78px tile, can you tell it apart from its two nearest neighbours? Select vs
TextInput, Alert vs Badge. If no, drop to authored or glyph — a preview that reads
as "some grey rectangle" costs a mount for nothing.

**(a) Authored mini.** 3–4 lines of CSS per component, drawn at the tile's true
size: crisp, zero runtime cost, no scaling artifacts. A Button is a 54×22 pill; a
Switch is a 30×17 track with a 13px knob; Stack/HStack/Grid are bar arrangements.
Eleven are built in `builder-panel-1b.html` §5 — use them for the geometry
primitives and delete the rest if live covers those components better.

**(b) Live render.** Mount
the real component in a fixed stage and scale it, so the preview can't drift from
the component:

```css
.bp-cell-preview { position: relative; overflow: hidden; }
.bp-preview-stage {
  position: absolute; top: 50%; left: 50%;
  width: 240px; height: 160px;              /* authoring size */
  transform: translate(-50%, -50%) scale(.34);
  transform-origin: center;
  pointer-events: none;                      /* never interactive in the panel */
}
```

Two costs to plan for: it mounts a component per cell, so **virtualize the
scroller past ~60 cells**; and 12px copy at `scale(.34)` renders as 4px of mush, so
every live preview needs `previewProps` with short strings (`label: 'Save'`, three
table rows, not twelve).

**(c) Glyph — fallback.** The 3-letter mono tile. Never remove it; it's what makes
(a) and (b) optional per component, and what keeps a new component from being a
blank tile the day it lands.

#### Scaling to 50–100 components

- **`previewProps` is required for every live preview**, and it's the only thing
  that needs authoring per component: short strings, 3 rows not 12, no arrays that
  grow. `label: 'Save'`, not `label: 'Save changes to this scenario'`. Without it,
  12px copy at `scale(.34)` is 4px of mush.
- **One review gate:** a component may not ship `preview: 'auto'` without
  `previewProps`. Lint it if you can — the failure mode is silent and ugly.
- **Cost is per visible cell, not per registry entry.** Your
  `content-visibility: auto` past ~60 cells already handles this; keep it rather
  than DOM-removing virtualization, which breaks sticky headers and drag
  connectors.
- **Previews are inert, always:** `pointer-events: none`, `user-select: none`, no
  fetch, no state, no animation, no loading or error branch. A preview that can
  spin is a bug.
- **Monochrome for authored minis only.** Live previews render the component's real
  colors — that's the point of them. Don't grey-scale a live preview; if the grid
  gets noisy, the fix is fewer live previews, not desaturated ones.

**Two rules, enforced in review:**
- **No state, no data.** A Table preview is 3 hard-coded rows, never a fetch. A
  preview that can load, error, or animate is a bug.
- **Monochrome.** `#d8d8d0`–`#dcdcd4` fills and `#d2d2ca` strokes on the
  `#f4f4f2` tile. Colored previews turn the grid into a fruit salad and compete
  with the category dots, which are the only color the panel gets.

### 3.5 Search behavior

```js
function search(query, registry) {
  if (!query.trim()) return registry;
  const q = query.toLowerCase();
  return registry
    .map(c => {
      const name = c.name.toLowerCase();
      let score = 0;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else if (c.keywords?.some(k => k.includes(q))) score = 40;
      else if (c.desc.toLowerCase().includes(q)) score = 20;
      return { c, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .map(x => x.c);
}
```

- Debounce 120ms on keystroke; filter chips AND search compose (chip narrows the
  set search runs over).
- While searching, keep the group headers — they're the answer to "where does this
  live", which is half of why people search.
- Zero results: one centered line, `No components match "{query}"`, plus a
  `Clear search` text button. No illustration.

### 3.6 Behaviors

| Interaction | Behavior |
|---|---|
| `⌘K` / `Ctrl+K` | Focus search, select existing text. Works from anywhere except a text field on the canvas. |
| `Esc` in search | Clear query; second `Esc` blurs. |
| `↑ ↓` in search | Move a highlight through the flattened result list. |
| `Enter` in search | Insert the highlighted component at canvas center of the active artboard. |
| Click a card/row | Same as Enter — insert at center. Cheaper than drag for keyboard users. |
| Drag a card/row | HTML5 drag with `dataTransfer.setData('application/x-component', id)`. Set a drag image from the tile. Canvas shows insertion guides. |
| Hover | Row/cell background `--bg-hover`; cursor `grab`, `grabbing` while dragging. |
| Toggle view | Persist to `localStorage` `builder.panelView` = `'list' | 'grid'`. |
| Filter chip | Single-select (not multi). Clicking the active chip returns to `All`. |
| Panel scroll | Persist scroll position per filter so switching chips and back doesn't lose place. |

```jsx
function ComponentPanel() {
  const [query, setQuery]   = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView]     = useLocalStorage('builder.panelView', 'list');
  const results = useMemo(() => search(query, REGISTRY), [query]);

  useHotkey('mod+k', () => searchRef.current?.select());

  return (
    <aside className="panel">
      <PanelHeader … />
      {recent.length > 0 && <RecentStrip items={recent} />}
      <div className="scroller">
        {groups.map(g => (
          <section key={g.key}>
            <StickyHeader dot={CATEGORY_COLOR[g.key]} name={g.name} count={g.items.length} />
            {view === 'list'
              ? g.items.map(i => <ListRow key={i.id} item={i} onInsert={insert} />)
              : <div className="grid">{g.items.map(i => <GridCell key={i.id} item={i} onInsert={insert} />)}</div>}
          </section>
        ))}
      </div>
    </aside>
  );
}
```

### 3.7 Floating canvas toolbar

Absolutely positioned, `top: 16px; left: 50%; translateX(-50%)`, 44px tall, white,
1px border, `--shadow-toolbar`, `z-index: 2`. **Every child needs
`flex: none; white-space: nowrap`** or the labels wrap inside their pills on narrow
canvases.

Order, separated by 1px × 18px dividers:
`+ Artboard` (solid dark pill) · `↑ Import` · | · undo · redo · | · `−  30%  +` ·
`Fit` · | · `Design / Preview` segmented.

- Undo/redo disabled state = `#c2c2b8`, no hover, `cursor: default`.
- Zoom readout is monospace so the toolbar doesn't reflow between `30%` and `100%`.
- Zoom steps: 10, 25, 30, 50, 75, 100, 150, 200, 400. `−`/`+` move one stop;
  `⌘0` = 100%; `⇧1` / `Fit` = fit all artboards; `⌘scroll` = continuous zoom.
- `Fit` computes the bounding box of all artboards + 64px padding.

---

## 4. Screen B — Preview mode (`2a`)

Same shell, three things change:

1. Component panel unmounts entirely (canvas grows to fill; no animation needed —
   an instant swap reads as a mode change).
2. Toolbar loses `+ Artboard`, `Import`, undo and redo, and gains a **screen picker**.
3. Canvas backdrop darkens to `--bg-preview`; the active artboard renders at true
   size with `0 10px 40px rgba(20,20,18,.14)`, no dot grid, no selection chrome,
   no rulers, no guides.

Toolbar contents: `Editor View - Configuration ▾` (screen picker) · | · `‹  4/7  ›`
· | · `−  100%  +` · `Fit` · | · `Design / Preview`.

### Behaviors

| Interaction | Behavior |
|---|---|
| Screen picker | Dropdown listing all artboards in layer order; current one checked. Selecting jumps and recenters. |
| `‹` / `›` | Previous / next artboard; wraps. Arrow keys `←` `→` do the same. Counter is `index/total`. |
| Preview default zoom | 100%, artboard centered, not "fit" — preview means real size. |
| Pointer events | Live: the rendered components receive real clicks, hover, focus and typing. The builder does not intercept. |
| Layers panel | Stays. Clicking a layer selects that artboard in preview (jumps to it) rather than selecting a node. |
| Escape hatch | `⇧E` or clicking `Design` returns to Design mode at the same artboard and zoom. |
| Deep link | Reflect state in the URL: `?mode=preview&artboard=editor-view-configuration`, so preview links are shareable. |

```jsx
function BuilderShell() {
  const [mode, setMode] = useUrlState('mode', 'design');     // 'design' | 'preview'
  const [activeId, setActiveId] = useUrlState('artboard', artboards[0].id);
  const index = artboards.findIndex(a => a.id === activeId);

  useHotkey('shift+e', () => setMode(m => (m === 'design' ? 'preview' : 'design')));
  useHotkey('left',  () => mode === 'preview' && step(-1));
  useHotkey('right', () => mode === 'preview' && step(+1));

  return (
    <div className="shell">
      {mode === 'design' && <ComponentPanel />}
      <Canvas mode={mode}>
        <Toolbar mode={mode} … />
        {mode === 'preview'
          ? <Artboard id={activeId} interactive scale={zoom} />
          : artboards.map(a => <Artboard key={a.id} id={a.id} editable />)}
      </Canvas>
      <RightPanel />           {/* unchanged */}
    </div>
  );
}
```

---

## 5. Build order

1. Registry + tokens.
2. Panel shell: header, chips, sticky groups, list view. (Design mode is usable here.)
3. Grid view + view toggle + persistence.
4. Search, keyboard nav, recents.
5. Toolbar with zoom/fit; then mode switching and Preview.
6. Drag-and-drop insertion last — click-to-insert covers the flow until then.

## 6. Accessibility

- Search is a real `<input type="search">` with a visible label for screen readers.
- Chips are `role="radiogroup"` / `role="radio"`, arrow-key navigable.
- View toggle buttons need `aria-label="List view"` / `"Grid view"` and
  `aria-pressed`; the icons are decorative.
- Grouped scroller: `role="list"` per group, header linked via `aria-labelledby`.
- Every interactive element gets a visible focus ring —
  `outline: 2px solid var(--accent); outline-offset: 2px`.
- Contrast: `--fg-faint` (#a3a399) is only for 11px+ non-essential metadata; never
  use it for a component name.

---

# Part 4 — Reference code: properties panel

Save as `properties-panel.html`. Renders 3a (component), 3b (artboard),
multi-select, locked, and the palette-owns-the-rail state.

```html

<!DOCTYPE html>
<!--
  Kiteframe — Inspect panel, SINGLE-PANE variant (3a / 3b / multi-select)
  Alternate to inspect-panel-3ab.html (tabbed). Same tokens, same row primitives,
  same left-rail placement (370px, replaces the palette on CANVAS selection).
  Spec: README-properties-panel.md (canonical).

  Why this exists
    Tabs hide two thirds of the panel. One pane shows everything, which is what
    people who know the panel actually want: set radius and gap without a trip
    through a tab bar.

  The problem it inherits, and the four things that solve it
    A single pane is a long scroll — the exact complaint that produced the tabs.
    So this is not "the tabs removed", it is a scroll made navigable:

    1. COLLAPSIBLE SECTIONS with per-kind memory. Collapse Style once and it stays
       collapsed for every component you select next. The panel learns your habit
       instead of resetting.
    2. A STICKY SECTION INDEX under the header — the section names as chips. Click
       to jump and expand; the active one is highlighted as you scroll. This is the
       tab bar's wayfinding without the tab bar's hiding.
    3. HARD PROGRESSIVE DISCLOSURE. More important here than in the tabbed version:
       every row that cannot act is absent, not greyed. An artboard has no Content
       section at all, no Text color row, no stack controls when it is not a flex
       parent.
    4. SECTION SUMMARIES on collapsed headers (`8 / 12 · M · Soft`), so a collapsed
       section still answers "what is it set to" without expanding.

  Trade-off, stated plainly
    Tabbed wins for a first-time user: three short lists beat one long one.
    Single-pane wins for a daily user: no navigation between related properties.
    Collapse memory is what makes the second one hold up past week one — without
    it this variant is just a long scroll.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<title>Inspect panel — single pane</title>
<style>
/* ─── Tokens (Graphite · Light — THEME.md §2 owns these values) ─────────── */
:root {
  --ip-chrome:      #FBFBFC;
  --ip-raised:      #ffffff;
  --ip-subtle:      #f3f3f5;
  --ip-hover:       #f3f3f5;
  --ip-track:       #eeeef1;

  --ip-line:        #e4e4e8;
  --ip-line-soft:   #eeeef1;
  --ip-line-strong: #d6d6dc;

  --ip-fg:          #1e1e21;
  --ip-fg-muted:    #54545c;
  --ip-fg-subtle:   #77777f;
  --ip-fg-faint:    #9a9aa3;
  --ip-fg-disabled: #c4c4cc;

  --ip-ink:         #131316;
  --ip-ink-fg:      #ffffff;
  --ip-accent:      #9B6BFF;
  --ip-accent-soft: #f2effa;
  --ip-accent-fg:   #6D3FD6;
  --ip-info:        #189FDB;
  --ip-warn-bg:     #FFF1D0;
  --ip-warn-fg:     #8a5a00;

  --ip-kind-el-fg:  #6D5AA8;  --ip-kind-el-bg:  #f2effa;
  --ip-kind-fr-fg:  #2b7a6b;  --ip-kind-fr-bg:  #e9f5f2;
  --ip-kind-tx-fg:  #a06520;  --ip-kind-tx-bg:  #fdf2e6;

  --ip-gutter: 56px;
  --ip-h:      32px;
  --ip-r-sm: 6px;
  --ip-r:    8px;
  --ip-shadow-raise: 0 1px 2px rgba(0,0,0,.07);

  --ip-sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --ip-mono: ui-monospace, "SF Mono", Menlo, monospace;
}

/* ─── Shell — LEFT rail, 370px, same as the palette it replaces ─────────── */
.ip-panel {
  width: 370px; flex: none;
  display: flex; flex-direction: column; min-height: 0;
  background: var(--ip-chrome);
  border-right: 1px solid var(--ip-line);
  font-family: var(--ip-sans);
  -webkit-font-smoothing: antialiased;
}
.ip-panel *, .ip-panel *::before, .ip-panel *::after { box-sizing: border-box; }
.ip-panel [hidden] { display: none !important; }

.ip-body { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.ip-body::-webkit-scrollbar { width: 8px; }
.ip-body::-webkit-scrollbar-thumb { background: #d6d6dc; border-radius: 8px; }

/* ─── Header ────────────────────────────────────────────────────────────── */
.ip-header {
  flex: none; padding: 12px 14px 0;
  background: var(--ip-chrome);
  border-bottom: 1px solid var(--ip-line);
}
/* breadcrumb and close share the top line: crumbs take the space, ✕ pins right */
.ip-crumb-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
}

.ip-crumbs {
  flex: 1; min-width: 0;
  display: flex; align-items: center; justify-content: flex-start; gap: 5px;
  overflow: hidden;
  font: 400 11px/1.3 var(--ip-sans); color: var(--ip-fg-faint);
}
.ip-crumbs > * { flex: none; }
.ip-crumbs button {
  border: 0; background: none; padding: 0; cursor: pointer; font: inherit;
  color: var(--ip-fg-faint);
  max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* root-first order, so the leaf is last: ancestors ellipsis at 96px, the leaf
   takes whatever it needs and is never truncated */
.ip-crumbs button:last-child { max-width: none; min-width: 0; }
.ip-crumbs button:hover { color: var(--ip-info); }
.ip-crumbs .ip-sep { color: #d0d0d6; }

.ip-title-row { display: flex; align-items: center; gap: 8px; padding: 5px 0 10px; }
.ip-title {
  flex: 1; min-width: 0;
  font: 600 16px/1.2 var(--ip-sans); color: var(--ip-fg);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ip-kind { flex: none; font: 500 9.5px/1 var(--ip-sans); border-radius: 999px; padding: 4px 7px; }
.ip-kind[data-kind="element"] { color: var(--ip-kind-el-fg); background: var(--ip-kind-el-bg); }
.ip-kind[data-kind="frame"]   { color: var(--ip-kind-fr-fg); background: var(--ip-kind-fr-bg); }
.ip-kind[data-kind="text"]    { color: var(--ip-kind-tx-fg); background: var(--ip-kind-tx-bg); }
.ip-kind[data-kind="mixed"]   { color: var(--ip-fg-muted);   background: var(--ip-track); }
.ip-kind[data-kind="locked"]  { color: var(--ip-warn-fg);    background: var(--ip-warn-bg); }
.ip-close {
  flex: none; width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border: 0; border-radius: var(--ip-r-sm); background: none;
  color: var(--ip-fg-faint); font-size: 13px; cursor: pointer;
}
.ip-close:hover { background: var(--ip-hover); color: var(--ip-fg-muted); }
.ip-unlock {
  margin-left: auto; border: 0; background: none; padding: 0; cursor: pointer;
  font: 500 11px/1 var(--ip-sans); color: var(--ip-info);
}

/* ─── Section index — the tab bar's wayfinding, without the hiding ──────── */
.ip-index {
  flex: none; display: flex; gap: 4px; flex-wrap: wrap;
  padding: 9px 14px;
  background: var(--ip-chrome);
  border-bottom: 1px solid var(--ip-line);
}
.ip-index button {
  padding: 4px 9px; border: 1px solid var(--ip-line-soft); border-radius: 999px;
  background: none; cursor: pointer;
  font: 500 11px/1 var(--ip-sans); color: var(--ip-fg-faint); white-space: nowrap;
}
.ip-index button:hover { background: var(--ip-hover); color: var(--ip-fg-muted); }
.ip-index button[aria-current="true"] {
  background: var(--ip-track); border-color: var(--ip-line-strong);
  color: var(--ip-fg); font-weight: 600;
}

/* ─── Sections ──────────────────────────────────────────────────────────── */
.ip-section { border-bottom: 1px solid var(--ip-line); scroll-margin-top: 8px; }
.ip-section-head {
  width: 100%; display: flex; align-items: center; gap: 9px;
  padding: 11px 14px; border: 0; background: none; cursor: pointer; text-align: left;
}
.ip-section-head:hover { background: var(--ip-hover); }
.ip-caret { flex: none; width: 10px; color: var(--ip-fg-faint); font-size: 10px; }
.ip-section-name {
  flex: none;
  font: 700 10.5px/1 var(--ip-sans); letter-spacing: .11em;
  text-transform: uppercase; color: var(--ip-fg-muted);
}
/* a collapsed section still answers "what is it set to" */
.ip-summary {
  flex: 1; text-align: right;
  font: 500 10.5px/1 var(--ip-mono); color: var(--ip-fg-faint);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ip-section[data-open="true"] .ip-summary { visibility: hidden; }
.ip-section-body { padding: 2px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
.ip-section[data-open="false"] .ip-section-body { display: none; }
.ip-subgroup {
  display: flex; flex-direction: column; gap: 10px;
  padding-top: 10px; margin-top: 2px; border-top: 1px solid var(--ip-line-soft);
}
.ip-eyebrow {
  display: flex; align-items: center; gap: 8px;
  font: 700 9.5px/1 var(--ip-sans); letter-spacing: .11em; color: var(--ip-fg-faint);
}
.ip-eyebrow .ip-note { font: 400 10px/1 var(--ip-sans); letter-spacing: 0; color: var(--ip-fg-disabled); }

/* ─── Row primitives (identical to the tabbed variant) ──────────────────── */
.ip-row { display: flex; align-items: center; gap: 10px; }
.ip-row > label, .ip-row > .ip-label {
  width: var(--ip-gutter); flex: none;
  font: 500 12px/1.3 var(--ip-sans); color: var(--ip-fg-muted);
}
.ip-row > .ip-control { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; }

.ip-field {
  flex: 1 1 0; min-width: 0;          /* or the input's intrinsic width floors it */
  height: var(--ip-h);
  display: flex; align-items: center; gap: 7px; padding: 0 9px;
  background: var(--ip-raised);
  border: 1px solid var(--ip-line-strong);
  border-radius: var(--ip-r);
}
.ip-field[style*="width"] { flex: none; }
.ip-field:focus-within { border-color: var(--ip-fg); box-shadow: 0 0 0 3px rgba(30,30,33,.06); }
.ip-field input {
  flex: 1; min-width: 0; border: 0; outline: 0; background: none;
  font: 500 12.5px/1 var(--ip-mono); color: var(--ip-fg);
}
.ip-field input::placeholder { color: var(--ip-fg-faint); font-family: var(--ip-sans); }
.ip-prefix { flex: none; font: 600 10.5px/1 var(--ip-mono); color: var(--ip-fg-faint); cursor: ew-resize; user-select: none; }
.ip-suffix { flex: none; font: 500 10.5px/1 var(--ip-mono); color: var(--ip-fg-faint); }

.ip-swatch-btn { width: 16px; height: 16px; flex: none; border: 1px solid rgba(20,20,24,.14); border-radius: 4px; padding: 0; cursor: pointer; }
.ip-transparent {
  background-image:
    linear-gradient(45deg, #dcdce2 25%, transparent 25% 75%, #dcdce2 75%),
    linear-gradient(45deg, #dcdce2 25%, transparent 25% 75%, #dcdce2 75%);
  background-size: 8px 8px; background-position: 0 0, 4px 4px; background-color: #fff;
}
.ip-hex { flex: 1; font: 500 12px/1 var(--ip-mono); color: var(--ip-fg); text-transform: uppercase; }
.ip-swatches { display: flex; flex-wrap: wrap; gap: 6px; padding-left: calc(var(--ip-gutter) + 10px); }
.ip-swatches button { width: 22px; height: 22px; padding: 0; border: 1px solid rgba(20,20,24,.12); border-radius: 5px; cursor: pointer; }
.ip-swatches button[aria-pressed="true"] { box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px var(--ip-fg); }
.ip-swatches .ip-more { background: none; border: 1px dashed var(--ip-line-strong); color: var(--ip-fg-faint); font: 400 13px/1 var(--ip-sans); }

.ip-pills { display: flex; gap: 4px; flex: 1; }
.ip-pills button {
  flex: 1; height: 30px; padding: 0 4px;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  border: 1px solid var(--ip-line-strong); border-radius: var(--ip-r-sm);
  background: var(--ip-raised);
  font: 500 11.5px/1 var(--ip-sans); color: var(--ip-fg-muted); cursor: pointer;
}
.ip-pills button:hover { background: var(--ip-hover); }

/* ── icon pills ───────────────────────────────────────────────────────────
   Icon beside the label, 32px tall. A 370px panel gives a row ~288px, so a
   4-option group can't fit four icon+word pills on one line — it lays out as a
   2×2 grid rather than shrinking the words to nothing. Icons are currentColor,
   so the active (ink) pill inverts them for free. */
.ip-pills--icon { display: grid; gap: 4px; }
.ip-pills--icon.ip-g2 { grid-template-columns: repeat(2, 1fr); }
.ip-pills--icon.ip-g3 { grid-template-columns: repeat(3, 1fr); }
.ip-pills--icon button {
  flex: none; height: 32px; padding: 0 6px;
  font: 500 11px/1 var(--ip-sans);
}
.ip-pills--icon .ip-i { flex: none; opacity: .9; }
.ip-pills--icon button[aria-checked="true"] .ip-i { opacity: 1; }
.ip-pl { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* justify keeps its select (5 options don't fit as pills) but gains a glyph that
   reflects the current value */
.ip-select-wrap { position: relative; flex: 1; min-width: 0; display: flex; }
.ip-select-wrap .ip-select { padding-left: 32px; }
.ip-select-glyph {
  position: absolute; left: 9px; top: 50%; transform: translateY(-50%);
  pointer-events: none; color: var(--ip-fg-faint);
}
.ip-select-glyph > g { display: none; }

.ip-pills button[aria-checked="true"] { background: var(--ip-ink); border-color: var(--ip-ink); color: var(--ip-ink-fg); font-weight: 600; }

.ip-select {
  width: 100%; height: var(--ip-h); padding: 0 28px 0 9px;
  border: 1px solid var(--ip-line-strong); border-radius: var(--ip-r);
  background: var(--ip-raised) no-repeat right 9px center;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 9 6'><path d='M1 1l3.5 3.5L8 1' fill='none' stroke='%239a9aa3' stroke-width='1.4' stroke-linecap='round'/></svg>");
  font: 500 12.5px/1 var(--ip-sans); color: var(--ip-fg); appearance: none; cursor: pointer;
}

.ip-switch-row { display: flex; align-items: flex-start; gap: 10px; }
.ip-switch-copy { flex: 1; min-width: 0; }
.ip-switch-title { font: 500 12.5px/1.3 var(--ip-sans); color: var(--ip-fg); }
.ip-switch-help { font: 400 11px/1.4 var(--ip-sans); color: var(--ip-fg-faint); }
.ip-switch {
  flex: none; width: 38px; height: 22px; padding: 2px; border: 0; border-radius: 999px;
  background: var(--ip-line-strong); cursor: pointer;
  display: flex; align-items: center; justify-content: flex-start;
}
.ip-switch::after { content: ""; width: 18px; height: 18px; border-radius: 999px; background: #fff; box-shadow: var(--ip-shadow-raise); }
.ip-switch[aria-checked="true"] { background: var(--ip-ink); justify-content: flex-end; }
.ip-switch[aria-checked="mixed"] { justify-content: center; background: var(--ip-line-strong); }

.ip-optional { font: 400 9.5px/1 var(--ip-sans); color: var(--ip-fg-disabled); margin-left: 5px; }
.ip-mixed { font-family: var(--ip-sans) !important; color: var(--ip-fg-faint) !important; font-style: italic; }
/* 20px square, not a 34px "AUTO" word: paired W/H fields only get ~131px each,
   and the chip was starving the input below a 4-digit value. */
.ip-auto {
  flex: none; width: 20px; height: 20px; padding: 0;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--ip-line-strong); border-radius: 4px; background: none;
  font: 700 9px/1 var(--ip-mono); color: var(--ip-fg-faint); cursor: pointer;
}
/* the value must always be legible: 1920 = 30px, "Mixed" = 38px */
.ip-field input { min-width: 42px; }
/* a mixed numeric reads as field text, never a clipped placeholder */
.ip-panel[data-multi="true"] .ip-auto { display: none; }
.ip-auto[aria-pressed="true"] { background: var(--ip-accent-soft); border-color: #e6def9; color: var(--ip-accent-fg); }

.ip-panel button:focus-visible, .ip-panel select:focus-visible, .ip-panel [tabindex]:focus-visible {
  outline: 2px solid var(--ip-accent); outline-offset: 2px;
}

/* ─── Disclosure — harder here than in the tabbed variant ───────────────── */
.ip-panel:not([data-position="absolute"]) [data-when="absolute"] { display: none; }
.ip-panel:not([data-fill="gradient"]) [data-when="gradient"] { display: none; }
.ip-panel:not([data-fill="image"])    [data-when="image"]    { display: none; }
.ip-panel[data-fill="gradient"] [data-when="solid"],
.ip-panel[data-fill="image"]    [data-when="solid"] { display: none; }
.ip-panel:not([data-kind="element"]):not([data-kind="text"]) [data-kind-only="component"] { display: none; }
/* element-only rows need the same NEGATION shape as component-only, or a
   mixed selection (and any future kind) falls through and shows them — which
   breaks the intersection rule in README-inspect-panel.md §12. */
.ip-panel:not([data-kind="element"]):not([data-kind="text"]) [data-kind-only="element"] { display: none; }
.ip-panel:not([data-kind="frame"]) [data-kind-only="artboard"] { display: none; }
.ip-panel[data-locked="true"] .ip-body { opacity: .6; pointer-events: none; }
.ip-panel[data-multi="true"] .ip-swatches { display: none; }
.ip-panel[data-multi="true"] .ip-shared-note { display: flex; }

.ip-shared-note {
  display: none; align-items: center; gap: 8px;
  padding: 9px 14px; border-bottom: 1px solid var(--ip-line-soft);
  background: var(--ip-subtle);
  font: 400 11.5px/1.4 var(--ip-sans); color: var(--ip-fg-subtle);
}
.ip-shared-note b { font-weight: 600; color: var(--ip-fg-muted); }

/* nothing selected → the palette owns this rail (abbreviated) */
.ip-rail-head { padding: 16px 14px 12px; }
.ip-rail-group { display: flex; align-items: center; gap: 8px; padding: 10px 14px 8px; border-bottom: 1px solid var(--ip-line-soft); }
.ip-rail-dot { width: 7px; height: 7px; border-radius: 999px; flex: none; }
.ip-rail-name { font: 700 11px/1 var(--ip-sans); letter-spacing: .09em; text-transform: uppercase; color: var(--ip-fg-muted); }
.ip-rail-count { font: 500 11px/1 var(--ip-mono); color: var(--ip-fg-faint); }
.ip-rail-rows { padding: 6px 10px 12px; display: flex; flex-direction: column; gap: 1px; }
.ip-rail-row { display: flex; align-items: center; gap: 11px; padding: 7px 8px; border-radius: var(--ip-r); cursor: grab; }
.ip-rail-row:hover { background: var(--ip-hover); }
.ip-rail-tile {
  width: 32px; height: 24px; flex: none;
  display: flex; align-items: center; justify-content: center;
  background: var(--ip-subtle); border: 1px solid var(--ip-line);
  border-radius: 5px; font: 600 9px/1 var(--ip-mono); color: var(--ip-fg-faint);
}
.ip-rail-label { flex: 1; font: 500 13px/1.3 var(--ip-sans); color: var(--ip-fg); }
.ip-rail-desc { font: 400 11px/1.3 var(--ip-sans); color: var(--ip-fg-faint); }
.ip-rail-hint { margin: 0; padding: 14px; border-top: 1px solid var(--ip-line-soft); font: 400 11.5px/1.5 var(--ip-sans); color: var(--ip-fg-faint); }

/* demo chrome only — delete when porting */
body { margin: 0; height: 100vh; display: flex; flex-direction: column; background: #ececeb; font-family: var(--ip-sans); }
.demo-bar { flex: none; display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fff; border-bottom: 1px solid #d6d6dc; }
.demo-bar span { font: 700 10px/1 var(--ip-sans); letter-spacing: .11em; color: #77777f; }
.demo-bar button { padding: 6px 10px; border: 1px solid #d6d6dc; border-radius: 7px; background: #fff; font: 500 12px/1 var(--ip-sans); color: #54545c; cursor: pointer; }
.demo-bar button[aria-pressed="true"] { background: #131316; border-color: #131316; color: #fff; font-weight: 600; }
.demo-stage { flex: 1; display: flex; min-height: 0; }
.demo-canvas { flex: 1; background: #e9e9ec; background-image: radial-gradient(#dcdce0 1px, transparent 1px); background-size: 16px 16px; }
</style>
</head>
<body>

<div class="demo-bar">
  <span>SELECTION</span>
  <button type="button" data-sel="component" aria-pressed="true">Component (3a)</button>
  <button type="button" data-sel="artboard"  aria-pressed="false">Artboard (3b)</button>
  <button type="button" data-sel="multi"     aria-pressed="false">3 selected</button>
  <button type="button" data-sel="none"      aria-pressed="false">Nothing / via Layers</button>
  <button type="button" data-sel="locked"    aria-pressed="false">Locked</button>
</div>

<div class="demo-stage">

  <aside class="ip-panel" id="ip"
         data-kind="element" data-position="in-flow" data-fill="solid"
         data-locked="false" data-multi="false" aria-label="Inspect">

    <div class="ip-header">
      <div class="ip-crumb-row">
        <div class="ip-crumbs" id="ip-crumbs">
          <button type="button">Editor View</button>
          <span class="ip-sep">/</span>
          <button type="button">Chat</button>
          <span class="ip-sep">/</span>
          <button type="button">ChatMessage</button>
        </div>
        <button type="button" class="ip-close" id="ip-deselect"
                aria-label="Deselect and return to components" title="Deselect · Esc">✕</button>
      </div>
      <div class="ip-title-row">
        <div class="ip-title" id="ip-name">ChatMessage</div>
        <span class="ip-kind" id="ip-kindchip" data-kind="element">element</span>
        <button type="button" class="ip-unlock" id="ip-unlock" hidden>Unlock to edit</button>
      </div>
    </div>

    <!-- section index: jump + expand, active state follows the scroll -->
    <nav class="ip-index" id="ip-index" aria-label="Sections">
      <button type="button" data-jump="layout"  aria-current="true">Layout</button>
      <button type="button" data-jump="stack">Stack</button>
      <button type="button" data-jump="spacing">Spacing</button>
      <button type="button" data-jump="style">Style</button>
      <button type="button" data-jump="content" data-kind-only="component">Content</button>
    </nav>

    <div class="ip-body" id="ip-body">

      <div class="ip-shared-note">
        <span>Showing the <b>12 properties</b> these 3 nodes share. Editing writes to all.</span>
      </div>

      <!-- ── LAYOUT ─────────────────────────────────────────────────────── -->
      <section class="ip-section" id="sec-layout" data-open="true" data-key="layout">
        <button type="button" class="ip-section-head" aria-expanded="true">
          <span class="ip-caret">⌄</span>
          <span class="ip-section-name">Layout</span>
          <span class="ip-summary" id="sum-layout">1920 × auto</span>
        </button>
        <div class="ip-section-body">
          <div class="ip-row">
            <label class="ip-label" for="ip-w">Size</label>
            <div class="ip-control">
              <div class="ip-field">
                <span class="ip-prefix" title="Drag to scrub">W</span>
                <input id="ip-w" value="1920" size="1" inputmode="decimal">
                <button type="button" class="ip-auto" aria-pressed="false" aria-label="Auto width" title="Auto width">A</button>
              </div>
              <div class="ip-field">
                <span class="ip-prefix" title="Drag to scrub">H</span>
                <input id="ip-h-val" value="" size="1" placeholder="—" inputmode="decimal">
                <button type="button" class="ip-auto" aria-pressed="true" aria-label="Auto height" title="Auto height">A</button>
              </div>
            </div>
          </div>
          <div class="ip-row">
            <label class="ip-label" for="ip-pos">Position</label>
            <div class="ip-control">
              <select class="ip-select" id="ip-pos">
                <option value="in-flow">In flow</option>
                <option value="absolute">Absolute</option>
                <option value="sticky">Sticky</option>
              </select>
            </div>
          </div>
          <div class="ip-row" data-when="absolute">
            <span class="ip-label">Offset</span>
            <div class="ip-control">
              <div class="ip-field"><span class="ip-prefix">X</span><input value="24" size="1" inputmode="decimal"></div>
              <div class="ip-field"><span class="ip-prefix">Y</span><input value="96" size="1" inputmode="decimal"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── STACK ──────────────────────────────────────────────────────── -->
      <section class="ip-section" id="sec-stack" data-open="true" data-key="stack">
        <button type="button" class="ip-section-head" aria-expanded="true">
          <span class="ip-caret">⌄</span>
          <span class="ip-section-name">Stack</span>
          <span class="ip-summary" id="sum-stack">Column · Center</span>
        </button>
        <div class="ip-section-body">
          <div class="ip-row">
            <span class="ip-label">Direction</span>
            <div class="ip-control"><div class="ip-pills ip-pills--icon ip-g2" role="radiogroup" aria-label="Direction">
              <button type="button" role="radio" aria-checked="true" data-label="Column"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="2.5" y="1.5" width="9" height="3" rx="1"/><rect x="2.5" y="6" width="9" height="3" rx="1"/><rect x="2.5" y="10.5" width="9" height="2" rx="1" opacity=".45"/></svg><span class="ip-pl">Column</span></button>
              <button type="button" role="radio" aria-checked="false" data-label="Row"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="1.5" y="2.5" width="3" height="9" rx="1"/><rect x="6" y="2.5" width="3" height="9" rx="1"/><rect x="10.5" y="2.5" width="2" height="9" rx="1" opacity=".45"/></svg><span class="ip-pl">Row</span></button>
            </div></div>
          </div>
          <div class="ip-row">
            <span class="ip-label">Align</span>
            <div class="ip-control"><div class="ip-pills ip-pills--icon ip-g2" role="radiogroup" aria-label="Align">
              <button type="button" role="radio" aria-checked="false" data-label="Start"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="1" y="1.5" width="1.4" height="11" rx=".7" opacity=".5"/><rect x="4" y="2.5" width="8" height="3" rx="1"/><rect x="4" y="8.5" width="5" height="3" rx="1"/></svg><span class="ip-pl">Start</span></button>
              <button type="button" role="radio" aria-checked="true" data-label="Center"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="6.3" y="1.5" width="1.4" height="11" rx=".7" opacity=".5"/><rect x="3" y="2.5" width="8" height="3" rx="1"/><rect x="4.5" y="8.5" width="5" height="3" rx="1"/></svg><span class="ip-pl">Center</span></button>
              <button type="button" role="radio" aria-checked="false" data-label="End"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="11.6" y="1.5" width="1.4" height="11" rx=".7" opacity=".5"/><rect x="2" y="2.5" width="8" height="3" rx="1"/><rect x="5" y="8.5" width="5" height="3" rx="1"/></svg><span class="ip-pl">End</span></button>
              <button type="button" role="radio" aria-checked="false" data-label="Stretch"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="1" y="1.5" width="1.4" height="11" rx=".7" opacity=".5"/><rect x="11.6" y="1.5" width="1.4" height="11" rx=".7" opacity=".5"/><rect x="3.6" y="2.5" width="6.8" height="3" rx="1"/><rect x="3.6" y="8.5" width="6.8" height="3" rx="1"/></svg><span class="ip-pl">Stretch</span></button>
            </div></div>
          </div>
          <div class="ip-row">
            <label class="ip-label" for="ip-justify">Justify</label>
            <div class="ip-control">
              <div class="ip-select-wrap">
                <svg class="ip-select-glyph" id="ip-justify-glyph" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true" data-v="Center">
                  <g data-v="Start"><rect x="1" y="1" width="1.4" height="12" rx=".7" opacity=".5"/><rect x="4" y="3" width="3.2" height="8" rx="1"/><rect x="8.2" y="3" width="3.2" height="8" rx="1"/></g>
                  <g data-v="Center"><rect x="1.8" y="3" width="3.2" height="8" rx="1"/><rect x="9" y="3" width="3.2" height="8" rx="1"/><rect x="6.3" y="1" width="1.4" height="12" rx=".7" opacity=".5"/></g>
                  <g data-v="End"><rect x="11.6" y="1" width="1.4" height="12" rx=".7" opacity=".5"/><rect x="2.6" y="3" width="3.2" height="8" rx="1"/><rect x="6.8" y="3" width="3.2" height="8" rx="1"/></g>
                  <g data-v="Space between"><rect x="1" y="3" width="3.2" height="8" rx="1"/><rect x="9.8" y="3" width="3.2" height="8" rx="1"/></g>
                  <g data-v="Space around"><rect x="2" y="3" width="3.2" height="8" rx="1"/><rect x="8.8" y="3" width="3.2" height="8" rx="1"/><rect x="0" y="6" width="1" height="2" rx=".5" opacity=".4"/><rect x="13" y="6" width="1" height="2" rx=".5" opacity=".4"/></g>
                </svg>
                <select class="ip-select" id="ip-justify">
                  <option>Start</option><option selected>Center</option><option>End</option>
                  <option>Space between</option><option>Space around</option>
                </select>
              </div>
            </div>
          </div>
          <div class="ip-row">
            <span class="ip-label">Wrap</span>
            <div class="ip-control"><div class="ip-pills ip-pills--icon ip-g3" role="radiogroup" aria-label="Wrap">
              <button type="button" role="radio" aria-checked="true" data-label="No wrap"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="1" y="5.5" width="3.4" height="3" rx="1"/><rect x="5.3" y="5.5" width="3.4" height="3" rx="1"/><rect x="9.6" y="5.5" width="3.4" height="3" rx="1"/></svg><span class="ip-pl">No wrap</span></button>
              <button type="button" role="radio" aria-checked="false" data-label="Wrap"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="1" y="2" width="5" height="3.4" rx="1"/><rect x="7" y="2" width="5" height="3.4" rx="1"/><rect x="1" y="8.6" width="5" height="3.4" rx="1"/></svg><span class="ip-pl">Wrap</span></button>
              <button type="button" role="radio" aria-checked="false" data-label="Reverse"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="7" y="2" width="5" height="3.4" rx="1"/><rect x="1" y="2" width="5" height="3.4" rx="1" opacity=".45"/><rect x="7" y="8.6" width="5" height="3.4" rx="1"/></svg><span class="ip-pl">Reverse</span></button>
            </div></div>
          </div>
        </div>
      </section>

      <!-- ── SPACING ────────────────────────────────────────────────────── -->
      <section class="ip-section" id="sec-spacing" data-open="true" data-key="spacing">
        <button type="button" class="ip-section-head" aria-expanded="true">
          <span class="ip-caret">⌄</span>
          <span class="ip-section-name">Spacing</span>
          <span class="ip-summary" id="sum-spacing">8 / 12</span>
        </button>
        <div class="ip-section-body">
          <div class="ip-row">
            <span class="ip-label">Density</span>
            <div class="ip-control"><div class="ip-pills ip-pills--icon ip-g2" id="ip-density" role="radiogroup" aria-label="Density">
              <button type="button" role="radio" aria-checked="false" data-label="Compact" data-gap="4" data-pad="8"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="2" y="3.2" width="10" height="2" rx="1"/><rect x="2" y="6.1" width="10" height="2" rx="1"/><rect x="2" y="9" width="10" height="2" rx="1"/></svg><span class="ip-pl">Compact</span></button>
              <button type="button" role="radio" aria-checked="true" data-label="Default" data-gap="8" data-pad="12"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="2" y="2.4" width="10" height="2" rx="1"/><rect x="2" y="6" width="10" height="2" rx="1"/><rect x="2" y="9.6" width="10" height="2" rx="1"/></svg><span class="ip-pl">Default</span></button>
              <button type="button" role="radio" aria-checked="false" data-label="Comfy" data-gap="12" data-pad="16"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="2" y="1.6" width="10" height="2" rx="1"/><rect x="2" y="6" width="10" height="2" rx="1"/><rect x="2" y="10.4" width="10" height="2" rx="1"/></svg><span class="ip-pl">Comfy</span></button>
              <button type="button" role="radio" aria-checked="false" data-label="Spacious" data-gap="20" data-pad="24"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="2" y="1" width="10" height="1.8" rx=".9"/><rect x="2" y="6.1" width="10" height="1.8" rx=".9"/><rect x="2" y="11.2" width="10" height="1.8" rx=".9"/></svg><span class="ip-pl">Spacious</span></button>
            </div></div>
          </div>
          <div class="ip-row">
            <span class="ip-label">Gap / pad</span>
            <div class="ip-control">
              <div class="ip-field"><span class="ip-prefix">GAP</span><input id="ip-gap" value="8" size="1" inputmode="decimal"></div>
              <div class="ip-field"><span class="ip-prefix">PAD</span><input id="ip-pad" value="12" size="1" inputmode="decimal"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── STYLE ──────────────────────────────────────────────────────── -->
      <section class="ip-section" id="sec-style" data-open="true" data-key="style">
        <button type="button" class="ip-section-head" aria-expanded="true">
          <span class="ip-caret">⌄</span>
          <span class="ip-section-name">Style</span>
          <span class="ip-summary" id="sum-style">#189FDB · M · Soft</span>
        </button>
        <div class="ip-section-body">
          <div class="ip-row" data-kind-only="artboard">
            <span class="ip-label">Type</span>
            <div class="ip-control"><div class="ip-pills" id="ip-fillmode" role="radiogroup" aria-label="Background type">
              <button type="button" role="radio" aria-checked="true"  data-fill="solid">Color</button>
              <button type="button" role="radio" aria-checked="false" data-fill="gradient">Gradient</button>
              <button type="button" role="radio" aria-checked="false" data-fill="image">Image</button>
            </div></div>
          </div>
          <div class="ip-row" data-when="solid">
            <label class="ip-label" for="ip-fill">Fill</label>
            <div class="ip-control"><div class="ip-field">
              <button type="button" class="ip-swatch-btn" id="ip-fill" style="background:#189FDB" aria-label="Fill color, Kite blue, #189FDB"></button>
              <span class="ip-hex">#189FDB</span>
              <span class="ip-suffix">100%</span>
            </div></div>
          </div>
          <div class="ip-swatches" data-when="solid" role="group" aria-label="Project palette">
            <button type="button" class="ip-transparent" aria-label="Transparent" aria-pressed="false"></button>
            <button type="button" style="background:#ffffff" aria-label="White, #FFFFFF" aria-pressed="false"></button>
            <button type="button" style="background:#f3f3f5" aria-label="Neutral 100, #F3F3F5" aria-pressed="false"></button>
            <button type="button" style="background:#131316" aria-label="Ink, #131316" aria-pressed="false"></button>
            <button type="button" style="background:#9B6BFF" aria-label="Violet Flash, #9B6BFF" aria-pressed="false"></button>
            <button type="button" style="background:#189FDB" aria-label="Kite blue, #189FDB" aria-pressed="true"></button>
            <button type="button" style="background:#4BE3A4" aria-label="Success, #4BE3A4" aria-pressed="false"></button>
            <button type="button" style="background:#E5484D" aria-label="Danger, #E5484D" aria-pressed="false"></button>
            <button type="button" class="ip-more" aria-label="More colors">+</button>
          </div>
          <div class="ip-row" data-when="gradient">
            <span class="ip-label">Stops</span>
            <div class="ip-control"><div class="ip-field">
              <button type="button" class="ip-swatch-btn" style="background:#9B6BFF" aria-label="Stop 1"></button>
              <button type="button" class="ip-swatch-btn" style="background:#189FDB" aria-label="Stop 2"></button>
              <span class="ip-hex" style="font-family:var(--ip-sans);font-weight:400;color:var(--ip-fg-faint)">Linear · 180°</span>
            </div></div>
          </div>
          <div class="ip-row" data-when="image">
            <span class="ip-label">Image</span>
            <div class="ip-control"><div class="ip-field">
              <span class="ip-hex" style="font-family:var(--ip-sans);font-weight:400;color:var(--ip-fg-faint)">Drop an image or browse</span>
            </div></div>
          </div>
          <div class="ip-row" data-kind-only="element">
            <label class="ip-label" for="ip-text">Text</label>
            <div class="ip-control"><div class="ip-field">
              <button type="button" class="ip-swatch-btn" id="ip-text" style="background:#1e1e21" aria-label="Text color, Ink, #1E1E21"></button>
              <span class="ip-hex">#1E1E21</span>
              <span class="ip-suffix">100%</span>
            </div></div>
          </div>
          <div class="ip-row">
            <label class="ip-label" for="ip-border">Border</label>
            <div class="ip-control">
              <div class="ip-field" style="flex:1">
                <button type="button" class="ip-swatch-btn" id="ip-border" style="background:#d6d6dc" aria-label="Border color, #D6D6DC"></button>
                <span class="ip-hex">#D6D6DC</span>
              </div>
              <div class="ip-field" style="width:70px"><span class="ip-prefix">W</span><input value="1" size="1" inputmode="decimal"></div>
            </div>
          </div>

          <div class="ip-subgroup">
            <div class="ip-row">
              <span class="ip-label">Radius</span>
              <div class="ip-control"><div class="ip-pills ip-pills--icon ip-g3" id="ip-radius" role="radiogroup" aria-label="Radius">
                <button type="button" role="radio" aria-checked="false" data-label="None" data-r="0"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 11.5V2.5h9"/></svg><span class="ip-pl">None</span></button>
                <button type="button" role="radio" aria-checked="false" data-label="S" data-r="4"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 11.5V4.5a2 2 0 0 1 2-2h7"/></svg><span class="ip-pl">S</span></button>
                <button type="button" role="radio" aria-checked="true" data-label="M" data-r="8"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 11.5V6a3.5 3.5 0 0 1 3.5-3.5h5.5"/></svg><span class="ip-pl">M</span></button>
                <button type="button" role="radio" aria-checked="false" data-label="L" data-r="16"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 11.5V7.5a5 5 0 0 1 5-5h4"/></svg><span class="ip-pl">L</span></button>
                <button type="button" role="radio" aria-checked="false" data-label="Full" data-r="999"><svg class="ip-i" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7" cy="7" r="4.6"/></svg><span class="ip-pl">Full</span></button>
              </div></div>
            </div>
            <div class="ip-row" id="ip-radius-custom" hidden>
              <span class="ip-label">Custom</span>
              <div class="ip-control"><div class="ip-field" style="width:96px">
                <span class="ip-prefix">R</span><input id="ip-radius-val" value="11" size="1" inputmode="decimal">
              </div></div>
            </div>
            <div class="ip-row">
              <label class="ip-label" for="ip-shadow">Shadow</label>
              <div class="ip-control">
                <select class="ip-select" id="ip-shadow">
                  <option>None</option><option selected>Soft</option><option>Raised</option><option>Overlay</option>
                </select>
              </div>
            </div>
            <div class="ip-row">
              <label class="ip-label" for="ip-opacity">Opacity</label>
              <div class="ip-control"><div class="ip-field" style="width:96px">
                <input id="ip-opacity" value="100" size="1" inputmode="decimal"><span class="ip-suffix">%</span>
              </div></div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── CONTENT (component only) ───────────────────────────────────── -->
      <section class="ip-section" id="sec-content" data-open="true" data-key="content" data-kind-only="component">
        <button type="button" class="ip-section-head" aria-expanded="true">
          <span class="ip-caret">⌄</span>
          <span class="ip-section-name">Content</span>
          <span class="ip-summary" id="sum-content">Assistant · 4 props</span>
        </button>
        <div class="ip-section-body">
          <div class="ip-row" style="align-items:flex-start">
            <label class="ip-label" for="ip-msg" style="padding-top:8px">Message</label>
            <div class="ip-control"><div class="ip-field" style="height:auto; padding:8px 9px">
              <textarea id="ip-msg" rows="3" style="flex:1;border:0;outline:0;background:none;resize:vertical;font:400 12.5px/1.5 var(--ip-sans);color:var(--ip-fg)">Added a 'Create New Scenario' button, a label for existing scenarios, and a vertical list of scenario cards.</textarea>
            </div></div>
          </div>
          <div class="ip-row">
            <label class="ip-label" for="ip-sender">Sender</label>
            <div class="ip-control">
              <select class="ip-select" id="ip-sender">
                <option>User</option><option selected>Assistant</option><option>System</option>
              </select>
            </div>
          </div>
          <div class="ip-switch-row">
            <div class="ip-switch-copy">
              <div class="ip-switch-title">Own message</div>
              <div class="ip-switch-help" id="ip-own-help">Aligns right, accent fill</div>
            </div>
            <button type="button" class="ip-switch" role="switch" aria-checked="false"
                    aria-describedby="ip-own-help" aria-label="Own message"></button>
          </div>
          <div class="ip-row">
            <label class="ip-label" for="ip-ts">Time <span class="ip-optional">optional</span></label>
            <div class="ip-control"><div class="ip-field">
              <input id="ip-ts" value="" placeholder="10:42 AM">
            </div></div>
          </div>
        </div>
      </section>

    </div>

    <!-- nothing selected → palette owns the rail -->
    <div class="ip-rail" id="ip-rail" hidden>
      <div class="ip-rail-head">
        <div class="ip-field" style="width:100%">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" style="color:var(--ip-fg-subtle)" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/>
          </svg>
          <input placeholder="Search 32 components" aria-label="Search components"
                 style="font-family:var(--ip-sans);font-weight:400;font-size:14px">
          <kbd style="font:600 10px/1 var(--ip-mono);color:var(--ip-fg-faint);border:1px solid var(--ip-line-strong);border-radius:4px;padding:3px 5px">⌘K</kbd>
        </div>
      </div>
      <div class="ip-rail-group">
        <span class="ip-rail-dot" style="background:#6D5AA8"></span>
        <span class="ip-rail-name">Controls</span>
        <span class="ip-rail-count">8</span>
      </div>
      <div class="ip-rail-rows">
        <div class="ip-rail-row"><span class="ip-rail-tile">BTN</span><span class="ip-rail-label">Button</span><span class="ip-rail-desc">Action button</span></div>
        <div class="ip-rail-row"><span class="ip-rail-tile">INP</span><span class="ip-rail-label">TextInput</span><span class="ip-rail-desc">Input field</span></div>
        <div class="ip-rail-row"><span class="ip-rail-tile">SEL</span><span class="ip-rail-label">Select</span><span class="ip-rail-desc">Dropdown</span></div>
        <div class="ip-rail-row"><span class="ip-rail-tile">SWT</span><span class="ip-rail-label">Switch</span><span class="ip-rail-desc">On / off</span></div>
      </div>
      <p class="ip-rail-hint">Select a node on the canvas to inspect it.</p>
    </div>
  </aside>

  <div class="demo-canvas"></div>
</div>

<script>
(function () {
  const panel  = document.getElementById('ip');
  const header = panel.querySelector('.ip-header');
  const index  = document.getElementById('ip-index');
  const body   = document.getElementById('ip-body');
  const rail   = document.getElementById('ip-rail');
  const name   = document.getElementById('ip-name');
  const chip   = document.getElementById('ip-kindchip');
  const crumbs = document.getElementById('ip-crumbs');
  const unlock = document.getElementById('ip-unlock');
  const sections = [...panel.querySelectorAll('.ip-section')];

  /* ── collapse state, remembered PER KIND ───────────────────────────────
     This is what makes a single pane survive past week one: collapse Style on a
     component once, and every component you select next opens the same way. */
  const KEY = 'kiteframe.inspect.collapse';
  let collapsed = {};
  try { collapsed = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}

  const kindOf = () => panel.dataset.kind;
  const isCollapsed = (k) => !!(collapsed[kindOf()] || {})[k];
  const setCollapsed = (k, on) => {
    collapsed[kindOf()] = Object.assign({}, collapsed[kindOf()], { [k]: on });
    try { localStorage.setItem(KEY, JSON.stringify(collapsed)); } catch (e) {}
  };
  const paintCollapse = () => {
    sections.forEach(sec => {
      const open = !isCollapsed(sec.dataset.key);
      sec.dataset.open = String(open);
      sec.querySelector('.ip-section-head').setAttribute('aria-expanded', String(open));
      sec.querySelector('.ip-caret').textContent = open ? '⌄' : '›';
    });
  };
  sections.forEach(sec => {
    sec.querySelector('.ip-section-head').addEventListener('click', () => {
      const k = sec.dataset.key;
      setCollapsed(k, !isCollapsed(k));
      paintCollapse();
    });
  });

  /* ── section index: jump + expand, and follow the scroll ───────────────── */
  index.addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    const key = btn.dataset.jump;
    const sec = sections.find(s => s.dataset.key === key);
    if (!sec) return;
    if (isCollapsed(key)) { setCollapsed(key, false); paintCollapse(); }
    body.scrollTop = Math.max(0, sec.offsetTop - body.offsetTop - 8);
    markCurrent(key);
  });
  const markCurrent = key => [...index.children].forEach(b =>
    b.setAttribute('aria-current', String(b.dataset.jump === key)));
  body.addEventListener('scroll', () => {
    const top = body.scrollTop + body.offsetTop + 24;
    let cur = sections[0];
    sections.forEach(s => { if (s.offsetParent !== null && s.offsetTop <= top) cur = s; });
    markCurrent(cur.dataset.key);
  });

  /* ── collapsed-header summaries ───────────────────────────────────────── */
  const val = id => document.getElementById(id).value;
  const activePill = groupId => {
    const g = document.getElementById(groupId);
    const on = g && [...g.children].find(b => b.getAttribute('aria-checked') === 'true');
    return on ? (on.dataset.label || on.textContent.trim()) : '—';
  };
  const paintSummaries = () => {
    const auto = document.querySelectorAll('.ip-auto')[1].getAttribute('aria-pressed') === 'true';
    document.getElementById('sum-layout').textContent =
      (val('ip-w') || 'auto') + ' × ' + (auto ? 'auto' : (val('ip-h-val') || 'auto'));
    document.getElementById('sum-spacing').textContent = val('ip-gap') + ' / ' + val('ip-pad');
    document.getElementById('sum-style').textContent =
      panel.querySelector('#sec-style .ip-hex').textContent + ' · ' +
      activePill('ip-radius') + ' · ' + document.getElementById('ip-shadow').value;
    document.getElementById('sum-content').textContent =
      document.getElementById('ip-sender').value + ' · 4 props';
  };

  /* ── disclosure ───────────────────────────────────────────────────────── */
  document.getElementById('ip-pos').addEventListener('change', e => {
    panel.dataset.position = e.target.value;   /* seed X/Y from measured offset here */
  });
  const fillmode = document.getElementById('ip-fillmode');
  fillmode.addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    [...fillmode.children].forEach(b => b.setAttribute('aria-checked', String(b === btn)));
    panel.dataset.fill = btn.dataset.fill;
  });

  /* ── pills, presets, switches, swatches ───────────────────────────────── */
  panel.querySelectorAll('.ip-pills[role="radiogroup"]').forEach(group => {
    if (group === fillmode) return;
    group.addEventListener('click', e => {
      const btn = e.target.closest('button'); if (!btn) return;
      [...group.children].forEach(b => b.setAttribute('aria-checked', String(b === btn)));
      if (group.id === 'ip-density') {
        document.getElementById('ip-gap').value = btn.dataset.gap;
        document.getElementById('ip-pad').value = btn.dataset.pad;
      }
      if (group.id === 'ip-radius') document.getElementById('ip-radius-custom').hidden = true;
      paintSummaries();
    });
  });
  const DENSITY = { Compact: [4, 8], Default: [8, 12], Comfy: [12, 16], Spacious: [20, 24] };
  const syncDensity = () => {
    const gap = +val('ip-gap'), pad = +val('ip-pad');
    [...document.getElementById('ip-density').children].forEach(b => {
      const d = DENSITY[b.dataset.label];
      b.setAttribute('aria-checked', String(!!d && d[0] === gap && d[1] === pad));
    });
    paintSummaries();
  };
  ['ip-gap', 'ip-pad'].forEach(id => document.getElementById(id).addEventListener('input', syncDensity));
  document.getElementById('ip-shadow').addEventListener('change', paintSummaries);
  const jGlyph = document.getElementById('ip-justify-glyph');
  const paintJustify = () => {
    const v = document.getElementById('ip-justify').value;
    [...jGlyph.children].forEach(g => { g.style.display = g.dataset.v === v ? 'block' : 'none'; });
  };
  document.getElementById('ip-justify').addEventListener('change', paintJustify);
  paintJustify();
  document.getElementById('ip-sender').addEventListener('change', paintSummaries);

  panel.querySelectorAll('.ip-auto').forEach(btn => {
    const input = btn.parentElement.querySelector('input');
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      if (on) { input.value = ''; input.placeholder = '—'; }
      paintSummaries();
    });
    input.addEventListener('input', () => {
      if (input.value) btn.setAttribute('aria-pressed', 'false');
      paintSummaries();
    });
  });
  panel.querySelectorAll('.ip-swatches').forEach(row => {
    row.addEventListener('click', e => {
      const btn = e.target.closest('button'); if (!btn || btn.classList.contains('ip-more')) return;
      [...row.children].forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    });
  });
  panel.querySelectorAll('[role="switch"]').forEach(sw => {
    sw.addEventListener('click', () => {
      /* mixed → all on, never "match the majority" */
      const next = sw.getAttribute('aria-checked') === 'true' ? 'false' : 'true';
      sw.setAttribute('aria-checked', next);
    });
  });

  /* ── numbers: ↑↓ ±1, ⇧ ±10, ⌥ ±.1; math on commit; prefix-drag scrub ──── */
  panel.querySelectorAll('.ip-field input[inputmode="decimal"]').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const stepBy = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
      const v = parseFloat(input.value || '0');
      input.value = String(+(v + (e.key === 'ArrowUp' ? stepBy : -stepBy)).toFixed(2));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    input.addEventListener('change', () => {
      const raw = input.value.trim();
      if (/^[\d+\-*/.\s()]+$/.test(raw) && /[+\-*/]/.test(raw)) {
        try { const out = Function('"use strict";return (' + raw + ')')();
              if (typeof out === 'number' && isFinite(out)) input.value = String(+out.toFixed(2)); }
        catch (err) {}
      }
      syncDensity();
    });
    const prefix = input.parentElement.querySelector('.ip-prefix');
    if (!prefix) return;
    prefix.addEventListener('pointerdown', e => {
      e.preventDefault();
      const x0 = e.clientX, v0 = parseFloat(input.value || '0');
      const move = ev => { input.value = String(Math.round(v0 + (ev.clientX - x0))); syncDensity(); };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
  });

  /* ── selection swap ───────────────────────────────────────────────────── */
  const SELECTIONS = {
    component: { kind: 'element', name: 'ChatMessage', chip: 'element', crumbs: ['ChatMessage', 'Chat', 'Editor View'], locked: false },
    artboard:  { kind: 'frame',   name: 'Editor View - Configuration', chip: 'frame', crumbs: ['Editor View - Configuration'], locked: false },
    multi:     { kind: 'mixed',   name: '3 selected', chip: 'mixed', crumbs: ['Card', 'Chat', 'Editor View'], locked: false, mixed: true },
    locked:    { kind: 'element', name: 'ChatMessage', chip: 'locked', crumbs: ['ChatMessage', 'Chat'], locked: true },
    none:      { empty: true }
  };
  const showRail = () => {
    header.hidden = true; index.hidden = true; body.hidden = true; rail.hidden = false;
    document.querySelectorAll('.demo-bar button').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.sel === 'none')));
  };
  document.getElementById('ip-deselect').addEventListener('click', showRail);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !e.target.matches('input, textarea')) showRail();
  });

  document.querySelectorAll('.demo-bar button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.demo-bar button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      const s = SELECTIONS[btn.dataset.sel];
      const isEmpty = !!s.empty;
      header.hidden = isEmpty; index.hidden = isEmpty; body.hidden = isEmpty; rail.hidden = !isEmpty;
      if (isEmpty) return;
      panel.dataset.kind = s.kind;
      panel.dataset.locked = String(s.locked);
      panel.dataset.multi = String(!!s.mixed);
      unlock.hidden = !s.locked;
      name.textContent = s.name;
      chip.textContent = s.chip; chip.dataset.kind = s.chip;
      crumbs.innerHTML = s.crumbs.slice().reverse()
        .map(c => '<button type="button">' + c + '</button>')
        .join('<span class="ip-sep">/</span>');
      panel.querySelectorAll('.ip-hex').forEach(el => {
        el.dataset.was = el.dataset.was || el.textContent;
        el.classList.toggle('ip-mixed', !!s.mixed);
        el.textContent = s.mixed ? 'Mixed' : el.dataset.was;
      });
      panel.querySelectorAll('.ip-field input[inputmode="decimal"]').forEach(el => {
        el.dataset.was = el.dataset.was || el.value;
        el.placeholder = s.mixed ? 'Mixed' : '—';
        el.value = s.mixed ? '' : el.dataset.was;
      });
      panel.querySelectorAll('[role="switch"]').forEach(sw =>
        sw.setAttribute('aria-checked', s.mixed ? 'mixed' : 'false'));
      paintCollapse();          /* collapse memory is per kind */
      paintSummaries();
      body.scrollTop = 0;
    });
  });

  paintCollapse();
  paintSummaries();
})();
</script>
</body>
</html>

```

---

# Part 5 — Reference code: component palette

Save as `builder-panel-1b.html`. List and grid views, mini previews, search,
filter chips.

```html

<!DOCTYPE html>
<!--
  Kiteframe — Builder left rail (option 1b, "Search-first")
  Handoff code. Open this file directly to see it render standalone.

  Graphite alignment: these token VALUES match THEME.md (Graphite · Light).
  THEME.md is authoritative for color; this file is authoritative for geometry,
  structure and behavior. When porting, map each local token to its THEME.md
  variable rather than copying the hex:
    --*-chrome → --background      --*-line        → --border
    --*-raised → --card            --*-line-strong → --input
    --*-subtle → --muted           --*-fg          → --foreground
    --*-track  → --accent          --*-fg-muted    → --muted-foreground
    --*-ink    → --primary         --*-accent      → --brand
    --*-info   → --info            --*-canvas      → --kf-canvas
  Dark mode: swap in the .dark values from THEME.md §3-4. The canvas stays LIGHT
  and artboards are never themed — THEME.md §4.

  Contents
    1. Tokens            :root custom properties — map to your theme layer
    2. Panel shell       .bp-panel (370px, header + scroller)
    3. Header            search field + icon-only view toggle + filter chips
    4. Recent strip      hide entirely when empty
    5. Grouped scroller  sticky category headers, list rows, grid cells
    6. Behavior          the 30 lines of JS the static markup needs

  Notes for the port
    - Every measurement here is the one from the design. Don't round them.
    - Icons are inline SVG at 13-14px with stroke-width 1.6 (currentColor), so the
      active/inactive color of the view toggle is ONE property on the parent button.
    - Glyph tiles (BTN, INP, SEL) are deliberate: they render at any size, need no
      screenshot pipeline, and stay legible in the 32x24 list tile. Don't swap them
      for mini-previews.
    - Group headers use position:sticky inside the scroller. The scroller must NOT
      have overflow-x or a transform, or sticky silently dies.
    - Only structural styles are here. Drag-and-drop, keyboard nav and search
      scoring live in README.md §3.4-3.5.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<title>Builder left rail — 1b</title>
<style>
/* ─── 1. Tokens ─────────────────────────────────────────────────────────── */
:root {
  --bp-chrome:      #FBFBFC;   /* NOT pure white — artboards must separate */
  --bp-raised:      #ffffff;   /* cards, inputs, active segmented item */
  --bp-subtle:      #f3f3f5;   /* glyph tiles, search field on dark chrome */
  --bp-hover:       #f3f3f5;
  --bp-track:       #eeeef1;   /* segmented-control track */
  --bp-chip:        #f3f3f5;

  --bp-line:        #e4e4e8;   /* panel dividers */
  --bp-line-soft:   #eeeef1;
  --bp-line-strong: #d6d6dc;   /* input borders */
  --bp-line-tile:   #e4e4e8;

  --bp-fg:          #1e1e21;
  --bp-fg-muted:    #54545c;
  --bp-fg-subtle:   #77777f;
  --bp-fg-faint:    #9a9aa3;

  --bp-ink:         #131316;   /* primary action */
  --bp-accent:      #9B6BFF;   /* Violet Flash — selection + focus only */   /* active chip fill (ink) */
  --bp-accent-fg:   #1A1030;   /* dark ink ON violet — white fails AA */
  --bp-ink-fg:      #ffffff;
  --bp-info:        #189FDB;   /* Kite blue — links, category: controls */

  --bp-r-sm: 6px;
  --bp-r:    8px;
  --bp-r-lg: 9px;
  --bp-shadow-raise: 0 1px 2px rgba(0,0,0,.07);

  --bp-sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --bp-mono: ui-monospace, "SF Mono", Menlo, monospace;

  /* category markers */
  --bp-cat-layout:     #5b6b8c;
  --bp-cat-typography: #6d5aa8;
  --bp-cat-controls:   #189FDB;   /* Kite blue, not the generic builder blue */
  --bp-cat-data:       #2b7a6b;
  --bp-cat-media:      #a06520;
  --bp-cat-feedback:   #a33b52;
}

/* ─── 2. Panel shell ────────────────────────────────────────────────────── */
.bp-panel {
  width: 370px;   /* must equal the properties panel — the rail must not
                     reflow when a canvas selection swaps its contents */
  flex: none;
  display: flex;
  flex-direction: column;
  min-height: 0;                       /* required: lets the scroller shrink */
  background: var(--bp-chrome);
  border-right: 1px solid var(--bp-line);
  font-family: var(--bp-sans);
  -webkit-font-smoothing: antialiased;
}
.bp-panel *, .bp-panel *::before, .bp-panel *::after { box-sizing: border-box; }

/* ─── 3. Header ─────────────────────────────────────────────────────────── */
.bp-header {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 16px 12px;
}

.bp-search-row { display: flex; align-items: center; gap: 8px; }

.bp-search {
  flex: 1;
  min-width: 0;                        /* required or the ⌘K badge pushes out */
  height: 38px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 11px;
  background: var(--bp-raised);
  border: 1px solid var(--bp-line-strong);
  border-radius: var(--bp-r-lg);
  box-shadow: 0 1px 2px rgba(20,20,24,.04);
}
.bp-search:focus-within { border-color: var(--bp-fg); box-shadow: 0 0 0 3px rgba(30,30,33,.07); }
.bp-search svg { flex: none; color: var(--bp-fg-subtle); }
.bp-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: none;
  font: 400 14px/1 var(--bp-sans);
  color: var(--bp-fg);
}
.bp-search input::placeholder { color: var(--bp-fg-faint); }
.bp-kbd {
  flex: none;
  font: 600 10px/1 var(--bp-mono);
  color: var(--bp-fg-faint);
  border: 1px solid var(--bp-line-strong);
  border-radius: 4px;
  padding: 3px 5px;
}

/* icon-only view toggle, inline right of the search field */
.bp-toggle {
  flex: none;
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--bp-track);
  border-radius: var(--bp-r);
}
.bp-toggle button {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--bp-r-sm);
  background: none;
  color: var(--bp-fg-faint);
  cursor: pointer;
}
.bp-toggle button[aria-pressed="true"] {
  background: var(--bp-raised);
  color: var(--bp-fg);
  box-shadow: var(--bp-shadow-raise);
}
.bp-toggle button:focus-visible { outline: 2px solid var(--bp-accent); outline-offset: 2px; }

/* filter chips — own row, single-select */
.bp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.bp-chip {
  padding: 5px 10px;
  border: 1px solid var(--bp-line-tile);
  border-radius: 999px;
  background: var(--bp-chip);
  font: 500 12px/1 var(--bp-sans);
  color: var(--bp-fg-muted);
  cursor: pointer;
}
.bp-chip[aria-checked="true"] {
  background: var(--bp-ink);
  border-color: var(--bp-ink);
  color: var(--bp-ink-fg);
  font-weight: 600;
}

/* ─── 4. Recent strip ───────────────────────────────────────────────────── */
.bp-recent { padding: 0 16px 10px; }
.bp-eyebrow {
  font: 700 10px/1 var(--bp-sans);
  letter-spacing: .11em;
  color: var(--bp-fg-faint);
  margin-bottom: 8px;
}
.bp-recent-row { display: flex; gap: 6px; }
.bp-recent-row button {
  flex: 1;
  padding: 7px 9px;
  border: 1px solid var(--bp-line-tile);
  border-radius: var(--bp-r);
  background: none;
  font: 600 12px/1 var(--bp-sans);
  color: var(--bp-fg);
  text-align: center;
  cursor: grab;
}
.bp-recent-row button:hover { background: var(--bp-hover); }

/* ─── 5. Grouped scroller ───────────────────────────────────────────────── */
.bp-scroller {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  border-top: 1px solid var(--bp-line-soft);
}
.bp-scroller::-webkit-scrollbar { width: 8px; }
.bp-scroller::-webkit-scrollbar-thumb { background: #d6d6dc; border-radius: 8px; }

.bp-group-header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 8px;
  background: rgba(251,251,252,.94);   /* --bp-chrome at 94% */
  backdrop-filter: blur(6px);
  border-bottom: 1px solid #eeeef1;
}
.bp-dot { width: 7px; height: 7px; flex: none; border-radius: 999px; }
.bp-group-name {
  font: 700 11px/1 var(--bp-sans);
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--bp-fg-muted);
}
.bp-group-count { font: 500 11px/1 var(--bp-mono); color: var(--bp-fg-faint); }

/* list view */
.bp-list { padding: 6px 10px 12px; display: flex; flex-direction: column; gap: 1px; }
.bp-row {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 7px 8px;
  border-radius: var(--bp-r);
  cursor: grab;
}
.bp-row:hover { background: var(--bp-hover); }
.bp-row:active { cursor: grabbing; }
.bp-row:focus-visible { outline: 2px solid var(--bp-accent); outline-offset: -2px; }
.bp-tile {
  width: 32px;
  height: 24px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bp-subtle);
  border: 1px solid var(--bp-line-tile);
  border-radius: 5px;
  font: 600 9px/1 var(--bp-mono);
  color: var(--bp-fg-faint);
}
.bp-row-name { flex: 1; font: 500 13px/1.3 var(--bp-sans); color: var(--bp-fg); }
.bp-row-desc { font: 400 11px/1.3 var(--bp-sans); color: var(--bp-fg-faint); }

/* grid view */
.bp-grid {
  padding: 10px 14px 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 12px;
}
.bp-cell { display: flex; flex-direction: column; gap: 7px; cursor: grab; }
.bp-cell:active { cursor: grabbing; }
.bp-cell-preview {
  position: relative;
  height: 78px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #e9e9ec;
  border: 1px solid transparent;
  border-radius: 10px;
  font: 600 11px/1 var(--bp-mono);
  letter-spacing: .09em;
  color: var(--bp-fg-faint);
}

/* ── Previews ──────────────────────────────────────────────────────────────
   Resolution order per component: authored mini markup -> live render -> glyph.
   Rules: no state, no data, no color. Monochrome strokes on the tile bg, so the
   grid doesn't turn into a fruit salad and fight the category dots.

   (a) AUTHORED MINI — for atoms. Drawn at the tile's true size, so it stays
       crisp and costs nothing at runtime. 3-4 lines per component. */
.bp-mini { pointer-events: none; color: #a5a5ad; }
.bp-mini-btn {
  width: 54px; height: 22px; border-radius: 6px;
  background: #d8d8dd;
}
.bp-mini-input {
  width: 62px; height: 22px; border-radius: 5px;
  border: 1.5px solid #d2d2da; background: #fff;
  display: flex; align-items: center; padding: 0 6px;
}
.bp-mini-input::before { content: ""; width: 2px; height: 11px; background: #c4c4cc; }
.bp-mini-select {
  width: 62px; height: 22px; border-radius: 5px;
  border: 1.5px solid #d2d2da; background: #fff;
  display: flex; align-items: center; justify-content: flex-end; padding: 0 6px;
}
.bp-mini-select::after {
  content: ""; width: 6px; height: 6px; margin-bottom: 2px;
  border-right: 1.5px solid #a5a5ad; border-bottom: 1.5px solid #a5a5ad;
  transform: rotate(45deg);
}
.bp-mini-check { display: flex; align-items: center; gap: 6px; }
.bp-mini-check::before {
  content: ""; width: 14px; height: 14px; border-radius: 3px;
  border: 1.5px solid #d2d2da; background: #fff;
}
.bp-mini-check::after { content: ""; width: 30px; height: 4px; border-radius: 2px; background: #dcdce2; }
.bp-mini-switch {
  width: 30px; height: 17px; border-radius: 999px; background: #d8d8dd;
  display: flex; align-items: center; justify-content: flex-end; padding: 0 2px;
}
.bp-mini-switch::after { content: ""; width: 13px; height: 13px; border-radius: 999px; background: #fff; }
.bp-mini-stack, .bp-mini-hstack { display: flex; gap: 4px; }
.bp-mini-stack { flex-direction: column; }
.bp-mini-stack span, .bp-mini-hstack span { border-radius: 3px; background: #dcdce2; }
.bp-mini-stack span { width: 46px; height: 9px; }
.bp-mini-hstack span { width: 14px; height: 30px; }
.bp-mini-grid { display: grid; grid-template-columns: repeat(3, 14px); gap: 4px; }
.bp-mini-grid span { height: 14px; border-radius: 3px; background: #dcdce2; }
.bp-mini-section {
  width: 58px; height: 34px; border-radius: 5px;
  border: 1.5px dashed #cfcfd6;
}
.bp-mini-divider { width: 54px; height: 1.5px; background: #d2d2da; }
.bp-mini-resize { display: flex; gap: 3px; align-items: stretch; }
.bp-mini-resize span:first-child { width: 22px; height: 32px; border-radius: 4px; background: #dcdce2; }
.bp-mini-resize span:last-child  { width: 32px; height: 32px; border-radius: 4px; background: #e6e6ec; }

/*   (b) LIVE RENDER — for composites (Table, Calendar, Chart, Card). Mount the
       real component in the stage and scale it. One source of truth, but it
       costs a mount per cell: virtualize the scroller past ~60 cells, and pass
       short previewProps — 12px copy at scale(.34) is 4px of mush. */
.bp-preview-stage {
  position: absolute; top: 50%; left: 50%;
  width: 240px; height: 160px;
  transform: translate(-50%, -50%) scale(.34);
  transform-origin: center;
  pointer-events: none;
}
.bp-cell:hover .bp-cell-preview { background: #e4e4e8; border-color: var(--bp-line-strong); }
.bp-cell-meta { display: flex; flex-direction: column; gap: 1px; }
.bp-cell-name { font: 600 12.5px/1.2 var(--bp-sans); color: var(--bp-fg); }
.bp-cell-desc { font: 400 11px/1.3 var(--bp-sans); color: var(--bp-fg-faint); }

/* view switching */
.bp-panel[data-view="list"] .bp-grid,
.bp-panel[data-view="grid"] .bp-list { display: none; }

/* empty state */
.bp-empty { padding: 40px 20px; text-align: center; }
.bp-empty p { margin: 0 0 8px; font: 400 13px/1.5 var(--bp-sans); color: var(--bp-fg-subtle); }
.bp-empty button {
  border: 0; background: none; padding: 0; cursor: pointer;
  font: 500 12.5px/1 var(--bp-sans); color: var(--bp-info);
}

/* demo chrome only — delete when porting */
body { margin: 0; background: #ececeb; display: flex; height: 100vh; }
.demo-canvas { flex: 1; background: #e9e9ec;
  background-image: radial-gradient(#dedeD8 1px, transparent 1px); background-size: 16px 16px; }
</style>
</head>
<body>

<aside class="bp-panel" data-view="list" aria-label="Components">

  <!-- 3. Header -->
  <div class="bp-header">
    <div class="bp-search-row">
      <label class="bp-search">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/>
        </svg>
        <input type="search" id="bp-search" placeholder="Search 32 components" aria-label="Search components">
        <kbd class="bp-kbd">⌘K</kbd>
      </label>

      <div class="bp-toggle" role="group" aria-label="View">
        <button type="button" id="bp-view-list" aria-label="List view" aria-pressed="true">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
            <path d="M1 3h12M1 7h12M1 11h12"/>
          </svg>
        </button>
        <button type="button" id="bp-view-grid" aria-label="Grid view" aria-pressed="false">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <rect x="1" y="1" width="5" height="5" rx="1.5"/><rect x="8" y="1" width="5" height="5" rx="1.5"/>
            <rect x="1" y="8" width="5" height="5" rx="1.5"/><rect x="8" y="8" width="5" height="5" rx="1.5"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="bp-chips" role="radiogroup" aria-label="Filter by category">
      <button type="button" class="bp-chip" role="radio" aria-checked="true"  data-filter="all">All</button>
      <button type="button" class="bp-chip" role="radio" aria-checked="false" data-filter="layout">Layout</button>
      <button type="button" class="bp-chip" role="radio" aria-checked="false" data-filter="typography">Typography</button>
      <button type="button" class="bp-chip" role="radio" aria-checked="false" data-filter="controls">Controls</button>
      <button type="button" class="bp-chip" role="radio" aria-checked="false" data-filter="data">Data</button>
      <button type="button" class="bp-chip" role="radio" aria-checked="false" data-filter="media">Media</button>
      <button type="button" class="bp-chip" role="radio" aria-checked="false" data-filter="feedback">Feedback</button>
    </div>
  </div>

  <!-- 4. Recent — render nothing at all when the list is empty -->
  <div class="bp-recent" id="bp-recent">
    <div class="bp-eyebrow">RECENT</div>
    <div class="bp-recent-row">
      <button type="button" draggable="true">Button</button>
      <button type="button" draggable="true">Stack</button>
      <button type="button" draggable="true">Table</button>
    </div>
  </div>

  <!-- 5. Scroller: one <section> per category -->
  <div class="bp-scroller" id="bp-scroller">

    <section aria-labelledby="bp-g-layout">
      <div class="bp-group-header">
        <span class="bp-dot" style="background: var(--bp-cat-layout)"></span>
        <span class="bp-group-name" id="bp-g-layout">Layout</span>
        <span class="bp-group-count">6</span>
      </div>
      <div class="bp-list" role="list">
        <div class="bp-row" role="listitem" tabindex="0" draggable="true" data-id="section">
          <span class="bp-tile">SEC</span><span class="bp-row-name">Section</span><span class="bp-row-desc">Flex container</span>
        </div>
        <div class="bp-row" role="listitem" tabindex="0" draggable="true" data-id="stack">
          <span class="bp-tile">STK</span><span class="bp-row-name">Stack</span><span class="bp-row-desc">Vertical stack</span>
        </div>
        <div class="bp-row" role="listitem" tabindex="0" draggable="true" data-id="hstack">
          <span class="bp-tile">HST</span><span class="bp-row-name">HStack</span><span class="bp-row-desc">Horizontal stack</span>
        </div>
        <div class="bp-row" role="listitem" tabindex="0" draggable="true" data-id="grid">
          <span class="bp-tile">GRD</span><span class="bp-row-name">Grid</span><span class="bp-row-desc">Column grid</span>
        </div>
        <div class="bp-row" role="listitem" tabindex="0" draggable="true" data-id="resizable">
          <span class="bp-tile">RSZ</span><span class="bp-row-name">Resizable</span><span class="bp-row-desc">Split panels</span>
        </div>
        <div class="bp-row" role="listitem" tabindex="0" draggable="true" data-id="divider">
          <span class="bp-tile">DIV</span><span class="bp-row-name">Divider</span><span class="bp-row-desc">Rule line</span>
        </div>
      </div>
      <div class="bp-grid" role="list">
        <div class="bp-cell" role="listitem" tabindex="0" draggable="true" data-id="section">
          <div class="bp-cell-preview"><div class="bp-mini bp-mini-section"></div></div>
          <div class="bp-cell-meta"><div class="bp-cell-name">Section</div><div class="bp-cell-desc">Flex container</div></div>
        </div>
        <div class="bp-cell" role="listitem" tabindex="0" draggable="true" data-id="stack">
          <div class="bp-cell-preview"><div class="bp-mini bp-mini-stack"><span></span><span></span><span></span></div></div>
          <div class="bp-cell-meta"><div class="bp-cell-name">Stack</div><div class="bp-cell-desc">Vertical stack</div></div>
        </div>
        <div class="bp-cell" role="listitem" tabindex="0" draggable="true" data-id="hstack">
          <div class="bp-cell-preview"><div class="bp-mini bp-mini-hstack"><span></span><span></span><span></span></div></div>
          <div class="bp-cell-meta"><div class="bp-cell-name">HStack</div><div class="bp-cell-desc">Horizontal stack</div></div>
        </div>
        <div class="bp-cell" role="listitem" tabindex="0" draggable="true" data-id="grid">
          <div class="bp-cell-preview"><div class="bp-mini bp-mini-grid"><span></span><span></span><span></span><span></span><span></span><span></span></div></div>
          <div class="bp-cell-meta"><div class="bp-cell-name">Grid</div><div class="bp-cell-desc">Column grid</div></div>
        </div>
        <div class="bp-cell" role="listitem" tabindex="0" draggable="true" data-id="resizable">
          <div class="bp-cell-preview"><div class="bp-mini bp-mini-resize"><span></span><span></span></div></div>
          <div class="bp-cell-meta"><div class="bp-cell-name">Resizable</div><div class="bp-cell-desc">Split panels</div></div>
        </div>
        <div class="bp-cell" role="listitem" tabindex="0" draggable="true" data-id="divider">
          <div class="bp-cell-preview"><div class="bp-mini bp-mini-divider"></div></div>
          <div class="bp-cell-meta"><div class="bp-cell-name">Divider</div><div class="bp-cell-desc">Rule line</div></div>
        </div>
      </div>
    </section>

    <section aria-labelledby="bp-g-controls">
      <div class="bp-group-header">
        <span class="bp-dot" style="background: var(--bp-cat-controls)"></span>
        <span class="bp-group-name" id="bp-g-controls">Controls</span>
        <span class="bp-group-count">8</span>
      </div>
      <div class="bp-list" role="list">
        <div class="bp-row" role="listitem" tabindex="0" draggable="true" data-id="button">
          <span class="bp-tile">BTN</span><span class="bp-row-name">Button</span><span class="bp-row-desc">Action button</span>
        </div>
        <div class="bp-row" role="listitem" tabindex="0" draggable="true" data-id="textinput">
          <span class="bp-tile">INP</span><span class="bp-row-name">TextInput</span><span class="bp-row-desc">Input field</span>
        </div>
        <div class="bp-row" role="listitem" tabindex="0" draggable="true" data-id="select">
          <span class="bp-tile">SEL</span><span class="bp-row-name">Select</span><span class="bp-row-desc">Dropdown</span>
        </div>
        <div class="bp-row" role="listitem" tabindex="0" draggable="true" data-id="checkbox">
          <span class="bp-tile">CHK</span><span class="bp-row-name">Checkbox</span><span class="bp-row-desc">Toggle option</span>
        </div>
        <div class="bp-row" role="listitem" tabindex="0" draggable="true" data-id="switch">
          <span class="bp-tile">SWT</span><span class="bp-row-name">Switch</span><span class="bp-row-desc">On / off</span>
        </div>
      </div>
      <div class="bp-grid" role="list">
        <div class="bp-cell" role="listitem" tabindex="0" draggable="true" data-id="button">
          <div class="bp-cell-preview"><div class="bp-mini bp-mini-btn"></div></div>
          <div class="bp-cell-meta"><div class="bp-cell-name">Button</div><div class="bp-cell-desc">Action button</div></div>
        </div>
        <div class="bp-cell" role="listitem" tabindex="0" draggable="true" data-id="textinput">
          <div class="bp-cell-preview"><div class="bp-mini bp-mini-input"></div></div>
          <div class="bp-cell-meta"><div class="bp-cell-name">TextInput</div><div class="bp-cell-desc">Input field</div></div>
        </div>
        <div class="bp-cell" role="listitem" tabindex="0" draggable="true" data-id="select">
          <div class="bp-cell-preview"><div class="bp-mini bp-mini-select"></div></div>
          <div class="bp-cell-meta"><div class="bp-cell-name">Select</div><div class="bp-cell-desc">Dropdown</div></div>
        </div>
        <div class="bp-cell" role="listitem" tabindex="0" draggable="true" data-id="checkbox">
          <div class="bp-cell-preview"><div class="bp-mini bp-mini-check"></div></div>
          <div class="bp-cell-meta"><div class="bp-cell-name">Checkbox</div><div class="bp-cell-desc">Toggle option</div></div>
        </div>
        <div class="bp-cell" role="listitem" tabindex="0" draggable="true" data-id="switch">
          <div class="bp-cell-preview"><div class="bp-mini bp-mini-switch"></div></div>
          <div class="bp-cell-meta"><div class="bp-cell-name">Switch</div><div class="bp-cell-desc">On / off</div></div>
        </div>
      </div>
    </section>

  </div>
</aside>

<div class="demo-canvas"></div>

<script>
/* ─── 6. Behavior ─────────────────────────────────────────────────────────
   Port these five handlers; everything else above is static markup. */
(function () {
  const panel    = document.querySelector('.bp-panel');
  const search   = document.getElementById('bp-search');
  const btnList  = document.getElementById('bp-view-list');
  const btnGrid  = document.getElementById('bp-view-grid');

  /* view toggle — persist so it survives reload */
  function setView(view) {
    panel.dataset.view = view;
    btnList.setAttribute('aria-pressed', String(view === 'list'));
    btnGrid.setAttribute('aria-pressed', String(view === 'grid'));
    try { localStorage.setItem('builder.panelView', view); } catch (e) {}
  }
  let saved = 'list';
  try { saved = localStorage.getItem('builder.panelView') || 'list'; } catch (e) {}
  setView(saved);
  btnList.addEventListener('click', () => setView('list'));
  btnGrid.addEventListener('click', () => setView('grid'));

  /* filter chips — single-select; clicking the active chip returns to All */
  panel.querySelectorAll('.bp-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const wasOn = chip.getAttribute('aria-checked') === 'true';
      const next  = wasOn ? 'all' : chip.dataset.filter;
      panel.querySelectorAll('.bp-chip').forEach(c =>
        c.setAttribute('aria-checked', String(c.dataset.filter === next)));
      /* your render pass filters the group list here */
    });
  });

  /* ⌘K / Ctrl+K focuses and selects the query */
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); search.focus(); search.select();
    }
    if (e.key === 'Escape' && document.activeElement === search) {
      if (search.value) { search.value = ''; /* re-render */ } else { search.blur(); }
    }
  });

  /* drag out to the canvas */
  panel.querySelectorAll('[draggable="true"]').forEach(el => {
    el.addEventListener('dragstart', e => {
      const id = el.dataset.id || el.textContent.trim().toLowerCase();
      e.dataTransfer.setData('application/x-component', id);
      e.dataTransfer.effectAllowed = 'copy';
    });
  });

  /* click or Enter inserts at canvas center — cheaper than drag for keyboard */
  panel.querySelectorAll('.bp-row, .bp-cell').forEach(el => {
    const insert = () => console.log('insert', el.dataset.id);
    el.addEventListener('click', insert);
    el.addEventListener('keydown', e => { if (e.key === 'Enter') insert(); });
  });
})();
</script>
</body>
</html>

```

---

# Part 6 — Reference code: canvas toolbar

Save as `canvas-toolbar-bottom.html`. Bottom dock, Design and Preview modes.

```html

<!DOCTYPE html>
<!--
  Kiteframe — floating canvas toolbar (option 1b), docked BOTTOM
  Handoff code. Open this file directly to see it render standalone.

  Graphite alignment: these token VALUES match THEME.md (Graphite · Light).
  THEME.md is authoritative for color; this file is authoritative for geometry,
  structure and behavior. When porting, map each local token to its THEME.md
  variable rather than copying the hex:
    --*-chrome → --background      --*-line        → --border
    --*-raised → --card            --*-line-strong → --input
    --*-subtle → --muted           --*-fg          → --foreground
    --*-track  → --accent          --*-fg-muted    → --muted-foreground
    --*-ink    → --primary         --*-accent      → --brand
    --*-info   → --info            --*-canvas      → --kf-canvas
  Dark mode: swap in the .dark values from THEME.md §3-4. The canvas stays LIGHT
  and artboards are never themed — THEME.md §4.

  Contents
    1. Tokens          :root custom properties — same set as builder-panel-1b.html
    2. Dock            .kf-toolbar-dock — the positioning layer (bottom center)
    3. Toolbar         .kf-toolbar — the pill itself
    4. Controls        button / divider / stepper / segmented
    5. Preview mode    data-mode="preview" swaps the control set, no re-mount
    6. Behavior        zoom stops, keyboard shortcuts, mode switch

  Bottom-dock specifics (the reason this file exists)
    - Dock is a pointer-events:none overlay so the canvas stays draggable
      underneath; only .kf-toolbar re-enables pointer events. Without this the
      full-width dock eats every click in the bottom band of the canvas.
    - Shadow is inverted for a bottom dock: light comes from above, so the shadow
      lifts UPWARD (0 -6px 20px) instead of dropping down.
    - Menus open UPWARD. .kf-menu is bottom:calc(100% + 8px), and any dropdown you
      add must do the same or it renders off-canvas.
    - Bottom inset is 20px, not 16px: a bottom-docked bar sits closer to the
      window edge, and 16px reads as cramped against the viewport bottom.
    - Reserve the band. The canvas needs 76px of bottom padding when it fits
      content (Fit / ⇧1), or artboards land under the bar.

  Non-negotiable
    Every direct child of .kf-toolbar needs flex:none and white-space:nowrap.
    Without it the labels wrap inside their own pills on a narrow canvas — the
    single most common way this component breaks.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<title>Canvas toolbar — bottom dock</title>
<style>
/* ─── 1. Tokens ─────────────────────────────────────────────────────────── */
:root {
  --kf-chrome:      #FBFBFC;   /* NOT pure white — artboards must separate */
  --kf-raised:      #ffffff;   /* menus, active segmented item */
  --kf-track:       #eeeef1;
  --kf-hover:       #f3f3f5;

  --kf-line:        #e4e4e8;
  --kf-line-strong: #d6d6dc;

  --kf-fg:          #1e1e21;
  --kf-fg-muted:    #54545c;
  --kf-fg-subtle:   #54545c;
  --kf-fg-faint:    #9a9aa3;
  --kf-fg-disabled: #c4c4cc;

  --kf-ink:         #131316;   /* primary action fill */
  --kf-ink-fg:      #ffffff;
  --kf-accent:      #9B6BFF;   /* Violet Flash — focus rings only, never a fill */
  --kf-info:        #189FDB;   /* Kite blue — links */

  --kf-r-sm: 7px;
  --kf-r:    8px;
  --kf-r-lg: 12px;
  /* bottom dock: shadow lifts upward */
  --kf-shadow: 0 -6px 20px rgba(20,20,24,.12);
  --kf-shadow-raise: 0 1px 2px rgba(0,0,0,.07);

  --kf-sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --kf-mono: ui-monospace, "SF Mono", Menlo, monospace;
}

/* ─── 2. Dock ───────────────────────────────────────────────────────────── */
.kf-toolbar-dock {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 20px;
  z-index: 20;
  display: flex;
  justify-content: center;
  pointer-events: none;          /* required: canvas stays draggable underneath */
}
.kf-toolbar-dock > * { pointer-events: auto; }

/* ─── 3. Toolbar ────────────────────────────────────────────────────────── */
.kf-toolbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 44px;
  padding: 0 8px;
  background: var(--kf-raised);
  border: 1px solid var(--kf-line-strong);
  border-radius: var(--kf-r-lg);
  box-shadow: var(--kf-shadow);
  font-family: var(--kf-sans);
  white-space: nowrap;
  max-width: calc(100% - 32px);
}
.kf-toolbar *, .kf-toolbar *::before, .kf-toolbar *::after { box-sizing: border-box; }
/* the rule that keeps it from breaking */
.kf-toolbar > * { flex: none; white-space: nowrap; }

/* ─── 4. Controls ───────────────────────────────────────────────────────── */
.kf-btn {
  height: 30px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 0;
  border-radius: var(--kf-r);
  background: none;
  font: 500 12px/1 var(--kf-sans);
  color: var(--kf-fg-muted);
  cursor: pointer;
}
.kf-btn:hover { background: var(--kf-hover); }
.kf-btn svg { color: var(--kf-fg-faint); }

.kf-btn--primary {
  padding: 0 11px;
  background: var(--kf-ink);
  color: var(--kf-ink-fg);
  font-weight: 600;
}
.kf-btn--primary:hover { background: #24242a; }
.kf-btn--primary svg { color: currentColor; }

.kf-icon {
  width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--kf-r-sm);
  background: none;
  color: var(--kf-fg-subtle);
  cursor: pointer;
}
.kf-icon:hover { background: var(--kf-hover); }
.kf-icon:disabled { color: var(--kf-fg-disabled); cursor: default; background: none; }

.kf-btn:focus-visible,
.kf-icon:focus-visible,
.kf-seg button:focus-visible,
.kf-stepper button:focus-visible {
  outline: 2px solid var(--kf-accent);
  outline-offset: 2px;
}

.kf-divider { width: 1px; height: 18px; background: var(--kf-line); margin: 0 4px; }

/* zoom stepper — mono readout so the bar can't reflow between 30% and 100% */
.kf-stepper { display: flex; align-items: center; gap: 2px; }
.kf-stepper button {
  width: 24px; height: 28px;
  border: 0; border-radius: var(--kf-r-sm); background: none;
  color: var(--kf-fg-subtle); font: 400 14px/1 var(--kf-sans); cursor: pointer;
}
.kf-stepper button:hover { background: var(--kf-hover); }
.kf-zoom {
  width: 46px;
  text-align: center;
  font: 600 12px/1 var(--kf-mono);
  color: var(--kf-fg);
  background: none; border: 0; padding: 0;
  cursor: text;
}

/* segmented control */
.kf-seg { display: flex; gap: 2px; padding: 2px; background: var(--kf-track); border-radius: var(--kf-r); }
.kf-seg button {
  padding: 5px 10px;
  border: 0; border-radius: 6px; background: none;
  font: 500 11px/1.2 var(--kf-sans); color: var(--kf-fg-subtle); cursor: pointer;
}
.kf-seg button[aria-pressed="true"] {
  background: var(--kf-raised);
  color: var(--kf-fg);
  font-weight: 600;
  box-shadow: var(--kf-shadow-raise);
}

/* screen picker (preview mode) */
.kf-picker { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 10px;
  border: 0; border-radius: var(--kf-r); background: none; cursor: pointer;
  font: 600 12px/1 var(--kf-sans); color: var(--kf-fg); }
.kf-picker:hover { background: var(--kf-hover); }
.kf-picker .kf-caret { color: var(--kf-fg-faint); font-size: 10px; font-weight: 400; }
.kf-counter { width: 36px; text-align: center; font: 500 11px/1 var(--kf-mono); color: #77777f; }

/* menus open UPWARD from a bottom dock */
.kf-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 8px;
  min-width: 220px;
  background: var(--kf-raised);
  border: 1px solid var(--kf-line-strong);
  border-radius: 11px;
  box-shadow: 0 -10px 28px rgba(20,20,24,.16);
  padding: 5px;
  display: none;
}
.kf-menu[data-open="true"] { display: block; }
.kf-menu button {
  width: 100%; display: flex; align-items: center; gap: 9px;
  padding: 8px 9px; border: 0; border-radius: 7px; background: none;
  font: 500 12.5px/1 var(--kf-sans); color: var(--kf-fg); text-align: left; cursor: pointer;
}
.kf-menu button:hover { background: var(--kf-hover); }
.kf-menu kbd { margin-left: auto; font: 500 10px/1 var(--kf-mono); color: var(--kf-fg-faint); }

/* ─── 5. Preview mode ───────────────────────────────────────────────────── */
/* Design mode hides preview-only controls and vice versa. One attribute on the
   toolbar, so switching modes never re-mounts it. */
.kf-toolbar[data-mode="design"]  [data-only="preview"] { display: none; }
.kf-toolbar[data-mode="preview"] [data-only="design"]  { display: none; }

/* demo chrome only — delete when porting */
body { margin: 0; height: 100vh; background: #ececeb; font-family: var(--kf-sans); }
.demo-canvas {
  position: relative; height: 100%; overflow: hidden;
  background: #e9e9ec;
  background-image: radial-gradient(#dedeD8 1px, transparent 1px);
  background-size: 16px 16px;
  padding-bottom: 76px;                 /* reserve the toolbar band for Fit */
  display: flex; align-items: center; justify-content: center;
}
.demo-artboard { width: 420px; height: 280px; background: #fff;
  border: 1px solid #d6d6dc; border-radius: 6px; box-shadow: 0 6px 20px rgba(20,20,24,.07); }
.demo-hint { position: absolute; left: 16px; bottom: 26px;
  font: 400 11px/1 var(--kf-sans); color: #9a9aa3; }
</style>
</head>
<body>

<div class="demo-canvas">
  <div class="demo-artboard"></div>
  <div class="demo-hint">Scroll to zoom · Space+drag to pan</div>

  <!-- 2. Dock -->
  <div class="kf-toolbar-dock">
    <div class="kf-toolbar" id="kf-toolbar" data-mode="design" role="toolbar" aria-label="Canvas">

      <!-- design-only: add -->
      <button type="button" class="kf-btn kf-btn--primary" data-only="design" id="kf-add">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M6 1.5v9M1.5 6h9"/>
        </svg>
        Artboard
      </button>
      <button type="button" class="kf-btn" data-only="design" id="kf-import">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 9V1.5M3 4.5 6 1.5l3 3M1.5 10.5h9"/>
        </svg>
        Import
      </button>

      <div class="kf-divider" data-only="design"></div>

      <!-- design-only: history -->
      <button type="button" class="kf-icon" data-only="design" aria-label="Undo" title="Undo ⌘Z">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2.5 5.5h6a3 3 0 0 1 0 6H5"/><path d="M4.5 3 2.5 5.5 4.5 8"/>
        </svg>
      </button>
      <button type="button" class="kf-icon" data-only="design" aria-label="Redo" title="Redo ⇧⌘Z" disabled>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11.5 5.5h-6a3 3 0 0 0 0 6H9"/><path d="M9.5 3l2 2.5L9.5 8"/>
        </svg>
      </button>

      <!-- preview-only: screen picker + stepper -->
      <button type="button" class="kf-picker" data-only="preview" id="kf-picker" aria-haspopup="menu" aria-expanded="false">
        <span id="kf-screen-name">Editor View - Configuration</span>
        <span class="kf-caret" aria-hidden="true">▾</span>
      </button>
      <div class="kf-divider" data-only="preview"></div>
      <button type="button" class="kf-icon" data-only="preview" id="kf-prev" aria-label="Previous screen">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5 4 6.5l4 4"/></svg>
      </button>
      <span class="kf-counter" id="kf-counter">4/7</span>
      <button type="button" class="kf-icon" data-only="preview" id="kf-next" aria-label="Next screen">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 2.5l4 4-4 4"/></svg>
      </button>

      <div class="kf-divider"></div>

      <!-- zoom -->
      <div class="kf-stepper">
        <button type="button" id="kf-zoom-out" aria-label="Zoom out">−</button>
        <input class="kf-zoom" id="kf-zoom" value="30%" size="4" aria-label="Zoom level">
        <button type="button" id="kf-zoom-in" aria-label="Zoom in">+</button>
      </div>
      <button type="button" class="kf-btn" id="kf-fit" title="Fit to screen ⇧1">Fit</button>

      <div class="kf-divider"></div>

      <!-- mode -->
      <div class="kf-seg" role="group" aria-label="Mode">
        <button type="button" id="kf-mode-design"  aria-pressed="true">Design</button>
        <button type="button" id="kf-mode-preview" aria-pressed="false">Preview</button>
      </div>

      <!-- example upward-opening menu; wire to the picker or an overflow ⋯ -->
      <div class="kf-menu" id="kf-menu" role="menu" aria-labelledby="kf-picker">
        <button type="button" role="menuitem">User enters scenario builder</button>
        <button type="button" role="menuitem">Create New Scenario - Chat</button>
        <button type="button" role="menuitem">Editor View - Configuration <kbd>current</kbd></button>
        <button type="button" role="menuitem">Edit Existing Scenario - Chat View</button>
      </div>

    </div>
  </div>
</div>

<script>
/* ─── 6. Behavior ───────────────────────────────────────────────────────── */
(function () {
  const bar     = document.getElementById('kf-toolbar');
  const zoomEl  = document.getElementById('kf-zoom');
  const menu    = document.getElementById('kf-menu');
  const picker  = document.getElementById('kf-picker');
  const counter = document.getElementById('kf-counter');

  /* zoom: fixed stops, so − / + always land somewhere sane */
  const STOPS = [10, 25, 30, 50, 75, 100, 150, 200, 400];
  let zoom = 30, screen = 4, total = 7;

  const paint = () => { zoomEl.value = zoom + '%'; counter.textContent = screen + '/' + total; };
  const step = dir => {
    const i = STOPS.findIndex(s => (dir > 0 ? s > zoom : s >= zoom));
    zoom = dir > 0
      ? STOPS[i === -1 ? STOPS.length - 1 : i]
      : STOPS[Math.max(0, (i === -1 ? STOPS.length : i) - 1)];
    paint();
  };
  document.getElementById('kf-zoom-in').addEventListener('click', () => step(1));
  document.getElementById('kf-zoom-out').addEventListener('click', () => step(-1));
  zoomEl.addEventListener('change', () => {
    const n = parseInt(zoomEl.value, 10);
    zoom = isNaN(n) ? zoom : Math.min(400, Math.max(10, n));
    paint();
  });

  /* Fit: bounding box of all artboards + 64px, and remember the 76px toolbar band */
  document.getElementById('kf-fit').addEventListener('click', () => { zoom = 30; paint(); });

  /* mode — one attribute, no re-mount */
  const setMode = mode => {
    bar.dataset.mode = mode;
    document.getElementById('kf-mode-design').setAttribute('aria-pressed', String(mode === 'design'));
    document.getElementById('kf-mode-preview').setAttribute('aria-pressed', String(mode === 'preview'));
    if (mode === 'preview') { zoom = 100; paint(); }   /* preview means real size */
  };
  document.getElementById('kf-mode-design').addEventListener('click', () => setMode('design'));
  document.getElementById('kf-mode-preview').addEventListener('click', () => setMode('preview'));

  /* screen stepping (preview) — wraps */
  const stepScreen = d => { screen = ((screen - 1 + d + total) % total) + 1; paint(); };
  document.getElementById('kf-prev').addEventListener('click', () => stepScreen(-1));
  document.getElementById('kf-next').addEventListener('click', () => stepScreen(1));

  /* upward menu */
  picker.addEventListener('click', () => {
    const open = menu.dataset.open === 'true';
    menu.dataset.open = String(!open);
    picker.setAttribute('aria-expanded', String(!open));
  });
  document.addEventListener('click', e => {
    if (!menu.contains(e.target) && e.target !== picker) {
      menu.dataset.open = 'false'; picker.setAttribute('aria-expanded', 'false');
    }
  });

  /* shortcuts */
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea')) return;
    if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); zoom = 100; paint(); }
    if (e.shiftKey && e.key === '!')  { e.preventDefault(); zoom = 30; paint(); }   /* ⇧1 = Fit */
    if (e.shiftKey && e.key === 'E')  { e.preventDefault(); setMode(bar.dataset.mode === 'design' ? 'preview' : 'design'); }
    if (bar.dataset.mode === 'preview') {
      if (e.key === 'ArrowLeft')  stepScreen(-1);
      if (e.key === 'ArrowRight') stepScreen(1);
    }
  });

  paint();
})();
</script>
</body>
</html>

```

---

# Part 7 — Theme: Graphite light + dark

<!-- source: THEME.md -->

# Kiteframe — Graphite theming alignment

**Reconciles:** `Kiteframe Visual Styleguide` (prod) with the Graphite · Light /
Graphite · Dark mocks.
**Strategy:** express Graphite in the **existing shadcn variable names**. Add a
small scoped `--kf-*` layer only for things shadcn has no name for (canvas,
artboard, glyph tiles, category markers).

Do not introduce a second full token system. Your styleguide's instinct — "prefer
scoped editor tokens over changing the global application theme" — is right for
*geometry*, but wrong for *color*: if the editor gets warm neutrals and the rest of
the app keeps cool slate, the mismatch you're seeing becomes permanent. Graphite is
the product palette, so it belongs in `:root`.

---

## 1. Three naming collisions — resolve these before writing any CSS

These are the reason a naive port will look wrong.

| Name | shadcn's meaning (yours today) | Graphite's need | Resolution |
|---|---|---|---|
| `--accent` | **hover / selected surface** (`hsl(210,40%,96%)`) — a near-white gray | Violet Flash `#9B6BFF`, the brand accent | **Leave `--accent` alone.** It stays a hover surface. Violet goes in new `--brand` / `--brand-soft` / `--brand-strong`. Never rename `--accent` — every shadcn primitive uses it for hover. |
| `--primary` | primary button fill **and** `--ring` source (blue) | ink `#131316` for actions; violet for focus | **Split them.** `--primary` → ink. `--ring` → violet. They're currently the same blue, which is why focus and CTA are indistinguishable. |
| `--sidebar` | defined in `index.css` as `--sidebar` | — | **Bug:** `tailwind.config.ts` maps `sidebar.DEFAULT: "var(--sidebar-background)"`, which is never defined. Every `bg-sidebar` resolves to nothing. Fix the config to `var(--sidebar)` or add the alias. |

Naming contract going forward: `--primary` = action · `--brand` = identity and
selection · `--info` = information and structure · `--accent` = hover surface (a
shadcn word, not a design word).

---

## 2. Drop-in replacement — `:root` (light)

Same format as your file, HSL, same names. Only the values change unless marked
**NEW**.

```css
:root {
  /* ── surfaces ─────────────────────────────────────────────────────────── */
  --background:            hsl(240, 20%, 99%);   /* #FBFBFC — was 210 40% 98% */
  --foreground:            hsl(240, 5%, 12%);    /* #1E1E21 */
  --card:                  hsl(0, 0%, 100%);     /* unchanged */
  --card-foreground:       hsl(240, 5%, 12%);
  --popover:               hsl(0, 0%, 100%);
  --popover-foreground:    hsl(240, 5%, 12%);

  /* ── action (was blue) ────────────────────────────────────────────────── */
  --primary:               hsl(240, 8%, 8%);     /* #131316 ink */
  --primary-foreground:    hsl(0, 0%, 100%);
  --primary-hover:         hsl(240, 8%, 15%);    /* NEW — #24242A */

  /* ── quiet surfaces ───────────────────────────────────────────────────── */
  --secondary:             hsl(240, 9%, 96%);    /* #F3F3F5 */
  --secondary-foreground:  hsl(240, 5%, 12%);
  --muted:                 hsl(240, 9%, 96%);    /* #F3F3F5 */
  --muted-foreground:      hsl(240, 5%, 41%);    /* #54545C */
  --accent:                hsl(240, 9%, 96%);    /* hover surface — same as muted */
  --accent-foreground:     hsl(240, 5%, 12%);

  /* ── brand + information (NEW) ────────────────────────────────────────── */
  --brand:                 hsl(262, 100%, 71%);  /* #9B6BFF Violet Flash */
  --brand-foreground:      hsl(258, 55%, 12%);   /* #1A1030 — dark ink ON violet */
  --brand-soft:            hsl(255, 50%, 96%);   /* #F2EFFA */
  --brand-strong:          hsl(259, 66%, 55%);   /* #6D3FD6 — violet TEXT on soft */
  --info:                  hsl(197, 80%, 47%);   /* #189FDB Kite blue */
  --info-soft:             hsl(197, 88%, 95%);   /* #E6F6FD */

  /* ── status ───────────────────────────────────────────────────────────── */
  --destructive:           hsl(358, 75%, 59%);   /* #E5484D */
  --destructive-foreground:hsl(0, 0%, 100%);
  --destructive-soft:      hsl(0, 86%, 96%);     /* NEW */
  --success:               hsl(159, 82%, 34%);   /* NEW — #0F9D6B */
  --success-soft:          hsl(152, 68%, 92%);   /* NEW — #DEF7EC */
  --success-foreground:    hsl(159, 71%, 21%);   /* NEW — #0F5C42 */
  --warning:               hsl(40, 100%, 65%);   /* NEW — #FFC24B */
  --warning-soft:          hsl(42, 100%, 91%);   /* NEW — #FFF1D0 */
  --warning-foreground:    hsl(39, 100%, 27%);   /* NEW — #8A5A00 */

  /* ── lines + focus ────────────────────────────────────────────────────── */
  --border:                hsl(240, 9%, 90%);    /* #E4E4E8 — was 214 32% 91% */
  --border-soft:           hsl(240, 12%, 94%);   /* NEW — #EEEEF1, in-card rules */
  --input:                 hsl(240, 10%, 85%);   /* #D6D6DC — inputs need contrast */
  --ring:                  hsl(262, 100%, 71%);  /* violet, NOT --primary */

  /* ── charts: series 1 becomes Kite blue, rest re-hued off the palette ── */
  --chart-1:               hsl(197, 80%, 47%);   /* Kite blue */
  --chart-2:               hsl(262, 100%, 71%);  /* Violet Flash */
  --chart-3:               hsl(159, 82%, 34%);
  --chart-4:               hsl(40, 100%, 65%);
  --chart-5:               hsl(358, 75%, 59%);

  /* ── sidebar (rail) ───────────────────────────────────────────────────── */
  --sidebar:               hsl(240, 20%, 99%);   /* matches --background */
  --sidebar-background:    hsl(240, 20%, 99%);   /* alias — see §1 bug */
  --sidebar-foreground:    hsl(240, 5%, 12%);
  --sidebar-primary:       hsl(240, 8%, 8%);
  --sidebar-primary-foreground: hsl(0, 0%, 100%);
  --sidebar-accent:        hsl(255, 50%, 96%);   /* selected row = brand-soft */
  --sidebar-accent-foreground: hsl(259, 66%, 55%);
  --sidebar-border:        hsl(240, 9%, 90%);
  --sidebar-ring:          hsl(262, 100%, 71%);

  /* ── type ─────────────────────────────────────────────────────────────── */
  --font-sans:  Inter, system-ui, sans-serif;                  /* keep Inter */
  --font-mono:  ui-monospace, "SF Mono", Menlo, monospace;     /* ADD the first two */

  /* ── shadows: yours are alpha 0.00, i.e. invisible ────────────────────── */
  --shadow-2xs: 0 1px 1px rgba(20,20,18,.04);
  --shadow-xs:  0 1px 2px rgba(20,20,18,.05);
  --shadow-sm:  0 1px 2px rgba(0,0,0,.07);
  --shadow:     0 2px 6px rgba(20,20,18,.07);
  --shadow-md:  0 4px 12px rgba(20,20,18,.09);
  --shadow-lg:  0 8px 24px rgba(20,20,18,.12);
  --shadow-xl:  0 12px 30px rgba(20,20,18,.16);
  --shadow-2xl: 0 20px 48px rgba(20,20,18,.20);

  --radius: 8px;              /* unchanged */
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}
```

## 3. Drop-in replacement — `.dark`

Your current dark theme has two real problems this fixes: `--background` is pure
black (`hsl(0,0%,0%)`), which makes every border and card edge fight for contrast;
and `--secondary` is `hsl(195,15%,95%)` — a near-white surface inside a black
theme, almost certainly a leftover.

```css
.dark {
  --background:            hsl(240, 5%, 12%);    /* #1E1E21 — not black */
  --foreground:            hsl(60, 12%, 94%);    /* #F2F2EF */
  --card:                  hsl(240, 6%, 16%);    /* #26262A */
  --card-foreground:       hsl(60, 12%, 94%);
  --popover:               hsl(240, 6%, 16%);
  --popover-foreground:    hsl(60, 12%, 94%);

  --primary:               hsl(60, 12%, 94%);    /* #F4F4F1 — ink FLIPS */
  --primary-foreground:    hsl(240, 8%, 8%);
  --primary-hover:         hsl(0, 0%, 100%);

  --secondary:             hsl(240, 6%, 16%);    /* was near-white — fixed */
  --secondary-foreground:  hsl(60, 12%, 94%);
  --muted:                 hsl(240, 6%, 18%);    /* #2C2C31 */
  --muted-foreground:      hsl(60, 5%, 70%);     /* #B6B6AE */
  --accent:                hsl(240, 6%, 18%);    /* hover surface */
  --accent-foreground:     hsl(60, 12%, 94%);

  --brand:                 hsl(262, 100%, 71%);  /* identity does NOT shift hue */
  --brand-foreground:      hsl(255, 20%, 9%);
  --brand-soft:            hsl(252, 28%, 20%);   /* #2B2542 */
  --brand-strong:          hsl(258, 100%, 79%);  /* #B392FF — lightens on dark */
  --info:                  hsl(197, 100%, 65%);  /* #4CC9FF — brighter step */
  --info-soft:             hsl(197, 46%, 16%);

  --destructive:           hsl(358, 100%, 71%);  /* #FF6B6F */
  --destructive-foreground:hsl(240, 8%, 8%);
  --destructive-soft:      hsl(356, 33%, 17%);
  --success:               hsl(159, 74%, 59%);   /* #4BE3A4 */
  --success-soft:          hsl(159, 51%, 14%);
  --success-foreground:    hsl(159, 74%, 71%);
  --warning:               hsl(40, 100%, 65%);
  --warning-soft:          hsl(40, 53%, 15%);
  --warning-foreground:    hsl(40, 100%, 77%);

  --border:                hsl(240, 6%, 20%);    /* #303035 */
  --border-soft:           hsl(240, 6%, 18%);
  --input:                 hsl(240, 8%, 24%);    /* #3A3A40 */
  --ring:                  hsl(262, 100%, 71%);

  --chart-1: hsl(197,100%,65%); --chart-2: hsl(262,100%,71%);
  --chart-3: hsl(159,74%,59%);  --chart-4: hsl(40,100%,65%);
  --chart-5: hsl(358,100%,71%);

  --sidebar:               hsl(240, 5%, 12%);
  --sidebar-background:    hsl(240, 5%, 12%);
  --sidebar-foreground:    hsl(60, 12%, 94%);
  --sidebar-primary:       hsl(60, 12%, 94%);
  --sidebar-primary-foreground: hsl(240, 8%, 8%);
  --sidebar-accent:        hsl(252, 28%, 20%);
  --sidebar-accent-foreground: hsl(258, 100%, 79%);
  --sidebar-border:        hsl(240, 6%, 20%);
  --sidebar-ring:          hsl(262, 100%, 71%);
}
```

---

## 4. Scoped editor layer — the four things shadcn can't name

These are genuinely editor-specific and **must not** be `--background` /
`--muted`, because they don't invert the way app chrome does.

```css
:root {
  --kf-canvas:        hsl(240, 8%, 92%);   /* #E9E9EC design canvas */
  --kf-canvas-dot:    hsl(240, 8%, 87%);   /* #DEDED8-equivalent grid dot */
  --kf-canvas-preview:hsl(60, 8%, 93%);    /* #EFEFEC — preview backdrop */
  --kf-artboard:      hsl(0, 0%, 100%);    /* CONTENT. Never themed. */
  --kf-artboard-line: hsl(240, 9%, 87%);
  --kf-tile:          hsl(240, 9%, 96%);   /* glyph tile bg */
  --kf-tile-fill:     hsl(45, 8%, 84%);    /* #D8D8D0 mini-preview fills */
  --kf-tile-stroke:   hsl(45, 9%, 80%);    /* #D2D2CA mini-preview strokes */
}

.dark {
  --kf-canvas:        hsl(60, 6%, 91%);    /* STAYS LIGHT — see below */
  --kf-canvas-dot:    hsl(60, 6%, 84%);
  --kf-canvas-preview:hsl(60, 6%, 89%);
  --kf-artboard:      hsl(0, 0%, 100%);    /* unchanged, deliberately */
  --kf-artboard-line: hsl(240, 9%, 87%);
  --kf-tile:          hsl(240, 6%, 18%);
  --kf-tile-fill:     hsl(240, 6%, 26%);
  --kf-tile-stroke:   hsl(240, 6%, 30%);
}
```

**The dark-mode rule that matters most: the canvas stays light.** Artboards are
*content* — they render what the user ships — so they never invert. Three
consequences to enforce in review:

1. Anything inside an artboard uses literal colors, never theme tokens. An artboard
   that changes appearance with the app theme is a bug.
2. In-artboard buttons stay `#131316` on white in both modes. Only *toolbar*
   buttons flip with `--primary`.
3. `--kf-canvas-dot` darkens in dark mode so the grid stays visible against a light
   canvas inside dark chrome.

### Category / node-type markers

One set, used by **both** the workflow tree and the design layer tree — your
styleguide notes these currently disagree. Add to the `--kf-*` layer:

| Marker | Light | Dark | Applies to |
|---|---|---|---|
| `--kf-cat-layout` | `#5B6B8C` | `#8DA0C4` | frame, artboard |
| `--kf-cat-typography` | `#6D5AA8` | `#A492D8` | text, heading |
| `--kf-cat-controls` | `var(--info)` | `var(--info)` | step, input |
| `--kf-cat-data` | `#2B7A6B` | `#5FBFA8` | table, list |
| `--kf-cat-media` | `#A06520` | `#D69A4E` | image, icon |
| `--kf-cat-feedback` | `#A33B52` | `#D97A8E` | alert, badge |
| `--kf-node-process` | `var(--muted-foreground)` | same | `⚙` process |
| `--kf-node-decision` | `var(--warning)` | same | `◆` decision |
| `--kf-node-mockup` | `var(--brand)` | same | `▣` mockup |
| `--kf-node-exit` | `var(--destructive)` | same | `←` exit |

Note `controls` was `#2563EB` in the panel handoff — retire that hex; it's the
generic-builder blue. Use `--info`.

---

## 5. What each change does visually

| Variable | From | To | Effect |
|---|---|---|---|
| `--background` | `hsl(210,40%,98%)` cool | `hsl(240,20%,99%)` | Panels stop being cool-gray; white artboards still separate from chrome. **This one value accounts for most of the mismatch.** |
| `--primary` | blue `hsl(221,83%,53%)` | ink `hsl(240,8%,8%)` | Every primary button becomes near-black. Blue stops meaning "action". |
| `--ring` | same blue as primary | violet | Focus is finally distinguishable from a CTA. |
| `--border` | `hsl(214,32%,91%)` | `hsl(240,9%,90%)` | Borders lose the blue cast. |
| `--input` | same as `--border` | `hsl(240,10%,85%)` | Fields read as fields — your inputs currently disappear into cards. |
| `--muted-foreground` | `hsl(215,16%,47%)` slate | `hsl(240,5%,41%)` | Secondary copy warms and darkens slightly; better contrast. |
| `--shadow-*` | alpha `0.00` | real values | Toolbar, menus and cards actually elevate. Every `shadow-lg` in the app changes at once — check dialogs. |
| dark `--background` | `hsl(0,0%,0%)` | `hsl(240,5%,12%)` | Dark mode stops being pure black; borders become legible. |
| dark `--secondary` | near-white | `hsl(240,6%,16%)` | Fixes a light surface appearing in dark mode. |
| `--chart-1..5` | generic set | palette-derived | Charts stop introducing a sixth and seventh hue. |

---

## 6. Bugs found in the current CSS/config

1. **`bg-sidebar` is dead.** `tailwind.config.ts` → `sidebar.DEFAULT:
   "var(--sidebar-background)"`, but `index.css` defines `--sidebar`. Nothing
   resolves. Fix the config or add the alias (§2 does the latter).
2. **All eight shadow variables are alpha `0.00`.** They render nothing, which is
   why the toolbar and menus look flat against the canvas.
3. **`.dark --secondary: hsl(195,15%,95%)`** — a near-white surface in the dark
   theme. Any `bg-secondary` element is a white block in dark mode.
4. **`--ring` === `--primary`.** Focus rings and primary buttons are the same
   color, so keyboard focus on a primary button is invisible.
5. **`--font-mono: Menlo, monospace`** has no `ui-monospace`, so metric readouts
   fall back inconsistently across platforms — mono values are supposed to be the
   thing that *doesn't* shift width.

---

## 7. Class replacements

The token swap fixes most surfaces automatically. These need hand edits because the
current class is semantically wrong, not just the wrong value:

| Where | Now | Should be |
|---|---|---|
| Left rail, right rail, toolbar | `bg-background` | `bg-background` ✓ (correct once §2 lands) |
| Cards, inputs, menus, active segment | `bg-background` | `bg-card` |
| Canvas | `bg-background` or `bg-muted` | `bg-[var(--kf-canvas)]` — must not invert |
| Artboard | theme classes | `bg-[var(--kf-artboard)]` + literal border |
| Primary buttons | `bg-primary` | `bg-primary` ✓ (now ink) |
| Selected layer row | `bg-accent` | `bg-[var(--brand-soft)] text-[var(--brand-strong)]` |
| Active filter chip | `bg-primary` | `bg-brand text-[var(--brand-foreground)]` |
| Links, "More", breadcrumb hover | `text-primary` | `text-[var(--info)]` |
| Insight / suggestion cards | `bg-blue-50` / `bg-primary/10` | `bg-card border-border` — **outlined, never filled** |
| "Needs attention" flag | ad-hoc amber | `bg-[var(--warning-soft)] text-[var(--warning-foreground)]` |
| Glyph tile | `bg-muted` | `bg-[var(--kf-tile)]` |
| Focus | `focus-visible:ring-primary` | `focus-visible:ring-ring` (now violet) |

Add to `tailwind.config.ts` so these stop needing arbitrary-value syntax:

```ts
brand: {
  DEFAULT: "var(--brand)", foreground: "var(--brand-foreground)",
  soft: "var(--brand-soft)", strong: "var(--brand-strong)",
},
info:    { DEFAULT: "var(--info)",    soft: "var(--info-soft)" },
success: { DEFAULT: "var(--success)", soft: "var(--success-soft)", foreground: "var(--success-foreground)" },
warning: { DEFAULT: "var(--warning)", soft: "var(--warning-soft)", foreground: "var(--warning-foreground)" },
kf: {
  canvas: "var(--kf-canvas)", artboard: "var(--kf-artboard)",
  tile: "var(--kf-tile)",
},
```

---

## 8. Typography and geometry

Your styleguide already resolved the font question correctly: **keep Inter.** The
handoff files say Helvetica Neue only because they were written standalone —
they're geometry references, not a font decision. Do add `ui-monospace, "SF Mono"`
ahead of Menlo (§6.5).

| Context | Size / line-height / weight |
|---|---|
| Rail — section eyebrow | 10px / 1 / 700, `letter-spacing:.11em`, uppercase, `--muted-foreground` |
| Rail — group name | 11px / 1 / 700, `.09em`, uppercase |
| Rail — item name | 12.5–13px / 1.3 / 500–600 |
| Rail — description, metadata | 11px / 1.4 / 400 |
| Rail — search + primary field text | **14px** / 1 / 400 |
| Rail — panel title | 14px / 1 / 600 |
| Rail — doc/page title | 19–20px / 1.25 / 700 |
| Reader panel — body | **15px / 1.7 / 400** on a 400px measure |
| Reader panel — section heading | 18–19px / 1.3 / 600 |
| Reader panel — doc title | 24–30px / 1.15 / 600 |
| Any numeric value | `--font-mono`, always |

**Reader typography ≠ rail typography.** A 30px heading is right in the reader
panel and wrong in a 400px rail — the prod PRD view currently uses rail-width
containers with reader-sized headings, which is the other half of the visual drift.

Radius `6 / 8 / 10-12 / 999`. Control heights: 28 compact · 30 pills · 32 fields ·
38 search · 44 toolbar. Toolbar shadow inverts for a bottom dock
(`0 -6px 20px rgba(20,20,18,.12)`).

---

## 9. Migration order

Each step is independently shippable and reviewable.

1. **Fix the five bugs in §6.** No visual redesign, all upside. Do this first —
   the shadow fix alone will change how the current UI reads.
2. **Land `:root` + `.dark` from §2–3.** One commit, whole app. Screenshot-diff
   dialogs, dropdowns and toasts; they consume `--popover`, `--accent` and
   `--shadow-lg` and will all shift.
3. **Add the `--kf-*` layer (§4) and repoint the canvas + artboard.** This is what
   stops dark mode from inverting user content.
4. **Add the Tailwind color entries (§7)**, then work the class-replacement table.
5. **Unify the two icon-color systems** onto the §4 marker table.
6. **Type pass (§8)** — rail scale in rails, reader scale in the reader.

Order matters: doing 4 before 2 means writing arbitrary values twice.

---

## 10. Handoff file precedence

The three reference files now carry Graphite values, so nothing contradicts:

| File | Local tokens | Authoritative for |
|---|---|---|
| `builder-panel-1b.html` | `--bp-*` | left panel geometry, previews, search/toggle/chips behavior |
| `canvas-toolbar-bottom.html` | `--kf-*` | bottom dock, pointer-events split, zoom stops, mode switching |
| `inspect-panel-3ab.html` | `--ip-*` | row primitives, 56px gutter, tab memory, progressive disclosure |

**This document is authoritative for color. The HTML files are authoritative for
geometry, structure and behavior.** Each file's header carries the same mapping
from its local tokens to the variables in §2–4, so the port is a rename, not a
judgement call:

```
--*-chrome → --background      --*-line        → --border
--*-raised → --card            --*-line-strong → --input
--*-subtle → --muted           --*-fg          → --foreground
--*-track  → --accent          --*-fg-muted    → --muted-foreground
--*-ink    → --primary         --*-accent      → --brand
--*-info   → --info            --*-canvas      → --kf-canvas
```

The files ship light values only. For dark, swap in `.dark` from §3 — with the two
exceptions in §4: the canvas stays light, and artboards are never themed.

## 11. Two open decisions for you

1. **Does the marketing gradient stay?** `.kiteframe-ambient-gradient` uses cyan
   `#1AE4FF`, pink `#FD86E3`, purple `#5A1FFF`, red `#F42563` — none of which are
   in Graphite. Fine as a marketing-only surface, but it should not appear in
   product chrome, and `#5A1FFF` is close enough to Violet Flash to read as a
   sloppy near-miss. Either retune it to Violet Flash + Kite blue, or keep it
   strictly off-product.
2. **Is Preview mode's backdrop `--kf-canvas-preview`?** I've specified a slightly
   darker neutral than the design canvas so real-size artboards read as separate
   from the editor. Confirm that matches your intent for `?mode=preview`.
