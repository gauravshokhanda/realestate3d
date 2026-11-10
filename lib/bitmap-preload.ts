import { frameUrl, type Scene } from "@/data/scenes";
import { preload } from "@/lib/preload";

export type SequenceFrame = ImageBitmap | HTMLImageElement;

export function closeFrames(frames: (SequenceFrame | null)[]) {
  for (const frame of new Set(frames)) if (frame && "close" in frame) frame.close();
}

/** Native bitmap disposal can be expensive; never close a whole scene in a React commit. */
export function releaseFrames(frames: (SequenceFrame | null)[]): Promise<void> {
  const queue = [...new Set(frames)].filter((frame): frame is ImageBitmap => !!frame && "close" in frame);
  return new Promise((resolve) => {
    const drain = () => {
      const start = performance.now();
      let count = 0;
      while (queue.length && count++ < 4 && performance.now() - start < 4) queue.pop()!.close();
      if (queue.length) setTimeout(drain, 0); else resolve();
    };
    if (queue.length) setTimeout(drain, 0); else resolve();
  });
}

/** Fetch/decode off the rendering path. Aborted and late results are always released. */
export async function preloadBitmaps(scene: Scene, onProgress: (value: number) => void, signal: AbortSignal, onFailures: (urls: string[]) => void, priority: RequestPriority = "high", onBitmap?: (bitmap: ImageBitmap) => void, concurrency = 3): Promise<(SequenceFrame | null)[]> {
  if (typeof createImageBitmap !== "function") return preload(scene, onProgress, signal, onFailures);
  if (!Number.isInteger(scene.frameCount) || scene.frameCount < 1) throw new Error("A sequence must contain at least one frame");
  const frames: (SequenceFrame | null)[] = Array.from({ length: scene.frameCount }, () => null);
  let next = 0, complete = 0, reported = -1;
  try {
    await Promise.all(Array.from({ length: Math.min(Math.max(1, Math.floor(concurrency)), scene.frameCount) }, async () => {
      while (next < scene.frameCount && !signal.aborted) {
        const index = next++;
        for (let attempt = 0; attempt < 2 && !signal.aborted; attempt++) {
          try {
            const response = await fetch(frameUrl(scene, index), { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), priority });
            if (!response.ok) throw new Error("Frame unavailable");
            const bitmap = await createImageBitmap(await response.blob());
            onBitmap?.(bitmap);
            if (signal.aborted) { bitmap.close(); break; }
            frames[index] = bitmap;
            break;
          } catch { /* Retry once; nearest-frame fallback preserves timeline indices. */ }
        }
        const percent = Math.floor(++complete / scene.frameCount * 20);
        if (!signal.aborted && percent !== reported) { reported = percent; onProgress(complete / scene.frameCount); }
      }
    }));
    if (signal.aborted) { await releaseFrames(frames); return []; }
    const failed = frames.flatMap((frame, index) => frame ? [] : [frameUrl(scene, index)]);
    if (failed.length) onFailures(failed);
    return frames;
  } catch (cause) { await releaseFrames(frames); throw cause; }
}
