import { timingSafeEqual, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminFailure, AdminError, checkOrigin, readJson } from "@/lib/admin/http";
import { authConfigured, createSession, secureCookie, sessionCookie, sessionSeconds } from "@/lib/admin/session";

export const runtime = "nodejs";
const globals = globalThis as unknown as { adminLogins?: Map<string, { count: number; expires: number }> };
const logins = globals.adminLogins ??= new Map();
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (!authConfigured()) throw new AdminError("Admin is not configured. Set ADMIN_PASSWORD and a SESSION_SECRET of at least 32 characters on the server.", 503);
    const ip = (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local").slice(0, 100);
    const now = Date.now();
    for (const [key, item] of logins) if (item.expires <= now) logins.delete(key);
    const entry = logins.get(ip) ?? { count: 0, expires: now + 600_000 };
    if (entry.count >= 5 || logins.size >= 10_000) return NextResponse.json({ error: "Too many login attempts. Try again in 10 minutes." }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((entry.expires - now) / 1000))) } });
    entry.count++; logins.set(ip, entry);
    const { password } = z.object({ password: z.string().min(1).max(1024) }).strict().parse(await readJson(request));
    const digest = (text: string) => createHash("sha256").update(text).digest();
    if (!timingSafeEqual(digest(password), digest(process.env.ADMIN_PASSWORD!))) throw new AdminError("Incorrect password.", 401);
    const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(sessionCookie, await createSession(), { httpOnly: true, sameSite: "strict", secure: secureCookie(request), path: "/", maxAge: sessionSeconds });
    return response;
  } catch (error) { return adminFailure(error); }
}
