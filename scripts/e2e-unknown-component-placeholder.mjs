// Real-browser proof for the "AI designs get discarded" defect.
//
// A generation naming a component the Astryx library doesn't have used to be
// thrown away whole: repair didn't substitute unknown names, validation then
// failed, and the user got "it used an unrecognised component type — try
// rephrasing", which could never help because the model had done nothing a
// rewording would change.
//
// The fix is to degrade the unresolvable node to a labelled placeholder so the
// rest of the design still lands. Unit tests cover the repair functions; what
// they cannot show is that craft.js actually draws the result and that the chat
// says something true about it — which is the only part the user sees.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-unknown-component-placeholder.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

// This script writes and deletes rows and mints a session. Refuse to run
// anywhere but a disposable development database.
if (process.env.REPLIT_DEPLOYMENT || process.env.NODE_ENV === "production") {
  console.error("Refusing to run destructive E2E setup against a production environment.");
  process.exit(1);
}

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-unknown-placeholder-user";
const EMAIL = "e2e-unknown-placeholder@example.com";
await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);
await client.query(`DELETE FROM designs WHERE claimed_by_user_id = $1`, [USER_ID]);

/**
 * One screen holding a heading (the "did the rest of the design survive?"
 * marker) plus whatever node the individual case is about.
 */
const stateWith = (oddNode) => ({
  ROOT: {
    type: { resolvedName: "AstryxSection" },
    displayName: "AstryxSection",
    isCanvas: true,
    props: { direction: "row", gap: 80 },
    custom: {}, hidden: false, parent: null,
    nodes: ["ab1"], linkedNodes: {},
  },
  ab1: {
    type: { resolvedName: "AstryxArtboard" },
    displayName: "AstryxArtboard",
    props: { label: "Reports", width: 390, height: 600, x: 40, y: 40 },
    custom: {}, hidden: false, parent: "ROOT", isCanvas: true,
    nodes: ["h1", "odd"], linkedNodes: {},
  },
  h1: {
    type: { resolvedName: "AstryxHeading" },
    displayName: "AstryxHeading",
    props: { children: "SURVIVING_CONTENT_MARKER" },
    custom: {}, hidden: false, parent: "ab1", isCanvas: false,
    nodes: [], linkedNodes: {},
  },
  odd: { custom: {}, hidden: false, parent: "ab1", nodes: [], linkedNodes: {}, ...oddNode },
});

const unsupportedState = stateWith({
  type: { resolvedName: "AstryxDataGrid" },
  displayName: "AstryxDataGrid",
  props: { rows: 10 },
  isCanvas: false,
});

// A node with no type at all — the one component-type problem validation
// genuinely rejects, and the reason whole designs were being discarded.
const typelessState = stateWith({ props: { children: "orphan" } });

/**
 * An unsupported CONTAINER wrapping real content. The placeholder used to be
 * leaf-only, so swapping a container hid its entire subtree — the same design
 * loss, one level below ROOT, and invisible because the node count stayed
 * healthy.
 */
const unsupportedContainerState = (() => {
  const s = stateWith({
    type: { resolvedName: "AstryxDataGrid" },
    displayName: "AstryxDataGrid",
    props: {},
    isCanvas: true,
    nodes: ["inner"],
  });
  s.odd.nodes = ["inner"];
  s.inner = {
    type: { resolvedName: "AstryxHeading" },
    displayName: "AstryxHeading",
    props: { children: "NESTED_CONTENT_MARKER" },
    custom: {}, hidden: false, parent: "odd", isCanvas: false,
    nodes: [], linkedNodes: {},
  };
  return s;
})();

// The same design as saved while the placeholder was leaf-only: the container
// is already demoted and marked as a leaf, so its child is currently hidden.
// Reopening must restore it rather than leaving the content stranded.
const legacyLeafPlaceholderState = (() => {
  const s = structuredClone(unsupportedContainerState);
  s.odd.type = { resolvedName: "AstryxUnknown" };
  s.odd.displayName = "AstryxUnknown";
  s.odd.props = { astryxComponent: "AstryxDataGrid" };
  s.odd.isCanvas = false;
  return s;
})();

const seedDesign = async (title, state) => {
  const r = await client.query(
    `INSERT INTO designs (claimed_by_user_id, source, craft_state, title)
     VALUES ($1, 'workflow-bridge', $2, $3) RETURNING id`,
    [USER_ID, JSON.stringify(state), title],
  );
  return r.rows[0].id;
};

const unsupportedId = await seedDesign("E2E Unsupported Component", unsupportedState);
const typelessId = await seedDesign("E2E Typeless Node", typelessState);
const containerId = await seedDesign("E2E Unsupported Container", unsupportedContainerState);
const legacyId = await seedDesign("E2E Legacy Leaf Placeholder", legacyLeafPlaceholderState);
const chatId = await seedDesign("E2E Chat Substitution", stateWith({
  type: { resolvedName: "AstryxText" },
  displayName: "AstryxText",
  props: { children: "placeholder text" },
  isCanvas: false,
}));

const sid = crypto.randomBytes(16).toString("hex");
await client.query(
  `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)
   ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
  [sid, JSON.stringify({
    cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
    passport: { user: { id: USER_ID, email: EMAIL } },
  }), new Date(Date.now() + 86400000)],
);
const cookieValue = "s:" + sid + "." + crypto.createHmac("sha256", process.env.SESSION_SECRET)
  .update(sid).digest("base64").replace(/=+$/, "");

const domain = process.env.REPLIT_DEV_DOMAIN;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`);
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true }]);
const page = await ctx.newPage();

