---
name: Repair craft state before any reachability pruning
description: Why every pruneUnreachableCraftNodes call must be preceded by repairCraftState(Json).
---

**Rule:** Never run reachability-based pruning (`pruneUnreachableCraftNodes` / ghost-artboard cleanup) on a craft state that hasn't gone through graph repair first. Repair reattaches nodes whose `parent` is set but which are missing from the parent's `nodes` array — a common AI-generation defect.

**Why:** Pruning without repair deleted valid AI-generated artboards (blank canvas while layers showed data) in the workflow→design generation flow, in dev and production. The repair pass deliberately leaves *empty* disconnected artboards alone so legacy "ghost" blank artboards are still pruned and the cleanup banner stays accurate.

**How to apply:** Any new code path that persists or hydrates a full craft state should use `repairCraftStateJson(...)` before prune/sanitize. Regression tests: `client/src/design/__tests__/repairBeforePrune.test.ts`; real-browser check: `scripts/e2e-orphan-artboard.mjs` (uses the forged-session e2e pattern).
