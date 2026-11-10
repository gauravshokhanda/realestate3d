import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { sessionCookie, validSession } from "./session";
import { StorageSpaceError } from "@/lib/storage/disk";

export class AdminError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export async function hasAdminSession() { return validSession((await cookies()).get(sessionCookie)?.value); }
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = [new URL(request.url).origin];
  if (process.env.NEXT_PUBLIC_SITE_URL) allowed.push(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);
  if (!origin || !allowed.includes(origin) || request.headers.get("sec-fetch-site") === "cross-site") throw new AdminError("This request must come from the admin site.", 403);
}
export async function guard(request: Request, mutate = false) {
  if (!await hasAdminSession()) throw new AdminError("Sign in to continue.", 401);
  if (mutate) checkOrigin(request);
}
export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AdminError("Send JSON.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AdminError("Missing request body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 200_000) { await reader.cancel(); throw new AdminError("Request is too large.", 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) { if (error instanceof AdminError) throw error; throw new AdminError("Invalid JSON."); }
}
export function adminFailure(error: unknown) {
  if (error instanceof StorageSpaceError) return NextResponse.json({ error: error.message }, { status: 507 });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Please check the highlighted details.", errors: Object.fromEntries(error.issues.map((issue) => [issue.path.join("."), issue.message])) }, { status: 400 });
  if (error instanceof AdminError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "That slug is already in use.", errors: { slug: "Choose a unique slug." } }, { status: 409 });
  console.error("[admin]", error instanceof Error ? error.message : "Unexpected error");
  return NextResponse.json({ error: "Unable to save. Please try again." }, { status: 500 });
}
export function privateJson(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } }); }
