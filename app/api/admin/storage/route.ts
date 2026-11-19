import { z } from "zod";
import { adminFailure, guard, privateJson } from "@/lib/admin/http";
import { storageUsage } from "@/lib/storage/usage";

export async function GET(request: Request) {
  try { await guard(request); z.object({}).strict().parse(Object.fromEntries(new URL(request.url).searchParams)); return privateJson(await storageUsage()); }
  catch (error) { return adminFailure(error); }
}
