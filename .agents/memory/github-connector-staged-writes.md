---
name: GitHub connector staged writes
description: Recovering from PTC replay failures during multi-step GitHub API mutations.
---

When the GitHub connector’s CodeExecution runtime reports a PTC replay/pattern
error for a multi-request mutation (for example: blob → tree → commit → ref →
pull request), perform one API request per CodeExecution call instead.

**Why:** The connector may successfully service a simple isolated request while
rejecting a longer impure function before it returns. Retrying the same bundled
workflow does not repair the failure and risks obscuring whether a partial
write occurred.

**How to apply:** Read and carry forward only JSON-serializable values such as
file text and SHA IDs between blocks. Confirm whether the target branch exists
before creating it, then stage the Git database operations one at a time. This
also makes it possible to stop safely and report the exact completed state if a
later request fails.