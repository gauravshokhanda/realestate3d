import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import TourPolish from "@/components/TourPolish";
import Nav from "@/components/Nav";
import Experience from "@/components/Experience";
import SmoothScroll from "@/components/SmoothScroll";
import { getPropertyBySlug } from "@/lib/property";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const property = await getPropertyBySlug((await params).slug);
  if (!property) return { title: "Residence not found", robots: { index: false, follow: false } };
  const title = `${property.brandName} | Exceptional Residences`;
  const description = property.heroDescription ?? property.tagline ?? `Discover ${property.name}.`;
  return { title, description, alternates: { canonical: `/${property.slug}` }, openGraph: { title, description, url: `/${property.slug}`, siteName: property.name, images: property.towerImage ? [{ url: `/${property.slug}/og`, width: 1200, height: 630, alt: `${property.name} exterior` }] : [] }, twitter: { card: "summary_large_image", title, description, images: property.towerImage ? [`/${property.slug}/og`] : [] } };
}

export default async function PropertyPage({ params }: Props) {
  const property = await getPropertyBySlug((await params).slug);
  if (!property || !property.units.length || property.rooms.length < 1 || property.rooms.length > 8 || !property.scenes.some((scene) => scene.id === "hero-to-plan")) notFound();
  const rgb = property.accentColor.slice(1).match(/.{2}/g)!.map((value) => parseInt(value, 16)).join(" ");
  return (
    <div style={{ "--champagne-rgb": rgb } as CSSProperties}>
      <SmoothScroll>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-6 focus:top-24 focus:z-50 focus:bg-ink focus:p-3">Skip to content</a>
        <Nav name={property.brandName} /><TourPolish />
        <main id="main" className="min-h-[100svh]" aria-label={property.name}>
          <Experience property={property} />
        </main>
      </SmoothScroll>
    </div>
  );
}
