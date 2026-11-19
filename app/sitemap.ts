import type { MetadataRoute } from "next";
import { getPublishedProperties } from "@/lib/property";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const developments = await getPublishedProperties();
  return [{ url: new URL("/", base).href }, ...developments.flatMap(({ slug, properties }) => [
    { url: new URL(`/${slug}`, base).href },
    ...properties.map((property) => ({ url: new URL(`/${slug}/${property.slug}`, base).href })),
  ])];
}
