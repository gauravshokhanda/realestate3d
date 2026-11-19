import { z } from "zod";
import { guard, adminFailure, privateJson, readJson } from "@/lib/admin/http";
import { getPanoramas, savePanoramas } from "@/lib/admin/panoramas";
import { panoSnapshotSchema } from "@/lib/panorama";
type Context = { params: Promise<{ id: string }> };
const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export async function GET(request: Request, context: Context) {
  try { await guard(request); return privateJson(await getPanoramas(id.parse((await context.params).id))); }
  catch (error) { return adminFailure(error); }
}
export async function PUT(request: Request, context: Context) {
  try { await guard(request, true); return privateJson(await savePanoramas(id.parse((await context.params).id), panoSnapshotSchema.parse(await readJson(request)))); }
  catch (error) { return adminFailure(error); }
}
