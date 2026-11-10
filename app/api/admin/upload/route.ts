import { z } from "zod";
import { db } from "@/lib/db";
import { adminFailure, AdminError, guard, privateJson } from "@/lib/admin/http";
import { uploadImage } from "@/lib/admin/upload";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await guard(request, true);
    const { propertyId, kind } = z.object({ propertyId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/), kind: z.enum(["image", "panorama"]).default("image") }).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
    if (!await db.property.findUnique({ where: { id: propertyId }, select: { id: true } })) throw new AdminError("Property not found.", 404);
    return privateJson(await uploadImage(request, propertyId, kind), 201);
  } catch (error) { return adminFailure(error); }
}
