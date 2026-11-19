import { cp, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "../lib/database-url";
import { LocalStorage } from "../lib/storage/local";
import { frameFolder, originalFolder } from "../lib/storage/layout";
import { manifestSchema } from "../lib/property-validation";
import { loadEnvConfig } from "./runtime-env";

loadEnvConfig();
const db = new PrismaClient({ datasourceUrl: databaseUrl() });
const storage = new LocalStorage();

async function copy(source: string, target: string, optional = false) {
  const from = await storage.filePath(source);
  const to = await storage.filePath(target);
  try { await stat(from); }
  catch (error) {
    if (optional && error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true, force: false });
  return true;
}

async function migrate() {
  const properties = await db.property.findMany({ include: { development: true, scenes: true, rooms: { include: { nodes: true } } } });
  const originals = new Map<string, string>();
  for (const property of properties) {
    if (property.id !== property.developmentId) continue;
    for (const namespace of [property.development.slug, property.id]) originals.set(namespace, originalFolder(property.development.slug, namespace));
  }
  const key = (value: string | null) => {
    if (!value?.startsWith("properties/")) return value;
    const [, namespace, ...suffix] = value.split("/");
    const folder = originals.get(namespace);
    if (!folder) throw new Error(`Unknown legacy media namespace: ${namespace}`);
    return [folder, ...suffix].join("/");
  };
  const isLegacy = (value: string | null) => value?.startsWith("properties/");
  for (const [namespace, target] of originals) {
    for (const category of ["images", "videos", "panoramas"]) await copy(`properties/${namespace}/${category}`, `${target}/${category}`, true);
  }
  const templates = new Map(properties.flatMap((property) => property.scenes.filter((scene) => scene.sequencePath && scene.videoPath).map((scene) => [scene.sequencePath, scene] as const)));
  for (const property of properties) {
    const { id, slug, development, planImage } = property;
    const changes = [];
    if (isLegacy(development.buildingImage) && property.id === development.id) changes.push(db.development.update({ where: { id: development.id }, data: { buildingImage: key(development.buildingImage), updatedAt: development.updatedAt } }));
    if (isLegacy(planImage)) changes.push(db.property.update({ where: { id }, data: { planImage: key(planImage), updatedAt: property.updatedAt } }));
    for (const room of property.rooms) {
      if (isLegacy(room.image)) changes.push(db.room.update({ where: { id: room.id }, data: { image: key(room.image) } }));
      for (const node of room.nodes) if (isLegacy(node.image)) changes.push(db.panoNode.update({ where: { id: node.id }, data: { image: key(node.image)! } }));
    }
    for (const scene of property.scenes) {
      if (![scene.sequencePath, scene.fromImage, scene.toImage, scene.videoPath].some(isLegacy)) continue;
      const source = scene.sequencePath ?? `properties/${development.slug}/sequences/${scene.key}`;
      const sequencePath = source.startsWith("cache/frames/") ? source : frameFolder(development.slug, slug, scene.key);
      let scrollLength = scene.scrollLength;
      if (!source.startsWith("cache/frames/") && await copy(source, sequencePath, true)) {
        await copy(`${source}-mobile`, `${sequencePath}-mobile`, true);
        const manifest = await storage.filePath(`${sequencePath}/manifest.json`);
        scrollLength = manifestSchema.parse(JSON.parse(await readFile(manifest, "utf8"))).scrollLength;
      }
      const template = templates.get(scene.sequencePath);
      changes.push(db.scene.update({ where: { id: scene.id }, data: {
        fromImage: key(scene.fromImage)!, toImage: key(scene.toImage)!,
        videoPath: key(scene.videoPath ?? template?.videoPath ?? null),
        trimStart: scene.trimStart ?? template?.trimStart,
        trimEnd: scene.trimEnd ?? template?.trimEnd,
        ...(scene.settings === null && template?.settings ? { settings: template.settings } : {}),
        sequencePath, scrollLength,
      } }));
    }
    await db.$transaction(changes);
    if (changes.length) console.log(`${development.slug}/${slug}: migrated ${changes.length} database references.`);
  }
}
migrate().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
