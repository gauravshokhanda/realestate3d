import { storage } from "@/lib/storage";
import { validStorageKey } from "@/lib/storage/local";
import { db } from "@/lib/db";
import { hasAdminSession } from "@/lib/admin/http";

export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: Context) {
  const { path } = await context.params;
  const key = path.join("/");
  const folder = path.slice(0, -1).join("/");
  const frame = /^cache\/frames\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/(?:manifest\.json|frame_\d+\.webp)$/.test(key);
  const source = /^originals\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/(?:images|videos|panoramas)\/[a-zA-Z0-9_.-]+$/.test(key);
  if ((!frame && !source) || !path.every((part) => !part.includes("/") && !part.includes("\\") && !part.startsWith(".")) || !validStorageKey(key)) return new Response("Not found", { status: 404 });
  try {
    const pano = key.replace(/-mobile\.webp$/, ".webp");
    const published = !key.endsWith(".mp4") && Boolean(await db.property.findFirst({
      where: { status: "published", development: { status: "published" }, OR: frame ? [{ scenes: { some: { sequencePath: { in: [folder, folder.replace(/-mobile$/, "")] } } } }] : [
        { development: { buildingImage: key } }, { planImage: key }, { rooms: { some: { OR: [{ image: key }, { nodes: { some: { image: pano } } }] } } },
      ] }, select: { id: true },
    }));
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
    if (published && frame && /\/frame_\d+\.webp$/.test(key) && new URL(request.url).searchParams.has("v")) headers.set("Cache-Control", "public, max-age=31536000, immutable");
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
