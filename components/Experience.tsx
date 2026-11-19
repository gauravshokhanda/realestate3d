"use client";

import { useEffect, useRef, useState } from "react";
import FloorPlanScene from "@/components/FloorPlanScene";
import RoomViewer from "@/components/RoomViewer";
import type { PropertyView } from "@/lib/property-types";
import Amenities from "@/components/Amenities";
import ContactForm from "@/components/ContactForm";
import { refreshSequences } from "@/lib/refresh";

export default function Experience({ property }: { property: PropertyView }) {
  const { scenes, units } = property;
  const [selected, setSelected] = useState(units[0].id);
  const [prefetchRoom, setPrefetchRoom] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const tour = useRef<HTMLDivElement>(null);
  const unit = units.find((item) => item.id === selected) ?? units[0];
  useEffect(() => {
    const element = tour.current;
    const update = (event: Event) => {
      if (!(event.target instanceof HTMLElement)) return;
      const id = event.target.closest<HTMLElement>("[data-scene]")?.dataset.scene;
      const index = id === unit.floorPlanSequence ? 0 : unit.rooms.findIndex((room) => room.sequence === id) + 1;
      setActiveIndex(index);
    };
    element?.addEventListener("sequence-enter", update);
    return () => element?.removeEventListener("sequence-enter", update);
  }, [unit]);
  useEffect(() => { refreshSequences(); }, [selected]);
  return (
    <div ref={tour}>
      <div id="residences"><FloorPlanScene property={property} scene={scenes.find((scene) => scene.id === unit.floorPlanSequence)!} unit={unit} onSelect={setSelected} onHalf={() => setPrefetchRoom(unit.rooms[0]?.id ?? null)} /></div>
      <div id="rooms" aria-label={`${unit.name} room views`}>
        {unit.rooms.map((room, index) => {
          const scene = scenes.find((item) => item.id === room.sequence);
          return scene ? <RoomViewer property={property} key={room.id} room={room} scene={scene} withinWindow={Math.abs(index + 1 - activeIndex) <= 1} prefetch={prefetchRoom === room.id} onHalf={() => setPrefetchRoom(unit.rooms[index + 1]?.id ?? null)} /> : null;
        })}
      </div>
      <Amenities amenities={property.amenities} />
      <ContactForm property={property} selectedUnit={unit.id} />
      <footer className="flex flex-wrap justify-between gap-5 border-t border-champagne/20 px-6 py-10 text-[10px] uppercase tracking-[0.2em] text-ivory/45 sm:px-12 lg:px-20"><span>{property.name}</span><span>{property.footerTagline}</span></footer>
    </div>
  );
}
