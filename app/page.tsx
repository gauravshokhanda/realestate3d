import Image from "next/image";
import Link from "next/link";
import { getPublishedProperties } from "@/lib/property";

export const dynamic = "force-dynamic";

export default async function Home() {
  const properties = await getPublishedProperties();
  return (
    <main className="min-h-screen px-6 py-12 sm:px-12 lg:px-20">
      <header className="flex flex-wrap items-center justify-between gap-6 border-b border-champagne/25 pb-8">
        <Link href="/" className="font-display text-3xl uppercase tracking-[0.2em] text-ivory">Aurelia</Link>
        <span className="text-[10px] uppercase tracking-[0.25em] text-champagne">Exceptional residences</span>
      </header>
      <section aria-labelledby="collection-title" className="py-16 sm:py-24">
        <p className="text-[10px] uppercase tracking-[0.3em] text-champagne">The collection</p>
        <h1 id="collection-title" className="mt-6 max-w-3xl font-display text-6xl leading-none sm:text-8xl">Find your perspective.</h1>
        <p className="mt-8 max-w-lg text-sm leading-7 text-ivory/65">Explore exceptional residences, considered spaces, and the places you could call home.</p>
        <div className="mt-16 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <Link key={property.slug} href={`/${property.slug}`} aria-label={`Explore ${property.name}`} className="group border border-champagne/25 bg-ivory/[0.02] transition-colors hover:border-champagne">
              <div className="relative aspect-video overflow-hidden bg-ink">
                {property.towerImage && <Image src={property.towerImage} alt={`${property.name} exterior`} fill unoptimized sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />}
              </div>
              <div className="p-7">
                <p className="text-[10px] uppercase tracking-[0.2em] text-champagne">{property.location || property.tagline}</p>
                <h2 className="mt-4 font-display text-4xl">{property.name}</h2>
                <div className="mt-6 flex justify-between border-t border-champagne/20 pt-5 text-xs"><span className="text-ivory/65">{property.price}</span><span className="text-champagne">Explore residence →</span></div>
              </div>
            </Link>
          ))}
        </div>
        {!properties.length && <p className="mt-16 border-t border-champagne/20 pt-8 text-ivory/70">New perspectives are coming soon.</p>}
      </section>
    </main>
  );
}
