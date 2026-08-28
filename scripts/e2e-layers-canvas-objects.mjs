/**
 * Authenticated browser regression for canvas objects in the Layers panel.
 *
 * CHROME_BIN=$(which chromium) node scripts/e2e-layers-canvas-objects.mjs
 */
import crypto from "crypto";
import pg from "pg";
import { chromium } from "playwright-core";

if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") {
  console.error("Refusing to run destructive E2E setup against production.");
  process.exit(1);
}

const { Client } = pg;
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const USER_ID = "e2e-layers-canvas-objects-user";
const EMAIL = "e2e-layers-canvas-objects@example.com";
const PROJECT_NAME = "E2E Layers Canvas Objects";
const shareUuid = crypto.randomUUID();
const workflowGroupId = "wf:finish";
const workflowData = {
  nodes: [
    {
      id: "start",
      type: "input",
      position: { x: 180, y: 180 },
      data: { label: "Start request" },
      width: 220,
      height: 120,
    },
    {
      id: "finish",
      type: "output",
      position: { x: 760, y: 180 },
      data: { label: "Finish request" },
      width: 220,
      height: 120,
    },
    {
      id: "group-node",
      type: "process",
      position: { x: 760, y: 720 },
      data: { label: "Grouped review" },
      groupId: "persisted-mixed-group",
      width: 220,
      height: 120,
    },
  ],
  edges: [{ id: "edge-1", source: "start", target: "finish" }],
  canvasObjects: [
    {
      id: "text-a",
      type: "text",
      position: { x: 220, y: 500 },
      width: 240,
      height: 80,
      data: { label: "", text: "Project heading" },
    },
    {
      id: "shape-a",
      type: "shape",
      position: { x: 560, y: 500 },
      width: 180,
      height: 100,
      data: {
        shapeType: "circle",
        fillColor: "#34d399",
        strokeColor: "#047857",
        strokeWidth: 2,
        strokeStyle: "solid",
      },
    },
    {
      id: "sticky-a",
      type: "sticky",
      position: { x: 820, y: 470 },
      width: 200,
      height: 160,
      data: { text: "Remember this" },
      workflowGroupId,
    },
    {
      id: "field-a",
      type: "text-field",
      position: { x: 1080, y: 480 },
      groupId: "persisted-mixed-group",
      width: 230,
      height: 130,
      data: {
        blocks: [
          {
            type: "paragraph",
            runs: [{ id: "run-1", text: "Customer details" }],
          },
        ],
        fontSize: 16,
        fontFamily: "Inter",
        textColor: "#111827",
      },
    },
    {
      id: "line-a",
      type: "shape",
      position: { x: 180, y: 650 },
      width: 300,
      height: 100,
      data: {
        shapeType: "line",
        startPoint: { x: 0, y: 50 },
        endPoint: { x: 300, y: 50 },
        strokeColor: "#111827",
        strokeWidth: 2,
        strokeStyle: "solid",
      },
    },
    {
      id: "arrow-a",
      type: "shape",
      position: { x: 540, y: 650 },
      width: 220,
      height: 140,
      data: {
        shapeType: "arrow",
        startPoint: { x: 210, y: 130 },
        endPoint: { x: 10, y: 10 },
        strokeColor: "#7c3aed",
        strokeWidth: 2,
        strokeStyle: "solid",
      },
    },
    {
      id: "short-line-a",
      type: "shape",
      position: { x: 820, y: 680 },
      width: 50,
      height: 50,
      data: {
        shapeType: "line",
        startPoint: { x: 30, y: 30 },
        endPoint: { x: 18, y: 20 },
        strokeColor: "#dc2626",
        strokeWidth: 1,
        strokeStyle: "solid",
      },
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

await db.query(
  `INSERT INTO users (id, email, first_name, is_beta)
   VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);
await db.query(`DELETE FROM saved_projects WHERE user_id = $1`, [USER_ID]);
const project = await db.query(
  `INSERT INTO saved_projects
     (user_id, name, workflow_data, share_uuid, is_share_enabled)
   VALUES ($1, $2, $3, $4, true)
   RETURNING project_uuid`,
  [USER_ID, PROJECT_NAME, JSON.stringify(workflowData), shareUuid],
);
const projectUuid = project.rows[0].project_uuid;

const sid = crypto.randomBytes(16).toString("hex");
await db.query(
  `INSERT INTO sessions (sid, sess, expire)
   VALUES ($1, $2, $3)
   ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
  [
    sid,
    JSON.stringify({
      cookie: {
        originalMaxAge: 86400000,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      },
      passport: { user: { id: USER_ID, email: EMAIL } },
    }),
    new Date(Date.now() + 86400000),
  ],
);
const cookieValue =
  "s:" +
  sid +
  "." +
  crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(sid)
    .digest("base64")
    .replace(/=+$/, "");

const domain = process.env.REPLIT_DEV_DOMAIN;
const base = `https://${domain}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ["--no-sandbox"],
});
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` :: ${detail}` : ""}`);
};

async function newPage({ authenticated = true } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  if (authenticated) {
    await context.addCookies([
      {
        name: "connect.sid",
        value: cookieValue,
        domain,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
  }
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("kiteframe_cookie_consent", "necessary");
    localStorage.setItem("kiteframe-project-panel-collapsed", "false");
    localStorage.setItem("kiteframe-project-panel-active-tab", "layers");
    localStorage.setItem("kiteframe-project-panel-width", "600");
  });
  return { context, page };
}

async function openLayers(page) {
  await page.locator('[data-testid="tab-layers"]').click({ timeout: 30000 });
  await page.locator('[data-testid="layers-tab"]').waitFor({
    state: "visible",
    timeout: 30000,
  });
}

const row = (page, id) =>
  page.locator(`[data-testid="row-layer-object:${id}"]`);
const group = (page, id) =>
  page.locator(`[data-testid="row-layer-group-${id}"]`);
const layerOrder = (page) =>
  page.locator('[data-testid^="row-layer-"]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-testid")),
  );
async function dragCanvasObject(page, objectId, groupId) {
  const source = row(page, objectId);
  const target = group(page, groupId);
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent("dragstart", { dataTransfer });
  await target.dispatchEvent("dragenter", { dataTransfer });
  await target.dispatchEvent("dragover", { dataTransfer });
  await target.dispatchEvent("drop", { dataTransfer });
  await row(page, objectId).dispatchEvent("dragend", { dataTransfer });
  await dataTransfer.dispose();
}
async function dropCanvasObjectWithPlainText(page, objectId, groupId) {
  const dataTransfer = await page.evaluateHandle((id) => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", id);
    return transfer;
  }, objectId);
  const target = group(page, groupId);
  await target.dispatchEvent("dragenter", { dataTransfer });
  await target.dispatchEvent("dragover", { dataTransfer });
  await target.dispatchEvent("drop", { dataTransfer });
  await dataTransfer.dispose();
}
const worldLeft = (locator) =>
  locator.evaluate((element) => {
    let current = element;
    while (current instanceof HTMLElement) {
      const left = Number.parseFloat(current.style.left);
      if (Number.isFinite(left)) return left;
      current = current.parentElement;
    }
    return Number.NaN;
  });
const boxesOverlap = (a, b) =>
  a && b &&
  a.left < b.left + b.width &&
  a.left + a.width > b.left &&
  a.top < b.top + b.height &&
  a.top + a.height > b.top;

try {
  const { context, page } = await newPage();
  await page.goto(`${base}/project/${projectUuid}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await openLayers(page);

  for (const [id, label] of [
    ["text-a", "Project heading"],
    ["shape-a", "Circle"],
    ["sticky-a", "Remember this"],
    ["field-a", "Customer details"],
  ]) {
    await row(page, id).waitFor({ state: "visible", timeout: 30000 });
    check(
      `${id} appears in Layers with a useful label`,
      (await row(page, id).innerText()).includes(label),
      await row(page, id).innerText(),
    );
  }

  const search = page.locator('[data-testid="input-layers-search"]');
  await search.fill("Remember this");
  await page.waitForTimeout(150);
  check("search finds a canvas object", await row(page, "sticky-a").isVisible());
  check("search filters unrelated canvas objects", !(await row(page, "text-a").isVisible()));
  await search.fill("");
  await search.blur();

  const lineRoot = page.locator('[data-testid="shape-object-line-a"]');
  await lineRoot.waitFor({ state: "visible", timeout: 30000 });
  check(
    "line uses a constant screen-space interaction corridor",
    (await lineRoot.locator('[data-testid="shape-line-hit-target"]').getAttribute("stroke-width")) === "16" &&
      (await lineRoot.locator('[data-testid="shape-line-hit-target"]').getAttribute("vector-effect")) === "non-scaling-stroke",
  );
  const lineBox = await lineRoot.boundingBox();
  await page.mouse.click(lineBox.x + lineBox.width / 2, lineBox.y + lineBox.height / 2 + 6);
  await page.waitForTimeout(250);
  check(
    "clicking near the visible line selects it",
    (await row(page, "line-a").getAttribute("aria-selected")) === "true",
  );
  const lineLeftBefore = await worldLeft(lineRoot);
  await page.mouse.move(lineBox.x + lineBox.width / 2, lineBox.y + lineBox.height / 2 + 6);
  await page.mouse.down();
  await page.mouse.move(lineBox.x + lineBox.width / 2 + 24, lineBox.y + lineBox.height / 2 + 6, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  check("dragging the forgiving line target moves the whole shape", (await worldLeft(lineRoot)) > lineLeftBefore);

  await lineRoot.locator('[data-testid="shape-line-hit-target"]').dispatchEvent("click");
  await page.waitForTimeout(250);
  const lineLeftBeforeEndpoint = await worldLeft(lineRoot);
  const endHandle = lineRoot.locator('[data-testid="endpoint-handle-end"]');
  const endHandleBox = await endHandle.boundingBox();
  await page.mouse.move(endHandleBox.x + endHandleBox.width / 2, endHandleBox.y + endHandleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endHandleBox.x + endHandleBox.width / 2 + 20, endHandleBox.y + endHandleBox.height / 2 + 10, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  check("endpoint dragging does not move the whole line", (await worldLeft(lineRoot)) === lineLeftBeforeEndpoint);

  const toolbarBox = await page.locator('[data-testid="linear-toolbar"]').boundingBox();
  const startHandleBox = await lineRoot.locator('[data-testid="endpoint-handle-start"]').boundingBox();
  const updatedEndHandleBox = await endHandle.boundingBox();
  check(
    "line toolbar clears both endpoint handles",
    !boxesOverlap(toolbarBox, startHandleBox) && !boxesOverlap(toolbarBox, updatedEndHandleBox),
  );

  const lineWidthBeforeZoom = (await lineRoot.boundingBox()).width;
  const workflowCanvas = page.locator('[data-testid="workflow-canvas"]');
  await workflowCanvas.hover();
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 500);
  await page.keyboard.up("Control");
  await page.waitForTimeout(250);
  check(
    "line corridor remains 16 screen pixels after zooming",
    (await lineRoot.boundingBox()).width < lineWidthBeforeZoom &&
    (await lineRoot.locator('[data-testid="shape-line-hit-target"]').getAttribute("stroke-width")) === "16" &&
      (await lineRoot.locator('[data-testid="shape-line-hit-target"]').getAttribute("vector-effect")) === "non-scaling-stroke",
  );
  check(
    "reversed diagonal arrows and short lines use the same corridor",
    (await page.locator('[data-testid="shape-object-arrow-a"] [data-testid="shape-arrow-hit-target"]').count()) === 1 &&
      (await page.locator('[data-testid="shape-object-short-line-a"] [data-testid="shape-line-hit-target"]').count()) === 1,
  );
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await openLayers(page);

  const persistentGroup = group(page, "group:persisted-mixed-group");
  await persistentGroup.waitFor({ state: "visible", timeout: 30000 });
  check("persistent mixed group appears distinctly in Layers", await persistentGroup.isVisible());
  await persistentGroup.click();
  await page.waitForTimeout(250);
  check(
    "clicking a persistent group selects its node member",
    (await page.locator('[data-node-id="group-node"]').first().getAttribute("class"))?.includes("selected"),
  );
  check(
    "clicking a persistent group selects its canvas-object member",
    (await row(page, "field-a").getAttribute("aria-selected")) === "true",
  );
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await openLayers(page);

  const groupedNodeCanvas = page.locator('[data-node-id="group-node"]').first();
  const groupedFieldCanvas = page
    .locator('[data-testid="rich-text-field-object"]')
    .filter({ hasText: "Customer details" })
    .first();
  const groupedNodeBefore = await worldLeft(groupedNodeCanvas);
  const groupedFieldBefore = await worldLeft(groupedFieldCanvas);
  await groupedFieldCanvas.dispatchEvent("click");
  await page.waitForTimeout(250);
  check(
    "clicking a grouped canvas object keeps its node member selected",
    (await groupedNodeCanvas.getAttribute("class"))?.includes("selected"),
  );
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  const groupedNodeAfter = await worldLeft(groupedNodeCanvas);
  const groupedFieldAfter = await worldLeft(groupedFieldCanvas);
  const nodeNudge = groupedNodeAfter - groupedNodeBefore;
  const fieldNudge = groupedFieldAfter - groupedFieldBefore;
  check(
    "nudging a grouped canvas object moves both member kinds together",
    nodeNudge > 0 && Math.abs(nodeNudge - fieldNudge) < 0.5,
    JSON.stringify({ nodeNudge, fieldNudge }),
  );
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await openLayers(page);
  const deletionGroup = group(page, "group:persisted-mixed-group");
  await deletionGroup.click();
  await page.waitForTimeout(250);
  const persistentGroupLock = page.locator(
    '[data-testid="button-lock-group:persisted-mixed-group"]',
  );
  await persistentGroupLock.click({ force: true });
  await page.waitForFunction(() =>
    document
      .querySelector('[data-testid="button-lock-group:persisted-mixed-group"]')
      ?.getAttribute("title")
      ?.includes("on"),
  );
  await page.keyboard.press("Delete");
  await page.waitForTimeout(250);
  await persistentGroupLock.click({ force: true });
  await page.waitForFunction(() =>
    document
      .querySelector('[data-testid="button-lock-group:persisted-mixed-group"]')
      ?.getAttribute("title")
      ?.includes("off"),
  );
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await openLayers(page);
  const lockedDeletionProject = await db.query(
    `SELECT workflow_data FROM saved_projects WHERE project_uuid = $1`,
    [projectUuid],
  );
  const lockedDeletionData =
    typeof lockedDeletionProject.rows[0].workflow_data === "string"
      ? JSON.parse(lockedDeletionProject.rows[0].workflow_data)
      : lockedDeletionProject.rows[0].workflow_data;
  check(
    "a locked persistent group cannot be partially deleted",
    lockedDeletionData.nodes.some((node) => node.id === "group-node") &&
      lockedDeletionData.canvasObjects.some((object) => object.id === "field-a"),
  );

  const selectedNode = page.locator('[data-node-id="start"]').first();
  const textObject = page.locator('[data-testid="text-object-text-a"]');
  await selectedNode.click({ force: true });
  await row(page, "text-a").click();
  await textObject.dispatchEvent("click");
  await page.waitForTimeout(300);
  check(
    "clicking an object row selects the exact canvas object",
    (await textObject.getAttribute("class"))?.includes("outline-blue-500"),
    await textObject.getAttribute("class"),
  );
  check(
    "the selected object is reflected in Layers",
    (await row(page, "text-a").getAttribute("aria-selected")) === "true",
  );
  check(
    "selecting an object row clears graph selection",
    (await page.locator('[data-node-id].selected').count()) === 0,
  );

  await dragCanvasObject(page, "shape-a", workflowGroupId);
  await page.waitForTimeout(500);
  const groupedOrder = await layerOrder(page);
  check(
    "an object can move from Standalone into a workflow",
    groupedOrder.indexOf(`row-layer-group-${workflowGroupId}`) <
      groupedOrder.indexOf("row-layer-object:shape-a") &&
      groupedOrder.indexOf("row-layer-object:shape-a") <
        groupedOrder.indexOf("row-layer-group-standalone"),
    JSON.stringify(groupedOrder),
  );

  await dropCanvasObjectWithPlainText(page, "shape-a", "standalone");
  await page.waitForTimeout(500);
  const standaloneOrder = await layerOrder(page);
  check(
    "plain-text drag fallback moves an object back to Standalone",
    standaloneOrder.indexOf("row-layer-group-standalone") <
      standaloneOrder.indexOf("row-layer-object:shape-a"),
    JSON.stringify(standaloneOrder),
  );

  await dragCanvasObject(page, "shape-a", workflowGroupId);
  await page.waitForTimeout(500);
  let persistedGroupId;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.waitForTimeout(500);
    const stored = await db.query(
      `SELECT workflow_data FROM saved_projects WHERE project_uuid = $1`,
      [projectUuid],
    );
    const data =
      typeof stored.rows[0]?.workflow_data === "string"
        ? JSON.parse(stored.rows[0].workflow_data)
        : stored.rows[0]?.workflow_data;
    persistedGroupId = data?.canvasObjects?.find(
      (object) => object.id === "shape-a",
    )?.workflowGroupId;
    if (persistedGroupId === workflowGroupId) break;
  }
  check(
    "object-to-workflow organization persists to the project",
    persistedGroupId === workflowGroupId,
    String(persistedGroupId),
  );

  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await openLayers(page);
  await row(page, "shape-a").waitFor({ state: "visible", timeout: 30000 });
  const reloadedOrder = await layerOrder(page);
  check(
    "object-to-workflow organization survives reload",
    reloadedOrder.indexOf(`row-layer-group-${workflowGroupId}`) <
      reloadedOrder.indexOf("row-layer-object:shape-a") &&
      reloadedOrder.indexOf("row-layer-object:shape-a") <
        reloadedOrder.indexOf("row-layer-group-standalone"),
    JSON.stringify(reloadedOrder),
  );
  check(
    "persistent mixed group survives reload",
    await group(page, "group:persisted-mixed-group").isVisible(),
  );
  await context.close();

  const shared = await newPage({ authenticated: false });
  await shared.page.goto(`${base}/view/${shareUuid}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await openLayers(shared.page);
  await row(shared.page, "shape-a").waitFor({ state: "visible", timeout: 30000 });
  check(
    "shared read-only Layers shows grouped canvas objects",
    await row(shared.page, "shape-a").isVisible(),
  );
  check(
    "shared viewers cannot drag canvas object rows",
    (await row(shared.page, "shape-a").getAttribute("draggable")) !== "true",
    await row(shared.page, "shape-a").getAttribute("draggable"),
  );
  check(
    "shared viewers see persistent mixed groups without an ungroup action",
    await group(shared.page, "group:persisted-mixed-group").isVisible() &&
      !(await shared.page.locator('[data-testid="button-ungroup-group:persisted-mixed-group"]').isVisible()),
  );
  await row(shared.page, "shape-a").click();
  await shared.page.waitForTimeout(250);
  check(
    "shared viewers can focus canvas object rows",
    await shared.page.locator('[data-testid="shape-object-shape-a"]').isVisible(),
  );
  const sharedLine = shared.page.locator('[data-testid="shape-object-line-a"]');
  check(
    "shared views render lines without edit hit targets or endpoint handles",
    (await sharedLine.locator('[data-testid="shape-line"]').count()) === 1 &&
      (await sharedLine.locator('[data-testid="shape-line-hit-target"]').count()) === 0 &&
      (await sharedLine.locator('[data-testid^="endpoint-handle-"]').count()) === 0 &&
      (await shared.page.locator('[data-testid="linear-toolbar"]').count()) === 0,
  );
  await shared.page.screenshot({ path: "/tmp/e2e-layers-canvas-objects.png" });
  await shared.context.close();
} finally {
  await browser.close();
  await db.end();
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);