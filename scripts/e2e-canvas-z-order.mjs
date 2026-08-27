/**
 * Authenticated browser regression for workflow canvas layer ordering.
 *
 * CHROME_BIN=$(which chromium) node scripts/e2e-canvas-z-order.mjs
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

const USER_ID = "e2e-canvas-z-order-user";
const EMAIL = "e2e-canvas-z-order@example.com";
const PROJECT_NAME = "E2E Canvas Z Order";
const workflowData = {
  nodes: [
    {
      id: "node-a",
      type: "code",
      position: { x: 220, y: 180 },
      data: {
        label: "Overlapping code node",
        code: "console.log('layer test');",
        language: "javascript",
        outputType: "console",
        showOutput: true,
      },
      width: 400,
      height: 300,
      zIndex: 0,
    },
    {
      id: "node-b",
      type: "process",
      position: { x: 900, y: 180 },
      data: { label: "Standard node", description: "Layer neighbor" },
      width: 240,
      height: 140,
      zIndex: -10,
    },
  ],
  edges: [],
  canvasObjects: [
    {
      id: "shape-a",
      type: "shape",
      position: { x: 550, y: 420 },
      width: 190,
      height: 90,
      zIndex: 0,
      data: {
        shapeType: "rectangle",
        fillColor: "#ef4444",
        fillOpacity: 0.65,
        fillStyle: "solid",
        strokeColor: "#991b1b",
        strokeWidth: 2,
        strokeStyle: "solid",
        borderRadius: 8,
        opacity: 1,
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
  `INSERT INTO saved_projects (user_id, name, workflow_data)
   VALUES ($1, $2, $3)
   RETURNING project_uuid`,
  [USER_ID, PROJECT_NAME, JSON.stringify(workflowData)],
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
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
});
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
const page = await context.newPage();
await page.addInitScript(() => {
  localStorage.setItem("kiteframe_cookie_consent", "necessary");
});

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(
    `${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` :: ${detail}` : ""}`,
  );
};

const node = page.locator('[data-testid="code-node-node-a"]');
const otherNode = page.locator('[data-node-id="node-b"]');
const shape = page.locator('[data-testid="shape-object-shape-a"]');
const layerValues = async () => ({
  node: Number.parseInt(await node.evaluate((element) => getComputedStyle(element).zIndex), 10),
  otherNode: Number.parseInt(
    await otherNode.evaluate((element) => getComputedStyle(element).zIndex),
    10,
  ),
  shape: Number.parseInt(await shape.evaluate((element) => getComputedStyle(element).zIndex), 10),
});
const runLayerCommand = async (target, command, position) => {
  // The objects intentionally overlap; target an edge that remains exposed.
  await target.click({ button: "right", position });
  await page.getByText(command, { exact: true }).click();
  await page.waitForTimeout(300);
  return layerValues();
};

try {
  await page.goto(`${base}/project/${projectUuid}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  if ((await node.count()) === 0) {
    await page.getByText(PROJECT_NAME, { exact: true }).first().click({
      timeout: 15000,
    });
  }
  await node.waitFor({ state: "visible", timeout: 45000 });
  await otherNode.waitFor({ state: "visible", timeout: 15000 });
  await shape.waitFor({ state: "visible", timeout: 15000 });

  await shape.click({ position: { x: 95, y: 45 } });
  await page.waitForTimeout(700);
  const colorButton = page.locator('[data-testid="toolbar-button-color"]');
  await colorButton.click();
  const colorMenu = page.locator('[data-testid="toolbar-color-submenu"]');
  await colorMenu.waitFor({ state: "visible", timeout: 5000 });
  check(
    "shape Color opens with fill controls in the same popover",
    (await colorMenu.locator('[data-testid="toolbar-fill-style-options"]').isVisible()) &&
      (await colorMenu.locator('[data-testid="toolbar-color-ef4444"]').isVisible()),
  );
  check(
    "shape Color no longer has a separate Fill Style toolbar button",
    (await page.locator('[data-testid="toolbar-button-fillStyle"]').count()) === 0,
  );
  const fillStyleFromProject = async () => {
    const stored = await db.query(
      `SELECT workflow_data FROM saved_projects WHERE project_uuid = $1`,
      [projectUuid],
    );
    const data =
      typeof stored.rows[0]?.workflow_data === "string"
        ? JSON.parse(stored.rows[0].workflow_data)
        : stored.rows[0]?.workflow_data;
    return data?.canvasObjects?.find((item) => item.id === "shape-a")?.data;
  };
  for (const option of [
    ["transparent", 0.3],
    ["none", 0],
    ["solid", 0.5],
  ]) {
    const [fillStyle, fillOpacity] = option;
    await page.locator(`[data-testid="toolbar-fill-${fillStyle}"]`).click();
    await page.waitForTimeout(350);
    const updatedShape = await shape.evaluate((element) => {
      const fillElement = element.querySelector('[data-testid="shape-rectangle"]');
      return {
        selected: element.className.includes("outline-blue-500"),
        background: getComputedStyle(fillElement).backgroundColor,
      };
    });
    check(
      `choosing ${fillStyle} updates the shape immediately and keeps it selected`,
      updatedShape.selected &&
        (fillStyle === "none"
          ? updatedShape.background === "rgba(0, 0, 0, 0)"
          : updatedShape.background !== "rgba(0, 0, 0, 0)"),
      JSON.stringify(updatedShape),
    );
  }
  let persistedFillData = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.waitForTimeout(500);
    persistedFillData = await fillStyleFromProject();
    if (
      persistedFillData?.fillStyle === "solid" &&
      persistedFillData?.fillOpacity === 0.5
    ) break;
  }
  check(
    "the selected fill style persists to the project",
    persistedFillData?.fillStyle === "solid" &&
      persistedFillData?.fillOpacity === 0.5,
    JSON.stringify(persistedFillData),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);

  const initial = await layerValues();
  check(
    "legacy duplicate z-indexes load",
    initial.node === 0 && initial.otherNode === -10 && initial.shape === 0,
    JSON.stringify(initial),
  );

  const nodeForward = await runLayerCommand(
    node,
    "Bring Forward",
    { x: 5, y: 5 },
  );
  check(
    "code node moves one layer forward across a shape",
    nodeForward.node > nodeForward.shape,
    JSON.stringify(nodeForward),
  );

  await page.keyboard.press("Control+z");
  await page.waitForTimeout(350);
  const undone = await layerValues();
  check(
    "one undo restores the exact pre-move layer values",
    undone.node === 0 && undone.otherNode === -10 && undone.shape === 0,
    JSON.stringify(undone),
  );

  const shapeBack = await runLayerCommand(
    shape,
    "Send to Back",
    { x: 185, y: 85 },
  );
  check(
    "shape moves behind a code node from a duplicate legacy stack",
    shapeBack.shape < shapeBack.node,
    JSON.stringify(shapeBack),
  );

  const shapeForward = await runLayerCommand(
    shape,
    "Bring to Front",
    { x: 185, y: 85 },
  );
  check(
    "shape moves to the true front of the combined stack",
    shapeForward.shape > shapeForward.node &&
      shapeForward.shape > shapeForward.otherNode,
    JSON.stringify(shapeForward),
  );

  const nodeFront = await runLayerCommand(
    node,
    "Bring to Front",
    { x: 5, y: 5 },
  );
  check(
    "code node moves to the true front of the combined stack",
    nodeFront.node > nodeFront.shape,
    JSON.stringify(nodeFront),
  );

  const nodeBackward = await runLayerCommand(
    node,
    "Send to Back",
    { x: 5, y: 5 },
  );
  check(
    "code node preserves layer zero behind both a node and shape",
    nodeBackward.node === 0 &&
      nodeBackward.node < nodeBackward.otherNode &&
      nodeBackward.node < nodeBackward.shape,
    JSON.stringify(nodeBackward),
  );

  const nodeForwardAgain = await runLayerCommand(
    node,
    "Bring Forward",
    { x: 5, y: 5 },
  );
  check(
    "code node moves forward by exactly one combined layer",
    nodeForwardAgain.otherNode < nodeForwardAgain.node &&
      nodeForwardAgain.node < nodeForwardAgain.shape,
    JSON.stringify(nodeForwardAgain),
  );

  let persisted = null;
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
    persisted = {
      node: data?.nodes?.find((item) => item.id === "node-a")?.zIndex,
      otherNode: data?.nodes?.find((item) => item.id === "node-b")?.zIndex,
      shape: data?.canvasObjects?.find((item) => item.id === "shape-a")?.zIndex,
    };
    if (
      persisted.otherNode < persisted.node &&
      persisted.node < persisted.shape
    ) break;
  }
  check(
    "combined layer order persists to the project",
    persisted?.otherNode < persisted?.node && persisted?.node < persisted?.shape,
    JSON.stringify(persisted),
  );

  await page.reload({ waitUntil: "networkidle", timeout: 60000 });
  await node.waitFor({ state: "visible", timeout: 45000 });
  const reloaded = await layerValues();
  check(
    "combined layer order persists after reload",
    reloaded.otherNode < reloaded.node && reloaded.node < reloaded.shape,
    JSON.stringify(reloaded),
  );

  await page.screenshot({ path: "/tmp/e2e-canvas-z-order.png" });
} finally {
  await browser.close();
  await db.end();
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
