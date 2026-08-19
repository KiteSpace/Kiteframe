// Real-browser verification for Right Rail Phase C (task #635).
//
// Every claim here is about live DOM state that a class-name assertion cannot
// establish: whether a pane survived a tab switch with its scroll offset and
// draft intact, whether labels appear at a measured rail width, and whether a
// panel selection round-trips through the URL.
//
// The suite is split across two surfaces on purpose:
//
//   * the editor (/project/:uuid) — everything interactive. The editor only
//     opens a routed project when it is clicked out of Recent Projects, and a
//     reload drops it again (a pre-existing quirk of the editor's tab loader,
//     unrelated to the rail), so these run in one uninterrupted session.
//   * the shared viewer (/view/:shareId) — mounts ProjectPanel directly on a
//     cold load, which is the only way to test what the rail reads from the
//     URL and from localStorage *at mount*.
//
//   CHROME_BIN=$(which chromium) node scripts/e2e-right-rail-phase-c.mjs
import pg from "pg";
import crypto from "crypto";
import { chromium } from "playwright-core";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const USER_ID = "e2e-task635-user";
const EMAIL = "e2e-task635@example.com";
const PROJECT_NAME = "E2E Task 635";

await client.query(
  `INSERT INTO users (id, email, first_name, is_beta) VALUES ($1, $2, 'E2E', true)
   ON CONFLICT (id) DO UPDATE SET is_beta = true`,
  [USER_ID, EMAIL],
);

// Enough nodes that the Layers pane scrolls — a pane that fits entirely on
// screen cannot demonstrate that a scroll position survived anything.
const nodes = Array.from({ length: 40 }, (_, i) => ({
  id: `n${i}`,
  type: "process",
  position: { x: 100 + (i % 5) * 220, y: 100 + Math.floor(i / 5) * 140 },
  data: { label: `Step number ${i}` },
}));
const edges = Array.from({ length: 39 }, (_, i) => ({
  id: `e${i}`,
  source: `n${i}`,
  target: `n${i + 1}`,
}));
const workflowData = { nodes, edges, canvasObjects: [], viewport: { x: 0, y: 0, zoom: 1 } };

// Each run seeds fresh; otherwise the user accumulates identical projects and
// "open the Recent Projects card" stops being unambiguous.
await client.query(`DELETE FROM saved_projects WHERE user_id = $1`, [USER_ID]);

const shareUuid = crypto.randomUUID();
const projRes = await client.query(
  `INSERT INTO saved_projects (user_id, name, workflow_data, share_uuid, is_share_enabled)
   VALUES ($1, $2, $3, $4, true)
   RETURNING project_uuid`,
  [USER_ID, PROJECT_NAME, JSON.stringify(workflowData), shareUuid],
);
const projectUuid = projRes.rows[0].project_uuid;

const sid = crypto.randomBytes(16).toString("hex");
await client.query(
  `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3)
   ON CONFLICT (sid) DO UPDATE SET sess = $2, expire = $3`,
  [
    sid,
    JSON.stringify({
      cookie: { originalMaxAge: 86400000, httpOnly: true, secure: true, sameSite: "lax", path: "/" },
      passport: { user: { id: USER_ID, email: EMAIL } },
    }),
    new Date(Date.now() + 24 * 3600 * 1000),
  ],
);
const cookieValue =
  "s:" +
  sid +
  "." +
  crypto.createHmac("sha256", process.env.SESSION_SECRET).update(sid).digest("base64").replace(/=+$/, "");
await client.end();
console.log("Seeded project", projectUuid, "share", shareUuid);

const domain = process.env.REPLIT_DEV_DOMAIN;
const base = `https://${domain}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`);
};

const TABS = ["tab-kite-ai", "tab-project", "tab-layers", "tab-comments", "tab-insights"];

