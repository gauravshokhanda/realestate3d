import { z } from "zod";
import { db } from "@/lib/db";
import { adminFailure, AdminError, guard, privateJson, readJson } from "@/lib/admin/http";
import { videosView, activeStatuses } from "@/lib/jobs/api";
import { batchSchema } from "@/lib/jobs/schema";
import { veoConfiguration } from "@/lib/jobs/veo";
import { wakeWorker } from "@/lib/jobs/worker";
type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export async function GET(request: Request, context: Context) {
  try { await guard(request); const id = z.string().min(1).max(128).parse((await context.params).id); return privateJson(await videosView(id)); }
  catch (error) { return adminFailure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    await guard(request, true);
    const propertyId = z.string().min(1).max(128).parse((await context.params).id);
    const input = batchSchema.parse(await readJson(request));
    const configuration = await veoConfiguration();
    if (!configuration.enabled) throw new AdminError(configuration.reason, 409);
    await db.$transaction(async (tx) => {
      const scenes = await tx.scene.findMany({ where: { propertyId, id: { in: input.sceneIds } } });
      if (scenes.length !== new Set(input.sceneIds).size) throw new AdminError("A selected scene does not belong to this property.");
      if (scenes.some((s) => activeStatuses.includes(s.status) || (s.status === "queued" && (s.mode === "veo" || s.videoPath)))) throw new AdminError("Some selected scenes are already processing.", 409);
      await tx.scene.updateMany({ where: { propertyId, id: { in: input.sceneIds } }, data: { mode: "veo", status: "queued", progress: 0, attempts: 0, error: null, videoPath: null, operationName: null, nextAttemptAt: null, leaseOwner: null, leaseExpiresAt: null, trimStart: null, trimEnd: null } });
      await tx.property.update({ where: { id: propertyId }, data: { status: "processing" } });
    });
    wakeWorker(); return privateJson({ success: true }, 202);
  } catch (error) { return adminFailure(error); }
}
