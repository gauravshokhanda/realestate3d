import { NextResponse } from "next/server";
import { adminFailure, guard } from "@/lib/admin/http";
import { secureCookie, sessionCookie } from "@/lib/admin/session";
export async function POST(request: Request) {
  try {
    await guard(request, true);
    const response = NextResponse.json({ success: true });
    response.cookies.set(sessionCookie, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "strict", secure: secureCookie(request) });
    return response;
  } catch (error) { return adminFailure(error); }
}
