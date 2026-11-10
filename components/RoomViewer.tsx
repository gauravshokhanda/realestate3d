"use client";

import { useEffect, useRef, useState } from "react";
import FrameSequence from "@/components/FrameSequence";
import type { Room } from "@/data/units";
import type { Scene } from "@/data/scenes";
import { scrollToSection } from "@/lib/scroll";
import type { PropertyView } from "@/lib/property-types";
import TourLauncher from "@/components/panorama/TourLauncher";

export default function RoomViewer({ property, room, scene, prefetch, withinWindow, onHalf }: { property: PropertyView; room: Room; scene: Scene; prefetch: boolean; withinWindow: boolean; onHalf: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [idlePrefetch, setIdlePrefetch] = useState(false);
  const halfRef = useRef(false);
  useEffect(() => {
    if (!prefetch) { setIdlePrefetch(false); return; }
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setIdlePrefetch(true), { timeout: 500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(() => setIdlePrefetch(true), 100);
    return () => clearTimeout(id);
  }, [prefetch]);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setNear(entry.isIntersecting);
    }, { rootMargin: "300px" });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} id={`room-${room.id}`}>
      <FrameSequence property={property} scene={scene} enabled={withinWindow && (near || (prefetch && idlePrefetch))} onProgress={(value) => {
        const half = value >= 0.5 && value < 1;
        if (half && !halfRef.current) onHalf();
        halfRef.current = half;
      }}>
        {(reducedMotion, landed) => (
          <div className={reducedMotion ? "relative flex flex-wrap items-center justify-between gap-5 bg-ink p-6 sm:p-12" : "absolute inset-x-6 bottom-10 flex flex-wrap items-end justify-between gap-5 sm:inset-x-12 lg:inset-x-20"}>
            <div className={`${near || reducedMotion ? "room-caption" : ""} border border-champagne/40 bg-ink/80 px-6 py-4 backdrop-blur-xl`}>
              <p className="text-[9px] uppercase tracking-[0.25em] text-champagne">A closer look</p>
              <h2 className="mt-2 font-display text-3xl text-ivory sm:text-4xl">{room.label}</h2>
            </div>
            <TourLauncher property={property} roomId={room.id} landed={reducedMotion || landed} />
            <a href="#residences" onClick={(event) => { event.preventDefault(); scrollToSection("residences"); }} className="border-b border-champagne bg-ink/80 px-3 py-2 text-xs uppercase tracking-[0.14em] text-champagne">← Back to plan</a>
          </div>
        )}
      </FrameSequence>
    </div>
  );
}
