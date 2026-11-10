import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const output = path.resolve(process.env.SMOKE_OUTPUT ?? "screenshots/phase-D");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: output, size: { width: 1440, height: 900 } } });
  const page = await context.newPage();
  await page.goto(new URL("/aurelia", process.env.SMOKE_URL ?? "http://localhost:3400").href, { waitUntil: "networkidle", timeout: 90000 });
  await page.locator('[data-scene="hero-to-plan"][data-ready="true"]').waitFor({ timeout: 90000 });
  await page.waitForTimeout(700);
  const cdp = await context.newCDPSession(page);
  const distance = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await cdp.send("Input.synthesizeScrollGesture", { x: 720, y: 450, yDistance: -Math.ceil(distance + 10), speed: 600, preventFling: true, gestureSourceType: "mouse" });
  await page.waitForFunction((end) => scrollY >= end - 4, distance);
  await page.waitForTimeout(700);
  const video = page.video();
  await context.close();
  await video.saveAs(path.join(output, "desktop-scroll.webm"));
  await video.delete();
  console.log(path.join(output, "desktop-scroll.webm"));
} finally { await browser.close(); }
