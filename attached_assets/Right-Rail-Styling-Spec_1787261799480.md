# Right rail + reader — explicit styling spec

For Replit: apply this to the **existing production panels** (`ProjectPanel.tsx`,
`ProjectDocTab.tsx` and its `sections/*`, `DiagnosticsTab.tsx`, `KiteAIChat.tsx` /
`ChatBubble.tsx`, and the new `ReaderPane.tsx` from Phase D) so their visual output
matches `rail-reader-kit.html` pixel-for-pixel. This file is styling only —
**behavior, data, and file structure are `Right-Rail-Implementation-Spec.md` and
`Right-Rail-Addendum-Notes-Issues-Spec.md`.** Don't re-derive layout logic from
this file; it assumes that spec is already implemented and just tells you what
every surface should look like.

Every value below is a literal from `rail-reader-kit.html`. Where a value is a
color, the `THEME.md` token it maps to is given in parens — use the token, not
the hex, so dark mode and future palette edits stay correct. `rail-reader-kit.html`
runs on local `--rk-*` tokens for portability; production should never gain a
`--rk-*` variable — go straight to the `THEME.md` name.

```
--rk-chrome      #FBFBFC   → --background
--rk-raised      #ffffff   → --card
--rk-subtle      #f3f3f5   → --muted
--rk-track       #eeeef1   → --accent          (active tab / subtab fill — NOT the brand accent)
--rk-line        #e4e4e8   → --border
--rk-line-soft   #eeeef1   → --border-soft
--rk-line-strong #d6d6dc   → --input
--rk-fg          #1e1e21   → --foreground
--rk-fg-muted    #54545c   → --muted-foreground
--rk-fg-faint    #9a9aa3   → icon default, no exact token — see README-right-rail.md §0
--rk-ink         #131316   → --primary
--rk-ink-hover   #24242a   → --primary-hover
--rk-ink-fg      #ffffff   → --primary-foreground
--rk-accent      #9B6BFF   → --brand
--rk-accent-soft #f2effa   → --brand-soft
--rk-accent-fg   #6D3FD6   → --brand-strong
--rk-accent-wash #FAF8FF   → --brand-wash
--rk-info        #189FDB   → --info        --rk-info-soft #E6F6FD → --info-soft
--rk-warn        #FFC24B   → --warning     --rk-warn-soft #FFF1D0 → --warning-soft   --rk-warn-fg #8A5A00 → --warning-foreground
--rk-ok          #0F9D6B   → --success     --rk-ok-soft   #DEF7EC → --success-soft   --rk-ok-fg   #0F5C42 → --success-foreground
--rk-danger      #E5484D   → --destructive
```

Radii: `--rk-r-sm` 6px, `--rk-r` 8px, `--rk-r-lg` 10px. Fonts: `Inter, system-ui,
-apple-system, sans-serif` for UI text; `ui-monospace, "SF Mono", Menlo, monospace`
for every numeric/date/id/version string, no exceptions — a mono numeral is how a
user tells a value apart from a label at a glance.

---

## 1. Rail shell

```
.rail            width 400–800px (resizable) · background --background
                 border-left 1px --border
.rail.collapsed  width 48px

.tabrow          height 46px · padding 0 8px · gap 3px
                 border-bottom 1px --border · flex row, align-center

.chev  (collapse chevron)
                 22×22px · centered glyph · 13px · color --muted-foreground
                 hover: background --muted, color --foreground

.tab             padding 5px 10px · border-radius 7px · gap 5px (icon→label)
                 font 12px
                 inactive: weight 500, color --muted-foreground, background transparent
                 hover:    background --border-soft, color --foreground
                 active:   background --accent (#EEEEF1-equivalent), color
                           --foreground, weight 600
                 NEVER a violet/brand fill on the active tab — see §9 for where
                 brand color IS allowed.

.tab .icon       11px · color --muted-foreground (faint), EXCEPT the assistant/
                 AI tab's icon, which is --brand — the only tab icon allowed
                 that color.

.badge           (unread/count pill, e.g. Comments) 9px / weight 700 · line-
                 height 1 · border-radius 999px · padding 3px 5px
                 background --info-soft · color --info

.tab .label      progressive — hidden on inactive tabs below the rail's 480px
                 label-threshold (ResizeObserver on the rail, not a window
                 query); always shown on the active tab; all shown ≥480px.
                 Hidden-label tabs get a dark tooltip on hover: background
                 --primary, color --primary-foreground, 11px/500, padding
                 4px 8px, radius 6px.

collapsed strip  48px wide · icons stacked, gap 4px, 32×32px each, radius 6px
                 same active/hover fills as .tab · tooltip appears to the LEFT
                 (rail is on the right edge) instead of below.
```

