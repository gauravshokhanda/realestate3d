import PropertyTour, { tourMetadata } from "@/components/PropertyTour";
import { getPropertyBySlug } from "@/lib/property";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Props = { params: Promise<{ slug: string; property: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug, property } = await params;
  return tourMetadata(await getPropertyBySlug(slug, property), `/${slug}/${property}`);
}

export default async function ResidencePage({ params }: Props) {
  const { slug, property } = await params;
  return <PropertyTour property={await getPropertyBySlug(slug, property)} />;
}
