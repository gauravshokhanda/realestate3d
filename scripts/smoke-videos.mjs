import dotenv from "dotenv";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { randomInt, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { runTestFfmpeg, syntheticLongVideo } from "./smoke-video-fixtures.mjs";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
sharp.cache(false);
const base = process.env.SMOKE_URL ?? "http://localhost:3000", headers = { origin: base };
const output = path.resolve(process.env.SMOKE_OUTPUT ?? "screenshots/phase-C"); await mkdir(output, { recursive: true });
const database = process.env.DATABASE_URL || "file:./data/app.db";
const db = new PrismaClient({ datasourceUrl: database.startsWith("file:") ? "file:" + path.resolve(database.slice(5)).replaceAll("\\", "/") : database });
const browser = await chromium.launch({ headless: true, ...(process.env.SMOKE_CHANNEL ? { channel: process.env.SMOKE_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders: { "x-forwarded-for": `198.21.${randomInt(1, 250)}.${randomInt(1, 250)}` } });
const anon = await browser.newContext(); const page = await context.newPage();
page.setDefaultTimeout(60000);
const temporary = await mkdtemp(path.join(os.tmpdir(), "aurelia-video-tests-"));
const fixtures = [], checks = [], runtimeErrors = [], results = [];
let passed = false, failure = null;
page.on("pageerror", (error) => runtimeErrors.push(error.message));
const api = async (url, method = "GET", data) => {
  const response = await context.request.fetch(base + url, { method, headers, ...(data === undefined ? {} : { data }) });
  const body = await response.json(); assert(response.ok(), `${method} ${url}: ${response.status()} ${JSON.stringify(body)}`); return body;
};
async function createFixture() {
  const slug = `video-${randomUUID().slice(0, 8)}`;
  const created = await api("/api/admin/properties", "POST", { name: "Video acceptance test", slug });
  fixtures.push({ id: created.id, slug }); return api(`/api/admin/properties/${created.id}`);
}
async function uploadImage(id, file) {
  const response = await context.request.post(`${base}/api/admin/upload?propertyId=${id}`, { headers, multipart: { file: { name: "still.png", mimeType: "image/png", buffer: await readFile(file) } } });
  assert.equal(response.status(), 201); return (await response.json()).url;
}
async function uploadVideo(id, scene, file, settings = { removeWatermark: true, delogo: { x: 1130, y: 569, w: 62, h: 64 } }) {
  const response = await context.request.post(`${base}/api/admin/properties/${id}/videos/${scene.id}/upload?${new URLSearchParams({ settings: JSON.stringify(settings) })}`, { headers, multipart: { file: { name: "move.mp4", mimeType: "video/mp4", buffer: await readFile(file) } }, timeout: 120000 });
  assert.equal(response.status(), 202, await response.text());
}
async function settled(id) {
  // Size-budget tuning may encode several quality/fps variants for each queued scene.
  const deadline = Date.now() + 900000;
  while (Date.now() < deadline) {
    const view = await api(`/api/admin/properties/${id}/videos`);
    if (view.scenes.every((s) => ["ready", "needs_review", "failed"].includes(s.status))) return view;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`Video extraction timed out: ${JSON.stringify(await api(`/api/admin/properties/${id}/videos`))}`);
}
async function capture(name, locator = page) {
  await page.locator("img").evaluateAll(async (images) => { images.forEach((image) => { image.loading = "eager"; }); await Promise.all(images.map((image) => image.decode())); });
  await locator.screenshot({ path: path.join(output, name), ...(locator === page ? { fullPage: true } : {}) });
}
try {
  assert.equal((await anon.request.get(base + "/api/admin/properties/aurelia/videos")).status(), 401);
  await api("/api/admin/login", "POST", { password: process.env.ADMIN_PASSWORD });
  let property = await createFixture();
  const id = property.id;
  property.towerImage = await uploadImage(id, "assets/stills/tower-exterior.png");
  property.planImage = await uploadImage(id, "assets/stills/floor-plan.png");
  property.units = [{ id: randomUUID(), name: "Residence Test", beds: 3, baths: 3, sqft: 2450, price: "From $1.2M" }];
  property.rooms = [];
  for (const [key, label, image] of [["living", "Living room", "living-room"], ["kitchen", "Kitchen", "kitchen"], ["bedroom", "Primary bedroom", "primary-bedroom"]]) property.rooms.push({ id: randomUUID(), key, label, description: "Existing supplied assets", image: await uploadImage(id, `assets/stills/${image}.png`), hotspotX: 50, hotspotY: 50 });
  property = await api(`/api/admin/properties/${id}`, "PUT", property);
  let view = await api(`/api/admin/properties/${id}/videos`); assert.equal(view.scenes.length, 4);
  if (!process.env.GEMINI_API_KEY || !process.env.VEO_MODEL) {
    assert.equal(view.veo.enabled, false);
    const rejected = await context.request.post(`${base}/api/admin/properties/${id}/videos`, { headers, data: { action: "generate-all", confirmPaid: true, sceneIds: view.scenes.map((s) => s.id) } });
    assert.equal(rejected.status(), 409); checks.push("Manual mode works without Gemini configuration; generation returns the configuration reason without a paid call");
  }
  const unconfirmed = await context.request.post(`${base}/api/admin/properties/${id}/videos`, { headers, data: { action: "generate-all", confirmPaid: false, sceneIds: view.scenes.map((s) => s.id) } }); assert.equal(unconfirmed.status(), 400);
  const bad = await context.request.post(`${base}/api/admin/properties/${id}/videos/${view.scenes[0].id}/upload`, { headers, multipart: { file: { name: "fake.mp4", mimeType: "video/mp4", buffer: Buffer.from("not an MP4") } } }); assert.equal(bad.status(), 400);
  for (const scene of view.scenes) await uploadVideo(id, scene, `assets/videos/${scene.key}.mp4`);
  view = await settled(id);
  assert(view.scenes.every((s) => s.status !== "failed"), JSON.stringify(view.scenes.map((s) => ({ key: s.key, error: s.error }))));
  assert.equal(view.scenes.find((s) => s.key === "plan-to-kitchen").status, "needs_review");
  assert.equal(view.scenes.filter((s) => s.status === "ready").length, 3);
  for (const scene of view.scenes) {
    const directory = path.resolve(process.env.STORAGE_DIR || "storage", "properties", property.slug, "sequences", scene.key);
    const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
    for (const [suffix, variant] of [["", manifest.desktop], ["-mobile", manifest.mobile]]) {
      const files = (await readdir(directory + suffix)).filter((name) => /^frame_\d+\.webp$/.test(name));
      assert.equal(files.length, variant.frameCount); assert(files.length > 0 && files.length <= 240);
      assert(variant.width <= (suffix ? 640 : 1280));
      assert(variant.bytes <= (suffix ? 3 : 8) * 1048576);
    }
    assert(scene.trimEnd < scene.duration); assert(scene.thumbnails.length === 3);
    results.push({ key: scene.key, status: scene.status, frameCount: scene.frameCount, mobileFrameCount: scene.mobileFrameCount, trimStart: scene.trimStart, trimEnd: scene.trimEnd, similarity: scene.analysis.similarity, warning: scene.error });
  }
  checks.push("All four supplied MP4s decoded, auto-trimmed, delogo-filtered and extracted; three ready, mismatched kitchen correctly needs_review");
  property = await api(`/api/admin/properties/${id}`);
  const blocked = await context.request.put(`${base}/api/admin/properties/${id}`, { headers, data: { ...property, status: "published" } }); assert.equal(blocked.status(), 400);
  assert((await blocked.json()).error.includes("Every scene must be ready")); checks.push("Publication blocked while any endpoint needs review");
  const kitchen = view.scenes.find((s) => s.key === "plan-to-kitchen");
  const range = await context.request.get(base + kitchen.videoUrl, { headers: { range: "bytes=0-1023" } }); assert.equal(range.status(), 206); assert.equal((await range.body()).length, 1024);
  assert.equal((await anon.request.get(base + kitchen.videoUrl)).status(), 404);
  const invalidRange = await context.request.get(base + kitchen.videoUrl, { headers: { range: "bytes=999999999-" } }); assert.equal(invalidRange.status(), 416);
  const download = await context.request.get(base + kitchen.videoUrl + "?download=1", { method: "HEAD" }); assert(download.headers()["content-disposition"].includes("attachment")); checks.push("Authenticated MP4 preview/download, byte ranges and invalid range handling");
  await page.goto(`${base}/admin/properties/${id}`, { waitUntil: "networkidle", timeout: 90000 }); await page.getByRole("tab", { name: "Videos", exact: false }).click();
  await page.locator("[data-video-scene]").nth(3).waitFor(); await capture("videos-existing-desktop.png");
  const card = page.locator('[data-video-scene="plan-to-kitchen"]');
  await card.getByAltText("Extracted last frame").waitFor(); await card.getByAltText("Intended end image").waitFor();
  const approvalURL = `${base}/api/admin/properties/${id}/videos/${kitchen.id}`;
  assert.equal((await context.request.post(approvalURL, { headers, data: { action: "approve", expectedRevision: kitchen.revision, confirmMismatch: true, note: "short" } })).status(), 400);
  assert.equal((await context.request.post(approvalURL, { headers, data: { action: "approve", expectedRevision: "stale", confirmMismatch: true, note: "Reviewed mismatched endpoint" } })).status(), 409);
  assert.equal((await context.request.post(approvalURL, { headers: { origin: "https://invalid.example" }, data: { action: "approve", expectedRevision: kitchen.revision, confirmMismatch: true, note: "Reviewed mismatched endpoint" } })).status(), 403);
  await card.getByLabel("QC approval audit note").fill("Reviewed both thumbnails; accepted for this test only.");
  page.once("dialog", (dialog) => dialog.accept());
  const approvedResponse = page.waitForResponse((response) => response.request().method() === "POST" && response.url() === approvalURL);
  await card.getByRole("button", { name: "Approve anyway", exact: true }).click(); assert.equal((await approvedResponse).status(), 200);
  const approved = (await api(`/api/admin/properties/${id}/videos`)).scenes.find((s) => s.id === kitchen.id);
  assert.equal(approved.status, "ready"); assert.equal(approved.analysis.qcApprovals.length, 1);
  assert.equal(approved.analysis.qcApprovals[0].warning, kitchen.error);
  assert.equal((await api(`/api/admin/properties/${id}`)).status, "draft");
  assert.equal((await context.request.post(approvalURL, { headers, data: { action: "approve", expectedRevision: kitchen.revision, confirmMismatch: true, note: "Repeated approval attempt" } })).status(), 409);
  await card.getByText("QC approval history (1)").waitFor(); await capture("d2-qc-approved.png", card);
  checks.push("QC override compares actual/target thumbnails, requires an audit note and current revision, rejects cross-origin/repeated requests, preserves warning and never auto-publishes");
  await card.getByRole("button", { name: "Trim", exact: true }).click();
  await card.getByLabel("Trim end (seconds)").fill("6.8"); await capture("videos-trim-preview.png", card);
  const rebuild = page.waitForResponse((response) => response.request().method() === "POST" && response.url() === `${base}/api/admin/properties/${id}/videos/${kitchen.id}`);
  await card.getByRole("button", { name: "Rebuild with trim" }).click(); assert.equal((await rebuild).status(), 202); view = await settled(id);
  const trimmed = view.scenes.find((s) => s.key === kitchen.key); assert.equal(trimmed.trimEnd, 6.8); assert.equal(trimmed.status, "needs_review", trimmed.error ?? "Trimmed scene did not finish quality review");
  assert.equal(trimmed.analysis.qcApprovals.length, 1); assert.equal(trimmed.analysis.qcApprovals[0].revision, kitchen.revision);
  checks.push("Re-extraction reruns QC and returns to needs_review while retaining the historical approval audit");
  const sourceFrame = path.join(temporary, "source-watermark.png");
  await runTestFfmpeg(["-ss", "6.75", "-i", "assets/videos/plan-to-kitchen.mp4", "-frames:v", "1", sourceFrame]);
  const desktopLast = path.resolve(process.env.STORAGE_DIR || "storage", "properties", property.slug, "sequences", kitchen.key, `frame_${String(trimmed.frameCount).padStart(4, "0")}.webp`);
  // The supplied sparkle is translucent cream, not pure white. This threshold
  // separates its observed 165–179 luma from the local floor's <150 luma.
  const bright = async (file) => { const raw = await sharp(await readFile(file)).extract({ left: 1130, top: 569, width: 62, height: 64 }).removeAlpha().raw().toBuffer(); let count = 0; for (let i = 0; i < raw.length; i += 3) if ((raw[i] + raw[i + 1] + raw[i + 2]) / 3 > 165) count++; return count; };
  const watermarkBefore = await bright(sourceFrame), watermarkAfter = await bright(desktopLast);
  assert(watermarkBefore > 0 && watermarkAfter < watermarkBefore / 2, `Visible sparkle pixels not reduced enough: ${watermarkBefore} → ${watermarkAfter}`);
  checks.push(`Manual trim persisted at 6.8s; quality warning retained for the wrong kitchen; bright sparkle pixels ${watermarkBefore} → ${watermarkAfter}`);
  await card.getByText("trim 0.00–6.80s", { exact: false }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 }); await capture("videos-existing-mobile.png"); assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  const long = await syntheticLongVideo(path.join(temporary, "long"));
  let auxiliary = await createFixture(); const auxImage = await uploadImage(auxiliary.id, long.target);
  auxiliary = await api(`/api/admin/properties/${auxiliary.id}`, "PUT", { ...auxiliary, towerImage: auxImage, planImage: auxImage });
  let auxView = await api(`/api/admin/properties/${auxiliary.id}/videos`); await uploadVideo(auxiliary.id, auxView.scenes[0], long.video, { removeWatermark: false, delogo: { x: 1130, y: 569, w: 62, h: 64 } });
  auxView = await settled(auxiliary.id);
  await api(`/api/admin/properties/${auxiliary.id}/videos/${auxView.scenes[0].id}`, "POST", { action: "extract", trimStart: 0, trimEnd: 14, settings: auxView.scenes[0].settings });
  auxView = await settled(auxiliary.id); const capped = auxView.scenes[0]; assert.equal(capped.status, "ready"); assert(capped.frameCount <= 240 && capped.frameCount >= 235); assert(capped.mobileFrameCount <= 240);
  const cappedManifest = JSON.parse(await readFile(path.resolve(process.env.STORAGE_DIR || "storage", "properties", auxiliary.slug, "sequences", "hero-to-plan", "manifest.json"), "utf8"));
  assert.equal(cappedManifest.desktop.width, 320); assert.equal(cappedManifest.mobile.width, 320); checks.push("14-second trim caps desktop at 240 frames; desktop/mobile never upscale a 320px source");
  await db.scene.update({ where: { id: capped.id }, data: { status: "extracting", leaseOwner: "abandoned-test-worker", leaseExpiresAt: new Date(Date.now() - 1000) } });
  auxView = await settled(auxiliary.id); assert.equal(auxView.scenes[0].status, "ready"); checks.push("Expired extraction lease recovers and rebuilds after simulated crash");
  await db.scene.update({ where: { id: capped.id }, data: { mode: "veo", videoPath: null, operationName: null, attempts: 1, status: "generating", leaseOwner: "abandoned-test-worker", leaseExpiresAt: new Date(Date.now() - 1000) } });
  auxView = await settled(auxiliary.id); assert.equal(auxView.scenes[0].status, "failed"); assert(auxView.scenes[0].error.includes("No automatic paid resubmission")); checks.push("Ambiguous interrupted generation fails safely instead of submitting a duplicate paid operation");
  assert.deepEqual(runtimeErrors, []); passed = true; console.log("videos: PASS", checks);
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  console.error("Video suite failed:", failure); throw error;
} finally {
  await page.close();
  for (const fixture of fixtures) {
    await context.request.delete(`${base}/api/admin/properties/${fixture.id}`, { headers });
    for (const namespace of [fixture.id, fixture.slug]) {
      const root = path.resolve(process.env.STORAGE_DIR || "storage", "properties"), target = path.resolve(root, namespace);
      assert.equal(path.dirname(target), root); assert(namespace !== "aurelia"); await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }
  if (path.dirname(temporary) === os.tmpdir() && path.basename(temporary).startsWith("aurelia-video-tests-")) await rm(temporary, { recursive: true, force: true });
  await db.$disconnect(); await browser.close();
  await writeFile(path.join(output, "videos-report.json"), JSON.stringify({ passed, failure, checks, results, runtimeErrors, liveVeoTested: false }, null, 2));
}
