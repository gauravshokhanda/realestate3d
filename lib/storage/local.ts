import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertFreeSpace } from "./disk";

export type StoredObject = { body: Uint8Array<ArrayBuffer>; size: number; contentType: string; etag: string; modified: Date };
export interface StorageAdapter {
  get(key: string): Promise<StoredObject>;
  put(key: string, body: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
}

const types: Record<string, string> = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".mp4": "video/mp4", ".json": "application/json" };

export function validStorageKey(key: string) {
  return key.length > 0 && key.length <= 1000 && key.split("/").every((segment) => /^[a-zA-Z0-9_.-]+$/.test(segment) && segment !== "." && segment !== "..");
}

export class LocalStorage implements StorageAdapter {
  readonly root: string;
  constructor(root = process.env.STORAGE_DIR || "./storage") { this.root = path.resolve(root); }

  private async resolve(key: string) {
    if (!validStorageKey(key)) throw new Error("Invalid storage key");
    await mkdir(this.root, { recursive: true });
    if ((await lstat(this.root)).isSymbolicLink()) throw new Error("Storage root must not be a symlink");
    const root = await realpath(this.root);
    let current = root;
    for (const part of key.split("/")) {
      current = path.join(current, part);
      if (!current.startsWith(root + path.sep)) throw new Error("Storage path escaped its root");
      try {
        if ((await lstat(current)).isSymbolicLink()) throw new Error("Storage symlinks are not permitted");
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      }
    }
    return current;
  }

  async get(key: string): Promise<StoredObject> {
    const filename = await this.resolve(key);
    const info = await lstat(filename);
    if (!info.isFile()) throw new Error("Storage object is not a file");
    const body = new Uint8Array(await readFile(filename));
    return { body, size: body.byteLength, contentType: types[path.extname(key).toLowerCase()] || "application/octet-stream", etag: `"${createHash("sha256").update(body).digest("hex")}"`, modified: info.mtime };
  }

  /** Local-only worker access; applies the same traversal/junction checks as get/put. */
  async filePath(key: string) { return this.resolve(key); }

  async put(key: string, body: Uint8Array) {
    await assertFreeSpace(this.root);
    const filename = await this.resolve(key);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, body);
  }

  async delete(key: string) { await unlink(await this.resolve(key)); }
}
