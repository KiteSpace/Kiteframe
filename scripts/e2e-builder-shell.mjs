// Real-browser verification for task 609: Builder Shell — palette, bottom
// toolbar, Design/Preview modes, URL state.
import { chromium } from "playwright-core";

const [designId, cookieValue] = process.argv.slice(2);
const domain = process.env.REPLIT_DEV_DOMAIN;
const base = `https://${domain}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`); };

await page.goto(`${base}/designs/${designId}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
await page.screenshot({ path: "/tmp/e2e-bs-0-loaded.png" });

// ── 1. Palette renders with search, categories, and tiles ────────────────────
{
  const searchBox = page.locator('input[placeholder*="Search components"]');
  check("palette search box present", await searchBox.count() > 0);
  const catHeader = page.locator('text=Typography').first();
  check("category header visible", await catHeader.count() > 0);
  const tiles = await page.locator('[data-component-id]').count();
  check("palette tiles rendered (>40)", tiles > 40, `count=${tiles}`);
}

// ── 1b. Grid tiles show rendered thumbnail previews (not blank) ──────────────
{
  const stats = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('[data-component-id]')];
    let withPreview = 0, blank = 0, interactive = 0;
    for (const t of tiles.slice(0, 60)) {
      // The thumbnail stage is the first child div of the tile.
      const stage = t.querySelector("div");
      if (!stage) { blank++; continue; }
      const rect = stage.getBoundingClientRect();
      // Consider a tile "previewed" when its stage has visible content.
      const hasContent = stage.childElementCount > 0 && rect.height > 20;
      if (hasContent) withPreview++; else blank++;
      const style = getComputedStyle(stage);
      if (style.pointerEvents !== "none") interactive++;
    }
    return { total: tiles.length, checked: Math.min(tiles.length, 60), withPreview, blank, interactive };
  });
  check("all checked tiles show a thumbnail (none blank)", stats.blank === 0, JSON.stringify(stats));
  check("thumbnail stages are non-interactive (pointer-events none)", stats.interactive === 0, `interactive=${stats.interactive}`);
}

// ── 2. Search filters + ranking ───────────────────────────────────────────────
{
  await page.locator('input[placeholder*="Search components"]').fill("button");
  await page.waitForTimeout(500);
  const first = await page.locator('[data-component-id]').first().getAttribute("data-component-id");
  check("search 'button' ranks Button first", first === "Button", `first=${first}`);
  await page.locator('input[placeholder*="Search components"]').fill("");
  await page.waitForTimeout(400);
}

// ── 3. Grid/list toggle persists ─────────────────────────────────────────────
{
  const listBtn = page.locator('button[title="List view"]');
  if (await listBtn.count() === 0) { check("list view toggle present", false); }
  else {
    await listBtn.click();
    await page.waitForTimeout(300);
    const stored = await page.evaluate(() => localStorage.getItem("builder.panelView"));
    check("list view persisted to localStorage", stored === '"list"' || stored === "list", `stored=${stored}`);
    await page.locator('button[title="Grid view"]').click();
    await page.waitForTimeout(200);
  }
}

// ── 4. Click-to-insert adds component to artboard + records recent ──────────
{
  await page.locator('input[placeholder*="Search components"]').fill("Badge");
  await page.waitForTimeout(400);
  await page.locator('[data-component-id="Badge"]').first().click();
  await page.waitForTimeout(600);
  const inserted = await page.evaluate(() => {
    const labelEl = [...document.querySelectorAll("div")].find((d) => d.textContent === "Screen 1" && d.children.length === 0);
    const frame = labelEl?.nextElementSibling;
    return frame ? frame.textContent.includes("Badge") : false;
  });
  check("click inserts Badge into artboard", inserted);
  const recents = await page.evaluate(() => localStorage.getItem("builder.recentComponents"));
  check("recent components recorded", (recents || "").includes("Badge"), `recents=${recents}`);
  await page.locator('input[placeholder*="Search components"]').fill("");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/e2e-bs-1-inserted.png" });
}

// ── 5. Bottom toolbar present, centered, has mode toggle + zoom ─────────────
{
  const toolbar = page.locator('[data-testid="canvas-toolbar"]');
  if (await toolbar.count() === 0) { check("bottom toolbar present", false); }
  else {
    const box = await toolbar.boundingBox();
    const viewport = page.viewportSize();
    const centered = box && Math.abs((box.x + box.width / 2) - viewport.width / 2) < 250;
    const nearBottom = box && box.y > viewport.height - 200;
    check("toolbar bottom-centered", !!(centered && nearBottom), JSON.stringify(box));
    check("Design mode button present", await page.locator('button:has-text("Design")').count() > 0);
    check("Preview mode button present", await page.locator('button:has-text("Preview")').count() > 0);
  }
}

// ── 6. Enter Preview mode → clean surface, palette hidden, URL updated ──────
{
  await page.locator('[data-testid="canvas-toolbar"] button:has-text("Preview")').first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/tmp/e2e-bs-2-preview.png" });
  const url = page.url();
  check("URL has mode=preview", url.includes("mode=preview"), url);
  const paletteGone = await page.locator('input[placeholder*="Search components"]').count() === 0;
  check("palette hidden in preview", paletteGone);
  const surface = page.locator('[data-testid="preview-surface"]');
  check("preview surface mounted", await surface.count() > 0);
  // The artboard label chrome should not render inside preview surface.
  const labelInPreview = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="preview-surface"]');
    if (!s) return null;
    return [...s.querySelectorAll("div")].some((d) => d.textContent === "Screen 1" && d.children.length === 0);
  });
  check("no artboard label chrome in preview", labelInPreview === false, `labelInPreview=${labelInPreview}`);
  // Inserted Badge shows in preview (live edits reflected).
  const badgeShown = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="preview-surface"]');
    return s ? s.textContent.includes("Badge") : false;
  });
  check("preview reflects live edit (Badge)", badgeShown);
}

// ── 7. Artboard navigation in preview ────────────────────────────────────────
{
  const picker = page.locator('[data-testid="preview-artboard-picker"]');
  const nextBtn = page.locator('button[aria-label="Next screen"]');
  if (await nextBtn.count() === 0) { check("next-screen button present", false); }
  else {
    await nextBtn.click();
    await page.waitForTimeout(600);
    const url = page.url();
    check("URL screen param updates on next", /screen=/.test(url), url);
    const badgeShown = await page.evaluate(() => {
      const s = document.querySelector('[data-testid="preview-surface"]');
      return s ? s.textContent.includes("Badge") : false;
    });
    check("second screen shows different content", !badgeShown, `badgeShown=${badgeShown}`);
    await page.screenshot({ path: "/tmp/e2e-bs-3-screen2.png" });
  }
}

// ── 8. Escape returns to Design mode ─────────────────────────────────────────
{
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const url = page.url();
  check("Escape exits preview (URL)", !url.includes("mode=preview"), url);
  check("palette back in design mode", await page.locator('input[placeholder*="Search components"]').count() > 0);
  await page.screenshot({ path: "/tmp/e2e-bs-4-back.png" });
}

// ── 9. Reload with ?mode=preview restores preview ────────────────────────────
{
  await page.goto(`${base}/designs/${designId}?mode=preview`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);
  check("reload restores preview mode", await page.locator('[data-testid="preview-surface"]').count() > 0);
  await page.screenshot({ path: "/tmp/e2e-bs-5-reload-preview.png" });
}

console.log("\nSummary:", results.every((r) => r.ok) ? "ALL PASS" : "FAILURES PRESENT");
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
