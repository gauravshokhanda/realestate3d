"use client";

import type { Room } from "@/data/units";
import { scrollToSection } from "@/lib/scroll";

export default function Hotspots({ rooms }: { rooms: Room[] }) {
  return (
    <div className="pointer-events-none absolute inset-x-4 top-24 h-[34%] md:inset-0 md:h-auto" aria-label="Explore rooms">
      {rooms.map((room) => (
        <button key={room.id} type="button" aria-label={`Explore ${room.label}`} onClick={() => scrollToSection(`room-${room.id}`)} style={{ left: `${room.hotspot.x}%`, top: `${room.hotspot.y}%` }} className="group pointer-events-auto absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-champagne/70 bg-ink/70 text-champagne backdrop-blur">
          <span className="hotspot-ring absolute inset-1 rounded-full border border-champagne/50" aria-hidden="true" />
          <span aria-hidden="true">+</span>
          <span role="tooltip" className="pointer-events-none absolute bottom-full mb-3 whitespace-nowrap border border-champagne/40 bg-ink/95 px-3 py-2 text-xs text-ivory opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{room.label}</span>
        </button>
      ))}
    </div>
  );
}
