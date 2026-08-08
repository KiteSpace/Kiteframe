// Real-browser regression check for task #515.
// Seeds one artboard containing bar, line, and pie charts without explicit
// dimensions, then verifies their rendered SVGs have usable widths before any
// chart is selected.
//
// Usage:
//   CHROME_BIN=$(which chromium) node scripts/e2e-chart-layout.mjs

import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const userId = "e2e-task515-user";
const email = "e2e-task515@example.com";
await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [userId, email],
);

const node = (over) => ({
  isCanvas: false,
  props: {},
  displayName: "",
  custom: {},
  hidden: false,
  nodes: [],
  linkedNodes: {},
  ...over,
});

const craftState = {
  ROOT: node({
    type: { resolvedName: "AstryxSection" },
    isCanvas: true,
    parent: null,
    displayName: "AstryxSection",
    props: { direction: "column", gap: 16, padding: 24 },
    nodes: ["artboard"],
  }),
  artboard: node({
    type: { resolvedName: "AstryxArtboard" },
    isCanvas: true,
    parent: "ROOT",
    displayName: "AstryxArtboard",
    props: { label: "Chart Layout Test", width: 720, height: 760, direction: "column", gap: 16, padding: 24 },
    nodes: ["card", "bar", "line", "pie"],
  }),
  card: node({
    type: { resolvedName: "AstryxCard" },
    isCanvas: true,
    parent: "artboard",
    displayName: "AstryxCard",
    props: { variant: "elevated", gap: 12 },
    nodes: ["card-title", "card-body"],
  }),
  "card-title": node({
    type: { resolvedName: "AstryxText" },
    parent: "card",
    displayName: "AstryxText",
    props: { children: "Card title" },
  }),
  "card-body": node({
    type: { resolvedName: "AstryxText" },
    parent: "card",
    displayName: "AstryxText",
    props: { children: "Card body" },
  }),
  bar: node({
    type: { resolvedName: "AstryxBarChart" },
    parent: "artboard",
    displayName: "AstryxBarChart",
    props: { data: "Jan:80,Feb:120,Mar:95", color: "blue" },
  }),
  line: node({
    type: { resolvedName: "AstryxLineChart" },
    parent: "artboard",
    displayName: "AstryxLineChart",
    props: { data: "Jan:80,Feb:120,Mar:95", color: "blue" },
  }),
  pie: node({
    type: { resolvedName: "AstryxPieChart" },
    parent: "artboard",
    displayName: "AstryxPieChart",
    props: { data: "A:40,B:30,C:20" },
  }),
};

const design = await client.query(
  `INSERT INTO designs (claimed_by_user_id, craft_state, title, source)
   VALUES ($1, $2, 'E2E Task 515', 'native') RETURNING id`,
  [userId, JSON.stringify(craftState)],
);
const designId = design.rows[0].id;

const sid = crypto.randomBytes(16).toString("hex");
const expire = new Date(Date.now() + 24 * 60 * 60 * 1000);
await client.query(
  `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)
   ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
  [sid, JSON.stringify({
    cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
    passport: { user: { id: userId, email } },
  }), expire],
);
const signature = crypto.createHmac("sha256", process.env.SESSION_SECRET)
  .update(sid).digest("base64").replace(/=+$/, "");
const cookieValue = `s:${sid}.${signature}`;
await client.end();

const domain = process.env.REPLIT_DEV_DOMAIN;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addCookies([{
  name: "connect.sid",
  value: cookieValue,
  domain,
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
}]);
const page = await context.newPage();
await page.goto(`https://${domain}/designs/${designId}`, {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForTimeout(1800);

const chartSizes = await page.locator("svg.recharts-surface").evaluateAll((svgs) =>
  svgs
    .map((svg) => {
      const rect = svg.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    })
    // Recharts renders tiny hidden measurement SVGs during layout. Only
    // count the three visible chart surfaces.
    .filter(({ width, height }) => width > 100 && height > 100),
);
const cardGap = await page.evaluate(() => {
  const title = [...document.querySelectorAll("*")].find((el) => el.textContent?.trim() === "Card title");
  const body = [...document.querySelectorAll("*")].find((el) => el.textContent?.trim() === "Card body");
  if (!title || !body) return null;
  let current: HTMLElement | null = title.parentElement;
  while (current) {
    const style = getComputedStyle(current);
    if (
      style.display === "flex" &&
      style.flexDirection === "column" &&
      style.gap === "12px" &&
      current.contains(body)
    ) return style.gap;
    current = current.parentElement;
  }
  return null;
});
console.log(`${cardGap === "12px" ? "PASS" : "FAIL"} — card renders its default 12px child gap`);
for (const [index, size] of chartSizes.entries()) {
  const ok = size.width > 100 && size.height > 100;
  console.log(`${ok ? "PASS" : "FAIL"} — chart ${index + 1} rendered at ${size.width}x${size.height}`);
}
console.log(`Found ${chartSizes.length}/3 chart renderers`);
await page.screenshot({ path: "/tmp/e2e-task515-chart-layout.png" });
await browser.close();

if (cardGap !== "12px" || chartSizes.length !== 3 || chartSizes.some(({ width, height }) => width <= 100 || height <= 100)) {
  process.exit(1);
}