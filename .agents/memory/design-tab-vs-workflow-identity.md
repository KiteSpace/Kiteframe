---
name: Design tabs carry the source workflow's cloud id
description: Why per-project state on an Interface (design) tab must never be looked up via the tab's cloud project id.
---

An editor tab that hosts an Interface still carries the cloud project id of the
**workflow that generated it**, alongside its own design id. The two ids point at
different rows in different tables, and only the design id identifies the
Interface.

Any per-project state read for a design tab — share status, publish status,
thumbnails, permissions, anything future — must be resolved from the design id.
Resolving it from the tab's cloud project id compiles fine, returns a real
record, and renders plausible-looking values, so the mistake is invisible until
someone notices one project describing another.

**Why:** the Home grid once showed an Interface as "Shared" because the parent
workflow was shared; sharing state was being read from the workflow row. Nothing
errored — the wrong row simply answered the question.

**How to apply:** when a tab may be an Interface, branch on that first and pick
the lookup key from the branch. Never share a single lookup between the two
kinds. A quick way to catch a regression: seed a shared workflow plus an
unshared Interface for the same user and assert the Interface's tile shows no
shared indicator.
