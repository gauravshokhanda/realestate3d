import test from "node:test";
import assert from "node:assert/strict";
import { findTrim } from "../lib/jobs/trim";
import { sceneActionSchema, videoSettingsSchema } from "../lib/jobs/schema";
import { retryDelay, retryableVideoError, readableVideoError } from "../lib/jobs/veo";
import path from "node:path";

const frame = (value: number) => new Uint8Array(64 * 36).fill(value);
test("trim stops at the first target arrival before a frozen tail and a later dissolve", () => {
  const values = [20, 20, 20, 20, 40, 70, 100, 140, 180, 180, 180, 180, 180, 180, 150, 100, 50];
  const trim = findTrim(values.map(frame), frame(180), values.length / 6);
  assert(trim.start >= 0 && trim.start < 0.6);
  assert(trim.end > 1 && trim.end < 2);
  assert.equal(trim.warning, null);
});
test("uncertain endpoints are flagged and all-frozen clips remain bounded", () => {
  const frozen = findTrim(Array.from({ length: 24 }, () => frame(10)), frame(240), 4);
  assert(frozen.start >= 0 && frozen.end <= 4 && frozen.end > frozen.start);
  assert(frozen.warning);
  const short = findTrim([frame(10)], frame(10), 0.1);
  assert.equal(short.end, 0.1); assert(short.warning);
});
test("a long frozen head and frozen tail are removed around the useful camera move", () => {
  const values = [...Array(18).fill(20), 60, 100, 150, ...Array(12).fill(200)] as number[];
  const trim = findTrim(values.map(frame), frame(200), values.length / 6);
  assert(trim.start > 2.5 && trim.start < 3);
  assert(trim.end > 3.3 && trim.end < 4);
});
test("manual trim and watermark inputs reject impossible values; paid generation requires confirmation", () => {
  const settings = videoSettingsSchema.parse({}); assert.equal(settings.removeWatermark, false); assert.equal(settings.delogo.x, 1130);
  assert(!sceneActionSchema.safeParse({ action: "extract", trimStart: 4, trimEnd: 3, settings }).success);
  assert(!sceneActionSchema.safeParse({ action: "generate", confirmPaid: false }).success);
  assert(!videoSettingsSchema.safeParse({ removeWatermark: true, delogo: { x: -1, y: 0, w: 10, h: 10 } }).success);
});
test("quota/server errors back off exponentially; auth/validation failures do not retry", () => {
  assert(retryableVideoError(new Error("429 RESOURCE_EXHAUSTED")));
  assert(retryableVideoError(new Error("503 temporarily unavailable")));
  assert(!retryableVideoError(new Error("400 lastFrame is not supported")));
  assert.deepEqual([1, 2, 3].map(retryDelay), [5000, 10000, 20000]);
  const previous = process.env.GEMINI_API_KEY; process.env.GEMINI_API_KEY = "test-secret-key";
  try { assert(!readableVideoError(new Error("test-secret-key")).includes("test-secret-key")); } finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
  const previousStorage = process.env.STORAGE_DIR;
  process.env.STORAGE_DIR = path.resolve("../private-video-storage");
  try { assert(!readableVideoError(new Error(`${process.env.STORAGE_DIR}/clip.mp4`)).includes("private-video-storage")); }
  finally { if (previousStorage === undefined) delete process.env.STORAGE_DIR; else process.env.STORAGE_DIR = previousStorage; }
});
