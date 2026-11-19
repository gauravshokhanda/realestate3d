import test from "node:test";
import assert from "node:assert/strict";
import { WorkerRenderer } from "../lib/worker-renderer";
import type { WorkerReply, WorkerRequest } from "../lib/sequence-worker-protocol";
import type { Scene } from "../data/scenes";

const scene: Scene = { id: "test", folder: "/frames", frameCount: 3, pad: 4, ext: "webp", scrollLength: 100 };
function setup(t: test.TestContext) {
  const original = globalThis.Worker;
  class FakeWorker {
    static latest: FakeWorker;
    onmessage?: (event: MessageEvent<WorkerReply>) => void;
    onerror?: (event: ErrorEvent) => void;
    sent: WorkerRequest[] = [];
    terminated = false;
    constructor() { FakeWorker.latest = this; }
    postMessage(message: WorkerRequest) { this.sent.push(message); }
    terminate() { this.terminated = true; }
    emit(data: WorkerReply) { this.onmessage?.({ data } as MessageEvent<WorkerReply>); }
  }
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
  t.after(() => { if (original) globalThis.Worker = original; else Reflect.deleteProperty(globalThis, "Worker"); });
  const target = new EventTarget();
  const canvas = Object.assign(target, { dataset: {} as DOMStringMap, transferControlToOffscreen: () => ({}) as OffscreenCanvas }) as unknown as HTMLCanvasElement;
  const renderer = new WorkerRenderer(canvas);
  return { renderer, canvas, worker: FakeWorker.latest };
}

test("worker replies update progress, readiness and painted frames only for the active generation", async (t) => {
  const { renderer, canvas, worker } = setup(t);
  const progress: number[] = [];
  const loading = renderer.load(scene, (value) => progress.push(value), new AbortController().signal, "high");
  const request = worker.sent.findLast((message) => message.type === "load")!;
  assert.equal(request.type, "load");
  if (request.type !== "load") throw Error("Missing load");
  worker.emit({ type: "progress", id: request.id, value: 0.5 });
  worker.emit({ type: "ready", id: request.id, count: 3 });
  assert.equal(await loading, 3);
  assert.deepEqual(progress, [0.5]);
  worker.emit({ type: "painted", id: request.id - 1, index: 2 });
  assert.equal(canvas.dataset.frame, undefined);
  worker.emit({ type: "painted", id: request.id, index: 1 });
  assert.equal(canvas.dataset.frame, "1");
  renderer.destroy();
  assert(worker.terminated);
});

test("abort rejects a pending worker load and a stale reply cannot complete its replacement", async (t) => {
  const { renderer, worker } = setup(t);
  const abort = new AbortController();
  const first = renderer.load(scene, () => {}, abort.signal, "low");
  const rejected = assert.rejects(first, { name: "AbortError" });
  abort.abort(); await rejected;
  const second = renderer.load(scene, () => {}, new AbortController().signal, "high");
  worker.emit({ type: "ready", id: 1, count: 99 });
  worker.emit({ type: "ready", id: 2, count: 3 });
  assert.equal(await second, 3);
  renderer.destroy();
});

test("worker failure cannot leave future loads or cleanup hanging; resource counters clear on destroy", async (t) => {
  const { renderer, canvas, worker } = setup(t);
  const loading = renderer.load(scene, () => {}, new AbortController().signal, "high");
  const rejected = assert.rejects(loading, /Decoder crashed/);
  worker.onerror?.({ message: "Decoder crashed" } as ErrorEvent);
  await rejected;
  await assert.rejects(renderer.load(scene, () => {}, new AbortController().signal, "high"), /Decoder crashed/);
  worker.emit({ type: "resources", decoded: 3, live: 3, bytes: 1200 });
  assert.equal(canvas.dataset.workerBitmaps, "3");
  renderer.destroy();
  assert.equal(canvas.dataset.workerBitmaps, "0");
  assert.equal(canvas.dataset.workerBytes, "0");
});
