# Right rail · reader pane · chat — build spec

Companion to `right-rail.html` (reference code) and `Right-Rail-Implementation-Spec.md`
(phasing, file paths, acceptance criteria).

Read this file for **what the thing is**. Read the implementation spec for **which
files to touch and in what order**. Read `THEME.md` for **color**.

---

## 0. Precedence — settle this before writing any code

> **`THEME.md` is authoritative for color.**
> **`right-rail.html` is authoritative for geometry, structure and behavior.**
> **`Right-Rail-Implementation-Spec.md` is authoritative for file paths, phase order and acceptance.**

Where two files appear to disagree, the one above wins for its own domain. There is
no fourth source. Do not introduce values from screenshots, from the older
`Right Rail Audit.dc.html` exploration, or from the current production CSS.

### Token mapping — the port is a rename

`right-rail.html` uses local `--rr-*` tokens so it runs standalone. Every one maps
1:1 to a `THEME.md` variable. Substitute, don't re-derive:

```
--rr-chrome      → --background          --rr-line        → --border
--rr-raised      → --card                --rr-line-soft   → --border-soft
--rr-subtle      → --muted               --rr-line-strong → --input
--rr-track       → --accent              --rr-fg          → --foreground
--rr-ink         → --primary             --rr-fg-muted    → --muted-foreground
--rr-ink-hover   → --primary-hover       --rr-fg-faint    → (icon default #9A9AA3)
--rr-ink-fg      → --primary-foreground  --rr-brand       → --brand
--rr-brand-soft  → --brand-soft          --rr-brand-fg    → --brand-strong
--rr-info        → --info                --rr-info-soft   → --info-soft
--rr-warn        → --warning             --rr-warn-soft   → --warning-soft
--rr-warn-fg     → --warning-foreground  --rr-ok          → --success
--rr-ok-soft     → --success-soft        --rr-ok-fg       → --success-foreground
--rr-danger      → --destructive
--rr-canvas      → --kf-canvas           --rr-artboard    → --kf-artboard
```

`--rr-brand-wash` (`#FAF8FF`) is the only value with no `THEME.md` home. Add it as
`--brand-wash` — it is the open-artifact footer and the selected-document card fill.

The reference file ships **light values only**. Dark comes from `THEME.md` §3, with
that file's two §4 exceptions: **the canvas stays light and artboards are never
themed.**

---

## 1. Five rules that are not negotiable

These are the ones that get ported wrong. Each has a visible failure mode.

### 1.1 Active tab state is grey, never violet

`--accent` / `#EEEEF1` fill, `--foreground` text, weight 600. No segmented track,
no white active card, no shadow, no border.

**Violet is identity and selection only:** the KiteAI tab's icon, the current reader
section in the contents nav, the selected layer row, the open artifact card's border.
A violet active-tab pill is a defect, not a variation.

### 1.2 Green is an outcome, never an action

`Create`, `Add`, `Accept` and every other primary action use `--primary` (ink
`#131316`). Green — `--success*` — is reserved for states that report a result:
resolved comments, passing checks, confirmation toasts, the existing
`edge_case_selected` ✓ block in `ChatBubble`.

There is **no green button anywhere in `right-rail.html`**, deliberately. If one
appears in the port, it came from the old code, not from this spec. (`THEME.md` §7)

### 1.3 Reader typography ≠ rail typography

This is the entire justification for a separate pane. If the reader renders at rail
sizes, delete it and save the work.

| Element | Reader | Rail (for contrast) |
| --- | --- | --- |
| Doc title | **26px / 1.15 / 600** | 19–20px |
| Section heading | **18px / 1.3 / 600** | 14px |
| Body | **15px / 1.7 / 400** | 12.5–13px |
| Measure | **400px max-width, always** | full panel |
| Any numeric value | `--font-mono` | `--font-mono` |

### 1.4 The measure is fixed; the CONTENTS NAV yields

The reader resizes 516–800px (default 660) and remembers per project. The **text
measure never scales with it** — `.doc-inner { max-width: 400px }` at every width,
in overlay mode included.

What gives way instead is the contents nav. See §4.2 — this is the one piece of
reader geometry that must be *derived*, not declared, and getting it wrong silently
ships a 255–389px measure while every spec file claims 400.

### 1.5 Every pane stays mounted

