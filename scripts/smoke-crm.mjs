import assert from "node:assert/strict";
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import sharp from "sharp";
import { uploadMatchingVideos } from "./smoke-video-fixtures.mjs";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const base = process.env.SMOKE_URL ?? "http://localhost:3000";
const headers = { origin: base };
const output = path.resolve(process.env.SMOKE_CRM_OUTPUT ?? ".artifacts/screenshots/phase-2-3");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const checks = [], developmentIds = [];
const suffix = randomUUID().slice(0, 8);
const developmentName = "Aurelia Building Map";
const slug = `aurelia-map-${suffix}`;
const messages = [];
let developmentId, keep = false;
page.on("pageerror", (error) => messages.push(error.message));
const button = (name) => page.getByRole("button", { name, exact: true });
const tab = (name) => page.getByRole("tab", { name, exact: true });
const canvas = () => page.getByRole("group", { name: "Building map canvas" });
const svg = () => canvas().locator("svg");
const points = () => svg().locator("[data-point]");
const polygons = () => svg().locator("polygon");
const load = { waitUntil: "load" };

async function api(route, method = "GET", data, status = 200) {
  const response = await context.request.fetch(base + route, { method, headers, ...(data === undefined ? {} : { data }) });
  const body = await response.json();
  assert.equal(response.status(), status, JSON.stringify(body));
  return body;
}
async function saved() {
  const status = page.getByRole("status", { name: "Development save status" });
  await status.filter({ hasText: /^Saved$/ }).waitFor();
}
async function map() {
  await tab("Building map").click();
  await canvas().waitFor();
  await page.getByAltText("Building elevation").evaluate((image) => image.decode());
}
async function xy([x, y]) {
  const rect = await svg().boundingBox();
  assert(rect && rect.width > 0 && rect.height > 0);
  return [rect.x + x * rect.width, rect.y + y * rect.height];
}
async function clickPoint(point) { await page.mouse.click(...await xy(point)); }
async function readPoints() {
  return points().evaluateAll((nodes) => nodes.map((node) => ({ x: Number(node.getAttribute("cx")), y: Number(node.getAttribute("cy")) })));
}
function normalized(list) {
  for (const { x, y } of list) assert(x >= 0 && x <= 1 && y >= 0 && y <= 1);
}
function closeTo(list, expected, tolerance = .009) {
  normalized(list);
  assert.equal(list.length, expected.length);
  list.forEach((point, index) => {
    const [x, y] = expected[index];
    assert(Math.abs(point.x - x) < tolerance && Math.abs(point.y - y) < tolerance, JSON.stringify({ point, expected: [x, y] }));
  });
}
async function draw(coords, closing = "click") {
  for (const point of coords) await clickPoint(point);
  if (closing === "click") await clickPoint(coords[0]);
  else await page.keyboard.press("Enter");
  await svg().locator(".selected polygon").waitFor();
}
async function createFromMap(name) {
  await button("Create property from this polygon").click();
  await page.getByLabel("Property name", { exact: true }).fill(name);
  const response = page.waitForResponse((r) => r.url().endsWith(`/developments/${developmentId}/properties`) && r.request().method() === "POST");
  await button("Create property").click();
  const result = await response; assert.equal(result.status(), 201); await page.getByRole("dialog").waitFor({ state: "hidden" });
  return result.json();
}
async function storePolygon() {
  const response = page.waitForResponse((r) => r.url().endsWith("/polygon") && r.request().method() === "PUT");
  await button("Save polygon").click();
  const result = await response; assert.equal(result.status(), 200);
  await page.getByRole("status").filter({ hasText: "Polygon saved." }).waitFor();
  return result.json();
}
async function screenshot(name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = [...document.images].filter((image) => image.getClientRects().length);
    images.forEach((image) => { image.loading = "eager"; });
    await Promise.all(images.map((image) => image.decode()));
    window.scrollTo(0, 0);
  });
  assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), "Workspace must fit the viewport");
  await page.screenshot({ path: path.join(output, name), fullPage: true });
}

