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

// ── 4b. Format toolbar is anchored to the field, not the selection ───────────
{
  const rtf = page.locator('[data-testid="rich-text-field-object"]').first();
  const editor = page.locator('[data-testid="rich-text-editor"]');
  const toolbar = page.locator('[data-testid="rich-text-format-toolbar"]');

  const visibleWithNoSelection = await toolbar.isVisible().catch(() => false);
  check("format toolbar is visible on entering edit (no selection yet)", visibleWithNoSelection);

  const fieldBox = await rtf.boundingBox();
  const tb0 = await toolbar.boundingBox().catch(() => null);
  if (tb0 && fieldBox) {
    const centredOnField = Math.abs((tb0.x + tb0.width / 2) - (fieldBox.x + fieldBox.width / 2)) <= 4;
    check("format toolbar is horizontally centred on the field", centredOnField,
      `toolbarCx=${(tb0.x + tb0.width / 2).toFixed(1)} fieldCx=${(fieldBox.x + fieldBox.width / 2).toFixed(1)}`);
    check("format toolbar sits above the field", tb0.y + tb0.height <= fieldBox.y + 1,
      `toolbarBottom=${(tb0.y + tb0.height).toFixed(1)} fieldTop=${fieldBox.y.toFixed(1)}`);
  } else {
    check("format toolbar is horizontally centred on the field", false, "no toolbar box");
    check("format toolbar sits above the field", false, "no toolbar box");
  }

  // Select two different words — the toolbar must not move
  const box = await editor.boundingBox();
  await page.mouse.dblclick(box.x + 20, box.y + 16);
  await page.waitForTimeout(250);
  const tb1 = await toolbar.boundingBox().catch(() => null);
  await page.mouse.dblclick(box.x + 95, box.y + 16);
  await page.waitForTimeout(250);
  const tb2 = await toolbar.boundingBox().catch(() => null);
  const stable = !!tb0 && !!tb1 && !!tb2 &&
    Math.abs(tb1.x - tb0.x) < 2 && Math.abs(tb1.y - tb0.y) < 2 &&
    Math.abs(tb2.x - tb0.x) < 2 && Math.abs(tb2.y - tb0.y) < 2;
  check("format toolbar does not move when the selection changes", stable,
    `t0=${tb0 && tb0.x.toFixed(0) + "," + tb0.y.toFixed(0)} t1=${tb1 && tb1.x.toFixed(0) + "," + tb1.y.toFixed(0)} t2=${tb2 && tb2.x.toFixed(0) + "," + tb2.y.toFixed(0)}`);
  await page.screenshot({ path: "/tmp/e2e-text-4b-toolbar-anchor.png" });
}

// ── 5. Bold applies, toggles off, and toggles back on ───────────────────────
{
  const editor = page.locator('[data-testid="rich-text-editor"]');
  const box = await editor.boundingBox();
  const selectRich = async () => {
    await page.mouse.dblclick(box.x + 45, box.y + 16); // the word "rich"
    await page.waitForTimeout(300);
  };
  const toolbar = page.locator('[data-testid="rich-text-format-toolbar"]');
  const boldBtn = toolbar.locator('[data-testid="rich-text-bold"]');
  const countBold = () => editor.evaluate((el) => el.querySelectorAll("b, strong").length);

  await selectRich();
  const toolbarVisible = await toolbar.isVisible().catch(() => false);
  check("format toolbar available for bold test", toolbarVisible);

  await boldBtn.click();
  await page.waitForTimeout(300);
  const afterOn = await countBold();
  check("Bold applied to selected text", afterOn > 0, `boldTags=${afterOn}`);

  const activeAfterOn = await boldBtn.getAttribute("data-active");
  check("Bold button reflects the active state", activeAfterOn === "true", `data-active=${activeAfterOn}`);

  // Toggle off again on the same word
  await selectRich();
  await boldBtn.click();
  await page.waitForTimeout(300);
  const afterOff = await countBold();
  check("Bold toggles back off", afterOff === 0, `boldTags=${afterOff}`);

  // Re-apply so later persistence checks have something to verify
  await selectRich();
  await boldBtn.click();
  await page.waitForTimeout(300);
  const afterReOn = await countBold();
  check("Bold re-applies after being toggled off", afterReOn > 0, `boldTags=${afterReOn}`);
  await page.screenshot({ path: "/tmp/e2e-text-5-bold.png" });
}

