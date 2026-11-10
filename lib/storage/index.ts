import "server-only";
import { LocalStorage, type StorageAdapter } from "./local";

/** Production extension point; deliberately fails rather than silently writing locally. */
export class S3Storage implements StorageAdapter {
  async get(): Promise<never> { throw new Error("S3/R2 storage is not configured. Implement the S3 adapter before switching providers."); }
  async put(): Promise<never> { throw new Error("S3/R2 storage is not configured."); }
  async delete(): Promise<never> { throw new Error("S3/R2 storage is not configured."); }
}

export const storage: StorageAdapter = process.env.STORAGE_PROVIDER === "s3" ? new S3Storage() : new LocalStorage();
export function mediaUrl(key: string) { return `/media/${key.split("/").map(encodeURIComponent).join("/")}`; }