try {
  assert(process.env.ADMIN_PASSWORD, "Configure ADMIN_PASSWORD for the smoke tests.");
  await api("/api/admin/login", "POST", { password: process.env.ADMIN_PASSWORD });
  const anon = await browser.newContext();
  assert.equal((await context.request.post(base + "/api/admin/developments", {
    headers: { origin: "https://invalid.example" }, data: { name: "Cross-origin", slug: "cross-origin" },
  })).status(), 403);
  assert.equal((await anon.request.post(base + "/api/admin/developments", { data: { name: "Unauthorized", slug: "unauthorized" } })).status(), 401);
  await page.goto(base + "/admin", load);
  await page.getByRole("heading", { name: "Dashboard" }).waitFor();
  const nav = page.getByRole("navigation", { name: "Admin navigation" });
  for (const item of ["Dashboard", "Developments", "Leads", "Settings"]) await nav.getByRole("link", { name: item, exact: true }).waitFor();
  await nav.getByRole("link", { name: "Leads" }).click(); await page.getByRole("heading", { name: "Leads", exact: true }).waitFor();
  await nav.getByRole("link", { name: "Settings" }).click(); await page.getByRole("heading", { name: "Settings", exact: true }).waitFor();
  await nav.getByRole("link", { name: "Developments" }).click();
  await page.getByRole("link", { name: "New development", exact: true }).click();
  await page.getByLabel("Development name").fill(developmentName);
  assert.equal(await page.getByLabel("Slug", { exact: true }).inputValue(), "aurelia-building-map");
  await page.getByLabel("Slug", { exact: true }).fill("aurelia");
  await page.getByText("That address is already in use.").waitFor();
  await page.getByLabel("Slug", { exact: true }).fill(slug);
  await page.getByText(`Address available · /${slug}`).waitFor();
  await button("Create development").click();
  await page.waitForURL(/\/admin\/developments\/(?!new$)[^/]+$/);
  developmentId = new URL(page.url()).pathname.split("/").at(-1);
  developmentIds.push(developmentId);
  const pathToDevelopment = `/admin/developments/${developmentId}`;
  const apiDevelopment = `/api/admin/developments/${developmentId}`;
  await page.getByRole("heading", { name: "Development details" }).waitFor();
  await page.getByLabel("Location").fill("Miami waterfront");
  await page.getByLabel("Tagline").fill("Aurelia residence placement");
  await page.getByLabel("Description").fill("Three sample residences on the Aurelia building elevation.");
  await saved();
  await button("Publish development").click();
  await page.getByText("Upload a building image before publishing.").waitFor();

  const aurelia = await api("/api/admin/properties/aurelia");
  const elevation = await context.request.get(base + aurelia.towerImage); assert.equal(elevation.status(), 200);
  await page.getByLabel("Upload building image").setInputFiles({ name: "aurelia.webp", mimeType: "image/webp", buffer: await elevation.body() });
  await page.getByAltText("Building image preview").waitFor();
  await saved();
  await page.getByRole("button", { name: "Unpublish", exact: true }).waitFor();
  assert.equal((await anon.request.get(base + "/" + slug)).status(), 404);
  const small = await context.request.get(base + aurelia.planImage);
  const logo = await sharp("app/icon.svg").resize(240, 240).png().toBuffer();
  await page.getByLabel("Upload logo image").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: logo });
  await page.getByAltText("Logo image preview").waitFor(); await saved();
  await tab("Theme").click();
  await page.getByLabel("Motion", { exact: true }).selectOption("editorial");
  await saved();
  await page.reload(load);
  await page.getByLabel("Location").waitFor();
  assert.equal(await page.getByLabel("Location").inputValue(), "Miami waterfront");
  await tab("Theme").click();
  assert.equal(await page.getByLabel("Motion", { exact: true }).inputValue(), "editorial");
  checks.push("CRM navigation, live slug validation, development creation, image and logo uploads, autosaved details and theme, and publish validation");
  await map();

  const upper = [[.413,.28],[.530,.28],[.533,.36],[.413,.36]];
  await draw(upper);
  const upperProperty = await createFromMap("Residence 24");
  closeTo(upperProperty.polygon, upper);
  assert.equal(await polygons().count(), 1);
  const start = await xy(upper[1]), end = await xy([.537,.273]);
  await page.mouse.move(...start); await page.mouse.down(); await page.mouse.move(...end, { steps: 6 }); await page.mouse.up();
  const adjusted = [upper[0], [.537,.273], upper[2], upper[3]];
  closeTo(await readPoints(), adjusted);
  const midpoint = [(adjusted[0][0] + adjusted[1][0]) / 2, (adjusted[0][1] + adjusted[1][1]) / 2];
  await clickPoint(midpoint);
  assert.equal(await points().count(), 5);
  await page.keyboard.press("Delete");
  assert.equal(await points().count(), 4);
  await page.keyboard.press("Control+z");
  assert.equal(await points().count(), 5);
  await page.keyboard.press("Control+y");
  closeTo(await readPoints(), adjusted);
  const savedUpper = await storePolygon();
  await page.reload(load); await map();
  assert.deepEqual(await readPoints(), savedUpper.polygon);
  checks.push("Drew and closed on first point, dragged a vertex, inserted and deleted an edge point, undid and redid by keyboard, saved and reloaded exact coordinates");

  await button("New outline").click();
  for (const point of [[.64,.3],[.75,.42],[.64,.42],[.75,.3]]) await clickPoint(point);
  await clickPoint([.64,.3]);
  await page.getByRole("alert").filter({ hasText: "edges must not cross" }).waitFor();
  assert(await button("Create property from this polygon").isDisabled());
  const bad = await api(`${apiDevelopment}/properties/${savedUpper.id}/polygon`, "PUT", {
    polygon: [{x:.2,y:.2},{x:.4,y:.4},{x:.2,y:.4},{x:.4,y:.2}], updatedAt: savedUpper.updatedAt,
  }, 400);
  assert(JSON.stringify(bad).includes("must not cross"));
  await page.keyboard.press("Escape");
  assert.equal(await points().count(), 0);

  await page.setViewportSize({ width: 900, height: 1120 });
  await svg().scrollIntoViewIfNeeded();
  const middle = [[.411,.424],[.531,.424],[.533,.506],[.411,.506]];
  await draw(middle, "enter");
  const middleProperty = await createFromMap("Residence 16");
  closeTo(middleProperty.polygon, middle);
  const imageBounds = await svg().boundingBox();
  await page.setViewportSize({ width: 1440, height: 1050 });
  assert.notEqual((await svg().boundingBox()).width, imageBounds.width);
  assert.deepEqual(await readPoints(), middleProperty.polygon);
  const svgBounds = await svg().boundingBox(), imageBox = await page.getByAltText("Building elevation").boundingBox();
  assert(Math.abs(svgBounds.width - imageBox.width) <= 1 && Math.abs(svgBounds.height - imageBox.height) <= 1);

  const center = await xy([.52,.50]);
  await page.mouse.move(...center); await page.mouse.wheel(0, -340);
  await page.waitForFunction(() => Number(document.querySelector("[data-scale]")?.getAttribute("data-scale")) > 1);
  const before = await canvas().getAttribute("data-pan-x");
  await canvas().focus(); await page.keyboard.down("Space");
  await page.mouse.move(...center); await page.mouse.down(); await page.mouse.move(center[0] + 65, center[1] + 35, { steps: 5 });
  await page.mouse.up(); await page.keyboard.up("Space");
  assert.notEqual(await canvas().getAttribute("data-pan-x"), before);
  assert.deepEqual(await readPoints(), middleProperty.polygon);
  await page.getByRole("button", { name: "Zoom out" }).click();
  assert.equal(await canvas().getAttribute("data-scale"), "1");
  checks.push("Rejected a crossing at the canvas and API, canceled with Escape, and verified resizing, tablet coordinates, zoom and space-drag panning");

  await button("Add property").click();
  await page.getByLabel("Property name", { exact: true }).fill("Residence 09");
  await button("Create property").click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const lower = [[.409,.568],[.533,.568],[.534,.650],[.408,.650]];
  await draw(lower);
  const lowerProperty = await storePolygon();
  closeTo(lowerProperty.polygon, lower);
  assert.equal(await polygons().count(), 3);
  await button("Clear polygon").click(); assert.equal(await polygons().count(), 2);
  await button("Undo").click(); assert.equal(await polygons().count(), 3);
  await button("Duplicate polygon").click();
  assert(await button("Create property from this polygon").isEnabled());
  assert.equal(await polygons().count(), 4);
  await button("Undo").click(); assert.equal(await polygons().count(), 3);
  await page.getByRole("button", { name: /Residence 09/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await button("Unlink polygon").click();
  await page.getByText(/Polygon unlinked/).waitFor();
  await button("Link existing property").click();
  await page.getByLabel("Property", { exact: true }).selectOption(lowerProperty.id);
  await button("Link property").click();
  await page.getByText("Property saved.", { exact: true }).waitFor();
  assert.equal(await polygons().count(), 3);
  checks.push("Created three properties, duplicated an outline, and unlinked and relinked the same polygon");

  // Reuse the existing tour editor for Phase 4 media; the map only creates the property.
  await page.getByRole("link", { name: "Open Residence 09", exact: true }).click();
  await page.getByRole("heading", { name: "Residence 09", exact: true }).waitFor();
  await page.getByRole("link", { name: "Open tour editor", exact: true }).click();
  await page.waitForURL(base + `/admin/properties/${lowerProperty.id}`);
  const record = await api(`/api/admin/properties/${lowerProperty.id}`);
  const imageUpload = await context.request.post(base + `/api/admin/upload?propertyId=${lowerProperty.id}`, {
    headers, multipart: { file: { name: "floor-plan.webp", mimeType: "image/webp", buffer: await small.body() } },
  });
  assert.equal(imageUpload.status(), 201);
  const { url: still } = await imageUpload.json();
  await api(`/api/admin/properties/${record.id}`, "PUT", { ...record, planImage: still,
    units: [{ id: record.id, name: "Residence 09", beds: 2, baths: 2, sqft: 1400, price: "On request" }],
    rooms: [{ id: randomUUID(), key: "living", label: "Living room", description: "", image: still, hotspotX: 48, hotspotY: 56 }],
  });
  await page.reload(load);
  await page.getByRole("tab", { name: "Videos" }).click();
  await uploadMatchingVideos(page, context, base, record.id);
  const current = await api(`/api/admin/properties/${record.id}`);
  await api(`/api/admin/properties/${record.id}`, "PUT", { ...current, status: "published" });
  assert.equal((await anon.request.get(base + `/${slug}/${lowerProperty.slug}`)).status(), 200);
  const published = await api(`/api/admin/properties/${record.id}`);
  await api(`/api/admin/properties/${record.id}`, "PUT", { ...published, status: "draft" });
  assert.equal((await anon.request.get(base + `/${slug}/${lowerProperty.slug}`)).status(), 404);
  await anon.close();
  await page.goto(base + pathToDevelopment, load);
  await button("Unpublish").click();
  await saved();
  checks.push("Uploaded tour media, published the property created from the map, visited its nested public URL, and unpublished the demo");

  // Confirm deletion on a disposable, independent development.
  const disposable = await api("/api/admin/developments", "POST", { name: "Delete smoke development", slug: `map-delete-${suffix}` }, 201);
  developmentIds.push(disposable.id);
  await page.goto(base + `/admin/developments/${disposable.id}`, load);
  await button("Delete development").click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await button("Delete development").click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete development" }).click();
  await page.waitForURL(base + "/admin/developments");
  checks.push("Confirmed deletion after canceling the first attempt");

  for (const variant of [{ name: "desktop", width: 1440, height: 1050 }, { name: "tablet", width: 900, height: 1120 }]) {
    await page.setViewportSize(variant);
    await page.goto(base + "/admin", load);
    await page.getByRole("heading", { name: "Dashboard" }).waitFor();
    await screenshot(`dashboard-${variant.name}.png`);
    await page.goto(base + pathToDevelopment, load);
    await page.getByRole("heading", { name: "Development details" }).waitFor();
    await screenshot(`development-${variant.name}.png`);
    await map();
    assert.equal(await polygons().count(), 3);
    await screenshot(`polygon-editor-${variant.name}.png`);
  }
  assert.deepEqual(messages, []);
  keep = process.env.SMOKE_KEEP_MAP_DEMO === "1";
  if (keep) console.log(`Saved three Aurelia demo properties in /admin/developments/${developmentId}`);
  console.log("CRM: PASS", checks);
} finally {
  await writeFile(path.join(output, "crm-report.json"), JSON.stringify({ developmentId, slug, kept: keep, checks, messages }, null, 2));
  for (const id of developmentIds) {
    if (keep && id === developmentId) continue;
    const removal = await context.request.delete(base + `/api/admin/developments/${id}`, { headers });
    assert([200, 404].includes(removal.status()), "Unable to clean up development fixture");
    if (id === developmentId) {
      const root = path.resolve(process.env.STORAGE_DIR || "storage");
      assert(/^aurelia-map-[a-f0-9]{8}$/.test(slug));
      for (const parent of [path.join(root, "originals"), path.join(root, "cache", "frames")]) {
        const target = path.resolve(parent, slug);
        assert.equal(path.dirname(target), parent);
        await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      }
    }
  }
  await browser.close();
}
