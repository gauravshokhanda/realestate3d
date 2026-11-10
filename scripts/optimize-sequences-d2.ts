import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { assertFreeSpace } from "../lib/storage/disk";
import { manifestSchema } from "../lib/property-validation";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const root = path.resolve(process.env.STORAGE_DIR || "storage");
const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const mapped = new Map<string, { folder: string; desktopBytes: number; mobileBytes: number }>();
const report: { property: string; scene: string; source: string; folder: string; desktopBytes: number; mobileBytes: number }[] = [];
async function main() {
try {
  await assertFreeSpace(root);
  for (const scene of await db.scene.findMany({ where: { status: "ready" }, include: { property: true } })) {
    const input = scene.sequencePath ?? `properties/${scene.property.slug}/sequences/${scene.key}`;
    if (!mapped.has(input)) {
      const manifest = manifestSchema.parse(JSON.parse(await readFile(path.join(root, input, "manifest.json"), "utf8")));
      const revision = randomUUID(), folder = `properties/${scene.property.slug}/sequences-d2/${scene.key}-${revision.slice(0, 8)}`;
      const variants = [];
      for (const mobile of [false, true]) {
        await assertFreeSpace(root);
        const variant = mobile ? manifest.mobile : manifest.desktop; if (!variant) throw new Error("Both variants are required");
        const source = path.join(root, input + (mobile ? "-mobile" : "")), target = path.join(root, folder + (mobile ? "-mobile" : ""));
        await mkdir(target, { recursive: true });
        const files = (await readdir(source)).filter((f) => /^frame_\d{4}\.webp$/.test(f)).sort();
        if (files.length !== variant.frameCount) throw new Error("Source manifest/frame count mismatch");
        let sourceBytes = 0; for (const file of files) sourceBytes += (await stat(path.join(source, file))).size;
        const width = Math.min(variant.width, mobile ? 640 : 1280), limit = (mobile ? 3 : 8) * 1048576;
        let quality = mobile ? 65 : 72, bytes = 0;
        for (let attempt = 0; attempt < 6; attempt++) {
          bytes = 0;
          for (const file of files) {
            const data = await readFile(path.join(source, file));
            const copy = !mobile && variant.width <= 1280 && sourceBytes <= limit && attempt === 0;
            const output = copy ? data : await sharp(data).resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer();
            await writeFile(path.join(target, file), output); bytes += output.length;
          }
          if (bytes <= limit) break; quality -= 8;
        }
        if (bytes > limit) throw new Error("Existing sequence exceeds its byte budget after quality tuning; source and DB retained");
        const metadata = await sharp(await readFile(path.join(target, files[0]))).metadata();
        variants.push({ ...variant, width: metadata.width!, height: metadata.height!, bytes, quality });
      }
      await writeFile(path.join(root, folder, "manifest.json"), JSON.stringify({ ...manifest, revision, desktop: variants[0], mobile: variants[1] }, null, 2));
      mapped.set(input, { folder, desktopBytes: variants[0].bytes, mobileBytes: variants[1].bytes });
    }
    const result = mapped.get(input)!;
    await db.scene.update({ where: { id: scene.id }, data: { sequencePath: result.folder } });
    report.push({ property: scene.property.slug, scene: scene.key, source: input, ...result });
  }
  const output = path.resolve(process.env.PERF_OUTPUT || "perf/d2"); await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "asset-sizes.json"), JSON.stringify(report, null, 2));
  console.log(report.map((r) => ({ property: r.property, scene: r.scene, desktopMB: (r.desktopBytes / 1048576).toFixed(2), mobileMB: (r.mobileBytes / 1048576).toFixed(2) })));
} finally { await db.$disconnect(); }
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
