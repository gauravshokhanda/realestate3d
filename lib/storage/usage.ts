import "server-only";
import { readdir, lstat } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { LocalStorage } from "./local";
import { driveSpace } from "./disk";

let cached: { root: string; at: number; properties: { id: string; slug: string; name: string; bytes: number }[] } | undefined;
async function size(directory: string): Promise<number> {
  try {
    const info = await lstat(directory); if (info.isSymbolicLink()) return 0;
    if (info.isFile()) return info.size;
    let bytes = 0;
    for (const entry of await readdir(directory)) bytes += await size(path.join(directory, entry));
    return bytes;
  } catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return 0; throw error; }
}
export async function storageUsage() {
  if (!(storage instanceof LocalStorage)) return { available: false as const };
  const root = storage.root;
  const space = await driveSpace(root);
  if (!cached || cached.root !== root || Date.now() - cached.at > 30000) {
    const properties = [];
    const originals = path.join(root, "originals");
    const folders = await readdir(originals, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    const records = await db.property.findMany({ select: { id: true, slug: true, name: true, scenes: { select: { sequencePath: true } } }, orderBy: { name: "asc" } });
    for (const { scenes, ...residence } of records) {
      const buckets = folders.filter((entry) => entry.isDirectory()).map((entry) => path.join(originals, entry.name, residence.id));
      const sequences = scenes.flatMap(({ sequencePath }) => sequencePath?.startsWith("cache/frames/") && /^[a-zA-Z0-9_/-]+$/.test(sequencePath)
        ? [path.join(root, sequencePath), path.join(root, sequencePath + "-mobile")] : []);
      const counts = await Promise.all([...new Set([...buckets, ...sequences])].map(size));
      properties.push({ ...residence, bytes: counts.reduce((total, bytes) => total + bytes, 0) });
    }
    cached = { root, at: Date.now(), properties };
  }
  return { available: true as const, free: space.free, total: space.total, properties: cached.properties, measuredAt: new Date(cached.at).toISOString() };
}
