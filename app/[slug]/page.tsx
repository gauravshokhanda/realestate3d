import Link from "next/link";
import { notFound } from "next/navigation";
import PropertyTour, { tourMetadata } from "@/components/PropertyTour";
import { getPropertyBySlug, getPublishedDevelopment } from "@/lib/property";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const development = await getPublishedDevelopment(slug);
  if (development && development.properties.length > 1) return { title: development.name, alternates: { canonical: `/${slug}` } };
  return tourMetadata(await getPropertyBySlug(slug), `/${slug}`);
}

export default async function DevelopmentPage({ params }: Props) {
  const { slug } = await params;
  const development = await getPublishedDevelopment(slug);
  if (!development?.properties.length) notFound();
  if (development.properties.length === 1) return <PropertyTour property={await getPropertyBySlug(slug)} />;
  return <main className="min-h-screen px-6 py-16 sm:px-12 lg:px-20">
    <h1 className="font-display text-6xl">{development.name}</h1>
    <ul className="mt-12 max-w-3xl border-t border-champagne/25">
      {development.properties.map((property) => <li key={property.slug} className="border-b border-champagne/25">
        <Link className="flex justify-between gap-4 py-6 hover:text-champagne focus-visible:text-champagne" href={`/${slug}/${property.slug}`}>
          <span className="font-display text-3xl">{property.name}</span>
          {property.price && <span>{property.price}</span>}
        </Link>
      </li>)}
    </ul>
  </main>;
}