async function newPage(storage = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addCookies([
    { name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" },
  ]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => {
    const m = e.message.split("\n")[0];
    if (!/WebSocket/i.test(m)) console.log("PAGEERROR:", m);
  });
  await page.addInitScript((s) => {
    localStorage.setItem("kiteframe-project-panel-width", "600");
    localStorage.setItem("kiteframe-project-panel-collapsed", "false");
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, storage);
  return { ctx, page };
}

async function dismissCookieBanner(page) {
  try {
    await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 });
  } catch {}
}

const labelState = (page) =>
  page.evaluate((tabs) => {
    const out = {};
    for (const t of tabs) {
      const el = document.querySelector(`[data-testid="${t}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      out[t] = {
        text: (el.textContent || "").trim(),
        visible: r.width > 0 && r.height > 0,
        active: el.getAttribute("data-state") === "active",
        tip: el.getAttribute("data-tip"),
      };
    }
    const rail = document.querySelector('[data-testid="project-panel"]');
    out._railWidth = rail ? Math.round(rail.getBoundingClientRect().width) : 0;
    out._isWide = rail ? rail.classList.contains("is-wide") : null;
    return out;
  }, TABS);

// ══ Part 1 — the editor, one uninterrupted session ═════════════════════════
{
  const { ctx, page } = await newPage();
  await page.goto(`${base}/project/${projectUuid}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await dismissCookieBanner(page);

  if ((await page.locator('[data-testid="project-panel"]').count()) === 0) {
    await page.locator(`text=${PROJECT_NAME}`).first().click({ timeout: 15000 });
  }
  await page.waitForSelector('[data-testid="project-panel"]', { timeout: 45000 });
  await page.waitForTimeout(2500);

  // ── the tab set ──────────────────────────────────────────────────────────
  const present = [];
  for (const t of TABS) present.push(await page.locator(`[data-testid="${t}"]`).count());
  check("all five tabs are present", present.every((c) => c === 1), present.join(","));
  check("the Notes tab is gone", (await page.locator('[data-testid="tab-notes"]').count()) === 0);

  // ── keep-alive: scroll position ──────────────────────────────────────────
  await page.locator('[data-testid="tab-layers"]').click();
  await page.waitForTimeout(1500);

  const scrolled = await page.evaluate(() => {
    const pane = document.querySelector('[data-testid="layers-tab"]');
    if (!pane) return null;
    const el = [pane, ...pane.querySelectorAll("*")].find((n) => n.scrollHeight > n.clientHeight + 20);
    if (!el) return null;
    el.scrollTop = 150;
    return el.scrollTop;
  });
  check("the Layers pane scrolls at all (precondition)", scrolled > 0, String(scrolled));

  await page.locator('[data-testid="tab-project"]').click();
  await page.waitForTimeout(800);

  check(
    "the Layers pane stays mounted while another tab is shown",
    (await page.locator('[data-testid="layers-tab"]').count()) === 1,
  );
  const hiddenInfo = await page.evaluate(() => {
    const pane = document.querySelector('[data-testid="layers-tab"]');
    if (!pane) return { error: "no layers pane" };
    const panel = pane.closest('[role="tabpanel"]');
    if (!panel) return { error: "no tabpanel ancestor", paneParent: pane.parentElement?.className };
    return {
      display: getComputedStyle(panel).display,
      hasHiddenAttr: panel.hasAttribute("hidden"),
      state: panel.getAttribute("data-state"),
      panelClass: panel.className,
      rootHasClass: !!panel.closest(".kf-project-panel"),
      rect: panel.getBoundingClientRect().width,
    };
  });
  check(
    "the hidden pane is not painted over the active one",
    hiddenInfo.display === "none",
    JSON.stringify(hiddenInfo),
  );

  await page.locator('[data-testid="tab-layers"]').click();
  await page.waitForTimeout(800);
  const afterScroll = await page.evaluate(() => {
    const pane = document.querySelector('[data-testid="layers-tab"]');
    const el = [pane, ...pane.querySelectorAll("*")].find((n) => n.scrollHeight > n.clientHeight + 20);
    return el?.scrollTop ?? null;
  });
  check("scroll position survives a tab switch and back", afterScroll === 150, `scrollTop=${afterScroll}`);

  // ── keep-alive: the chat composer draft ──────────────────────────────────
  await page.locator('[data-testid="tab-kite-ai"]').click();
  await page.waitForTimeout(1000);
  const composer = page.locator('[data-testid="input-kiteai-message"]');
  if ((await composer.count()) > 0) {
    await composer.fill("a draft that must survive tab switching");
    await page.locator('[data-testid="tab-comments"]').click();
    await page.waitForTimeout(800);
    await page.locator('[data-testid="tab-kite-ai"]').click();
    await page.waitForTimeout(800);

    const draft = await page.locator('[data-testid="input-kiteai-message"]').inputValue();
    check(
      "the chat composer draft survives a tab switch",
      draft === "a draft that must survive tab switching",
      JSON.stringify(draft),
    );
    // A textarea that was mounted while hidden collapses to zero height.
    const h = await composer.evaluate((el) => el.getBoundingClientRect().height);
    check("the composer still has a usable height after being hidden", h > 20, `${Math.round(h)}px`);
  } else {
    check("the chat composer draft survives a tab switch", false, "composer not found");
  }

  // ── the URL follows the open tab ─────────────────────────────────────────
  check("switching tabs writes ?panel= to the URL", /[?&]panel=kite-ai/.test(page.url()), page.url().split("?")[1] || "(none)");
  await page.locator('[data-testid="tab-insights"]').click();
  await page.waitForTimeout(600);
  check("the URL follows every subsequent switch", /[?&]panel=diagnostics/.test(page.url()), page.url().split("?")[1] || "");

  // ── notes are authorable in the Project tab ──────────────────────────────
  await page.locator('[data-testid="tab-project"]').click();
  await page.waitForTimeout(1200);
  const section = page.locator('[data-testid="project-notes-section"]');
  check("the Notes section is in the Project tab", (await section.count()) === 1);

  if ((await section.count()) === 1) {
    await section.locator('[data-testid="notes-field"]').click();
    await page.waitForTimeout(400);
    const input = page.locator('[data-testid="input-notes"]');
    if ((await input.count()) > 0) {
      await input.fill("Phase C notes written in the Project tab.");
      await page.waitForTimeout(3000); // autosave debounce
      const stored = await page.evaluate(() =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith("kiteframe-notes-"))
          .map((k) => localStorage.getItem(k))
          .join("|"),
      );
      check(
        "notes written in the Project tab are persisted",
        stored.includes("Phase C notes written in the Project tab."),
        stored.slice(0, 90) || "(nothing stored)",
      );
    } else {
      check("notes written in the Project tab are persisted", false, "notes input never appeared");
    }
  }

  // ── progressive labels, measured off the real rail ───────────────────────
  // Drag to the 400px floor rather than reloading with a stored width.
  // The rail resizes from a mousemove listener that React only attaches after
  // the mousedown state update commits, so the pointer has to pause on the
  // handle before moving or the first part of the gesture is dropped.
  const dragTo = async (targetWidth) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const box = await page.locator('[data-testid="panel-resize-handle"]').boundingBox();
      const rail = await page.locator('[data-testid="project-panel"]').boundingBox();
      if (Math.abs(rail.width - targetWidth) <= 2) return;

      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width / 2, y);
      await page.mouse.down();
      await page.waitForTimeout(200);
      await page.mouse.move(box.x - (targetWidth - rail.width), y, { steps: 25 });
      await page.waitForTimeout(150);
      await page.mouse.up();
      await page.waitForTimeout(600);
    }
  };

  await dragTo(400);
  {
    const s = await labelState(page);
    check("the rail can be dragged to its 400px minimum", s._railWidth === 400, `${s._railWidth}px`);
    check("the rail is not in wide mode at 400px", s._isWide === false, `is-wide=${s._isWide}`);
    check(
      "all five tabs are visible at 400px",
      TABS.every((t) => s[t]?.visible),
      TABS.map((t) => `${t}:${s[t]?.visible}`).join(" "),
    );
    const labelled = TABS.filter((t) => s[t]?.text.length > 0);
    const active = TABS.filter((t) => s[t]?.active);
    check(
      "only the active tab is labelled at 400px",
      labelled.length === 1 && labelled[0] === active[0],
      `labelled=[${labelled}] active=[${active}]`,
    );
    const inactive = TABS.filter((t) => !s[t]?.active);
    check(
      "every unlabelled tab carries a tooltip",
      inactive.every((t) => !!s[t]?.tip),
      inactive.map((t) => `${t}:${s[t]?.tip}`).join(" "),
    );

    await page.locator('[data-testid="tab-comments"]').click();
    await page.waitForTimeout(600);
    check(
      "an icon-only tab is still clickable at 400px",
      (await page.locator('[data-testid="tab-comments"]').getAttribute("data-state")) === "active",
    );
  }

  await dragTo(560);
  {
    const s = await labelState(page);
    check("dragging past 480px switches the rail to wide mode", s._isWide === true, `${s._railWidth}px is-wide=${s._isWide}`);
    const labelled = TABS.filter((t) => s[t]?.text.length > 0);
    check("all five labels appear when wide", labelled.length === 5, `labelled=[${labelled}]`);
    check(
      "labelled tabs drop their tooltip attribute",
      TABS.every((t) => !s[t]?.tip),
      TABS.map((t) => `${t}:${s[t]?.tip}`).join(" "),
    );
  }

  await dragTo(420);
  {
    const s = await labelState(page);
    check("dragging back below 480px leaves wide mode", s._isWide === false, `${s._railWidth}px`);
    check("only the active label remains after narrowing", TABS.filter((t) => s[t]?.text.length > 0).length === 1);
  }

  // ── the active pill is grey, the violet stays on the KiteAI icon ─────────
  await page.locator('[data-testid="tab-project"]').click();
  await page.waitForTimeout(600);
  const colours = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="tab-project"]');
    const icon = document.querySelector('[data-testid="tab-kite-ai"] svg');
    return {
      bg: getComputedStyle(el).backgroundColor,
      kiteIcon: icon ? getComputedStyle(icon).color : null,
    };
  });
  const parse = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  {
    const [r, g, b] = parse(colours.bg);
    check("the active tab pill is grey, not violet", Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b)) < 12, colours.bg);
    const [ir, ig, ib] = parse(colours.kiteIcon || "0,0,0");
    check("the KiteAI icon keeps its violet", ib > ir && ib > ig + 30, colours.kiteIcon || "(none)");
  }

  // ── collapse / expand ────────────────────────────────────────────────────
  await page.locator('[data-testid="button-collapse-panel"]').click();
  await page.waitForTimeout(800);
  const stripWidth = await page
    .locator('[data-testid="project-panel-collapsed"]')
    .evaluate((el) => Math.round(el.getBoundingClientRect().width));
  check("the collapsed rail is a 48px icon strip", stripWidth === 48, `${stripWidth}px`);

  await page.locator('[data-testid="collapsed-tab-layers"]').click();
  await page.waitForTimeout(1200);
  const expandedWidth = await page
    .locator('[data-testid="project-panel"]')
    .evaluate((el) => el.getBoundingClientRect().width);
  check(
    "clicking a collapsed icon expands to that tab",
    expandedWidth > 100 && (await page.locator('[data-testid="tab-layers"]').getAttribute("data-state")) === "active",
    `width=${Math.round(expandedWidth)}`,
  );

  await ctx.close();
}

