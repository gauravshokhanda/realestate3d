import { db } from "@/lib/db";
import { AdminError, adminFailure, guard, privateJson, readJson } from "@/lib/admin/http";
import { developmentSave, idSchema } from "@/lib/admin/development-schema";
import { saveDevelopment } from "@/lib/admin/developments";

type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    await guard(request, true);
    const id = idSchema.parse((await context.params).id);
    return privateJson(await saveDevelopment(id, developmentSave.parse(await readJson(request))));
  } catch (error) { return adminFailure(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await guard(request, true);
    const id = idSchema.parse((await context.params).id);
    if (!(await db.development.deleteMany({ where: { id } })).count) throw new AdminError("Development not found.", 404);
    return privateJson({ success: true });
  } catch (error) { return adminFailure(error); }
}
