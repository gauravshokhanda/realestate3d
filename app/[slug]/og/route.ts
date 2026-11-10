import sharp from "sharp";
import { z } from "zod";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { slugSchema } from "@/lib/property-validation";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const parsed = slugSchema.safeParse((await params).slug);
  if (!parsed.success) return new Response("Not found", { status: 404 });
  const property = await db.property.findFirst({ where: { slug: parsed.data, status: "published" }, select: { name: true, towerImage: true } });
  if (!property?.towerImage) return new Response("Not found", { status: 404 });
  const name = z.string().max(200).parse(property.name).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
  const source = await storage.get(property.towerImage);
  const overlay = Buffer.from(`<svg width="1200" height="630"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#0a0a0b" stop-opacity="0"/><stop offset="1" stop-color="#0a0a0b" stop-opacity=".95"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><path d="M64 458h84" stroke="#D8B67A"/><text x="64" y="530" fill="#f5f2ec" font-family="serif" font-size="${Math.min(52, 1000 / Math.max(1, property.name.length) * 1.7)}">${name}</text><text x="64" y="580" fill="#D8B67A" font-family="sans-serif" font-size="15" letter-spacing="5">EXCEPTIONAL RESIDENCES</text></svg>`);
  const image = await sharp(source.body).resize(1200, 630, { fit: "cover" }).composite([{ input: overlay }]).jpeg({ quality: 85 }).toBuffer();
  return new Response(new Uint8Array(image), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } });
}
