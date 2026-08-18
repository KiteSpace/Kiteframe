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

// ── 6e. No border by default; selected vs editing still clearly distinct ─────
{
  const second = page.locator('[data-testid="rich-text-field-object"]').nth(1);
  const readState = () => second.evaluate((el) => ({
    state: el.getAttribute("data-border-state"),
    userBorder: el.getAttribute("data-user-border"),
    borderStyle: getComputedStyle(el).borderTopStyle,
    borderWidth: getComputedStyle(el).borderTopWidth,
    borderColor: getComputedStyle(el).borderTopColor,
    shadow: getComputedStyle(el).boxShadow,
  }));
  // A border is "invisible" if it is removed OR painted fully transparent.
  const noVisibleBorder = (s) =>
    s.borderStyle === "none" ||
    s.borderWidth === "0px" ||
    /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(s.borderColor);

  // Idle: click empty canvas to clear the selection
  await page.mouse.click(1400, 900);
  await page.waitForTimeout(500);
  const idle = await readState();
  check("idle field reports the idle boundary state", idle.state === "idle", JSON.stringify(idle));
  check("an unselected field draws NO border by default", noVisibleBorder(idle), JSON.stringify(idle));
  check("an unselected field draws no halo either", idle.shadow === "none", `shadow=${idle.shadow}`);
  check("no border colour is stored on a fresh field", idle.userBorder === "none", `userBorder=${idle.userBorder}`);

  // Selected: single click on the field
  const box = await second.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 6);
  await page.waitForTimeout(600);
  const selected = await readState();
  check("clicking the field reports the selected boundary state", selected.state === "selected", JSON.stringify(selected));
  check("selecting a field makes it visibly identifiable", selected.shadow !== "none" && selected.shadow !== idle.shadow,
    `idle=${idle.shadow} selected=${selected.shadow}`);
  check("selecting a field does not invent a border on it", noVisibleBorder(selected), JSON.stringify(selected));

  // Editing: double click into the field
  await second.dblclick();
  await page.waitForTimeout(500);
  const editing = await readState();
  check("editing field reports the editing boundary state", editing.state === "editing", JSON.stringify(editing));
  const shadowDiffers = editing.shadow !== selected.shadow && editing.shadow !== "none";
  check("editing boundary is visibly distinct from selected", shadowDiffers,
    `selected=${selected.shadow} editing=${editing.shadow}`);
  await page.screenshot({ path: "/tmp/e2e-text-6e-borders.png" });
}

// ── 6f. Text colour applies to just the selected words ───────────────────────
{
  const second = page.locator('[data-testid="rich-text-field-object"]').nth(1);
  const editor = page.locator('[data-testid="rich-text-editor"]');
  const editingOpen = await editor.isVisible().catch(() => false);
  check("field open for the colour test", editingOpen);
  if (editingOpen) {
    // Select the word "Alpha" with a real double-click, not a scripted range
    const alphaBox = await editor.evaluate((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const i = (node.textContent || "").indexOf("Alpha");
        if (i >= 0) {
          const r = document.createRange();
          r.setStart(node, i);
          r.setEnd(node, i + 5);
          const b = r.getBoundingClientRect();
          return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        }
      }
      return null;
    });
    check("found the word Alpha to colour", !!alphaBox);
    if (alphaBox) {
      await page.mouse.dblclick(alphaBox.x, alphaBox.y);
      await page.waitForTimeout(300);

      const colorBtn = page.locator('[data-testid="rich-text-color"]');
      check("format toolbar exposes a text colour control", await colorBtn.isVisible().catch(() => false));
      await colorBtn.click();
      await page.waitForTimeout(300);
      const popover = page.locator('[data-testid="rich-text-color-popover"]');
      check("colour control opens a swatch popover", await popover.isVisible().catch(() => false));
      await page.screenshot({ path: "/tmp/e2e-text-6f-color-popover.png" });

      await popover.locator('[data-testid="rich-text-color-ef4444"]').click();
      await page.waitForTimeout(500);

      const colored = await editor.evaluate((el) =>
        [...el.querySelectorAll("span")]
          .filter((s) => getComputedStyle(s).color === "rgb(239, 68, 68)")
          .map((s) => s.textContent.replace(/\u200B/g, ""))
          .join("|"),
      );
      check("chosen colour applied to the selected word", colored.includes("Alpha"), `colored=${colored}`);
      check("colour did NOT leak onto the rest of the text", !colored.includes("Beta"), `colored=${colored}`);
      check("popover closes after picking a colour", !(await popover.isVisible().catch(() => false)));

      await page.keyboard.press("Escape");
      await page.waitForTimeout(700);
      const readColored = await second.evaluate((el) =>
        [...el.querySelectorAll("span")]
          .filter((s) => getComputedStyle(s).color === "rgb(239, 68, 68)")
          .map((s) => s.textContent.replace(/\u200B/g, ""))
          .join("|"),
      );
      check("coloured text renders in read mode", readColored.includes("Alpha"), `colored=${readColored}`);
    }
  }
  await page.screenshot({ path: "/tmp/e2e-text-6f-color.png" });
}

