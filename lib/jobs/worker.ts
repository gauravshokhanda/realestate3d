import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { originalFolder } from "@/lib/storage/layout";
import { extractScene } from "./extract";
import { generateVideo, manualFallbackReason, markManualFallback, readableVideoError, retryableVideoError, retryDelay } from "./veo";

const globals = globalThis as unknown as { aureliaWorker?: { busy: boolean; timer: ReturnType<typeof setInterval> } };
export async function queueFrameRebuild(id: string) {
  const result = await db.scene.updateMany({ where: { id, status: "ready", leaseOwner: null, videoPath: { not: null } }, data: { status: "rebuild_queued", nextAttemptAt: null, error: null, progress: 0 } });
  return result.count === 1;
}

export async function recoverJobs() {
  const now = new Date();
  const expired = [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }];
  const released = { leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: now, error: "Resuming an interrupted job." };
  const [jobs, rebuilds] = await db.$transaction([
    db.scene.updateMany({ where: { status: { in: ["generating", "extracting"] }, OR: expired }, data: { ...released, status: "queued" } }),
    db.scene.updateMany({ where: { status: "rebuilding", OR: expired }, data: { ...released, status: "rebuild_queued" } }),
  ]);
  return { count: jobs.count + rebuilds.count };
}
export async function runQueueOnce({ sceneIds }: { sceneIds?: string[] } = {}) {
  await recoverJobs();
  const next = await db.scene.findFirst({ where: { id: sceneIds ? { in: sceneIds } : undefined, status: { in: sceneIds ? ["rebuild_queued"] : ["queued", "rebuild_queued"] }, AND: [{ OR: [{ mode: "veo" }, { videoPath: { not: null } }] }, { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] }] }, orderBy: { id: "asc" } });
  if (!next) return false;
  const rebuild = next.status === "rebuild_queued";
  const fallback = manualFallbackReason();
  if (next.mode === "veo" && !next.operationName && !next.videoPath && next.attempts > 0 && next.error === "Resuming an interrupted job.") {
    await db.scene.updateMany({ where: { id: next.id, status: "queued" }, data: { status: "failed", error: "Generation was interrupted before its operation ID was saved. Check Gemini billing before explicitly regenerating, or upload an MP4. No automatic paid resubmission was made." } });
    return true;
  }
  if (fallback && next.mode === "veo" && !next.videoPath && !next.operationName) {
    await db.scene.updateMany({ where: { id: next.id, status: "queued" }, data: { mode: "manual", status: "failed", error: fallback, nextAttemptAt: null } });
    return true;
  }
  const owner = randomUUID();
  const status = rebuild ? "rebuilding" : next.mode === "veo" && !next.videoPath ? "generating" : "extracting";
  const claimed = await db.scene.updateMany({ where: { id: next.id, status: next.status }, data: { status, leaseOwner: owner, leaseExpiresAt: new Date(Date.now() + 90_000), progress: 5, error: null, ...(status === "generating" ? { attempts: { increment: 1 } } : {}) } });
  if (!claimed.count) return true;
  const heartbeat = setInterval(() => { void db.scene.updateMany({ where: { id: next.id, leaseOwner: owner }, data: { leaseExpiresAt: new Date(Date.now() + 90_000) } }).catch(() => {}); }, 15_000); heartbeat.unref();
  try {
    let scene = await db.scene.findUniqueOrThrow({ where: { id: next.id } });
    if (status === "generating") {
      const video = await generateVideo(scene, owner);
      const property = await db.property.findUniqueOrThrow({ where: { id: scene.propertyId }, select: { development: { select: { slug: true } } } });
      const key = `${originalFolder(property.development.slug, scene.propertyId)}/videos/${randomUUID()}.mp4`;
      await storage.put(key, video);
      const changed = await db.scene.updateMany({ where: { id: scene.id, leaseOwner: owner }, data: { videoPath: key, status: "extracting", progress: 25 } });
      if (!changed.count) throw new Error("The scene was replaced during generation.");
      scene = await db.scene.findUniqueOrThrow({ where: { id: next.id } });
    }
    await extractScene(scene, owner, rebuild);
  } catch (error) {
    const scene = await db.scene.findFirst({ where: { id: next.id, leaseOwner: owner } });
    if (scene) {
      const message = readableVideoError(error);
      const generating = scene.status === "generating";
      const retry = generating && retryableVideoError(error) && scene.attempts < 3;
      const unsupported = /last.?frame|not.supported|not.found|\b(400|404)\b/i.test(message) && generating;
      if (unsupported) markManualFallback(`Veo cannot run with the configured model: ${message} Use Manual Upload.`);
      await db.scene.updateMany({ where: { id: next.id, leaseOwner: owner }, data: { status: rebuild ? "ready" : retry ? "queued" : "failed", progress: rebuild ? 100 : scene.progress, error: message, mode: unsupported ? "manual" : scene.mode, ...(generating && /Veo operation failed|Veo returned no video/.test(message) ? { operationName: null } : {}), nextAttemptAt: retry ? new Date(Date.now() + retryDelay(scene.attempts)) : null, leaseOwner: null, leaseExpiresAt: null } });
    }
  } finally { clearInterval(heartbeat); }
  return true;
}
export function wakeWorker() {
  if (!globals.aureliaWorker) {
    const state = { busy: false, timer: setInterval(() => { void tick(); }, 2000) }; state.timer.unref(); globals.aureliaWorker = state;
  }
  async function tick() {
    const state = globals.aureliaWorker!;
    if (state.busy) return;
    state.busy = true;
    try { while (await runQueueOnce()) { /* One active job per process, DB leases across processes. */ } }
    catch (error) { console.error("[video-worker]", readableVideoError(error)); }
    finally { state.busy = false; }
  }
  void tick();
}
