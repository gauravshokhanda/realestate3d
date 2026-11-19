import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setImmediate } from "node:timers/promises";
import ts from "typescript";

// Exercise the actual TypeScript modules without a DOM or additional test runner.
const moduleUrl = (source) => "data:text/javascript;base64," + Buffer.from(
  ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText,
).toString("base64");
const sceneUrl = moduleUrl(await readFile(new URL("../data/scenes.ts", import.meta.url), "utf8"));
const preloadUrl = moduleUrl((await readFile(new URL("../lib/preload.ts", import.meta.url), "utf8"))
  .replace("@/data/scenes", sceneUrl));
const { preload } = await import(preloadUrl);
const bitmapUrl = moduleUrl((await readFile(new URL("../lib/bitmap-preload.ts", import.meta.url), "utf8"))
  .replace("@/data/scenes", sceneUrl).replace("@/lib/preload", preloadUrl));
const { preloadBitmaps, closeFrames, releaseFrames } = await import(bitmapUrl);
const { fillMissingFrames } = await import(moduleUrl(await readFile(new URL("../lib/frame-fallback.ts", import.meta.url), "utf8")));
const { enqueueSequence } = await import(moduleUrl(await readFile(new URL("../lib/sequence-queue.ts", import.meta.url), "utf8")));
const scene = { id: "test", folder: "/test", frameCount: 7, pad: 4, ext: "webp", scrollLength: 100 };

function mockImages(t, behavior) {
  const original = globalThis.Image;
  const originalWarn = console.warn;
  const attempts = new Map();
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  globalThis.Image = class {
    onload = null;
    onerror = null;
    url = "";
    mode = "ok";
    set src(url) {
      this.url = url;
      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);
      this.mode = behavior(url, attempt);
      queueMicrotask(() => {
        if (this.mode === "error") this.onerror?.(new Event("error"));
        else if (this.mode !== "stalled") this.onload?.();
      });
    }
    get src() { return this.url; }
    removeAttribute() { this.url = ""; }
    decode() {
      if (this.mode === "decode-error") return Promise.reject(new Event("error"));
      if (this.mode === "decoding") return new Promise(() => {});
      return Promise.resolve();
    }
  };
  t.after(() => { globalThis.Image = original; console.warn = originalWarn; });
  return { attempts, warnings };
}

test("retries once, counts failures, and fills leading/interior/trailing gaps with nearest frames", async (t) => {
  const failed = [1, 3, 4, 7];
  const { attempts, warnings } = mockImages(t, (url, attempt) => {
    const index = Number(url.match(/frame_(\d+)/)[1]);
    if (failed.includes(index)) return index === 4 ? "decode-error" : "error";
    if (index === 5 && attempt === 1) return "error";
    return "ok";
  });
  const progress = [];
  const frames = await preload(scene, (p) => progress.push(p));
  assert.equal(progress.length, 8);
  assert.equal(progress[0], 0);
  assert.equal(progress.at(-1), 1);
  assert(progress.every((p, index) => index === 0 || p > progress[index - 1]));
  assert.deepEqual(frames.map((frame) => frame === null), [true, false, true, true, false, false, true]);
  for (const index of [1, 3, 4, 5, 7]) assert.equal(attempts.get("/test/frame_" + String(index).padStart(4, "0") + ".webp"), 2);
  assert.equal(warnings.length, 1);
  assert.deepEqual(warnings[0][1], failed.map((index) => "/test/frame_" + String(index).padStart(4, "0") + ".webp"));
  const filled = fillMissingFrames(frames);
  assert.deepEqual(filled, [frames[1], frames[1], frames[1], frames[4], frames[4], frames[5], frames[5]]);
  await setImmediate(); // Let rejected decode Events surface if they were not handled.
});

test("a transient failure recovers without warning; nearest-frame ties prefer the earlier frame", async (t) => {
  const { warnings } = mockImages(t, (_url, attempt) => attempt === 1 ? "error" : "ok");
  const frames = await preload({ ...scene, frameCount: 3 }, () => {});
  assert(frames.every(Boolean));
  assert.equal(warnings.length, 0);
  const filled = fillMissingFrames([frames[0], null, frames[2]]);
  assert.equal(filled[1], frames[0]);
});

test("all failed frames finish progress and produce a handled Error for the retry UI", async (t) => {
  const { warnings, attempts } = mockImages(t, () => "error");
  let progress = 0;
  const frames = await preload(scene, (p) => { progress = p; });
  assert.equal(progress, 1);
  assert(frames.every((frame) => frame === null));
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][1].length, 7);
  assert([...attempts.values()].every((count) => count === 2));
  assert.throws(() => fillMissingFrames(frames), { name: "Error", message: /No sequence frames/ });
});

