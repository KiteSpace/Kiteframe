// Production spot-check: find designs in the database that still have
// content-bearing orphaned artboards (nodes whose parent says ROOT but that
// are missing from ROOT.nodes).  These are the records written during the
// bug window that have not yet been reopened+resaved by the user.
//
// When such a design IS opened (DesignPage.tsx), repairCraftStateJson runs on
// the client and the editor renders all screens; the next auto-save will fix
// the DB record.  This script lets you see how many designs still need that
// one-time recovery visit.
//
// Usage (dev):
//   node scripts/check-orphaned-designs.mjs
//   (DATABASE_URL is already set in the Replit environment)
//
// Usage (production / Neon):
//   DATABASE_URL=$NEON_DATABASE_URL node scripts/check-orphaned-designs.mjs
//
// Output: a summary table plus a JSON file at /tmp/orphaned-designs-report.json
// with the full details so you can inspect individual records.
//
// The script is READ-ONLY — it never modifies the database.

import pg from "pg";
import { writeFileSync } from "fs";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  process.exit(1);
}

const client = new Client({ connectionString });
await client.connect();

console.log("Connected to database.  Scanning designs...\n");

// Fetch all designs that have a non-null craftState.
// We do NOT load the full state via JSON_AGG in SQL because the states can
// be large; instead we stream by batch and parse in JS.
const BATCH_SIZE = 200;
let offset = 0;
let total = 0;

const orphaned = [];         // designs with content-bearing orphaned artboards
const emptyGhosts = [];      // designs with only empty orphaned artboards (ghosts)
const alreadyClean = [];     // designs with no orphans (expected baseline)
const parseErrors = [];      // designs whose craft_state couldn't be parsed

while (true) {
  const { rows } = await client.query(
    `SELECT id, claimed_by_user_id, title, updated_at, craft_state
     FROM designs
     WHERE craft_state IS NOT NULL
     ORDER BY updated_at DESC
     LIMIT $1 OFFSET $2`,
    [BATCH_SIZE, offset],
  );

  if (rows.length === 0) break;
  offset += rows.length;
  total += rows.length;

  for (const row of rows) {
    let state;
    try {
      state = typeof row.craft_state === "string"
        ? JSON.parse(row.craft_state)
        : row.craft_state;
    } catch {
      parseErrors.push({ id: row.id, title: row.title, updatedAt: row.updated_at });
      continue;
    }

    if (!state || typeof state !== "object") {
      parseErrors.push({ id: row.id, title: row.title, updatedAt: row.updated_at });
      continue;
    }

    const root = state["ROOT"];
    const rootNodes = Array.isArray(root?.nodes) ? root.nodes : [];
    const rootNodeSet = new Set(rootNodes);

    // Find artboard nodes that claim ROOT as parent but are absent from ROOT.nodes
    const contentOrphans = [];
    const ghostOrphans = [];

    for (const [nodeId, node] of Object.entries(state)) {
      if (nodeId === "ROOT" || !node || typeof node !== "object") continue;
      const n = node;
      const resolvedName = n?.type?.resolvedName;
      if (resolvedName !== "AstryxArtboard") continue;
      if (n.parent !== "ROOT") continue;
      if (rootNodeSet.has(nodeId)) continue;

      // This artboard is orphaned. Distinguish content-bearing vs empty ghost.
      const childCount = Array.isArray(n.nodes) ? n.nodes.length : 0;
      if (childCount > 0) {
        contentOrphans.push({
          nodeId,
          label: n.props?.label ?? "",
          childCount,
        });
      } else {
        ghostOrphans.push({
          nodeId,
          label: n.props?.label ?? "",
        });
      }
    }

    const record = {
      id: row.id,
      title: row.title,
      userId: row.claimed_by_user_id,
      updatedAt: row.updated_at,
    };

    if (contentOrphans.length > 0) {
      orphaned.push({ ...record, contentOrphans, ghostOrphans });
    } else if (ghostOrphans.length > 0) {
      emptyGhosts.push({ ...record, ghostOrphans });
    } else {
      alreadyClean.push(record.id);
    }
  }

  process.stdout.write(`\rScanned ${total} designs...`);
}

console.log("\n");

// ── Report ────────────────────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════════════════════");
console.log(" Orphaned Artboard Spot-Check Report");
console.log("═══════════════════════════════════════════════════════════════");
console.log(`  Total designs scanned : ${total}`);
console.log(`  Already clean         : ${alreadyClean.length}`);
console.log(`  Empty ghost orphans   : ${emptyGhosts.length}   (safe — prune removes these on open)`);
console.log(`  Content-bearing orphans: ${orphaned.length}   ← designs needing recovery visit`);
console.log(`  Parse errors          : ${parseErrors.length}`);
console.log("═══════════════════════════════════════════════════════════════\n");

if (orphaned.length === 0) {
  console.log("✅  No designs with hidden content-bearing orphaned artboards found.");
  console.log("    All affected records have already been recovered.\n");
} else {
  console.log(`⚠️   ${orphaned.length} design(s) still have hidden screens:\n`);
  for (const d of orphaned.slice(0, 20)) {
    const screens = d.contentOrphans.map((o) => `"${o.label}" (${o.childCount} child nodes)`).join(", ");
    console.log(`  ${d.id}  "${d.title ?? "(untitled)"}"  updated=${d.updatedAt?.toISOString?.() ?? d.updatedAt}`);
    console.log(`    Hidden screens: ${screens}`);
  }
  if (orphaned.length > 20) {
    console.log(`  … and ${orphaned.length - 20} more (see /tmp/orphaned-designs-report.json)`);
  }
  console.log();
}

// Write full JSON report
const report = {
  scannedAt: new Date().toISOString(),
  totalScanned: total,
  summary: {
    alreadyClean: alreadyClean.length,
    emptyGhostOrphans: emptyGhosts.length,
    contentBearingOrphans: orphaned.length,
    parseErrors: parseErrors.length,
  },
  contentBearingOrphans: orphaned,
  emptyGhostOrphans: emptyGhosts,
  parseErrors,
};
const reportPath = "/tmp/orphaned-designs-report.json";
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`Full report written to ${reportPath}\n`);

await client.end();
process.exit(orphaned.length > 0 ? 1 : 0);
