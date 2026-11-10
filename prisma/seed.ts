import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { databaseUrl } from "../lib/database-url";
import { LocalStorage } from "../lib/storage/local";
import { manifestSchema } from "../lib/property-validation";
import { amenities, scenes, units } from "./seed-data";

const db = new PrismaClient({ datasourceUrl: databaseUrl() });
const storage = new LocalStorage();
const prefix = "properties/aurelia";
const trims: Record<string, number> = { "hero-to-plan": 7.5, "plan-to-living": 5.8, "plan-to-kitchen": 6.8, "plan-to-bedroom": 6.6 };

async function seed() {
  if (await db.property.findUnique({ where: { slug: "aurelia" } })) {
    console.log("Aurelia already exists; seed left its database records and media unchanged.");
    return;
  }
  const images: Record<string, string> = {};
  for (const name of ["tower-exterior", "floor-plan", "living-room", "kitchen", "primary-bedroom"]) {
    const original = await readFile(path.resolve("assets", "stills", `${name}.png`));
    const webp = await sharp(original).rotate().resize({ width: 6000, height: 6000, fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
    await storage.put(`${prefix}/images/${name}-original.png`, original);
    images[name] = `${prefix}/images/${name}.webp`;
    await storage.put(images[name], webp);
  }
  for (const scene of scenes) {
    const variants = [];
    for (const suffix of ["", "-mobile"]) {
      const source = path.resolve("public", "sequences", scene.id + suffix);
      const files = (await readdir(source)).filter((name) => /^frame_\d+\.webp$/.test(name)).sort();
      const expected = suffix ? scene.mobileFrameCount : scene.frameCount;
      if (files.length !== expected) throw new Error(`Unexpected frame count for ${scene.id}${suffix}: ${files.length}, expected ${expected}`);
      for (let index = 0; index < files.length; index++) {
        if (files[index] !== `frame_${String(index + 1).padStart(4, "0")}.webp`) throw new Error(`Missing frame in ${scene.id}${suffix}`);
        await storage.put(`${prefix}/sequences/${scene.id}${suffix}/${files[index]}`, await readFile(path.join(source, files[index])));
      }
      const { width, height } = await sharp(path.join(source, files[0])).metadata();
      variants.push({ frameCount: files.length, width, height });
    }
    const manifest = manifestSchema.parse({ version: 1, pad: 4, ext: "webp", scrollLength: scene.scrollLength, trimStart: 0, trimEnd: trims[scene.id], desktop: variants[0], mobile: variants[1] });
    await storage.put(`${prefix}/sequences/${scene.id}/manifest.json`, Buffer.from(JSON.stringify(manifest, null, 2)));
    console.log(`Migrated ${scene.id}: ${manifest.desktop.frameCount} desktop / ${manifest.mobile?.frameCount} mobile frames (unchanged bytes).`);
  }
  const sceneTarget: Record<string, string> = { "hero-to-plan": images["floor-plan"], "plan-to-living": images["living-room"], "plan-to-kitchen": images.kitchen, "plan-to-bedroom": images["primary-bedroom"] };
  await db.property.create({ data: {
    id: "aurelia", slug: "aurelia", name: "Aurelia residences", status: "published",
    tagline: "An elevated way of living", heroCopy: "Live above\nthe skyline", accentColor: "#D8B67A",
    towerImage: images["tower-exterior"], planImage: images["floor-plan"],
    presentation: { brandName: "Aurelia", overviewTitle: "A new perspective", heroDescription: "Considered spaces. Open horizons. A home beyond the everyday.", footerTagline: "A new perspective on home" },
    amenities,
    units: { create: units.map((unit) => ({ id: unit.id, name: unit.name, beds: unit.beds, baths: unit.baths, sqft: unit.sqft, price: unit.price, roomSettings: unit.rooms.map((room) => ({ key: room.id, hotspotX: room.hotspot.x, hotspotY: room.hotspot.y })) })) },
    rooms: { create: units[0].rooms.map((room, order) => ({ id: `aurelia-${room.id}`, key: room.id, label: room.label, image: room.id === "living" ? images["living-room"] : images[room.id], hotspotX: room.hotspot.x, hotspotY: room.hotspot.y, order })) },
    scenes: { create: scenes.map((scene) => ({ key: scene.id, fromImage: scene.id === "hero-to-plan" ? images["tower-exterior"] : images["floor-plan"], toImage: sceneTarget[scene.id], prompt: "Slow cinematic push-in, smooth continuous camera dolly, no cuts, no people, no text, stable lighting, photorealistic architectural visualization.", mode: "manual", status: "ready", progress: 100, frameCount: scene.frameCount, mobileFrameCount: scene.mobileFrameCount, trimStart: 0, trimEnd: trims[scene.id] })) },
  } });
  console.log("Published Aurelia at /aurelia. Seed can safely be rerun without overwriting edits.");
}

seed().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
