import "server-only";
import { db } from "@/lib/db";
import { storage, mediaUrl } from "@/lib/storage";
import { AdminError } from "@/lib/admin/http";
import { analysisSchema, videoSettingsSchema, type VideosView } from "./schema";
import { syncScenes } from "./derive";
import { veoConfiguration } from "./veo";
import { wakeWorker } from "./worker";

export const activeStatuses = ["generating", "extracting", "uploading"];
export async function requireScene(propertyId: string, sceneId: string) {
  const scene = await db.scene.findFirst({ where: { id: sceneId, propertyId } });
  if (!scene) throw new AdminError("Scene not found.", 404);
  return scene;
}
export async function requireIdleScene(propertyId: string, sceneId: string) {
  const scene = await requireScene(propertyId, sceneId);
  if (activeStatuses.includes(scene.status) || (scene.status === "queued" && (scene.videoPath || scene.mode === "veo"))) throw new AdminError("This scene is already queued or processing. Wait for it to finish.", 409);
  return scene;
}
export async function videosView(propertyId: string): Promise<VideosView> {
  await syncScenes(propertyId);
  const property = await db.property.findUnique({ where: { id: propertyId }, include: { scenes: { orderBy: { key: "asc" } }, rooms: true } });
  if (!property) throw new AdminError("Property not found.", 404);
  wakeWorker();
  const scenes = await Promise.all(property.scenes.map(async (scene) => {
    const folder = scene.sequencePath ?? `properties/${property.slug}/sequences/${scene.key}`;
    let revision = "legacy";
    if (scene.frameCount) try { const manifest: unknown = JSON.parse(new TextDecoder().decode((await storage.get(`${folder}/manifest.json`)).body)); if (typeof manifest === "object" && manifest !== null && "revision" in manifest && typeof manifest.revision === "string") revision = manifest.revision; } catch { /* No finished extraction yet. */ }
    const indices = scene.frameCount ? [1, Math.ceil(scene.frameCount / 2), scene.frameCount] : [];
    const parsed = analysisSchema.safeParse(scene.analysis);
    return { id: scene.id, key: scene.key, label: scene.key === "hero-to-plan" ? "Tower → Floor plan" : `Floor plan → ${property.rooms.find((room) => room.image === scene.toImage)?.label ?? scene.key.slice(8)}`,
      fromImage: mediaUrl(scene.fromImage), toImage: mediaUrl(scene.toImage), prompt: scene.prompt, mode: scene.mode, status: scene.status, progress: scene.progress, error: scene.error,
      videoUrl: scene.videoPath ? mediaUrl(scene.videoPath) : null, frameCount: scene.frameCount, mobileFrameCount: scene.mobileFrameCount, duration: scene.duration, trimStart: scene.trimStart, trimEnd: scene.trimEnd, attempts: scene.attempts,
      settings: videoSettingsSchema.parse(scene.settings ?? {}), analysis: parsed.success ? parsed.data : null, revision, thumbnails: indices.map((index) => `${mediaUrl(`${folder}/frame_${String(index).padStart(4, "0")}.webp`)}?v=${revision}`),
    };
  }));
  return { scenes, propertyStatus: property.status, veo: await veoConfiguration() };
}