const openDesign = async (id) => {
  await page.goto(`https://${domain}/designs/${id}`, { waitUntil: "networkidle", timeout: 90000 });
  try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(4000);
};

// ── An unsupported component lands as a labelled placeholder ─────────────────
await openDesign(unsupportedId);
check(
  "A design containing an unsupported component still renders its other content",
  (await page.locator('text="SURVIVING_CONTENT_MARKER"').count()) >= 1,
);
check(
  "The unsupported component shows a placeholder labelled with what was asked for",
  (await page.locator('text="[AstryxDataGrid]"').count()) >= 1,
);

// ── ...and is still there after a reload ─────────────────────────────────────
await openDesign(unsupportedId);
check(
  "The placeholder survives a reload",
  (await page.locator('text="[AstryxDataGrid]"').count()) >= 1 &&
    (await page.locator('text="SURVIVING_CONTENT_MARKER"').count()) >= 1,
);

// ── A node with no type at all is salvaged rather than blanking the screen ───
await openDesign(typelessId);
check(
  "A design with a typeless node still renders instead of coming up blank",
  (await page.locator('text="SURVIVING_CONTENT_MARKER"').count()) >= 1,
);

// ── An unsupported CONTAINER keeps the content nested inside it ──────────────
await openDesign(containerId);
check(
  "An unsupported container shows a placeholder labelled with what was asked for",
  (await page.locator('text="[AstryxDataGrid]"').count()) >= 1,
);
check(
  "The content nested inside an unsupported container still renders",
  (await page.locator('text="NESTED_CONTENT_MARKER"').count()) >= 1,
);

// ── A design saved while the placeholder was leaf-only recovers its subtree ──
await openDesign(legacyId);
check(
  "A design stored with a leaf-only placeholder gets its hidden content back",
  (await page.locator('text="NESTED_CONTENT_MARKER"').count()) >= 1,
);

// ── The chat reply tells the truth about the substitution ────────────────────
// The AI endpoint is stubbed: the model is nondeterministic and costs credits,
// and the behaviour under test is entirely in the client's apply path (repair →
// validate → sanitize → deserialize → message), which runs for real here.
await page.route("**/api/ai/design", async (route) => {
  const substituted = stateWith({
    type: { resolvedName: "AstryxDatePicker" },
    displayName: "AstryxDatePicker",
    props: { label: "Pick a date" },
    isCanvas: false,
  });
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      type: "full",
      craftState: JSON.stringify(substituted),
      message: "Design created! I've built the layout on your canvas.",
    }),
  });
});

await openDesign(chatId);
const chatInput = page.locator('[placeholder*="Ask KiteAI"]').first();
await chatInput.waitFor({ state: "visible", timeout: 20000 });
await chatInput.fill("Add a date picker to the reports screen");
await page.keyboard.press("Enter");
await page.waitForTimeout(6000);

const bodyText = await page.locator("body").innerText();

check(
  "An unsupported component from the chat lands on the canvas as a placeholder",
  (await page.locator('text="[AstryxDatePicker]"').count()) >= 1,
);
check(
  "The design the chat produced is applied, not discarded",
  (await page.locator('text="SURVIVING_CONTENT_MARKER"').count()) >= 1,
);
check(
  "The reply names the component that was replaced",
  bodyText.includes("DatePicker") && /isn't in the Astryx library/.test(bodyText),
);
check(
  "The reply suggests the closest component the user could ask for instead",
  /Closest available:[^\n]*Calendar/.test(bodyText),
  bodyText.split("\n").find((l) => l.includes("Closest available")) ?? "(no suggestion line)",
);
check(
  "The reply no longer blames the user's wording",
  !/Try rephrasing/i.test(bodyText),
);
check(
  "The reply no longer misreports the failure as an unrecognised component type",
  !/unrecognised component type/i.test(bodyText),
);
check(
  "The generation is reported as a success, not a failure",
  !/I couldn't apply that design/i.test(bodyText),
);

// ── The substituted design persists ──────────────────────────────────────────
// Autosave is debounced; give it room, then read the row the server actually
// stored rather than trusting the in-memory canvas.
await page.waitForTimeout(6000);
const stored = await client.query(`SELECT craft_state FROM designs WHERE id = $1`, [chatId]);
const storedState = stored.rows[0].craft_state ?? {};
const placeholderNode = Object.values(storedState).find(
  (n) => n?.props?.astryxComponent === "AstryxDatePicker",
);
check(
  "The stored design keeps the placeholder, labelled with the original component",
  !!placeholderNode && placeholderNode.type?.resolvedName === "AstryxUnknown",
  `stored type = ${placeholderNode?.type?.resolvedName}, label = ${placeholderNode?.props?.astryxComponent}`,
);

await openDesign(chatId);
check(
  "The substituted design still renders after a reload",
  (await page.locator('text="[AstryxDatePicker]"').count()) >= 1,
);

await browser.close();

// Leave the database as it was found.
await client.query(`DELETE FROM designs WHERE claimed_by_user_id = $1`, [USER_ID]);
await client.query(`DELETE FROM sessions WHERE sid = $1`, [sid]);
await client.query(`DELETE FROM users WHERE id = $1`, [USER_ID]);
await client.end();

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
if (passed !== results.length) {
  console.log("Failed: " + results.filter((r) => !r.ok).map((r) => r.name).join(", "));
  process.exit(1);
}
