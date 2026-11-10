"use client";
import { slugify, type AdminProperty } from "@/lib/admin/schema";
import { Field } from "./Fields";
import ImageUpload from "./ImageUpload";
import HotspotPlacer from "./HotspotPlacer";
export default function Rooms({ data, change, errors, imageChange }: { data: AdminProperty; change: (data: AdminProperty) => void; errors: Record<string, string>; imageChange: (id: string, url: string | null) => void }) {
  const update = (index: number, patch: Partial<AdminProperty["rooms"][number]>) => change({ ...data, rooms: data.rooms.map((room, i) => i === index ? { ...room, ...patch } : room) });
  const move = (index: number, by: number) => { const rooms = [...data.rooms]; [rooms[index], rooms[index + by]] = [rooms[index + by], rooms[index]]; change({ ...data, rooms }); };
  return <section className="admin-card"><p className="admin-eyebrow">04 / The spaces within</p><div className="admin-section-heading"><div><h2>Every room, considered</h2><p>Add up to eight rooms, then place their floor-plan hotspots.</p></div><button className="admin-secondary" disabled={data.rooms.length >= 8} onClick={() => { let n = data.rooms.length + 1; while (data.rooms.some((r) => r.key === `room-${n}`)) n++; change({ ...data, rooms: [...data.rooms, { id: crypto.randomUUID(), key: `room-${n}`, label: `Room ${n}`, description: "", image: null, hotspotX: 50, hotspotY: 50 }] }); }}>+ Add room</button></div>
    {errors.rooms && <p className="admin-error">{errors.rooms}</p>}{!data.rooms.length && <p className="admin-empty">Add a room to build your tour.</p>}
    {data.rooms.map((room, index) => <fieldset className="admin-nested" key={room.id}><legend>{index + 1}. {room.label}</legend><div className="admin-room-actions"><button className="admin-secondary" aria-label={`Move ${room.label} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button className="admin-secondary" aria-label={`Move ${room.label} down`} disabled={index === data.rooms.length - 1} onClick={() => move(index, 1)}>↓</button><button className="admin-danger-link" onClick={() => { if (window.confirm(`Delete ${room.label} and its viewpoints?`)) change({ ...data, rooms: data.rooms.filter((r) => r.id !== room.id) }); }}>Delete room</button></div><div className="admin-form-grid">
      <Field label="Room label" value={room.label} error={errors[`rooms.${index}.label`]} onChange={(e) => { const label = e.target.value; const auto = room.key === slugify(room.label) || /^room-\d+$/.test(room.key); update(index, { label, ...(auto ? { key: slugify(label) } : {}) }); }} />
      <Field label="Room key" value={room.key} error={errors[`rooms.${index}.key`]} onChange={(e) => update(index, { key: e.target.value })} />
      <Field label="Short room description" multiline value={room.description} maxLength={1000} error={errors[`rooms.${index}.description`]} onChange={(e) => update(index, { description: e.target.value })} />
      <ImageUpload propertyId={data.id} label={`${room.label} image`} value={room.image} error={errors[`rooms.${index}.image`]} onChange={(url) => imageChange(room.id, url)} />
    </div></fieldset>)}
    <HotspotPlacer data={data} change={change} />
  </section>;
}