## 2. Sub-tab row (Overview / Spec / History)

```
.subtabs   flex row, gap 3px, margin-bottom 14px
.subtab    padding 4px 9px · radius 7px · font 11.5px/500 · color --muted-foreground
           hover:  background --border-soft
           active: background --accent (#EEEEF1) · color --foreground · weight 600
```
Identical active-fill rule as the tab row — grey, never brand-colored.

## 3. Cards — documents, spec entries, notes

One card component, reused for every "open this in the reader" row (Documents in
Overview, PRD + workflow specs in Spec, each Note).

```
.card       border 1px --border · radius 8px · background --card
            padding 10px 11px · full width · stacked 6px apart (margin-top 6px
            on card+card)
            hover:   border-color --input (one step darker than --border)
            is-open: border-color --brand · background --brand-wash
                     (the doc currently showing in the reader)

title       12.5px / weight 600 / line-height 1.3
meta        mono, 10px, color --muted-foreground (faint), margin-top 3px
            content: "<Doc type> · <date>" — NEVER section count / draft-state
            / word count (see addendum §4)
summary     11.5px / line-height 1.5 / color --muted-foreground, margin-top 7px
            1-2 sentences, what the doc is about

row layout  flex row, gap 8px, align-center; title+meta+summary in a flex:1
            "grow" column on the left, the action on the right, flex:none
action      "Open" label only — 11px/weight 600/color --brand-strong.
            No trailing arrow glyph.
```

## 4. Spec subtab internals

```
.kv (key/value row, e.g. definition fields if the doc's metadata needs a table)
    flex row, align-baseline, gap 10px, padding 7px 8px, radius 6px, font 12.5px
    hover: background --muted
    key:   fixed width 88px, color --muted-foreground
    value: flex:1, weight 500 (mono/400/--muted-foreground variant for numeric
           values)

.check (acceptance-criteria style checklist, if used)
    flex row, align-baseline, gap 8px, padding 6px 8px, font 12.5px/1.45
    box glyph: 11px, color --muted-foreground (faint); done state → --success
    done row's label text: color --muted-foreground
```

## 5. History timeline

```
.tl          container, padding-left 18px, position relative
             a 1px vertical line at left:4px, color --border, from top:6px to
             bottom:6px (::before pseudo-element)
.tl-item     padding-bottom 14px (0 on the last one); its own dot at left:-18px
             top:4px, 7px circle, background --border, 3px ring in --card
             (box-shadow) so the dot "punches through" the line
.tl-item.is-now (current version)   dot background → --brand
.tl-h        flex row, align-baseline, gap 8px: title (12.5px/600) + date,
             pushed right with margin-left:auto, mono 10px, --muted-foreground
.tl-p        11.5px/1.55/--muted-foreground, margin-top 3px — the change summary
.tl-who      mono 10px/--muted-foreground — actor name, own line below the summary
```

## 6. Notes — inline edit state

```
editable note body   outline: 2px dashed --brand, outline-offset 8px,
                      radius 6px, cursor: text — the ONLY dashed outline
                      pattern in the rail; reserve it for this exact state
header tools, editing swap-in:
    Discard        quiet button (border 1px --border, color --muted-foreground,
                    background --card), 28px tall, icon: undo arrow
    Save changes    ink button (background --primary, color --primary-
                    foreground), 28px tall, icon: check
    both replace the normal ⟲ ⧉ ↓ ✕ icon row in the same header slot — do not
    render both sets at once.
```

