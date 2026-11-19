"use client";

import type { Unit } from "@/data/units";

export default function UnitSelector({ units, selected, onSelect }: { units: Unit[]; selected: string; onSelect: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="Select a residence" className="mb-6 flex border-b border-champagne/30">
      {units.map((unit, index) => (
        <button key={unit.id} id={`tab-${unit.id}`} role="tab" aria-selected={selected === unit.id} aria-controls="residence-details" tabIndex={selected === unit.id ? 0 : -1}
          onClick={() => onSelect(unit.id)} onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? units.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + units.length) % units.length;
            onSelect(units[next].id);
            document.getElementById(`tab-${units[next].id}`)?.focus();
          }} className={`flex-1 border-b px-2 py-3 text-[10px] uppercase tracking-[0.1em] transition-colors ${selected === unit.id ? "border-champagne text-champagne" : "border-transparent text-ivory/60 hover:text-ivory"}`}>
          {unit.name}
        </button>
      ))}
    </div>
  );
}
