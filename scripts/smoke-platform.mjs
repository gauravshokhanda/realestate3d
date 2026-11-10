import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.env.SMOKE_URL ?? "http://localhost:3000";
const database = process.env.DATABASE_URL || "file:./data/app.db";
const db = new PrismaClient({ datasourceUrl: database.startsWith("file:") ? "file:" + path.resolve(database.slice(5)).replaceAll("\\", "/") : database });
const storageRoot = path.resolve(process.env.STORAGE_DIR || "./storage");
const output = path.resolve(process.env.SMOKE_OUTPUT ?? "screenshots/phase-C");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.SMOKE_CHANNEL ? { channel: process.env.SMOKE_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const page = await context.newPage();
const runtimeErrors = [];
page.on("pageerror", (error) => runtimeErrors.push(error.message));
const fixtures = [];
const checks = [];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function createFixture(roomCount) {
  const slug = `phase-a-${roomCount}-${randomUUID()}`;
  const prefix = `properties/${slug}`;
  const directory = path.join(storageRoot, "properties", slug);
  fixtures.push({ slug, directory });
  const frame = await readFile(path.join(storageRoot, "properties/aurelia/sequences/hero-to-plan/frame_0001.webp"));
  const scenes = ["hero-to-plan", ...Array.from({ length: roomCount }, (_, index) => `plan-to-room-${index + 1}`)];
  for (const key of scenes) {
    const folder = path.join(directory, "sequences", key);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "frame_0001.webp"), frame);
    await writeFile(path.join(folder, "manifest.json"), JSON.stringify({ version: 1, pad: 4, ext: "webp", scrollLength: 120, trimStart: 0, trimEnd: null, desktop: { frameCount: 1, width: 1280, height: 720 } }));
  }
  const property = await db.property.create({ data: {
    slug, name: `Foundation ${roomCount}`, status: "draft", heroCopy: `A new address for ${roomCount}`, tagline: "Database fixture",
    towerImage: "properties/aurelia/images/tower-exterior.webp", planImage: "properties/aurelia/images/floor-plan.webp", accentColor: "#AACCEE",
    units: { create: { name: "Only Residence", beds: 1, baths: 1, sqft: 900, price: "From $900K" } },
    rooms: { create: Array.from({ length: roomCount }, (_, index) => ({ key: `room-${index + 1}`, label: `Custom Room ${index + 1}`, image: `${prefix}/images/room-${index + 1}.webp`, hotspotX: 20 + index * 5, hotspotY: 40, order: index })) },
    scenes: { create: scenes.map((key) => ({ key, fromImage: "properties/aurelia/images/floor-plan.webp", toImage: key === "hero-to-plan" ? "properties/aurelia/images/floor-plan.webp" : `${prefix}/images/${key.slice(8)}.webp`, prompt: "Test fixture only; no generation", mode: "manual", status: "ready", progress: 100, frameCount: 1 })) },
  } });
  return property;
}

