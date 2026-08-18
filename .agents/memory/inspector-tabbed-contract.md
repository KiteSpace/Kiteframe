---
name: Single-pane inspector decisions
description: Durable design decisions behind the single-pane inspect panel (collapsible sections) and its input primitives.
---

# Single-pane inspector decisions

**The inspector is a single scrolling pane of five collapsible sections (Layout · Stack · Spacing · Style · Content) — no tabs.**
**Why:** the tabbed model was explicitly replaced per the left-rail handoff; browser scripts that click `role=tab` will time out and look like feature regressions.
**How to apply:** browser tests scroll/expand sections instead of activating tabs. A collapsed section hides its controls — expand via the section toggle (`[data-section="…"] > button[aria-expanded]`) or its index chip before asserting.

**Collapse state persists per node kind in localStorage (`kiteframe.inspect.collapse`), not per node or per session.**
**Why:** users set up a working shape per kind (element/text/frame); per-node memory would feel random, per-session memory would reset their layout.
**How to apply:** tests asserting expansion state must account for the current kind's stored prefs surviving reloads; corrupt storage must be swallowed, never crash.

**Sections that don't apply are omitted entirely — no empty shells, no dead chips.**
**Why:** artboards have no Content; non-flex components have no Stack/Spacing. An empty section reads as a bug.
**How to apply:** the `availableSections` list is the single gate for both the chip row and the section mount; keep them derived from one source.

**Every prop the Style section exposes must be consumed by the renderer.**
**Why:** shadow/opacity controls shipped writing props nothing read — the panel looked functional but did nothing, and code review rejected the task.
**How to apply:** adding an inspector control means adding (and testing) the corresponding style/behavior in the render path in the same change.

**Node kinds without a Content section still need a home for their content-ish fields.**
**Why:** artboards lost their only rename path when the label editor stayed in the Content-only dispatcher.
**How to apply:** when gating sections per node kind, audit which existing editors become unreachable and rehome them (artboard rename lives in Style).

**Controlled-input drafts must be React state, not a ref.**
**Why:** a ref-held draft shadowing the controlled value never re-renders, so "clear then blur → reset to auto" left stale text visible while the prop had already cleared.
