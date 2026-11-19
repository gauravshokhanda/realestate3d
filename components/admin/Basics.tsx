"use client";
import type { AdminProperty } from "@/lib/admin/schema";
import { Field } from "./Fields";
import SlugField from "./SlugField";
export default function Basics({ data, change, errors }: { data: AdminProperty; change: (data: AdminProperty) => void; errors: Record<string, string> }) {
  return <section className="admin-card"><p className="admin-eyebrow">01 / The essentials</p><h2>A distinct identity</h2><p>The details that introduce your property to the world.</p><div className="admin-form-grid">
    <Field label="Property name" value={data.name} maxLength={120} required error={errors.name} onChange={(e) => change({ ...data, name: e.target.value })} />
    <SlugField id={data.id} slug={data.slug} error={errors.slug} onChange={(slug) => change({ ...data, slug })} />
    <Field label="Tagline" value={data.tagline} maxLength={250} onChange={(e) => change({ ...data, tagline: e.target.value })} />
    <Field label="Location" value={data.location} maxLength={250} onChange={(e) => change({ ...data, location: e.target.value })} />
    <Field label="Hero copy" multiline value={data.heroCopy} maxLength={1000} onChange={(e) => change({ ...data, heroCopy: e.target.value })} />
    <div><Field label="Accent colour" value={data.accentColor} maxLength={7} error={errors.accentColor} onChange={(e) => change({ ...data, accentColor: e.target.value })} /><label className="admin-colour"><input type="color" aria-label="Choose accent colour" value={/^#[0-9a-f]{6}$/i.test(data.accentColor) ? data.accentColor : "#D8B67A"} onChange={(e) => change({ ...data, accentColor: e.target.value })} /><span>Champagne, or a shade of your own.</span></label></div>
  </div><div className="admin-notice">Publish from the top bar once your tower, floor plan, units and room images are ready. New properties use still images until video sequences are available.</div></section>;
}