try {
  const index = await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(index.status(), 200);
  await page.getByRole("link", { name: "Explore Aurelia residences", exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, "index-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, "index-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  const missing = await page.goto(base + "/does-not-exist", { waitUntil: "networkidle" });
  assert.equal(missing.status(), 404);
  await page.getByRole("heading", { name: "A different perspective awaits." }).waitFor();
  await page.screenshot({ path: path.join(output, "not-found.png"), fullPage: true });
  checks.push("Published-property index and styled 404");

  const media = base + "/media/properties/aurelia/sequences/hero-to-plan/frame_0001.webp";
  const response = await fetch(media);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert(response.headers.get("cache-control").includes("public"));
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await fetch(media, { headers: { "if-none-match": response.headers.get("etag") } })).status, 304);
  const head = await fetch(media, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.equal(digest(new Uint8Array(await response.arrayBuffer())), digest(await readFile("public/sequences/hero-to-plan/frame_0001.webp")));
  for (const url of ["/media/%252e%252e/package.json", "/media/properties/aurelia/%2e%2e%5cpackage.json", "/media/properties/aurelia/images/missing.webp", "/media/.env"]) assert.equal((await fetch(base + url)).status, 404);
  checks.push("Media bytes preserved, MIME, caching, ETag 304, HEAD, missing/path-traversal rejection");

  for (const count of [1, 8]) {
    const fixture = await createFixture(count);
    assert.equal((await fetch(`${base}/${fixture.slug}`)).status, 404);
    assert.equal((await fetch(`${base}/media/properties/${fixture.slug}/sequences/hero-to-plan/frame_0001.webp`)).status, 404);
    const hiddenIndex = await (await fetch(base)).text();
    assert(!hiddenIndex.includes(fixture.slug));
    await db.property.update({ where: { id: fixture.id }, data: { status: "published" } });
    const rendered = await page.goto(`${base}/${fixture.slug}`, { waitUntil: "networkidle" });
    assert.equal(rendered.status(), 200);
    assert.equal(await page.locator("[data-scene]").count(), count + 1);
    assert.equal(await page.getByRole("tab").count(), 1);
    assert.equal(await page.getByRole("heading", { name: /^Custom Room/ }).count(), count);
    assert((await page.title()).includes(fixture.name));
    assert.equal(await page.locator('input[name="propertySlug"]').inputValue(), fixture.slug);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    assert(canonical.endsWith("/" + fixture.slug));
    assert((await page.locator('meta[property="og:image"]').first().getAttribute("content")).includes(`/${fixture.slug}/og`));
    await page.screenshot({ path: path.join(output, `db-${count}-rooms.png`), fullPage: true });
    const unit = await db.unit.findFirst({ where: { propertyId: fixture.id } });
    const wrongProperty = await fetch(base + "/api/lead", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `198.51.100.${200 + count}` }, body: JSON.stringify({ name: "Fixture check", email: "test@example.invalid", phone: "", message: "", propertySlug: "aurelia", unit: unit.id }) });
    assert.equal(wrongProperty.status, 400); // Must reject before delivery, even with Resend configured.
    await db.property.update({ where: { id: fixture.id }, data: { status: "processing" } });
    assert.equal((await fetch(`${base}/${fixture.slug}`)).status, 404);
    checks.push(`${count} DB-driven rooms, dynamic metadata, draft/processing hidden, publish without rebuild, cross-property lead rejection`);
  }
  const aurelia = await db.property.findUnique({ where: { slug: "aurelia" }, include: { scenes: true } });
  let verifiedFrames = 0;
  for (const scene of aurelia.scenes) for (const suffix of ["", "-mobile"]) {
    const original = path.resolve("public/sequences", scene.key + suffix);
    const migrated = path.join(storageRoot, "properties/aurelia/sequences", scene.key + suffix);
    const frames = (await readdir(original)).filter((name) => /^frame_\d+\.webp$/.test(name));
    for (const name of frames) {
      assert.equal(digest(await readFile(path.join(original, name))), digest(await readFile(path.join(migrated, name))));
      verifiedFrames++;
    }
  }
  checks.push(`SHA-256 verified all ${verifiedFrames} migrated frames against original assets`);
  assert.deepEqual(runtimeErrors, []);
  console.log("platform: PASS", checks);
} finally {
  await context.close();
  await browser.close();
  for (const fixture of fixtures) {
    await db.property.deleteMany({ where: { slug: fixture.slug } });
    assert.equal(path.dirname(fixture.directory), path.join(storageRoot, "properties"));
    assert(path.basename(fixture.directory).startsWith("phase-a-"));
    await rm(fixture.directory, { recursive: true, force: true });
  }
  await db.$disconnect();
  await writeFile(path.join(output, "platform-report.json"), JSON.stringify({ checks, runtimeErrors }, null, 2));
}
