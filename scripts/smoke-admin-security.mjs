import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import sharp from "sharp";

export async function adminSecurity({ base, context, anon, id, headers, image, checks }) {
  const api = `${base}/api/admin/properties/${id}`;
  // Retry only transport-level ECONNRESET on this idempotent read, never HTTP
  // failures or mutations. Playwright's maxRetries does not retry status codes.
  const record = await (await context.request.get(api, { maxRetries: 2 })).json();
  const put = (data, origin = headers) => context.request.put(api, { headers: origin, data });
  assert.equal((await put(record, { origin: "https://untrusted.invalid" })).status(), 403);
  assert.equal((await put(record, {})).status(), 403);
  assert.equal((await put({ ...record, slug: "admin" })).status(), 400);
  assert.equal((await put({ ...record, slug: "aurelia" })).status(), 409);
  assert.equal((await put({ ...record, updatedAt: "2000-01-01T00:00:00.000Z" })).status(), 409);
  assert.equal((await put({ ...record, towerImage: "/media/properties/aurelia/images/tower-exterior.webp" })).status(), 400);
  assert.equal((await put({ ...record, rooms: record.rooms.map((r, i) => i ? r : { ...r, id: "aurelia-living" }) })).status(), 400);
  checks.push("Origin/CSRF checks, reserved/duplicate slugs, stale version, cross-property assets and room-ID injection rejected");
  const invalid = await context.request.post(`${base}/api/admin/upload?propertyId=${id}`, { headers, multipart: { file: { name: "fake.webp", mimeType: "image/webp", buffer: Buffer.from("invalid bytes") } } });
  assert.equal(invalid.status(), 400);
  const oversized = await context.request.post(`${base}/api/admin/upload?propertyId=${id}`, { headers, multipart: { file: { name: "large.png", mimeType: "image/png", buffer: Buffer.alloc(25 * 1024 * 1024 + 1) } } });
  assert.equal(oversized.status(), 413);
  const largeValid = await context.request.post(`${base}/api/admin/upload?propertyId=${id}`, { headers, multipart: { file: { name: "large-valid.png", mimeType: "image/png", buffer: Buffer.concat([image, Buffer.alloc(11 * 1024 * 1024)]) } } });
  assert.equal(largeValid.status(), 201, "Valid images above Next's default 10 MB middleware limit must upload");
  const wrongOrigin = await context.request.post(`${base}/api/admin/upload?propertyId=${id}`, { headers: { origin: "https://untrusted.invalid" }, multipart: { file: { name: "valid.png", mimeType: "image/png", buffer: image } } });
  assert.equal(wrongOrigin.status(), 403);
  const metadataImage = await sharp(image).resize(640, 640).withMetadata({ exif: { IFD0: { Artist: "Must be stripped" } } }).png().toBuffer();
  const uploaded = await context.request.post(`${base}/api/admin/upload?propertyId=${id}`, { headers, multipart: { file: { name: "../../outside.png", mimeType: "text/plain", buffer: metadataImage } } });
  assert.equal(uploaded.status(), 201);
  const result = await uploaded.json(); assert.equal(result.warnings.length, 2); assert(!result.url.includes("outside"));
  const metadata = await sharp(await (await context.request.get(base + result.url)).body()).metadata();
  assert.equal(metadata.format, "webp"); assert(!metadata.exif); assert(!metadata.icc);
  const cappedImage = await sharp({ create: { width: 6100, height: 100, channels: 3, background: "#222222" } }).png().toBuffer();
  const capped = await context.request.post(`${base}/api/admin/upload?propertyId=${id}`, { headers, multipart: { file: { name: "wide.png", mimeType: "image/png", buffer: cappedImage } } });
  assert.equal(capped.status(), 201); assert.equal((await capped.json()).width, 6000);
  checks.push("25 MB limit, real image validation, generated filenames, MIME independence, metadata stripping, 6000px cap and aspect/width warnings");
  const ip = `198.20.${randomInt(1, 250)}.${randomInt(1, 250)}`;
  for (let attempt = 0; attempt < 5; attempt++) assert.equal((await anon.request.post(base + "/api/admin/login", { headers: { ...headers, "x-forwarded-for": ip }, data: { password: "bad-password" } })).status(), 401);
  const limited = await anon.request.post(base + "/api/admin/login", { headers: { ...headers, "x-forwarded-for": ip }, data: { password: "bad-password" } });
  assert.equal(limited.status(), 429); assert(Number(limited.headers()["retry-after"]) > 0);
  checks.push("Login rate limit: five attempts per ten-minute IP window, sixth returns 429 with Retry-After");
}
