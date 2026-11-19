import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

export const sessionCookie = "aurelia_admin";
export const sessionSeconds = 8 * 60 * 60;
export function secureCookie(request: Request) {
  return new URL(request.url).protocol === "https:" || (process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).protocol === "https:" : false);
}
function key() {
  const secret = process.env.SESSION_SECRET;
  const password = process.env.ADMIN_PASSWORD;
  if (!secret || secret.length < 32 || !password) throw new Error("Set ADMIN_PASSWORD and SESSION_SECRET (at least 32 characters) to enable admin login.");
  // Changing either credential invalidates existing sessions.
  return new TextEncoder().encode(`${secret.length}:${secret}:${password}`);
}
export function authConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && (process.env.SESSION_SECRET?.length ?? 0) >= 32);
}
export async function createSession() {
  return new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setIssuer("aurelia").setAudience("admin").setExpirationTime(`${sessionSeconds}s`).sign(key());
}
export async function validSession(token?: string) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], issuer: "aurelia", audience: "admin" });
    return payload.role === "admin";
  } catch { return false; }
}
