import { storage } from "@/lib/storage";
import { validStorageKey } from "@/lib/storage/local";
import { db } from "@/lib/db";
import { hasAdminSession } from "@/lib/admin/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: Context) {
  const { path } = await context.params;
  // Only public property assets are addressable; DBs and arbitrary storage files are not.
  const key = path.join("/");
  if (path.length < 3 || path[0] !== "properties" || !path.every((part) => !part.includes("/") && !part.includes("\\") && !part.startsWith(".")) || !validStorageKey(key)) return new Response("Not found", { status: 404 });
  try {
    const prefix = `properties/${path[1]}/`;
    const property = await db.property.findUnique({ where: { id: path[1] }, select: { status: true } }) ?? await db.property.findFirst({ where: { OR: [{ slug: path[1], OR: [{ towerImage: { startsWith: prefix } }, { planImage: { startsWith: prefix } }, { rooms: { some: { image: { startsWith: prefix } } } }] }, { scenes: { some: { sequencePath: { startsWith: prefix } } } }] }, select: { status: true } });
    if (!property) return new Response("Not found", { status: 404 });
    const published = property.status === "published" && !key.endsWith(".mp4");
    if (!published && !await hasAdminSession()) return new Response("Not found", { status: 404 });
    const object = await storage.get(key);
    if (object.contentType === "application/octet-stream") return new Response("Not found", { status: 404 });
    const headers = new Headers({
      "Content-Type": object.contentType,
      "Cache-Control": published ? "public, max-age=3600, stale-while-revalidate=86400" : "private, no-store",
      ETag: object.etag,
      "Last-Modified": object.modified.toUTCString(),
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    });
    if (published && /\/sequences(?:-d2)?\/[^/]+\/frame_\d+\.webp$/.test(key) && new URL(request.url).searchParams.has("v")) headers.set("Cache-Control", "public, max-age=31536000, immutable");
    if (!request.headers.has("range") && request.headers.get("if-none-match") === object.etag) return new Response(null, { status: 304, headers });
    if (key.endsWith(".mp4")) {
      headers.set("Accept-Ranges", "bytes");
      if (new URL(request.url).searchParams.get("download") === "1") headers.set("Content-Disposition", 'attachment; filename="camera-move.mp4"');
      const range = request.headers.get("range");
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        let start = 0, end = object.size - 1;
        if (match && (match[1] || match[2])) {
          if (!match[1]) start = Math.max(0, object.size - Number(match[2]));
          else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
        }
        if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= object.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${object.size}` } });
        headers.set("Content-Range", `bytes ${start}-${end}/${object.size}`); headers.set("Content-Length", String(end - start + 1));
        return new Response(request.method === "HEAD" ? null : object.body.slice(start, end + 1), { status: 206, headers });
      }
    }
    headers.set("Content-Length", String(object.size));
    return new Response(request.method === "HEAD" ? null : object.body, { headers });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return new Response("Not found", { status: 404 });
    return new Response("Media unavailable", { status: 404 });
  }
}

export const HEAD = GET;
