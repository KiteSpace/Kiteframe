---
name: Radix forceMount panes are never [hidden]
description: Keep-alive Radix tab/accordion panes must be hidden via data-state="inactive"; forceMount makes them "present" so Radix never sets the hidden attribute.
---

A `forceMount`ed Radix `TabsContent` counts as **present**, so Radix renders it
with `hidden={false}` and leaves it fully laid out. Hide inactive keep-alive
panes with `data-state="inactive"` (which Radix *does* set), never with a
`[hidden]` selector.

**Why:** a keep-alive rail rewrite hid inactive panes with a
`[role="tabpanel"][hidden] { display: none !important }` rule. The selector
matched nothing, so every pane the user had ever visited rendered stacked at
full width on top of the active one. It was invisible in casual clicking
because the last-painted pane happened to look right, and a
`getComputedStyle(...).display === "none"` assertion was the only thing that
caught it.

**How to apply:** any time a pane is kept mounted across tab switches, pair
`forceMount` with an explicit `data-[state=inactive]:hidden` class (and/or a
scoped `[data-state="inactive"] { display: none !important }` rule). Assert the
computed `display` of the inactive pane in a browser test — a class-name check
cannot tell you the rule actually matched.

Related: mounting *every* pane eagerly is usually wrong anyway — panes that open
websockets or spawn workers on mount should be mounted lazily on first visit and
kept alive after, and a pane first mounted while hidden measures as zero-sized.
