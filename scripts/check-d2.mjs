import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.SMOKE_URL ?? "http://localhost:4100", output = process.env.SMOKE_OUTPUT ?? "screenshots/phase-D2";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: false });
const results = [];
try {
  for (const mode of ["desktop", "mobile", "fallback", "cold-jump"]) {
    const mobile = mode === "mobile", context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    if (mode === "fallback") await context.addInitScript(() => { Object.defineProperty(window, "OffscreenCanvas", { value: undefined }); });
    const page = await context.newPage(), errors = [], requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => { if (/sequences-d2.*frame_/.test(response.url())) requests.push({ url: response.url(), cache: response.headers()["cache-control"] }); });
    if (mode === "cold-jump") await page.route(/hero-to-plan[^/]*\/frame_0001.webp/, async (route) => { await new Promise((resolve) => setTimeout(resolve, 7000)); await route.continue().catch(() => {}); });
    await page.goto(`${base}/aurelia?debug=1`, { waitUntil: "domcontentloaded" });
    const hero = page.locator('[data-scene="hero-to-plan"]'), canvas = hero.locator("canvas");
    const seek = async (progress) => { await hero.evaluate((el, p) => scrollTo({ top: el.getBoundingClientRect().top + scrollY + Number(el.dataset.scrollLength) * p, behavior: "instant" }), progress); };
    if (mode === "cold-jump") { await page.waitForTimeout(1200); await seek(.85); }
    await hero.and(page.locator('[data-ready="true"]')).waitFor({ timeout: mode === "cold-jump" ? 5000 : 30000 });
    await page.waitForFunction(() => window.__frameCacheStats?.frames > 5);
    await seek(.2); await page.waitForTimeout(1000);
    await seek(.9);
    await page.waitForFunction(() => { const c = document.querySelector('[data-scene="hero-to-plan"] canvas'); return Number(c.dataset.targetFrame) > 80 && Math.abs(Number(c.dataset.frame) - Number(c.dataset.targetFrame)) <= 2; }, undefined, { timeout: 10000 });
    if (mode !== "fallback") await page.waitForFunction(() => !!document.querySelector('[data-scene="hero-to-plan"] canvas').dataset.crossfadeAt);
    const jumped = await canvas.evaluate((el) => ({ ...el.dataset }));
    await seek(.35); await page.waitForTimeout(1500);
    if (mode === "desktop") {
      await seek(.45); await hero.locator(".scroll-caption").filter({ hasText: "Step inside" }).waitFor(); await page.waitForTimeout(750);
      assert(await hero.locator(".scroll-caption").evaluate((el) => el.getAnimations().every((animation) => animation instanceof CSSAnimation)));
      await seek(.65); await hero.locator(".scroll-caption").filter({ hasText: "Residence A" }).waitFor();
      await seek(.2); await page.waitForTimeout(60); await seek(.45); await page.waitForTimeout(60); await seek(.35);
      await hero.locator(".scroll-caption").filter({ hasText: "The tower" }).waitFor(); await page.waitForTimeout(750);
    }
    const stats = await page.evaluate(() => window.__frameCacheStats);
    assert(stats.bytes + stats.reserved <= stats.budget); assert(stats.peak <= stats.budget); assert(stats.frames < 100, `Unbounded frames: ${stats.frames}`);
    assert.equal(stats.budget, (mobile ? 120 : 250) * 1048576);
    await page.getByLabel("Frame cache diagnostics").filter({ hasText: "Decoded:" }).waitFor();
    await page.screenshot({ path: `${output}/d2-${mode}-cache.png` });
    assert(requests.some((r) => /immutable/.test(r.cache)), "Versioned frames must use immutable HTTP caching");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => window.__frameCacheStats?.frames === 0 && window.__frameCacheStats?.reserved === 0);
    assert.deepEqual(errors, []);
    results.push({ mode, stats, jumped, checks: "bounded window and budget; seek/reversal; actual crossfade where supported; debug counters; immutable frames; reduced-motion releases bitmap cache", errors });
    console.log(mode, "PASS", stats.frames, (stats.peak / 1048576).toFixed(1), "MiB peak");
    await context.close();
  }
} finally { await browser.close(); await writeFile(`${output}/d2-cache-checks.json`, JSON.stringify(results, null, 2)); }
