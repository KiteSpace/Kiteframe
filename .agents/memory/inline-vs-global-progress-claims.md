---
name: Inline vs global progress indicators
description: Why a surface suppressing a shared/global progress indicator must claim only its own work, never hide the indicator wholesale.
---

When a surface renders its own inline progress row (a chat thread's "Thinking…") and a
global indicator also reports the same operation, the user sees one job announced twice.
The tempting fix — a boolean/refcount that makes the global indicator return `null` while
any inline indicator is mounted — is wrong.

**The rule:** the inline surface must *claim the specific jobs it already reports*, and the
global indicator must **filter** its list by those claims rather than hide itself. If any
unclaimed job remains, the global indicator still renders for it.

**Why:** the global indicator is shared by every background job. A blanket suppression
means a completely unrelated job running at the same time (a document/PRD generation
alongside a chat request) loses its *only* progress signal — the user is left with no
feedback at all for work they started. Deduplication must never become suppression.

**How to apply:**
- Scope a claim by the job's origin (path) **and** task type. A path alone is too coarse:
  several kinds of job can start from the same screen.
- Claim only the task types the surface genuinely renders inline; exclude the ones driven
  by other UI (document sections drive their own generation and keep their own indicator).
- Key claims by an opaque incrementing id in a Map, not a refcount. Each mount releases
  exactly the id it created, so React StrictMode's setup/cleanup/setup cycle, two surfaces
  mounted at once, and rapid mount/unmount can't leave the counter stuck above zero — a
  stuck count hides the global indicator permanently.
- Test the stuck-claim cases explicitly: simultaneous unrelated jobs, StrictMode, unmount
  mid-flight, and multiple concurrent claimers.
