"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { developmentCreate, idSchema } from "@/lib/admin/development-schema";
import { slugify } from "@/lib/admin/schema";
import { adminApi, ApiError } from "../api";
import { Button, buttonClass, Field, Input } from "../ui/controls";
import { Card, Toast } from "../ui/surfaces";
import DevelopmentSlug from "./DevelopmentSlug";

export default function NewDevelopment() {
  const router = useRouter();
  const [name, setName] = useState(""), [slug, setSlug] = useState(""), [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [errors, setErrors] = useState<Record<string, string>>({});
  return <div className="crm-form-narrow">
    <div className="crm-heading"><div><h1>New development</h1><p>Create an address for the building and its properties.</p></div></div>
    <Card><form className="crm-form" onSubmit={async (event) => {
      event.preventDefault();
      if (busy) return;
      setMessage(""); setErrors({});
      const parsed = developmentCreate.safeParse({ name, slug });
      if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]))); return; }
      setBusy(true);
      try {
        const { id } = z.object({ id: idSchema }).parse(await adminApi("/api/admin/developments", { method: "POST", body: JSON.stringify(parsed.data) }));
        router.push(`/admin/developments/${id}`);
      } catch (error) {
        if (error instanceof ApiError) setErrors(error.errors);
        setMessage(error instanceof Error ? error.message : "Unable to create the development.");
        setBusy(false);
      }
    }}>
      <Toast message={message} variant="alert" />
      <Field id="development-name" label="Development name" error={errors.name}>
        <Input id="development-name" required maxLength={120} value={name} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "development-name-error" : undefined} onChange={(event) => {
          setName(event.target.value); if (!custom) setSlug(slugify(event.target.value).replace(/-$/, ""));
        }} />
      </Field>
      <DevelopmentSlug slug={slug} error={errors.slug} onChange={(value) => { setCustom(true); setSlug(value); }} />
      <div className="crm-actions"><Button type="submit" variant="primary" disabled={busy}>{busy ? "Creating…" : "Create development"}</Button>
        <Link className={buttonClass()} href="/admin/developments">Cancel</Link></div>
    </form></Card>
  </div>;
}
