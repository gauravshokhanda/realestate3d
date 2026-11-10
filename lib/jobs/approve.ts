import "server-only";
import type { Scene } from "@prisma/client";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { AdminError } from "@/lib/admin/http";
import { manifestSchema } from "@/lib/property-validation";
import { analysisSchema } from "./schema";

export async function approveScene(scene: Scene, revision: string, note: string) {
  if (scene.status !== "needs_review" || !scene.frameCount || !scene.mobileFrameCount || !scene.sequencePath) throw new AdminError("Only an extracted scene awaiting quality review can be approved.", 409);
  const manifest = manifestSchema.parse(JSON.parse(new TextDecoder().decode((await storage.get(`${scene.sequencePath}/manifest.json`)).body)));
  if (manifest.revision !== revision) throw new AdminError("The sequence changed. Refresh and compare its new last frame before approving.", 409);
  await storage.get(`${scene.sequencePath}/frame_${String(scene.frameCount).padStart(4, "0")}.webp`);
  const parsed = analysisSchema.safeParse(scene.analysis);
  if (!parsed.success) throw new AdminError("This scene has no valid quality analysis. Re-extract it before approving.", 409);
  const analysis = { ...parsed.data, qcApprovals: [...parsed.data.qcApprovals, { at: new Date().toISOString(), actor: "admin" as const, note, warning: scene.error, similarity: parsed.data.similarity, revision }] };
  await db.$transaction(async (tx) => {
    const current = await tx.scene.findUnique({ where: { id: scene.id } });
    if (!current || current.status !== "needs_review" || current.leaseOwner || current.videoPath !== scene.videoPath || JSON.stringify(current.analysis) !== JSON.stringify(scene.analysis)) throw new AdminError("The scene changed while approving. Refresh and review it again.", 409);
    await tx.scene.update({ where: { id: scene.id }, data: { status: "ready", progress: 100, error: null, analysis } });
    const pending = await tx.scene.count({ where: { propertyId: scene.propertyId, status: { not: "ready" } } });
    await tx.property.update({ where: { id: scene.propertyId }, data: { status: pending ? "processing" : "draft" } });
  });
}
