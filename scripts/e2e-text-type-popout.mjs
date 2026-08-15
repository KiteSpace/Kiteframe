// Real-browser verification for task 574: Text toolbar popout (Label vs Text Field)
// Usage: CHROME_BIN=$(which chromium) node scripts/e2e-text-type-popout.mjs <cookieValue>
import { chromium } from "playwright-core";

const [cookieValue] = process.argv.slice(2);
const domain = process.env.REPLIT_DEV_DOMAIN;
const base = `https://${domain}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200)); });

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`); };

await page.goto(`${base}/app`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);
try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}
await page.screenshot({ path: "/tmp/e2e-text-0-loaded.png" });

// Dismiss any modal/dialog overlay if present
try { await page.keyboard.press("Escape"); await page.waitForTimeout(300); } catch {}

// ── 0. Create/open a project so the workflow canvas is visible ───────────────
{
  const alreadyOnCanvas = await page.locator('[data-testid="icon-type"]').first().isVisible().catch(() => false);
  if (!alreadyOnCanvas) {
    // Click the "+" button in the top bar to create a blank project
    const plusBtn = page.locator('header button, nav button, [data-testid*="new"], button[aria-label*="New"]').filter({ hasText: /^\+?$/ });
    const candidates = await page.evaluate(() => {
      return [...document.querySelectorAll("button, a")].map((el, i) => ({
        i,
        text: (el.textContent || "").trim().slice(0, 20),
        aria: el.getAttribute("aria-label"),
        testid: el.getAttribute("data-testid"),
      })).filter((c) => c.text === "+" || /new|create|plus/i.test(c.aria || "") || /new|create|plus/i.test(c.testid || ""));
    });
    console.log("plus candidates:", JSON.stringify(candidates));
    // Click the first "+" style button
    await page.evaluate(() => {
      const els = [...document.querySelectorAll("button, a")];
      const el = els.find((e) => (e.textContent || "").trim() === "+" || /new|create|plus/i.test(e.getAttribute("aria-label") || "") || /new|create|plus/i.test(e.getAttribute("data-testid") || ""));
      el?.click();
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: "/tmp/e2e-text-0b-after-plus.png" });
    // Project type chooser: pick "Workflow"
    try {
      await page.locator('text=Workflow').first().click({ timeout: 5000 });
      await page.waitForTimeout(2500);
    } catch {}
    await page.screenshot({ path: "/tmp/e2e-text-0c-after-workflow.png" });
  }
}

// ── 1. Click the Text (type) toolbar icon → popout appears ──────────────────
{
  const typeIcon = page.locator('[data-testid="icon-type"]').first();
  await typeIcon.waitFor({ state: "visible", timeout: 15000 });
  await typeIcon.click();
  await page.waitForTimeout(400);
  const popout = page.locator('[data-testid="text-type-popout"]');
  const visible = await popout.isVisible().catch(() => false);
  check("clicking Text icon opens text-type popout", visible);
  const labelCard = await page.locator('[data-testid="popout-text-type-text"]').isVisible().catch(() => false);
  const fieldCard = await page.locator('[data-testid="popout-text-type-text-field"]').isVisible().catch(() => false);
  check("popout shows Label card", labelCard);
  check("popout shows Text Field card", fieldCard);
  await page.screenshot({ path: "/tmp/e2e-text-1-popout.png" });
}

// ── 2. Click Label → creates a plain text object (regression) ───────────────
{
  await page.locator('[data-testid="popout-text-type-text"]').click();
  await page.waitForTimeout(600);
  const popoutGone = !(await page.locator('[data-testid="text-type-popout"]').isVisible().catch(() => false));
  check("popout closes after choosing Label", popoutGone);
  let labelText = false;
  for (let i = 0; i < 5 && !labelText; i++) {
    labelText = await page.evaluate(() => document.body.textContent.includes("Click to edit text"));
    if (!labelText) await page.waitForTimeout(500);
  }
  check("Label object created on canvas", labelText);
  await page.screenshot({ path: "/tmp/e2e-text-2-label-created.png" });
}

// ── 3. Click Text Field → creates rich-text object ───────────────────────────
{
  await page.locator('[data-testid="icon-type"]').first().click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid="popout-text-type-text-field"]').click();
  await page.waitForTimeout(600);
  const rtf = page.locator('[data-testid="rich-text-field-object"]').first();
  const created = await rtf.isVisible().catch(() => false);
  check("Text Field object created on canvas", created);
  await page.screenshot({ path: "/tmp/e2e-text-3-field-created.png" });
}

