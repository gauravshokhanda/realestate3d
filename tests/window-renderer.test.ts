import test from "node:test";
import assert from "node:assert/strict";
import { WindowRenderer } from "../lib/window-renderer";
import type { WindowReply, WindowRequest } from "../lib/window-protocol";
const scene = { id: "test", folder: "/frames", frameCount: 240, pad: 4, ext: "webp" as const, scrollLength: 2000 };
function setup(t: test.TestContext) {
  const names = ["Worker", "OffscreenCanvas", "window", "innerWidth"] as const;
  const originals = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
  class FakeWorker {
    static latest: FakeWorker;
    onmessage?: (event: MessageEvent<WindowReply>) => void; onerror?: (event: ErrorEvent) => void;
    sent: WindowRequest[] = []; terminated = false;
    constructor() { FakeWorker.latest = this; }
    postMessage(message: WindowRequest) { this.sent.push(message); }
    terminate() { this.terminated = true; }
    emit(data: WindowReply) { this.onmessage?.({ data } as MessageEvent<WindowReply>); }
  }
  const values = [FakeWorker, class {}, new EventTarget(), 1440];
  names.forEach((name, i) => Object.defineProperty(globalThis, name, { value: values[i], configurable: true, writable: true }));
  const canvas = { dataset: {} as DOMStringMap, transferControlToOffscreen: () => ({}) } as HTMLCanvasElement;
  const renderer = new WindowRenderer(canvas), worker = FakeWorker.latest;
  t.after(() => { renderer.destroy(); names.forEach((name, i) => { if (originals[i]) Object.defineProperty(globalThis, name, originals[i]!); else Reflect.deleteProperty(globalThis, name); }); });
  return { renderer, worker, canvas };
}
test("first window paint acknowledges the real frame without waiting for a whole scene", async (t) => {
  const { renderer, worker, canvas } = setup(t); const loading = renderer.load(scene, 80, true, new AbortController().signal);
  const load = worker.sent.findLast((m) => m.type === "load")!; if (load.type !== "load") throw Error("missing load");
  worker.emit({ type: "painted", id: renderer.id, generation: load.generation, index: 80, target: 80, jump: false });
  worker.emit({ type: "ready", id: renderer.id, generation: load.generation, count: 240 });
  assert.equal(await loading, 240); assert.equal(canvas.dataset.frame, "80"); renderer.seek(180, 200, true); assert.equal(canvas.dataset.targetFrame, "200");
});
test("aborted generations cannot repaint, and transferred late bitmaps are closed/acknowledged", async (t) => {
  const { renderer, worker, canvas } = setup(t); const abort = new AbortController();
  const first = renderer.load(scene, 0, true, abort.signal), old = renderer.generation;
  const rejected = assert.rejects(first, { name: "AbortError" }); abort.abort(); await rejected;
  let closed = 0;
  worker.emit({ type: "painted", id: renderer.id, generation: old, index: 230, target: 230, jump: true, bitmap: { close: () => closed++ } as ImageBitmap, delivery: 12 });
  assert.equal(canvas.dataset.frame, undefined); assert.equal(closed, 1); assert(worker.sent.some((m) => m.type === "delivered" && m.delivery === 12));
  const replacement = renderer.load(scene, 100, true, new AbortController().signal);
  worker.emit({ type: "ready", id: renderer.id, generation: renderer.generation, count: 240 }); assert.equal(await replacement, 240);
});
test("worker failure rejects both the pending window and future loads", async (t) => {
  const { renderer, worker } = setup(t); const first = renderer.load(scene, 0, true, new AbortController().signal);
  const failure = assert.rejects(first, /decoder crashed/); worker.onerror?.({ message: "decoder crashed" } as ErrorEvent); await failure;
  await assert.rejects(renderer.load(scene, 0, true, new AbortController().signal), /decoder crashed/);
});
