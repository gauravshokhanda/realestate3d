import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { scenePrompt } from "./prompts";

export async function syncScenes(propertyId: string, tx: Prisma.TransactionClient = db): Promise<void> {
  if (tx === db) return db.$transaction((transaction) => syncScenes(propertyId, transaction));
  const property = await tx.property.findUnique({ where: { id: propertyId }, include: { rooms: { orderBy: { order: "asc" } }, scenes: true } });
  if (!property) return;
  const expected: { key: string; fromImage: string; toImage: string; prompt: string }[] = [];
  if (property.towerImage && property.planImage) expected.push({ key: "hero-to-plan", fromImage: property.towerImage, toImage: property.planImage, prompt: scenePrompt() });
  for (const room of property.rooms) if (property.planImage && room.image) {
    // Keep migrated Aurelia's plan-to-bedroom key and approved footage intact.
    const existing = property.scenes.find((s) => s.key === `plan-to-${room.key}`) ?? property.scenes.find((s) => s.key !== "hero-to-plan" && !expected.some((item) => item.key === s.key) && s.toImage === room.image && s.fromImage === property.planImage);
    expected.push({ key: existing?.key ?? `plan-to-${room.key}`, fromImage: property.planImage, toImage: room.image, prompt: scenePrompt(room) });
  }
  for (const item of expected) {
    const previous = property.scenes.find((s) => s.key === item.key);
    if (!previous) await tx.scene.create({ data: { ...item, propertyId, mode: "manual", status: "queued" } });
    else if (previous.fromImage !== item.fromImage || previous.toImage !== item.toImage) await tx.scene.update({ where: { id: previous.id }, data: { fromImage: item.fromImage, toImage: item.toImage, status: "queued", mode: "manual", progress: 0, error: null, videoPath: null, operationName: null, sequencePath: null, frameCount: null, mobileFrameCount: null, trimStart: null, trimEnd: null, analysis: Prisma.DbNull, attempts: 0, leaseOwner: null, leaseExpiresAt: null } });
  }
  await tx.scene.deleteMany({ where: { propertyId, key: { notIn: expected.map((s) => s.key) } } });
}
export async function publicationReady(propertyId: string, tx: Prisma.TransactionClient = db) {
  const property = await tx.property.findUnique({ where: { id: propertyId }, include: { rooms: true, scenes: true } });
  return Boolean(property && property.rooms.length > 0 && property.scenes.length === property.rooms.length + 1 && property.scenes.every((scene) => scene.status === "ready"));
}
