---
name: AstryxCard is a full container
description: AstryxCard must have isCanvas:true in BOTH the craft.js component config AND the AI prompt; mismatches cause silent non-droppable nodes.
---

## Rule
AstryxCard is a droppable container (`isCanvas: true`). Both the editor and the AI must agree on this.

## Why
The AI system prompt previously declared `AstryxCard` a leaf (`isCanvas:false`). Craft.js uses the per-node `isCanvas` flag (set at creation time) to decide whether a node is a droppable canvas. AI-generated cards were therefore non-droppable, even though the component itself called `connect()`. The static `craft.isCanvas` on the component config overrides the per-node flag — adding it there provides a safety net for any node that arrives without `isCanvas:true`.

## How to apply
- `resolver.tsx`: `(AstryxCard as any).craft = { displayName: "AstryxCard", isCanvas: true, rules: { canMoveIn: () => true } };`
- `designPrompt.ts`: AstryxCard listed under CONTAINERS, nesting rule says it holds a Stack/HStack.
- Any other component intended to be a droppable canvas must follow the same pattern — static craft config `isCanvas: true` AND prompt must list it as a container.
- There is a THIRD place: the client and server repair functions each coerce stored `isCanvas` to true for an always-container name list. The static config is not a reliable safety net for persisted state — craft.js reads the stored flag, so a container saved with `isCanvas:false` renders none of its children while the nodes remain present in the map and the layers panel. Keep the two coercion lists and the prompt's container line in sync.
- See `astryx-palette-registries.md` for the full set of registries a new component must be added to.
