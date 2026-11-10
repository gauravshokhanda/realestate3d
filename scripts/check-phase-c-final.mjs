import dotenv from "dotenv";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomInt } from "node:crypto";
import sharp from "sharp";
import path from "node:path";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const base = process.env.SMOKE_URL ?? "http://localhost:3300", output = path.resolve("screenshots/phase-C");
const browser = await chromium.launch({ headless: true, channel: process.env.SMOKE_CHANNEL || "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders: { "x-forwarded-for": `198.22.${randomInt(1, 250)}.${randomInt(1, 250)}` } });
const page = await context.newPage(), checks = [], comparisons = [], runtimeErrors = [];
page.on("pageerror", (error) => runtimeErrors.push(error.message));
try {
  const login = await context.request.post(base + "/api/admin/login", { headers: { origin: base }, data: { password: process.env.ADMIN_PASSWORD } }); assert.equal(login.status(), 200);
  await page.goto(base + "/admin/properties/aurelia", { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("tab", { name: "Videos", exact: false }).click(); await page.locator("[data-video-scene]").nth(3).waitFor();
  const card = page.locator('[data-video-scene="plan-to-kitchen"]'); await card.getByRole("button", { name: "Trim", exact: true }).click();
  const video = card.locator("video");
  await video.evaluate(async (element) => {
    if (element.readyState < 1) await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error("Source video metadata did not load")), 20000); element.addEventListener("loadedmetadata", () => { clearTimeout(timeout); resolve(); }, { once: true }); });
    await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error("Source video could not seek")), 20000); element.addEventListener("seeked", () => { clearTimeout(timeout); resolve(); }, { once: true }); element.currentTime = 6.5; });
  });
  const state = await video.evaluate((element) => ({ time: element.currentTime, ready: element.readyState, error: element.error?.code ?? null }));
  assert(Math.abs(state.time - 6.5) < 0.1 && state.ready >= 2 && state.error === null);
  await card.locator("img").evaluateAll(async (images) => { images.forEach((image) => { image.loading = "eager"; }); await Promise.all(images.map((image) => image.decode())); });
  await card.screenshot({ path: path.join(output, "videos-source-scrubber.png") });
  await card.locator("summary").click(); await card.screenshot({ path: path.join(output, "videos-prompt-options.png") });
  checks.push("Final build: authenticated source video loaded and sought to 6.5s with decoded image data; prompt/watermark controls rendered");
  await page.setViewportSize({ width: 390, height: 844 }); assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  checks.push("Final build: Videos tab has no mobile horizontal overflow");
  for (const viewport of [{ name: "desktop-000", width: 1440, height: 900 }, { name: "mobile-000", width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(base + "/aurelia", { waitUntil: "networkidle", timeout: 60000 });
    await page.locator('[data-scene="hero-to-plan"][data-ready="true"]').waitFor({ timeout: 60000 });
    await page.screenshot({ path: path.join(output, `${viewport.name}-final.png`) });
    const original = await sharp(await readFile(path.resolve("screenshots/phase-A/before", `${viewport.name}.png`))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const current = await sharp(await readFile(path.join(output, `${viewport.name}-final.png`))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(original.data.length, current.data.length); let changed = 0;
    for (let i = 0; i < original.data.length; i += 3) if ([0, 1, 2].some((channel) => Math.abs(original.data[i + channel] - current.data[i + channel]) > 2)) changed++;
    const percent = changed / (original.info.width * original.info.height) * 100;
    comparisons.push({ capture: viewport.name, changedPixelPercent: percent }); assert(percent < 0.1, "Aurelia appearance changed after final build");
  }
  assert.equal((await page.goto(base + "/does-not-exist", { waitUntil: "networkidle" })).status(), 404);
  assert.deepEqual(runtimeErrors, []); console.log("final build: PASS", checks, comparisons);
} finally { await browser.close(); await writeFile(path.join(output, "final-validation.json"), JSON.stringify({ checks, comparisons, runtimeErrors }, null, 2)); }
