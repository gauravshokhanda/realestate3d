import type { VirtualTourNode } from "@photo-sphere-viewer/virtual-tour-plugin";
import type { TourNode } from "./panorama";

/** Own abortable requests and object URLs; retain only current/next viewpoints. */
export function panoramaSource(nodes: TourNode[], mobile: boolean, releaseCache: (url: string) => void) {
  const urls = new Map<string, string>(), requests = new Map<string, { controller: AbortController; promise: Promise<string> }>();
  let closed = false;
  async function image(id: string, priority: RequestPriority = "high"): Promise<string> {
    if (closed) throw new DOMException("Closed", "AbortError");
    if (urls.has(id)) return urls.get(id)!;
    const existing = requests.get(id);
    if (existing && !existing.controller.signal.aborted) return existing.promise;
    const node = nodes.find((item) => item.id === id);
    if (!node) throw new Error("Unknown viewpoint");
    const controller = new AbortController();
    const promise = (async () => {
      const response = await fetch(mobile ? node.mobileImage : node.image, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]), priority, cache: "force-cache" });
      if (!response.ok) throw new Error("Panorama unavailable");
      const blob = await response.blob();
      if (closed || controller.signal.aborted) throw new DOMException("Closed", "AbortError");
      const url = URL.createObjectURL(blob); urls.set(id, url); return url;
    })().finally(() => { if (requests.get(id)?.controller === controller) requests.delete(id); });
    requests.set(id, { controller, promise }); return promise;
  }
  const release = (id: string, url: string) => { releaseCache(url); URL.revokeObjectURL(url); urls.delete(id); };
  return {
    async getNode(id: string): Promise<VirtualTourNode> {
      const node = nodes.find((item) => item.id === id);
      if (!node) throw new Error("Unknown viewpoint");
      return { id, name: node.name, panorama: await image(id), links: node.links.filter((link) => nodes.some((item) => item.id === link.toNodeId)).map((link) => ({ nodeId: link.toNodeId, position: { yaw: link.yaw, pitch: link.pitch }, data: { label: link.label } })) };
    },
    focus(id: string) {
      const next = nodes.find((item) => item.id === id)?.links[0]?.toNodeId;
      const keep = new Set([id, next]);
      for (const [key, url] of urls) if (!keep.has(key)) release(key, url);
      for (const [key, request] of requests) if (!keep.has(key)) request.controller.abort();
      return next;
    },
    preload(id: string) { return image(id, "low").then(() => {}).catch(() => {}); },
    abort() { closed = true; for (const request of requests.values()) request.controller.abort(); },
    dispose() { for (const [id, url] of urls) release(id, url); },
  };
}
