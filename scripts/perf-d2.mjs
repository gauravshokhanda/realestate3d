import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const configuration = process.argv[2] ?? "control";
if (!/^[a-z0-9-]+$/.test(configuration)) throw new Error("Use a simple configuration name");
const output = path.resolve(process.env.PERF_OUTPUT ?? "perf/d2"); await mkdir(output, { recursive: true });
const url = new URL("/aurelia", process.env.PERF_URL ?? "http://localhost:4200").href;
const report = { configuration, url, date: new Date().toISOString(), method: "Headed installed Chrome, hardware GPU verification; foreground tab, cold context per run; 600 CSS px/s continuous CDP mouse/touch input; five runs per desktop/native CPU and mobile/4x CPU; trace + 1ms CPU sampling enabled identically. No extraction/build/other benchmark runs concurrently.", hardware: { cpu: os.cpus()[0].model, cores: os.cpus().length, memory: os.totalmem() }, runs: [] };
if (process.env.PERF_RESUME === "1") {
  const previous = JSON.parse(await readFile(path.join(output, `${configuration}.json`), "utf8"));
  if (previous.url !== url) throw new Error("Resume URL differs"); report.runs = previous.runs;
}
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--enable-automation", "--enable-gpu", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-features=CalculateNativeWinOcclusion", "--window-position=0,0"] });
try {
  const session = await browser.newBrowserCDPSession();
  report.browser = browser.version(); report.gpu = await session.send("SystemInfo.getInfo");
  report.commandLine = (await session.send("Browser.getBrowserCommandLine")).arguments;
  const renderer = JSON.stringify(report.gpu.gpu.auxAttributes);
  report.gpuVerified = !/SwiftShader|llvmpipe|Software Rasterizer/i.test(renderer) && report.gpu.gpu.featureStatus.gpu_compositing === "enabled" && !report.commandLine.includes("--disable-gpu");
  if (!report.gpuVerified) { await writeFile(path.join(output, `${configuration}-gpu.json`), JSON.stringify(report, null, 2)); throw new Error("Hardware GPU compositing is not enabled; refusing to label this a GPU benchmark"); }
  for (let iteration = 1; iteration <= 5; iteration++) for (const mobile of [false, true]) {
    const device = mobile ? "mobile" : "desktop";
    if (report.runs.some((r) => r.iteration === iteration && r.device === device)) continue;
    const name = `${configuration}-${device}-${iteration}`;
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage(); await page.bringToFront();
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.__d2Bitmap = { live: 0, bytes: 0, peakBytes: 0, decoded: 0 };
      const create = window.createImageBitmap;
      window.createImageBitmap = async (...args) => {
        const bitmap = await create(...args), stats = window.__d2Bitmap, bytes = bitmap.width * bitmap.height * 4;
        stats.live++; stats.bytes += bytes; stats.decoded++; stats.peakBytes = Math.max(stats.peakBytes, stats.bytes);
        const close = bitmap.close.bind(bitmap); let closed = false;
        bitmap.close = () => { if (!closed) { closed = true; stats.live--; stats.bytes -= bytes; } close(); }; return bitmap;
      };
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: mobile ? 4 : 1 });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    await page.locator('[data-scene="hero-to-plan"][data-ready="true"]').waitFor({ timeout: 90000 });
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1000);
    const reference = await page.evaluate(async () => { const values = []; let previous; await new Promise((resolve) => { const tick = (now) => { if (previous) values.push(now - previous); previous = now; if (values.length === 60) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }); values.sort((a, b) => a - b); return { median: values[30], p95: values[57], visibility: document.visibilityState }; });
    const complete = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
    await cdp.send("Tracing.start", { categories: "toplevel,devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame", transferMode: "ReturnAsStream" });
    await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 1000 }); await cdp.send("Profiler.start");
    const measurement = page.evaluate(async () => {
      const ranges = [...document.querySelectorAll("[data-scene]")].map((el) => ({ id: el.dataset.scene, top: el.getBoundingClientRect().top + scrollY, bottom: el.getBoundingClientRect().bottom + scrollY, el, canvas: el.querySelector("canvas") }));
      const end = document.documentElement.scrollHeight - innerHeight, contactTop = (document.getElementById("contact")?.getBoundingClientRect().top ?? Infinity) + scrollY;
      const intervals = [], tasks = [], samples = [], ready = new Set(), cachePeaks = { frames: 0, bytes: 0 };
      let finished = false, previous, lastSample = -Infinity, hidden = 0;
      window.__d2Finish = () => { finished = true; };
      const changed = () => { if (document.visibilityState !== "visible") hidden++; }; document.addEventListener("visibilitychange", changed);
      const consume = (entries) => tasks.push(...entries.map((x) => ({ start: x.startTime, duration: x.duration, attribution: x.attribution.map((a) => ({ name: a.name, containerType: a.containerType, containerSrc: a.containerSrc })) })));
      const observer = new PerformanceObserver((list) => consume(list.getEntries())); observer.observe({ type: "longtask" });
      const start = performance.now(); performance.mark("d2-scroll-start");
      await new Promise((resolve) => {
        const tick = (now) => {
          if (previous !== undefined) intervals.push(now - previous); previous = now;
          if (now - lastSample >= 100) {
            const range = ranges.find((r) => scrollY >= r.top - 4 && scrollY < r.bottom - 4);
            const scene = range?.id ?? (scrollY >= contactTop ? "contact" : "amenities");
            ranges.forEach((r) => { if (r.el.dataset.ready === "true") ready.add(r.id); });
            const cache = window.__frameCacheStats ?? { frames: window.__d2Bitmap.live + [...document.querySelectorAll("canvas")].reduce((n, c) => n + Number(c.dataset.workerBitmaps ?? 0), 0), bytes: window.__d2Bitmap.bytes + [...document.querySelectorAll("canvas")].reduce((n, c) => n + Number(c.dataset.workerBytes ?? 0), 0) };
            cachePeaks.frames = Math.max(cachePeaks.frames, cache.frames); cachePeaks.bytes = Math.max(cachePeaks.bytes, cache.bytes);
            samples.push({ time: now - start, y: scrollY, scene, frame: Number(range?.canvas?.dataset.frame ?? -1), target: Number(range?.canvas?.dataset.targetFrame ?? -1), cache }); lastSample = now;
          }
          if (finished) resolve(); else requestAnimationFrame(tick);
        }; requestAnimationFrame(tick);
      });
      consume(observer.takeRecords()); observer.disconnect(); document.removeEventListener("visibilitychange", changed); performance.mark("d2-scroll-end");
      intervals.sort((a, b) => a - b);
      const longTasks = tasks.filter((t) => t.start >= start && t.duration > 50).map((t) => { const time = t.start - start; const sample = samples.reduce((last, s) => s.time <= time ? s : last, samples[0]); return { ...t, time, scene: sample?.scene ?? "unknown" }; });
      return { start, duration: performance.now() - start, distance: end, finalY: scrollY, p95: intervals[Math.floor(intervals.length * .95)], average: intervals.reduce((a, b) => a + b, 0) / intervals.length, intervals: intervals.length, dropped: intervals.reduce((n, d) => n + Math.max(0, Math.round(d / (1000 / 60)) - 1), 0), longTasks, samples, cachePeaks, readyScenes: [...ready], hidden };
    });
    void measurement.catch(() => {}); await page.waitForFunction(() => !!window.__d2Finish);
    const distance = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    if (mobile) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195, y: 675 }] });
      const began = performance.now(); let travel = 0;
      while (travel < distance + 40) { travel = Math.min(distance + 40, (performance.now() - began) * .6); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 195, y: 675 - travel }] }); await new Promise((resolve) => setTimeout(resolve, 16)); }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    } else await cdp.send("Input.synthesizeScrollGesture", { x: 720, y: 450, yDistance: -Math.ceil(distance + 10), speed: 600, preventFling: true, gestureSourceType: "mouse" });
    await page.waitForFunction((end) => scrollY >= end - 4, distance, { timeout: 20000 }); await page.evaluate(() => window.__d2Finish());
    const measured = await measurement;
    const { profile } = await cdp.send("Profiler.stop"); await cdp.send("Tracing.end"); const { stream } = await complete;
    const chunks = []; while (true) { const chunk = await cdp.send("IO.read", { handle: stream }); chunks.push(Buffer.from(chunk.data, chunk.base64Encoded ? "base64" : "utf8")); if (chunk.eof) break; } await cdp.send("IO.close", { handle: stream });
    await writeFile(path.join(output, `${name}-trace.json.gz`), await promisify(gzip)(Buffer.concat(chunks)));
    await writeFile(path.join(output, `${name}-cpu.json.gz`), await promisify(gzip)(Buffer.from(JSON.stringify(profile))));
    const run = { iteration, device, cpuThrottle: mobile ? 4 : 1, reference, ...measured, errors, valid: measured.hidden === 0 && reference.visibility === "visible" && measured.readyScenes.length === 4 && errors.length === 0, trace: `${name}-trace.json.gz`, profile: `${name}-cpu.json.gz` };
    report.runs.push(run); await writeFile(path.join(output, `${configuration}.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ configuration, iteration, device, p95: run.p95, longTasks: run.longTasks.length, cacheMB: run.cachePeaks.bytes / 1048576, ready: run.readyScenes.length, valid: run.valid })); await context.close();
  }
  report.summary = Object.fromEntries(["desktop", "mobile"].map((device) => {
    const runs = report.runs.filter((r) => r.device === device), p95 = runs.map((r) => r.p95).sort((a, b) => a - b), tasks = runs.map((r) => r.longTasks.length).sort((a, b) => a - b);
    return [device, { runs: runs.length, validRuns: runs.filter((r) => r.valid).length, p95Median: p95[2], p95Worst: p95.at(-1), longTasksMedian: tasks[2], longTasksWorst: tasks.at(-1), passes: runs.length === 5 && runs.every((r) => r.valid) && p95[2] <= (device === "desktop" ? 20 : 33) && tasks[2] <= (device === "desktop" ? 0 : 1) }];
  }));
  await writeFile(path.join(output, `${configuration}.json`), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report.summary, null, 2));
} finally { await browser.close(); }