All five panes render always, hidden with `[hidden]`, never conditionally
unmounted. Today only `project` is `forceMount`, which is why every other tab loses
scroll position and the chat loses its draft on switch.

Generalize the exception; do not add a second one. And note `[hidden]` is a no-op on
a flex container — the reference file carries
`[hidden] { display: none !important }` at the root for exactly this reason.

---

## 2. Rail shell

```
width          400–800px, resizable, remembered
collapsed      48px icon strip, tooltips, click expands to that tab
tab row        height 46 · padding 0 8px · gap 3 · border-bottom 1px --border
chevron        22px box, 13px glyph, --muted-foreground
tab            padding 5px 10px · radius 7 · gap 5 · font 12px
               weight 600 active / 500 inactive
               color --foreground active / --muted-foreground inactive
               background --accent active / transparent · white-space nowrap
icon           11px · #9A9AA3 · --brand for the KiteAI tab ONLY
badge          9px / 700 · radius 999 · padding 3px 5px · --info-soft on --info
labels         PROGRESSIVE — see §2.1
sub-tab row    same pill at 11.5px · active is --accent, NOT violet
glyphs         ✦ KiteAI · ▤ Project · ☰ Layers · ◌ Comments · ⚠ Insights
```

### 2.1 Progressive tab labels — the five-tab / 400px collision

Five labelled tabs intrinsically need **466px**: chevron 22 + KiteAI 69 + Project 76
+ Layers 73 + Comments 114 (the badge makes it widest) + Insights 82, plus gaps and
16px of side padding. **The rail floor is 400px.** They do not fit, and no amount of
spacing adjustment changes that arithmetic.

Resolution:

```
rail < 480px    active tab labelled · inactive tabs are icon + badge, tooltip on hover
rail ≥ 480px    all five labels shown, tooltips suppressed
```

The active tab is always labelled, so you always know where you are. The badge stays
on the icon-only Comments tab — the count is the point.

Implement with a **ResizeObserver on the rail** or a container query. Not a window
media query: the rail resizes independently of the window, so a window query gives
the wrong answer at every rail width but one.

Rejected alternatives, for the record: raising the rail minimum to 480px (§2's width
clamp math and the `400` contract both depend on the floor); shortening `Comments` to
a bare count (loses the word at every width, including wide ones where it fits); and
an overflow-scrolling tab row (hides tabs with no affordance — strictly worse than
both).

**Never let a tab clip.** A tab you cannot see is a tab you cannot reach.

Tabs: **KiteAI · Project · Layers · Comments · Insights**. Notes is deleted — but
only after `ProjectNotesSection` is rendered in the Project tab. See
`Right-Rail-Implementation-Spec.md` §4; the storage key is live in share, export and
cloud-save even though the tab is dead.

### Width clamping — the bug this fixes

Production clamps against constants only: `Math.max(400, Math.min(800, newWidth))`.
A stored 800px width on a narrow window pushes the rail past the viewport edge, so
right-aligned user bubbles get cut by the **window**, not by any container. That is
why `max-w-[85%]` looks like it should be safe and isn't.

Clamp against `Math.min(800, window.innerWidth - MIN_CANVAS - otherPanelWidths)` in
three places: on read from storage, during drag, and on `window.resize`. The
reference file's `drag()` and resize handler do all three.

---

## 3. Chat

### Artifact card

A generated PRD arrives as a **card**, not 800 words of markdown in a 400px column.

```
card       border 1px --border · radius 10 · --card fill
tile       26px · radius 6 · --brand-soft fill · --brand-strong glyph
title      13px / 600
meta       --font-mono 10.5px --muted-foreground   "12 sections · 1,840 words · draft"
excerpt    11.5px / 1.5 --muted-foreground · first ~200 chars
footer      strip, border-top 1px --border-soft, 11px / 600
```

**Open state** — when its document is showing in the reader:

```
border      --brand
box-shadow  0 0 0 3px rgba(155,107,255,.14)
footer      --brand-wash fill, --brand-strong text, "● Open in the reader"
```

That highlight is the whole point: the link between the conversation and the
document must never be ambiguous. Two documents open in one thread should be
distinguishable at a glance.

Architecturally this is **one optional field and one branch**. `ChatBubble` already
dispatches on `workflowProposal`, `designPreview` and `type === 'edge_case_selector'`.
Follow that pattern; do not restructure `KiteAIChat.tsx`.

