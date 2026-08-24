// Real-browser regression check for the floating Ask AI and smart
// recommendation controls. Requires the development workflow to be running.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-selection-assistant-controls.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-selection-assistant-user";
const EMAIL = "e2e-selection-assistant@example.com";

await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

const craftState = {
  ROOT: {
    type: { resolvedName: "AstryxSection" }, isCanvas: true,
    props: { direction: "row", gap: 80, padding: 40, align: "start", justify: "start" },
    displayName: "AstryxSection", custom: {}, parent: null, hidden: false,
    nodes: ["artboard-1"], linkedNodes: {},
  },
  "artboard-1": {
    type: { resolvedName: "AstryxArtboard" }, isCanvas: true,
    props: { label: "Assistant screen", width: 420, direction: "column", gap: 16, padding: 24 },
    displayName: "AstryxArtboard", custom: {}, parent: "ROOT", hidden: false,
    nodes: ["card-1"], linkedNodes: {},
  },
  "card-1": {
    type: { resolvedName: "AstryxCard" }, isCanvas: true,
    props: { padding: 16 },
    displayName: "AstryxCard", custom: {}, parent: "artboard-1", hidden: false,
    nodes: ["text-1"], linkedNodes: {},
  },
  "text-1": {
    type: { resolvedName: "AstryxText" }, isCanvas: false,
    props: { children: "Card body" },
    displayName: "AstryxText", custom: {}, parent: "card-1", hidden: false,
    nodes: [], linkedNodes: {},
  },
};

const result = await client.query(
  `INSERT INTO designs (claimed_by_user_id, craft_state, title, source)
   VALUES ($1, $2, 'E2E Selection Assistant', 'native') RETURNING id`,
  [USER_ID, JSON.stringify(craftState)],
);
const designId = result.rows[0].id;

const sid = crypto.randomBytes(16).toString("hex");
const expire = new Date(Date.now() + 24 * 3600 * 1000);
const sess = {
  cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
  passport: { user: { id: USER_ID, email: EMAIL } },
};
await client.query(
  `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)
   ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
  [sid, JSON.stringify(sess), expire],
);
await client.end();

const secret = process.env.SESSION_SECRET;
const cookieValue = `s:${sid}.${crypto.createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/, "")}`;
const domain = process.env.REPLIT_DEV_DOMAIN;
const base = `https://${domain}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addCookies([{
  name: "connect.sid", value: cookieValue, domain, path: "/",
  httpOnly: true, secure: true, sameSite: "Lax",
}]);
const page = await context.newPage();
const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` :: ${detail}` : ""}`);
};

await page.goto(`${base}/designs/${designId}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);
try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 2000 }); } catch {}

const canvasSurface = page.getByTestId("interface-canvas");
check(
  "interface builder canvas has no dot grid",
  await canvasSurface.evaluate((el) => {
    const style = getComputedStyle(el);
    return style.backgroundImage === "none" && style.backgroundSize === "auto";
  }),
);

const frameOf = (label) => page.locator(`div:text-is("${label}") >> xpath=following-sibling::div[1]`).first();
const artboard = frameOf("Assistant screen");
const artboardBox = await artboard.boundingBox();
await page.mouse.click(artboardBox.x + artboardBox.width - 10, artboardBox.y + artboardBox.height - 10);
await page.waitForTimeout(250);
check(
  "artboard selection shows Ask AI",
  await page.getByTitle("Pin this element to the AI chat").count() === 1,
);
check(
  "artboard selection shows smart suggestions",
  await page.getByTestId("smart-recommendation-group").count() === 1,
);
await page.getByTestId("smart-recommendation-add").click();
await page.waitForTimeout(250);
check(
  "artboard sparkle appends a nested content section",
  await page.getByText("Heading", { exact: true }).count() === 1,
);
check(
  "artboard sparkle includes supporting text and an action",
  await page.getByText("Text", { exact: true }).count() === 1
    && await page.getByRole("button", { name: "Button", exact: true }).count() === 1,
);
check(
  "artboard sparkle preserves existing content",
  await page.getByText("Card body", { exact: true }).count() === 1,
);
await page.getByTestId("smart-recommendation-menu").click();
await page.getByRole("button", { name: /Form starter Add a small form with two fields/ }).click();
await page.waitForTimeout(250);
check(
  "artboard menu choice appends a second nested pattern",
  await page.getByText("Email address", { exact: true }).count() === 2
    && await page.getByPlaceholder("you@company.com").count() === 2
    && await page.getByRole("button", { name: "Button", exact: true }).count() === 2,
);
check(
  "repeated pattern additions preserve the original content",
  await page.getByText("Card body", { exact: true }).count() === 1,
);

// Click the Card's empty padding around its text to select the container itself.
const textBox = await page.getByText("Card body", { exact: true }).boundingBox();
await page.mouse.click(textBox.x - 10, textBox.y - 10);
await page.waitForTimeout(250);
check(
  "supported container selection shows Ask AI",
  await page.getByTitle("Pin this element to the AI chat").count() === 1,
);
check(
  "supported container selection shows smart suggestions",
  await page.getByTestId("smart-recommendation-group").count() === 1,
);

// Select the text itself and verify leaves keep Ask AI without child suggestions.
await page.mouse.click(textBox.x + textBox.width / 2, textBox.y + textBox.height / 2);
await page.waitForTimeout(250);
check(
  "leaf selection keeps Ask AI",
  await page.getByTitle("Pin this element to the AI chat").count() === 1,
);
check(
  "leaf selection hides smart suggestions",
  await page.getByTestId("smart-recommendation-group").count() === 0,
);

await browser.close();
const failures = checks.filter((entry) => !entry.ok);
console.log(`\n${checks.length - failures.length}/${checks.length} checks passed`);
process.exit(failures.length ? 1 : 0);