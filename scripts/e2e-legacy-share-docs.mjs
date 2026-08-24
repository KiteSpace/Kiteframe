/**
 * Browser verification that a legacy snapshot share renders its panel docs.
 *
 * This covers the share_links fallback rather than a cloud-backed saved project:
 * the viewer must seed the Project panel with the snapshot's overview and
 * workflow spec, and old snapshots must not be required to have a project UUID.
 *
 *   CHROME_BIN=$(which chromium) node scripts/e2e-legacy-share-docs.mjs
 */
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

const { Client } = pg;
const db = new Client({ connectionString: process.env.DATABASE_URL });
const shareId = `e2e-legacy-docs-${crypto.randomUUID()}`;
const overviewText = "Legacy overview survives the shared snapshot.";
const specText = "Legacy AI workflow spec survives the shared snapshot.";

const panelDocs = {
  prdData: {
    projectName: "Legacy Share Docs",
    sections: [{ id: "overview", title: "Overview", content: overviewText }],
  },
  workflowPRDs: [
    {
      workflowId: "workflow-1",
      workflowName: "Validation Workflow",
      sections: [{ id: "purpose", title: "Purpose", content: specText }],
    },
  ],
  notesData: '{"notes":[{"id":"legacy-note","content":"Legacy shared context."}]}',
  detailsData: JSON.stringify({
    name: "Legacy Share Docs",
    description: overviewText,
    categories: ["validation"],
  }),
};

await db.connect();
await db.query(
  `INSERT INTO share_links
    (share_id, nodes, edges, canvas_objects, viewport, project_metadata, panel_docs, flow_settings)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
  [
    shareId,
    JSON.stringify([
      {
        id: "workflow-1",
        type: "process",
        position: { x: 100, y: 100 },
        data: { label: "Validate shared docs" },
      },
    ]),
    JSON.stringify([]),
    JSON.stringify([]),
    JSON.stringify({ x: 0, y: 0, zoom: 1 }),
    JSON.stringify({ name: "Legacy Share Docs", description: overviewText }),
    JSON.stringify(panelDocs),
    JSON.stringify({}),
  ],
);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const checks = [];

function check(name, ok, detail = "") {
  checks.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` :: ${detail}` : ""}`);
}

try {
  await page.goto(`${base}/view/${shareId}?panel=project`, {
    waitUntil: "domcontentloaded",
  });
  await page.locator('[data-testid="project-panel"]').waitFor({ timeout: 30000 });
  await page.locator('[data-testid="project-doc-tab"]').waitFor({ timeout: 15000 });

  const overview = await page.locator('[data-testid="project-overview-section"]').innerText();
  check("shared viewer renders the legacy overview", overview.includes(overviewText), overview.slice(0, 160));

  const seededDocs = await page.evaluate((id) => ({
    project: localStorage.getItem(`prd-project-${id}`),
    workflow: localStorage.getItem(`prd-workflow-${id}-workflow-1`),
    details: localStorage.getItem(`kiteframe-details-${id}`),
  }), shareId);
  check("viewer seeds the project spec before mounting the panel", seededDocs.project?.includes(overviewText));
  check(
    "viewer seeds the legacy workflow spec before mounting the panel",
    seededDocs.workflow?.includes(specText) && seededDocs.workflow?.includes("Validation Workflow"),
  );
  check("viewer seeds the overview details before mounting the panel", seededDocs.details?.includes("validation"));
} finally {
  await context.close();
  await browser.close();
  await db.query("DELETE FROM share_links WHERE share_id = $1", [shareId]);
  await db.end();
}

const failed = checks.filter((result) => !result.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);