import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-[10px] uppercase tracking-[0.3em] text-champagne">Aurelia · 404</p>
      <h1 className="mt-8 max-w-2xl font-display text-6xl leading-none sm:text-8xl">A different perspective awaits.</h1>
      <p className="mt-8 max-w-md text-sm leading-7 text-ivory/65">This residence is unavailable. Explore our collection to find your next chapter.</p>
      <Link href="/" className="mt-10 border border-champagne px-8 py-4 text-xs uppercase tracking-[0.2em] text-champagne transition-colors hover:bg-champagne hover:text-ink">Explore the collection</Link>
    </main>
  );
}
