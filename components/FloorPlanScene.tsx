"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import FrameSequence from "@/components/FrameSequence";
import Hero from "@/components/Hero";
import ResidencePanel from "@/components/ResidencePanel";
import type { Scene } from "@/data/scenes";
import type { Unit } from "@/data/units";
import Hotspots from "@/components/Hotspots";
import type { PropertyView } from "@/lib/property-types";

export default function FloorPlanScene({ property, scene, unit, onSelect, onHalf }: { property: PropertyView; scene: Scene; unit: Unit; onSelect: (id: string) => void; onHalf: () => void }) {
  const hero = useRef<HTMLDivElement>(null);
  const bandRef = useRef(0);
  const halfRef = useRef(false);
  const restingRef = useRef(true);
  const [band, setBand] = useState(0);
  const caption = band < 2 ? "The tower" : band < 3 ? "Step inside" : unit.name;
  const update = (value: number) => {
    const resting = value === 0;
    if (resting !== restingRef.current) {
      restingRef.current = resting;
      hero.current?.closest("section")?.classList.toggle("tower-at-rest", resting);
    }
    if (hero.current && hero.current.dataset.reducedMotion !== "true") {
      const opacity = Math.max(0, Math.min(1, (0.25 - value) / 0.1));
      hero.current.style.opacity = String(opacity);
      hero.current.setAttribute("aria-hidden", String(opacity === 0));
    }
    const next = value < 0.25 ? 0 : value < 0.4 ? 1 : value < 0.56 ? 2 : value < 0.7 ? 3 : 4;
    if (next !== bandRef.current) { bandRef.current = next; setBand(next); }
    const half = value >= 0.5 && value < 1;
    if (half && !halfRef.current) onHalf();
    halfRef.current = half;
  };

  return (
    <FrameSequence property={property} scene={scene} onProgress={update} priority>
      {(reducedMotion) => (
        <>
          {!reducedMotion && <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,11,0.35)_0%,rgba(10,10,11,0.1)_35%,rgba(10,10,11,0.8)_100%)]" aria-hidden="true" />}
          <Hero property={property} heroRef={hero} opacity={1} unit={unit} reducedMotion={reducedMotion} />
          <AnimatePresence mode="wait">
            {!reducedMotion && band >= 1 && band < 4 && (
              <motion.div key={caption} initial={{ opacity: 0, y: 24, clipPath: "inset(100% 0 0 0)" }} animate={{ opacity: 1, y: 0, clipPath: "inset(0% 0 0 0)" }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.7, ease: [0.455, 0.03, 0.515, 0.955] }} className="pointer-events-none absolute bottom-16 left-6 right-6 sm:left-12 lg:left-20">
                <p className="text-[10px] uppercase tracking-[0.3em] text-champagne">Discover {property.brandName}</p>
                <p className="mt-3 font-display text-5xl text-ivory sm:text-6xl">{caption}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!reducedMotion && band >= 4 && <Hotspots rooms={unit.rooms} />}
          <ResidencePanel units={property.units} unit={unit} visible={reducedMotion || band >= 4} reducedMotion={reducedMotion} onSelect={onSelect} />
        </>
      )}
    </FrameSequence>
  );
}
