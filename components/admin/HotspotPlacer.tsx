"use client";
import Image from "next/image";
import { useState } from "react";
import type { AdminProperty } from "@/lib/admin/schema";
import { Field } from "./Fields";
export default function HotspotPlacer({ data, change }: { data: AdminProperty; change: (data: AdminProperty) => void }) {
  const [selected, setSelected] = useState(data.rooms[0]?.id ?? "");
  const current = data.rooms.find((room) => room.id === selected) ?? data.rooms[0];
  function place(x: number, y: number) { if (current) change({ ...data, rooms: data.rooms.map((room) => room.id === current.id ? { ...room, hotspotX: Math.max(0, Math.min(100, x)), hotspotY: Math.max(0, Math.min(100, y)) } : room) }); }
  return <section className="admin-nested"><h3>Place the room hotspots</h3><p>Choose a room, then click its position on the floor plan. Use arrow keys on the plan or enter precise percentages.</p>
    {!data.planImage ? <p className="admin-notice">Upload a floor-plan image in Images to place hotspots.</p> : !current ? <p>Add a room first.</p> : <>
      <label className="admin-field"><span>Room to position</span><select value={current.id} onChange={(e) => setSelected(e.target.value)}>{data.rooms.map((room) => <option key={room.id} value={room.id}>{room.label}</option>)}</select></label>
      <div role="application" tabIndex={0} aria-label={`Hotspot floor plan for ${current.label}. Click or use arrow keys to move the selected hotspot.`} className="admin-plan" onKeyDown={(e) => { const steps: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }; const delta = steps[e.key]; if (delta) { e.preventDefault(); place(current.hotspotX + delta[0], current.hotspotY + delta[1]); } }} onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); place((e.clientX - rect.left) / rect.width * 100, (e.clientY - rect.top) / rect.height * 100); }}>
        <Image src={data.planImage} alt="Floor plan for hotspot positioning" width={1600} height={900} unoptimized className="block h-auto w-full" />
        {data.rooms.map((room, i) => <button type="button" className={`admin-plan-dot ${room.id === current.id ? "active" : ""}`} style={{ left: `${room.hotspotX}%`, top: `${room.hotspotY}%` }} title={room.label} aria-label={`Select ${room.label} hotspot`} key={room.id} onClick={(e) => { e.stopPropagation(); setSelected(room.id); }}>{i + 1}</button>)}
      </div><div className="admin-form-grid"><Field label="Hotspot X (%)" type="number" min={0} max={100} step={0.1} value={Math.round(current.hotspotX * 10) / 10} onChange={(e) => place(Number(e.target.value), current.hotspotY)} /><Field label="Hotspot Y (%)" type="number" min={0} max={100} step={0.1} value={Math.round(current.hotspotY * 10) / 10} onChange={(e) => place(current.hotspotX, Number(e.target.value))} /></div>
    </>}
  </section>;
}
