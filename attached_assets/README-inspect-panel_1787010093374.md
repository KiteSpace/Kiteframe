# Inspect Panel — Implementation Guide

**Left-rail** inspector for the current **canvas** selection. Two states to build:
**component selected** (option `3a`) and **artboard selected** (option `3b`).
Reference design: turn 3 of `Builder Panel Redesign.dc.html`.

## 0. Where it lives, and what triggers it

The inspector **replaces the component palette in the left rail** when a node is
selected **on the canvas**. It is not a second panel and it is not on the right.

```
nothing selected        [ Components 320px ][ canvas ][ KiteAI/Layers rail ]
canvas selection        [ Properties 320px ][ canvas ][ KiteAI/Layers rail ]
```

### The trigger is canvas selection only

Clicking a row in the **Layers** panel does not take over the left rail. Layers is
a navigator: a click there reveals and highlights the node, scrolls it into view on
the canvas, and marks the row active — the left rail keeps showing Components.

```ts
type Selection = { nodeId: string; source: "canvas" | "layers" } | null;
const showInspector = sel?.source === "canvas";
```

Why: the two panels are on opposite sides of the screen. Making a click on the far
right silently replace the far left is a 1,400px-apart cause and effect, and it
means browsing the layer tree destroys the palette state you were mid-drag in.
Canvas clicks are local — the rail is right next to what you just touched.

Escalation to a canvas selection (and therefore the inspector) happens on
**double-click a layer row**, on **Enter** with a row focused, or on the next
click on that node on the canvas. If you later decide you want parity, it is one
flag — but ship it asymmetric first and see whether anyone asks.

### Four rules that follow

1. **320px, not 340px** — same width as the palette, border on the **right**.
   Selecting a node must never reflow the canvas or move an artboard under the
   cursor.
2. **There is no "nothing selected" empty state.** Deselecting shows the palette;
   the rail always has a job. Delete that placeholder from the plan.
3. **Three ways back**, all equivalent: the `‹ Components` link in the header, the
   `✕`, and `Escape`. Preserve the palette's scroll position, filter chip and view
   mode across the swap.
4. **The swap is a content change, not a mount.** Keep both trees mounted and
   toggle visibility, or the palette's search state and recents restart on every
   selection change.

Uses the same tokens as `README.md` (Design/Preview shell) — import them, don't
redefine. Panel width **320px**, matching the component palette it replaces.
Color values come from `THEME.md`; this document and the HTML are authoritative
for geometry and behavior.

**Working code:** `inspect-panel-3ab.html` renders every state in this spec
standalone (open it in a browser). Its demo bar switches between Component,
Artboard, Nothing, 3 selected and Locked. Port from that file; this document is
the why.

### Token set (final — supersedes any blue in earlier drafts)

```css
--ip-ink: #131316;         /* active pill fill, primary actions */
--ip-accent: #9B6BFF;      /* Violet Flash — selection + focus rings only */
--ip-accent-soft: #f2effa; /* Auto chip background */
--ip-accent-fg: #6D3FD6;   /* violet text on the soft fill */
--ip-info: #189FDB;        /* Kite blue — links, breadcrumb hover, Unlock */
--ip-gutter: 56px;         /* the label gutter. One number, everywhere. */
--ip-h: 32px;              /* control height; pills are 30px */
```

Accent is **never** a button fill in this panel — active pills are ink. A selected
state must never look like a call to action.

---

## 1. Why it's structured this way

The old panel put every property in one vertical scroll with uppercase gray
headers, so finding "gap" meant scrolling past 20 color swatches. Three fixes:

1. **Tabs, not scroll.** `Style · Layout · Content` — each tab fits in the panel
   height without scrolling for a typical selection.
2. **Label-left rows** on a fixed 56px gutter, so every control's left edge lines
   up in one column and the eye scans values, not labels.
3. **Progressive disclosure.** Properties that can't do anything are not rendered
   (X/Y in flow layout, gradient stops when fill is a solid color).

---

## 2. Tab model

```ts
type InspectTab = 'style' | 'layout' | 'content';

// Which tabs a selection gets, and what lands in each:
const TABS: Record<NodeKind, InspectTab[]> = {
  artboard:  ['style', 'layout'],              // no content — an artboard has no copy
  container: ['style', 'layout'],
  component: ['style', 'layout', 'content'],   // content = the component's own props
  text:      ['style', 'layout', 'content'],
};
```