### What becomes an artifact

**Task-type driven, decided.** `taskType: 'prd_generation'` and other doc-shaped
tasks always produce an artifact. Ordinary chat never does. No word counts, no
heading counts, no model self-declaration — those were considered and rejected as
untestable.

### The clamp

The safety net for long responses that are *not* artifacts: ~12 lines, fade, then
"Show more". Toggles both ways.

Do not rely on `max-w-[65ch]` — at 13px in a 400px column it never engages, which is
why long non-artifact responses currently run for screens.

### Thread layout

`justify-content: flex-end` on the thread, so short conversations sit above the
composer instead of floating at the top of an empty column.

This **replaces `pb-96`** — 384px of unconditional bottom padding in
`ChatMessageList` that is the dead band under the last message in fullscreen. Also
replace `scrollIntoView` with `viewport.scrollTop = viewport.scrollHeight`;
`scrollIntoView` scrolls the nearest scrollable ancestor and can move the whole
editor shell.

---

## 4. Reader pane

### Placement

Inboard of the rail. Canvas compresses, reader sits between canvas and rail, the
rail keeps working. Not an overlay, not a full-page takeover.

```
[ canvas (flex, min 320px) ][ reader 516–800 ][ rail 400–800 ]
```

### 4.1 Overlay mode — the rail must never be pushed off screen

At defaults the reader needs `320 + 620 + 400 = 1340px`. On a 924px window that
commits 416px more than exists, and because the rail is the last flex child it is
what leaves the viewport — tab row, thread and composer all unreachable. It also
reproduces the A4 clipped-bubble bug this spec exists to fix.

So below roughly 1150px total the reader **floats over the canvas** rather than
taking a column:

```
room = window.innerWidth - railWidth - MIN_CANVAS(320)

room ≥ 516   compress mode — reader takes a flex column, width clamped to room
room < 516   overlay mode  — reader positioned over the canvas, right: railWidth
                             rail untouched, resize grip hidden, no canvas peek
```

Overlay mode leaves **no canvas peek**: the measure outranks a sliver of visible
canvas, and at a 924px window the difference is exactly what makes a 400px measure
possible (524px of reader) instead of impossible (492px).

**The invariant to assert in review:**

```js
rail.getBoundingClientRect().right <= window.innerWidth
```

True at every window width, with the reader open or closed.

Critically, **opening the reader must clamp** — not only drag and `window.resize`.
Opening is the common path into an over-committed layout, and it is the one that gets
missed: the drag ceiling math and the resize handler can both be correct while
`setReader(true)` just unhides the pane. In the reference file a single `layout()`
function owns the mode decision and every clamp, and every state change calls it.

### Structure

```
header       52px · title · confidence chip · mono "v3 · <date>" · ⟲ ⧉ ↓ ✕
             resize handle on the left edge
contents     162px full / 40px numeral strip · numbered sections
             amber dot where content is missing or questions are open
             current section = --brand-soft fill + 2px --brand left border
             + --brand-strong text
body         overflow-y auto · padding 28px 32px 56px · measure 400px ALWAYS
width        516–800px, default 660, remembered per project
```

One continuous document — the nav scrolls, it does not page. Scroll-spy updates the
current section.

### 4.2 Reader widths are DERIVED from the measure — do not declare them

This is the single easiest thing to get wrong in the whole spec, because wrong values
look fine at 800px and the pane silently loses its reason to exist at every other
width.

A 400px measure needs:

```
nav 162 + doc padding 64 + scrollbar 12 + measure 400 = 638px   ← full-nav threshold
nav  40 + doc padding 64 + scrollbar 12 + measure 400 = 516px   ← absolute floor
```

So:

```
reader ≥ 638   full 162px contents nav, measure 400
reader < 638   nav collapses to a 40px NUMERAL STRIP, measure still 400
reader = 516   the floor — do not allow narrower
default 660    full nav AND a true 400px measure on first open
```

The strip keeps the section numbers and the amber dots — the dots are the reason to
look at the nav at all — and puts the label in a hover tooltip.

**Two traps, both of which shipped in an earlier draft of this file:**

1. **A declared floor.** "520px minimum" with a 162px nav yields a 283px measure. The
   earlier numbers (520 floor / 620 default) were mutually inconsistent with the 400px
   measure they claimed — even the default was 17px short. Derive from the measure and
   the contradiction cannot occur.
