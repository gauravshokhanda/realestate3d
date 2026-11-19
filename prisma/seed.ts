import { loadEnvConfig } from "../scripts/runtime-env";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { databaseUrl } from "../lib/database-url";
import { LocalStorage } from "../lib/storage/local";
import { frameFolder, originalFolder } from "../lib/storage/layout";
import { amenities, scenes, units } from "./seed-data";

loadEnvConfig();
const db = new PrismaClient({ datasourceUrl: databaseUrl() });
const storage = new LocalStorage();
const prefix = originalFolder("aurelia", "aurelia");
const trims: Record<string, number> = { "hero-to-plan": 7.5, "plan-to-living": 5.8, "plan-to-kitchen": 6.8, "plan-to-bedroom": 6.6 };

async function seed() {
  if (await db.development.findUnique({ where: { slug: "aurelia" } })) {
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
  const videos = new Map<string, string>();
  for (const scene of scenes) {
    const videoPath = `${prefix}/videos/${scene.id}.mp4`;
    await storage.put(videoPath, await readFile(path.resolve("assets", "videos", `${scene.id}.mp4`)));
    videos.set(scene.id, videoPath);
  }
  const sceneTarget: Record<string, string> = { "hero-to-plan": images["floor-plan"], "plan-to-living": images["living-room"], "plan-to-kitchen": images.kitchen, "plan-to-bedroom": images["primary-bedroom"] };
  const [primary, alternate] = units;
  const details = ({ id, name, beds, baths, sqft, price, rooms }: typeof primary) => ({
    legacyUnitId: id, name, beds, baths, sqft, price,
    roomSettings: rooms.map((room) => ({ key: room.id, hotspotX: room.hotspot.x, hotspotY: room.hotspot.y })),
  });
  await db.development.create({ data: {
    id: "aurelia", slug: "aurelia", name: "Aurelia residences", status: "published",
    tagline: "An elevated way of living", buildingImage: images["tower-exterior"],
    properties: { create: [{
    ...details(primary), id: "aurelia", slug: "residence-a", status: "published",
    heroCopy: "Live above\nthe skyline", accentColor: "#D8B67A", planImage: images["floor-plan"],
    polygon: [{x: 0.42, y: 0.33}, {x: 0.58, y: 0.33}, {x: 0.58, y: 0.58}, {x: 0.42, y: 0.58}],
    focus: { cx: 0.5, cy: 0.455, w: 0.16, h: 0.25 },
    presentation: { brandName: "Aurelia", overviewTitle: "A new perspective", heroDescription: "Considered spaces. Open horizons. A home beyond the everyday.", footerTagline: "A new perspective on home" },
    amenities,
    rooms: { create: units[0].rooms.map((room, order) => ({ id: `aurelia-${room.id}`, key: room.id, label: room.label, image: room.id === "living" ? images["living-room"] : images[room.id], hotspotX: room.hotspot.x, hotspotY: room.hotspot.y, order })) },
    scenes: { create: scenes.map((scene) => ({ key: scene.id, fromImage: scene.id === "hero-to-plan" ? images["tower-exterior"] : images["floor-plan"], toImage: sceneTarget[scene.id], prompt: "Slow cinematic push-in, smooth continuous camera dolly, no cuts, no people, no text, stable lighting, photorealistic architectural visualization.", mode: "manual", status: "ready", progress: 100, sequencePath: frameFolder("aurelia", "residence-a", scene.id), scrollLength: scene.scrollLength, videoPath: videos.get(scene.id), settings: { removeWatermark: true }, trimStart: 0, trimEnd: trims[scene.id] })) },
    }, { ...details(alternate), slug: "residence-b", order: 1 }] },
  } });
  console.log("Published Aurelia at /aurelia. Seed can safely be rerun without overwriting edits.");
}

seed().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