// ── 4. Double-click → inline editor; type text ────────────────────────────────
{
  const rtf = page.locator('[data-testid="rich-text-field-object"]').first();
  await rtf.dblclick();
  await page.waitForTimeout(400);
  const editor = page.locator('[data-testid="rich-text-editor"]');
  const editing = await editor.isVisible().catch(() => false);
  check("double-click opens inline editor", editing);
  if (editing) {
    await editor.click();
    await page.keyboard.type("Hello rich world");
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: "/tmp/e2e-text-4-editing.png" });
}

// ── 5. Select a word, format toolbar appears, apply Bold ─────────────────────
{
  // Select the word "rich" via double-click directly on the text (top-left of editor)
  const editor = page.locator('[data-testid="rich-text-editor"]');
  const box = await editor.boundingBox();
  await page.mouse.dblclick(box.x + 45, box.y + 16); // over the word text on the first line
  await page.waitForTimeout(500);
  const toolbar = page.locator('[data-testid="rich-text-format-toolbar"]');
  const toolbarVisible = await toolbar.isVisible().catch(() => false);
  check("format toolbar appears on selection", toolbarVisible);
  await page.screenshot({ path: "/tmp/e2e-text-5-toolbar.png" });
  if (toolbarVisible) {
    await toolbar.locator('button[title="Bold"]').click();
    await page.waitForTimeout(300);
    const hasBold = await editor.evaluate((el) => !!el.querySelector("b, strong, span[style*='font-weight']"));
    check("Bold applied to selected text", hasBold);
  }
}

// ── 5b. Font size select applies to selection ─────────────────────────────────
{
  const editor = page.locator('[data-testid="rich-text-editor"]');
  const box = await editor.boundingBox();
  // Select the word "world" (further right on the first line)
  await page.mouse.dblclick(box.x + 95, box.y + 16);
  await page.waitForTimeout(500);
  const toolbar = page.locator('[data-testid="rich-text-format-toolbar"]');
  const toolbarVisible = await toolbar.isVisible().catch(() => false);
  check("toolbar visible for font-size test", toolbarVisible);
  if (toolbarVisible) {
    await toolbar.locator('[data-testid="rich-text-font-size"]').selectOption("24");
    await page.waitForTimeout(400);
    const editorStillOpen = await editor.isVisible().catch(() => false);
    check("editor stays open after font-size select", editorStillOpen);
    const has24 = editorStillOpen && await editor.evaluate((el) =>
      [...el.querySelectorAll("span")].some((s) => s.style.fontSize === "24px"),
    );
    check("font size 24px applied to selected text", !!has24);
  }
  await page.screenshot({ path: "/tmp/e2e-text-5b-fontsize.png" });
}

// ── 5c. Font weight select applies to selection ───────────────────────────────
{
  const editor = page.locator('[data-testid="rich-text-editor"]');
  const box = await editor.boundingBox();
  // Select the word "Hello" (start of the first line)
  await page.mouse.dblclick(box.x + 20, box.y + 16);
  await page.waitForTimeout(500);
  const toolbar = page.locator('[data-testid="rich-text-format-toolbar"]');
  const toolbarVisible = await toolbar.isVisible().catch(() => false);
  check("toolbar visible for font-weight test", toolbarVisible);
  if (toolbarVisible) {
    await toolbar.locator('[data-testid="rich-text-font-weight"]').selectOption("300");
    await page.waitForTimeout(400);
    const editorStillOpen = await editor.isVisible().catch(() => false);
    check("editor stays open after font-weight select", editorStillOpen);
    const has300 = editorStillOpen && await editor.evaluate((el) =>
      [...el.querySelectorAll("span")].some((s) => s.style.fontWeight === "300"),
    );
    check("font weight 300 applied to selected text", !!has300);
  }
  await page.screenshot({ path: "/tmp/e2e-text-5c-fontweight.png" });
}

