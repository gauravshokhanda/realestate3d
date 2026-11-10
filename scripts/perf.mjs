import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { gzip } from "node:zlib";
import { promisify } from "node:util";

const label = process.argv[2] ?? "before";
const scrollMode = process.env.PERF_SCROLL ?? "gesture";
if (!/^[a-z0-9-]+$/.test(label)) throw new Error("Use a simple report label");
if (!["gesture", "scripted"].includes(scrollMode)) throw new Error("PERF_SCROLL must be gesture or scripted");
const output = path.resolve(process.env.PERF_OUTPUT ?? "perf");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PERF_CHANNEL ?? "chrome", headless: true });
const report = { label, date: new Date().toISOString(), browser: browser.version(), scrollMode, hardware: { cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryBytes: os.totalmem(), platform: os.platform() }, url: new URL("/aurelia", process.env.PERF_URL ?? "http://localhost:3300").href, method: `Cold browser context; hero and fonts ready. ${scrollMode === "gesture" ? "CDP continuous mouse/touch gesture" : "Instant scripted scroll on rAF"} at 600 CSS px/s. Includes lazy decoding and scene setup. Dropped frames estimated against 60 Hz; long tasks from PerformanceObserver. Trace covers the same interval.`, runs: [] };
if (process.env.PERF_RESUME === "1") {
  const previous = JSON.parse(await readFile(path.join(output, `${label}.json`), "utf8"));
  if (previous.url !== report.url || previous.scrollMode !== scrollMode || previous.browser !== report.browser) throw new Error("Cannot resume a different browser, URL or input mode");
  report.runs = previous.runs;
}
try {
  for (const mobile of [false, true]) {
    const name = mobile ? "mobile" : "desktop";
    if (report.runs.some((run) => run.name === name)) continue;
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const stats = { imageDecodes: 0, bitmapDecodes: 0, liveBitmaps: 0, peakBitmaps: 0, liveBitmapBytes: 0, peakBitmapBytes: 0 };
      window.__decodeStats = stats;
      const readyHistory = new Set();
      window.__readySceneHistory = readyHistory;
      document.addEventListener("DOMContentLoaded", () => {
        const collect = () => document.querySelectorAll('[data-scene][data-ready="true"]').forEach((element) => readyHistory.add(element.dataset.scene));
        collect();
        new MutationObserver(collect).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["data-ready"] });
      }, { once: true });
      const workerStats = { decoded: 0, live: 0, bytes: 0 };
      window.__workerDecodeStats = workerStats;
      window.addEventListener("sequence-resources", () => {
        const canvases = [...document.querySelectorAll("canvas[data-worker-decoded]")];
        workerStats.decoded = canvases.reduce((sum, canvas) => sum + Number(canvas.dataset.workerDecoded), 0);
        workerStats.live = canvases.reduce((sum, canvas) => sum + Number(canvas.dataset.workerBitmaps), 0);
        workerStats.bytes = canvases.reduce((sum, canvas) => sum + Number(canvas.dataset.workerBytes), 0);
        stats.peakBitmaps = Math.max(stats.peakBitmaps, stats.liveBitmaps + workerStats.live);
        stats.peakBitmapBytes = Math.max(stats.peakBitmapBytes, stats.liveBitmapBytes + workerStats.bytes);
      });
      const decode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = async function () { const result = await decode.call(this); stats.imageDecodes++; return result; };
      const create = window.createImageBitmap;
      window.createImageBitmap = async (...args) => {
        const bitmap = await create(...args);
        stats.bitmapDecodes++; stats.liveBitmaps++; stats.peakBitmaps = Math.max(stats.peakBitmaps, stats.liveBitmaps);
        const bytes = bitmap.width * bitmap.height * 4;
        stats.liveBitmapBytes += bytes; stats.peakBitmapBytes = Math.max(stats.peakBitmapBytes, stats.liveBitmapBytes);
        const close = bitmap.close.bind(bitmap);
        let closed = false;
        bitmap.close = () => { if (!closed) { stats.liveBitmaps--; stats.liveBitmapBytes -= bytes; closed = true; } close(); };
        return bitmap;
      };
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: mobile ? 4 : 1 });
    await cdp.send("Performance.enable");
    const referenceCadence = await page.evaluate(async () => {
      const intervals = []; let previous;
      await new Promise((resolve) => {
        const tick = (time) => {
          if (previous !== undefined) intervals.push(time - previous);
          previous = time;
          if (intervals.length >= 90) resolve(); else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      intervals.sort((a, b) => a - b);
      return { medianMs: intervals[45], p95Ms: intervals[85], approximateHz: 1000 / intervals[45] };
    });
    await page.goto(report.url, { waitUntil: "networkidle", timeout: 90000 });
    await page.locator('[data-scene="hero-to-plan"][data-ready="true"]').waitFor({ timeout: 90000 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(output, `${label}-${name}-top.png`) });
    const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value]));
    const start = await metrics();
    let peakHeap = start.JSHeapUsedSize;
    const sampler = setInterval(() => { void metrics().then((value) => { peakHeap = Math.max(peakHeap, value.JSHeapUsedSize); }).catch(() => {}); }, 500);
    sampler.unref();
    const traceComplete = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
    await cdp.send("Tracing.start", { categories: "devtools.timeline,blink.user_timing,cc,disabled-by-default-devtools.timeline.frame", transferMode: "ReturnAsStream" });
    const measuring = page.evaluate(async (mode) => {
      const deltas = [];
      const longTasks = [];
      // Scene tracks reserve their height. Reading it after each scroll write
      // would force layout in the benchmark itself and distort the result.
      const end = document.documentElement.scrollHeight - innerHeight;
      const observer = new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((entry) => ({ start: entry.startTime, duration: entry.duration }))));
      observer.observe({ type: "longtask" });
      const start = performance.now();
      let previous = start;
      let distance = 0;
      let finished = false, scrollEndEvents = 0;
      window.__finishPerf = () => { finished = true; };
      const scrollEnd = () => scrollEndEvents++;
      window.addEventListener("scrollend", scrollEnd);
      await new Promise((resolve) => {
        const tick = (now) => {
          deltas.push(now - previous); previous = now;
          if (mode === "scripted") {
            distance = Math.min(end, (now - start) * 0.6);
            window.scrollTo({ top: distance, behavior: "instant" });
          } else distance = window.scrollY;
          if (mode === "scripted" ? distance >= end : finished) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      observer.disconnect();
      window.removeEventListener("scrollend", scrollEnd);
      const sorted = deltas.slice(1).sort((a, b) => a - b);
      const main = window.__decodeStats, worker = window.__workerDecodeStats;
      const decodedImages = { ...main, bitmapDecodes: main.bitmapDecodes + worker.decoded, liveBitmaps: main.liveBitmaps + worker.live, liveBitmapBytes: main.liveBitmapBytes + worker.bytes, workerBitmapDecodes: worker.decoded };
      return { durationMs: performance.now() - start, distance, scrollEndEvents, frames: sorted.length, averageFrameMs: sorted.reduce((sum, n) => sum + n, 0) / sorted.length, p95FrameMs: sorted[Math.floor(sorted.length * 0.95)], maxFrameMs: sorted.at(-1), droppedFrames: sorted.reduce((sum, n) => sum + Math.max(0, Math.round(n / (1000 / 60)) - 1), 0), longTasks, decodedImages, readySceneHistory: [...window.__readySceneHistory], readyScenes: [...document.querySelectorAll('[data-ready="true"]')].map((el) => el.dataset.scene) };
    }, scrollMode);
    void measuring.catch(() => {}); // Browser teardown also settles a pending capture on input failure.
    if (scrollMode === "gesture") {
      await page.waitForFunction(() => typeof window.__finishPerf === "function");
      const distance = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const viewport = page.viewportSize();
      if (mobile) {
        // High-level synthetic touch is a no-op on this Windows headless Chrome,
        // including a plain scrolling test document. Dispatch actual touch events
        // instead. The captured touch may leave the viewport during a long drag.
        const x = viewport.width / 2, y = viewport.height * 0.8;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        const began = performance.now();
        let travel = 0;
        while (travel < distance + 40) {
          travel = Math.min(distance + 40, (performance.now() - began) * 0.6);
          await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - travel }] });
          await new Promise((resolve) => setTimeout(resolve, 16));
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      } else await cdp.send("Input.synthesizeScrollGesture", { x: viewport.width / 2, y: viewport.height / 2, yDistance: -Math.ceil(distance + 10), speed: 600, preventFling: true, gestureSourceType: "mouse" });
      await page.waitForFunction((end) => window.scrollY >= end - 4, distance, { timeout: 15000 });
      await page.evaluate(() => window.__finishPerf());
    }
    const measurement = await measuring;
    clearInterval(sampler);
    await cdp.send("Tracing.end");
    const { stream } = await traceComplete;
    const chunks = [];
    while (true) { const chunk = await cdp.send("IO.read", { handle: stream }); chunks.push(Buffer.from(chunk.data, chunk.base64Encoded ? "base64" : "utf8")); if (chunk.eof) break; }
    await cdp.send("IO.close", { handle: stream });
    await writeFile(path.join(output, `${label}-${name}-trace.json.gz`), await promisify(gzip)(Buffer.concat(chunks)));
    const end = await metrics();
    const run = { name, viewport: page.viewportSize(), cpuThrottle: mobile ? 4 : 1, referenceCadence, ...measurement, heap: { startBytes: start.JSHeapUsedSize, endBytes: end.JSHeapUsedSize, peakBytes: peakHeap }, trace: `${label}-${name}-trace.json.gz`, passes: { p95: measurement.p95FrameMs <= (mobile ? 33 : 20), longTasks: measurement.longTasks.length === 0 } };
    report.runs.push(run);
    console.log(JSON.stringify({ name, averageFrameMs: run.averageFrameMs, p95FrameMs: run.p95FrameMs, droppedFrames: run.droppedFrames, longTasks: run.longTasks.length, decodedImages: run.decodedImages, heap: run.heap, passes: run.passes }, null, 2));
    await writeFile(path.join(output, `${label}.json`), JSON.stringify(report, null, 2) + "\n");
    await page.screenshot({ path: path.join(output, `${label}-${name}-bottom.png`) });
    await context.close();
  }
} finally { await browser.close(); }
