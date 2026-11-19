import "server-only";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/storage";
import { amenitySchema, presentationSchema, roomSettingsSchema, slugSchema } from "@/lib/property-validation";
import type { PropertyView } from "@/lib/property-types";
import type { Scene } from "@/data/scenes";
import { readFrames } from "@/lib/storage/frames";
import { mobilePanorama, panoLinkSchema } from "@/lib/panorama";

export const getPublishedDevelopment = cache(async (slug: string) => {
  if (!slugSchema.safeParse(slug).success) return null;
  return db.development.findFirst({
    where: { slug, status: "published" },
    select: { name: true, properties: { where: { status: "published" }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { slug: true, name: true, price: true } } },
  });
});

export const getPropertyBySlug = cache(async (slug: string, propertySlug?: string): Promise<PropertyView | null> => {
  const development = await getPublishedDevelopment(slug);
  const residence = propertySlug ?? (development?.properties.length === 1 ? development.properties[0].slug : null);
  if (!development || !residence || !slugSchema.safeParse(residence).success) return null;
  const property = await db.property.findFirst({
    where: { slug: residence, status: "published", development: { slug, status: "published" } },
    include: { development: { include: { properties: { where: { legacyUnitId: { not: null } }, orderBy: { name: "asc" } } } }, rooms: { orderBy: { order: "asc" }, include: { nodes: { orderBy: { id: "asc" } } } }, scenes: true },
  });
  if (!property) return null;
  const { development: parent } = property;
  const towerImage = parent.buildingImage;
  const legacyTour = property.id === parent.id;
  const tourName = legacyTour ? parent.name : property.name;
  const scenes: Scene[] = (await Promise.all(property.scenes.filter((scene) => ["ready", "rebuild_queued", "rebuilding"].includes(scene.status)).map(async (scene) => {
    const folder = scene.sequencePath;
    const frames = await readFrames(folder);
    if (!folder || !frames) return null;
    const { manifest, revision } = frames;
    return { id: scene.key, folder: mediaUrl(folder), revision, frameCount: manifest.desktop.frameCount, mobileFolder: manifest.mobile ? mediaUrl(folder + "-mobile") : undefined, mobileFrameCount: manifest.mobile?.frameCount, pad: manifest.pad, ext: manifest.ext, scrollLength: manifest.scrollLength };
  }))).filter((scene): scene is NonNullable<typeof scene> => scene !== null);
  // Still-only properties are publishable before Phase C adds video generation.
  const stillScene = (id: string, images: string[]) => ({ id, folder: "", frameCount: images.length, stillFrames: images.map(mediaUrl), pad: 4, ext: "webp" as const, scrollLength: id === "hero-to-plan" ? 2400 : 1000 });
  if (!scenes.some((scene) => scene.id === "hero-to-plan") && towerImage && property.planImage) scenes.push(stillScene("hero-to-plan", [towerImage, property.planImage]));
  for (const room of property.rooms) if (room.image && !scenes.some((scene) => scene.id === `plan-to-${room.key}` || property.scenes.some((item) => item.key === scene.id && item.toImage === room.image && item.key !== "hero-to-plan"))) scenes.push(stillScene(property.scenes.find((scene) => scene.key !== "hero-to-plan" && scene.toImage === room.image)?.key ?? `plan-to-${room.key}`, [room.image]));
  const rooms = property.rooms.map((room) => ({ id: room.key, label: room.label, sequence: property.scenes.find((scene) => scene.key === `plan-to-${room.key}`)?.key ?? property.scenes.find((scene) => scene.toImage === room.image && scene.key !== "hero-to-plan")?.key ?? `plan-to-${room.key}`, hotspot: { x: room.hotspotX, y: room.hotspotY } }));
  const residences = legacyTour && parent.properties.length ? parent.properties : [property];
  const units = residences.map((unit) => {
    const settings = unit.roomSettings ? roomSettingsSchema.parse(unit.roomSettings) : null;
    return { id: unit.legacyUnitId ?? unit.id, name: unit.name, beds: unit.beds ?? 0, baths: unit.baths ?? 0, sqft: unit.sqft ?? 0, price: unit.price ?? "Price on request", floorPlanSequence: "hero-to-plan", rooms: settings ? settings.flatMap((setting) => {
      const room = rooms.find((candidate) => candidate.id === setting.key);
      return room ? [{ ...room, hotspot: { x: setting.hotspotX, y: setting.hotspotY } }] : [];
    }) : rooms };
  });
  const presentation = presentationSchema.parse(property.presentation ?? {});
  return {
    id: property.id, slug: parent.slug, name: tourName, brandName: presentation.brandName ?? tourName,
    tagline: parent.tagline, location: parent.location, heroCopy: property.heroCopy,
    heroDescription: presentation.heroDescription ?? null, overviewTitle: presentation.overviewTitle ?? null,
    footerTagline: presentation.footerTagline ?? null,
    accentColor: /^#[0-9a-f]{6}$/i.test(property.accentColor ?? "") ? property.accentColor! : "#D8B67A",
    towerImage: towerImage ? mediaUrl(towerImage) : null,
    planImage: property.planImage ? mediaUrl(property.planImage) : null,
    units, rooms, scenes, amenities: z.array(amenitySchema).parse(property.amenities ?? []),
    panoramas: property.rooms.flatMap((room) => room.nodes.map((node) => ({ id: node.id, roomId: room.key, roomLabel: room.label, name: node.name, image: mediaUrl(node.image), mobileImage: mobilePanorama(mediaUrl(node.image)), planX: node.planX, planY: node.planY, startYaw: node.startYaw, links: panoLinkSchema.array().parse(node.links ?? []).filter((link) => property.rooms.some((r) => r.nodes.some((n) => n.id === link.toNodeId))) }))),
  };
});

export async function getPublishedProperties() {
  const developments = await db.development.findMany({
    where: { status: "published", properties: { some: { status: "published" } } },
    orderBy: { name: "asc" },
    select: { slug: true, name: true, tagline: true, location: true, buildingImage: true, properties: { where: { status: "published" }, orderBy: { order: "asc" }, select: { slug: true, price: true } } },
  });
  return developments.map((development) => ({ ...development, towerImage: development.buildingImage ? mediaUrl(development.buildingImage) : null, price: development.properties[0]?.price ?? null }));
}
