import { statfs } from "node:fs/promises";
import path from "node:path";

export const minimumFreeBytes = 2 * 1024 ** 3;
export class StorageSpaceError extends Error {
  readonly status = 507;
  constructor(readonly freeBytes: number) { super(`Storage drive has ${(freeBytes / 1024 ** 3).toFixed(2)} GB free. At least 2 GB must be free before uploading or extracting. Free space or move the storage directory, then retry.`); }
}
export async function driveSpace(directory: string) {
  let target = path.resolve(directory);
  while (true) {
    try { const info = await statfs(target); return { free: info.bavail * info.bsize, total: info.blocks * info.bsize }; }
    catch (error) {
      const parent = path.dirname(target);
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT") || parent === target) throw error;
      target = parent;
    }
  }
}
export async function assertFreeSpace(directory: string, probe = driveSpace) {
  const space = await probe(directory);
  if (space.free < minimumFreeBytes) throw new StorageSpaceError(space.free);
  return space;
}
