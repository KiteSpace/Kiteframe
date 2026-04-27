/**
 * Three-phase maintenance script for orphan rows in `workflow_snapshots`
 * (rows with NULL user_id), created by the pre-fix autosave path that
 * didn't carry credentials.
 *
 * Phase 1 — Dry-run report (default, no flags):
 *   npx tsx scripts/cleanup-orphan-snapshots.ts
 *   Prints orphan counts, distinct workflow_ids affected, oldest/newest
 *   timestamps, and attribution candidates. Writes nothing.
 *
 * Phase 2 — Reclaim (RECOMMENDED before any destructive phase):
 *   npx tsx scripts/cleanup-orphan-snapshots.ts --reclaim
 *   For every orphan workflow_id that can be attributed to a saved_project
 *   (via saved_projects.workflow_data->>'workflowId'):
 *     • UPDATE workflow_snapshots.user_id ← project owner (recovers history)
 *     • Materialize the latest orphan snapshot's nodes/edges into the
 *       saved_project's workflow_data IF the snapshot is newer than the
 *       project's last update (preserves recoverable user work). Existing
 *       canvasObjects/viewport/flowSettings on the project are preserved.
 *   This is idempotent: re-running after a successful reclaim is a no-op.
 *
 * Phase 3 — Destructive delete (requires BOTH flags as a safety gate):
 *   npx tsx scripts/cleanup-orphan-snapshots.ts --confirm-delete --i-understand
 *   Removes orphan rows that remain unattributable. Run --reclaim first.
 *   The double-flag pattern prevents a stray --delete in shell history from
 *   wiping data; both flags must be passed together.
 *
 * Notes:
 * - Snapshots store only `workflow_id` (an opaque client-generated tab id
 *   never persisted under any user record), so true reclaim is best-effort:
 *   only orphans whose workflow_id is also stamped in some user's
 *   saved_projects row can be attributed.
 * - Manual snapshots (is_auto_save=false) with NULL user_id are reported
 *   separately; they remain candidates for both reclaim and (last-resort)
 *   delete.
 * - Retention cap (50 autosaves per user/workflow) applies on every new
 *   write, so post-cleanup the table will stay bounded automatically.
 */
import { db } from '../server/db';
import { workflowSnapshots, savedProjects } from '../shared/schema';
import { isNull, sql, eq, and } from 'drizzle-orm';

type CountRow = { n: number };

async function reportPhase() {
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
          `workflow=${row.workflow_id} orphans=${row.orphan_count}`,
      );
    }
  } else {
    console.log('\nNo attribution candidates found in saved_projects.');
  }

  return { orphanTotal, attributionCount: attribution.rows.length };
}

type AttributionRow = {
  user_id: string;
  project_id: string;
  workflow_id: string;
  project_updated_at: Date | string | null;
};