2. **The scrollbar gutter.** `.doc` is `overflow-y: auto`, so it costs ~11–12px. Omit
   it and the measure lands exactly 11px short at precisely the threshold widths — the
   ones a checklist is most likely to test.

If the measure must ever fall below 400 (a window so narrow that even 516px of reader
won't fit beside the rail), **collapse the rail instead**. Never narrow the measure.

### Per-section AI

Four actions: **Suggest · Refine · Elaborate · Add examples.** Revealed on section
hover or focus-within.

`Reset` was cut deliberately — it is undo wearing a different hat, and version
recovery (`⟲ v3`) in the header already covers it. Don't add it back.

### Suggestions

Render at full reader width and measure: `--brand` border, `--brand-soft` header
strip, body at 15/1.7, footer `Accept` (ink) · `Reject` · `Refine again`.

The problem this solves: `DocSection`'s inline suggestion and `prdSteward`'s
`ReviewSuggestionCard` both render 150+ word full-section replacements into a 400px
rail column with a `max-h-24` scroller. Accepting prose you cannot read is a coin
flip. Same content at reader width is a decision.

### State rules

- Opens from a document card in the rail, an artifact card in chat, or a URL.
- **Reads selection stores; writes none.** Opening the reader must not disturb
  canvas or layer selection — there are 9 selection stores and no single manager.
- Autosave, no Save button. Header shows state. Every regenerate snapshots the prior
  version; `⟲ v3` is recovery, not save.
- **Width remembered per project:** `kiteframe-reader-width-${projectUuid}`, clamped
  to 516–800 on read and re-clamped against the viewport (§4.1).

### List rendering — do not skip this

```css
ul { list-style: disc outside; padding-left: 20px; }
li > p { margin: 0; }
```

Generated markdown is a **loose** list, so each item's content is wrapped in `<p>`.
With `list-inside` (production today) the marker renders on its own line and the
text drops beneath it. This is broken in every PRD in production right now, and it
is a two-line fix.

---

## 5. URL addressability

```
?panel=project&doc=workflow-prd&section=requirements
```

Nothing in the rail is linkable today. Use `wouter`, already a dependency. The
reader pane in particular must be linkable — a document you can't send someone a
link to isn't much of a document.

---

## 6. What to verify before calling it done

Behavioral, in the reference file, all clickable:

1. Scroll Layers → switch to Project → return. **Position held.**
2. Type in the composer → switch tabs → return. **Draft intact.**
3. Click the artifact card. Reader opens, card takes its violet open state, the
   Project tab's document card highlights too.
4. Drag the rail edge to maximum, then narrow the window. Rail **stops at the
   viewport**; no bubble clips.
5. **Measure at every width, not just the wide one.** Assert `.doc-inner` is exactly
   400px at the 516px floor, at 637 and 638 (either side of the nav threshold), at the
   660 default, and at 800 — and in overlay mode on a ~950px window, which is the
   width a user actually hits by clicking the artifact card on a laptop. A checklist
   that only tests 800px passes while the measure is 255px everywhere else.
6. Collapse the rail, click an icon. Expands to that tab.
7. Load `?panel=layers`. Opens on Layers.
8. Every bullet in the reader has its marker inline with its text.
9. At the 400px minimum, **all five tabs are visible and clickable** — four as icons,
   the active one labelled. Drag past 480px and every label returns.
10. **Open the reader on a ~950px window.** The reader overlays the canvas and the
    rail stays fully on screen. Assert
    `rail.getBoundingClientRect().right <= window.innerWidth` — reader open, reader
    closed, and while dragging either edge.
11. Widen past ~1150px with the reader open. It leaves overlay mode and takes a
    column; the canvas compresses instead of being covered.

Then the phase acceptance criteria in `Right-Rail-Implementation-Spec.md` §7.

---

## 7. Not in this spec

- **View-only / shared mode.** Deferred. It reuses these components, so it cannot
  start until the reader and artifact card exist.
- **Layers internals.** Already virtualized and worker-backed. Reskin against §2
  only — no logic changes.
- **`workflow-editor.tsx`.** Touched exactly once, to mount the reader. If a change
  seems to need it earlier, that change belongs in `ProjectPanel`.
- **The two open `THEME.md` §11 decisions** — the marketing gradient, and Preview
  mode's backdrop.
