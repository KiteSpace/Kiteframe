---
name: Per-surface chat threads and shared-link viewers
description: Why the read-only KiteAI discussion thread must stay on its own localStorage key instead of being unified with the project transcript.
---

The read-only KiteAI discussion panel keeps its own storage key, separate from
the editable chat's project transcript. Do not "simplify" this by unifying them
onto the project key, even though one-conversation-per-project is otherwise the
right model for this app.

**Why:** the read-only panel is what a visitor following a *shared link* sees
(the view-only viewer renders the project panel with read-only set). Chat
threads live in localStorage, which is keyed by browser profile and carries no
account scoping at all. Unifying the keys means: owner A uses the editable chat,
user B signs into the same browser and opens A's shared link, and B is shown
A's private chat history — which is also fed to the model as context. The
separate key is the only thing preventing that escalation. The pending
pre-project handoff stash is owner-scoped for exactly this reason; the
transcript keys themselves are not.

A task brief once asked explicitly for these threads to be unified. The defect
it was actually describing was that the discussion thread was lost on unmount —
that is fixed by persisting it under its own per-project key, which satisfies
the requirement (survives tab switches and reloads, can be continued) without
the disclosure.

**How to apply:** before pointing any surface at a project-keyed browser-storage
thread, ask who can reach that surface. If a non-owner can (shared links,
public/embed views, read-only modes), it needs its own key or real
account-scoping. Treat "keyed by project" as "readable by anyone using this
browser", never as an authorization boundary.
