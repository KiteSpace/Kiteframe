---
name: Cloud sync signatures (Kiteframe LWW)
description: How to build content signatures for last-write-wins cloud sync so they don't flip-flop or overwrite newer edits.
---

# Cloud sync signatures must be canonical and timestamp-free

Kiteframe uses a last-write-wins (LWW) cross-device cloud sync. A device decides
whether it has "unsaved local edits" by comparing a content **signature** of the
open project against the signature it last synced. If those signatures disagree
for semantically-identical content, the device falsely thinks it's dirty, refuses
to pull newer cloud state, and pushes its stale copy — silently clobbering the
other device's newer edits (a flip-flop / ping-pong).

**Rule:** any field folded into a sync signature must be normalized so identical
content always hashes identically, regardless of how/where it was stored.

Two concrete pitfalls that caused this and how they're handled:
- **Collection ordering**: per-workflow PRDs are read from localStorage whose key
  enumeration order can differ per device. Sort collections deterministically
  (e.g. by `workflowId`) before hashing — do it in BOTH the cloud-stored path and
  the local-read path.
- **Volatile timestamps**: the overview/details blob re-stamps `updatedAt`
  (and seeds `createdAt`) on every save/reload, so an idempotent reload looks like
  an edit. Strip `updatedAt`/`createdAt` from `detailsData` before hashing. (PRD
  save helpers store objects as-is, so they're already idempotent.)

**Why:** signatures are computed from two sources — the cloud's stored
`workflowData` (whatever order/timestamps it was saved with) and the locally-read
docs — and they must match for unchanged content or LWW regresses.

**How to apply:** when adding a new field to `computeCloudSyncSig` in
`client/src/pages/workflow-editor.tsx`, ask "can two devices produce different
bytes for the same meaning?" If yes (ordering, timestamps, ephemeral ids),
canonicalize it first.

# Hydration must not retrigger auto-save

When applying cloud docs locally (`writePanelDocs`), the writes emit panel-change
events; panels then reload from storage and re-save asynchronously (a couple of
React render cycles later), re-emitting events. A purely synchronous guard around
the apply call does NOT cover that async re-save. Use a short **deadline window**
(e.g. `suppressPanelBumpUntilRef = Date.now() + 1500`, checked in the bump
handler) so both the synchronous events and the async follow-on re-saves are
ignored, while genuine user edits after the window still trigger auto-save.
