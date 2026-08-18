---
name: Inspector fallbacks vs component defaults
description: Why the design inspector's "?? fallback" for a prop must come from the same constant as the component's own default, not a copy-pasted literal.
---

# Inspector fallbacks must share one constant with the component defaults

When a palette component declares a default in its signature (`options = "A,B,C"`)
and the inspector row separately writes `props.options ?? "A,B,C"`, the two
literals are a silent contract. The moment they disagree, the inspector shows a
value the canvas is not rendering.

**Why:** the inspector is not read-only. Its rows are controlled inputs seeded
from the fallback, so as soon as the user edits *any* field in that panel, the
displayed value is written back as a real prop. A fallback of `""` against a
component default of `"Design,Engineering"` therefore doesn't just mislabel the
state — it silently deletes the chips the user could see, and the deletion
persists through autosave. This was caught in review on the date/time and
advanced-selection batch, where four controls had non-empty component defaults
and empty inspector fallbacks.

**How to apply:** export one `as const` defaults object next to the components
(`INPUT_DEFAULTS` in `client/src/components/astryx/components.tsx`), reference it
from both the component signature defaults and the inspector's `??` fallbacks.
Never re-type the literal in the inspector. The same rule applies to any second
surface that has to guess a prop's default — toolbox tiles that create a node
should pass a coherent set of props rather than relying on defaults they don't
know (e.g. a displayed value of `10:30` alongside a default highlighted time of
`10:00` contradicts itself the moment the panel is opened).