## 7. Issues / Insights

Already shipped in `DiagnosticsTab.tsx` — this section documents what's there so
visual QA has a checklist, not because it needs rebuilding (see addendum §3).

```
empty state       centered column, 40px circular icon tile (background
                   --brand-soft, icon --brand-strong), title 13px/600,
                   body 12px/1.55/--muted-foreground max-width ~220px,
                   primary button below with the rocket icon inline
results header    flex row: title 13px + "N new" pill (--brand-soft bg,
                   --brand-strong text, 9px/700 pill) on the left; Clear All
                   text-button, rerun icon-button, filter icon/dropdown on
                   the right, all 28px tall icon-buttons where icon-only
```

## 8. Reader — header

```
height       52px · padding 0 12px 0 16px · flex row, gap 8px, border-bottom
             1px --border
title        14px/600, ellipsis-truncate, no wrap
caption      mono, 9.5px, letter-spacing .03em, color --muted-foreground
             (faint) — see addendum §5 for the two copy formats. This is a
             DIFFERENT, smaller scale than reader body text; give it its own
             selector so a generic "all <p> in the doc body" rule can't win on
             specificity and blow it up to 15px (a real bug this pass hit).
tool icons   28×28px, radius 6px, 13px glyph, color --muted-foreground,
             hover background --muted — ⟲ version history · ⧉ copy ·
             ↓ export · ✕ close, right-aligned (margin-left:auto on the group)
edit-mode swap → see §6, same slot
```

## 9. Reader — contents nav

```
full width       162px · border-right 1px --border-soft · background a hair
                 lighter than --card (#FCFCFD in the reference — off-white,
                 distinguishing the nav rail from the doc body without a hard
                 line)
eyebrow          "CONTENTS" or "NOTES" — 10px/700/uppercase/letter-spacing
                 .11em, color --muted-foreground (faint), padding 0 14px 8px
item             12px row: number (mono, 9.5px, faint) + label (11.5px,
                 --muted-foreground), 2px transparent left border
item hover       background --muted, color --foreground
item current     background --brand-soft · color --brand-strong · weight 600
                 · left border 2px --brand — THIS is where brand color
                 belongs: identity/selection, never plain tab state
open-question dot  5px circle, --warning, top-aligned with the label's first
                   line (margin-top 5px, not vertically centered)

narrow strip     40px · eyebrow hidden · items center their number only,
                 label moves to a hover tooltip (dark pill, same tooltip
                 style as tab tooltips) positioned to the RIGHT of the strip
```

Notes mode: same nav markup and states, minus the open-question dot (notes have
no "missing content" semantic) — just numbered rows with titles.

## 10. Reader — document body

```
padding         28px 32px 56px · overflow-y auto
measure         max-width 400px on the inner content wrapper, AT EVERY READER
                 WIDTH — this does not scale up with the pane. Extra reader
                 width beyond 400px + nav + padding is margin, not more text
                 column.
doc title        26px / line-height 1.15 / weight 600 / letter-spacing -.015em
section heading  18px / line-height 1.3 / weight 600
section number   mono, 11px, color --muted-foreground (faint)
body text        15px / line-height 1.7 / color a near-black (#33333a, i.e.
                 --foreground at ~90% — do not reuse --muted-foreground here,
                 body copy should read darker than captions)
lists            disc, OUTSIDE position, padding-left 20px; list-item
                 paragraphs get margin:0 (generated markdown wraps <li>
                 content in <p>, which otherwise doubles the line gap)
inline code      mono, 13px, background --muted, padding 1px 5px, radius 4px
callout box      border 1px --border, radius 8px, background --card, padding
                 12px 14px; header row 10px/700/uppercase, color
                 --warning-foreground, with a small leading dot/icon
```

Per-section AI actions (Suggest / Refine / Elaborate / Add examples):

