import { z } from "zod";
import { db } from "@/lib/db";
import { AdminError, adminFailure, guard, privateJson } from "@/lib/admin/http";
import { idSchema } from "@/lib/admin/development-schema";
import { uploadImage } from "@/lib/admin/upload";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  try {
    await guard(request, true);
    const id = idSchema.parse((await context.params).id);
    const { kind } = z.object({ kind: z.enum(["building", "logo"]) }).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
    const development = await db.development.findUnique({ where: { id }, select: { slug: true } });
    if (!development) throw new AdminError("Development not found.", 404);
    const result = await uploadImage(request, id, development.slug);
    return privateJson(kind === "logo" ? { ...result, warnings: [] } : result, 201);
  } catch (error) { return adminFailure(error); }
}
