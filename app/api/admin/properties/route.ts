import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { adminFailure, guard, privateJson, readJson } from "@/lib/admin/http";
import { createPropertySchema } from "@/lib/admin/schema";
export async function GET(request: Request) {
  try { await guard(request); return privateJson(await db.development.findMany({ select: { id: true, slug: true, name: true, status: true, updatedAt: true }, orderBy: { updatedAt: "desc" } })); }
  catch (error) { return adminFailure(error); }
}
export async function POST(request: Request) {
  try {
    await guard(request, true);
    const data = createPropertySchema.parse(await readJson(request));
    const id = randomUUID();
    await db.development.create({ data: { ...data, id, properties: { create: { id, slug: "residence-a", name: data.name } } } });
    return privateJson({ id }, 201);
  } catch (error) { return adminFailure(error); }
}
