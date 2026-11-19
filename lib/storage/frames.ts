import "server-only";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { manifestSchema } from "@/lib/property-validation";
import { storage } from "./index";
import { LocalStorage } from "./local";

export async function readFrames(folder: string | null) {
  if (!folder?.startsWith("cache/frames/")) return null;
  try {
    const object = await storage.get(`${folder}/manifest.json`);
    const manifest = manifestSchema.parse(JSON.parse(new TextDecoder().decode(object.body)));
    const check = async (suffix: string, count: number) => {
      const key = (index: number) => `frame_${String(index).padStart(manifest.pad, "0")}.${manifest.ext}`;
      if (storage instanceof LocalStorage) {
        const filename = await storage.filePath(`${folder}${suffix}/${key(1)}`);
        const entries = new Set((await readdir(path.dirname(filename), { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name));
        return Array.from({ length: count }, (_, index) => key(index + 1)).every((name) => entries.has(name));
      }
      await Promise.all([storage.get(`${folder}${suffix}/${key(1)}`), storage.get(`${folder}${suffix}/${key(count)}`)]);
      return true;
    };
    if (!await check("", manifest.desktop.frameCount) || (manifest.mobile && !await check("-mobile", manifest.mobile.frameCount))) return null;
    return { manifest, revision: manifest.revision ?? createHash("sha256").update(object.body).digest("hex").slice(0, 16) };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    if (error instanceof SyntaxError || error instanceof Error && error.name === "ZodError") return null;
    throw error;
  }
}
