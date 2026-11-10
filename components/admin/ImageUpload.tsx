"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { z } from "zod";
import { adminApi } from "./api";
export default function ImageUpload({ propertyId, label, value, onChange, error, kind = "image", allowRemove = true }: { propertyId: string; label: string; value: string | null; onChange: (value: string | null) => void; error?: string; kind?: "image" | "panorama"; allowRemove?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [warnings, setWarnings] = useState<string[]>([]), [dragging, setDragging] = useState(false);
  async function upload(file?: File) {
    if (!file || busy) return;
    setMessage(""); setWarnings([]);
    if (file.size > 25 * 1024 * 1024) { setMessage("Images must be 25 MB or smaller."); return; }
    setBusy(true);
    try {
      const form = new FormData(); form.append("file", file);
      const result = z.object({ url: z.string(), width: z.number(), height: z.number(), warnings: z.array(z.string()) }).parse(await adminApi(`/api/admin/upload?propertyId=${encodeURIComponent(propertyId)}&kind=${kind}`, { method: "POST", body: form }));
      onChange(result.url); setWarnings(result.warnings);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to upload image."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  return <div className="admin-upload-field"><p className="admin-field-title">{label}</p><div className={`admin-dropzone ${dragging ? "dragging" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files[0]); }}>
    {value && <div className="admin-image-preview"><Image src={value} alt={`${label} preview`} fill unoptimized sizes="600px" className="object-contain" /></div>}
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/tiff" aria-label={`Upload ${label.toLowerCase()}`} disabled={busy} className="sr-only" onChange={(e) => { void upload(e.target.files?.[0]); }} />
    <button type="button" className="admin-secondary" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : value ? `Replace ${label.toLowerCase()}` : `Choose ${label.toLowerCase()}`}</button><small>or drop an image here · up to 25 MB</small>
    {value && allowRemove && <button type="button" className="admin-danger-link" disabled={busy} onClick={() => { if (window.confirm(`Remove ${label.toLowerCase()}?`)) { onChange(null); setWarnings([]); } }}>Remove image</button>}
  </div><div aria-live="polite">{(error || message) && <p role="alert" className="admin-error">{error || message}</p>}{warnings.map((warning) => <p className="admin-notice" key={warning}>{warning}</p>)}</div></div>;
}
