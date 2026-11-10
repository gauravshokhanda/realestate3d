import dotenv from "dotenv";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createTestPanoramas } from "./make-test-panoramas.mjs";
dotenv.config({ path: [".env.local", ".env"], quiet: true });
const base = process.env.SMOKE_URL ?? "http://localhost:3000", headers = { origin: base };
const output = path.resolve(process.env.SMOKE_OUTPUT ?? "screenshots/phase-E"); await mkdir(output, { recursive: true });
const url = process.env.DATABASE_URL || "file:./data/app.db";
const db = new PrismaClient({ datasourceUrl: url.startsWith("file:") ? "file:" + path.resolve(url.slice(5)).replaceAll("\\", "/") : url });
const browser = await chromium.launch({ headless: true, ...(process.env.SMOKE_CHANNEL ? { channel: process.env.SMOKE_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage(); page.setDefaultTimeout(60000);
const anonymous = await browser.newContext();
const temporary = await mkdtemp(path.join(os.tmpdir(), "aurelia-pano-tests-"));
const fixtures = [], checks = [], errors = [], consoleErrors = [], resources = [];
let passed = false, failure = null;
page.on("pageerror", (error) => errors.push(error.message)); page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
async function api(route, method = "GET", data, status = 200) {
  const response = await context.request.fetch(base + route, { method, headers, ...(data === undefined ? {} : { data }) });
  const body = await response.json(); assert.equal(response.status(), status, JSON.stringify(body)); return body;
}
async function capture(name) { await page.screenshot({ path: path.join(output, name), fullPage: false }); }
async function saved() { await page.getByRole("status", { name: "Viewpoint save status" }).filter({ hasText: /^Saved$/ }).waitFor(); }
async function openPreview() { await page.getByRole("button", { name: "Preview / place arrows", exact: true }).click(); await page.locator('[data-pano-ready="true"]').waitFor({ timeout: 90000 }); }
async function placeArrow(target) {
  await openPreview(); await page.getByLabel("Arrow destination").selectOption(target);
  const box = await page.locator(".pano-stage").boundingBox(); await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.55);
  await page.getByText(/^Yaw .*pitch .*radians$/).waitFor();
  await capture("admin-panorama-author.png");
  await page.getByRole("button", { name: "Save arrow position", exact: true }).click(); await saved();
}
function instrumentGL() {
  const owners = new WeakMap(), all = [], urls = new Set(), stats = { contexts: 0, lostContexts: 0, texturesCreated: 0, liveTextures: 0, liveObjectUrls: 0 };
  window.__panoGL = stats;
  const makeUrl = URL.createObjectURL, revokeUrl = URL.revokeObjectURL;
  URL.createObjectURL = function (blob) { const url = makeUrl.call(this, blob); urls.add(url); stats.liveObjectUrls = urls.size; return url; };
  URL.revokeObjectURL = function (url) { urls.delete(url); stats.liveObjectUrls = urls.size; return revokeUrl.call(this, url); };
  const count = () => { stats.liveTextures = all.reduce((n, set) => n + set.size, 0); };
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...args) {
    const result = original.apply(this, args);
    if (/^webgl/.test(args[0]) && result && !owners.has(result)) { const textures = new Set(); owners.set(result, textures); all.push(textures); stats.contexts++; this.addEventListener("webglcontextlost", () => { textures.clear(); count(); stats.lostContexts++; }); }
    return result;
  };
  for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
    const create = type.prototype.createTexture, remove = type.prototype.deleteTexture;
    type.prototype.createTexture = function (...args) { const texture = create.apply(this, args); if (texture) { stats.texturesCreated++; owners.get(this)?.add(texture); count(); } return texture; };
    type.prototype.deleteTexture = function (texture) { owners.get(this)?.delete(texture); count(); return remove.call(this, texture); };
  }
}
try {
  await api("/api/admin/login", "POST", { password: process.env.ADMIN_PASSWORD });
  const source = await db.property.findUniqueOrThrow({ where: { slug: "aurelia" }, include: { units: true, rooms: { orderBy: { order: "asc" }, take: 2 }, scenes: true } });
  const slug = `pano-${randomUUID().slice(0, 8)}`;
  const property = await db.property.create({ data: { slug, name: "360° acceptance property", status: "draft", towerImage: source.towerImage, planImage: source.planImage, heroCopy: source.heroCopy, amenities: source.amenities ?? [], presentation: source.presentation ?? {}, units: { create: source.units.map(({ name, beds, baths, sqft, price }) => ({ name, beds, baths, sqft, price })) }, rooms: { create: source.rooms.map(({ key, label, description, image, hotspotX, hotspotY, order }) => ({ key, label, description, image, hotspotX, hotspotY, order })) }, scenes: { create: source.scenes.filter((scene) => scene.key === "hero-to-plan" || source.rooms.some((room) => room.image === scene.toImage)).map((scene) => ({ key: scene.key, fromImage: scene.fromImage, toImage: scene.toImage, prompt: scene.prompt, mode: "manual", status: "ready", progress: 100, frameCount: scene.frameCount, mobileFrameCount: scene.mobileFrameCount, sequencePath: scene.sequencePath ?? `properties/aurelia/sequences/${scene.key}` })) } }, include: { rooms: { orderBy: { order: "asc" } } } });
  fixtures.push({ id: property.id, slug });
  const route = `/api/admin/properties/${property.id}/panoramas`;
  assert.equal((await anonymous.request.get(base + route)).status(), 401);
  await page.goto(`${base}/admin/properties/${property.id}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByRole("tab", { name: "360° Walkthrough", exact: false }).click(); await saved();
  const files = await createTestPanoramas(temporary);
  for (const [index, room] of property.rooms.entries()) {
    await page.getByLabel("Room for new viewpoints").selectOption(room.id);
    await page.getByLabel("Upload new panorama", { exact: true }).setInputFiles(files[index]);
    await page.waitForFunction((name) => [...document.querySelectorAll(".admin-pano-details input")].some((input) => input.value === name), `${room.label} 1`);
    await page.getByLabel("Viewpoint name", { exact: true }).waitFor();
    await page.getByLabel("Viewpoint name", { exact: true }).fill(index ? "Kitchen test viewpoint" : "Living test viewpoint");
    await page.getByLabel("Plan X (%)", { exact: true }).fill(index ? "70" : "30");
    await page.getByLabel("Plan Y (%)", { exact: true }).fill(index ? "40" : "60"); await saved();
  }
  let snapshot = await api(route); assert.equal(snapshot.nodes.length, 2);
  const a = snapshot.nodes.find((node) => node.roomId === property.rooms[0].id), b = snapshot.nodes.find((node) => node.roomId === property.rooms[1].id);
  assert.equal((await anonymous.request.get(base + a.image)).status(), 404);
  const uploaded = await context.request.get(base + a.image); assert.equal(uploaded.status(), 200); assert.equal((await sharp(await uploaded.body()).metadata()).width, 4096);
  const mobileImage = a.image.replace(/\.webp$/, "-mobile.webp"); assert.equal((await sharp(await (await context.request.get(base + mobileImage)).body()).metadata()).width, 2048);
  const small = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#273b48" } }).png().toBuffer();
  const warning = await context.request.post(`${base}/api/admin/upload?propertyId=${property.id}&kind=panorama`, { headers, multipart: { file: { name: "flat.jpg", mimeType: "image/jpeg", buffer: small } } });
  assert.equal(warning.status(), 201); assert.equal((await warning.json()).warnings.length, 2);
  const fake = await context.request.post(`${base}/api/admin/upload?propertyId=${property.id}&kind=panorama`, { headers, multipart: { file: { name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not an image") } } }); assert.equal(fake.status(), 400);
  checks.push("Admin uploads two decoded 4096x2048 charts, creates 2048px mobile copies, warns on ratio/width and rejects fake images; draft media stays private");
  await page.getByRole("button", { name: /Living test viewpoint/ }).click();
  const plan = page.getByRole("button", { name: "Place Living test viewpoint on floor plan", exact: true }); const planBox = await plan.boundingBox();
  await plan.click({ position: { x: planBox.width * 0.3, y: planBox.height * 0.6 } }); await saved();
  await openPreview(); const stage = await page.locator(".pano-stage").boundingBox(); await page.mouse.move(stage.width * 0.5, stage.height * 0.5); await page.mouse.down(); await page.mouse.move(stage.width * 0.35, stage.height * 0.5, { steps: 15 }); await page.mouse.up();
  await page.getByRole("button", { name: "Use current view as start direction" }).click(); await saved();
  snapshot = await api(route); assert(Math.abs(snapshot.nodes.find((node) => node.id === a.id).startYaw) > 0.01);
  await placeArrow(b.id); await page.getByRole("button", { name: /Kitchen test viewpoint/ }).click(); await placeArrow(a.id);
  snapshot = await api(route); assert.equal(snapshot.nodes.find((node) => node.id === a.id).links[0].toNodeId, b.id); assert.equal(snapshot.nodes.find((node) => node.id === b.id).links[0].toNodeId, a.id);
  await capture("admin-panorama-links.png"); checks.push("Admin floor-plan placement, drag-to-set starting yaw and exact yaw/pitch arrows save in both directions");
  const stale = structuredClone(snapshot), changed = structuredClone(snapshot); changed.nodes.find((node) => node.id === a.id).name += " updated"; await api(route, "PUT", changed); await api(route, "PUT", stale, 409);
  snapshot = await api(route);
  const foreign = await db.property.create({ data: { slug: `pano-foreign-${randomUUID().slice(0, 8)}`, name: "Foreign fixture", rooms: { create: { key: "other", label: "Other room", hotspotX: 50, hotspotY: 50, nodes: { create: { name: "Foreign node", image: "unused.webp" } } } } }, include: { rooms: { include: { nodes: true } } } }); fixtures.push({ id: foreign.id, slug: foreign.slug });
  for (const mutation of [(value) => { value.nodes[0].roomId = foreign.rooms[0].id; }, (value) => { value.nodes[0].id = foreign.rooms[0].nodes[0].id; value.nodes[0].links = []; value.nodes[1].links = []; }, (value) => { value.nodes[0].links[0].toNodeId = foreign.rooms[0].nodes[0].id; }, (value) => { value.nodes[0].image = value.nodes[0].image.replace(property.id, foreign.id); }, (value) => { value.nodes[0].planX = 101; }]) { const invalid = structuredClone(snapshot); mutation(invalid); await api(route, "PUT", invalid, 400); }
  const csrf = await context.request.put(base + route, { headers: { origin: "https://wrong.example" }, data: snapshot }); assert.equal(csrf.status(), 403);
  checks.push("Panorama API rejects stale revisions, foreign room/node/image/link IDs, invalid coordinates and cross-origin writes");
  const temporaryNode = { ...snapshot.nodes.find((node) => node.id === a.id), id: randomUUID(), name: "Temporary viewpoint", links: [] };
  const withTemporary = structuredClone(snapshot); withTemporary.nodes.push(temporaryNode); withTemporary.nodes[0].links.push({ toNodeId: temporaryNode.id, label: "Temporary", yaw: 0, pitch: 0 }); await api(route, "PUT", withTemporary);
  await page.getByRole("button", { name: "Reload viewpoints", exact: true }).click(); await saved();
  await page.getByRole("button", { name: /^Temporary viewpoint/ }).click();
  page.once("dialog", (dialog) => dialog.dismiss()); await page.getByRole("button", { name: "Delete viewpoint", exact: true }).click(); assert.equal((await api(route)).nodes.length, 3);
  page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: "Delete viewpoint", exact: true }).click(); await saved(); snapshot = await api(route); assert.equal(snapshot.nodes.length, 2); assert(snapshot.nodes.every((node) => node.links.every((link) => link.toNodeId !== temporaryNode.id)));
  await page.getByRole("button", { name: /Kitchen test viewpoint/ }).click(); await page.setViewportSize({ width: 390, height: 844 }); await capture("admin-panorama-mobile.png"); assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)); await page.setViewportSize({ width: 1440, height: 900 });
  checks.push("Viewpoint delete cancellation preserves the graph; confirmed deletion removes incoming arrows; mobile admin has no horizontal overflow");
  await page.getByRole("button", { name: "Publish property", exact: true }).click(); await page.getByRole("button", { name: "Unpublish", exact: true }).waitFor(); await page.locator(".admin-save-state").filter({ hasText: /^Saved$/ }).waitFor(); assert.equal((await db.property.findUniqueOrThrow({ where: { id: property.id } })).status, "published");
  await page.goto(`${base}/${slug}`, { waitUntil: "networkidle", timeout: 90000 });
  const roomKey = property.rooms[0].key, roomSelector = `#room-${roomKey}`;
  await page.locator('[data-scene="hero-to-plan"][data-ready="true"]').waitFor({ timeout: 90000 });
  await page.locator(roomSelector).scrollIntoViewIfNeeded(); const scene = page.locator(`${roomSelector} [data-scene]`); await scene.locator('section[aria-busy="false"]').waitFor({ timeout: 90000 });
  assert.equal(await scene.getByRole("button", { name: /Explore in 360/ }).count(), 0);
  await scene.evaluate((element) => window.scrollTo({ top: element.getBoundingClientRect().top + scrollY + Number(element.dataset.scrollLength) - 1, behavior: "instant" }));
  const launch = scene.getByRole("button", { name: /Explore in 360/ }); await launch.waitFor(); checks.push("Public 360 button is absent before landing and appears after the room's final frame is painted");
  await context.addInitScript(instrumentGL); // Also initialize the already loaded document.
  await page.evaluate(instrumentGL);
  await launch.focus(); const beforeScroll = await page.evaluate(() => scrollY); await page.keyboard.press("Enter"); await page.locator('[data-pano-ready="true"]').waitFor({ timeout: 90000 });
  const initial = await page.locator(".pano-experience").getAttribute("data-current-node"); assert.equal(initial, a.id);
  await capture("desktop-360-viewer.png");
  if (await page.evaluate(() => document.fullscreenEnabled)) { await page.getByRole("button", { name: "Fullscreen", exact: true }).click(); await page.waitForFunction(() => document.fullscreenElement?.classList.contains("pano-dialog")); await page.getByRole("button", { name: "Fullscreen", exact: true }).click(); await page.waitForFunction(() => !document.fullscreenElement); }
  const coneBefore = await page.locator(".pano-direction").getAttribute("data-yaw"); const pano = await page.locator(".pano-stage").boundingBox(); await page.mouse.move(pano.width * 0.5, pano.height * 0.5); await page.mouse.down(); await page.mouse.move(pano.width * 0.4, pano.height * 0.5, { steps: 12 }); await page.mouse.up();
  await page.waitForFunction((yaw) => document.querySelector(".pano-direction")?.dataset.yaw !== yaw, coneBefore);
  await page.getByRole("button", { name: "Walk to Kitchen test viewpoint", exact: true }).click(); await page.locator(`.pano-experience[data-current-node="${b.id}"]`).waitFor();
  assert.equal(await page.getByRole("button", { name: "Go to Kitchen test viewpoint", exact: true }).getAttribute("aria-current"), "location");
  const currentA = snapshot.nodes.find((node) => node.id === a.id).name; await page.getByRole("button", { name: `Go to ${currentA}`, exact: true }).click(); await page.locator(`.pano-experience[data-current-node="${a.id}"]`).waitFor();
  for (let i = 0; i < 12; i++) { await page.keyboard.press("Tab"); assert(await page.getByRole("dialog", { name: "360° walkthrough" }).evaluate((element) => element.contains(document.activeElement))); }
  await page.keyboard.press("Escape"); await page.getByRole("dialog").waitFor({ state: "detached" }); assert(await launch.evaluate((element) => element === document.activeElement)); assert(Math.abs(await page.evaluate(() => scrollY) - beforeScroll) < 3);
  await page.waitForFunction(() => window.__panoGL.liveTextures === 0); resources.push({ device: "desktop", ...await page.evaluate(() => window.__panoGL) });
  await launch.click(); await page.locator('[data-pano-ready="true"]').waitFor(); await page.getByRole("button", { name: "Back to scroll tour", exact: true }).click(); await page.waitForFunction(() => window.__panoGL.liveTextures === 0);
  await launch.click(); await page.locator('[data-pano-ready="true"]').waitFor(); await page.getByRole("button", { name: "Walk to Kitchen test viewpoint", exact: true }).click(); await page.keyboard.press("Escape"); await page.waitForFunction(() => window.__panoGL.liveTextures === 0); await page.waitForTimeout(800);
  let releaseHeld; const released = new Promise((resolve) => { releaseHeld = resolve; });
  const hold = async (route) => { await released; await route.continue().catch(() => {}); };
  await page.route("**/panoramas/*.webp", hold);
  try { const held = page.waitForRequest((request) => /\/panoramas\/.*\.webp$/.test(request.url()), { timeout: 15000 }); await launch.click(); await held; await page.keyboard.press("Escape"); }
  finally { releaseHeld(); await page.unroute("**/panoramas/*.webp", hold); }
  await page.waitForFunction(() => window.__panoGL.liveTextures === 0 && window.__panoGL.liveObjectUrls === 0); resources.push({ device: "desktop-after-reopen-transition-and-pending-load-close", ...await page.evaluate(() => window.__panoGL) });
  checks.push("Desktop drag updates heading cone; walking arrows and cross-room minimap work; focus stays trapped and returns with unchanged scroll; close/reopen releases tracked GPU textures");
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" }); await mobile.addInitScript(instrumentGL);
  const phone = await mobile.newPage(), panoramaRequests = []; phone.on("pageerror", (error) => errors.push(error.message)); phone.on("request", (request) => { if (/\/panoramas\/.*\.webp/.test(request.url())) panoramaRequests.push(request.url()); });
  await phone.goto(`${base}/${slug}`, { waitUntil: "networkidle" }); await phone.locator(roomSelector).getByRole("button", { name: /Explore in 360/ }).click(); await phone.locator('[data-pano-ready="true"]').waitFor({ timeout: 90000 });
  const phoneYaw = await phone.locator(".pano-direction").getAttribute("data-yaw"), touch = await mobile.newCDPSession(phone);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 260, y: 380 }] });
  for (let x = 252; x >= 180; x -= 8) { await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: 380 }] }); await phone.waitForTimeout(16); }
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await phone.waitForFunction((yaw) => document.querySelector(".pano-direction")?.dataset.yaw !== yaw, phoneYaw);
  await phone.screenshot({ path: path.join(output, "mobile-360-viewer.png") });
  assert(panoramaRequests.length > 0 && panoramaRequests.every((request) => request.endsWith("-mobile.webp")), JSON.stringify(panoramaRequests));
  assert(!await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await phone.getByRole("button", { name: "Go to Kitchen test viewpoint", exact: true }).tap(); await phone.locator(`.pano-experience[data-current-node="${b.id}"]`).waitFor();
  await phone.getByRole("button", { name: "Close 360° walkthrough", exact: true }).tap(); await phone.waitForFunction(() => window.__panoGL.liveTextures === 0 && window.__panoGL.liveObjectUrls === 0); resources.push({ device: "mobile", ...await phone.evaluate(() => window.__panoGL) }); await mobile.close();
  await page.goto(`${base}/aurelia`, { waitUntil: "networkidle" }); assert.equal(await page.getByRole("button", { name: /Explore in 360/ }).count(), 0);
  assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
  checks.push("Mobile uses only 2048px panorama variants, minimap tap works, reduced-motion entry works, and Aurelia without panoramas keeps its existing UI");
  passed = true; console.log("panoramas: PASS", checks);
} catch (error) { failure = error instanceof Error ? error.message : String(error); resources.push({ device: "failure-state", ...await page.evaluate(() => window.__panoGL ?? {}).catch(() => ({})) }); await page.screenshot({ path: path.join(output, "panorama-failure.png") }).catch(() => {}); console.error("Panorama suite failed:", failure); throw error; }
finally {
  await page.close();
  for (const fixture of fixtures) {
    await context.request.delete(`${base}/api/admin/properties/${fixture.id}`, { headers });
    for (const namespace of [fixture.id, fixture.slug]) { const root = path.resolve(process.env.STORAGE_DIR || "storage", "properties"), target = path.resolve(root, namespace); assert.equal(path.dirname(target), root); assert(namespace !== "aurelia"); await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
  }
  if (path.dirname(temporary) === os.tmpdir() && path.basename(temporary).startsWith("aurelia-pano-tests-")) await rm(temporary, { recursive: true, force: true });
  await db.$disconnect(); await browser.close();
  await writeFile(path.join(output, "panoramas-report.json"), JSON.stringify({ passed, failure, checks, errors, consoleErrors, resources, physicalGyroscopeTested: false }, null, 2));
}
