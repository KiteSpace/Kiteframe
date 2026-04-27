/**
 * One-shot maintenance script: report and (optionally) delete orphan rows in
 * `workflow_snapshots` (snapshots with NULL user_id), which were created by the
 * pre-fix autosave path that didn't carry credentials.
 *
 * Usage:
 *   npx tsx scripts/cleanup-orphan-snapshots.ts            # dry-run report only
 *   npx tsx scripts/cleanup-orphan-snapshots.ts --delete   # ACTUALLY delete orphans
 *
 * Always run dry-run first and review the report before passing --delete.
 *
 * Notes:
 * - We do NOT attempt to attribute orphans back to users. Snapshots store only
 *   `workflow_id` (an opaque tab id generated client-side, never persisted under
 *   any user record), so there is no reliable way to link historical autosaves
 *   back to a specific account. The newer post-fix snapshots are correctly
 *   attributed and unaffected by this script.
 * - Manual snapshots (is_auto_save=false) with NULL user_id are also orphans
 *   under the same root cause; we report them separately so an operator can
 *   decide whether to keep them.
 */
import { db } from '../server/db';
import { workflowSnapshots } from '../shared/schema';
import { eq, isNull, and, sql } from 'drizzle-orm';

async function main() {
  const shouldDelete = process.argv.includes('--delete');

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

  const total = (totalRow.rows[0] as any).n as number;
  const autoCount = (orphansAuto.rows[0] as any).n as number;
  const manualCount = (orphansManual.rows[0] as any).n as number;
  const workflowsAffected = (distinctOrphanWorkflows.rows[0] as any).n as number;
  const orphanTotal = autoCount + manualCount;

  console.log('--- workflow_snapshots cleanup report ---');
  console.log(`Total snapshots:               ${total}`);
  console.log(`Orphan snapshots (user_id IS NULL): ${orphanTotal}`);
  console.log(`  • autosaves:                 ${autoCount}`);
  console.log(`  • manual saves:              ${manualCount}`);
  console.log(`Distinct workflow_ids affected: ${workflowsAffected}`);
  console.log(`Oldest orphan: ${(oldestOrphan.rows[0] as any).t}`);
  console.log(`Newest orphan: ${(newestOrphan.rows[0] as any).t}`);
  console.log('-----------------------------------------');

  if (!shouldDelete) {
    console.log('\nDry-run mode. Re-run with --delete to remove the orphan rows.');
    process.exit(0);
  }

  console.log('\n--delete flag set — deleting orphan rows now...');
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
