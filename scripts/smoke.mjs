import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.SMOKE_URL ?? "http://localhost:3000";
const propertyURL = new URL("/aurelia", baseURL).href;
const output = path.resolve(process.env.SMOKE_OUTPUT ?? "screenshots/phase-C");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.SMOKE_CHANNEL ? { channel: process.env.SMOKE_CHANNEL } : {}) });
const reports = [];
let failed = false;
try {
  for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const report = { viewport, consoleErrors: [], pageErrors: [], failedRequests: [], httpErrors: [], screenshots: [], checks: [] };
    reports.push(report);
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("requestfailed", (request) => report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on("response", (response) => { if (response.status() >= 400) report.httpErrors.push({ url: response.url(), status: response.status() }); });
    const frameRequests = [];
    page.on("request", (request) => { if (/\/sequences(?:-d2)?\//.test(request.url())) frameRequests.push(request.url()); });
    try {
      await page.goto(propertyURL, { waitUntil: "networkidle", timeout: 60000 });
      await page.locator('[data-scene="hero-to-plan"][data-ready="true"]').waitFor({ timeout: 60000 });
      report.initialEncodedBytes = await page.evaluate(() => [...performance.getEntriesByType("navigation"), ...performance.getEntriesByType("resource")].reduce((sum, resource) => sum + resource.encodedBodySize, 0));
      const eagerRooms = frameRequests.filter((url) => /\/plan-to-/.test(url) && !/frame_0001\.webp/.test(url));
      if (eagerRooms.length) throw new Error("Room frames loaded before the first scene was halfway scrolled");
      for (const percent of [0, 25, 50, 80, 100]) {
        await page.evaluate((p) => {
          const scene = document.querySelector('[data-scene="hero-to-plan"]');
          const start = scene.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top: start + Number(scene.dataset.scrollLength) * p / 100, behavior: "instant" });
        }, percent);
        await page.waitForTimeout(1300); // Allow the 0.5s scrub and UI fades to settle.
        if (percent === 50 && await page.locator("#room-living").count()) {
          await page.locator('#room-living [data-enabled="true"]').waitFor();
        }
        const state = await page.evaluate(() => {
          const overlay = [...document.querySelectorAll("nextjs-portal")].some((portal) => {
            const root = portal.shadowRoot;
            return root?.querySelector('[data-nextjs-dialog-overlay], [data-nextjs-error-overlay], [data-nextjs-errors-dialog]') || /Unhandled Runtime Error|Runtime Error|Build Error/.test(root?.textContent ?? "");
          });
          const scene = document.querySelector('[data-scene="hero-to-plan"]');
          return { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, overlay, scrollY: window.scrollY, progress: Number(scene.querySelector("section").dataset.progress ?? 0), frame: Number(scene.querySelector("canvas").dataset.frame) };
        });
        report.checks.push({ percent, ...state });
        if (state.scrollWidth > state.innerWidth || state.overlay) throw new Error("Overflow or Next.js error overlay at " + percent + "%");
        if (Math.abs(state.progress - percent / 100) > 0.06) throw new Error("Incorrect scene progress at " + percent + "%: " + state.progress);
        const filename = `${viewport.name}-${String(percent).padStart(3, "0")}.png`;
        await page.screenshot({ path: path.join(output, filename) });
        report.screenshots.push(filename);
      }
      if (await page.locator('[role="tab"]').count()) {
        await page.evaluate(() => {
          const scene = document.querySelector('[data-scene="hero-to-plan"]');
          window.scrollTo({ top: scene.getBoundingClientRect().top + window.scrollY + Number(scene.dataset.scrollLength) * 0.8, behavior: "instant" });
        });
        await page.waitForTimeout(1300);
        await page.getByRole("tab", { name: "Residence B" }).click();
        await page.getByRole("tabpanel").getByRole("heading", { name: "Residence B" }).waitFor();
        if (await page.locator("#unit").count() && await page.locator("#unit").inputValue() !== "residence-b") throw new Error("Contact unit did not follow the selection");
        if (await page.getByRole("button", { name: /^Explore / }).count() !== 2) throw new Error("Residence B hotspots did not update");
        await page.getByRole("tab", { name: "Residence B" }).press("ArrowLeft");
        await page.getByRole("tabpanel").getByRole("heading", { name: "Residence A" }).waitFor();
        for (const [id, label] of [["living", "Living Room"], ["kitchen", "Kitchen"], ["primary-bedroom", "Primary Bedroom"]]) {
          await page.getByRole("button", { name: "Explore " + label, exact: true }).click();
          await page.locator(`#room-${id} [data-ready="true"]`).waitFor({ timeout: 60000 });
          // Wait for the real navigation to settle before issuing a second seek.
          // A wall-clock sleep can expire while the renderer is descheduled.
          await page.waitForFunction((roomId) => {
            const top = document.getElementById(`room-${roomId}`).getBoundingClientRect().top;
            const key = `arrival-${roomId}`, previous = window.__smokeArrival;
            const stable = Math.abs(top) < 2 && previous?.key === key && Math.abs(previous.y - scrollY) < .25;
            window.__smokeArrival = { key, y: scrollY, count: stable ? previous.count + 1 : 0 };
            return window.__smokeArrival.count >= 6;
          }, id, { timeout: 20000 });
          await page.evaluate((roomId) => {
            const scene = document.querySelector(`#room-${roomId} [data-scene]`);
            window.scrollTo({ top: scene.getBoundingClientRect().top + window.scrollY + Number(scene.dataset.scrollLength) * 0.5, behavior: "instant" });
          }, id);
          await page.waitForFunction((roomId) => {
            const scene = document.querySelector(`#room-${roomId} [data-scene]`), canvas = scene.querySelector("canvas");
            const progress = Number(scene.querySelector("section").dataset.progress), frame = Number(canvas.dataset.frame), target = Number(canvas.dataset.targetFrame);
            return progress >= .45 && progress <= .55 && target > 1 && Math.abs(frame - target) <= 3;
          }, id, { timeout: 15000 });
          const frame = await page.locator(`#room-${id} canvas`).getAttribute("data-frame");
          if (Number(frame) < 1) throw new Error("Room frames did not scrub: " + id);
          const filename = `${viewport.name}-room-${id}.png`;
          await page.screenshot({ path: path.join(output, filename) });
          report.screenshots.push(filename);
          await page.locator(`#room-${id}`).getByRole("link", { name: "Back to plan", exact: false }).click();
          await page.waitForTimeout(1800);
        }
        report.checks.push({ unitSwitching: true, keyboardTabs: true, hotspotsAndBackLinks: true });
      }
      if (await page.locator("nav").getByRole("link", { name: "Amenities", exact: true }).count()) {
        await page.locator("nav").getByRole("link", { name: "Amenities", exact: true }).click();
        await page.waitForTimeout(2000);
        const filename = `${viewport.name}-amenities.png`;
        await page.screenshot({ path: path.join(output, filename) });
        report.screenshots.push(filename);
        await page.locator("nav").getByRole("link", { name: "Contact", exact: true }).click();
        await page.waitForTimeout(2000);
        const gaps = await page.locator("[data-scene]").evaluateAll((scenes) => scenes.slice(0, -1).map((scene, index) => Math.abs(scene.getBoundingClientRect().bottom - scenes[index + 1].getBoundingClientRect().top)));
        if (gaps.some((gap) => gap > 2)) throw new Error("A gap appeared between pinned scenes: " + gaps.join(","));
        report.checks.push({ navAnchors: true, contiguousSceneTracks: true });
      }
      if (await page.locator("#contact form").count()) {
        await page.locator("#contact").scrollIntoViewIfNeeded();
        await page.getByRole("button", { name: "Request a private viewing" }).click();
        await page.locator("#name-error").waitFor();
        await page.getByLabel("Full name", { exact: true }).fill("Smoke Test");
        await page.getByLabel("Email address", { exact: true }).fill("smoke@example.invalid");
        await page.getByLabel("Phone (optional)", { exact: true }).fill("+1 555 000 0000");
        await page.getByLabel("Message (optional)", { exact: true }).fill("Automated local form verification.");
        // Mock delivery so smoke runs can never email real recipients.
        let formAttempts = 0;
        await page.route("**/api/lead", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(++formAttempts === 1 ? { success: false, error: "Please try your inquiry again." } : { success: true }) }));
        await page.getByRole("button", { name: "Request a private viewing" }).click();
        await page.getByRole("alert").filter({ hasText: "Please try your inquiry again." }).waitFor();
        await page.getByRole("button", { name: "Request a private viewing" }).click();
        await page.getByText("Thank you for your interest.", { exact: true }).waitFor();
        const filename = `${viewport.name}-contact-success.png`;
        await page.screenshot({ path: path.join(output, filename) });
        report.screenshots.push(filename);
        report.checks.push({ inlineValidation: true, contactUnitSync: true, mockedFormErrorAndSuccess: true });
        await page.unroute("**/api/lead");
      }
    } catch (error) {
      report.pageErrors.push(error.message);
      await page.screenshot({ path: path.join(output, viewport.name + "-failure.png") }).catch(() => {});
    }
    const errors = report.consoleErrors.length + report.pageErrors.length + report.httpErrors.length + report.failedRequests.filter((request) => !request.error?.includes("ERR_ABORTED")).length;
    if (errors) failed = true;
    console.log(`${viewport.name}: console=${report.consoleErrors.length}, runtime=${report.pageErrors.length}, HTTP=${report.httpErrors.length}, failed requests=${report.failedRequests.length}, screenshots=${report.screenshots.length}`);
    await context.close();
  }
  for (const viewport of [{ name: "desktop-reduced", width: 1440, height: 900 }, { name: "mobile-reduced", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    const report = { viewport, consoleErrors: [], pageErrors: [], failedRequests: [], httpErrors: [], screenshots: [], checks: [] };
    reports.push(report);
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("requestfailed", (request) => report.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on("response", (response) => { if (response.status() >= 400) report.httpErrors.push({ url: response.url(), status: response.status() }); });
    const animatedFrames = [];
    page.on("request", (request) => { if (/frame_(?!0001)\d+\.webp/.test(request.url())) animatedFrames.push(request.url()); });
    try {
      await page.goto(propertyURL, { waitUntil: "networkidle" });
      await page.locator('[data-scene="hero-to-plan"][data-ready="true"]').waitFor({ timeout: 60000 });
      const heroFile = viewport.name + "-hero.png";
      await page.screenshot({ path: path.join(output, heroFile) });
      report.screenshots.push(heroFile);
      // Static document flow gives reviewers an overview without pinned-scene gaps.
      await page.locator("#contact").scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(300);
      await page.locator("img").evaluateAll(async (images) => {
        for (const image of images) image.loading = "eager";
        await Promise.all(images.map((image) => image.decode()));
      });
      const fullFile = viewport.name + "-full-page.png";
      await page.screenshot({ path: path.join(output, fullFile), fullPage: true });
      report.screenshots.push(fullFile);
      await page.locator("#contact").scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      const state = await page.evaluate(() => ({ pins: document.querySelectorAll(".pin-spacer").length, overflow: document.documentElement.scrollWidth > window.innerWidth, visibleCanvases: [...document.querySelectorAll("canvas")].filter((canvas) => getComputedStyle(canvas).display !== "none").length }));
      if (state.pins || state.overflow || state.visibleCanvases || animatedFrames.length) throw new Error("Reduced motion did not use static, unpinned document flow: " + JSON.stringify(state));
      const filename = viewport.name + "-contact.png";
      await page.screenshot({ path: path.join(output, filename) });
      report.screenshots.push(filename);
      report.checks.push({ ...state, animatedFrames: animatedFrames.length });
    } catch (error) { report.pageErrors.push(error.message); }
    if (report.consoleErrors.length || report.pageErrors.length || report.httpErrors.length || report.failedRequests.some((request) => !request.error?.includes("ERR_ABORTED"))) failed = true;
    console.log(`${viewport.name}: console=${report.consoleErrors.length}, runtime=${report.pageErrors.length}, HTTP=${report.httpErrors.length}, failed requests=${report.failedRequests.length}, screenshots=${report.screenshots.length}`);
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(path.join(output, "smoke-report.json"), JSON.stringify(reports, null, 2));
}
if (failed) {
  console.error(JSON.stringify(reports, null, 2));
  process.exitCode = 1;
}
if (!failed) await import("./smoke-platform.mjs");
if (!failed) await import("./smoke-admin.mjs");
if (!failed) await import("./smoke-videos.mjs");

if (!failed) await import("./smoke-panoramas.mjs");
if (!failed) await import("./smoke-polish.mjs");
