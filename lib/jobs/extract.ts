import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Scene } from "@prisma/client";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { LocalStorage } from "@/lib/storage/local";
import { analysisSchema, videoSettingsSchema } from "./schema";
import { analyseVideo, difference, grayImage } from "./trim";
import { probeVideo } from "./ffmpeg";
import { assertFreeSpace } from "@/lib/storage/disk";
import { encodeVariant } from "./encode";

async function exists(file: string) { try { await stat(file); return true; } catch { return false; } }
export async function extractScene(scene: Scene, owner: string) {
  if (!(storage instanceof LocalStorage)) throw new Error("The video worker requires LocalStorage until the S3 adapter is implemented.");
  if (!scene.videoPath) throw new Error("Upload an MP4 first.");
  const property = await db.property.findUniqueOrThrow({ where: { id: scene.propertyId } });
  const root = storage.root;
  await assertFreeSpace(root);
  const privateRoot = path.dirname(await storage.filePath(".jobs/temp"));
  await mkdir(privateRoot, { recursive: true });
  const temporary = await mkdtemp(path.join(privateRoot, "extract-"));
  const transactions: { target: string; backup: string; staged: string; old: boolean; moved: boolean }[] = [];
  let committed = false;
  try {
    const video = await storage.filePath(scene.videoPath);
    const metadata = await probeVideo(video);
    const target = Buffer.from((await storage.get(scene.toImage)).body);
    await db.scene.updateMany({ where: { id: scene.id, leaseOwner: owner }, data: { progress: 30, duration: metadata.duration } });
    const automatic = await analyseVideo(video, target, metadata.duration);
    const start = scene.trimStart ?? automatic.start, end = scene.trimEnd ?? automatic.end;
    if (start < 0 || end > metadata.duration + 0.05 || end <= start || end - start < 0.04) throw new Error(`Trim must be inside the ${metadata.duration.toFixed(2)}s source and end after start.`);
    const settings = videoSettingsSchema.parse(scene.settings ?? {});
    const box = settings.delogo;
    // Defaults are specified for a 1280x720 source; scale them to this source.
    const logo = { x: Math.round(box.x * metadata.width / 1280), y: Math.round(box.y * metadata.height / 720), w: Math.max(1, Math.round(box.w * metadata.width / 1280)), h: Math.max(1, Math.round(box.h * metadata.height / 720)) };
    if (settings.removeWatermark && (logo.x <= 0 || logo.y <= 0 || logo.x + logo.w >= metadata.width || logo.y + logo.h >= metadata.height)) throw new Error("The watermark box must fit inside the source frame, leaving a one-pixel border.");
    const variants = [];
    for (const variant of [{ suffix: "", width: 1280, fps: 24, quality: 72, maxBytes: 8 * 1048576 }, { suffix: "-mobile", width: 640, fps: 15, quality: 65, maxBytes: 3 * 1048576 }]) {
      await assertFreeSpace(root);
      const filters = [`trim=start=${start}:end=${end}`, "setpts=PTS-STARTPTS", ...(settings.removeWatermark ? [`delogo=x=${logo.x}:y=${logo.y}:w=${logo.w}:h=${logo.h}`] : [])];
      const { staged, frames, bytes, fps, quality } = await encodeVariant(video, temporary, root, filters, end - start, variant);
      const first = await sharp(await readFile(path.join(staged, frames[0]))).metadata();
      const last = await readFile(path.join(staged, frames[frames.length - 1]));
      variants.push({ ...variant, quality, staged, frameCount: frames.length, width: first.width!, height: first.height!, fps, bytes, similarity: 1 - difference(await grayImage(last), await grayImage(target)) });
      await db.scene.updateMany({ where: { id: scene.id, leaseOwner: owner }, data: { progress: variant.suffix ? 90 : 65 } });
    }
    const desktop = variants[0], mobile = variants[1];
    const similarity = desktop.similarity;
    const warning = similarity < 0.89 ? `The final frame differs from the target (${Math.round(similarity * 100)}% grayscale similarity). Check the trim or regenerate before publishing.` : scene.trimStart !== null || scene.trimEnd !== null ? null : automatic.warning;
    const sequencePath = `properties/${property.slug}/sequences/${scene.key}`;
    let scrollLength = scene.key === "hero-to-plan" ? 3420 : 2200;
    try {
      const object = await storage.get(`${scene.sequencePath ?? sequencePath}/manifest.json`);
      const previous = JSON.parse(new TextDecoder().decode(object.body)) as { scrollLength?: number };
      if (typeof previous.scrollLength === "number" && previous.scrollLength > 0) scrollLength = previous.scrollLength;
    } catch { /* First extraction. */ }
    const manifest = { version: 1, pad: 4, ext: "webp", scrollLength, trimStart: start, trimEnd: end, revision: randomUUID(), desktop: { frameCount: desktop.frameCount, width: desktop.width, height: desktop.height, fps: desktop.fps, bytes: desktop.bytes }, mobile: { frameCount: mobile.frameCount, width: mobile.width, height: mobile.height, fps: mobile.fps, bytes: mobile.bytes } };
    await writeFile(path.join(desktop.staged, "manifest.json"), JSON.stringify(manifest, null, 2));
    if (!await db.scene.findFirst({ where: { id: scene.id, leaseOwner: owner, status: "extracting" } })) throw new Error("Scene changed while extracting. Original frames were retained.");
    for (const variant of variants) {
      const targetDir = path.dirname(await storage.filePath(`${sequencePath}${variant.suffix}/frame_0001.webp`));
      if (!targetDir.startsWith(root + path.sep) || !variant.staged.startsWith(temporary + path.sep)) throw new Error("Unsafe frame destination.");
      await mkdir(path.dirname(targetDir), { recursive: true });
      const transaction = { target: targetDir, backup: path.join(temporary, variant.suffix ? "previous-mobile" : "previous-desktop"), staged: variant.staged, old: false, moved: false }; transactions.push(transaction);
      if (await exists(targetDir)) { await rename(targetDir, transaction.backup); transaction.old = true; }
      await rename(variant.staged, targetDir); transaction.moved = true;
    }
    await db.$transaction(async (tx) => {
      const previous = analysisSchema.safeParse(scene.analysis);
      const updated = await tx.scene.updateMany({ where: { id: scene.id, leaseOwner: owner, status: "extracting" }, data: { sequencePath, status: warning ? "needs_review" : "ready", progress: 100, error: warning, frameCount: desktop.frameCount, mobileFrameCount: mobile.frameCount, trimStart: start, trimEnd: end, duration: metadata.duration, analysis: { ...metadata, autoStart: automatic.start, autoEnd: automatic.end, similarity, warning, qcApprovals: previous.success ? previous.data.qcApprovals : [] }, leaseOwner: null, leaseExpiresAt: null, nextAttemptAt: null } });
      if (!updated.count) throw new Error("Scene changed before extraction could commit.");
      const pending = await tx.scene.count({ where: { propertyId: property.id, status: { not: "ready" } } });
      await tx.property.update({ where: { id: property.id }, data: { status: pending ? "processing" : "draft" } });
    });
    committed = true;
  } finally {
    if (!committed) for (const transaction of transactions.toReversed()) {
      if (transaction.moved) await rename(transaction.target, transaction.staged);
      if (transaction.old) await rename(transaction.backup, transaction.target);
    }
    if (path.dirname(temporary) === privateRoot && path.basename(temporary).startsWith("extract-")) await rm(temporary, { recursive: true, force: true, maxRetries: 3 });
  }
}
