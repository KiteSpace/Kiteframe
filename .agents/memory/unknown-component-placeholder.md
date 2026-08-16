---
name: Unknown-component placeholder fallback
description: How AI designs naming a component the library lacks must degrade — substitute before validating, mirror client/server, and never force the placeholder to a leaf.
---

## The rule

An AI design that names a component Astryx does not have must **land with a
labelled placeholder**, never be discarded. Three things have to hold together
for that, and each one has been broken independently:

1. **Substitute before validating, inside repair.** Repair is the only pass that
   runs ahead of validation on every apply path. If unknown-name substitution
   lives only in `sanitizeCraftState` (which runs in the *success* branch, after
   validation), the design is thrown away before it can ever be salvaged.
2. **The client and server repair passes must mirror each other.** They each own
   a copy and drift silently: one side salvages a design the other discards, and
   which one you hit depends on whether the state arrived by generation or by
   apply. There is a behavioural parity test — extend it rather than trusting
   the two implementations to stay aligned by reading.
3. **The placeholder keeps the container-ness of what it replaced.** Set
   `isCanvas` from whether the node actually has children. Forcing it to a leaf
   hides the entire subtree of an unresolved *container* — the same
   "design got discarded" failure one level down, and invisible because the node
   count stays healthy. The placeholder component therefore renders `children`.

**Why:** each of these was a separate live defect. The third is the sneakiest:
every count looks right, no error is logged, and only the nested content is
missing from the screen.

**How to apply:** any change to unknown-component handling must touch all three
substitution sites — client repair, server repair, and `sanitizeCraftState` —
and `sanitizeCraftState` must be *idempotent* with repair, since it also runs
directly before `<Frame data={...}>` on paths that skip repair.

## ROOT is always exempt

ROOT is never substituted, in any of the three sites. The placeholder renders no
children of its own chrome, so demoting ROOT blanks the whole canvas while every
node survives in the state map. ROOT is coerced to a real container afterwards
instead. See `craft-root-must-be-container.md`.

## Don't misreport the failure

The validator only **warns** on unknown component names — it never rejects them.
Its sole type-related *error* is a missing `type.resolvedName`. Reporting a
validation failure as "it used an unrecognised component type" is therefore
wrong on both counts, and advising the user to rephrase is worse than useless:
by the time validation fails, repair has already backfilled types, substituted
unknown names, stripped dangling refs and synthesised a missing ROOT, so what
remains is a structural fault in the model's output that no wording change
affects.
