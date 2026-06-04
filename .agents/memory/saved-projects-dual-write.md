---
name: saved_projects dual-write & placeholder names
description: Two independent autosave paths write saved_projects; placeholder names must never clobber real local names on pull.
---

# saved_projects has TWO autosave writers

Two unrelated systems both persist to the `saved_projects` table and can race:

1. **Cloud-sync autosave** (`client/src/pages/workflow-editor.tsx`) — debounced
   `updateCloudProject({ name: tab.name, workflowData, ... })`. Only runs for
   tabs that already have a `cloudProjectId`. Sends the real name + full
   workflowData (incl. Project Panel docs). This is the authoritative name writer.

2. **Snapshot mirror** (`server/snapshotHandlers.ts`, driven by
   `client/src/lib/kiteframe/plugins/pro/VersionControlPlugin.ts`) — on every
   node/edge change the plugin POSTs `/api/snapshots`. If the tab has NO
   `cloudProjectId`, the server **auto-creates** a `saved_projects` row and
   returns `resolvedCloudProjectId`, which the client patches onto the tab via
   `window.tabManager` (bypassing React).

## The "Untitled — <date>" overwrite bug
The snapshot mirror used to create the row named `Untitled — <YYYY-MM-DD>` (and
the client sent a throwaway `Auto-save <timestamp>` name). For a brand-new or
reloaded tab the snapshot path won the race, created a placeholder-named row,
and the cloud-sync first-sighting reconciliation / pull effects then adopted
that placeholder name over the user's real local name.

**Rule:** a placeholder cloud name must NEVER overwrite a meaningful local name
when hydrating/pulling a cloud copy back into an open tab. Helpers
`isPlaceholderProjectName()` / `pickSyncedName()` guard both the reconciliation
hydrate and the pull effect. The snapshot client now sends the real tab name
(fallback `"Untitled"`, never empty — the server rejects nameless snapshot
writes), and the server auto-create uses the client name with the dated
placeholder only as a last resort.

**Why:** convergent naming + the placeholder guard means both writers agree on
the real name, and a stale placeholder can't ping-pong back over a rename. The
sync signature already includes `name`, so a rename alone triggers a cloud push.

**How to apply:** any new code that pulls cloud project state into a tab must
route the name through `pickSyncedName(cloudName, localName)`. Any new writer to
`saved_projects` must send the real name, not a generated placeholder. Existing
already-broken rows only heal when the user renames (which then syncs).
