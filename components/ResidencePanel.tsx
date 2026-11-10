"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Unit } from "@/data/units";
import CountValue from "./CountValue";
import UnitSelector from "@/components/UnitSelector";

type Props = { units: Unit[]; unit: Unit; visible: boolean; reducedMotion: boolean; onSelect: (id: string) => void };

export default function ResidencePanel({ units, unit, visible, reducedMotion, onSelect }: Props) {
  return (
    <aside
      style={{ opacity: visible ? 1 : 0, transform: `translateY(${visible || reducedMotion ? 0 : 20}px)`, transition: reducedMotion ? "none" : "opacity .8s cubic-bezier(.455,.03,.515,.955), transform .8s cubic-bezier(.455,.03,.515,.955)" }}
      aria-hidden={!visible}
      inert={!visible}
      aria-label={`${unit.name} specifications`}
      className={`residence-panel ${reducedMotion ? "relative mx-6 mb-12 sm:mx-12 lg:mx-20 lg:max-w-sm" : "absolute inset-x-4 bottom-6 md:inset-x-auto md:bottom-auto md:right-12 md:top-1/3 md:w-80 lg:right-20"} border border-champagne/60 bg-ink/75 p-6 backdrop-blur-xl sm:p-8`}
    >
      <UnitSelector units={units} selected={unit.id} onSelect={onSelect} />
      <AnimatePresence mode="wait" initial={false}>
      <motion.div key={unit.id} id="residence-details" role="tabpanel" aria-labelledby={`tab-${unit.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.25 }}>
      <p className="text-[10px] uppercase tracking-[0.25em] text-champagne">Your private sanctuary</p>
      <h2 className="mt-3 font-display text-4xl text-ivory">{unit.name}</h2>
      <dl className="mt-6 grid grid-cols-3 gap-3 border-y border-champagne/25 py-5">
        {[{ label: "Beds", value: unit.beds }, { label: "Baths", value: unit.baths }, { label: "Sq ft", value: unit.sqft.toLocaleString("en-US") }].map(({ label, value }) => (
          <div key={label}>
            <dt className="text-[9px] uppercase tracking-[0.15em] text-ivory/65">{label}</dt>
            <dd className="mt-2 font-display text-3xl text-ivory">{label === "Sq ft" ? <CountValue value={String(value)} active={visible} reduced={reducedMotion} /> : value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-sm text-champagne"><CountValue value={unit.price} active={visible} reduced={reducedMotion} /></p>
      </motion.div>
      </AnimatePresence>
    </aside>
  );
}