- **Style** — fill, text color, border, radius, shadow, opacity.
- **Layout** — size, position, stack (direction/align/justify/wrap), spacing.
- **Content** — the selected component's declared props (`ComponentDef.props`),
  rendered from schema. This is the only tab that varies by component.

Rules:
- Remember the tab **per node kind**, not globally: selecting another ChatMessage
  keeps you on Content; clicking the artboard lands you on Layout.
- If the remembered tab doesn't exist for the new selection, fall back to the first
  available one.
- Tabs are a `role="tablist"`, arrow-key navigable, with `aria-selected`.

```jsx
const [tabByKind, setTabByKind] = useState({ artboard: 'layout', component: 'style' });
const tabs = TABS[node.kind];
const tab  = tabs.includes(tabByKind[node.kind]) ? tabByKind[node.kind] : tabs[0];
```

---

## 3. Header

```
Editor View / Chat / ChatMessage          ← 11px breadcrumb, ancestors clickable
ChatMessage   [element]                ×  ← 16px/600 name, kind chip, close
[ Style | Layout | Content ]              ← segmented tabs, 12px
```

- The breadcrumb replaces the old "← Back" button: it shows *where* you are and
  each ancestor is a click target, which "Back" could not do.
- Kind chip colors reuse the panel's category palette:
  `element → #6d5aa8 on #f2effa`, `frame → #2b7a6b on #e9f5f2`,
  `text → #a06520 on #fdf2e6`.
- Truncate long breadcrumbs from the **left** (`direction: rtl` trick or ellipsis on
  the middle segments) — the last segment must always be readable.
- `×` deselects (Escape does the same). Header is `position: sticky; top: 0`.
- **Multi-select:** header reads `3 selected` with a `mixed` chip; only properties
  shared by every node render, and a differing value shows `Mixed` as the field's
  placeholder. Editing it writes to all.

---

## 4. Row anatomy

Every property is one of five row types. Build them once, reuse everywhere.

```jsx
<Row label="Radius">…</Row>   // 56px label gutter, 12px/500 --fg-muted, 10px gap
```

Six primitives, all in `client/src/design/InspectRows.tsx`:

| Row type | Shape | Use for |
|---|---|---|
| **ColorRow** | 32px field: 16px swatch · hex mono · opacity % | fill, text, border color, background |
| **SwatchRow** | 8 × 22px swatches + dashed `+` | the curated palette under a ColorRow |
| **PillRow** | equal-width 30px pills, active = `#1c1c1e` fill | radius, direction, align, wrap, density |
| **SelectRow** | 32px field with `▾` | position, justify, shadow, sender |
| **NumberRow** | 32px field, mono value, prefix label (`W`, `H`, `X`, `Y`, `Gap`) | all numerics |
| **SwitchRow** | title + 11px helper text left, 38×22 switch right | booleans |

Fixed metrics: control height **32px** (30px for pills), border `--line-strong`,
radius 8px, field padding `0 9px`, row gap 10–12px, group gap 18px separated by a
1px `--line-soft` rule. Numbers and hex are **always mono** so values don't jitter
as they change.

### Color field behavior

```
[■] #2563EB            100%      ← click anywhere opens the picker popover
```

- The 8 swatches are the **project palette**, not a rainbow: transparent, white,
  two neutrals, and the four brand/semantic colors. `+` opens the full picker.
- Selected swatch gets a ring (`0 0 0 2px #fff, 0 0 0 3.5px #1c1c1e`), not a
  checkmark — a check hides the color it's confirming.
- Hex input accepts `#fff`, `fff`, `rgb()`; normalize on blur to 6-digit uppercase.
- Opacity is a separate scrubbable number, 0–100, no slider.
- Transparent renders as a 4px checkerboard, never as an empty box.

---

## 5. Layout tab

