import { db } from "@/lib/db";
import { adminFailure, guard, privateJson, readJson } from "@/lib/admin/http";
import { developmentCreate } from "@/lib/admin/development-schema";

export async function POST(request: Request) {
  try {
    await guard(request, true);
    const data = developmentCreate.parse(await readJson(request));
    return privateJson(await db.development.create({ data, select: { id: true } }), 201);
  } catch (error) { return adminFailure(error); }
}
