---
name: Floating toolbar collision bounds
description: Reliable viewport and endpoint collision handling for floating editor toolbars.
---

Clamp floating editor UI from the union of every rendered descendant's screen-space bounds, not only the root toolbar box. If viewport correction creates a collision with the selected shape's handle region, choose another fitting side.

**Why:** Absolutely positioned submenus can extend beyond their root's bounding rectangle. Measuring only the base toolbar makes edge placement look correct until a submenu opens, while simple top/bottom flipping can still cover line endpoints after viewport clamping.

**How to apply:** Measure the root plus visible descendants after layout and on resize/submenu changes, correct both axes against viewport margins, and treat the endpoint-handle bounding region as an exclusion zone.