```jsx
<>
  <NumberPair a={{prefix:'W', value:w, auto:autoW}} b={{prefix:'H', …}} />
  {node.position === 'absolute' && <NumberPair a={{prefix:'X'}} b={{prefix:'Y'}} />}
  <SelectRow label="Position" value={position} options={['In flow','Absolute','Sticky']} />
  <Divider/>
  <Group eyebrow="STACK">
    <PillRow  label="Direction" options={['Column','Row']} />
    <PillRow  label="Align"     options={['Start','Center','End','Stretch']} />
    <SelectRow label="Justify"  options={['Start','Center','End','Space between','Space around']} />
    <PillRow  label="Wrap"      options={['No wrap','Wrap','Reverse']} />
  </Group>
  <Divider/>
  <Group eyebrow="SPACING" note="presets set gap + padding">
    <PillRow options={['Compact','Default','Comfortable','Spacious']} />
    <NumberPair a={{label:'Gap'}} b={{label:'Pad'}} />
  </Group>
</>
```

- **X/Y only when `position === 'absolute'`.** In flow they're dead controls; in the
  old panel they sat there grayed and confused people. When the user switches to
  Absolute, seed X/Y from the node's current measured offset so nothing jumps.
- **`Auto` affordance** lives inside the W/H field as a small chip. Active = accent
  chip on `#eaf1fe`; inactive = gray outline. Clicking `AUTO` clears the numeric
  value; typing a number clears `AUTO`.
- **Align uses words, not glyphs.** The old `|0o` / `0|0` icons weren't decodable;
  4 words fit the 340px panel fine. Justify has 5 options so it degrades to a
  select rather than 5 unreadable pills.
- **Density presets write the two fields below them** and stay highlighted only
  while gap+pad still match the preset:

```js
const DENSITY = { Compact:[4,8], Default:[8,12], Comfortable:[12,16], Spacious:[20,24] };
const activePreset = Object.keys(DENSITY).find(k => DENSITY[k][0] === gap && DENSITY[k][1] === pad);
// editing gap or pad by hand simply deselects all presets — no confirmation
```

### Number input behavior (all NumberRows)

| Interaction | Behavior |
|---|---|
| Type + `Enter` / blur | Commit. Invalid input reverts, no error state. |
| `↑` / `↓` | ±1. With `⇧` ±10. With `⌥` ±0.1. |
| Drag the prefix label | Scrub the value; `cursor: ew-resize` on hover. |
| Empty + `Enter` | Reset to the inherited/default value. |
| Math | Accept `12*2`, `100/3`, `8+4` and evaluate on commit. |
| Undo | One history entry per commit, not per keystroke. Coalesce scrubs into one entry on pointerup. |

---

## 6. Content tab (component props)

Rendered from the component's own schema — no hand-written panel per component.

```ts
type PropSchema =
  | { kind:'text';    label:string; multiline?:boolean; placeholder?:string }
  | { kind:'select';  label:string; options:string[] }
  | { kind:'boolean'; label:string; help?:string }
  | { kind:'number';  label:string; min?:number; max?:number; step?:number }
  | { kind:'color';   label:string };

// ChatMessage
props: {
  message:   { kind:'text',    label:'Message', multiline:true },
  sender:    { kind:'select',  label:'Sender', options:['User','Assistant','System'] },
  ownMessage:{ kind:'boolean', label:'Own message', help:'Aligns right, accent fill' },
  timestamp: { kind:'text',    label:'Timestamp', optional:true, placeholder:'10:42 AM' },
}
```

- Optional props get a small `optional` tag next to the label, in `#c2c2b8`.
- Booleans use the SwitchRow with helper text — a bare `Yes` next to a switch
  (as in the old panel) says nothing about what it does.
- Text edits are **live-bound with 200ms debounce** to the canvas node, so typing
  updates the artboard as you go. Undo coalesces a typing burst into one entry.
- Order props as declared in the registry; never alphabetize.

---

## 7. Style tab notes

- Order: Fill → Text → Border → (rule) → Radius → Shadow → Opacity.
- **Background type** (`Color / Gradient / Image`) is a segmented control on the
  artboard only, and it swaps the field beneath it — solid color, gradient stops, or
  image slot. Never render all three stacked.
- Radius pills `None / S / M / L / Full` map to your token scale
  (`0 / 4 / 8 / 16 / 999`), with a "Custom" state shown as a mono number if the node
  carries a value off the scale.
