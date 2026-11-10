"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
const schema = z.discriminatedUnion("available", [z.object({ available: z.literal(false) }), z.object({ available: z.literal(true), free: z.number(), total: z.number(), properties: z.array(z.object({ name: z.string(), bytes: z.number() })), measuredAt: z.string() })]);
export default function StorageSummary() {
  const [text, setText] = useState("Checking storage…");
  useEffect(() => {
    const abort = new AbortController();
    const update = async () => {
      try {
        const response = await fetch("/api/admin/storage", { signal: abort.signal }); if (!response.ok) throw new Error();
        const value = schema.parse(await response.json());
        if (!value.available) { setText("Storage: capacity reporting unavailable for this adapter."); return; }
        setText(`Storage: ${(value.free / 1024 ** 3).toFixed(2)} GB free of ${(value.total / 1024 ** 3).toFixed(1)} GB${value.free < 2 * 1024 ** 3 ? " — uploads and extraction paused: minimum 2 GB free required" : ""}. Property-owned media: ${value.properties.map((p) => `${p.name}: ${(p.bytes / 1048576).toFixed(1)} MiB`).join(" · ")}. Shared assets are counted under their owner; usage refreshes every 30s.`);
      } catch { if (!abort.signal.aborted) setText("Storage: unable to read capacity. Refresh to retry."); }
    };
    void update(); const timer = setInterval(() => { void update(); }, 30000);
    return () => { abort.abort(); clearInterval(timer); };
  }, []);
  return <footer aria-label="Storage status" className="admin-storage-footer">{text}</footer>;
}
