import sharp from "sharp";
import { runFfmpeg } from "./ffmpeg";

export const analysisFps = 6, analysisWidth = 64, analysisHeight = 36;
const pixels = analysisWidth * analysisHeight;
export function difference(a: Uint8Array, b: Uint8Array) {
  let total = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) total += Math.abs(a[i] - b[i]);
  return total / (Math.min(a.length, b.length) || 1) / 255;
}
export async function grayImage(image: Buffer) { return sharp(image).rotate().resize(analysisWidth, analysisHeight, { fit: "fill" }).grayscale().raw().toBuffer(); }
export function findTrim(frames: Uint8Array[], target: Uint8Array, duration: number, fps = analysisFps) {
  if (frames.length < 2) return { start: 0, end: duration, similarity: 0, warning: "The clip is too short to analyse reliably." };
  const motion = frames.map((frame, i) => i ? difference(frame, frames[i - 1]) : 0);
  const scores = frames.map((frame) => difference(frame, target));
  let head = 1;
  while (head < frames.length - 1 && motion[head] < 0.004) head++;
  const start = head > 2 && head < frames.length - 1 ? Math.max(0, (head - 2) / fps) : 0;
  // Prefer the first matching arrival followed by a stable run OR a departure/dissolve.
  let end = duration;
  const candidates = scores.flatMap((score, i) => score <= 0.095 && i / fps > start + 0.35 ? [i] : []);
  for (const index of candidates) {
    const future = scores.slice(index + 1, index + 1 + Math.ceil(fps * 0.7));
    const stable = motion.slice(index + 1, index + 1 + Math.ceil(fps * 0.5));
    const stays = stable.length >= 2 && stable.every((value) => value < 0.007);
    const leaves = future.some((value) => value > scores[index] + 0.045);
    if (stays || leaves) { end = Math.min(duration, (index + 1) / fps); break; }
  }
  if (end === duration && candidates.length) {
    const best = candidates.reduce((a, b) => scores[b] < scores[a] ? b : a);
    if (duration - best / fps > 0.7) end = Math.min(duration, (best + 1) / fps);
  }
  // With an unmatched endpoint, remove only a clearly frozen tail and flag review.
  if (!candidates.length) {
    let tail = frames.length - 1;
    while (tail > 1 && motion[tail] < 0.004) tail--;
    if (frames.length - tail > fps * 0.7 && tail / fps > start + 0.4) end = Math.min(duration, (tail + 2) / fps);
  }
  end = Math.max(start + Math.min(0.25, duration), end);
  const last = Math.min(frames.length - 1, Math.max(0, Math.floor(end * fps) - 1));
  return { start, end: Math.min(duration, end), similarity: 1 - scores[last], warning: candidates.length ? null : "No confident target-image arrival was found. Check the trim preview before publishing." };
}
export async function analyseVideo(file: string, target: Buffer, duration: number) {
  const { stdout } = await runFfmpeg(["-v", "error", "-i", file, "-map", "0:v:0", "-an", "-vf", `fps=${analysisFps},scale=${analysisWidth}:${analysisHeight},format=gray`, "-f", "rawvideo", "-"], { capture: true, maxBytes: pixels * analysisFps * 121 });
  const frames = Array.from({ length: Math.floor(stdout.length / pixels) }, (_, index) => stdout.subarray(index * pixels, (index + 1) * pixels));
  return findTrim(frames, await grayImage(target), duration);
}
