---
name: Embeddable previews must own their containing block
description: Why a reusable preview/thumbnail component must never root itself at `absolute inset-0`, and how to test containment honestly.
---

A reusable visual component that is dropped into a caller-supplied box must
establish its own containing block — fill the box (`relative w-full h-full`) and
clip itself — rather than rooting itself at `absolute inset-0`.

**Why:** an absolutely-positioned root resolves against the nearest *positioned*
ancestor, which is a property of the caller, not of the component. It therefore
works by luck: a caller that happens to be positioned looks correct, and the
first caller that isn't silently lets the component size itself against a far
larger ancestor and paint across unrelated UI. The design preview shipped this
way — correct in the home-screen tile (a positioned tile), and painting a
full-size artboard over the KiteAI conversation in both chat panels, which
provide no positioned wrapper. The card's own `overflow-hidden` cannot rescue
it, because the escaped child is not being laid out inside the card at all.

Fixing it at the call sites (adding `relative` to each wrapper) leaves the same
trap armed for the next caller; fix it in the component.

**How to apply:** when a component renders into space the caller allocates —
thumbnails, previews, media frames, chart canvases — route *every* return branch
(loaded, loading, error/placeholder) through one shared frame element, so the
layout guarantee cannot depend on which branch rendered.

**Testing it honestly:** asserting the card renders passes for the entire life
of the bug. Measure `getBoundingClientRect()` of the preview against its card
and require containment. Two traps to avoid:

- A `pointer-events-none` preview is invisible to `elementFromPoint`, so a
  hit test cannot detect visual covering — it only proves clicks pass through.
- Containment of an empty placeholder is trivially true. Require the loaded
  branch, and separately assert the inner content is larger than the card and
  the root computes `overflow: hidden`, so clipping is proven load-bearing.

Confirm any such test actually fails against the pre-fix code before trusting it.
