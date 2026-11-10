"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Field } from "./Fields";
import { adminApi } from "./api";
export default function SlugField({ slug, id, onChange, error }: { slug: string; id?: string; onChange: (value: string) => void; error?: string }) {
  const [status, setStatus] = useState("");
  useEffect(() => {
    const controller = new AbortController(); setStatus("Checking address…");
    const timer = setTimeout(async () => {
      try {
        const result = z.object({ available: z.boolean() }).parse(await adminApi(`/api/admin/slugs?${new URLSearchParams({ slug, ...(id ? { id } : {}) })}`, { signal: controller.signal }));
        setStatus(result.available ? "Address available" : "This address is already in use");
      } catch (cause) { if (!controller.signal.aborted) setStatus(cause instanceof Error ? cause.message : "Unable to check address"); }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [slug, id]);
  return <div><Field label="Property slug" value={slug} onChange={(e) => onChange(e.target.value)} error={error} maxLength={80} required /><small aria-live="polite" className="admin-muted">/{slug || "your-property"} · {status}</small></div>;
}
