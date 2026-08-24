---
name: Scroll-spy over long documents
description: Why IntersectionObserver thresholds silently stop reporting for document sections and what to measure instead.
---

Do **not** build "which section am I reading" with an `IntersectionObserver`
that has a non-zero `threshold` (e.g. `threshold: 0.2` plus a rootMargin band).

**Why:** the threshold is a ratio of the *target's own* size. A spec section is
routinely several times taller than the scroll container, so the sliver of it
inside a narrow detection band is a tiny fraction of the element and the ratio
never crosses the threshold. The observer simply stops firing, and the active
entry sticks wherever it last happened to land — most visibly when scrolling
back to the top, where the first section never re-activates.

Measure instead: on scroll (rAF-throttled), walk the sections and take the last
one whose `getBoundingClientRect().top` is above a threshold line near the top
of the scroller, defaulting to the first. That answers the actual question —
"which heading did I last pass" — and is stable for sections of any height.

**How to apply:** any contents/outline navigation with active-section highlight.
Verify it by setting `scrollTop = 0` programmatically and asserting the first
entry is active; a ratio-based observer fails exactly that case.
