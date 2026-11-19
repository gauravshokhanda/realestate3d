import { frameUrl, type Scene } from "@/data/scenes";

export type LoadedFrame = HTMLImageElement | null;

/** Browser Events and decode failures are consumed here, never rejected. */
function loadImage(url: string, signal?: AbortSignal): Promise<LoadedFrame> {
  return new Promise<LoadedFrame>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (result: LoadedFrame) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener("abort", abort);
      resolve(result);
    };
    const abort = () => { finish(null); image.removeAttribute("src"); };
    // Bound stalled requests as well as requests that dispatch an error event.
    const timeout = setTimeout(abort, 15000);
    if (signal?.aborted) { abort(); return; }
    image.onload = () => {
      try {
        void image.decode().then(() => finish(image)).catch(() => finish(null));
      } catch { finish(null); }
    };
    image.onerror = () => finish(null);
    signal?.addEventListener("abort", abort, { once: true });
    try { image.src = url; } catch { finish(null); }
  }).catch(() => null);
}

/** Progress counts both decoded frames and exhausted failures, in range 0–1. */
export async function preload(
  scene: Scene,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
  onFailures: (urls: string[]) => void = (urls) => console.warn("Sequence frames failed after retry:", urls),
): Promise<LoadedFrame[]> {
  if (!Number.isInteger(scene.frameCount) || scene.frameCount < 1) {
    throw new Error("A sequence must contain at least one frame");
  }
  const images: LoadedFrame[] = Array.from({ length: scene.frameCount }, () => null);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  let next = 0;
  let complete = 0;
  try {
    onProgress(0);
    await Promise.all(Array.from({ length: Math.min(6, scene.frameCount) }, async () => {
      while (next < scene.frameCount && !controller.signal.aborted) {
        const index = next++;
        const url = frameUrl(scene, index);
        let image = await loadImage(url, controller.signal);
        if (!image && !controller.signal.aborted) image = await loadImage(url, controller.signal);
        if (controller.signal.aborted) return;
        images[index] = image;
        onProgress(++complete / scene.frameCount);
      }
    }));
    if (!signal?.aborted) {
      const failures = images.flatMap((image, index) => image ? [] : [frameUrl(scene, index)]);
      if (failures.length) onFailures(failures);
    }
  } catch (error) {
    controller.abort();
    throw error instanceof Error ? error : new Error(`Failed to preload ${scene.id}`);
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
  return images;
}

export function selectScene(scene: Scene): Scene {
  if (window.innerWidth < 768 && scene.mobileFolder && scene.mobileFrameCount &&
    Number.isInteger(scene.mobileFrameCount) && scene.mobileFrameCount > 0) {
    return { ...scene, folder: scene.mobileFolder, frameCount: scene.mobileFrameCount };
  }
  return scene;
}
