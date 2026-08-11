---
name: Cross-tab localStorage conversation merge
description: How append-only threads stored in localStorage are made safe against two tabs clobbering each other, and the two tempting "fixes" that are actually wrong.
---

Append-only threads (chat transcripts) persisted in localStorage are merged by
**union-by-id, with whatever is currently in storage as the merge base**, then
stably sorted by timestamp.

**Why:** the naive read-modify-write loses one tab's messages. The obvious
remedies both misfire:

- **A compare-and-swap / revision loop is unnecessary.** Each read-modify-write
  is a single synchronous block with no `await` between the read and the write,
  and localStorage is serialised across tabs, so no other tab can interleave
  inside one. A stored `rev` is worth keeping for diagnostics, but branching on
  it buys nothing.
- **Do not add an id tie-break to the sort.** It looks like it makes tabs
  converge on the same order, but it reorders legitimate same-millisecond
  history alphabetically — pre-existing conversation gets shuffled below
  messages appended after it. Convergence already comes from storage being the
  base: whoever writes second builds on the first writer's order, and both then
  read that same order back. A *stable* sort with base-first is the correct
  primitive.

Two further details that are easy to get wrong:

- Reconcile must run in **both** directions. Reading storage picks up other
  tabs' additions; writing memory back restores anything another tab's save
  dropped. Without the second half, a message that lost a race is gone forever,
  because this tab's state never changed and so never re-saves.
- With a size cap, the "don't resurrect trimmed history" cutoff must be
  **strict** (`>` the oldest stored timestamp, not `>=`). A non-strict cutoff
  re-admits trimmed entries that share the cutoff millisecond, which pushes
  newer ones out and rotates the retained window on every reconcile. Nothing
  real is lost: a genuinely new message on a capped thread has a current
  timestamp, nowhere near the oldest stored one.

**How to apply:** any time browser-local state is shared by multiple tabs and
is conceptually append-only. Reach for union-by-id before reaching for locking.
