import { adminFailure, guard, privateJson, readJson } from "@/lib/admin/http";
import { idSchema, propertyCreate } from "@/lib/admin/development-schema";
import { addMapProperty } from "@/lib/admin/developments";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  try {
    await guard(request, true);
    const id = idSchema.parse((await context.params).id);
    const { name, polygon } = propertyCreate.parse(await readJson(request));
    return privateJson(await addMapProperty(id, name, polygon), 201);
  } catch (error) { return adminFailure(error); }
}
