import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import path from "node:path";

const base = process.env.SMOKE_URL ?? "http://localhost:3400";
const output = path.resolve(process.env.SMOKE_OUTPUT ?? "screenshots/phase-D");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const result = { checks: [], comparisons: [], runtimeErrors: [] };
try {
  for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: viewport.name === "mobile" ? 3 : 1 });
    const page = await context.newPage();
    page.on("pageerror", (error) => result.runtimeErrors.push(error.message));
    await page.addInitScript(() => {
      window.__liveBitmaps = 0;
      const create = window.createImageBitmap;
      window.createImageBitmap = async (...args) => {
        const bitmap = await create(...args); window.__liveBitmaps++;
        const close = bitmap.close.bind(bitmap); let closed = false;
        bitmap.close = () => { if (!closed) { closed = true; window.__liveBitmaps--; } close(); };
        return bitmap;
      };
    });
    await page.goto(base + "/aurelia", { waitUntil: "networkidle", timeout: 90000 });
    const hero = page.locator('[data-scene="hero-to-plan"]');
    await page.locator('[data-scene="hero-to-plan"][data-ready="true"]').waitFor({ timeout: 90000 });
    const canvas = hero.locator("canvas");
    const dimensions = await canvas.evaluate((el) => ({ width: el.width, cssWidth: el.clientWidth, dpr: devicePixelRatio }));
    assert.equal(dimensions.width, dimensions.cssWidth * Math.min(dimensions.dpr, 2));
    if (viewport.name === "mobile") assert(Number(await canvas.getAttribute("data-worker-decoded")) > 0, "Mobile worker must decode the active sequence");
    else assert.equal(await canvas.getAttribute("data-worker-decoded"), null, "Desktop uses the measured main-thread bitmap renderer");
    result.checks.push(`${viewport.name}: canvas DPR capped at 2`);
    // Query a versioned frame as rendered by the server, independently of preload hints.
    const frameUrl = await hero.locator("canvas").evaluate(() => performance.getEntriesByType("resource").find((entry) => /\/sequences(?:-d2)?\//.test(entry.name) && entry.name.includes("?v="))?.name);
    assert(frameUrl);
    const frameResponse = await context.request.get(frameUrl);
    assert.equal(frameResponse.headers()["cache-control"], "public, max-age=31536000, immutable");
    result.checks.push(`${viewport.name}: versioned frames cache immutably`);
    if (viewport.name === "desktop") {
      const screenshot = await page.screenshot({ path: path.join(output, "desktop-hero-comparison.png") });
      const original = await sharp(await readFile("screenshots/phase-A/before/desktop-000.png")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const current = await sharp(screenshot).removeAlpha().raw().toBuffer();
      let changed = 0, totalError = 0;
      for (let i = 0; i < current.length; i++) totalError += Math.abs(current[i] - original.data[i]);
      for (let i = 0; i < current.length; i += 3) if ([0, 1, 2].some((c) => Math.abs(current[i + c] - original.data[i + c]) > 2)) changed++;
      const percent = changed / (original.info.width * original.info.height) * 100;
      const meanAbsoluteChannelError = totalError / current.length;
      result.comparisons.push({ viewport: viewport.name, changedPixelPercent: percent, meanAbsoluteChannelError, note: "High-quality canvas resampling changes some edge pixels; compare overall channel error on the 0-255 scale." });
      if (process.env.CHECK_PRESENTATION === "phase-f") {
        const canvasError = await canvas.evaluate(async (element, url) => {
          const bitmap = await createImageBitmap(await (await fetch(url)).blob());
          try {
            const expected = document.createElement("canvas"); expected.width = element.width; expected.height = element.height;
            const context = expected.getContext("2d", { alpha: false }); context.imageSmoothingQuality = "high";
            const scale = Math.max(expected.width / bitmap.width, expected.height / bitmap.height);
            context.drawImage(bitmap, (expected.width - bitmap.width * scale) / 2, (expected.height - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
            const actual = element.getContext("2d").getImageData(0, 0, element.width, element.height).data;
            const reference = context.getImageData(0, 0, expected.width, expected.height).data;
            let total = 0; for (let i = 0; i < actual.length; i++) total += Math.abs(actual[i] - reference[i]);
            return total / actual.length;
          } finally { bitmap.close(); }
        }, frameUrl);
        result.comparisons.push({ canvasMeanAbsoluteChannelError: canvasError, note: "Phase F intentionally changes presentation. Original full-page difference is retained above; source-frame crop/resampling must still match independently." });
        assert(canvasError < 1, "Original tower canvas crop/resampling changed");
      } else assert(meanAbsoluteChannelError < 1, "Approved hero composition changed");
    }
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await page.waitForFunction(() => window.__liveBitmaps === 0 && [...document.querySelectorAll("canvas")].every((el) => Number(el.dataset.workerBitmaps ?? 0) === 0), undefined, { timeout: 30000 });
    result.checks.push(`${viewport.name}: all offscreen bitmaps released at contact`);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.locator('[data-scene="hero-to-plan"][data-ready="true"]').waitFor({ timeout: 90000 });
    await page.waitForTimeout(500);
    assert.equal(await canvas.getAttribute("data-frame"), "0");
    result.checks.push(`${viewport.name}: reverse navigation decodes and restores frame zero`);
    await page.evaluate(() => {
      const scene = document.querySelector('[data-scene="hero-to-plan"]');
      window.scrollTo({ top: Number(scene.dataset.scrollLength) * 0.8, behavior: "instant" });
    });
    await page.waitForTimeout(700);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(500);
    const reduced = await page.locator('[aria-label="Development overview"]').evaluate((el) => ({ opacity: getComputedStyle(el.parentElement).opacity, hidden: el.parentElement.getAttribute("aria-hidden") }));
    assert.equal(reduced.opacity, "1"); assert.notEqual(reduced.hidden, "true");
    await page.waitForFunction(() => window.__liveBitmaps === 0 && [...document.querySelectorAll("canvas")].every((el) => Number(el.dataset.workerBitmaps ?? 0) === 0));
    assert.equal(await page.locator(".pin-spacer").count(), 0);
    result.checks.push(`${viewport.name}: changing reduced-motion preference releases bitmaps and restores visible static content`);
    await context.close();
  }
  const fallback = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await fallback.addInitScript(() => Object.defineProperty(window, "OffscreenCanvas", { value: undefined, configurable: true }));
  const fallbackPage = await fallback.newPage();
  fallbackPage.on("pageerror", (error) => result.runtimeErrors.push(error.message));
  await fallbackPage.goto(base + "/aurelia", { waitUntil: "networkidle", timeout: 90000 });
  const fallbackHero = fallbackPage.locator('[data-scene="hero-to-plan"][data-ready="true"]');
  await fallbackHero.waitFor({ timeout: 90000 });
  assert.equal(await fallbackHero.locator("canvas").getAttribute("data-worker-decoded"), null);
  await fallbackPage.evaluate(() => {
    const scene = document.querySelector('[data-scene="hero-to-plan"]');
    window.scrollTo({ top: Number(scene.dataset.scrollLength) * 0.5, behavior: "instant" });
  });
  await fallbackPage.waitForFunction(() => Number(document.querySelector('[data-scene="hero-to-plan"] canvas').dataset.frame) > 1);
  result.checks.push("No OffscreenCanvas: the main-thread compatibility renderer loads and scrubs successfully");
  await fallback.close();
  assert.deepEqual(result.runtimeErrors, []);
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); await writeFile(path.join(output, "performance-validation.json"), JSON.stringify(result, null, 2) + "\n"); }
