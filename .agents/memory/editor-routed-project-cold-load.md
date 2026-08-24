---
name: The editor does not reopen a routed project on a cold load
description: /project/:uuid shows the start screen unless the project is clicked out of Recent Projects; use the shared viewer for cold-mount browser assertions.
---

Navigating straight to `/project/:uuid` (or reloading it) frequently lands on
the editor's "what are we working on today" start screen instead of the
workflow, so the right rail never mounts.

**Why:** the routed-project loader sets its "already loaded" ref as soon as it
fires, but only copies the fetched project into a tab if a tab already exists.
On a cold profile there is no tab yet, so the project is fetched and then
dropped, and nothing retries. Clicking the project out of Recent Projects is
the only reliable way in.

**How to apply:** in browser tests, navigate and then click the project card if
`[data-testid="project-panel"]` is absent (the Phase A and Phase C harnesses
both do this). Do not expect a reload to restore the open project.

For anything that must be asserted **at mount** — what a panel reads from the
URL query or from localStorage on its first render — drive `/view/:shareId`
instead. The shared viewer renders ProjectPanel directly on a cold load, so a
fresh page load genuinely exercises the mount path. Enable it by setting
`share_uuid` + `is_share_enabled` on the `saved_projects` row.
