import { test } from "node:test";
import assert from "node:assert/strict";
import { BitmapLRU, frameWindow, webpDimensions } from "../lib/frame-window";

test("directional window stays bounded during seeks and reversals", () => {
  const forward = frameWindow(100, 240, 1), backward = frameWindow(100, 240, -1);
  assert.equal(forward.length, 49); assert.equal(forward[0], 100);
  assert.equal(Math.min(...forward), 84); assert.equal(Math.max(...forward), 132);
  assert.equal(Math.min(...backward), 68); assert.equal(Math.max(...backward), 116);
  assert.equal(frameWindow(100, 240, 1, false).length, 5);
  assert(frameWindow(239, 240, 1).every((index) => index >= 0 && index < 240));
});
test("LRU closes evictions, reserves before allocating, and never exceeds its budget", () => {
  let closed = 0; const cache = new BitmapLRU(120, 1);
  const add = (key: string) => { assert(cache.reserve(40, new Set(["a"]), new Set(["a"]))); assert(cache.put(key, { width: 5, height: 2, close: () => closed++ }, 40)); };
  add("a"); add("b"); add("c"); add("d");
  assert(cache.get("a")); assert(!cache.entries.has("b")); assert.equal(closed, 1);
  assert(cache.bytes + cache.reserved <= 120); assert(cache.peak <= 120);
  assert(!cache.reserve(121, new Set(), new Set()));
  cache.trim(new Set(["a"])); assert.equal(cache.entries.size, 2); cache.clear(); assert.equal(closed, 4); assert.equal(cache.bytes, 0);
});
test("WebP dimension parsing checks headers before any native bitmap allocation", () => {
  const header = new Uint8Array(40); const text = new TextEncoder();
  header.set(text.encode("RIFF"), 0); header.set(text.encode("WEBPVP8X"), 8);
  header[24] = 255; header[25] = 4; header[27] = 207; header[28] = 2;
  assert.deepEqual(webpDimensions(header.buffer), { width: 1280, height: 720 });
  assert.throws(() => webpDimensions(new ArrayBuffer(8)), /Invalid/);
});
