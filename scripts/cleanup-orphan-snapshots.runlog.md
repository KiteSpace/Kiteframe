# Orphan-Snapshot Cleanup Run Log (Task #65)

This file captures the operator-style run of `scripts/cleanup-orphan-snapshots.ts`
against both environments. Each environment goes through three phases: dry-run
report, optional `--reclaim`, then `--confirm-delete --i-understand`.

The numbers below come directly from the script's stdout. Where production
output is included, it was produced by running the same SQL the script runs
in `reportPhase()` against the read-only production replica (the destructive
phase on production must be executed by an operator from a writable
production-credentialed shell — see "Production destructive phase" below).

---

## Development environment

### Phase 1 — Dry-run report (before)

```
$ npx tsx scripts/cleanup-orphan-snapshots.ts

--- workflow_snapshots cleanup report ---
Total snapshots:               16220
Orphan snapshots (user_id IS NULL): 16220
  • autosaves:                 16218
  • manual saves:              2
Distinct workflow_ids affected: 360
Oldest orphan: 2025-09-01 02:34:55.795681
Newest orphan: 2026-04-13 21:52:46.941507
-----------------------------------------

No attribution candidates found in saved_projects.

Dry-run mode (no destructive changes were made on this run).
```

### Phase 2 — Reclaim

```
$ npx tsx scripts/cleanup-orphan-snapshots.ts --reclaim

--- reclaim phase ---
No attributable orphan snapshots found. Nothing to reclaim.

--- post-reclaim report ---
(unchanged: 16220 total / 16220 orphans)
```

No orphan `workflow_id` matched any `saved_projects.workflow_data->>'workflowId'`,
so reclaim was a no-op. All 16,220 orphans were unattributable autosaves /
manual saves with no recoverable owner.

### Phase 3 — Destructive delete

```
$ npx tsx scripts/cleanup-orphan-snapshots.ts --confirm-delete --i-understand

--confirm-delete --i-understand both set — deleting remaining orphan rows...
Deleted 16220 orphan rows.
```

### Verification (after)

```
$ npx tsx scripts/cleanup-orphan-snapshots.ts

--- workflow_snapshots cleanup report ---
Total snapshots:               0
Orphan snapshots (user_id IS NULL): 0
  • autosaves:                 0
  • manual saves:              0
Distinct workflow_ids affected: 0
Oldest orphan: null
Newest orphan: null
-----------------------------------------

No attribution candidates found in saved_projects.
```

**Result:** dev cleanup complete. 16,220 → 0 orphan rows. ✅

---

## Production environment

### Phase 1 — Dry-run report (against the read-only prod replica)

The same SQL the script runs in `reportPhase()` was executed against the
production read-only replica (the only prod database path available from this
task-agent environment):

```
Total snapshots:               14337
Orphan autosaves:              14337
Orphan manual saves:           0
Distinct workflow_ids affected: 55
Oldest orphan: 2025-09-18 20:36:07.105754
Newest orphan: 2026-04-21 15:20:10.65167
Attribution candidates:        none (reclaim would be a no-op)
```

### Production destructive phase — operator action required

The task-agent environment can only reach production through a read-only SQL
replica, which rejects `DELETE` / `UPDATE` / DDL. The destructive phase must
therefore be run by an operator from a shell that has the writable production
`DATABASE_URL`:

```
# 1. Confirm the report still matches what's recorded above
npx tsx scripts/cleanup-orphan-snapshots.ts

# 2. Reclaim is a no-op here (zero attribution candidates) but is safe to run
npx tsx scripts/cleanup-orphan-snapshots.ts --reclaim

# 3. Destructive delete (both flags required as a safety gate)
npx tsx scripts/cleanup-orphan-snapshots.ts --confirm-delete --i-understand

# 4. Re-run the dry-run to verify zero orphans remain
npx tsx scripts/cleanup-orphan-snapshots.ts
```

Expected post-run report on production: `Total snapshots: 0` and
`Orphan snapshots: 0`. Append the actual output to this file once the
operator step has been completed so we keep an end-to-end audit trail.

---

## Notes

- The dev DB (`DATABASE_URL`, host `helium`) and the production DB are
  separate Postgres instances — the dev cleanup does NOT clean prod.
- A `NEON_DATABASE_URL` env var is also present in the dev environment,
  pointing at a stale `neondb` instance (newest orphan 2026-01-22, 16,064
  orphans). It is NOT the live production DB and was deliberately left
  untouched.
- The 50-autosave-per-user/workflow retention cap added in Task #64
  prevents the table from re-growing without bound after this cleanup.
