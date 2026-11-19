import "server-only";
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import type { Scene } from "@prisma/client";
import sharp from "sharp";
import os from "node:os";
import path from "node:path";

const globals = globalThis as unknown as { veoFallback?: string; veoCheck?: { at: number; model: string; enabled: boolean; reason: string } };
export const generationSeconds = 8;
export function readableVideoError(error: unknown) {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of [process.env.GEMINI_API_KEY, process.env.SESSION_SECRET, process.env.ADMIN_PASSWORD]) if (secret) message = message.replaceAll(secret, "[redacted]");
  for (const directory of [process.cwd(), os.tmpdir(), path.resolve(process.env.STORAGE_DIR || "./storage")]) {
    message = message.replaceAll(directory, "[local]").replaceAll(directory.replaceAll("\\", "/"), "[local]");
  }
  return message.replace(/(?:[?&]key=)[^&\s"']+/g, "?key=[redacted]").slice(0, 1800);
}
export async function veoConfiguration() {
  const model = process.env.VEO_MODEL?.trim() || null;
  const base = { model, duration: generationSeconds, resolution: "720p" };
  if (!process.env.GEMINI_API_KEY) return { ...base, enabled: false, reason: "Manual Upload mode: GEMINI_API_KEY is not set. Copy each prompt and upload an MP4." };
  if (!model) return { ...base, enabled: false, reason: "Manual Upload mode: VEO_MODEL is unset. Google's Gemini API Veo 3.1 previews shut down on October 22, 2026; no unverified default model is selected." };
  if (globals.veoFallback) return { ...base, enabled: false, reason: globals.veoFallback };
  const previous = globals.veoCheck;
  if (previous && previous.model === model && Date.now() - previous.at < 60_000) return { ...base, enabled: previous.enabled, reason: previous.reason };
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 20_000, retryOptions: { attempts: 1 } } });
    const metadata = await ai.models.get({ model });
    const enabled = metadata.supportedActions?.some((action) => /generateVideos|predictLongRunning/i.test(action)) ?? false;
    const reason = enabled ? "Configured video model is reachable. First/last-frame support is checked by the generation request; unsupported requests fall back to Manual Upload." : "The configured model does not advertise video generation. Manual Upload remains available.";
    globals.veoCheck = { at: Date.now(), model, enabled, reason };
    return { ...base, enabled, reason };
  } catch (error) {
    const reason = `Model availability check failed: ${readableVideoError(error)} Manual Upload remains available.`;
    globals.veoCheck = { at: Date.now(), model, enabled: false, reason };
    return { ...base, enabled: false, reason };
  }
}
export function retryableVideoError(error: unknown) {
  return /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|quota|rate.limit|temporar/i.test(readableVideoError(error));
}
export function retryDelay(attempt: number) { return Math.min(60_000, 5_000 * 2 ** Math.max(0, attempt - 1)); }
export function markManualFallback(message: string) { globals.veoFallback = message; }
export function manualFallbackReason() { return globals.veoFallback; }

export async function generateVideo(scene: Scene, owner: string) {
  const model = process.env.VEO_MODEL;
  if (!model || !process.env.GEMINI_API_KEY) throw new Error("Veo is not configured. Upload an MP4 in Manual Upload mode.");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 60_000, retryOptions: { attempts: 1 } } });
  let operation = new GenerateVideosOperation();
  if (scene.operationName) {
    operation.name = scene.operationName;
    operation = await ai.operations.getVideosOperation({ operation });
  } else {
    const first = await storage.get(scene.fromImage), last = await storage.get(scene.toImage);
    const png = async (image: Uint8Array) => (await sharp(image).rotate().resize({ width: 1920, height: 1080, fit: "inside", withoutEnlargement: true }).png().toBuffer()).toString("base64");
    operation = await ai.models.generateVideos({ model, prompt: scene.prompt, image: { imageBytes: await png(first.body), mimeType: "image/png" }, config: { lastFrame: { imageBytes: await png(last.body), mimeType: "image/png" }, aspectRatio: "16:9", durationSeconds: generationSeconds, resolution: "720p", numberOfVideos: 1 } });
    if (!operation.name) throw new Error("Veo returned no operation ID. Check billing before retrying; Manual Upload remains available.");
    const saved = await db.scene.updateMany({ where: { id: scene.id, leaseOwner: owner }, data: { operationName: operation.name, progress: 15 } });
    if (!saved.count) throw new Error("Scene changed during generation. The remote operation may still incur a charge.");
  }
  const deadline = Date.now() + 15 * 60_000;
  while (!operation.done) {
    if (Date.now() > deadline) throw new Error("Veo is still running after 15 minutes. Its operation ID is saved; regenerate resumes polling without another submission.");
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    operation = await ai.operations.getVideosOperation({ operation });
  }
  if (operation.error) throw new Error(`Veo operation failed: ${JSON.stringify(operation.error)}`);
  const video = operation.response?.generatedVideos?.[0]?.video;
  if (!video) throw new Error("Veo returned no video (it may have been filtered). Upload an MP4 manually or edit the prompt.");
  if (video.videoBytes) return Buffer.from(video.videoBytes, "base64");
  if (!video.uri) throw new Error("Veo returned no video download URL.");
  const url = new URL(video.uri);
  if (url.protocol !== "https:" || !(url.hostname === "generativelanguage.googleapis.com" || url.hostname.endsWith(".googleapis.com"))) throw new Error("Veo returned an unexpected download host.");
  const response = await fetch(url, { headers: { "x-goog-api-key": process.env.GEMINI_API_KEY }, redirect: "error", signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body) throw new Error(`Veo download returned HTTP ${response.status}.`);
  const chunks: Uint8Array[] = []; let bytes = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    bytes += value.byteLength;
    if (bytes > 100 * 1024 * 1024) { await reader.cancel(); throw new Error("Veo output exceeds the 100 MB video limit."); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
