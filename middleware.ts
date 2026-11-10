import { NextRequest, NextResponse } from "next/server";
import { sessionCookie, validSession } from "@/lib/admin/session";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/admin/login" || pathname === "/api/admin/login") return NextResponse.next();
  if (await validSession(request.cookies.get(sessionCookie)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/admin/")) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const url = new URL("/admin/login", request.url);
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}
export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
