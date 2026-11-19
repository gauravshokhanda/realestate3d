"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { slugSchema } from "@/lib/property-validation";
import { adminApi } from "../api";
import { Field, Input } from "../ui/controls";

const availability = z.object({ available: z.boolean() });
export default function DevelopmentSlug({ slug, developmentId, error, onChange }: { slug: string; developmentId?: string; error?: string; onChange: (value: string) => void }) {
  const [result, setResult] = useState<{ slug: string; available: boolean } | null>(null);
  useEffect(() => {
    if (!slugSchema.safeParse(slug).success) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const query = new URLSearchParams({ slug, ...(developmentId ? { id: developmentId } : {}) });
      try {
        const response = availability.parse(await adminApi(`/api/admin/slugs?${query}`, { signal: controller.signal }));
        if (!controller.signal.aborted) setResult({ slug, available: response.available });
      } catch { /* The mutation still validates uniqueness on the server. */ }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [slug, developmentId]);
  const resultError = error || (result?.slug === slug && !result.available ? "That address is already in use." : undefined);
  const help = result?.slug === slug && result.available ? `Address available · /${slug}` : "Use lowercase letters, numbers, and hyphens.";
  return <Field id="development-slug" label="Slug" help={help} error={resultError}>
    <Input id="development-slug" required maxLength={80} value={slug} aria-invalid={Boolean(resultError)}
      aria-describedby={resultError ? "development-slug-error" : "development-slug-help"} onChange={(event) => onChange(event.target.value)} />
  </Field>;
}