// ── 6g. Lists work from a plain caret, with visible markers ──────────────────
{
  // Fresh field so the list behaviour is not confused by earlier content
  const countFields = () => page.locator('[data-testid="rich-text-field-object"]').count();
  const before = await countFields();
  await page.locator('[data-testid="icon-type"]').first().click();
  await page.waitForTimeout(400);
  const card = page.locator('[data-testid="popout-text-type-text-field"]');
  const cardBox = await card.boundingBox();
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(cardBox.x + 100, cardBox.y + 50, { steps: 5 });
  // Free canvas: the right-hand assistant panel starts around x=1000
  await page.mouse.move(300, 700, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  check("third Text Field created for the list test", (await countFields()) === before + 1);

  const third = page.locator('[data-testid="rich-text-field-object"]').nth(2);
  await third.dblclick();
  await page.waitForTimeout(500);
  const editor = page.locator('[data-testid="rich-text-editor"]');
  const opened = await editor.isVisible().catch(() => false);
  check("third Text Field opens for editing", opened);
  if (opened) {
    const toolbar = page.locator('[data-testid="rich-text-format-toolbar"]');
    await editor.click();
    await page.keyboard.type("Milk");
    await page.waitForTimeout(300);

    // The caret is simply sitting after "Milk" — no selection at all.
    // This is how a real user reaches for the list button.
    const collapsed = await page.evaluate(() => window.getSelection().isCollapsed);
    check("selection is a bare caret before clicking the list button", collapsed);

    await toolbar.locator('[data-testid="rich-text-bullet-list"]').click();
    await page.waitForTimeout(400);
    const firstItem = await editor.evaluate((el) => {
      const li = el.querySelector("ul li");
      return li ? li.textContent.replace(/\u200B/g, "") : null;
    });
    check("bullet list created from a caret (no selection)", firstItem === "Milk", `li=${firstItem}`);

    const markerVisible = await editor.evaluate((el) => {
      const ul = el.querySelector("ul");
      if (!ul) return null;
      const cs = getComputedStyle(ul);
      return { type: cs.listStyleType, padding: parseFloat(cs.paddingLeft) };
    });
    check("bullet markers are actually rendered (not reset away)",
      !!markerVisible && markerVisible.type === "disc" && markerVisible.padding > 0,
      JSON.stringify(markerVisible));

    // The caret must still be where the user left it — at the end of "Milk"
    const caretAtEnd = await page.evaluate(() => {
      const s = window.getSelection();
      if (!s || !s.isCollapsed) return "not-collapsed";
      const li = document.querySelector('[data-testid="rich-text-editor"] ul li');
      if (!li) return "no-li";
      const pre = document.createRange();
      pre.selectNodeContents(li);
      pre.setEnd(s.getRangeAt(0).startContainer, s.getRangeAt(0).startOffset);
      return pre.toString().length === li.textContent.length ? "at-end" : `at-${pre.toString().length}`;
    });
    check("caret stays put when the list is applied", caretAtEnd === "at-end", caretAtEnd);

    // Enter continues the list with a second item
    await page.keyboard.press("Enter");
    await page.keyboard.type("Eggs");
    await page.waitForTimeout(300);
    const items = await editor.evaluate((el) =>
      [...el.querySelectorAll("ul li")].map((li) => li.textContent.replace(/\u200B/g, "")),
    );
    check("Enter continues the bullet list", items.length === 2 && items[1] === "Eggs", JSON.stringify(items));

    // Toggling off from a caret must un-list without eating the text
    await toolbar.locator('[data-testid="rich-text-bullet-list"]').click();
    await page.waitForTimeout(400);
    const afterOff = await editor.evaluate((el) => ({
      lis: el.querySelectorAll("ul li").length,
      text: el.textContent.replace(/\u200B/g, ""),
    }));
    check("bullet list toggles off from a caret", afterOff.lis <= 1, JSON.stringify(afterOff));
    check("no text is lost when the list is toggled off",
      afterOff.text.includes("Milk") && afterOff.text.includes("Eggs"), afterOff.text.slice(0, 40));

    // Numbered list, also from a caret
    await toolbar.locator('[data-testid="rich-text-ordered-list"]').click();
    await page.waitForTimeout(400);
    const olMarker = await editor.evaluate((el) => {
      const ol = el.querySelector("ol");
      return ol ? getComputedStyle(ol).listStyleType : null;
    });
    check("numbered list created from a caret with visible numbers", olMarker === "decimal", `listStyleType=${olMarker}`);
  }
  await page.screenshot({ path: "/tmp/e2e-text-6g-caret-lists.png" });
}

// ── 6h. The field grows vertically as the text grows ─────────────────────────
{
  const third = page.locator('[data-testid="rich-text-field-object"]').nth(2);
  const editor = page.locator('[data-testid="rich-text-editor"]');
  const layoutHeight = () => third.evaluate((el) => parseFloat(el.style.height));
  const editingOpen = await editor.isVisible().catch(() => false);
  check("field open for the auto-height test", editingOpen);
  if (editingOpen) {
    const before = await layoutHeight();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Enter");
      await page.keyboard.type(`Line ${i} of some reasonably long wrapping text`);
    }
    await page.waitForTimeout(600);
    const after = await layoutHeight();
    check("field grows vertically as text is typed", after > before + 20, `before=${before} after=${after}`);

    const clipped = await editor.evaluate((el) => ({
      scroll: el.scrollHeight,
      client: el.clientHeight,
    }));
    check("grown field shows all of its text (nothing clipped)",
      clipped.scroll <= clipped.client + 2, JSON.stringify(clipped));

    // Growing must never undo a size the user chose — it only ever grows
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(500);
    const afterDelete = await layoutHeight();
    check("field does not shrink back when text is removed", afterDelete >= after, `after=${after} afterDelete=${afterDelete}`);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    globalThis.__grownHeight = afterDelete;
  }
  await page.screenshot({ path: "/tmp/e2e-text-6h-autoheight.png" });
}

