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

### Production destructive phase — Task #67 follow-through

The task-agent environment can only reach production through a read-only SQL
replica, which rejects `DELETE` / `UPDATE` / DDL. The writable production
`DATABASE_URL` for this Replit-managed (Helium) Postgres is also not
exposed in the workspace secrets nor in the user's Neon console (Replit
provisions production Postgres internally and only injects its
`DATABASE_URL` into the deployed app's runtime).

To work around that, Task #67 added a one-shot admin endpoint to the
deployed app that runs the same `DELETE` against its own `DATABASE_URL`
(which IS the writable production string) under `requireHttps +
requireAdminAuth + double-flag confirmation`:

```
POST /internal/x9k7m2p4/cleanup-orphan-snapshots
  Authorization: Basic <base64(ADMIN_USERNAME:ADMIN_PASSWORD)>
  Content-Type: application/json
  Body (dry-run): {}
  Body (delete):  { "confirm": true, "iUnderstand": true }
```

Operator runbook for the production destructive phase:

```
# 1. Publish so the new endpoint reaches production.
#    (Run from the main project, not the task-agent env.)

# 2. Dry-run against the live deployment to confirm the orphan count
#    still matches the report above.
curl -sS -u "$ADMIN_USERNAME:$ADMIN_PASSWORD" \
  -H 'Content-Type: application/json' \
  https://<your-app>.replit.app/internal/x9k7m2p4/cleanup-orphan-snapshots \
  -d '{}'

# 3. Destructive delete (both flags required).
curl -sS -u "$ADMIN_USERNAME:$ADMIN_PASSWORD" \
  -H 'Content-Type: application/json' \
  https://<your-app>.replit.app/internal/x9k7m2p4/cleanup-orphan-snapshots \
  -d '{"confirm":true,"iUnderstand":true}'

# 4. Re-run dry-run; expect "before.orphans": 0.
curl -sS -u "$ADMIN_USERNAME:$ADMIN_PASSWORD" \
  -H 'Content-Type: application/json' \
  https://<your-app>.replit.app/internal/x9k7m2p4/cleanup-orphan-snapshots \
  -d '{}'

# 5. Independently re-verify via the read-only prod replica:
#    SELECT COUNT(*) FROM workflow_snapshots WHERE user_id IS NULL;
#    expected: 0.
```

After verification, the temporary endpoint should be removed in a
follow-up task and the deployment re-published, so the destructive
hatch is not left exposed in production.

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
