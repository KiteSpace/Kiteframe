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

## The same trap applies to chat threads

Design chats and workflow chats live in different storage namespaces, and a
workflow tab carries more than one plausible "project id". So "record it under
the project id" is ambiguous, and the obvious choice is usually the wrong one —
the write succeeds, nothing throws, and the conversation is simply invisible.

**Why:** the workflow→interface bridge recorded its generation exchange under an
id that neither destination reads, so users landed on a new interface beside an
empty chat. It looked correct in code review and in any test that asserted "the
entry was written".

**How to apply:** decide which surface the user will be looking at afterwards,
then write to that surface's thread using the same expression that surface uses
to read. Never assert only that an entry was stored — assert against the
rendered conversation, ideally via a marker only the destination panel emits.
