---
name: Tabbed inspector decisions
description: Durable design decisions behind the tabbed inspect panel and its input primitives.
---

# Tabbed inspector decisions

**Inspector controls live behind tabs — anything driving them must select the tab first.**
**Why:** the redesign silently broke several pre-existing real-browser scripts that assumed a single-scroll panel; locator timeouts looked like feature regressions.
**How to apply:** when writing or debugging a browser test that touches inspector controls, select the node *and* activate the tab that owns the control before asserting.

**Every prop the Style tab exposes must be consumed by the renderer.**
**Why:** shadow/opacity controls shipped writing props nothing read — the panel looked functional but did nothing, and code review rejected the task.
**How to apply:** adding an inspector control means adding (and testing) the corresponding style/behavior in the render path in the same change.

**Node kinds without a Content tab still need a home for their content-ish fields.**
**Why:** artboards lost their only rename path when the label editor stayed in the Content-only dispatcher.
**How to apply:** when gating tabs per node kind, audit which existing editors become unreachable and rehome them.

**Controlled-input drafts must be React state, not a ref.**
**Why:** a ref-held draft shadowing the controlled value never re-renders, so "clear then blur → reset to auto" left stale text visible while the prop had already cleared.
