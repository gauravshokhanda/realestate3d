/// <reference lib="webworker" />
import { frameUrl } from "@/data/scenes";
import { BitmapLRU, frameWindow, webpDimensions } from "./frame-window";
import { cancelFade, paint, type View } from "./window-paint";
import type { WindowReply, WindowRequest } from "./window-protocol";

const scope = globalThis as unknown as DedicatedWorkerGlobalScope;
const views = new Map<number, View>(), controllers = new Map<string, AbortController>(), failures = new Map<string, number>();
const cache = new BitmapLRU<ImageBitmap>(250 * 1048576, 6);
let foreground = -1, pumping = false, decoded = 0, statsAt = -Infinity, deliverySerial = 0;
const deliveries = new Map<number, number>();
const send = (message: WindowReply, transfer: Transferable[] = []) => scope.postMessage(message, transfer);
const key = (v: View, index: number) => frameUrl(v.scene!, index);
function stats(force = false) {
  if (!force && performance.now() - statsAt < 200) return; statsAt = performance.now();
  send({ type: "resources", stats: { frames: cache.entries.size, bytes: cache.bytes, reserved: cache.reserved, peak: cache.peak, budget: cache.budget, decoded } });
}
function desired() {
  const order = [...views.values()].filter((v) => v.scene).sort((a, b) => Number(b.id === foreground) - Number(a.id === foreground));
  const centers = order.map((view) => ({ view, index: view.index }));
  const rest = order.flatMap((view) => frameWindow(view.index, view.scene!.frameCount, view.direction, view.id === foreground).filter((index) => index !== view.index).map((index) => ({ view, index })));
  const maxBytes = Math.max(1, ...order.map((v) => v.frameBytes ?? (v.mobile ? 640 * 360 : 1280 * 720) * 4));
  let bytes = 0; const keys = new Set<string>();
  return [...centers, ...rest].flatMap(({ view, index }) => {
    const url = key(view, index), size = view.frameBytes ?? (view.mobile ? 640 * 360 : 1280 * 720) * 4;
    if (keys.has(url) || bytes + size > cache.budget - maxBytes * 6) return [];
    bytes += size; keys.add(url); return [{ view, index, key: url, generation: view.generation }];
  });
}
function protect() { return new Set([...views.values()].filter((v) => v.scene).flatMap((v) => [key(v, v.index), ...(v.drawn >= 0 ? [key(v, v.drawn)] : [])])); }
function nearest(v: View) {
  if (!v.scene) return;
  let best = -1;
  for (let i = 0; i < v.scene.frameCount; i++) if (cache.entries.has(key(v, i)) && (best < 0 || Math.abs(i - v.index) < Math.abs(best - v.index))) best = i;
  if (best < 0) return;
  const bitmap = cache.get(key(v, best))!;
  if (v.drawn !== best) {
    if (v.context) paint(v, bitmap, best, send);
    else if (!v.copyPending) {
      // Compatibility path copies one frame for the main-thread painter, never a scene.
      const generation = v.generation;
      if (cache.reserve(bitmap.width * bitmap.height * 4, protect(), new Set(desired().map((x) => x.key)))) {
        v.copyPending = true;
        const reserved = bitmap.width * bitmap.height * 4; let transferred = false;
        void createImageBitmap(bitmap).then((copy) => {
          if (v.generation !== generation || !v.scene) { copy.close(); return; }
          const delivery = ++deliverySerial; deliveries.set(delivery, reserved); transferred = true;
          v.drawn = best; send({ type: "painted", id: v.id, generation, index: best, target: v.target, bitmap: copy, delivery, jump: v.jump }, [copy]); v.jump = false;
        }).catch(() => {}).finally(() => { v.copyPending = false; if (!transferred) cache.reserved -= reserved; stats(); });
      }
    }
  }
  if (!v.ready) { v.ready = true; send({ type: "ready", id: v.id, generation: v.generation, count: v.scene.frameCount }); }
}
async function pump() {
  if (pumping) return; pumping = true;
  try {
    while (true) {
      const wanted = desired(), keys = new Set(wanted.map((x) => x.key));
      cache.trim(keys, protect());
      for (const [url, abort] of controllers) if (!keys.has(url)) abort.abort();
      const request = wanted.find((r) => !cache.entries.has(r.key) && (failures.get(r.key) ?? 0) < 2);
      if (!request) break;
      const { view, index, generation } = request;
      const abort = new AbortController(); controllers.set(request.key, abort);
      let reservation = 0;
      try {
        const response = await fetch(request.key, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10000)]), priority: view.id === foreground ? "high" : "low" });
        if (!response.ok) throw new Error(`Frame HTTP ${response.status}`);
        const blob = await response.blob(), dimensions = webpDimensions(await blob.slice(0, 64).arrayBuffer());
        const ratio = Math.min(1, (view.mobile ? 640 : 1280) / dimensions.width);
        const width = Math.max(1, Math.round(dimensions.width * ratio)), height = Math.max(1, Math.round(dimensions.height * ratio));
        view.frameBytes = width * height * 4;
        reservation = width * height * 4;
        if (!cache.reserve(reservation, protect(), keys)) { reservation = 0; break; }
        stats();
        const bitmap = await createImageBitmap(blob, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" }); decoded++;
        if (abort.signal.aborted || view.generation !== generation || !new Set(desired().map((x) => x.key)).has(request.key)) { bitmap.close(); continue; }
        cache.put(request.key, bitmap, reservation); reservation = 0;
        for (const v of views.values()) if (v.scene) nearest(v);
      } catch (cause) {
        if (!abort.signal.aborted) {
          failures.set(request.key, (failures.get(request.key) ?? 0) + 1);
          if (index === view.index && failures.get(request.key) === 2 && !view.ready) send({ type: "error", id: view.id, generation, message: cause instanceof Error ? cause.message : "Frame decode failed" });
        }
      } finally { cache.reserved -= reservation; controllers.delete(request.key); stats(); }
      // Let seek/resize/abort messages preempt the ahead decoder.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally { pumping = false; stats(true); }
}
scope.onmessage = (event: MessageEvent<WindowRequest>) => {
  const m = event.data;
  if (m.type === "delivered") { const bytes = deliveries.get(m.delivery); if (bytes !== undefined) { cache.reserved -= bytes; deliveries.delete(m.delivery); stats(); } return; }
  if (m.type === "attach") { views.set(m.id, { id: m.id, generation: 0, mobile: m.mobile, index: 0, target: 0, direction: 1, foreground: false, width: 1, height: 1, dpr: 1, drawn: -1, ready: false, jump: false, canvas: m.canvas, context: m.canvas?.getContext("2d", { alpha: false }) }); }
  const v = views.get(m.id); if (!v) return;
  if (m.type === "profile") v.mobile = m.mobile;
  cache.budget = [...views.values()].some((view) => view.mobile) ? 120 * 1048576 : 250 * 1048576;
  if (cache.bytes + cache.reserved > cache.budget) {
    views.forEach(cancelFade);
    for (const [url] of [...cache.entries].sort((a, b) => a[1].touched - b[1].touched)) { if (cache.bytes + cache.reserved <= cache.budget) break; cache.delete(url); }
  }
  if (m.type === "load") { cancelFade(v); v.jump = !!v.hasPainted; v.scene = m.scene; v.generation = m.generation; v.index = m.index; v.target = m.index; v.ready = false; v.drawn = -1; if (m.foreground) foreground = v.id; }
  if (m.type === "seek" && v.scene) {
    const jump = Math.abs(m.target - v.target) > 24; if (jump) { cancelFade(v); v.jump = true; }
    v.direction = Math.sign(m.index - v.index) || v.direction; v.index = m.index; v.target = m.target; if (m.foreground) foreground = v.id; nearest(v);
  }
  if (m.type === "resize" && v.canvas && v.context) {
    v.width = m.width; v.height = m.height; v.dpr = m.dpr;
    v.canvas.width = Math.round(m.width * m.dpr); v.canvas.height = Math.round(m.height * m.dpr); v.context.imageSmoothingQuality = "high"; v.drawn = -1; nearest(v);
  }
  if (m.type === "release" || m.type === "detach") { cancelFade(v); v.generation++; v.scene = undefined; v.drawn = -1; if (m.type === "detach") views.delete(v.id); }
  const wanted = new Set(desired().map((x) => x.key)); for (const [url, abort] of controllers) if (!wanted.has(url)) abort.abort();
  if (![...views.values()].some((x) => x.scene)) { cache.clear(); failures.clear(); }
  stats(); void pump();
};
