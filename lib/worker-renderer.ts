import type { Scene } from "@/data/scenes";
import type { WorkerReply, WorkerRequest } from "@/lib/sequence-worker-protocol";

export class WorkerRenderer {
  private worker: Worker;
  private id = 0;
  private failed?: Error;
  onPaint?: () => void;
  private pending?: { id: number; resolve: (count: number) => void; reject: (error: Error) => void; progress: (value: number) => void; cleanup: () => void };
  constructor(private canvas: HTMLCanvasElement) {
    this.worker = new Worker(new URL("./sequence.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const message = event.data;
      if (message.type === "resources") {
        canvas.dataset.workerDecoded = String(message.decoded);
        canvas.dataset.workerBitmaps = String(message.live);
        canvas.dataset.workerBytes = String(message.bytes);
        canvas.dispatchEvent(new Event("sequence-resources", { bubbles: true }));
      } else if (message.type === "painted" && message.id === this.id) { canvas.dataset.frame = String(message.index); this.onPaint?.(); }
      else if (this.pending && message.id === this.pending.id) {
        if (message.type === "progress") this.pending.progress(message.value);
        if (message.type === "ready" || message.type === "error") {
          const pending = this.pending; this.pending = undefined; pending.cleanup();
          if (message.type === "ready") pending.resolve(message.count);
          else pending.reject(new Error(message.message));
        }
      }
    };
    this.worker.onerror = (event) => {
      this.failed = new Error(event.message || "Sequence worker failed");
      this.pending?.cleanup(); this.pending?.reject(this.failed); this.pending = undefined;
    };
    const offscreen = canvas.transferControlToOffscreen();
    this.worker.postMessage({ type: "init", canvas: offscreen } satisfies WorkerRequest, [offscreen]);
  }
  private send(message: WorkerRequest) { this.worker.postMessage(message); }
  load(scene: Scene, progress: (value: number) => void, signal: AbortSignal, priority: RequestPriority): Promise<number> {
    if (this.failed) return Promise.reject(this.failed);
    this.release();
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.send({ type: "release", id });
        if (this.pending?.id === id) { this.pending.cleanup(); this.pending = undefined; }
        reject(new DOMException("Aborted", "AbortError"));
      };
      this.pending = { id, resolve, reject, progress, cleanup: () => signal.removeEventListener("abort", abort) };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) { abort(); return; }
      this.send({ type: "load", id, scene, priority });
    });
  }
  resize(width: number, height: number, dpr: number) { this.send({ type: "resize", width, height, dpr }); }
  draw(index: number) { this.send({ type: "draw", id: this.id, index }); }
  release() {
    this.pending?.cleanup(); this.pending?.reject(new DOMException("Aborted", "AbortError")); this.pending = undefined;
    this.send({ type: "release", id: this.id });
  }
  destroy() {
    this.release(); this.worker.terminate();
    this.canvas.dataset.workerBitmaps = "0"; this.canvas.dataset.workerBytes = "0";
    this.canvas.dispatchEvent(new Event("sequence-resources", { bubbles: true }));
  }
}