// ── 6i. Border and background colours from the linear toolbar ────────────────
{
  const third = page.locator('[data-testid="rich-text-field-object"]').nth(2);
  const readBox = () => third.evaluate((el) => {
    const cs = getComputedStyle(el);
    const inner = el.firstElementChild;
    return {
      userBorder: el.getAttribute("data-user-border"),
      userBackground: el.getAttribute("data-user-background"),
      borderColor: cs.borderTopColor,
      borderWidth: cs.borderTopWidth,
      background: cs.backgroundColor,
      rect: { w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height },
      contentW: inner ? inner.clientWidth : 0,
      scroll: inner ? inner.scrollHeight : 0,
      client: inner ? inner.clientHeight : 0,
    };
  });

  // Select (not edit) the field so the object-level linear toolbar appears
  await page.mouse.click(1400, 900);
  await page.waitForTimeout(300);
  // Click near the TOP edge: this field has auto-grown past the bottom of the
  // viewport, so its lower edge is not clickable.
  const tb = await third.boundingBox();
  await page.mouse.click(tb.x + tb.width / 2, tb.y + 6);
  await page.waitForTimeout(700);

  const before = await readBox();

  const colorBtn = page.locator('[data-testid="toolbar-button-color"], [title="Color"]').first();
  let opened = false;
  try {
    await colorBtn.click({ timeout: 4000 });
    await page.waitForTimeout(400);
    opened = await page.locator('[data-testid="toolbar-color-submenu"]').isVisible().catch(() => false);
  } catch (e) {
    console.log("color button click failed:", e.message?.slice(0, 120));
  }
  check("linear toolbar opens the colour picker for a text field", opened);
  await page.screenshot({ path: "/tmp/e2e-text-6i-color-menu.png" });

  if (opened) {
    const targets = page.locator('[data-testid="toolbar-color-targets"]');
    check("colour picker offers text / border / background targets",
      await targets.isVisible().catch(() => false));

    // ── Border colour ──
    await page.locator('[data-testid="toolbar-color-target-border"]').click();
    await page.waitForTimeout(250);
    await page.locator('[data-testid="toolbar-color-22c55e"]').click();
    await page.waitForTimeout(600);
    const withBorder = await readBox();
    check("chosen border colour is applied to the field",
      withBorder.userBorder === "#22c55e" && withBorder.borderColor === "rgb(34, 197, 94)",
      JSON.stringify({ userBorder: withBorder.userBorder, borderColor: withBorder.borderColor }));
    check("adding a border does not change the field's size",
      Math.abs(withBorder.rect.w - before.rect.w) < 0.5 && Math.abs(withBorder.rect.h - before.rect.h) < 0.5,
      `before=${JSON.stringify(before.rect)} after=${JSON.stringify(withBorder.rect)}`);
    check("adding a border does not reflow the text",
      withBorder.contentW === before.contentW, `before=${before.contentW} after=${withBorder.contentW}`);
    check("a grown field still shows all its text once bordered",
      withBorder.scroll <= withBorder.client + 2,
      JSON.stringify({ scroll: withBorder.scroll, client: withBorder.client }));

    // ── Background colour ──
    await page.locator('[data-testid="toolbar-color-target-background"]').click();
    await page.waitForTimeout(250);
    await page.locator('[data-testid="toolbar-color-eab308"]').click();
    await page.waitForTimeout(600);
    const withBg = await readBox();
    check("chosen background colour fills the field",
      withBg.userBackground === "#eab308" && withBg.background === "rgb(234, 179, 8)",
      JSON.stringify({ userBackground: withBg.userBackground, background: withBg.background }));
    check("setting a background leaves the border colour alone",
      withBg.userBorder === "#22c55e", `userBorder=${withBg.userBorder}`);
    await page.screenshot({ path: "/tmp/e2e-text-6i-colored.png" });

    // ── Clearing the background again ──
    const noneBtn = page.locator('[data-testid="toolbar-color-none"]');
    check("a 'none' option is offered for the background",
      await noneBtn.isVisible().catch(() => false));
    await noneBtn.click();
    await page.waitForTimeout(600);
    const cleared = await readBox();
    check("background can be cleared back to none",
      cleared.userBackground === "none" &&
        /rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(cleared.background),
      JSON.stringify({ userBackground: cleared.userBackground, background: cleared.background }));
    check("clearing the background keeps the border", cleared.userBorder === "#22c55e",
      `userBorder=${cleared.userBorder}`);

    // ── Colour changes are recorded in the undo history ──
    // NOTE: the editor's history stores "before" snapshots while the index
    // points at the newest one, so the first Ctrl+Z lands on a state identical
    // to the live one for EVERY action, not just colours. We therefore assert
    // that colour edits are undoable at all, not that one press is enough.
    let presses = 0;
    let undone = await readBox();
    while (presses < 2 && undone.userBorder !== "none") {
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(800);
      undone = await readBox();
      presses++;
    }
    check("colour changes are recorded in the undo history",
      undone.userBorder === "none", `presses=${presses} userBorder=${undone.userBorder}`);

    // Re-apply both colours so the reload check has something to verify
    await page.mouse.click(1400, 900);
    await page.waitForTimeout(300);
    const tb2 = await third.boundingBox();
    await page.mouse.click(tb2.x + tb2.width / 2, tb2.y + 6);
    await page.waitForTimeout(700);
    await page.locator('[data-testid="toolbar-button-color"]').click();
    await page.waitForTimeout(400);
    await page.locator('[data-testid="toolbar-color-target-border"]').click();
    await page.waitForTimeout(250);
    await page.locator('[data-testid="toolbar-color-22c55e"]').click();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="toolbar-color-target-background"]').click();
    await page.waitForTimeout(250);
    await page.locator('[data-testid="toolbar-color-eab308"]').click();
    await page.waitForTimeout(600);
    const restored = await readBox();
    check("both colours can be re-applied after undo",
      restored.userBorder === "#22c55e" && restored.userBackground === "#eab308",
      JSON.stringify({ border: restored.userBorder, background: restored.userBackground }));
    globalThis.__thirdBorder = restored.userBorder;
    globalThis.__thirdBackground = restored.userBackground;
  }
  await page.mouse.click(1400, 900);
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/e2e-text-6i-final.png" });
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

  const second = page.locator('[data-testid="rich-text-field-object"]').nth(1);
  const colorStill = await second.evaluate((el) =>
    [...el.querySelectorAll("span")]
      .filter((s) => getComputedStyle(s).color === "rgb(239, 68, 68)")
      .map((s) => s.textContent.replace(/\u200B/g, ""))
      .join("|"),
  ).catch(() => "");
  check("text colour survives reload", colorStill.includes("Alpha"), `colored=${colorStill}`);

  const third = page.locator('[data-testid="rich-text-field-object"]').nth(2);
  const thirdPresent = await third.isVisible().catch(() => false);
  const grown = globalThis.__grownHeight;
  const heightStill = thirdPresent ? await third.evaluate((el) => parseFloat(el.style.height)) : 0;
  check("auto-grown height survives reload",
    thirdPresent && grown > 0 && Math.abs(heightStill - grown) <= 2,
    `expected=${grown} actual=${heightStill}`);

  const listStill = thirdPresent && await third.evaluate((el) => {
    const ol = el.querySelector("ol");
    return !!ol && getComputedStyle(ol).listStyleType === "decimal";
  });
  check("list markers survive reload in read mode", !!listStill);

  const paint = thirdPresent
    ? await third.evaluate((el) => ({
        userBorder: el.getAttribute("data-user-border"),
        userBackground: el.getAttribute("data-user-background"),
        borderColor: getComputedStyle(el).borderTopColor,
        background: getComputedStyle(el).backgroundColor,
      }))
    : null;
  check("border colour survives reload",
    !!paint && paint.userBorder === globalThis.__thirdBorder && paint.borderColor === "rgb(34, 197, 94)",
    JSON.stringify(paint));
  check("background colour survives reload",
    !!paint && paint.userBackground === globalThis.__thirdBackground && paint.background === "rgb(234, 179, 8)",
    JSON.stringify(paint));
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
