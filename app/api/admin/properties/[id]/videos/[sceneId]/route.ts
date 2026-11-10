import { z } from "zod";
import { db } from "@/lib/db";
import { adminFailure, AdminError, guard, privateJson, readJson } from "@/lib/admin/http";
import { requireIdleScene } from "@/lib/jobs/api";
import { sceneActionSchema, videoSettingsSchema } from "@/lib/jobs/schema";
import { veoConfiguration } from "@/lib/jobs/veo";
import { wakeWorker } from "@/lib/jobs/worker";
import { approveScene } from "@/lib/jobs/approve";
type Context = { params: Promise<{ id: string; sceneId: string }> };
export async function POST(request: Request, context: Context) {
  try {
    await guard(request, true);
    const { id, sceneId } = z.object({ id: z.string().min(1).max(128), sceneId: z.string().min(1).max(128) }).parse(await context.params);
    const input = sceneActionSchema.parse(await readJson(request));
    const scene = await requireIdleScene(id, sceneId);
    if (input.action === "approve") { await approveScene(scene, input.expectedRevision, input.note); return privateJson({ success: true }); }
    if (input.action === "generate") { const configuration = await veoConfiguration(); if (!configuration.enabled) throw new AdminError(configuration.reason, 409); }
    await db.$transaction(async (tx) => {
      const current = await tx.scene.findUnique({ where: { id: sceneId } });
      if (!current || current.status !== scene.status || current.videoPath !== scene.videoPath || current.leaseOwner !== null || current.mode !== scene.mode || current.prompt !== scene.prompt) throw new AdminError("This scene changed. Refresh before editing it.", 409);
      let processing = false;
      if (input.action === "edit") {
        const changed = JSON.stringify(videoSettingsSchema.parse(scene.settings ?? {})) !== JSON.stringify(input.settings);
        processing = changed && Boolean(scene.videoPath);
        await tx.scene.update({ where: { id: sceneId }, data: { prompt: input.prompt, settings: input.settings, ...(processing ? { mode: "manual", status: "queued", progress: 0, error: null } : {}) } });
      } else if (input.action === "extract") {
        if (!scene.videoPath) throw new AdminError("Upload an MP4 before trimming.");
        if (scene.duration && input.trimEnd !== null && input.trimEnd > scene.duration + 0.05) throw new AdminError("Trim end is after the source duration.");
        processing = true;
        await tx.scene.update({ where: { id: sceneId }, data: { settings: input.settings, trimStart: input.trimStart, trimEnd: input.trimEnd, status: "queued", mode: "manual", progress: 0, error: null } });
      } else {
        processing = true;
        // An existing operation without a download is resumed, never silently resubmitted.
        await tx.scene.update({ where: { id: sceneId }, data: { mode: "veo", status: "queued", progress: 0, attempts: 0, error: null, nextAttemptAt: null, videoPath: null, operationName: scene.videoPath ? null : scene.operationName, trimStart: null, trimEnd: null } });
      }
      if (processing) await tx.property.update({ where: { id }, data: { status: "processing" } });
    });
    wakeWorker(); return privateJson({ success: true }, 202);
  } catch (error) { return adminFailure(error); }
}