- Shadow is a named select (`None / Soft / Raised / Overlay`) that writes a token —
  do not expose x/y/blur/spread; nobody hand-tunes four numbers in a 340px panel.

---

## 8. Empty & error states

- **Nothing selected:** not an inspector state at all — the rail shows the
  component palette (§0). The palette may carry one quiet footer line, `Select a
  node on the canvas to inspect it`, but the inspector itself never renders empty.
- **Selected from Layers:** also not an inspector state — the layer row goes
  active and the canvas reveals the node; the rail stays on Components (§0).
- **Locked/hidden node:** header shows a `locked` chip and the body renders
  read-only (fields at 60% opacity, no focus ring), with a `Unlock to edit` text
  button in the header.
- **Mixed selection with no shared props:** `Nothing in common — narrow the
  selection`.

---

## 9. Build order

1. **The rail swap** — one `LeftRail` rendering Palette or Inspector from
   `selection.source === "canvas"`, both mounted, 320px either way. Do this first:
   it is the structural change, and everything else is content inside it.
2. `Row` primitives + tokens (ColorRow, SwatchRow, PillRow, NumberRow, SelectRow,
   SwitchRow, TextProp).
3. Header (back link, breadcrumb, chip, close) + tab bar with per-kind memory.
4. Layout tab — the tab people use most.
5. Style tab, with the palette from the project theme.
6. Content tab driven by `PropSchema`.
7. Number scrubbing, math input, undo coalescing.
8. Multi-select and locked states.

## 10. Accessibility

- Tabs: `role="tablist"` / `role="tab"` / `aria-selected`, panels `role="tabpanel"`
  labelled by their tab.
- Every row's label is a real `<label htmlFor>`; the 56px gutter is not a `<div>`.
- Pill groups are `role="radiogroup"`, arrow-key navigable, `aria-checked`.
- Swatches need `aria-label` with the color name **and** hex — color alone is not
  an accessible label.
- Switch: `role="switch"` + `aria-checked`; the helper text is wired via
  `aria-describedby`.
- Focus ring everywhere: `outline: 2px solid var(--accent); outline-offset: 2px`.
- The panel is keyboard-reachable from the canvas via `⇧Tab`; `Escape` inside a
  field reverts that field, a second `Escape` deselects and returns the rail to
  the palette (§0).
- Announce the swap: the rail is an `aria-live="polite"` region, or the inspector
  header takes focus on canvas selection, so a screen-reader user learns the left
  column changed jobs.

---

## 12. Multi-select

Selecting several nodes is a first-class state, not a degraded one. Marquee-select
four buttons and set their radius once — that's the job.

### Header

- Name reads `3 selected`; the kind chip reads the shared kind (`element`) or
  `mixed` when kinds differ.
- Breadcrumb shows the **nearest common ancestor**, not the first node's chain.
  Three buttons inside the same Card → `Card / Chat / Editor View`.
- A note bar under the header states the contract in words:
  *"Showing the 12 properties these 3 nodes share. Editing writes to all."*

### Which tabs

```ts
const kinds = new Set(selection.map(n => n.kind));
const tabs = kinds.size === 1 ? TABS[[...kinds][0]] : ['style', 'layout'];
```

Content requires one kind **and** one component type — three ChatMessages get a
Content tab; a ChatMessage plus a Button does not, even though both are elements.
Their prop schemas are different objects.

### Which properties

Render a property only if **every** selected node declares it. Intersection, not
union — a control that silently no-ops on 2 of 3 nodes is worse than an absent one.

| Situation | Rendering |
|---|---|
| All nodes share the value | Show the value normally |
| Values differ | `Mixed` — italic, sans (not mono), `--fg-faint` |
| Differ, numeric field | Empty input, `Mixed` placeholder; typing writes to all |
| Differ, pill / segmented | No pill active. Clicking one sets it on all |
| Differ, switch | Indeterminate: `aria-checked="mixed"`, knob centred, track `--line-strong`. First click turns **all on** |
| Differ, color | **Suppress the swatch grid.** A palette can't express three fills; the ColorRow shows `Mixed` and opens the picker, which then applies to all |
| Differ, text | Empty field, `Mixed` placeholder. Typing replaces on all — never appends |