```
opacity 0 at rest, opacity 1 on section :hover or :focus-within (do not show
them at rest — they compete with reading otherwise)
each action: 26px tall, padding 0 9px, radius 6px, border 1px --border,
background --card, font 11px/500, color --muted-foreground
hover: border-color --brand, color --brand-strong, background --brand-soft
```

Suggestion block (an AI rewrite proposal, rendered at full reader width):

```
border 1px --brand · radius 8px, overflow hidden
header strip: background --brand-soft, padding 7px 12px, 10px/700/uppercase,
              color --brand-strong
body: padding 14px 14px 4px, same 15px/1.7 body type as the rest of the doc
footer: padding 0 14px 14px, buttons: Accept (ink) · Reject (quiet) ·
        Refine again (quiet)
```

## 11. Chat

```
bubble            padding 9px 12px, radius 10px, font 13px/1.55
user bubble       background --primary, color --primary-foreground,
                  border-bottom-right-radius 4px (the "tail"), right-aligned,
                  max-width 85% of the thread
assistant bubble  background --card, border 1px --border,
                  border-bottom-left-radius 4px, left-aligned
thread            justify-content: flex-end — short threads sit ABOVE the
                  composer, never floating at the top of an empty column
clamp             long non-artifact responses: max-height ~15.5em, overflow
                  hidden, bottom 40px fade to --card, "Show more" toggle below
                  in 11.5px/600/--brand-strong
```

Artifact card (a generated document arriving in chat) — identical box model to
the rail's document card (§3): 26px icon tile (--brand-soft bg, --brand-strong
icon) instead of no tile, title 13px/600, mono meta 10.5px, optional excerpt
11.5px/--muted-foreground, footer strip border-top 1px --border-soft, 11px/600.
Open state: border --brand, `box-shadow 0 0 0 3px rgba(155,107,255,.14)`, footer
background --brand-wash / text --brand-strong, label "Open in the reader" — no
trailing arrow (§3's rule extends here too).

Composer: border-top 1px --border, background --background (rail chrome, not
card white), textarea 14px/1.5 no border/outline, send button 30×30px circle-
ish square (radius 6px) background --primary, icon --primary-foreground.

## 12. Buttons — the three kinds used throughout

```
ink     background --primary, color --primary-foreground, hover --primary-hover
        → the only primary-action treatment. Never green. See THEME.md §7.
quiet   border 1px --border, color --muted-foreground, background --card,
        hover: background --muted, color --foreground
        → secondary actions, Reject/Discard/Cancel
mini    (small pill actions like "+ New" on the Notes header)
        border 1px --input, background --card, 11px/600/--muted-foreground,
        radius 999px, padding 4px 9px
        hover: border-color --brand, color --brand-strong, background
        --brand-soft
icon-only  28×28px, radius 6px, 13px glyph, color --muted-foreground,
           hover background --muted — used in every header/toolbar row
```

All buttons: height 30px for full-width/labelled actions (26–28px for compact
in-context ones like per-section AI or header icons), radius 6px unless noted,
`font-weight 600` on every label — nothing in this UI uses a 500-weight button
label except inactive tabs, which aren't buttons in the acted-upon sense.

## 13. Quick visual QA checklist

- [ ] No violet/brand fill on any active tab or subtab — only the neutral
      `--accent` (#EEEEF1-equivalent) fill
- [ ] Brand color appears ONLY on: the assistant tab's icon, the reader's
      current-section nav item, an open document/note card, an open artifact
      card, focus rings, and the mini "+ New" hover state
- [ ] Every numeric/date/version/id string is mono, everything else is sans
- [ ] Reader body text is 15/1.7; nothing in the reader drops to rail-scale
      13px type
- [ ] Reader caption line is 9.5–10px, not inheriting the 15px body rule
- [ ] No card or button uses green — green is reserved for success/resolved
      states only (a passing Test Flight, a resolved comment)
- [ ] "Open" labels have no trailing arrow anywhere (cards, artifact footer)
- [ ] Per-section AI actions are invisible until hover/focus, not always-on
