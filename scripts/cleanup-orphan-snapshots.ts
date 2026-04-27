/**
 * Two-phase maintenance script for orphan rows in `workflow_snapshots` (rows
 * with NULL user_id), created by the pre-fix autosave path that didn't carry
 * credentials.
 *
 * Phase 1 — Dry-run report (default, no flags):
 *   npx tsx scripts/cleanup-orphan-snapshots.ts
 *   Prints orphan counts, distinct workflow_ids affected, oldest/newest
 *   timestamps, and (best-effort) attribution candidates. Writes nothing.
 *
 * Phase 2 — Destructive delete (requires BOTH flags as a safety gate):
 *   npx tsx scripts/cleanup-orphan-snapshots.ts --confirm-delete --i-understand
 *   Removes orphan rows. The double-flag pattern prevents a stray --delete in
 *   shell history from wiping data; both flags must be passed together.
 *
 * Notes:
 * - Best-effort attribution: snapshots store only `workflow_id` (an opaque
 *   client-generated tab id never persisted under any user record), so there
 *   is no FK to reclaim from. As a heuristic the report scans `saved_projects`
 *   for any row whose `workflow_data->>'workflowId'` matches an orphan's
 *   workflow_id and lists the matches so an operator can manually re-link
 *   ownership before the destructive phase.
 * - Manual snapshots (is_auto_save=false) with NULL user_id are reported
 *   separately; operators may want to triage these by hand before deleting.
 * - Retention cap (50 autosaves per user/workflow) applies on every new
 *   write, so post-cleanup the table will stay bounded automatically.
 */
import { db } from '../server/db';
import { workflowSnapshots } from '../shared/schema';
import { isNull, sql } from 'drizzle-orm';

async function main() {
  const args = new Set(process.argv.slice(2));
  const shouldDelete = args.has('--confirm-delete') && args.has('--i-understand');

  if (args.has('--delete') && !shouldDelete) {
    console.error(
      'Refusing to run: pass BOTH --confirm-delete and --i-understand to actually delete.'
    );
    process.exit(2);
  }

  const totalRow = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM workflow_snapshots
  `);
  const orphansAuto = await db.execute(sql`
    SELECT COUNT(*)::int AS n
    FROM workflow_snapshots
    WHERE user_id IS NULL AND is_auto_save = true
  `);
  const orphansManual = await db.execute(sql`
    SELECT COUNT(*)::int AS n
    FROM workflow_snapshots
    WHERE user_id IS NULL AND (is_auto_save = false OR is_auto_save IS NULL)
  `);
  const distinctOrphanWorkflows = await db.execute(sql`
    SELECT COUNT(DISTINCT workflow_id)::int AS n
    FROM workflow_snapshots
    WHERE user_id IS NULL
  `);
  const oldestOrphan = await db.execute(sql`
    SELECT MIN(created_at) AS t FROM workflow_snapshots WHERE user_id IS NULL
  `);
  const newestOrphan = await db.execute(sql`
    SELECT MAX(created_at) AS t FROM workflow_snapshots WHERE user_id IS NULL
  `);

  type CountRow = { n: number };
  const total = (totalRow.rows[0] as CountRow).n;
  const autoCount = (orphansAuto.rows[0] as CountRow).n;
  const manualCount = (orphansManual.rows[0] as CountRow).n;
  const workflowsAffected = (distinctOrphanWorkflows.rows[0] as CountRow).n;
  const orphanTotal = autoCount + manualCount;

  console.log('--- workflow_snapshots cleanup report ---');
  console.log(`Total snapshots:               ${total}`);
  console.log(`Orphan snapshots (user_id IS NULL): ${orphanTotal}`);
  console.log(`  • autosaves:                 ${autoCount}`);
  console.log(`  • manual saves:              ${manualCount}`);
  console.log(`Distinct workflow_ids affected: ${workflowsAffected}`);
  console.log(`Oldest orphan: ${(oldestOrphan.rows[0] as { t: unknown }).t}`);
  console.log(`Newest orphan: ${(newestOrphan.rows[0] as { t: unknown }).t}`);
  console.log('-----------------------------------------');

  // Best-effort attribution: any saved_projects row that stamps the same
  // workflow_id inside its workflow_data JSON points to the user who owns
  // those orphan snapshots. We surface the matches so an operator can
  // re-link manually before the destructive phase.
  const attribution = await db.execute(sql`
    SELECT sp.user_id, sp.id AS project_id, sp.name,
           ws.workflow_id, COUNT(ws.id)::int AS orphan_count
    FROM workflow_snapshots ws
    JOIN saved_projects sp
      ON sp.workflow_data->>'workflowId' = ws.workflow_id
    WHERE ws.user_id IS NULL
    GROUP BY sp.user_id, sp.id, sp.name, ws.workflow_id
    ORDER BY orphan_count DESC
    LIMIT 25
  `);
  if (attribution.rows.length > 0) {
    console.log('\nAttribution candidates (top 25 by orphan count):');
    for (const row of attribution.rows as Array<Record<string, unknown>>) {
      console.log(
        `  user=${row.user_id} project=${row.project_id} (${row.name}) ` +
          `workflow=${row.workflow_id} orphans=${row.orphan_count}`
      );
    }
    console.log(
      '\nReview the candidates above. To re-link a workflow before deleting,'
    );
    console.log(
      'run: UPDATE workflow_snapshots SET user_id = $userId WHERE workflow_id = $workflowId AND user_id IS NULL;'
    );
  } else {
    console.log('\nNo attribution candidates found in saved_projects.');
  }

  if (!shouldDelete) {
    console.log(
      '\nDry-run mode. To actually delete orphan rows, re-run with BOTH:'
    );
    console.log('  --confirm-delete --i-understand');
    process.exit(0);
  }

  console.log(
    '\n--confirm-delete --i-understand both set — deleting orphan rows now...'
  );
  const result = await db
    .delete(workflowSnapshots)
    .where(isNull(workflowSnapshots.userId))
    .returning({ id: workflowSnapshots.id });
  console.log(`Deleted ${result.length} orphan rows.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Cleanup script failed:', err);
  process.exit(1);
});