### Editing rules

- **One history entry per edit, covering all nodes.** Setting radius on 4 nodes is
  one undo, not four. This is the most common multi-select bug.
- **Writes are absolute, not relative.** Setting W to 200 makes every node 200 —
  it does not add the delta. Relative nudging is `↑`/`↓` on the canvas, a
  different feature.
- **Editing a Mixed field commits that one property to all** and leaves every other
  Mixed property alone.
- **Auto and preset chips** apply to all: pressing `AUTO` on W clears the numeric
  width on every selected node.
- Mixed state recomputes after each edit — the field stops saying Mixed the moment
  values converge.

### Edge cases

- **No shared properties** (e.g. an artboard plus a text node): render the centered
  line `Nothing in common — narrow the selection`, keep the header, no tabs.
- **A locked node in the selection:** the panel is read-only, header shows the
  `locked` chip and `Unlock to edit`. Don't silently edit the unlocked subset.
- **Selection shrinks to one node:** transition to the normal single state, keeping
  the current tab if that kind allows it.
- **Selection made in the Layers panel** doesn't open the inspector at all (§0) —
  including a shift-click range. Only canvas marquee and canvas shift-click do.

---

## 13. Types

Everything the panel needs, so nobody invents a parallel shape.

```ts
type NodeKind = 'artboard' | 'container' | 'component' | 'text';
type InspectTab = 'style' | 'layout' | 'content';

type Selection = {
  nodes: SelectedNode[];             // 0 = palette, 1 = 3a/3b, 2+ = §12
  source: 'canvas' | 'layers';       // only 'canvas' opens the inspector (§0)
};

interface SelectedNode {
  id: string;
  kind: NodeKind;
  componentType?: string;            // 'ChatMessage' — required for the Content tab
  name: string;
  ancestors: { id: string; name: string }[];   // root-first; breadcrumb reverses
  locked?: boolean;
  hidden?: boolean;
}

type PropSchema =
  | { kind: 'text';    label: string; multiline?: boolean; placeholder?: string; optional?: boolean }
  | { kind: 'select';  label: string; options: string[];   optional?: boolean }
  | { kind: 'boolean'; label: string; help?: string;       optional?: boolean }
  | { kind: 'number';  label: string; min?: number; max?: number; step?: number; optional?: boolean }
  | { kind: 'color';   label: string; optional?: boolean };

// value shared across a multi-selection, or the Mixed sentinel
const MIXED = Symbol('mixed');
type Value<T> = T | typeof MIXED;
```

Token scales the panel writes, so radius and shadow stay named rather than raw:

```ts
const RADIUS  = { None: 0, S: 4, M: 8, L: 16, Full: 999 };
const SHADOW  = { None: 'none', Soft: 'shadow-sm', Raised: 'shadow-md', Overlay: 'shadow-lg' };
const DENSITY = { Compact: [4, 8], Default: [8, 12], Comfortable: [12, 16], Spacious: [20, 24] };
```

---

## 14. Acceptance checks

Each maps to a state in `inspect-panel-3ab.html` — open it and compare.

**3a — component selected**
- [ ] Tabs read Style · Layout · Content; Layout is active on first select
- [ ] Breadcrumb truncates ancestors, never the leaf
- [ ] X/Y absent until Position is Absolute, then seeded from measured offset
- [ ] `AUTO` on H clears the number; typing a number clears `AUTO`
- [ ] Density preset writes gap+pad; hand-editing either deselects all presets
- [ ] Radius pills map 0/4/8/16/999; an off-scale value reveals Custom
- [ ] Content renders schema order with `optional` tags and switch helper text

**3b — artboard selected**
- [ ] Tabs read Style · Layout only — no Content
- [ ] Background type Color/Gradient/Image appears, and swaps the field beneath it
- [ ] Text color row is absent
- [ ] Re-selecting an artboard returns to Layout; re-selecting a component returns
      to whichever tab that kind last used

**Multi-select**
- [ ] Header reads `3 selected` with the shared or `mixed` kind chip
- [ ] Only shared properties render; differing values read `Mixed`
- [ ] Swatch grid is suppressed; numeric fields show a Mixed placeholder
- [ ] One undo entry reverts the edit across all nodes
- [ ] Mixed clears as soon as values converge

