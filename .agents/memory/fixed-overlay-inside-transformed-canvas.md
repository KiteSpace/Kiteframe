---
name: position:fixed inside a transformed canvas layer
description: Floating overlays anchored to screen coordinates must be portalled to <body>, because the canvas pan/zoom layer's CSS transform redefines what "fixed" means.
---

# `position: fixed` does not mean "viewport" inside the canvas

Anything rendered as a sibling or child of a canvas object lives inside the
pan/zoom layer, which carries a CSS `transform`. A transformed ancestor becomes
the containing block for `position: fixed` descendants, so screen coordinates
computed from `getBoundingClientRect()` get re-interpreted relative to that
ancestor's origin and the overlay lands somewhere else.

**Rule:** floating overlays anchored to screen coordinates — format bars,
popovers, tooltips, context menus — must be rendered with
`createPortal(..., document.body)`.

**Why:** positioning them inside the transformed layer instead would mean
converting back to canvas space, which then has to be redone on every zoom
change. The failure also disguises itself badly: a mispositioned bar that comes
to rest on top of the element it is anchored to swallows the clicks meant for
that element, so the reported symptom is "the buttons don't do anything"
rather than "the bar is in the wrong place".

**How to apply:** when an overlay near a canvas object is misplaced, or when
commands issued from it appear to run yet change nothing, check for a
transformed ancestor before debugging the command logic. In a browser test,
assert the overlay's rect does not intersect the element it is anchored to —
a centred-but-overlapping bar passes a naive "is it visible and centred" check.
