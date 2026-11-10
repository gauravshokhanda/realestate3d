import "server-only";
import { cache } from "react";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { storage, mediaUrl } from "@/lib/storage";
import { amenitySchema, manifestSchema, presentationSchema, roomSettingsSchema, slugSchema } from "@/lib/property-validation";
import type { PropertyView } from "@/lib/property-types";
import type { Scene } from "@/data/scenes";
import { mobilePanorama, panoLinkSchema } from "@/lib/panorama";

export const getPropertyBySlug = cache(async (slug: string): Promise<PropertyView | null> => {
  if (!slugSchema.safeParse(slug).success) return null;
  const property = await db.property.findFirst({ where: { slug, status: "published" }, include: { units: { orderBy: { name: "asc" } }, rooms: { orderBy: { order: "asc" }, include: { nodes: { orderBy: { id: "asc" } } } }, scenes: true } });
  if (!property) return null;
  const scenes: Scene[] = await Promise.all(property.scenes.filter((scene) => scene.status === "ready").map(async (scene) => {
    const prefix = scene.fromImage.split("/images/")[0];
    let folder = scene.sequencePath ?? `properties/${property.slug}/sequences/${scene.key}`;
    let object;
    try { object = await storage.get(`${folder}/manifest.json`); }
    catch (error) {
      if (prefix === `properties/${property.slug}`) throw error;
      folder = `${prefix}/sequences/${scene.key}`;
      object = await storage.get(`${folder}/manifest.json`);
    }
    const manifest = manifestSchema.parse(JSON.parse(new TextDecoder().decode(object.body)));
    const revision = manifest.revision ?? createHash("sha256").update(object.body).digest("hex").slice(0, 16);
    return { id: scene.key, folder: mediaUrl(folder), revision, frameCount: manifest.desktop.frameCount, mobileFolder: manifest.mobile ? mediaUrl(folder + "-mobile") : undefined, mobileFrameCount: manifest.mobile?.frameCount, pad: manifest.pad, ext: manifest.ext, scrollLength: manifest.scrollLength };
  }));
  // Still-only properties are publishable before Phase C adds video generation.
  const stillScene = (id: string, images: string[]) => ({ id, folder: "", frameCount: images.length, stillFrames: images.map(mediaUrl), pad: 4, ext: "webp" as const, scrollLength: id === "hero-to-plan" ? 2400 : 1000 });
  if (!scenes.some((scene) => scene.id === "hero-to-plan") && property.towerImage && property.planImage) scenes.push(stillScene("hero-to-plan", [property.towerImage, property.planImage]));
  for (const room of property.rooms) if (room.image && !scenes.some((scene) => scene.id === `plan-to-${room.key}` || property.scenes.some((item) => item.key === scene.id && item.toImage === room.image && item.key !== "hero-to-plan"))) scenes.push(stillScene(`plan-to-${room.key}`, [room.image]));
  const rooms = property.rooms.map((room) => ({ id: room.key, label: room.label, sequence: property.scenes.find((scene) => scene.key === `plan-to-${room.key}`)?.key ?? property.scenes.find((scene) => scene.toImage === room.image && scene.key !== "hero-to-plan")?.key ?? `plan-to-${room.key}`, hotspot: { x: room.hotspotX, y: room.hotspotY } }));
  const units = property.units.map((unit) => {
    const settings = unit.roomSettings ? roomSettingsSchema.parse(unit.roomSettings) : null;
    return { id: unit.id, name: unit.name, beds: unit.beds, baths: unit.baths, sqft: unit.sqft, price: unit.price, floorPlanSequence: "hero-to-plan", rooms: settings ? settings.flatMap((setting) => {
      const room = rooms.find((candidate) => candidate.id === setting.key);
      return room ? [{ ...room, hotspot: { x: setting.hotspotX, y: setting.hotspotY } }] : [];
    }) : rooms };
  });
  const presentation = presentationSchema.parse(property.presentation ?? {});
  return {
    id: property.id, slug: property.slug, name: property.name, brandName: presentation.brandName ?? property.name,
    tagline: property.tagline, location: property.location, heroCopy: property.heroCopy,
    heroDescription: presentation.heroDescription ?? null, overviewTitle: presentation.overviewTitle ?? null,
    footerTagline: presentation.footerTagline ?? null,
    accentColor: /^#[0-9a-f]{6}$/i.test(property.accentColor ?? "") ? property.accentColor! : "#D8B67A",
    towerImage: property.towerImage ? mediaUrl(property.towerImage) : null,
    planImage: property.planImage ? mediaUrl(property.planImage) : null,
    units, rooms, scenes, amenities: z.array(amenitySchema).parse(property.amenities ?? []),
    panoramas: property.rooms.flatMap((room) => room.nodes.map((node) => ({ id: node.id, roomId: room.key, roomLabel: room.label, name: node.name, image: mediaUrl(node.image), mobileImage: mobilePanorama(mediaUrl(node.image)), planX: node.planX, planY: node.planY, startYaw: node.startYaw, links: panoLinkSchema.array().parse(node.links ?? []).filter((link) => property.rooms.some((r) => r.nodes.some((n) => n.id === link.toNodeId))) }))),
  };
});

export async function getPublishedProperties() {
  const properties = await db.property.findMany({ where: { status: "published" }, orderBy: { name: "asc" }, select: { slug: true, name: true, tagline: true, location: true, towerImage: true, units: { select: { price: true }, orderBy: { name: "asc" }, take: 1 } } });
  return properties.map((property) => ({ ...property, towerImage: property.towerImage ? mediaUrl(property.towerImage) : null, price: property.units[0]?.price ?? null }));
}
