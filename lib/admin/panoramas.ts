import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { mediaUrl, storage } from "@/lib/storage";
import { panoLinkSchema, type PanoSnapshot } from "@/lib/panorama";
import { AdminError } from "./http";

async function snapshot(propertyId: string, tx: Prisma.TransactionClient = db): Promise<PanoSnapshot> {
  const rows = await tx.panoNode.findMany({ where: { room: { propertyId } }, orderBy: { id: "asc" } });
  const ids = new Set(rows.map((node) => node.id));
  return { revision: createHash("sha256").update(JSON.stringify(rows)).digest("hex"), nodes: rows.map(({ id, roomId, name, image, planX, planY, startYaw, links }) => ({ id, roomId, name, image: mediaUrl(image), planX, planY, startYaw, links: panoLinkSchema.array().parse(links ?? []).filter((link) => ids.has(link.toNodeId)) })) };
}
export async function getPanoramas(propertyId: string) {
  if (!await db.property.findUnique({ where: { id: propertyId }, select: { id: true } })) throw new AdminError("Property not found.", 404);
  return snapshot(propertyId);
}
export async function savePanoramas(propertyId: string, input: PanoSnapshot) {
  for (const node of input.nodes) {
    const key = node.image.slice("/media/".length);
    if (!key.startsWith(`properties/${propertyId}/panoramas/`) || key.split("/").length !== 4 || !/\/panoramas\/[a-f0-9-]{36}\.webp$/.test(key)) throw new AdminError("Choose a panorama uploaded to this property.");
    await storage.get(key).catch(() => { throw new AdminError("This panorama is missing. Upload it again."); });
  }
  return db.$transaction(async (tx) => {
    const property = await tx.property.findUnique({ where: { id: propertyId }, select: { rooms: { select: { id: true } } } });
    if (!property) throw new AdminError("Property not found.", 404);
    if ((await snapshot(propertyId, tx)).revision !== input.revision) throw new AdminError("Viewpoints changed in another session. Reload before saving.", 409);
    for (const node of input.nodes) {
      if (!property.rooms.some((room) => room.id === node.roomId)) throw new AdminError("Choose a room in this property.");
      const owner = await tx.panoNode.findUnique({ where: { id: node.id }, select: { room: { select: { propertyId: true } } } });
      if (owner && owner.room.propertyId !== propertyId) throw new AdminError("Invalid viewpoint.");
      const data = { ...node, image: node.image.slice("/media/".length) };
      await tx.panoNode.upsert({ where: { id: node.id }, create: data, update: data });
    }
    await tx.panoNode.deleteMany({ where: { room: { propertyId }, id: { notIn: input.nodes.map((node) => node.id) } } });
    return snapshot(propertyId, tx);
  });
}
