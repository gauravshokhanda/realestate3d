import "server-only";
import busboy from "busboy";
import { Readable, Transform } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { storage } from "@/lib/storage";
import { AdminError } from "@/lib/admin/http";
import { probeVideo } from "./ffmpeg";
import { readableVideoError } from "./veo";
import { LocalStorage } from "@/lib/storage/local";
import { assertFreeSpace, StorageSpaceError } from "@/lib/storage/disk";

const maxBytes = 100 * 1024 * 1024;
export async function storeManualVideo(request: Request, propertyId: string) {
  if (storage instanceof LocalStorage) await assertFreeSpace(storage.root);
  if (!request.body) throw new AdminError("Choose an MP4.");
  if (Number(request.headers.get("content-length")) > maxBytes + 65536) throw new AdminError("MP4 uploads are limited to 100 MB.", 413);
  const directory = await mkdtemp(path.join(os.tmpdir(), "aurelia-mp4-"));
  const file = path.join(directory, "upload.mp4");
  let count = 0, invalid = false, size = 0;
  const tasks: Promise<void>[] = [], streams: Readable[] = [];
  try {
    const parser = busboy({ headers: { "content-type": request.headers.get("content-type") ?? "" }, limits: { files: 1, fields: 0, parts: 2, fileSize: maxBytes + 1, headerPairs: 50 } });
    parser.on("file", (name, stream) => {
      count++; streams.push(stream); if (name !== "file") invalid = true;
      stream.on("limit", () => { invalid = true; });
      const task = pipeline(stream, createWriteStream(file, { flags: "wx" })); tasks.push(task); void task.catch(() => {});
    });
    for (const event of ["filesLimit", "fieldsLimit", "partsLimit"]) parser.on(event, () => { invalid = true; });
    const limit = new Transform({ transform(chunk: Buffer, _encoding, callback) { size += chunk.length; callback(size > maxBytes + 65536 ? new AdminError("MP4 uploads are limited to 100 MB.", 413) : null, chunk); } });
    await pipeline(Readable.fromWeb(request.body as ReadableStream<Uint8Array>), limit, parser);
    await Promise.all(tasks);
    if (invalid || count !== 1) throw new AdminError("Upload one MP4, at most 100 MB.", 413);
    const bytes = await readFile(file);
    if (bytes.length > maxBytes) throw new AdminError("MP4 uploads are limited to 100 MB.", 413);
    if (bytes.length < 12 || bytes.toString("ascii", 4, 8) !== "ftyp") throw new AdminError("This file is not a valid MP4 container.");
    const metadata = await probeVideo(file);
    const key = `properties/${propertyId}/videos/${randomUUID()}.mp4`;
    await storage.put(key, bytes);
    return { key, ...metadata };
  } catch (error) {
    streams.forEach((stream) => stream.destroy()); await Promise.allSettled(tasks);
    if (error instanceof AdminError || error instanceof StorageSpaceError) throw error;
    throw new AdminError(error instanceof Error ? readableVideoError(error).slice(0, 500) : "The MP4 could not be decoded.");
  } finally {
    if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith("aurelia-mp4-")) await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  }
}
