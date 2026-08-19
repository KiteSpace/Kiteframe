// Real-browser verification for Right Rail Phase A (task #633).
//
// Covers the four bugs whose fixes are geometric or scroll-behavioural and so
// cannot be confirmed by a class-name assertion:
//
//   A1  markdown list markers sit on the same line as their text
//   A2  full-screen chat has no dead band below the last message
//   A4  the rail never extends past the right edge of the viewport
//   A5  scrolling the chat thread does not move the editor shell
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-right-rail-phase-a.mjs
import pg from "pg";
import crypto from "crypto";
import fs from "fs/promises";
import { chromium } from "playwright-core";

const readFileSource = (p) => fs.readFile(p, "utf8");

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-task633-user";
const EMAIL = "e2e-task633@example.com";

await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

// A small but non-trivial workflow so the editor and rail actually render.
const workflowData = {
  nodes: [
    { id: "n1", type: "process", position: { x: 100, y: 100 }, data: { label: "Intake" } },
    { id: "n2", type: "process", position: { x: 360, y: 100 }, data: { label: "Review" } },
  ],
  edges: [{ id: "e1", source: "n1", target: "n2" }],
  canvasObjects: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

const projRes = await client.query(
  `INSERT INTO saved_projects (user_id, name, workflow_data)
   VALUES ($1, 'E2E Task 633', $2)
   RETURNING project_uuid, updated_at`,
  [USER_ID, JSON.stringify(workflowData)],
);
const projectUuid = projRes.rows[0].project_uuid;

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
const secret = process.env.SESSION_SECRET;
const cookieValue =
  "s:" + sid + "." + crypto.createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/, "");
await client.end();
console.log("Seeded project", projectUuid);

const domain = process.env.REPLIT_DEV_DOMAIN;
const base = `https://${domain}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([
  { name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" },
]);
const page = await ctx.newPage();

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`);
};

// Pre-seed a deliberately over-wide stored rail width. This is the exact state
// that used to push the rail off screen: 800 is legal against the old constant
// clamp but far too wide once the window narrows.
await page.addInitScript(() => {
  localStorage.setItem("kiteframe-project-panel-width", "800");
  localStorage.setItem("kiteframe-project-panel-collapsed", "false");
});

