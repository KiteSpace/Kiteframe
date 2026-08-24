---
name: Routed project tab hydration
description: Direct project URLs must materialize an editor tab from the fetched cloud project, including when a new browser tab inherits unrelated local tabs.
---

Direct project URLs must create or activate a tab for the fetched project.
They must not assume there is already an active editor tab to overwrite.

**Why:** a separately opened browser tab starts on the editor Home screen.
Its localStorage may have unrelated saved tabs, but it has no active workflow
tab for the requested route. A loader that only updates the active tab silently
drops the fetched project and leaves the user at Home.

**How to apply:** when changing route or tab-loading logic, test an authenticated
`/project/:uuid` navigation in a fresh browser page whose localStorage already
contains an unrelated tab. Confirm the requested workflow and Project panel
mount, rather than falling back to Home. Preserve the fetched project’s panel
documentation under its project identifier when hydrating the tab.

For anything that must be asserted **at mount** — what a panel reads from the
URL query or from localStorage on its first render — drive `/view/:shareId`
instead. The shared viewer renders ProjectPanel directly on a cold load, so a
fresh page load genuinely exercises the mount path. Enable it by setting
`share_uuid` + `is_share_enabled` on the `saved_projects` row.
