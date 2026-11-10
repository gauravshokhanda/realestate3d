import { chromium } from "playwright";
import ffmpeg from "ffmpeg-static";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

const output = path.resolve("screenshots/phase-D2"), base = process.env.SMOKE_URL ?? "http://localhost:3400";
await mkdir(path.join(output, "recordings"), { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--enable-gpu"] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: path.join(output, "recordings"), size: { width: 1440, height: 900 } } });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/aurelia", { waitUntil: "networkidle" }); await page.locator('[data-scene="hero-to-plan"][data-ready="true"]').waitFor();
  await page.locator(".intro-loader").waitFor({ state: "detached" });
  await page.screenshot({ path: path.join(output, "live-desktop.png") });
  const cdp = await context.newCDPSession(page), distance = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await cdp.send("Input.synthesizeScrollGesture", { x: 720, y: 450, yDistance: -Math.ceil(distance + 10), speed: 600, preventFling: true, gestureSourceType: "mouse" });
  await page.waitForTimeout(700);
  const video = page.video(); await context.close(); await video.saveAs(path.join(output, "finished-scroll.webm"));
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await mobile.newPage(); phone.on("pageerror", (error) => errors.push(error.message)); await phone.goto(base + "/aurelia", { waitUntil: "networkidle" });
  await phone.locator(".intro-loader").waitFor({ state: "detached" }); await phone.screenshot({ path: path.join(output, "live-mobile.png") }); await mobile.close();
  const full = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const document = await full.newPage(); document.on("pageerror", (error) => errors.push(error.message)); await document.goto(base + "/aurelia", { waitUntil: "networkidle" });
  await document.locator(".intro-loader").waitFor({ state: "detached" });
  await document.locator("img").evaluateAll(async (images) => { images.forEach((image) => { image.loading = "eager"; }); await Promise.all(images.map((image) => image.decode())); });
  await document.screenshot({ path: path.join(output, "live-full-page-reduced-motion.png"), fullPage: true });
  await full.request.post(base + "/api/admin/login", { headers: { origin: base }, data: { password: process.env.ADMIN_PASSWORD } });
  await document.goto(base + "/admin", { waitUntil: "networkidle" });
  await document.getByLabel("Storage status").filter({ hasText: "GB free" }).waitFor();
  const storage = await (await full.request.get(base + "/api/admin/storage")).json();
  await document.screenshot({ path: path.join(output, "live-storage.png"), fullPage: true }); await full.close();
  await writeFile(path.join(output, "live-preview-check.json"), JSON.stringify({ base, errors, storage, fullPageUsesReducedMotion: true, recordingIsBenchmark: false }, null, 2));
  if (errors.length) throw new Error(errors.join("; "));
} finally { await browser.close(); }
await new Promise((resolve, reject) => {
  const child = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", path.join(output, "finished-scroll.webm"), "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(output, "finished-scroll.mp4")], { shell: false, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  let error = ""; child.stderr.on("data", (chunk) => { error += chunk; }); child.on("error", reject); child.on("close", (code) => code === 0 ? resolve() : reject(new Error(error)));
});
console.log("Saved live D: preview recording and desktop screenshot; recording is separate from timing captures.");
