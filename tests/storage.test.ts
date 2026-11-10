import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LocalStorage, validStorageKey } from "../lib/storage/local";
import { reservedSlugs, slugSchema } from "../lib/property-validation";

test("storage round-trip, MIME and content ETag; traversal and junctions are rejected", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "aurelia-storage-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), os.tmpdir());
    assert(path.basename(directory).startsWith("aurelia-storage-"));
    await rm(directory, { recursive: true, force: true });
  });
  const storage = new LocalStorage(path.join(directory, "storage"));
  await storage.put("properties/test/images/tower.webp", Buffer.from("fixture"));
  const first = await storage.get("properties/test/images/tower.webp");
  assert.equal(new TextDecoder().decode(first.body), "fixture");
  assert.equal(first.contentType, "image/webp");
  assert.equal(first.size, 7);
  assert.equal((await storage.get("properties/test/images/tower.webp")).etag, first.etag);
  await storage.put("properties/test/images/tower.webp", Buffer.from("changed"));
  assert.notEqual((await storage.get("properties/test/images/tower.webp")).etag, first.etag);
  for (const key of ["../secret", "a/../../secret", "/absolute", "a//b", "a\\b", "C:/secret", "a/%2e%2e/b", "a/./b", "a/..", ""]) {
    assert.equal(validStorageKey(key), false);
    await assert.rejects(storage.put(key, Buffer.from("unsafe")));
    await assert.rejects(storage.get(key));
  }
  const outside = path.join(directory, "outside");
  await mkdir(outside);
  await writeFile(path.join(outside, "secret.webp"), "private");
  await symlink(outside, path.join(storage.root, "link"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(storage.get("link/secret.webp"), /symlinks/);
  assert.equal(await readFile(path.join(outside, "secret.webp"), "utf8"), "private");
  await storage.delete("properties/test/images/tower.webp");
  await assert.rejects(storage.get("properties/test/images/tower.webp"));
});

test("public slugs reject all reserved routes and unsafe segments", () => {
  for (const slug of [...reservedSlugs, "Aurelia", "../admin", "a/b", "", "double--hyphen", " leading"]) assert.equal(slugSchema.safeParse(slug).success, false, slug);
  for (const slug of ["aurelia", "waterfront-2", "a"]) assert.equal(slugSchema.safeParse(slug).success, true);
});
