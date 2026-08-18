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

# "Local is newer" reconciliation must use cloudSig as baseline (not localSig)

When reconciliation finds local is newer (`localTs >= freshTs`), the baseline stored
in `cloudSyncSigRef` **must** be set to `cloudSig` (the cloud's own signature), NOT
`localSig`. Using `localSig` caused the auto-save to see no diff and skip — meaning
panel docs (PRDs, notes, details) that exist in the author's localStorage were never
pushed to cloud, so share-link viewers always saw empty panel content.

**Why:** `cloudSyncSig` is the "what cloud already has" baseline. If we set it to
`localSig`, we're lying — we're telling the auto-save the cloud already matches local,
even when it doesn't. Setting it to `cloudSig` (the truth) lets the auto-save detect
any mismatch (including panel-doc-only diffs) and fire. Content-identical cases
short-circuit before reaching this branch (`localSig === cloudSig` guard), so the
save is never spurious.

**How to apply:** the relevant branch is in the reconciliation effect in
`workflow-editor.tsx` — the `else` branch after `if (freshTs > localTs)`.

# Hydration must not retrigger auto-save

When applying cloud docs locally (`writePanelDocs`), the writes emit panel-change
events; panels then reload from storage and re-save asynchronously (a couple of
React render cycles later), re-emitting events. A purely synchronous guard around
the apply call does NOT cover that async re-save. Use a short **deadline window**
(e.g. `suppressPanelBumpUntilRef = Date.now() + 1500`, checked in the bump
handler) so both the synchronous events and the async follow-on re-saves are
ignored, while genuine user edits after the window still trigger auto-save.