test("abort during pending decode settles without rejection, retries, or warnings", async (t) => {
  const { warnings, attempts } = mockImages(t, () => "decoding");
  const controller = new AbortController();
  const result = preload(scene, () => {}, controller.signal);
  await setImmediate();
  controller.abort();
  const frames = await result;
  assert(frames.every((frame) => frame === null));
  assert.equal(warnings.length, 0);
  assert([...attempts.values()].every((count) => count === 1));
});

test("an already aborted preload starts no requests", async (t) => {
  const { attempts, warnings } = mockImages(t, () => "ok");
  const controller = new AbortController();
  controller.abort();
  await preload(scene, () => {}, controller.signal);
  assert.equal(attempts.size, 0);
  assert.equal(warnings.length, 0);
});

test("a callback throwing a browser Event is normalized to an Error", async (t) => {
  mockImages(t, () => "ok");
  await assert.rejects(preload(scene, () => { throw new Event("error"); }), {
    name: "Error", message: "Failed to preload test",
  });
});

test("sequence loads are serialized and a cancelled queued load does not block later scenes", async () => {
  const order = [];
  let release;
  const first = enqueueSequence(() => new Promise((resolve) => { order.push("first"); release = resolve; }), new AbortController().signal);
  const cancelled = new AbortController();
  const second = enqueueSequence(async () => { order.push("cancelled"); }, cancelled.signal).catch((error) => error);
  const third = enqueueSequence(async () => { order.push("third"); return "ready"; }, new AbortController().signal);
  cancelled.abort();
  await setImmediate();
  assert.deepEqual(order, ["first"]);
  release("ready");
  await first;
  assert.equal((await second).name, "AbortError");
  assert.equal(await third, "ready");
  assert.deepEqual(order, ["first", "third"]);
});

test("bitmap decode retries failures, preserves missing indices, and closes shared fallback frames once", async (t) => {
  const originalFetch = globalThis.fetch, originalCreate = globalThis.createImageBitmap;
  t.after(() => { globalThis.fetch = originalFetch; globalThis.createImageBitmap = originalCreate; });
  const attempts = new Map();
  globalThis.fetch = async (url) => {
    attempts.set(url, (attempts.get(url) ?? 0) + 1);
    return { ok: !url.includes("0002"), blob: async () => url };
  };
  const decoded = [];
  globalThis.createImageBitmap = async (url) => {
    const bitmap = { url, width: 800, height: 450, closed: 0, close() { this.closed++; } };
    decoded.push(bitmap); return bitmap;
  };
  const failures = [];
  const loaded = await preloadBitmaps({ ...scene, frameCount: 3 }, () => {}, new AbortController().signal, (urls) => failures.push(...urls));
  assert.equal(loaded[1], null);
  assert.equal(failures.length, 1);
  assert.equal(attempts.get("/test/frame_0002.webp"), 2);
  closeFrames(fillMissingFrames(loaded));
  assert(decoded.every((bitmap) => bitmap.closed === 1));
});

test("abort during bitmap decode closes both completed and late results without leaking", async (t) => {
  const originalFetch = globalThis.fetch, originalCreate = globalThis.createImageBitmap;
  t.after(() => { globalThis.fetch = originalFetch; globalThis.createImageBitmap = originalCreate; });
  globalThis.fetch = async () => ({ ok: true, blob: async () => ({}) });
  const controller = new AbortController();
  const pending = [];
  const decoded = [];
  globalThis.createImageBitmap = () => new Promise((resolve) => pending.push(() => {
    const frame = { closed: 0, close() { this.closed++; } }; decoded.push(frame); resolve(frame);
  }));
  const loading = preloadBitmaps(scene, () => {}, controller.signal, () => assert.fail("Abort must not warn"));
  await setImmediate();
  pending.shift()(); await setImmediate();
  controller.abort(); pending.forEach((release) => release());
  assert.deepEqual(await loading, []);
  assert(decoded.every((frame) => frame.closed === 1));
});

test("scene disposal yields instead of blocking a commit and closes duplicate frames exactly once", async () => {
  const frames = Array.from({ length: 20 }, () => ({ closed: 0, close() { this.closed++; } }));
  const releasing = releaseFrames([...frames, frames[0], null]);
  assert(frames.every((frame) => frame.closed === 0));
  await releasing;
  assert(frames.every((frame) => frame.closed === 1));
});

test("a background decoder can reserve CPU by limiting concurrent frame work", async (t) => {
  const originalFetch = globalThis.fetch, originalCreate = globalThis.createImageBitmap;
  t.after(() => { globalThis.fetch = originalFetch; globalThis.createImageBitmap = originalCreate; });
  let active = 0, peak = 0;
  globalThis.fetch = async () => ({ ok: true, blob: async () => ({}) });
  globalThis.createImageBitmap = async () => {
    peak = Math.max(peak, ++active); await setImmediate(); active--;
    return { close() {} };
  };
  const frames = await preloadBitmaps(scene, () => {}, new AbortController().signal, () => {}, "low", undefined, 1);
  assert.equal(peak, 1);
  assert.equal(frames.filter(Boolean).length, scene.frameCount);
});
