---
name: Adding an Astryx palette component touches many parallel registries
description: A new design-palette component must be registered in ~8 independent places, including THREE separate copies of the AI system prompt, or it silently degrades to AstryxUnknown.
---

## Rule

The Astryx design palette has no single source of truth. Adding one component means
editing every registry below. Miss one and the failure is silent and confusing —
usually the component renders in the editor but is rewritten to `AstryxUnknown` on
save/reload, or it renders but the AI never emits it.

- the base component + its unprefixed key in the component registry
- the craft.js resolver: a wrapper component, the exported `resolver` map, and the
  full-width-leaf set
- the client allow-list used by the sanitizer
- the server allow-list (feeds BOTH the AJV enum and the repair function's allow-set)
- the editor: imports, toolbox/palette tiles, inspector prop rows, and the various
  opt-in capability Sets (radius, size, container-ness)
- the palette parity test's documented-component list

**Why:** the registries were added incrementally and never unified. A parity test
plus a module-load guard in the resolver catch *some* drift, but neither covers the
prompts or the inspector.

## The AI prompt exists in three copies

This is the trap. There is a server-side prompt catalogue, a **second full copy on
the client** used by a different generation route, and a third dead list kept for
legacy reasons. They drift: the client copy's container list was badly stale
(listing only a fraction of the real containers) because previous component
additions only updated the server copy.

**How to apply:** grep for a component name you know is old and well-established
(not one you just added) — every file that mentions it is a registry you must also
update. Do not trust that the test suite will catch an omission; the prompts and
the inspector have no parity coverage.

## Containers need `isCanvas` in the stored state, not just the static config

See `astryx-card-container.md`. Beyond declaring `isCanvas: true` in the static
craft config and in the prompt, the repair/validation paths must coerce stored
`isCanvas` to true for every always-container name. craft.js reads the **stored
node state**, so a generator that omits or falsifies the field produces a container
that renders none of its children — the nodes still exist in the map and show up in
the layers panel, which makes it look like a rendering bug rather than a data bug.
