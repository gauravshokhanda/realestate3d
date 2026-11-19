"use client";
import { z } from "zod";
export class ApiError extends Error {
  constructor(message: string, readonly errors: Record<string, string> = {}) { super(message); }
}
export async function adminApi(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, headers: { ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init?.headers }, cache: "no-store" });
  const body: unknown = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !url.endsWith("/login")) window.location.assign("/admin/login");
    const parsed = z.object({ error: z.string(), errors: z.record(z.string(), z.string()).optional() }).safeParse(body);
    throw new ApiError(parsed.success ? parsed.data.error : "Request failed. Please try again.", parsed.success ? parsed.data.errors : {});
  }
  return body;
}
