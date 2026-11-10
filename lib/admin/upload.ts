import "server-only";
import busboy from "busboy";
import { Readable, Transform } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { storage, mediaUrl } from "@/lib/storage";
import { AdminError } from "./http";
import { LocalStorage } from "@/lib/storage/local";
import { assertFreeSpace, StorageSpaceError } from "@/lib/storage/disk";

const maxFile = 25 * 1024 * 1024;
export async function uploadImage(request: Request, propertyId: string, kind: "image" | "panorama" = "image") {
  if (storage instanceof LocalStorage) await assertFreeSpace(storage.root);
  if (!request.body) throw new AdminError("Select an image.");
  if (Number(request.headers.get("content-length")) > maxFile + 65536) throw new AdminError("Images must be 25 MB or smaller.", 413);
  const temp = await mkdtemp(path.join(os.tmpdir(), "aurelia-upload-"));
  const file = path.join(temp, "image");
  let fileCount = 0, invalid = false, size = 0;
  const tasks: Promise<void>[] = [];
  const streams: Readable[] = [];
  try {
    const parser = busboy({ headers: { "content-type": request.headers.get("content-type") ?? "" }, limits: { files: 1, fields: 0, parts: 2, fileSize: maxFile, headerPairs: 50 } });
    parser.on("file", (name, stream) => {
      streams.push(stream);
      fileCount++;
      if (name !== "file") invalid = true;
      stream.on("limit", () => { invalid = true; });
      tasks.push(pipeline(stream, createWriteStream(file, { flags: "wx" })).catch((error: unknown) => { invalid = true; throw error; }));
      // Attach a handler immediately; pipeline completion is awaited below.
      void tasks[tasks.length - 1].catch(() => {});
    });
    for (const event of ["filesLimit", "fieldsLimit", "partsLimit"]) parser.on(event, () => { invalid = true; });
    const limit = new Transform({ transform(chunk: Buffer, _encoding, callback) { size += chunk.length; callback(size > maxFile + 65536 ? new AdminError("Images must be 25 MB or smaller.", 413) : null, chunk); } });
    await pipeline(Readable.fromWeb(request.body as ReadableStream<Uint8Array>), limit, parser);
    await Promise.all(tasks);
    if (invalid || fileCount !== 1) throw new AdminError("Upload one image, at most 25 MB.", 413);
    const original = await readFile(file);
    const options = { failOn: "warning" as const, limitInputPixels: 100_000_000, animated: false };
    const metadata = await sharp(original, options).metadata();
    if (!metadata.format || !["jpeg", "png", "webp", "avif", "tiff"].includes(metadata.format) || (metadata.pages ?? 1) > 1) throw new AdminError("Use a single-frame JPEG, PNG, WebP, AVIF or TIFF image.");
    // Full decoding validates the image; output omits source EXIF/GPS metadata.
    const { data, info } = await sharp(original, options).rotate().resize({ width: 6000, height: 6000, fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
    const prefix = `properties/${propertyId}/${kind === "panorama" ? "panoramas" : "images"}/${randomUUID()}`;
    const originalKey = `${prefix}-original.${metadata.format === "jpeg" ? "jpg" : metadata.format}`;
    await storage.put(originalKey, original);
    try {
      await storage.put(`${prefix}.webp`, data);
      if (kind === "panorama") await storage.put(`${prefix}-mobile.webp`, await sharp(data).resize({ width: 2048, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer());
    } catch (error) { await Promise.allSettled([storage.delete(originalKey), storage.delete(`${prefix}.webp`), ...(kind === "panorama" ? [storage.delete(`${prefix}-mobile.webp`)] : [])]); throw error; }
    const warnings = [];
    if (kind === "panorama") {
      if (Math.abs(info.width / info.height - 2) > 0.05) warnings.push("Expected an equirectangular 2:1 panorama. This ratio may distort the view; use a proper seamless spherical image.");
      if (info.width < 4096) warnings.push("Width is below 4096px; a larger panorama will look sharper. This upload is still allowed.");
    } else {
      if (Math.abs(info.width / info.height - 16 / 9) > 0.18) warnings.push("This image is not close to 16:9; the tour will crop it to fill the screen.");
      if (info.width < 1600) warnings.push("Width is below 1600px; a larger image will look sharper on desktop.");
    }
    return { url: mediaUrl(`${prefix}.webp`), width: info.width, height: info.height, warnings };
  } catch (error) {
    for (const stream of streams) stream.destroy();
    await Promise.allSettled(tasks);
    if (error instanceof AdminError || error instanceof StorageSpaceError) throw error;
    throw new AdminError("The file could not be decoded as a valid image. Use JPEG, PNG, WebP, AVIF or TIFF.");
  } finally {
    if (path.dirname(temp) === os.tmpdir() && path.basename(temp).startsWith("aurelia-upload-")) await rm(temp, { recursive: true, force: true });
  }
}
