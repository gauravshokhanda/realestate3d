"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Waves, Dumbbell, Wine, BellRing, Clapperboard, Flower2 } from "lucide-react";
import type { Amenity } from "@/lib/property-types";

const icons = { Waves, Dumbbell, Wine, BellRing, Clapperboard, Flower2 };

export default function Amenities({ amenities }: { amenities: Amenity[] }) {
  const reduced = useReducedMotion();
  return (
    <section id="amenities" className="border-t border-champagne/20 bg-ink px-6 py-24 sm:px-12 sm:py-32 lg:px-20">
      <p className="text-[10px] uppercase tracking-[0.3em] text-champagne">Life, considered</p>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
        <h2 className="max-w-2xl font-display text-5xl leading-none text-ivory sm:text-7xl">Every day,<br />a little extraordinary.</h2>
        <p className="max-w-sm text-sm leading-7 text-ivory/65">Places to retreat, reconnect, and make the most of the everyday. All within reach of home.</p>
      </div>
      <div className="mt-16 grid gap-px overflow-hidden border border-champagne/20 bg-champagne/20 sm:grid-cols-2 lg:grid-cols-3">
        {amenities.map(({ title: name, icon, text: description }, index) => {
          const Icon = icons[icon];
          return (
          <motion.article key={name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: reduced ? 0 : 0.6, delay: reduced ? 0 : (index % 3) * 0.08 }} className="amenity-card bg-ink p-8 motion-reduce:!transform-none motion-reduce:!opacity-100 sm:p-10">
            <span className="amenity-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <Icon aria-hidden="true" size={28} strokeWidth={1} className="text-champagne" />
            <h3 className="mt-8 font-display text-3xl text-ivory">{name}</h3>
            <p className="mt-4 max-w-xs text-sm leading-7 text-ivory/65">{description}</p>
          </motion.article>
        ); })}
      </div>
    </section>
  );
}
