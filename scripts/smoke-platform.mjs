import dotenv from "dotenv";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const base = process.env.SMOKE_URL ?? "http://localhost:3000";
const database = process.env.DATABASE_URL || "file:./data/app.db";
const db = new PrismaClient({ datasourceUrl: database.startsWith("file:") ? "file:" + path.resolve(database.slice(5)).replaceAll("\\", "/") : database });
const storageRoot = path.resolve(process.env.STORAGE_DIR || "./storage");
const output = path.resolve(process.env.SMOKE_OUTPUT ?? ".artifacts/screenshots/phase-C");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const page = await context.newPage();
const runtimeErrors = [];
page.on("pageerror", (error) => runtimeErrors.push(error.message));
const fixtures = [];
const checks = [];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const aurelia = await db.property.findFirstOrThrow({ where: { slug: "residence-a", development: { slug: "aurelia" } }, include: { development: true, scenes: true } });
const heroFrame = `${aurelia.scenes.find((scene) => scene.key === "hero-to-plan").sequencePath}/frame_0001.webp`;

async function createFixture(roomCount) {
  const slug = `phase-a-${roomCount}-${randomUUID()}`;
  const prefix = `cache/frames/${slug}/residence-a`;
  const directory = path.join(storageRoot, "cache", "frames", slug);
  fixtures.push({ slug, directory });
  const frame = await readFile(path.join(storageRoot, heroFrame));
  const scenes = ["hero-to-plan", ...Array.from({ length: roomCount }, (_, index) => `plan-to-room-${index + 1}`)];
  for (const key of scenes) {
    const folder = path.join(storageRoot, prefix, key);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "frame_0001.webp"), frame);
    await writeFile(path.join(folder, "manifest.json"), JSON.stringify({ version: 1, pad: 4, ext: "webp", scrollLength: 120, trimStart: 0, trimEnd: null, desktop: { frameCount: 1, width: 1280, height: 720 } }));
  }
  const name = `Foundation ${roomCount}`;
  const development = await db.development.create({ data: { slug, name, buildingImage: aurelia.development.buildingImage, properties: { create: {
    slug: "residence-a", name, heroCopy: `A new address for ${roomCount}`, planImage: aurelia.planImage, accentColor: "#AACCEE",
    beds: 1, baths: 1, sqft: 900, price: "From $900K",
    rooms: { create: Array.from({ length: roomCount }, (_, index) => ({ key: `room-${index + 1}`, label: `Custom Room ${index + 1}`, image: aurelia.planImage, hotspotX: 20 + index * 5, hotspotY: 40, order: index })) },
    scenes: { create: scenes.map((key) => ({ key, fromImage: aurelia.development.buildingImage, toImage: aurelia.planImage, prompt: "Test fixture only; no generation", mode: "manual", status: "ready", progress: 100, frameCount: 1, sequencePath: `${prefix}/${key}` })) },
  } } }, include: { properties: true } });
  return { id: development.properties[0].id, developmentId: development.id, slug, name };
}

