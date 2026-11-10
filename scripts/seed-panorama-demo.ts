import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
dotenv.config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  // Import after env loading; the adapter and DB read their settings at import.
  const { db } = await import("../lib/db");
  const { storage } = await import("../lib/storage");
  const slug = "walkthrough-demo", propertyId = "pano_demo_property";
  try {
    const existing = await db.property.findFirst({ where: { OR: [{ slug }, { id: propertyId }] } });
    if (existing) {
      if (existing.slug !== slug || existing.id !== propertyId) throw new Error("The demo slug or ID belongs to another property; nothing was changed.");
      console.log(`Demo already exists at /${slug}; existing edits retained.`); return;
    }
    const source = await db.property.findUniqueOrThrow({ where: { slug: "aurelia" }, include: { units: true, rooms: true, scenes: true } });
    if (source.status !== "published") throw new Error("Keep Aurelia published while using its scroll assets in this test demo.");
    const rooms = ["living", "kitchen"].map((key) => { const room = source.rooms.find((item) => item.key === key); if (!room) throw new Error(`Seed Aurelia's ${key} room first.`); return room; });
    const scenes = source.scenes.filter((scene) => scene.key === "hero-to-plan" || rooms.some((room) => room.image === scene.toImage));
    if (scenes.length !== 3 || scenes.some((scene) => scene.status !== "ready")) throw new Error("The demo needs Aurelia's ready hero, living and kitchen sequences.");
    const ids = [randomUUID(), randomUUID()], roomIds = [randomUUID(), randomUUID()], keys: string[] = [];
    try {
      for (const room of rooms) {
        const key = `properties/${propertyId}/panoramas/${randomUUID()}.webp`;
        const original = await readFile(`assets/panoramas/test-${room.key}.webp`);
        const image = await sharp(original).resize({ width: 6000, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
        await storage.put(key, image); keys.push(key);
        const mobile = key.replace(/\.webp$/, "-mobile.webp"), retained = key.replace(/\.webp$/, "-original.webp");
        await storage.put(mobile, await sharp(image).resize({ width: 2048, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer()); keys.push(mobile);
        await storage.put(retained, original); keys.push(retained);
      }
      await db.property.create({ data: {
        id: propertyId, slug, name: "360° Test Walkthrough", tagline: "Labelled spherical test charts", location: "Interaction demo", status: "published", towerImage: source.towerImage, planImage: source.planImage,
        heroCopy: "A linked panorama demo", presentation: { brandName: "360° Test Tour", heroDescription: "Synthetic spherical grids for interaction testing. Scroll footage is reused from Aurelia; these are not real panoramic property photographs.", overviewTitle: "Two viewpoints, one connected tour", footerTagline: "Test assets · Not property photography" }, amenities: source.amenities ?? [],
        units: { create: source.units.slice(0, 1).map(({ name, beds, baths, sqft, price }) => ({ name, beds, baths, sqft, price })) },
        rooms: { create: rooms.map(({ key, label, image, description, hotspotX, hotspotY }, index) => ({ id: roomIds[index], key, label, image, description, hotspotX, hotspotY, order: index, nodes: { create: { id: ids[index], name: index ? "Kitchen test chart" : "Living test chart", image: keys[index * 3], planX: index ? 70 : 30, planY: index ? 40 : 60, startYaw: 0, links: [{ toNodeId: ids[1 - index], yaw: 0, pitch: -0.15, label: index ? "Living test chart" : "Kitchen test chart" }] } } })) },
        scenes: { create: scenes.map((scene) => ({ key: scene.key, fromImage: scene.fromImage, toImage: scene.toImage, prompt: scene.prompt, mode: "manual", status: "ready", progress: 100, frameCount: scene.frameCount, mobileFrameCount: scene.mobileFrameCount, sequencePath: scene.sequencePath ?? `properties/aurelia/sequences/${scene.key}` })) },
      } });
    } catch (error) { await Promise.allSettled(keys.map((key) => storage.delete(key))); throw error; }
    console.log(`Created /${slug}: two linked labelled test panoramas. Aurelia was not modified.`);
  } finally { await db.$disconnect(); }
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Unable to create the panorama demo."); process.exitCode = 1; });
