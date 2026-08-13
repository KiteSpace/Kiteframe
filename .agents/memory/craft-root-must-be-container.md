---
name: ROOT must always be a real container
description: Why the design canvas renders blank despite "successful" generation, and the invariant that prevents it.
---

# ROOT must always resolve to a real container

The craft.js ROOT node of a design must always resolve to a **real container
component** (a section/stack/hstack style component) and must always carry
`isCanvas: true`. Anything else — a literal `"Root"`, a hallucinated component
name, or an already-demoted unknown placeholder — must be coerced to a
container rather than run through the normal unknown-component substitution.

**Why:** unknown components are replaced with a *leaf* placeholder that renders
no children. When that substitution was allowed to hit ROOT, the entire canvas
went blank while every diagnostic still reported success: all nodes and
artboards were present and correctly parented in state, they simply had no
container to draw them. The failure is invisible to node counts, artboard
counts, and parent/child integrity checks — the only signal was a single log
line about ROOT being replaced.

This is a one-line-of-log bug with a whole-screen symptom, so it is worth
recognising fast: **blank canvas + "generation succeeded" + healthy node counts
⇒ suspect ROOT's component type, not the children.**

**How to apply:**
- Unknown-name substitution runs on child nodes only; ROOT is always exempt.
- Normalise ROOT's type *before* any substitution pass, on both client and
  server, and on the patch-merge path — a design can enter through any of them.
- When synthesising or reconstructing a ROOT node, never name it `"Root"`. That
  literal can round-trip back through craft.js's reverse resolver lookup and
  reappear as an unresolvable component type, which is what produced the
  original production failure.
- Coercion should be logged, not silent: it means something upstream emitted a
  bad ROOT and the origin still needs fixing.

**Guarding it:** the invariant is enforced by a source-scanning test that reads
the routes file and asserts every craft-state response is sanitised. Such a
guard is only as good as the *transports* it parses — the original version
looked at JSON replies only, so the streaming (SSE) import route shipped an
unsanitised ROOT while the guard reported full coverage. When adding an
invariant guard of this kind, enumerate every way a response can leave the
server, and add a non-vacuous assertion that each transport is actually being
seen; otherwise the guard silently narrows as the code grows.

The allowed-container list is declared separately on client and server. They are
kept honest by a parity test rather than a shared module, so changing one side
alone fails the suite instead of silently splitting the invariant in two.

**Verifying:** a unit test alone is not enough here, because state can be
perfectly valid and still paint nothing. Confirm in a real browser that
artboard frames have non-trivial painted dimensions — a blank canvas still
renders labels and zero-height frames, so asserting on label text alone passes
against the broken build.
