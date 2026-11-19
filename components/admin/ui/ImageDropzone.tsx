"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { z } from "zod";
import { adminApi } from "../api";
import { Button } from "./controls";

const uploadResult = z.object({ url: z.string(), warnings: z.array(z.string()) });
export default function ImageDropzone({ label, value, url, onChange }: { label: string; value: string | null; url: string; onChange: (value: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null), id = useId();
  const [busy, setBusy] = useState(false), [drag, setDrag] = useState(false), [error, setError] = useState(""), [warnings, setWarnings] = useState<string[]>([]);
  async function upload(file?: File) {
    if (!file || busy) return;
    setBusy(true); setError(""); setWarnings([]);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error("Images must be 25 MB or smaller.");
      const body = new FormData();
      body.set("file", file);
      const result = uploadResult.parse(await adminApi(url, { method: "POST", body }));
      onChange(result.url); setWarnings(result.warnings);
    } catch (error) { setError(error instanceof Error ? error.message : "Upload failed."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  return <div className="crm-image-field">
    <span id={id}>{label}</span>
    <div role="group" aria-labelledby={id} className={`crm-dropzone ${drag ? "dragging" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(event) => { event.preventDefault(); setDrag(false); void upload(event.dataTransfer.files[0]); }}>
      {value && <div className="crm-drop-preview"><Image src={value} alt={`${label} preview`} fill unoptimized sizes="500px" /></div>}
      <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/tiff" aria-label={`Upload ${label.toLowerCase()}`} disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} />
      <div className="crm-actions">
        <Button onClick={() => input.current?.click()} disabled={busy}>{busy ? "Uploading…" : value ? "Replace image" : "Choose image"}</Button>
        {value && <Button disabled={busy} onClick={() => { setWarnings([]); onChange(null); }}>Remove</Button>}
      </div>
      {!value && <small>Drop an image here or choose a file</small>}
    </div>
    {error && <small role="alert" className="crm-field-error">{error}</small>}
    {warnings.length > 0 && <ul className="crm-upload-warnings" aria-label="Image warnings">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
  </div>;
}
