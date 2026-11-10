import { z } from "zod";
import { db } from "@/lib/db";
import { adminFailure, AdminError, guard, privateJson, readJson } from "@/lib/admin/http";
import { adminProperty, saveProperty } from "@/lib/admin/property";
import { propertyInput } from "@/lib/admin/schema";
type Context = { params: Promise<{ id: string }> };
async function routeId(context: Context) { return z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/).parse((await context.params).id); }
export async function GET(request: Request, context: Context) {
  try { await guard(request); const property = await adminProperty(await routeId(context)); if (!property) throw new AdminError("Property not found.", 404); return privateJson(property); }
  catch (error) { return adminFailure(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    await guard(request, true);
    const input = propertyInput.parse(await readJson(request));
    if (input.id !== await routeId(context)) throw new AdminError("Property ID does not match.");
    return privateJson(await saveProperty(input));
  } catch (error) { return adminFailure(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    await guard(request, true);
    const id = await routeId(context);
    if (!(await db.property.deleteMany({ where: { id } })).count) throw new AdminError("Property not found.", 404);
    // Retain unreferenced media for recovery; it is no longer publicly addressable.
    return privateJson({ success: true });
  } catch (error) { return adminFailure(error); }
}
