import type { Scene } from "@/data/scenes";
import type { CacheStats, WindowReply, WindowRequest } from "./window-protocol";

let shared: Worker | undefined, serial = 0;
let broken: Error | undefined;
const renderers = new Map<number, WindowRenderer>();
function decoder() {
  if (!shared) {
    broken = undefined;
    shared = new Worker(new URL("./frame-cache.worker.ts", import.meta.url), { type: "module" });
    shared.onmessage = (event: MessageEvent<WindowReply>) => {
      const m = event.data;
      if (m.type === "resources") {
        (window as unknown as { __frameCacheStats: CacheStats }).__frameCacheStats = m.stats;
        window.dispatchEvent(new CustomEvent("frame-cache-stats", { detail: m.stats }));
      } else {
        const renderer = renderers.get(m.id);
        if (renderer) renderer.receive(m); else if (m.type === "painted") m.bitmap?.close();
        if (m.type === "painted" && m.delivery !== undefined) shared?.postMessage({ type: "delivered", id: m.id, delivery: m.delivery } satisfies WindowRequest);
      }
    };
    shared.onerror = (event) => {
      broken = new Error(event.message || "Frame decoder failed"); shared?.terminate();
      renderers.forEach((renderer) => renderer.fail(broken!));
      const stats: CacheStats = { frames: 0, bytes: 0, reserved: 0, peak: 0, budget: innerWidth < 768 ? 120 * 1048576 : 250 * 1048576, decoded: 0 };
      (window as unknown as { __frameCacheStats: CacheStats }).__frameCacheStats = stats;
      window.dispatchEvent(new CustomEvent("frame-cache-stats", { detail: stats }));
    };
  }
  return shared;
}
export class WindowRenderer {
  readonly id = ++serial;
  generation = 0;
  onPaint?: (index: number) => void;
  private pending?: { resolve(count: number): void; reject(error: Error): void; cleanup(): void };
  private context?: CanvasRenderingContext2D | null;
  private width = 1; private height = 1; private dpr = 1;
  constructor(private canvas: HTMLCanvasElement) {
    const worker = decoder(); renderers.set(this.id, this);
    const offscreen = typeof OffscreenCanvas !== "undefined" && "transferControlToOffscreen" in canvas ? canvas.transferControlToOffscreen() : undefined;
    if (!offscreen) this.context = canvas.getContext("2d", { alpha: false });
    worker.postMessage({ type: "attach", id: this.id, canvas: offscreen, mobile: innerWidth < 768 } satisfies WindowRequest, offscreen ? [offscreen] : []);
  }
  private send(message: WindowRequest) { shared?.postMessage(message); }
  receive(message: Exclude<WindowReply, { type: "resources" }>) {
    if (message.generation !== this.generation) { if (message.type === "painted") message.bitmap?.close(); return; }
    if (message.type === "crossfade") { this.canvas.dataset.crossfadeAt = String(performance.now()); this.canvas.dataset.crossfadeFrom = String(message.from); this.canvas.dataset.crossfadeTo = String(message.to); }
    if (message.type === "ready") { this.pending?.resolve(message.count); this.pending?.cleanup(); this.pending = undefined; }
    if (message.type === "error") this.fail(new Error(message.message));
    if (message.type === "painted") {
      const bitmap = message.bitmap;
      try {
        if (bitmap && this.context) {
          const context = this.context, scale = Math.max(this.width / bitmap.width, this.height / bitmap.height);
          context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); context.drawImage(bitmap, (this.width - bitmap.width * scale) / 2, (this.height - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
          if (message.jump) this.canvas.animate([{ opacity: .65 }, { opacity: 1 }], { duration: 140 });
        }
        this.canvas.dataset.frame = String(message.index);
        this.onPaint?.(message.index);
      } finally { bitmap?.close(); }
    }
  }
  fail(error: Error) { this.pending?.reject(error); this.pending?.cleanup(); this.pending = undefined; }
  load(scene: Scene, index: number, foreground: boolean, signal: AbortSignal): Promise<number> {
    if (broken) return Promise.reject(broken);
    this.release(); const generation = this.generation; this.canvas.dataset.targetFrame = String(index);
    return new Promise((resolve, reject) => {
      const abort = () => this.release();
      this.pending = { resolve, reject, cleanup: () => signal.removeEventListener("abort", abort) };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) { abort(); return; }
      this.send({ type: "load", id: this.id, generation, scene, index, foreground });
    });
  }
  seek(index: number, target: number, foreground: boolean) { this.canvas.dataset.targetFrame = String(target); this.send({ type: "seek", id: this.id, index, target, foreground }); }
  profile(mobile: boolean) { this.send({ type: "profile", id: this.id, mobile }); }
  resize(width: number, height: number, dpr: number) {
    this.width = width; this.height = height; this.dpr = dpr;
    if (this.context) { this.canvas.width = Math.round(width * dpr); this.canvas.height = Math.round(height * dpr); this.context.imageSmoothingQuality = "high"; }
    this.send({ type: "resize", id: this.id, width, height, dpr });
  }
  release() { this.fail(new DOMException("Aborted", "AbortError")); this.generation++; this.send({ type: "release", id: this.id }); }
  destroy() {
    this.release(); this.send({ type: "detach", id: this.id }); renderers.delete(this.id);
    if (!renderers.size) { shared?.terminate(); shared = undefined; (window as unknown as { __frameCacheStats: CacheStats }).__frameCacheStats = { frames: 0, bytes: 0, reserved: 0, peak: 0, budget: 0, decoded: 0 }; }
  }
}
