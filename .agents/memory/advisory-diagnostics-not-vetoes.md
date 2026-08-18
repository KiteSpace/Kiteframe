---
name: Advisory diagnostics must not veto AI proposals
description: Quality warnings about AI-generated content are advice, not grounds for discarding the generation; and any before/after quality gate must compare like-for-like.
---

## Rule 1 — compare the projected applied result, never the proposal in isolation

When gating an AI proposal on "did this make things worse?", the baseline is
measured over the **existing** artifact, so the comparison must be against the
artifact **as it would be once the proposal is applied** — not against the
proposal on its own.

**Why:** judging the proposal alone means a brand-new addition is scored as if
the rest of the user's work had ceased to exist. A mature artifact scores well
because of everything already in it, so the newcomer can never match it, and the
gate rejects healthy work. The bar rises as the project matures — the better the
user's existing work, the more the assistant refuses to help.

**How to apply:** capture the *graph/state itself* on the baseline snapshot, not
just its score, and project the applied result from that snapshot. Re-deriving
the "before" state at comparison time is a second bug: generation takes tens of
seconds, and anything the user changed meanwhile gets blamed on the proposal.

Corollary — **read the apply path before modelling it.** Do not assume how a
proposal lands. Trace every accept handler to the code that actually mutates
state. Two things are easy to get wrong and both change the verdict:

- Whether ids collide at all. If the apply path **remaps ids** on the way in,
  a proposal reusing an existing id cannot overwrite anything, and a projection
  that models "proposed wins on collision" invents damage that cannot happen.
- Whether the destructive-looking button is actually destructive. A "Replace"
  action may quietly fall back to a non-destructive add in the common case, so
  warning about replacement at proposal time is simply wrong there.

Once the apply path is known to be purely additive, the quality predicates are
monotone over it and a regression is unreachable. At that point do not keep the
blocking branch "just in case" — it is dead code whose only historical effect
was false rejections. Delete it, and let the genuinely destructive path carry
its own guard at the moment the user confirms it (that guard is also the honest
place for it, since only there is the damage real).

## Rule 2 — advice is not a veto

A proposal the user must explicitly accept (a draft, a preview, a "Create"
button) is not yet applied to anything. Destroying it at proposal time because
it is *incomplete* is almost always wrong.

**Why:** the finding "this new workflow has no error handling" is useful
feedback the user can act on. Silently discarding the generation converts useful
feedback into lost work plus a generic, unactionable error message.

**How to apply:** split findings into *damage* (would degrade what already
exists) and *incompleteness* (the new thing could be better). Block only on
damage. Keep the draft for everything else, name the actual finding in the
user-facing message instead of a generic "introduced new issues", and keep the
suggested follow-up actions reachable so the advice is actionable.

## Rule 3 — an empty baseline has nothing to regress from

Guard the zero-state explicitly. An empty artifact scores zero issues, so *every*
finding in a first draft looks "net new" and the gate rejects the very first
thing the user ever asks for.
