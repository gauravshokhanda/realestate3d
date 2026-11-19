import { z } from "zod";
import { adminFailure, guard, privateJson, readJson } from "@/lib/admin/http";
import { idSchema, polygonSave } from "@/lib/admin/development-schema";
import { savePolygon } from "@/lib/admin/developments";

type Context = { params: Promise<{ id: string; pid: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    await guard(request, true);
    const { id, pid } = z.object({ id: idSchema, pid: idSchema }).parse(await context.params);
    const { polygon, updatedAt } = polygonSave.parse(await readJson(request));
    return privateJson(await savePolygon(id, pid, polygon, updatedAt));
  } catch (error) { return adminFailure(error); }
}
