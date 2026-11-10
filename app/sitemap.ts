import type { MetadataRoute } from "next";
import { getPublishedProperties } from "@/lib/property";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return [{ url: new URL("/", base).href }, ...(await getPublishedProperties()).map((p) => ({ url: new URL(`/${p.slug}`, base).href }))];
}