try {
  const index = await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(index.status(), 200);
  await page.getByRole("link", { name: "Explore Aurelia residences", exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, "index-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, "index-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  const nested = await page.goto(base + "/aurelia/residence-a", { waitUntil: "networkidle" });
  assert.equal(nested.status(), 200);
  await page.locator("main").getByRole("heading", { level: 1 }).waitFor();
  await page.screenshot({ path: path.join(output, "aurelia-residence-a.png") });
  const missing = await page.goto(base + "/does-not-exist", { waitUntil: "networkidle" });
  assert.equal(missing.status(), 404);
  await page.getByRole("heading", { name: "A different perspective awaits." }).waitFor();
  await page.screenshot({ path: path.join(output, "not-found.png"), fullPage: true });
  checks.push("Published-property index and styled 404");

  const media = base + "/media/" + heroFrame;
  const response = await fetch(media);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert(response.headers.get("cache-control").includes("public"));
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await fetch(media, { headers: { "if-none-match": response.headers.get("etag") } })).status, 304);
  const head = await fetch(media, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.equal(digest(new Uint8Array(await response.arrayBuffer())), digest(await readFile(path.join(storageRoot, heroFrame))));
  for (const url of ["/media/%252e%252e/package.json", "/media/properties/aurelia/%2e%2e%5cpackage.json", "/media/properties/aurelia/images/missing.webp", "/media/.env"]) assert.equal((await fetch(base + url)).status, 404);
  checks.push("Media bytes preserved, MIME, caching, ETag 304, HEAD, missing/path-traversal rejection");

  for (const count of [1, 8]) {
    const fixture = await createFixture(count);
    assert.equal((await fetch(`${base}/${fixture.slug}`)).status, 404);
    assert.equal((await fetch(`${base}/media/cache/frames/${fixture.slug}/residence-a/hero-to-plan/frame_0001.webp`)).status, 404);
    const hiddenIndex = await (await fetch(base)).text();
    assert(!hiddenIndex.includes(fixture.slug));
    await db.$transaction([
      db.development.update({ where: { id: fixture.developmentId }, data: { status: "published" } }),
      db.property.update({ where: { id: fixture.id }, data: { status: "published" } }),
    ]);
    assert.equal((await fetch(`${base}/${fixture.slug}/residence-a`)).status, 200);
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
    const wrongProperty = await fetch(base + "/api/lead", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `198.51.100.${200 + count}` }, body: JSON.stringify({ name: "Fixture check", email: "test@example.invalid", phone: "", message: "", propertySlug: "aurelia", unit: fixture.id }) });
    assert.equal(wrongProperty.status, 400); // Must reject before delivery, even with Resend configured.
    if (count === 1) {
      await db.property.create({ data: {
        developmentId: fixture.developmentId, slug: "garden-suite", name: "Garden Suite", status: "published", planImage: aurelia.planImage,
        rooms: { create: { key: "garden", label: "Garden", image: aurelia.planImage, hotspotX: 50, hotspotY: 50 } },
      } });
      const listing = await page.goto(`${base}/${fixture.slug}`);
      assert.equal(listing.status(), 200);
      await page.getByRole("link", { name: "Garden Suite" }).waitFor();
      assert.equal((await fetch(`${base}/${fixture.slug}/garden-suite`)).status, 200);
      checks.push("Multiple published residences show a development list with working nested links");
    }
    await db.property.updateMany({ where: { developmentId: fixture.developmentId }, data: { status: "processing" } });
    assert.equal((await fetch(`${base}/${fixture.slug}`)).status, 404);
    checks.push(`${count} DB-driven rooms, dynamic metadata, draft/processing hidden, publish without rebuild, cross-property lead rejection`);
  }
  for (const scene of aurelia.scenes) for (const suffix of ["", "-mobile"]) {
    const folder = path.join(storageRoot, scene.sequencePath + suffix);
    const frames = (await readdir(folder)).filter((name) => /^frame_\d+\.webp$/.test(name));
    assert.equal(frames.length, suffix ? scene.mobileFrameCount : scene.frameCount);
  }
  checks.push("Aurelia's stored scene counts match the cache on disk");
  assert.deepEqual(runtimeErrors, []);
  console.log("platform: PASS", checks);
} finally {
  await context.close();
  await browser.close();
  for (const fixture of fixtures) {
    await db.development.deleteMany({ where: { slug: fixture.slug } });
    assert.equal(path.dirname(fixture.directory), path.join(storageRoot, "cache", "frames"));
    assert(path.basename(fixture.directory).startsWith("phase-a-"));
    await rm(fixture.directory, { recursive: true, force: true });
  }
  await db.$disconnect();
  await writeFile(path.join(output, "platform-report.json"), JSON.stringify({ checks, runtimeErrors }, null, 2));
}
