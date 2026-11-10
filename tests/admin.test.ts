import test from "node:test";
import assert from "node:assert/strict";
import { createSession, validSession } from "../lib/admin/session";
import { propertyInput, slugify } from "../lib/admin/schema";

test("signed sessions reject tampering, missing configuration and rotated credentials", async () => {
  const previous = { password: process.env.ADMIN_PASSWORD, secret: process.env.SESSION_SECRET };
  try {
    process.env.ADMIN_PASSWORD = "test-only-password"; process.env.SESSION_SECRET = "test-secret-with-at-least-thirty-two-characters";
    const token = await createSession();
    assert(await validSession(token)); assert(!await validSession());
    const parts = token.split("."); parts[1] = Buffer.from('{"role":"admin","exp":9999999999}').toString("base64url");
    assert(!await validSession(parts.join(".")));
    process.env.ADMIN_PASSWORD = "rotated-password"; assert(!await validSession(token));
    process.env.SESSION_SECRET = "short"; await assert.rejects(createSession()); assert(!await validSession(token));
  } finally {
    if (previous.password === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previous.password;
    if (previous.secret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous.secret;
  }
});
test("publication requires complete images/units/rooms; duplicate rooms and reserved slugs fail", () => {
  const draft = { id: "test", updatedAt: new Date().toISOString(), name: "Residence", slug: "residence", tagline: "", location: "", heroCopy: "", accentColor: "#D8B67A", status: "draft", towerImage: null, planImage: null, units: [], rooms: [], amenities: [] };
  assert(propertyInput.safeParse(draft).success);
  const published = propertyInput.safeParse({ ...draft, status: "published" });
  assert(!published.success); assert.equal(published.error.issues.length, 4);
  assert(!propertyInput.safeParse({ ...draft, slug: "admin" }).success);
  const room = { id: "room", key: "living", label: "Living", description: "", image: null, hotspotX: 50, hotspotY: 50 };
  assert(!propertyInput.safeParse({ ...draft, rooms: [room, { ...room, id: "other" }] }).success);
  assert(!propertyInput.safeParse({ ...draft, rooms: [{ ...room, hotspotX: 101 }] }).success);
  assert.equal(slugify("Élan Waterfront / Miami"), "elan-waterfront-miami");
});
