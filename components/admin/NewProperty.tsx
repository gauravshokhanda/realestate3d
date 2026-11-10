"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { createPropertySchema, slugify } from "@/lib/admin/schema";
import { adminApi, ApiError } from "./api";
import { Field } from "./Fields";
import SlugField from "./SlugField";
export default function NewProperty() {
  const [name, setName] = useState(""), [slug, setSlug] = useState(""), [manual, setManual] = useState(false);
  const [error, setError] = useState(""), [errors, setErrors] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false);
  const router = useRouter();
  return <form className="admin-card admin-new" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setErrors({});
    const parsed = createPropertySchema.safeParse({ name, slug });
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]))); setBusy(false); return; }
    try { const created = z.object({ id: z.string() }).parse(await adminApi("/api/admin/properties", { method: "POST", body: JSON.stringify(parsed.data) })); router.push(`/admin/properties/${created.id}`); router.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create property."); if (cause instanceof ApiError) setErrors(cause.errors); setBusy(false); }
  }}><p className="admin-eyebrow">A new address</p><h1>Create a property</h1><p>Start with a name. Your draft stays private until you publish.</p>
    <Field label="Property name" value={name} maxLength={120} required error={errors.name} onChange={(e) => { setName(e.target.value); if (!manual) setSlug(slugify(e.target.value)); }} />
    <SlugField slug={slug} onChange={(value) => { setManual(true); setSlug(value); }} error={errors.slug} />
    {error && <p role="alert" className="admin-error">{error}</p>}<button className="admin-primary" disabled={busy}>{busy ? "Creating…" : "Create draft"}</button>
  </form>;
}
