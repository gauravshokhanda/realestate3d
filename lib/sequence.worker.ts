/// <reference lib="webworker" />
import { preloadBitmaps, releaseFrames, type SequenceFrame } from "@/lib/bitmap-preload";
import { fillMissingFrames } from "@/lib/frame-fallback";
import type { WorkerRequest, WorkerReply } from "@/lib/sequence-worker-protocol";

const scope = globalThis as unknown as DedicatedWorkerGlobalScope;
const send = (message: WorkerReply) => scope.postMessage(message);
let canvas: OffscreenCanvas | undefined;
let context: OffscreenCanvasRenderingContext2D | null = null;
let frames: SequenceFrame[] = [];
let controller: AbortController | undefined;
let active = 0, width = 1, height = 1, dpr = 1, drawn = -1;
let decoded = 0, live = 0, bytes = 0;
const resources = () => send({ type: "resources", decoded, live, bytes });
function track(bitmap: ImageBitmap) {
  decoded++; live++;
  const size = bitmap.width * bitmap.height * 4;
  bytes += size;
  const close = bitmap.close.bind(bitmap);
  let closed = false;
  bitmap.close = () => {
    if (!closed) { closed = true; live--; bytes -= size; }
    close();
  };
}
function release() {
  controller?.abort();
  const previous = frames;
  frames = []; drawn = -1;
  void releaseFrames(previous).then(resources);
}
async function load(message: Extract<WorkerRequest, { type: "load" }>) {
  release(); active = message.id;
  const abort = new AbortController(); controller = abort;
  try {
    const loaded = await preloadBitmaps(message.scene, (value) => {
      send({ type: "progress", id: message.id, value }); resources();
    }, abort.signal, (urls) => console.warn("Sequence frames failed after retry:", urls), message.priority, track, width < 768 ? 1 : 3);
    if (abort.signal.aborted || active !== message.id) { await releaseFrames(loaded); resources(); return; }
    frames = fillMissingFrames(loaded);
    send({ type: "ready", id: message.id, count: frames.length }); resources();
  } catch (cause) {
    if (!abort.signal.aborted) send({ type: "error", id: message.id, message: cause instanceof Error ? cause.message : "Unable to decode sequence" });
    resources();
  }
}
function draw(index: number) {
  if (!context || !frames.length) return;
  index = Math.max(0, Math.min(frames.length - 1, index));
  if (index === drawn) return;
  const image = frames[index];
  const iw = "naturalWidth" in image ? image.naturalWidth : image.width;
  const ih = "naturalHeight" in image ? image.naturalHeight : image.height;
  const scale = Math.max(width / iw, height / ih);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.drawImage(image, (width - iw * scale) / 2, (height - ih * scale) / 2, iw * scale, ih * scale);
  drawn = index; send({ type: "painted", id: active, index });
}
scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === "init") { canvas = message.canvas; context = canvas.getContext("2d", { alpha: false }); }
  if (message.type === "load") void load(message);
  if (message.type === "release" && message.id === active) release();
  if (message.type === "draw" && message.id === active) draw(message.index);
  if (message.type === "resize" && canvas && context) {
    width = message.width; height = message.height; dpr = message.dpr;
    const w = Math.round(width * dpr), h = Math.round(height * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
    drawn = -1;
  }
};