**Rail**
- [ ] 320px in both states, border on the right, canvas never reflows
- [ ] Deselect → palette, with its scroll, filter and view mode intact
- [ ] Layers-panel click does **not** swap the rail
- [ ] `Escape` from the panel deselects and returns to the palette

---

## 15. Refactor plan — mapping to the existing code

The current panel is a ~700-line scroll inside `InspectPanel`
(`DesignEditor.tsx:2284-2991`) with primitives scattered at the top of the same
6,900-line file. Steps, in order:

1. **Extract row primitives** into `client/src/design/InspectRows.tsx`:
   `ColorRow`, `SwatchRow`, `PillRow`, `NumberRow`, `SelectRow`, `SwitchRow` —
   plus migrate **`TextProp`** (`DesignEditor.tsx:993-1047`), which the Content tab
   depends on. Every row takes a `label` that renders in the 56px gutter as a real
   `<label htmlFor>`. Remove `PropRow`, `NumberProp`, `SelectProp`, `ToggleProp`
   (`993-1047`) and `BoolPropRow` (`2140-2149`) and update their call sites.
2. **Tab bar + per-kind memory.** `tabByKind` state, tabs derived from node kind
   (`TABS` in §2), `role="tablist"` with arrow-key nav and `aria-selected`, and a
   fallback to the first available tab when the remembered one doesn't exist for
   the new selection.
3. **Header.** Replace dot + name + root/element badge with: 11px breadcrumb of
   clickable ancestors truncated from the **left**, 16px node name, kind chip
   (§3 colors), `×`. Keep `position: sticky; top: 0`.
4. **`<LayoutTab>`.** Move W/H (`DimensionControl`, `2213-2272`), position,
   direction/align/wrap and the spacing presets in. Add the conditional X/Y pair,
   seeded from the node's measured offset when switching to Absolute. Justify
   becomes a `SelectRow` (5 options). Density values: **Compact [4,8] ·
   Default [8,12] · Comfortable [12,16] · Spacious [20,24]**; a preset stays lit
   only while gap+pad still match it, and editing either by hand silently
   deselects all four.
5. **`<StyleTab>`.** Order Fill → Text → Border → rule → Radius → Shadow →
   Opacity. Radius becomes a `PillRow` (None/S/M/L/Full → 0/4/8/16/999) with a
   mono Custom number shown only for off-scale values. Shadow becomes a
   `SelectRow` writing a token, never raw x/y/blur/spread. Background type
   (Color/Gradient/Image) is **artboard-only** and swaps the field beneath it.
6. **`<ContentTab>`.** Move `ComponentProps` (`1321-2139`) in, driven by the
   `PropSchema` union (§6): `boolean → SwitchRow` with `help` wired via
   `aria-describedby`, `select → SelectRow`, `number → NumberRow`,
   `text → TextProp`, `color → ColorRow`. Declaration order, never alphabetized.
   Optional fields get the `optional` tag.
7. **Empty + multi-select.** Nothing selected → the centered placeholder (§8).
   Multi-select → shared properties only, `Mixed` where values differ, edits write
   to all.
8. **Undo.** The Content tab live-binds text with a 200ms debounce, so a typing
   burst **must** coalesce into one history entry — either add coalescing to the
   craft.js integration or commit text on blur instead. Live-binding without one
   of those gives one undo step per keystroke.
9. **Tests.** Update `inspectionPanel.test.ts` for the tab structure, and add:
   tab fallback on kind switch, X/Y hidden unless Absolute, radius pills on- and
   off-scale, Content declaration order.

**Explicitly out of scope:** the colour-picker popover (keep the existing swatch
rows behind the `ColorRow` shell), and the locked/hidden read-only state beyond
what §8 describes.

**Also in scope now that the panel moved:** `LeftRail` owns the palette/inspector
switch, so its width stops being conditional and its border stays on the right in
both states. Selection state needs the `source` discriminator (§0). Any test
asserting the inspector sits on the right side of the viewport needs updating.

**Not in this refactor, but adjacent:** number scrubbing and math input are
implemented in `inspect-panel-3ab.html` §7 and are cheap to lift once the rows
exist — they're the reason the prefix label is a separate element.
