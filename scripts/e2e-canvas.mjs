// Real-browser verification for task 456: click/select/drag on the design canvas.
import { chromium } from "playwright-core";

const [designId, cookieValue] = process.argv.slice(2);
const domain = process.env.REPLIT_DEV_DOMAIN;
const base = `https://${domain}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addCookies([{ name: "connect.sid", value: cookieValue, domain, path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200)); });

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`); };

await page.goto(`${base}/designs/${designId}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: "/tmp/e2e-0-loaded.png" });

// Dismiss cookie banner if present.
try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 3000 }); } catch {}

// ── helpers ──────────────────────────────────────────────────────────────────
// Selected = leaf/container outline ring OR artboard box-shadow ring (#3b82f6).
const SEL_OUTLINE = "rgb(59, 130, 246)";
const selectedInfo = () => page.evaluate((c) => {
  const els = [...document.querySelectorAll("*")].filter((el) => {
    const s = getComputedStyle(el);
    const outlined = s.outlineStyle === "solid" && s.outlineWidth === "2px" && s.outlineColor === c;
    const shadowed = s.boxShadow && s.boxShadow.includes(c) && s.boxShadow.includes("0px 0px 0px 2px");
    return outlined || shadowed;
  });
  return els.map((el) => (el.textContent || "").trim().slice(0, 40));
}, SEL_OUTLINE);

const artboardFrame = (label) => page.evaluate((lbl) => {
  const labelEl = [...document.querySelectorAll("div")].find((d) => d.textContent === lbl && d.children.length === 0);
  if (!labelEl) return null;
  const frame = labelEl.nextElementSibling;
  if (!frame) return null;
  const r = frame.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}, label);

// ── 1. Click artboard → selects it ───────────────────────────────────────────
{
  const fr = await artboardFrame("Screen 1");
  if (!fr) { check("artboard frame found", false); } else {
    // Click near bottom of the frame (empty part inside artboard, not the button)
    await page.mouse.click(fr.x + fr.w / 2, fr.y + fr.h - 15);
    await page.waitForTimeout(400);
    const sel = await selectedInfo();
    check("clicking artboard selects it", sel.length > 0, JSON.stringify(sel));
    await page.screenshot({ path: "/tmp/e2e-1-artboard-selected.png" });
  }
}

// ── 2. Click component inside artboard → selects component ───────────────────
{
  const btn = page.locator('button:has-text("Click me")').first();
  await btn.click();
  await page.waitForTimeout(400);
  const sel = await selectedInfo();
  const ok = sel.some((t) => t.includes("Click me"));
  check("clicking component selects the component", ok, JSON.stringify(sel));
  await page.screenshot({ path: "/tmp/e2e-2-button-selected.png" });
}

// ── 3. Drag palette item onto artboard 2 ─────────────────────────────────────
{
  // The left palette is replaced by the props panel while a node is selected —
  // reload to reset to a clean, deselected state.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  try { await page.locator('button:has-text("Necessary Only")').click({ timeout: 2000 }); } catch {}
  // Filter the palette via its search box so the Badge tile is visible.
  await page.locator('input[placeholder*="Search"]').first().fill("Badge");
  await page.waitForTimeout(500);
  const tileInfo = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('div[class*="cursor-grab"], div[draggable="true"]')];
    const t = tiles.find((d) => (d.textContent || "").trim().endsWith("Badge"));
    if (!t) return { count: tiles.length, texts: tiles.slice(0, 8).map((x) => (x.textContent || "").trim().slice(0, 20)) };
    t.scrollIntoView({ block: "center" });
    const r = t.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  console.log("tileInfo:", JSON.stringify(tileInfo));
  const src = tileInfo.x != null ? tileInfo : null;
  const fr2 = await artboardFrame("Screen 2");
  if (!src || !fr2) { check("palette tile + target artboard found", false, JSON.stringify({ src, fr2 })); }
  else {
    const target = { x: fr2.x + fr2.w / 2, y: fr2.y + fr2.h / 2 };
    // Native HTML5 DnD via dispatched DragEvents with a real DataTransfer.
    const indicatorSeen = await page.evaluate(async ({ src, target }) => {
      const at = (p) => document.elementFromPoint(p.x, p.y);
      const srcEl = at({ x: src.x + src.width / 2, y: src.y + src.height / 2 })?.closest('[draggable="true"]');
      const dt = new DataTransfer();
      const fire = (el, type, x, y) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
      if (!srcEl) return { error: "no source el" };
      fire(srcEl, "dragstart", src.x + 10, src.y + 10);
      await new Promise((r) => setTimeout(r, 100));
      let tgt = at(target);
      fire(tgt, "dragenter", target.x, target.y);
      fire(tgt, "dragover", target.x, target.y);
      await new Promise((r) => setTimeout(r, 200));
      // Look for a craft.js drop indicator (fixed-position thin colored bar)
      const indicator = [...document.querySelectorAll("div")].some((d) => {
        const s = getComputedStyle(d);
        return s.position === "fixed" && (parseFloat(s.height) <= 4 || parseFloat(s.width) <= 4) && s.backgroundColor !== "rgba(0, 0, 0, 0)" && d.getBoundingClientRect().width > 0;
      });
      tgt = at(target);
      fire(tgt, "drop", target.x, target.y);
      fire(srcEl, "dragend", target.x, target.y);
      return { indicator };
    }, { src, target });
    await page.waitForTimeout(600);
    console.log("indicator result:", JSON.stringify(indicatorSeen));
    const badgeInArtboard = await page.evaluate(() => {
      const labelEl = [...document.querySelectorAll("div")].find((d) => d.textContent === "Screen 2" && d.children.length === 0);
      const frame = labelEl?.nextElementSibling;
      return frame ? frame.textContent.includes("Badge") : false;
    });
    check("dragging Badge from palette drops into artboard 2", badgeInArtboard);
    check("drop indicator visible during drag", !!indicatorSeen.indicator, JSON.stringify(indicatorSeen));
    await page.screenshot({ path: "/tmp/e2e-3-after-drop.png" });
  }
}

// ── 4 & 5. Empty-space clicks: between artboards and dead zone → pan + deselect
async function panTest(name, px, py) {
  // Select the button first so there is a selection to clear.
  await page.locator('button:has-text("Click me")').first().click();
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => d.style.transform && d.style.transform.includes("translate") && d.style.transform.includes("scale"));
    return el ? el.style.transform : null;
  });
  // Sample selection rings during the click to detect ROOT-flicker.
  await page.evaluate((c) => {
    window.__flicker = [];
    window.__flickerStop = false;
    const sample = () => {
      const els = [...document.querySelectorAll("*")].filter((el) => {
        const s = getComputedStyle(el);
        const outlined = s.outlineStyle === "solid" && s.outlineWidth === "2px" && s.outlineColor === c;
        const shadowed = s.boxShadow && s.boxShadow.includes(c) && s.boxShadow.includes("0px 0px 0px 2px");
        return outlined || shadowed;
      });
      window.__flicker.push(els.length);
      if (!window.__flickerStop) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, SEL_OUTLINE);
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px + 60, py + 40, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const flicker = await page.evaluate(() => { window.__flickerStop = true; return window.__flicker; });
  const after = await page.evaluate(() => {
    const el = [...document.querySelectorAll("div")].find((d) => d.style.transform && d.style.transform.includes("translate") && d.style.transform.includes("scale"));
    return el ? el.style.transform : null;
  });
  const sel = await selectedInfo();
  check(`${name}: canvas pans`, before !== after, `${before} -> ${after}`);
  check(`${name}: deselects`, sel.length === 0, JSON.stringify(sel));
  // Flicker: selection count should go to 0 and stay 0 after mouse-up phase;
  // a ROOT flicker would show count spiking back up mid-sequence (0 -> N -> 0).
  const s = flicker.join("");
  const flickered = /0+[1-9]/.test(s.replace(/^[1-9]+/, ""));
  check(`${name}: no selection flicker`, !flickered, `samples=${flicker.join(",")}`);
}

{
  const fr1 = await artboardFrame("Screen 1");
  const fr2 = await artboardFrame("Screen 2");
  // Between artboards: midpoint of the horizontal gap.
  const gapX = (fr1.x + fr1.w + fr2.x) / 2;
  await panTest("between artboards", gapX, fr1.y + fr1.h / 2);
  await page.screenshot({ path: "/tmp/e2e-4-between-pan.png" });

  // Dead zone: below/right of artboards (still over ROOT section area).
  const fr2b = await artboardFrame("Screen 2");
  // Former dead zone: just below artboard 2, still within the canvas viewport
  // (avoid the right-side panel and the bottom chat bar).
  const dzX = fr2b.x + fr2b.w / 2;
  const dzY = Math.min(fr2b.y + fr2b.h + 60, 900);
  const dzTarget = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return { tag: el?.tagName, canvasRoot: el?.dataset?.canvasRoot, cls: (el?.className || "").toString().slice(0, 60) };
  }, { x: dzX, y: dzY });
  console.log("dead-zone target el:", JSON.stringify(dzTarget));
  await panTest("dead zone below/right", dzX, dzY);
  await page.screenshot({ path: "/tmp/e2e-5-deadzone-pan.png" });
}

console.log("\nSummary:", results.every((r) => r.ok) ? "ALL PASS" : "FAILURES PRESENT");
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
