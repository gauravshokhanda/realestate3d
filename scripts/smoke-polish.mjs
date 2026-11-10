import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const output = path.resolve(process.env.SMOKE_OUTPUT ?? "screenshots/phase-F");
const base = process.env.SMOKE_URL ?? "http://localhost:4000";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.SMOKE_CHANNEL ?? "chrome" });
const checks = [], errors = [];
let passed = false;
try {
  const intro = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await intro.route(/frame_0001\.webp/, async (route) => { await new Promise((resolve) => setTimeout(resolve, 900)); await route.continue(); });
  await intro.goto(base + "/aurelia", { waitUntil: "domcontentloaded" });
  await intro.locator(".intro-loader").waitFor({ state: "visible" });
  assert.equal(await intro.getByRole("progressbar", { name: "Loading sequence" }).count(), 1);
  await intro.screenshot({ path: path.join(output, "intro-loader.png") });
  await intro.locator(".intro-loader").waitFor({ state: "detached", timeout: 60000 });
  await intro.close(); checks.push("Real loading progress and loader-to-hero reveal");
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage(); page.setDefaultTimeout(60000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/aurelia", { waitUntil: "networkidle" });
    await page.locator('[data-scene="hero-to-plan"][data-ready=true]').waitFor();
    await page.locator(".intro-loader").waitFor({ state: "detached" });
    await page.screenshot({ path: path.join(output, `after-${mobile ? "mobile" : "desktop"}-hero.png`) });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (mobile) {
      assert.equal(await page.locator(".tour-cursor").isVisible(), false);
      await page.getByRole("button", { name: "Menu" }).click();
      await page.locator("dialog[open]").waitFor();
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(output, "mobile-menu.png") });
      for (let i = 0; i < 10; i++) { await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => !!document.activeElement?.closest("dialog")), true); }
      await page.keyboard.press("Escape");
      await page.locator("dialog[open]").waitFor({ state: "detached" });
      await page.getByRole("button", { name: "Menu" }).click();
      await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Contact", exact: false }).click();
    } else {
      assert.equal(await page.getByRole("navigation", { name: "Tour chapters" }).getByRole("link").count(), 5);
      await page.getByRole("navigation", { name: "Tour chapters" }).getByRole("link", { name: "Contact" }).click();
    }
    await page.waitForTimeout(2000);
    assert.equal(await page.evaluate(() => Math.abs(document.querySelector("#contact").getBoundingClientRect().top) < 220), true);
    await page.screenshot({ path: path.join(output, `after-${mobile ? "mobile" : "desktop"}-contact.png`) });
    await page.route("**/api/lead", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) }));
    await page.getByLabel("Full name").fill("Phase F Review");
    await page.getByLabel("Email address").fill("review@example.com");
    await page.getByRole("button", { name: "Request a private viewing" }).click();
    await page.getByText("Thank you for your interest.", { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, `inquiry-success-${mobile ? "mobile" : "desktop"}.png`) });
    if (!mobile) {
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.locator(".chapter-rail").isVisible(), false);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.locator('.chapter-rail a[aria-current="step"]').waitFor();
      await page.getByRole("navigation", { name: "Tour chapters" }).getByRole("link", { name: "Tower" }).click();
      await page.waitForFunction(() => scrollY < 5);
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(await page.locator(".tour-cursor").isVisible(), false);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      checks.push("Chapter navigation reactivates after mobile/desktop viewport changes; live motion preference disables the cursor");
    }
    checks.push(`${mobile ? "Mobile menu/focus/Escape/touch cursor" : "Desktop chapter navigation"}; contact focus and mocked success animation`);
    await context.close();
  }
  const reduced = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await reduced.newPage(); page.on("pageerror", (e) => errors.push(e.message));
  for (const mobile of [false, true]) {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.goto(base + "/aurelia", { waitUntil: "networkidle" });
    await page.locator(".intro-loader").waitFor({ state: "detached" });
    await page.screenshot({ path: path.join(output, `after-${mobile ? "mobile" : "desktop"}.png`), fullPage: true });
    assert.equal(await page.locator(".page-reveal").evaluate((e) => getComputedStyle(e).animationName), "none");
    assert.equal(await page.locator(".tour-cursor").isVisible(), false);
  }
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator('a[href="/aurelia"]').click();
  await page.waitForURL("**/aurelia");
  const image = await page.request.get(base + "/aurelia/og");
  assert.equal(image.status(), 200); assert.match(image.headers()["content-type"], /image\/jpeg/);
  const bytes = await image.body(), metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 1200); assert.equal(metadata.height, 630);
  await writeFile(path.join(output, "aurelia-og.jpg"), bytes);
  assert.equal((await page.request.get(base + "/does-not-exist/og")).status(), 404);
  const sitemap = await page.request.get(base + "/sitemap.xml"); assert.equal(sitemap.status(), 200); assert.match(await sitemap.text(), /\/aurelia<\/loc>/);
  assert.match(await page.locator('meta[property="og:image"]').getAttribute("content"), /\/aurelia\/og/);
  checks.push("Reduced motion, collection-to-property navigation, generated 1200x630 OG, missing OG 404, published sitemap");
  assert.deepEqual(errors, []); passed = true;
  console.log("Premium polish checks passed");
} finally {
  await browser.close();
  await writeFile(path.join(output, "polish-report.json"), JSON.stringify({ passed, checks, errors }, null, 2));
}
