import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], quiet: true });
import { readFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "../lib/database-url";
import { LocalStorage } from "../lib/storage/local";
import { probeVideo } from "../lib/jobs/ffmpeg";

async function main() {
  const db = new PrismaClient({ datasourceUrl: databaseUrl() });
  const storage = new LocalStorage();
  try {
    const property = await db.property.findUnique({ where: { slug: "aurelia" }, include: { scenes: true } });
    if (!property) return;
    for (const scene of property.scenes) {
      if (scene.videoPath || scene.status !== "ready" || !["hero-to-plan", "plan-to-living", "plan-to-kitchen", "plan-to-bedroom"].includes(scene.key)) continue;
      const source = `assets/videos/${scene.key}.mp4`;
      try { await access(source); } catch { console.log(`No legacy source MP4 for ${scene.key}; existing frames preserved.`); continue; }
      const bytes = await readFile(source);
      const metadata = await probeVideo(source);
      const key = `properties/${property.id}/videos/${scene.key}-${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.mp4`;
      await storage.put(key, bytes);
      await db.scene.updateMany({ where: { id: scene.id, videoPath: null, status: "ready" }, data: { videoPath: key, duration: metadata.duration, ...(scene.settings === null ? { settings: { removeWatermark: true, delogo: { x: 1130, y: 569, w: 62, h: 64 } } } : {}) } });
      console.log(`Attached ${scene.key} source for preview/download; existing frames and publication preserved.`);
    }
  } finally { await db.$disconnect(); }
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Legacy video attachment failed."); process.exitCode = 1; });