async function reclaimPhase() {
  console.log('\n--- reclaim phase ---');

  const candidates = await db.execute(sql`
    SELECT DISTINCT sp.user_id, sp.id AS project_id, sp.name,
           ws.workflow_id, sp.updated_at AS project_updated_at
    FROM workflow_snapshots ws
    JOIN saved_projects sp
      ON sp.workflow_data->>'workflowId' = ws.workflow_id
    WHERE ws.user_id IS NULL
  `);

  if (candidates.rows.length === 0) {
    console.log('No attributable orphan snapshots found. Nothing to reclaim.');
    return { attributedRows: 0, materializedProjects: 0 };
  }

  let attributedRows = 0;
  let materializedProjects = 0;

  for (const raw of candidates.rows as Array<Record<string, unknown>>) {
    const row: AttributionRow = {
      user_id: String(raw.user_id),
      project_id: String(raw.project_id),
      workflow_id: String(raw.workflow_id),
      project_updated_at: raw.project_updated_at as Date | string | null,
    };

    // 1) Re-attribute orphan snapshots to the candidate owner so history is
    //    recovered and visible in the user's snapshot list.
    const updated = await db
      .update(workflowSnapshots)
      .set({ userId: row.user_id })
      .where(
        and(
          eq(workflowSnapshots.workflowId, row.workflow_id),
          isNull(workflowSnapshots.userId),
        ),
      )
      .returning({ id: workflowSnapshots.id });
    attributedRows += updated.length;
    console.log(
      `  attributed ${updated.length} snapshots for workflow=${row.workflow_id} → user=${row.user_id}`,
    );

    // 2) Materialize the latest orphan-now-attributed snapshot's nodes/edges
    //    into the saved_project ONLY when the snapshot is newer than the
    //    project's last update. Preserves canvasObjects/viewport/flowSettings.
    const latestSnap = await db.execute(sql`
      SELECT id, nodes, edges, created_at
      FROM workflow_snapshots
      WHERE user_id = ${row.user_id} AND workflow_id = ${row.workflow_id}
      ORDER BY created_at DESC
      LIMIT 1
    `);
    if (latestSnap.rows.length === 0) continue;

    const snap = latestSnap.rows[0] as {
      nodes: unknown;
      edges: unknown;
      created_at: Date | string;
    };
    const snapTime = new Date(snap.created_at).getTime();
    const projTime = row.project_updated_at
      ? new Date(row.project_updated_at).getTime()
      : 0;

    if (snapTime > projTime) {
      const project = await db.query.savedProjects.findFirst({
        where: eq(savedProjects.id, row.project_id),
      });
      if (!project) continue;
      const existing =
        project.workflowData && typeof project.workflowData === 'object'
          ? (project.workflowData as Record<string, unknown>)
          : {};
      const merged = {
        ...existing,
        workflowId: row.workflow_id,
        nodes: snap.nodes,
        edges: snap.edges,
      };
      await db
        .update(savedProjects)
        .set({ workflowData: merged, updatedAt: new Date() })
        .where(eq(savedProjects.id, row.project_id));
      materializedProjects += 1;
      console.log(
        `  materialized latest snapshot into project=${row.project_id}`,
      );
    } else {
      console.log(
        `  skipped materialization for project=${row.project_id} (project newer than snapshot)`,
      );
    }
  }

  console.log(
    `\nreclaim summary: attributed=${attributedRows} snapshots, materialized=${materializedProjects} projects`,
  );
  return { attributedRows, materializedProjects };
}

async function deletePhase() {
  console.log(
    '\n--confirm-delete --i-understand both set — deleting remaining orphan rows...',
  );
  const result = await db
    .delete(workflowSnapshots)
    .where(isNull(workflowSnapshots.userId))
    .returning({ id: workflowSnapshots.id });
  console.log(`Deleted ${result.length} orphan rows.`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const shouldReclaim = args.has('--reclaim');
  const shouldDelete =
    args.has('--confirm-delete') && args.has('--i-understand');

  if (args.has('--delete') && !shouldDelete) {
    console.error(
      'Refusing to run: pass BOTH --confirm-delete and --i-understand to actually delete.',
    );
    process.exit(2);
  }

  await reportPhase();

  if (shouldReclaim) {
    await reclaimPhase();
    // Re-run report so the operator sees the post-reclaim state before any
    // destructive action.
    console.log('\n--- post-reclaim report ---');
    await reportPhase();
  }

  if (!shouldDelete) {
    console.log(
      '\nDry-run mode (no destructive changes were made on this run).',
    );
    if (!shouldReclaim) {
      console.log(
        'To recover orphan work into saved_projects, re-run with --reclaim.',
      );
    }
    console.log(
      'To delete remaining orphan rows, re-run with BOTH --confirm-delete --i-understand.',
    );
    process.exit(0);
  }

  await deletePhase();
  process.exit(0);
}

main().catch((err) => {
  console.error('Cleanup script failed:', err);
  process.exit(1);
});