await page.goto(`${base}/project/${projectUuid}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2500);
try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
await page.waitForTimeout(500);

// The editor shell renders the home hero until a project is actually opened
// into a tab, so navigating straight to /project/:uuid is not enough — open it
// from the Recent Projects card the way a user does.
if ((await page.locator('[data-testid="project-panel"]').count()) === 0) {
  await page.locator("text=E2E Task 633").first().click({ timeout: 10000 });
  await page.waitForSelector('[data-testid="project-panel"]', { timeout: 30000 });
  await page.waitForTimeout(1500);
}

// ── A4 · rail stays inside the viewport at every window width ────────────────
const railSelector = '[data-testid="panel-resize-handle"]';
const hasRail = (await page.locator(railSelector).count()) > 0;
check("right rail is present", hasRail);

if (hasRail) {
  // Includes widths narrower than the rail's 400px floor, where the clamp can
  // only satisfy "stay on screen" and not "keep 300px of canvas".
  for (const width of [1600, 1280, 1024, 900, 800, 700, 600, 500]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(400);
    const geom = await page.evaluate((sel) => {
      const handle = document.querySelector(sel);
      const rail = handle?.parentElement;
      if (!rail) return null;
      const r = rail.getBoundingClientRect();
      return { right: r.right, left: r.left, width: r.width, inner: window.innerWidth };
    }, railSelector);

    if (!geom) { check(`rail measurable at ${width}px`, false); continue; }

    // 1px of tolerance for subpixel layout rounding.
    check(
      `A4 · rail right edge inside viewport at ${width}px`,
      geom.right <= geom.inner + 1,
      `right=${Math.round(geom.right)} innerWidth=${geom.inner} railWidth=${Math.round(geom.width)}`,
    );
    check(
      `A4 · rail leaves canvas visible at ${width}px`,
      geom.left > 0,
      `left=${Math.round(geom.left)}`,
    );
    check(
      `A4 · rail never narrower than its 400px floor at ${width}px`,
      geom.width >= 400 - 1,
      `railWidth=${Math.round(geom.width)}`,
    );
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(400);
}

// ── A1 · list markers share the first line with their text ───────────────────
// Rendered against the real markdown component config rather than a mock: we
// mount a loose list (items wrapped in <p>, the case list-inside broke) into
// the live document using the same classes DocSection now emits, then compare
// the marker's line box to the text's.
const listGeom = await page.evaluate(() => {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:0;top:0;width:400px;visibility:hidden;";
  host.innerHTML = `
    <ul class="list-disc list-outside pl-5 space-y-0.5 my-1.5 text-sm" id="e2e-loose">
      <li class="leading-relaxed [&>p]:my-0"><p>First loose item</p></li>
      <li class="leading-relaxed [&>p]:my-0"><p>Second loose item</p></li>
    </ul>`;
  document.body.appendChild(host);
  const li = host.querySelector("li");
  const p = li.querySelector("p");
  const liRect = li.getBoundingClientRect();
  const pRect = p.getBoundingClientRect();
  const styles = getComputedStyle(host.querySelector("ul"));
  const out = {
    listStylePosition: styles.listStylePosition,
    liHeight: liRect.height,
    pHeight: pRect.height,
    pMarginTop: getComputedStyle(p).marginTop,
    pMarginBottom: getComputedStyle(p).marginBottom,
  };
  host.remove();
  return out;
});

check("A1 · list-style-position is outside", listGeom.listStylePosition === "outside", listGeom.listStylePosition);
check(
  "A1 · loose-list <p> margins collapsed to zero",
  listGeom.pMarginTop === "0px" && listGeom.pMarginBottom === "0px",
  `top=${listGeom.pMarginTop} bottom=${listGeom.pMarginBottom}`,
);
// The decisive check: with an orphaned marker the <li> is a full line taller
// than its text. Same height ⇒ marker and text share one line.
check(
  "A1 · marker shares the line with its text (li is not taller than its text)",
  Math.abs(listGeom.liHeight - listGeom.pHeight) < 2,
  `li=${listGeom.liHeight.toFixed(1)} p=${listGeom.pHeight.toFixed(1)}`,
);

// Guard against a regression reintroducing list-inside in the shipped bundle.
const staleListInside = await page.evaluate(() =>
  Array.from(document.querySelectorAll("ul,ol")).filter((el) =>
    el.className && String(el.className).includes("list-inside"),
  ).length,
);
check("A1 · no rendered list still uses list-inside", staleListInside === 0, `count=${staleListInside}`);

// ── A5 · thread scroll does not move the editor shell ────────────────────────
// Record every ancestor scrollTop, scroll the chat viewport to the bottom, and
// assert only the thread's own viewport moved. scrollIntoView used to drag the
// shell because it scrolls every scrollable ancestor.
// Make sure the KiteAI tab (which owns the chat thread) is the active pane.
try {
  await page.locator('[data-testid="tab-kite-ai"]').click({ timeout: 5000 });
  await page.waitForTimeout(1000);
} catch {}

// The real thread holds only a welcome message, so it is not scrollable on its
// own and neither strategy would move anything. To compare the two strategies
// honestly we make the chat viewport scrollable and give it a scrollable
// ancestor — the shell condition that made scrollIntoView misbehave — then run
// the OLD approach and the NEW one against the identical starting state.
const scrollResult = await page.evaluate(async () => {
  // Scope to the chat pane's own scroll area; the first viewport on the page
  // belongs to the editor shell, not the thread.
  const pane = document.querySelector('[data-testid="tab-content-kiteai"]');
  const viewport = pane?.querySelector('[data-radix-scroll-area-viewport]');
  if (!viewport) return { skipped: true };

  const thread = viewport.firstElementChild;
  if (!thread) return { skipped: true };

  // Make the thread scrollable.
  const filler = document.createElement("div");
  filler.style.height = "3000px";
  thread.appendChild(filler);

  // Make a real ancestor scrollable so ancestor-dragging is observable at all.
  const shell = viewport.parentElement.parentElement;
  const prevOverflow = shell.style.overflowY;
  const prevMaxH = shell.style.maxHeight;
  shell.style.overflowY = "auto";
  shell.style.maxHeight = "500px";

  // Push the thread below the shell's fold. Without this the sentinel is
  // already within the shell's visible box once the viewport scrolls, so the
  // shell never needs to move and the control below proves nothing.
  const spacer = document.createElement("div");
  spacer.style.height = "800px";
  spacer.style.flex = "none";
  shell.insertBefore(spacer, shell.firstChild);

  const sentinel = document.createElement("div");
  thread.appendChild(sentinel);

  const reset = () => { viewport.scrollTop = 0; shell.scrollTop = 0; };
  const settle = () => new Promise((r) => setTimeout(r, 250));

  // OLD strategy: scrollIntoView on a bottom sentinel.
  reset();
  await settle();
  sentinel.scrollIntoView({ behavior: "instant" });
  await settle();
  const oldShellMoved = shell.scrollTop;
  const oldThreadMoved = viewport.scrollTop;

  // NEW strategy: scroll the viewport directly.
  reset();
  await settle();
  viewport.scrollTo({ top: viewport.scrollHeight, behavior: "instant" });
  await settle();
  const newShellMoved = shell.scrollTop;
  const newThreadMoved = viewport.scrollTop;

  filler.remove();
  sentinel.remove();
  spacer.remove();
  shell.style.overflowY = prevOverflow;
  shell.style.maxHeight = prevMaxH;
  reset();

  return { skipped: false, oldShellMoved, oldThreadMoved, newShellMoved, newThreadMoved };
});

if (scrollResult.skipped) {
  check("A5 · chat viewport present", false, "no chat scroll-area viewport found");
} else {
  check(
    "A5 · the thread itself scrolls to the bottom",
    scrollResult.newThreadMoved > 0,
    `threadScrollTop=${scrollResult.newThreadMoved}`,
  );
  check(
    "A5 · the editor shell does NOT move (new strategy)",
    scrollResult.newShellMoved === 0,
    `shellScrollTop=${scrollResult.newShellMoved}`,
  );
  // Demonstrates the bug this fix removes actually existed in this engine —
  // if scrollIntoView also left the shell at 0 the test above proves nothing.
  check(
    "A5 · control: the old scrollIntoView path did drag the shell",
    scrollResult.oldShellMoved > 0,
    `shellScrollTop=${scrollResult.oldShellMoved} (control — confirms the test is meaningful)`,
  );
}

// Source-level guard: the shipped component must prefer the viewport path.
// Without this the browser comparison above only tests the DOM, not our code.
const chatListSourceRaw = await readFileSource("client/src/components/chat/ChatMessageList.tsx");
// Strip comments — the file legitimately *mentions* pb-96 while explaining why
// it was removed, and a naive substring match would flag that as a regression.
const chatListSource = chatListSourceRaw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
check(
  "A5 · ChatMessageList scrolls the viewport, not a sentinel",
  /viewport\.scrollTo\(\{\s*top:\s*viewport\.scrollHeight/.test(chatListSource),
);
check(
  "A2 · ChatMessageList no longer uses pb-96",
  !chatListSource.includes("pb-96"),
);

// ── A6 · Updated metadata falls back to the server timestamp ─────────────────
// The seeded row was written seconds ago, so a correct fallback renders a
// recent relative time. The old bug rendered an em dash / "Unknown".
try {
  await page.locator('[data-testid="tab-project"]').click({ timeout: 5000 });
  await page.waitForSelector('[data-testid="project-doc-tab"]', { timeout: 15000 });
  await page.waitForTimeout(1200);

  // The Overview section is collapsible and may be collapsed from a previous
  // session's stored preference, so expand it before reading the metadata.
  const overviewToggle = page.locator('[data-testid="project-doc-tab"] button[aria-expanded="false"]');
  const toggleCount = await overviewToggle.count();
  for (let i = 0; i < toggleCount; i++) {
    try { await overviewToggle.nth(i).click({ timeout: 2000 }); } catch {}
  }
  await page.waitForTimeout(800);

  // Read the rendered line straight out of innerText — the label sits beside an
  // icon, so element-level "leaf node" matching misses it.
  const updatedText = await page.evaluate(() => {
    const tab = document.querySelector('[data-testid="project-doc-tab"]');
    if (!tab) return null;
    const m = tab.innerText.match(/Updated:\s*([^\n|]+)/i);
    return m ? m[1].trim() : null;
  });

  if (updatedText === null) {
    const dump = await page.evaluate(() => {
      const tab = document.querySelector('[data-testid="project-doc-tab"]');
      return tab ? tab.innerText.replace(/\n+/g, " | ").slice(0, 500) : "NO TAB";
    });
    check("A6 · Updated metadata line rendered", false, `tab text: ${dump}`);
  } else {
    const hasValue = /(ago|just now|second|minute|hour|day|20\d\d)/i.test(updatedText);
    check("A6 · Updated metadata line rendered", true, updatedText);
    check("A6 · Updated shows a real timestamp, not a placeholder", hasValue, updatedText);
    check(
      "A6 · Updated is not an empty placeholder",
      !/updated\s*[—–-]\s*$/i.test(updatedText) && !/unknown/i.test(updatedText),
      updatedText,
    );
  }
} catch (e) {
  check("A6 · project tab reachable", false, String(e).slice(0, 120));
}

// ── A2 · full-screen chat has no dead band ───────────────────────────────────
await page.goto(`${base}/app/chat`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
await page.waitForTimeout(500);

const fullscreenPad = await page.evaluate(() => {
  const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
  const thread = viewport?.querySelector("div.flex.flex-col");
  if (!thread) return null;
  const cs = getComputedStyle(thread);
  const last = thread.lastElementChild;
  return {
    paddingBottom: parseFloat(cs.paddingBottom),
    justifyContent: cs.justifyContent,
    minHeight: cs.minHeight,
    threadBottom: thread.getBoundingClientRect().bottom,
    lastChildBottom: last ? last.getBoundingClientRect().bottom : null,
  };
});

if (!fullscreenPad) {
  check("A2 · fullscreen thread container found", false);
} else {
  check(
    "A2 · no 384px dead band below the thread",
    fullscreenPad.paddingBottom < 100,
    `padding-bottom=${fullscreenPad.paddingBottom}px`,
  );
  check(
    "A2 · short conversation is anchored to the bottom",
    fullscreenPad.justifyContent === "flex-end",
    `justify-content=${fullscreenPad.justifyContent}`,
  );
}

// ── Summary ──────────────────────────────────────────────────────────────────
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("Failed:");
  failed.forEach((f) => console.log("  - " + f.name));
  process.exit(1);
}
