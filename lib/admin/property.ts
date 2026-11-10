import "server-only";
import { db } from "@/lib/db";
import { mediaUrl, storage } from "@/lib/storage";
import type { AdminProperty } from "./schema";
import { AdminError } from "./http";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { amenitySchema } from "@/lib/property-validation";
import { publicationReady, syncScenes } from "@/lib/jobs/derive";

export async function adminProperty(id: string): Promise<AdminProperty | null> {
  const p = await db.property.findUnique({ where: { id }, include: { units: { orderBy: { name: "asc" } }, rooms: { orderBy: { order: "asc" } } } });
  if (!p) return null;
  return { id: p.id, updatedAt: p.updatedAt.toISOString(), name: p.name, slug: p.slug, tagline: p.tagline ?? "", location: p.location ?? "", heroCopy: p.heroCopy ?? "", accentColor: p.accentColor ?? "#D8B67A", status: p.status as AdminProperty["status"], towerImage: p.towerImage ? mediaUrl(p.towerImage) : null, planImage: p.planImage ? mediaUrl(p.planImage) : null,
    units: p.units.map(({ id, name, beds, baths, sqft, price }) => ({ id, name, beds, baths, sqft, price })),
    rooms: p.rooms.map(({ id, key, label, description, image, hotspotX, hotspotY }) => ({ id, key, label, description: description ?? "", image: image ? mediaUrl(image) : null, hotspotX, hotspotY })),
    amenities: z.array(amenitySchema).parse(p.amenities ?? []),
  };
}
export async function saveProperty(input: AdminProperty) {
  const before = await db.property.findUnique({ where: { id: input.id }, include: { units: true, rooms: true, scenes: true } });
  if (!before) throw new AdminError("Property not found.", 404);
  if (input.status === "processing" && before.status !== "processing") throw new AdminError("Processing is controlled by video jobs.");
  const asKey = async (url: string | null) => {
    if (!url) return null;
    const key = url.slice("/media/".length);
    const oldImages = [before.towerImage, before.planImage, ...before.rooms.map((r) => r.image)];
    if (!key.startsWith(`properties/${before.id}/images/`) && !oldImages.includes(key)) throw new AdminError("Choose an image uploaded to this property.");
    await storage.get(key).catch(() => { throw new AdminError("An uploaded image is missing. Please upload it again."); });
    return key;
  };
  const towerImage = await asKey(input.towerImage), planImage = await asKey(input.planImage);
  const rooms = await Promise.all(input.rooms.map(async (r, order) => ({ ...r, image: await asKey(r.image), order })));
  await db.$transaction(async (tx) => {
    // An optimistic version check prevents late saves from silently overwriting another editor.
    const updated = await tx.property.updateMany({ where: { id: input.id, updatedAt: new Date(input.updatedAt) }, data: { name: input.name, slug: input.slug, tagline: input.tagline, location: input.location, heroCopy: input.heroCopy, accentColor: input.accentColor, status: input.status, towerImage, planImage, amenities: input.amenities, updatedAt: new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1)) } });
    if (!updated.count) throw new AdminError("This property changed in another session. Reload before saving.", 409);
    for (const unit of input.units) {
      const owner = await tx.unit.findUnique({ where: { id: unit.id }, select: { propertyId: true } });
      if (owner && owner.propertyId !== input.id) throw new AdminError("Invalid unit.");
      await tx.unit.upsert({ where: { id: unit.id }, create: { ...unit, propertyId: input.id }, update: { name: unit.name, beds: unit.beds, baths: unit.baths, sqft: unit.sqft, price: unit.price } });
    }
    await tx.unit.deleteMany({ where: { propertyId: input.id, id: { notIn: input.units.map((u) => u.id) } } });
    for (const room of rooms) {
      const owner = await tx.room.findUnique({ where: { id: room.id }, select: { propertyId: true } });
      if (owner && owner.propertyId !== input.id) throw new AdminError("Invalid room.");
      await tx.room.upsert({ where: { id: room.id }, create: { ...room, propertyId: input.id }, update: room });
    }
    await tx.room.deleteMany({ where: { propertyId: input.id, id: { notIn: rooms.map((r) => r.id) } } });
    // Preserve Aurelia's per-unit variants until room membership/placement is actually edited.
    const changed = rooms.length !== before.rooms.length || rooms.some((r) => { const old = before.rooms.find((o) => o.id === r.id); return !old || old.key !== r.key || old.order !== r.order || old.hotspotX !== r.hotspotX || old.hotspotY !== r.hotspotY; });
    if (changed) await tx.unit.updateMany({ where: { propertyId: input.id }, data: { roomSettings: Prisma.DbNull } });
    for (const scene of before.scenes) {
      const room = before.rooms.find((r) => r.image === scene.toImage);
      const nextRoom = rooms.find((r) => r.id === room?.id);
      const stale = scene.key === "hero-to-plan" ? scene.fromImage !== towerImage || scene.toImage !== planImage : scene.fromImage !== planImage || !nextRoom || nextRoom.image !== scene.toImage || nextRoom.key !== room?.key;
      if (stale && await tx.scene.findFirst({ where: { id: scene.id, status: { in: ["generating", "extracting"] } } })) throw new AdminError("Wait for active video jobs before replacing their source images or rooms.", 409);
      if (stale) await tx.scene.delete({ where: { id: scene.id } });
    }
    await syncScenes(input.id, tx);
    if (input.status === "published" && !await publicationReady(input.id, tx)) throw new AdminError("Every scene must be ready before publishing. Open Videos to upload or generate the missing sequences.");
  });
  return adminProperty(input.id);
}
