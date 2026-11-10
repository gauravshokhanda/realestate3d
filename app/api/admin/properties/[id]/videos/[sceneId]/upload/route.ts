import { z } from "zod";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { adminFailure, AdminError, guard, privateJson } from "@/lib/admin/http";
import { requireIdleScene } from "@/lib/jobs/api";
import { storeManualVideo } from "@/lib/jobs/upload";
import { wakeWorker } from "@/lib/jobs/worker";
import { videoSettingsSchema } from "@/lib/jobs/schema";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string; sceneId: string }> }) {
  try {
    await guard(request, true);
    const { id, sceneId } = z.object({ id: z.string().min(1).max(128), sceneId: z.string().min(1).max(128) }).parse(await context.params);
    const scene = await requireIdleScene(id, sceneId);
    let rawSettings: unknown = scene.settings ?? {};
    const query = z.object({ settings: z.string().max(1000).optional() }).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
    if (query.settings) { try { rawSettings = JSON.parse(query.settings); } catch { throw new AdminError("Invalid watermark settings."); } }
    const settings = videoSettingsSchema.parse(rawSettings);
    const uploaded = await storeManualVideo(request, id);
    try {
      await db.$transaction(async (tx) => {
        const updated = await tx.scene.updateMany({ where: { id: sceneId, propertyId: id, status: scene.status, mode: scene.mode, videoPath: scene.videoPath, leaseOwner: null }, data: { settings, mode: "manual", status: "queued", videoPath: uploaded.key, duration: uploaded.duration, progress: 0, attempts: 0, error: null, operationName: null, nextAttemptAt: null, trimStart: null, trimEnd: null } });
        if (!updated.count) throw new AdminError("This scene changed during upload. Please try again.", 409);
        await tx.property.update({ where: { id }, data: { status: "processing" } });
      });
    } catch (error) { await storage.delete(uploaded.key).catch(() => {}); throw error; }
    wakeWorker(); return privateJson({ success: true }, 202);
  } catch (error) { return adminFailure(error); }
}