// ── 6. Escape commits; formatted content persists in read mode ───────────────
{
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const editorGone = !(await page.locator('[data-testid="rich-text-editor"]').isVisible().catch(() => false));
  check("Escape exits inline editor", editorGone);
  const rtf = page.locator('[data-testid="rich-text-field-object"]').first();
  const content = await rtf.textContent();
  check("content persists after commit", (content || "").includes("Hello"), (content || "").slice(0, 60));
  const boldRendered = await rtf.evaluate((el) => {
    const spans = [...el.querySelectorAll("span")];
    return spans.some((s) => {
      const w = getComputedStyle(s).fontWeight;
      return parseInt(w) >= 700;
    });
  });
  check("bold styling rendered in read mode", boldRendered);
  await page.screenshot({ path: "/tmp/e2e-text-6-committed.png" });
}

// ── 6b. Drag Label card to canvas → exactly ONE label at drop position ───────
{
  const countLabels = () => page.locator('[data-testid^="text-object-"]').count();
  const before = await countLabels();
  await page.locator('[data-testid="icon-type"]').first().click();
  await page.waitForTimeout(400);
  const card = page.locator('[data-testid="popout-text-type-text"]');
  const cardBox = await card.boundingBox();
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  // Drag in several steps to exceed the 5px threshold
  await page.mouse.move(cardBox.x + 100, cardBox.y + 50, { steps: 5 });
  await page.mouse.move(500, 600, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const after = await countLabels();
  check("dragging Label card creates exactly one label", after === before + 1, `before=${before} after=${after}`);
  const popoutClosedAfterDrag = !(await page.locator('[data-testid="text-type-popout"]').isVisible().catch(() => false));
  check("popout closes after drag-drop", popoutClosedAfterDrag);
  await page.screenshot({ path: "/tmp/e2e-text-6b-drag-label.png" });
}

// ── 6c. Drag Text Field card to canvas → exactly ONE field created ───────────
{
  const countFields = () => page.locator('[data-testid="rich-text-field-object"]').count();
  const before = await countFields();
  await page.locator('[data-testid="icon-type"]').first().click();
  await page.waitForTimeout(400);
  const card = page.locator('[data-testid="popout-text-type-text-field"]');
  const cardBox = await card.boundingBox();
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(cardBox.x + 100, cardBox.y + 50, { steps: 5 });
  await page.mouse.move(900, 650, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const after = await countFields();
  check("dragging Text Field card creates exactly one field", after === before + 1, `before=${before} after=${after}`);
  await page.screenshot({ path: "/tmp/e2e-text-6c-drag-field.png" });
}

// ── 7. Reload page → content persists (localStorage tabs) ────────────────────
{
  // Wait past the 1s debounced localStorage save before reloading
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 2000 }); } catch {}
  // After reload the app shows the home screen; click the still-open "Untitled" tab
  try {
    const onCanvas = await page.locator('[data-testid="rich-text-field-object"]').first().isVisible().catch(() => false);
    if (!onCanvas) {
      await page.locator('text=Untitled').first().click({ timeout: 10000 });
      await page.waitForTimeout(3000);
    }
  } catch (e) { console.log("tab reopen failed:", e.message?.slice(0, 100)); }
  const rtf = page.locator('[data-testid="rich-text-field-object"]').first();
  const stillThere = await rtf.isVisible().catch(() => false);
  const content = stillThere ? await rtf.textContent() : "";
  check("Text Field survives reload", stillThere && (content || "").includes("Hello"), (content || "").slice(0, 60));
  const labelStill = await page.evaluate(() => document.body.textContent.includes("Click to edit text"));
  check("Label survives reload", labelStill);
  const boldStill = stillThere && await rtf.evaluate((el) =>
    [...el.querySelectorAll("span")].some((s) => parseInt(getComputedStyle(s).fontWeight) >= 700),
  );
  check("bold formatting survives reload", !!boldStill);
  const sizeStill = stillThere && await rtf.evaluate((el) =>
    [...el.querySelectorAll("span")].some((s) => getComputedStyle(s).fontSize === "24px"),
  );
  check("font size survives reload", !!sizeStill);
  const weightStill = stillThere && await rtf.evaluate((el) =>
    [...el.querySelectorAll("span")].some((s) => getComputedStyle(s).fontWeight === "300"),
  );
  check("font weight survives reload", !!weightStill);
  await page.screenshot({ path: "/tmp/e2e-text-7-reloaded.png" });
}

console.log("\nSummary:", results.every((r) => r.ok) ? "ALL PASS" : "FAILURES PRESENT");
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
