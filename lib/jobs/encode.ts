import "server-only";
import { mkdir, readdir, stat, rm } from "node:fs/promises";
import path from "node:path";
import { runFfmpeg } from "./ffmpeg";
import { assertFreeSpace } from "@/lib/storage/disk";

export async function encodeVariant(video: string, temporary: string, root: string, baseFilters: string[], duration: number, variant: { suffix: string; width: number; fps: number; quality: number; maxBytes: number }) {
  let quality = variant.quality, fps = Math.min(variant.fps, 239.5 / duration);
  for (let attempt = 0; attempt < 11; attempt++) {
    await assertFreeSpace(root);
    const staged = path.join(temporary, `${variant.suffix ? "mobile" : "desktop"}-${attempt}`); await mkdir(staged);
    const filters = [...baseFilters, `fps=${fps}`, `scale=w='min(iw,${variant.width})':h=-2`];
    await runFfmpeg(["-v", "error", "-y", "-i", video, "-map", "0:v:0", "-an", "-vf", filters.join(","), "-frames:v", "240", "-c:v", "libwebp", "-quality", String(quality), "-threads", "2", "-start_number", "1", "-f", "image2", path.join(staged, "frame_%04d.webp")], { timeout: 360_000 });
    const frames = (await readdir(staged)).filter((name) => /^frame_\d{4}\.webp$/.test(name)).sort();
    if (!frames.length) throw new Error("The selected trim produced no frames.");
    let bytes = 0; for (const frame of frames) bytes += (await stat(path.join(staged, frame))).size;
    if (bytes <= variant.maxBytes) return { staged, frames, bytes, fps, quality };
    if (path.dirname(staged) !== temporary) throw new Error("Unsafe encoding stage");
    await rm(staged, { recursive: true, force: true });
    const ratio = variant.maxBytes / bytes;
    if (quality > 26) {
      const adjustment = Math.max(8, Math.ceil((1 - ratio) * 70));
      quality = Math.max(26, quality - adjustment);
    } else {
      fps = Math.max(5, fps * Math.min(0.85, ratio * 0.98));
    }
  }
  throw new Error(`This sequence cannot fit the ${Math.round(variant.maxBytes / 1048576)} MB size budget. Use a shorter trim or a simpler source.`);
}
