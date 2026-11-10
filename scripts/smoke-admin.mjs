import dotenv from "dotenv";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { randomUUID, randomInt } from "node:crypto";
import path from "node:path";
import { adminSecurity } from "./smoke-admin-security.mjs";
import { uploadMatchingVideos } from "./smoke-video-fixtures.mjs";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
assert(process.env.ADMIN_PASSWORD, "Set ADMIN_PASSWORD on the test server and in the smoke environment.");
const base = process.env.SMOKE_URL ?? "http://localhost:3000";
const output = path.resolve(process.env.SMOKE_OUTPUT ?? "screenshots/phase-C");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.SMOKE_CHANNEL ? { channel: process.env.SMOKE_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, extraHTTPHeaders: { "x-forwarded-for": `198.18.${randomInt(1, 250)}.${randomInt(1, 250)}` } });
const anon = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const runtimeErrors = [], checks = [], fixtures = [];
page.on("pageerror", (error) => runtimeErrors.push(error.message));
const headers = { origin: base };
const slug = `studio-${randomUUID().slice(0, 8)}`;
const screenshot = async (name, fullPage = true) => {
  await page.locator("img").evaluateAll(async (images) => { images.forEach((image) => { image.loading = "eager"; }); await Promise.all(images.map((image) => image.decode())); });
  await page.screenshot({ path: path.join(output, name), fullPage });
};
async function saved() { await page.locator('.admin-save-state').filter({ hasText: /^Saved$/ }).waitFor({ timeout: 20000 }); }
async function upload(label) {
  const source = { "tower image": "tower-exterior", "floor-plan image": "floor-plan", "living room image": "living-room", "kitchen image": "kitchen" }[label];
  const buffer = await sharp(`assets/stills/${source}.png`).resize(1600, 900).png().toBuffer();
  await page.getByLabel(`Upload ${label}`).setInputFiles({ name: "test-image.png", mimeType: "image/png", buffer });
  const preview = page.getByRole("img", { name: `${label.charAt(0).toUpperCase() + label.slice(1)} preview`, exact: true });
  await preview.waitFor(); await preview.evaluate(async (image) => { image.loading = "eager"; await image.decode(); });
  await saved();
}
const image = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#8c795c" } }).png().toBuffer();
try {
  const anonymous = await anon.newPage();
  await anonymous.goto(base + "/admin"); assert(new URL(anonymous.url()).pathname === "/admin/login");
  await anonymous.screenshot({ path: path.join(output, "admin-login-mobile.png"), fullPage: true });
  assert.equal((await anon.request.get(base + "/api/admin/properties")).status(), 401);
  assert.equal((await anon.request.get(base + "/api/admin/storage")).status(), 401);
  await page.goto(base + "/admin/login", { waitUntil: "networkidle" });
  await screenshot("admin-login-desktop.png");
  await page.getByLabel("Admin password").fill("wrong-password"); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Incorrect password." }).waitFor();
  await page.getByLabel("Admin password").fill(process.env.ADMIN_PASSWORD); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(base + "/admin"); await screenshot("admin-properties-desktop.png");
  const storageResponse = await context.request.get(base + "/api/admin/storage"); assert.equal(storageResponse.status(), 200);
  const storageUsage = await storageResponse.json(); assert(storageUsage.free >= 0); assert(Array.isArray(storageUsage.properties));
  await page.locator("footer").filter({ hasText: "Storage" }).waitFor();
  checks.push("Storage capacity endpoint requires authentication and admin footer shows capacity and property usage");
  const cookie = (await context.cookies()).find((item) => item.name === "aurelia_admin");
  assert(cookie?.httpOnly && cookie.sameSite === "Strict"); checks.push("Protected admin, incorrect password handling, signed httpOnly SameSite=Strict session");
  await page.getByRole("link", { name: "+ Add property" }).click();
  await page.getByLabel("Property name").fill("Studio test residence");
  await page.getByLabel("Property slug").fill(slug);
  await page.getByText("Address available", { exact: false }).waitFor();
  await screenshot("admin-new-property.png");
  await page.getByRole("button", { name: "Create draft" }).click(); await page.waitForURL((url) => /^\/admin\/properties\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"));
  const id = new URL(page.url()).pathname.split("/").at(-1); fixtures.push(id);
  assert.equal((await anon.request.get(`${base}/${slug}`)).status(), 404);
  await page.getByRole("button", { name: "Publish property", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Upload a tower image" }).waitFor();
  checks.push("Draft creation through UI, private draft URL, incomplete publication blocked with validation errors");
  await page.getByLabel("Tagline").fill("A considered address by the water");
  await page.getByLabel("Location").fill("Miami waterfront");
  await page.getByLabel("Hero copy").fill("A new perspective"); await saved(); await screenshot("admin-basics.png");
  await page.route(`**/api/admin/properties/${id}`, async (route) => { if (route.request().method() === "PUT") await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary test failure" }) }); else await route.continue(); });
  await page.getByLabel("Tagline").fill("Unsaved copy stays here");
  await page.locator(".admin-save-state").filter({ hasText: "Not saved" }).waitFor();
  assert.equal(await page.getByLabel("Tagline").inputValue(), "Unsaved copy stays here");
  await page.unroute(`**/api/admin/properties/${id}`);
  await page.getByRole("button", { name: "Retry save", exact: true }).click(); await saved();
  checks.push("A failed autosave preserves edits and retry successfully saves them");
  await page.getByRole("tab", { name: "Images", exact: false }).click();
  await page.getByLabel("Upload tower image").setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await page.getByRole("alert").filter({ hasText: "could not be decoded" }).waitFor();
  await upload("tower image"); await upload("floor-plan image"); await screenshot("admin-images.png");
  let record = await (await context.request.get(`${base}/api/admin/properties/${id}`)).json();
  assert.equal((await anon.request.get(base + record.towerImage)).status(), 404);
  const preview = await context.request.get(base + record.towerImage); assert.equal(preview.status(), 200); assert.equal(preview.headers()["cache-control"], "private, no-store");
  checks.push("Streaming image uploads through UI, fake image rejected, draft media private with authenticated preview");
  await page.getByRole("tab", { name: "Units", exact: false }).click(); await page.getByRole("button", { name: "+ Add unit" }).click();
  await page.getByLabel("Unit name").fill("Residence One"); await page.getByLabel("Price", { exact: true }).fill("From $2M"); await saved(); await screenshot("admin-units.png");
  await page.getByRole("tab", { name: "Rooms", exact: false }).click(); await page.getByRole("button", { name: "+ Add room" }).click();
  await page.getByLabel("Room label").fill("Living room"); await page.getByLabel("Short room description").fill("Warm oak floors overlooking the water"); await saved();
  await upload("living room image");
  await page.getByRole("application").click({ position: { x: 160, y: 90 } }); await saved();
  record = await (await context.request.get(`${base}/api/admin/properties/${id}`)).json(); assert(record.rooms[0].hotspotX > 0 && record.rooms[0].hotspotX < 50);
  await screenshot("admin-rooms-hotspots.png");
  await page.getByRole("button", { name: "+ Add room" }).click();
  await page.getByLabel("Room label").nth(1).fill("Kitchen"); await saved(); await upload("kitchen image");
  await page.getByRole("button", { name: "Move Kitchen up", exact: true }).click(); await saved();
  await page.reload(); await page.getByRole("tab", { name: "Rooms", exact: false }).click(); assert.equal(await page.getByLabel("Room label").first().inputValue(), "Kitchen");
  checks.push("Units and rooms edited, room keys derived, hotspot percentages saved, reorder persisted after reload");
  await page.getByRole("tab", { name: "Amenities", exact: false }).click(); await page.getByRole("button", { name: "+ Add amenity" }).click();
  await page.getByLabel("Amenity title").fill("Private sky lounge"); await page.getByLabel("Amenity description").fill("Evenings above the bay."); await saved(); await screenshot("admin-amenities.png");
  await page.getByRole("tab", { name: "360° Walkthrough", exact: false }).click(); await page.getByText("Step inside, look around.").waitFor(); await screenshot("admin-360-empty.png");
  await page.getByRole("tab", { name: "Videos", exact: false }).click(); await page.getByText("Every move, connected.").waitFor();
  await uploadMatchingVideos(page, context, base, id); await screenshot("admin-videos-ready.png");
  await page.getByRole("tab", { name: "Basics", exact: false }).click(); await page.getByRole("button", { name: "Publish property", exact: true }).click(); await saved();
  const visit = await anon.newPage(); const published = await visit.goto(`${base}/${slug}`, { waitUntil: "networkidle" }); assert.equal(published.status(), 200);
  await visit.locator('[data-scene="hero-to-plan"][data-ready="true"]').waitFor();
  assert.equal(await visit.locator("[data-scene]").count(), 3); assert((await visit.title()).includes("Studio test residence"));
  await visit.screenshot({ path: path.join(output, "new-property-published-mobile.png"), fullPage: false });
  await screenshot("admin-published.png"); checks.push("Uploaded matching MP4s through UI, all scenes extracted and ready, published and visited the new public tour");
  await adminSecurity({ base, context, anon, id, headers, image, checks });
  await page.setViewportSize({ width: 390, height: 844 }); await screenshot("admin-editor-mobile.png");
  assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await page.getByRole("tab", { name: "Rooms", exact: false }).click(); await screenshot("admin-rooms-mobile.png");
  assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await page.getByRole("button", { name: "Unpublish", exact: true }).click(); await saved();
  assert.equal((await anon.request.get(`${base}/${slug}`)).status(), 404);
  assert.equal((await anon.request.get(base + record.towerImage)).status(), 404);
  page.once("dialog", (dialog) => dialog.dismiss()); await page.getByRole("button", { name: "Delete property", exact: true }).click();
  assert.equal((await context.request.get(`${base}/api/admin/properties/${id}`)).status(), 200);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "All properties", exact: false }).click(); await page.waitForURL(base + "/admin");
  await screenshot("admin-list-after-create.png");
  await page.locator(`a[href="/admin/properties/${id}"]`).click();
  page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: "Delete property", exact: true }).click();
  await page.waitForURL(base + "/admin"); assert.equal((await context.request.get(`${base}/api/admin/properties/${id}`)).status(), 404);
  await page.getByRole("button", { name: "Sign out", exact: true }).click(); await page.waitForURL(base + "/admin/login");
  assert.equal((await context.request.get(`${base}/api/admin/properties`)).status(), 401);
  checks.push("Responsive admin has no horizontal overflow, unpublish hides page/media, delete cancellation/confirmation and logout work");
  assert.deepEqual(runtimeErrors, []);
  console.log("admin: PASS", checks);
} finally {
  // Log in for cleanup if the test reached logout. Never write the credential to reports.
  if (fixtures.length) {
    await context.request.post(base + "/api/admin/login", { headers: { ...headers, "x-forwarded-for": `198.19.${randomInt(1, 250)}.${randomInt(1, 250)}` }, data: { password: process.env.ADMIN_PASSWORD } });
    for (const id of fixtures) {
      const response = await context.request.delete(`${base}/api/admin/properties/${id}`, { headers });
      assert([200, 404].includes(response.status()), `Fixture cleanup failed (${response.status()})`);
      for (const namespace of [id, slug]) {
        const target = path.resolve(process.env.STORAGE_DIR || "storage", "properties", namespace);
        assert.equal(path.dirname(target), path.resolve(process.env.STORAGE_DIR || "storage", "properties"));
        assert(namespace !== "aurelia");
        await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      }
    }
  }
  await browser.close();
  await writeFile(path.join(output, "admin-report.json"), JSON.stringify({ checks, runtimeErrors }, null, 2));
}
