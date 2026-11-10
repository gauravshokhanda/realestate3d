import { z } from "zod";
import { db } from "@/lib/db";
import { slugSchema } from "@/lib/property-validation";
import { adminFailure, guard, privateJson } from "@/lib/admin/http";
export async function GET(request: Request) {
  try {
    await guard(request);
    const query = z.object({ slug: slugSchema, id: z.string().max(128).optional() }).parse(Object.fromEntries(new URL(request.url).searchParams));
    const exists = await db.property.findUnique({ where: { slug: query.slug }, select: { id: true } });
    return privateJson({ available: !exists || exists.id === query.id });
  } catch (error) { return adminFailure(error); }
}