// ── 5a. Italic and underline apply to the selection ──────────────────────────
{
  const editor = page.locator('[data-testid="rich-text-editor"]');
  const box = await editor.boundingBox();
  const toolbar = page.locator('[data-testid="rich-text-format-toolbar"]');

  await page.mouse.dblclick(box.x + 20, box.y + 16); // "Hello"
  await page.waitForTimeout(300);
  await toolbar.locator('[data-testid="rich-text-italic"]').click();
  await page.waitForTimeout(300);
  const italicCount = await editor.evaluate((el) => el.querySelectorAll("i, em").length);
  check("Italic applied to selected text", italicCount > 0, `italicTags=${italicCount}`);

  await page.mouse.dblclick(box.x + 20, box.y + 16);
  await page.waitForTimeout(300);
  await toolbar.locator('[data-testid="rich-text-underline"]').click();
  await page.waitForTimeout(300);
  const underlineCount = await editor.evaluate((el) => el.querySelectorAll("u").length);
  check("Underline applied to selected text", underlineCount > 0, `underlineTags=${underlineCount}`);

  // Toggle italic back off — the underline must survive
  await page.mouse.dblclick(box.x + 20, box.y + 16);
  await page.waitForTimeout(300);
  await toolbar.locator('[data-testid="rich-text-italic"]').click();
  await page.waitForTimeout(300);
  const italicAfterOff = await editor.evaluate((el) => el.querySelectorAll("i, em").length);
  const underlineAfterOff = await editor.evaluate((el) => el.querySelectorAll("u").length);
  check("Italic toggles back off", italicAfterOff === 0, `italicTags=${italicAfterOff}`);
  check("Underline survives toggling italic off", underlineAfterOff > 0, `underlineTags=${underlineAfterOff}`);
  await page.screenshot({ path: "/tmp/e2e-text-5a-italic-underline.png" });
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

// ── 6a. Selection border and resize handles are NOT clipped ──────────────────
{
  const rtf = page.locator('[data-testid="rich-text-field-object"]').first();
  // Single click selects the field (and shows the resize handles)
  const fb = await rtf.boundingBox();
  await page.mouse.click(fb.x + fb.width / 2, fb.y + fb.height - 8);
  await page.waitForTimeout(600);

  const overflow = await rtf.evaluate((el) => getComputedStyle(el).overflow);
  check("text field wrapper does not clip its overflow", overflow === "visible", `overflow=${overflow}`);

  const positions = ["top-left", "top-right", "bottom-left", "bottom-right"];
  const field = await rtf.boundingBox();
  let allPresent = true;
  let allOutside = true;
  const detail = [];
  for (const pos of positions) {
    const h = page.locator(`[data-testid="resize-handle-${pos}"]`).first();
    const hb = await h.boundingBox().catch(() => null);
    if (!hb || hb.width <= 0 || hb.height <= 0) { allPresent = false; detail.push(`${pos}:missing`); continue; }
    const cx = hb.x + hb.width / 2;
    const cy = hb.y + hb.height / 2;
    // Each handle is centred on a corner, so half of it sits outside the field
    const outsideX = pos.includes("left") ? hb.x < field.x : hb.x + hb.width > field.x + field.width;
    const outsideY = pos.includes("top") ? hb.y < field.y : hb.y + hb.height > field.y + field.height;
    if (!(outsideX && outsideY)) { allOutside = false; detail.push(`${pos}:inside`); }
    else detail.push(`${pos}:${cx.toFixed(0)},${cy.toFixed(0)}`);
  }
  check("all four resize handles are rendered", allPresent, detail.join(" "));
  check("resize handles extend outside the field bounds (not clipped)", allOutside, detail.join(" "));

  // Bottom handles are never covered by the toolbar — prove they are painted
  const hitTest = await page.evaluate(() => {
    const out = {};
    for (const pos of ["bottom-left", "bottom-right"]) {
      const el = document.querySelector(`[data-testid="resize-handle-${pos}"]`);
      if (!el) { out[pos] = "missing"; continue; }
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      out[pos] = hit ? (hit.getAttribute("data-testid") || hit.tagName) : "none";
    }
    return out;
  });
  const hitOk = hitTest["bottom-left"] === "resize-handle-bottom-left" &&
                hitTest["bottom-right"] === "resize-handle-bottom-right";
  check("resize handles are hit-testable at their corners", hitOk, JSON.stringify(hitTest));
  await page.screenshot({ path: "/tmp/e2e-text-6a-handles.png" });
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

// ── 6d. Bullet list can be created and toggled off ───────────────────────────
{
  const second = page.locator('[data-testid="rich-text-field-object"]').nth(1);
  await second.dblclick();
  await page.waitForTimeout(500);
  const editor = page.locator('[data-testid="rich-text-editor"]');
  const opened = await editor.isVisible().catch(() => false);
  check("second Text Field opens for editing", opened);
  if (opened) {
    await editor.click();
    await page.keyboard.type("Alpha");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("Beta");
    await page.waitForTimeout(300);

    // Shift+Enter emits an in-block <br>; it must survive serialisation
    const brCount = await editor.evaluate((el) => el.querySelectorAll("br").length);
    check("Shift+Enter inserts a soft line break", brCount >= 1, `br=${brCount}`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    const lines = await second.evaluate((el) => {
      const content = el.firstElementChild;
      return content ? Array.from(content.children).map((c) => c.textContent) : [];
    });
    check("soft line break survives as two lines in read mode",
      lines.length === 2 && lines[0].includes("Alpha") && lines[1].includes("Beta"),
      JSON.stringify(lines));

    await second.dblclick();
    await page.waitForTimeout(500);

    const toolbar = page.locator('[data-testid="rich-text-format-toolbar"]');
    const selectAll = async () => {
      await editor.evaluate((el) => {
        const r = document.createRange();
        r.selectNodeContents(el);
        const s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      });
      await page.waitForTimeout(200);
    };

    await selectAll();
    await toolbar.locator('[data-testid="rich-text-bullet-list"]').click();
    await page.waitForTimeout(400);
    const liCount = await editor.evaluate((el) => el.querySelectorAll("ul li").length);
    check("bullet list created from the selection", liCount >= 2, `li=${liCount}`);

    await selectAll();
    await toolbar.locator('[data-testid="rich-text-bullet-list"]').click();
    await page.waitForTimeout(400);
    const ulAfterOff = await editor.evaluate((el) => el.querySelectorAll("ul").length);
    const textAfterOff = await editor.evaluate((el) => el.textContent.replace(/\u200B/g, ""));
    check("bullet list toggles back off", ulAfterOff === 0, `ul=${ulAfterOff}`);
    check("text survives toggling the list off", textAfterOff.includes("Alpha") && textAfterOff.includes("Beta"), textAfterOff.slice(0, 40));

    // Numbered list, then commit so read mode + reload can be verified
    await selectAll();
    await toolbar.locator('[data-testid="rich-text-ordered-list"]').click();
    await page.waitForTimeout(400);
    const olCount = await editor.evaluate((el) => el.querySelectorAll("ol li").length);
    check("numbered list created from the selection", olCount >= 2, `li=${olCount}`);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    const readOl = await second.evaluate((el) => el.querySelectorAll("ol li").length);
    check("numbered list renders in read mode", readOl >= 2, `li=${readOl}`);
  }
  await page.screenshot({ path: "/tmp/e2e-text-6d-lists.png" });
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

// ── 8. Linear toolbar "T" popover styles the whole Text Field ────────────────
{
  const rtf = page.locator('[data-testid="rich-text-field-object"]').first();
  const present = await rtf.isVisible().catch(() => false);
  check("Text Field available for toolbar popover test", present);
  if (present) {
    const fb = await rtf.boundingBox();
    await page.mouse.click(fb.x + fb.width / 2, fb.y + fb.height - 8);
    await page.waitForTimeout(700);

    const typeBtn = page.locator('[data-testid="toolbar-button-text"]');
    const hasTypeBtn = await typeBtn.isVisible().catch(() => false);
    check("selected Text Field shows the T (Text Style) button", hasTypeBtn);

    if (hasTypeBtn) {
      await typeBtn.click();
      await page.waitForTimeout(400);
      const sizeBtn = page.locator('[data-testid="toolbar-fontsize-18"]');
      const submenuOpen = await sizeBtn.isVisible().catch(() => false);
      check("T button opens the typography popover", submenuOpen);
      await page.screenshot({ path: "/tmp/e2e-text-8-popover.png" });

      if (submenuOpen) {
        await sizeBtn.click();
        await page.waitForTimeout(600);
        const containerSize = await rtf.evaluate((el) => {
          const content = el.firstElementChild;
          return content ? getComputedStyle(content).fontSize : "";
        });
        check("font size from the popover applies to the whole field", containerSize === "18px", `fontSize=${containerSize}`);

        await page.locator('[data-testid="toolbar-align-center"]').click();
        await page.waitForTimeout(600);
        const align = await rtf.evaluate((el) => {
          const content = el.firstElementChild;
          return content ? getComputedStyle(content).textAlign : "";
        });
        check("alignment from the popover applies to the whole field", align === "center", `textAlign=${align}`);
      }
    }
  }
  await page.screenshot({ path: "/tmp/e2e-text-8-styled.png" });
}

console.log("\nSummary:", results.every((r) => r.ok) ? "ALL PASS" : "FAILURES PRESENT");
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