// ══ Part 2 — cold mounts on the shared viewer ══════════════════════════════
async function openViewer(query = "", storage = {}) {
  const { ctx, page } = await newPage(storage);
  await page.goto(`${base}/view/${shareUuid}${query}`, { waitUntil: "networkidle", timeout: 60000 });
  await dismissCookieBanner(page);
  await page.waitForSelector('[data-testid="project-panel"]', { timeout: 45000 });
  await page.waitForTimeout(2000);
  return { ctx, page };
}

{
  const { ctx, page } = await openViewer("?panel=layers");
  check(
    "?panel=layers opens the Layers tab on a cold load",
    (await page.locator('[data-testid="tab-layers"]').getAttribute("data-state")) === "active",
  );
  check("the shared viewer shows all five tabs", (await page.locator('[data-testid="tab-comments"]').count()) === 1);
  await ctx.close();
}

{
  const { ctx, page } = await openViewer("?fromChat=true&panel=comments");
  check(
    "?panel works alongside another query parameter",
    (await page.locator('[data-testid="tab-comments"]').getAttribute("data-state")) === "active",
  );

  await page.locator('[data-testid="tab-project"]').click();
  await page.waitForTimeout(700);
  const url = page.url();
  check("switching tabs updates the panel parameter", /[?&]panel=project/.test(url), url.split("?")[1] || "");
  check("the unrelated query parameter is preserved", /[?&]fromChat=true/.test(url), url.split("?")[1] || "");
  await ctx.close();
}

