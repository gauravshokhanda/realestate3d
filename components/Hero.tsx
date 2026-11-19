"use client";

import ExploreButton from "./ExploreButton";
import type { Unit } from "@/data/units";
import type { PropertyView } from "@/lib/property-types";
import type { RefObject } from "react";

type Props = { property: PropertyView; opacity: number; unit: Unit; reducedMotion: boolean; heroRef?: RefObject<HTMLDivElement | null> };

export default function Hero({ property, opacity, unit, reducedMotion, heroRef }: Props) {
  return (
    <div
      ref={heroRef}
      data-reduced-motion={reducedMotion}
      className={reducedMotion ? "relative w-full space-y-12 px-6 py-12 sm:px-12 lg:px-20" : "pointer-events-none absolute inset-0"}
      style={{ opacity: reducedMotion ? undefined : opacity }}
      aria-hidden={reducedMotion ? undefined : opacity === 0}
    >
      <aside className={`${reducedMotion ? "max-w-sm" : "absolute right-6 top-32 w-48 sm:right-12 sm:w-60 lg:right-20"} border border-champagne/40 bg-ink/60 p-5 backdrop-blur-xl`} aria-label="Development overview">
        <p className="text-[10px] uppercase tracking-[0.24em] text-champagne">{property.name}</p>
        <p className="mt-3 font-display text-2xl text-ivory">{property.overviewTitle}</p>
        <p className="mt-3 border-t border-ivory/15 pt-3 text-xs text-ivory/80">{unit.beds}-bedroom residences</p>
        <p className="mt-1 text-xs text-champagne">{unit.price}</p>
      </aside>
      <div className={reducedMotion ? "max-w-3xl hero-copy" : "hero-copy absolute bottom-24 left-6 right-6 sm:bottom-28 sm:left-12 sm:right-12 lg:left-20"}>
        <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-champagne">{property.tagline}</p>
        <h1 className="max-w-4xl whitespace-pre-line font-display text-5xl font-normal leading-[0.95] tracking-tight text-ivory sm:text-7xl lg:text-8xl">{property.heroCopy ?? property.name}</h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-ivory/85 sm:text-base">{property.heroDescription}</p>
      </div>
      {!reducedMotion && <ExploreButton />}
    </div>
  );
}
