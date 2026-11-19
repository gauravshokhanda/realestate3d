import "server-only";
import { db } from "@/lib/db";
import { mediaUrl, storage } from "@/lib/storage";
import { slugify, type AdminProperty } from "./schema";
import { AdminError } from "./http";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { amenitySchema, slugSchema } from "@/lib/property-validation";
import { publicationReady, syncScenes } from "@/lib/jobs/derive";

export async function adminProperty(id: string): Promise<AdminProperty | null> {
  const p = await db.property.findUnique({ where: { id }, include: { development: { include: { properties: { where: { legacyUnitId: { not: null } }, orderBy: { name: "asc" } } } }, rooms: { orderBy: { order: "asc" } } } });
  if (!p) return null;
  const parent = p.development;
  const units = p.id === parent.id ? parent.properties : (p.sqft === null ? [] : [p]);
  return { id: p.id, updatedAt: p.updatedAt.toISOString(), name: parent.name, slug: parent.slug, tagline: parent.tagline ?? "", location: parent.location ?? "", heroCopy: p.heroCopy ?? "", accentColor: p.accentColor ?? "#D8B67A", status: p.status as AdminProperty["status"], towerImage: parent.buildingImage ? mediaUrl(parent.buildingImage) : null, planImage: p.planImage ? mediaUrl(p.planImage) : null,
    units: units.map((unit) => ({ id: unit.legacyUnitId ?? unit.id, name: unit.name, beds: unit.beds ?? 0, baths: unit.baths ?? 0, sqft: unit.sqft ?? 1, price: unit.price ?? "Price on request" })),
    rooms: p.rooms.map(({ id, key, label, description, image, hotspotX, hotspotY }) => ({ id, key, label, description: description ?? "", image: image ? mediaUrl(image) : null, hotspotX, hotspotY })),
    amenities: z.array(amenitySchema).parse(p.amenities ?? []),
  };
}
export async function saveProperty(input: AdminProperty) {
  const before = await db.property.findUnique({ where: { id: input.id }, include: { development: { include: { properties: { orderBy: { order: "asc" }, include: { _count: { select: { rooms: true, scenes: true, leads: true } } } } } }, rooms: true, scenes: true } });
  if (!before) throw new AdminError("Property not found.", 404);
  if (input.status === "processing" && before.status !== "processing") throw new AdminError("Processing is controlled by video jobs.");
  const asKey = async (url: string | null) => {
    if (!url) return null;
    const key = url.slice("/media/".length);
    const oldImages = [before.development.buildingImage, before.planImage, ...before.rooms.map((r) => r.image)];
    if (!(key.split("/")[0] === "originals" && key.split("/")[2] === before.id && key.split("/")[3] === "images" && key.split("/").length === 5) && !oldImages.includes(key)) throw new AdminError("Choose an image uploaded to this property.");
    await storage.get(key).catch(() => { throw new AdminError("An uploaded image is missing. Please upload it again."); });
    return key;
  };
  const towerImage = await asKey(input.towerImage), planImage = await asKey(input.planImage);
  const rooms = await Promise.all(input.rooms.map(async (r, order) => ({ ...r, image: await asKey(r.image), order })));
  await db.$transaction(async (tx) => {
    // An optimistic version check prevents late saves from silently overwriting another editor.
    const parent = before.development;
    const { units } = input;
    const primary = units.find((unit) => unit.id === before.legacyUnitId) ?? units[0];
    const { id: primaryUnitId, ...specs } = primary ?? { id: null, name: input.name, beds: null, baths: null, sqft: null, price: null };
    if (primaryUnitId && primaryUnitId !== before.legacyUnitId) {
      const sibling = parent.properties.find((property) => property.id !== before.id && property.legacyUnitId === primaryUnitId);
      if (sibling) {
        if (sibling.status !== "draft" || sibling.planImage || sibling.polygon || sibling.theme || sibling._count.rooms || sibling._count.scenes || sibling._count.leads) throw new AdminError("Keep the primary residence while another residence has its own tour or map.");
        await tx.property.delete({ where: { id: sibling.id } });
      }
    }
    const legacyUnitId = primaryUnitId === input.id ? null : primaryUnitId;
    const updated = await tx.property.updateMany({ where: { id: input.id, updatedAt: new Date(input.updatedAt) }, data: { ...specs, legacyUnitId, heroCopy: input.heroCopy, accentColor: input.accentColor, status: input.status, planImage, amenities: input.amenities, updatedAt: new Date(Math.max(Date.now(), before.updatedAt.getTime() + 1)) } });
    if (!updated.count) throw new AdminError("This property changed in another session. Reload before saving.", 409);
    await tx.development.update({ where: { id: parent.id }, data: {
      name: input.name, slug: input.slug, tagline: input.tagline, location: input.location, buildingImage: towerImage,
      status: await tx.property.count({ where: { developmentId: parent.id, status: "published" } }) ? "published" : "draft",
    } });
    if (before.id === parent.id) {
      const deleted = parent.properties.filter((property) => property.id !== before.id && property.legacyUnitId && !units.some((unit) => unit.id === property.legacyUnitId));
      for (const property of deleted) {
        if (property.status !== "draft" || property.planImage || property.polygon || property.theme || property._count.rooms || property._count.scenes || property._count.leads) {
          throw new AdminError("This residence has related content and cannot be removed in Units.");
        }
        await tx.property.delete({ where: { id: property.id } });
      }
      const slugs = new Set(parent.properties.map((property) => property.slug));
      for (const [index, { id, ...details }] of units.entries()) {
        if (id === primaryUnitId) continue;
        const sibling = parent.properties.find((property) => property.legacyUnitId === id);
        if (sibling) await tx.property.update({ where: { id: sibling.id }, data: { ...details, order: index + 1 } });
        else {
          const base = slugify(details.name).slice(0, 70).replace(/-$/, "");
          let slug = base || "residence";
          for (let suffix = 2; slugs.has(slug) || !slugSchema.safeParse(slug).success; suffix++) slug = `${base || "residence"}-${suffix}`;
          slugs.add(slug);
          await tx.property.create({ data: { ...details, developmentId: parent.id, legacyUnitId: id, slug, order: index + 1 } });
        }
      }
    }
    for (const room of rooms) {
      const owner = await tx.room.findUnique({ where: { id: room.id }, select: { propertyId: true } });
      if (owner && owner.propertyId !== input.id) throw new AdminError("Invalid room.");
      await tx.room.upsert({ where: { id: room.id }, create: { ...room, propertyId: input.id }, update: room });
    }
    await tx.room.deleteMany({ where: { propertyId: input.id, id: { notIn: rooms.map((r) => r.id) } } });
    // Preserve Aurelia's per-unit variants until room membership/placement is actually edited.
    const changed = rooms.length !== before.rooms.length || rooms.some((r) => { const old = before.rooms.find((o) => o.id === r.id); return !old || old.key !== r.key || old.order !== r.order || old.hotspotX !== r.hotspotX || old.hotspotY !== r.hotspotY; });
    if (changed || before.legacyUnitId !== legacyUnitId) {
      const variants = before.id === parent.id ? { OR: [{ id: before.id }, { legacyUnitId: { not: null } }] } : { id: before.id };
      await tx.property.updateMany({ where: { developmentId: before.developmentId, ...variants }, data: { roomSettings: Prisma.DbNull } });
    }
    for (const scene of before.scenes) {
      const room = before.rooms.find((r) => r.image === scene.toImage);
      const nextRoom = rooms.find((r) => r.id === room?.id);
      const stale = scene.key === "hero-to-plan" ? scene.fromImage !== towerImage || scene.toImage !== planImage : scene.fromImage !== planImage || !nextRoom || nextRoom.image !== scene.toImage || nextRoom.key !== room?.key;
      if (stale && await tx.scene.findFirst({ where: { id: scene.id, status: { in: ["generating", "extracting", "rebuild_queued", "rebuilding"] } } })) throw new AdminError("Wait for active video jobs before replacing their source images or rooms.", 409);
      if (stale) await tx.scene.delete({ where: { id: scene.id } });
    }
    await syncScenes(input.id, tx);
    if (input.status === "published" && !await publicationReady(input.id, tx)) throw new AdminError("Every scene must be ready before publishing. Open Videos to upload or generate the missing sequences.");
  });
  return adminProperty(input.id);
}
