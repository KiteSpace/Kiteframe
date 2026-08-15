---
name: User-owned borders vs selection cues
description: How to signal selected/editing state on a canvas object whose border the user controls, without reflow or overwriting their choice.
---

When a canvas object's border colour becomes user-configurable, the element's
own `border` belongs to the user and nothing else may write to it.

**Rule:** signal selection and editing with `box-shadow` rings drawn *outside*
the box (`0 0 0 Npx <colour>`), never by changing `border`. Keep the border
width constant and paint it `transparent` when the user has not chosen a
colour.

**Why:**
- A state-dependent border fights the user's choice — selecting the object
  would visibly repaint a border they deliberately set to something else.
- `box-sizing: border-box` means adding or removing border width changes the
  content box, so the text reflows and a field that had auto-grown to fit its
  content starts clipping. Reserving the width unconditionally makes
  add/clear a pure repaint: same footprint, same line breaks, same scrollHeight.
- Outset box-shadow does not participate in layout at all, so a selection ring
  can never move the object or resize its content.

**How to apply:** derive any content-height allowance from the same border-width
constant used to draw the border, so the two cannot drift. Verify with computed
styles rather than screenshots — an invisible border is `borderTopColor:
rgba(0,0,0,0)` with a non-zero width, which is very different from
`border-style: none` and only one of them preserves the layout.

**Consequence to watch:** removing a default border can leave an *empty* object
painting nothing at all, making it undiscoverable right after creation. Check
what an empty, unselected instance looks like before shipping.
