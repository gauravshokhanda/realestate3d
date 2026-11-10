"use client";
import type { AdminProperty } from "@/lib/admin/schema";
import { Field } from "./Fields";
export default function Units({ data, change, errors }: { data: AdminProperty; change: (data: AdminProperty) => void; errors: Record<string, string> }) {
  const update = (index: number, patch: Partial<AdminProperty["units"][number]>) => change({ ...data, units: data.units.map((unit, i) => i === index ? { ...unit, ...patch } : unit) });
  return <section className="admin-card"><p className="admin-eyebrow">03 / Residences</p><div className="admin-section-heading"><div><h2>Room for possibility</h2><p>Define the residences available at this address.</p></div><button className="admin-secondary" disabled={data.units.length >= 20} onClick={() => change({ ...data, units: [...data.units, { id: crypto.randomUUID(), name: `Residence ${data.units.length + 1}`, beds: 3, baths: 3, sqft: 2000, price: "Price on request" }] })}>+ Add unit</button></div>
    {errors.units && <p className="admin-error">{errors.units}</p>}{!data.units.length && <p className="admin-empty">Add your first residence to begin.</p>}
    {data.units.map((unit, index) => <fieldset className="admin-nested" key={unit.id}><legend>{unit.name || `Unit ${index + 1}`}</legend><div className="admin-form-grid">
      <Field label="Unit name" value={unit.name} error={errors[`units.${index}.name`]} onChange={(e) => update(index, { name: e.target.value })} />
      <Field label="Price" value={unit.price} error={errors[`units.${index}.price`]} onChange={(e) => update(index, { price: e.target.value })} />
      {(["beds", "baths", "sqft"] as const).map((key) => <Field key={key} label={key === "sqft" ? "Square feet" : key === "beds" ? "Bedrooms" : "Bathrooms"} type="number" min={key === "sqft" ? 1 : 0} step={1} max={key === "sqft" ? 1000000 : 20} value={unit[key]} error={errors[`units.${index}.${key}`]} onChange={(e) => update(index, { [key]: e.target.value === "" ? 0 : Number(e.target.value) })} />)}
    </div><button className="admin-danger-link" onClick={() => { if (window.confirm(`Delete ${unit.name}?`)) change({ ...data, units: data.units.filter((u) => u.id !== unit.id) }); }}>Delete unit</button></fieldset>)}
  </section>;
}
