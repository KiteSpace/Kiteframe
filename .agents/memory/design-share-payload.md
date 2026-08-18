---
name: Public design (Interface) share payload
description: Why the public share endpoint must withhold ownership fields, and why the share viewer is a separate component from the owner viewer.
---

The public read-only endpoint for a shared design must return an explicit
allowlist (id, title, notes, craft state, timestamp) and must **never** include
`claimedByUserId`.

**Why:** the design viewer derives its affordances from ownership, and treats an
*absent* owner as "unclaimed" — which renders a "Save to my account" button. Ship
the full row to an anonymous viewer and you hand every visitor a button that
claims someone else's Interface. Omitting the field is not merely tidy; sending
it (or sending it as null through the owner-aware viewer) is the bug.

For the same reason the share route renders its own read-only view rather than
reusing the owner viewer: the owner viewer computes edit/claim rights, so a
public payload with no owner falls into the claim branch. Keep the two viewers
separate, and keep the public one free of ownership logic entirely.

**How to apply:** any time a new field is added to the designs table, check
whether the public share endpoint should carry it. Default to no. The e2e asserts
the payload's key set, so a leak fails a test rather than shipping silently.