{
  const { ctx, page } = await openViewer("", { "kiteframe-project-panel-active-tab": "notes" });
  check(
    "a stored 'notes' tab reopens as Project",
    (await page.locator('[data-testid="tab-project"]').getAttribute("data-state")) === "active",
  );
  const migrated = await page.evaluate(() => localStorage.getItem("kiteframe-project-panel-active-tab"));
  check("the stale 'notes' value is rewritten in storage", migrated === "project", String(migrated));
  await ctx.close();
}

{
  const { ctx, page } = await openViewer("?panel=bogus");
  check(
    "an unknown ?panel value falls back instead of showing nothing",
    (await page.locator('[data-testid="tab-kite-ai"]').getAttribute("data-state")) === "active",
  );
  await ctx.close();
}

// The Project pane is kept mounted, so a shared viewer that is already open
// must still pick up notes the author changes. This reproduces exactly what
// the viewer's websocket handler does on an incoming update.
{
  const { ctx, page } = await openViewer("?panel=project");
  const section = page.locator('[data-testid="project-notes-section"]');
  check("the shared viewer shows the Notes section", (await section.count()) === 1);

  await page.evaluate((id) => {
    localStorage.setItem(
      `kiteframe-notes-${id}`,
      JSON.stringify({ content: "Author updated these notes live.", lastSaved: new Date().toISOString() }),
    );
    window.dispatchEvent(new CustomEvent("kiteframe:panelDataRefresh", { detail: { projectId: id } }));
  }, shareUuid);
  await page.waitForTimeout(1200);

  const shown = (await section.locator('[data-testid="notes-field"]').textContent()) || "";
  check(
    "an open shared viewer picks up the author's note update without reloading",
    shown.includes("Author updated these notes live."),
    shown.trim().slice(0, 80),
  );

  // A viewer must never appear to author notes: they are stored per-browser,
  // so an editable box here would silently discard everything typed into it.
  await section.locator('[data-testid="notes-field"]').click();
  await page.waitForTimeout(500);
  check(
    "the shared viewer cannot edit notes",
    (await page.locator('[data-testid="input-notes"]').count()) === 0,
  );

  const before = await page.evaluate((id) => localStorage.getItem(`kiteframe-notes-${id}`), shareUuid);
  await page.waitForTimeout(2500); // longer than the autosave debounce
  const after = await page.evaluate((id) => localStorage.getItem(`kiteframe-notes-${id}`), shareUuid);
  check("the shared viewer does not rewrite stored notes", before === after);

  await ctx.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
