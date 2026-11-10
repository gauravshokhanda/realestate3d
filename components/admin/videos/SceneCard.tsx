"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { videoSettingsSchema, type SceneView, type VideosView } from "@/lib/jobs/schema";
import { adminApi } from "../api";
import { Field } from "../Fields";
import TrimEditor from "./TrimEditor";

export default function SceneCard({ scene, propertyId, veo, refresh }: { scene: SceneView; propertyId: string; veo: VideosView["veo"]; refresh: () => Promise<void> }) {
  const [prompt, setPrompt] = useState(scene.prompt), [settings, setSettings] = useState(scene.settings);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [trim, setTrim] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [approvalNote, setApprovalNote] = useState("");
  const url = `/api/admin/properties/${propertyId}/videos/${scene.id}`;
  const active = ["generating", "extracting"].includes(scene.status) || (scene.status === "queued" && (scene.mode === "veo" || Boolean(scene.videoUrl)));
  const status = scene.status === "queued" && !active ? "Awaiting MP4" : scene.status.replaceAll("_", " ");
  async function submit(body: unknown) { await adminApi(url, { method: "POST", body: JSON.stringify(body) }); await refresh(); }
  async function upload(file?: File) {
    if (!file || busy || active) return;
    setError(""); setNotice(""); setBusy(true);
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error("MP4 uploads are limited to 100 MB.");
      const parsed = videoSettingsSchema.parse(settings);
      // Prompt changes are saved without starting a rebuild of the previous source.
      if (prompt !== scene.prompt) await adminApi(url, { method: "POST", body: JSON.stringify({ action: "edit", prompt, settings: scene.settings }) });
      const form = new FormData(); form.append("file", file);
      await adminApi(`${url}/upload?${new URLSearchParams({ settings: JSON.stringify(parsed) })}`, { method: "POST", body: form });
      setNotice("MP4 uploaded. Extraction is automatic."); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  return <article className="admin-card admin-scene-card" aria-label={scene.label} data-video-scene={scene.key}>
    <div className="admin-section-heading"><div><p className="admin-eyebrow">{scene.key}</p><h3>{scene.label}</h3></div><span className={`admin-badge ${scene.status}`}>{status}</span></div>
    <div className="admin-video-endpoints">{[{ label: "Start frame", src: scene.fromImage }, { label: "End frame", src: scene.toImage }].map((image) => <figure key={image.label}><div><Image src={image.src} alt={`${scene.label} ${image.label.toLowerCase()}`} fill unoptimized sizes="500px" className="object-contain" /></div><figcaption>{image.label}</figcaption></figure>)}</div>
    <div className="admin-video-progress"><progress max={100} value={scene.progress} aria-label={`${scene.label} progress`} /><span>{scene.progress}%</span></div>
    {scene.error && <p role="alert" className={scene.status === "needs_review" ? "admin-notice" : "admin-error"}>{scene.error}</p>}
    {scene.status === "needs_review" && <section aria-label="End frame quality review" className="admin-card">
      <h4>Compare before approving</h4><p className="admin-notice">The extracted endpoint did not pass automatic quality review. Approval keeps these frames and allows publication; it does not fix the mismatch.</p>
      <div className="admin-video-endpoints">{[{ label: "Extracted last frame", src: scene.thumbnails.at(-1) }, { label: "Intended end image", src: scene.toImage }].map(({ label, src }) => src && <figure key={label}><div><Image src={src} alt={label} fill unoptimized sizes="500px" className="object-contain" /></div><figcaption>{label}</figcaption></figure>)}</div>
      <Field label="QC approval audit note" multiline maxLength={1000} value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} />
      <button type="button" className="admin-secondary" disabled={busy || approvalNote.trim().length < 8 || !scene.thumbnails.length} onClick={async () => {
        if (!window.confirm("Approve this endpoint mismatch anyway? These frames become publishable. Your note and the current quality warning will be saved in the audit history.")) return;
        setBusy(true); setError("");
        try { await submit({ action: "approve", expectedRevision: scene.revision, confirmMismatch: true, note: approvalNote }); setApprovalNote(""); setNotice("QC override recorded. Publish the property separately when ready."); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to approve."); } finally { setBusy(false); }
      }}>Approve anyway</button>
    </section>}
    {!!scene.analysis?.qcApprovals.length && <details><summary>QC approval history ({scene.analysis.qcApprovals.length})</summary><ol>{scene.analysis.qcApprovals.map((entry) => <li key={entry.at}><time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time> · {entry.actor}: {entry.note}<p className="admin-muted">Preserved warning: {entry.warning} · revision {entry.revision}</p></li>)}</ol></details>}
    <details className="admin-prompt"><summary>Edit prompt & watermark options</summary><Field label="Camera move prompt" multiline maxLength={6000} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <label className="admin-checkbox"><input type="checkbox" checked={settings.removeWatermark} onChange={(e) => setSettings({ ...settings, removeWatermark: e.target.checked })} /> Remove watermark</label><p className="admin-muted">Off by default. Box coordinates refer to a 1280×720 frame and scale to your source. This removes a visible sparkle, not embedded provenance.</p>
      {settings.removeWatermark && <div className="admin-logo-fields">{(["x", "y", "w", "h"] as const).map((field) => <Field key={field} label={`Watermark ${field}`} type="number" min={1} max={field === "w" || field === "h" ? 2000 : 10000} value={settings.delogo[field]} onChange={(e) => setSettings({ ...settings, delogo: { ...settings.delogo, [field]: Number(e.target.value) } })} />)}</div>}
      <button className="admin-secondary" disabled={busy || active} onClick={async () => { setBusy(true); setError(""); try { await submit({ action: "edit", prompt, settings: videoSettingsSchema.parse(settings) }); setNotice("Prompt and options saved. Changed watermark options rebuild an existing MP4."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save."); } finally { setBusy(false); } }}>Save prompt & options</button>
    </details>
    <div className="admin-video-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files[0]); }}><input ref={input} className="sr-only" type="file" accept="video/mp4,.mp4" aria-label={`Upload MP4 for ${scene.label}`} disabled={busy || active} onChange={(e) => { void upload(e.target.files?.[0]); }} /><button className="admin-secondary" disabled={busy || active} onClick={() => input.current?.click()}>{busy ? "Working…" : "Upload MP4"}</button><span>or drop your camera move here · up to 100 MB / 120s</span></div>
    {scene.thumbnails.length > 0 && <div className="admin-video-strip">{scene.thumbnails.map((src, index) => <figure key={index}><div><Image src={src} alt={`${scene.label} ${["first", "middle", "last"][index]} extracted frame`} fill unoptimized sizes="240px" className="object-contain" /></div><figcaption>{["First", "Middle", "Last"][index]}</figcaption></figure>)}</div>}
    <div className="admin-video-actions"><button className="admin-secondary" disabled={busy} onClick={async () => { try { await navigator.clipboard.writeText(prompt); setNotice("Prompt copied."); } catch { setError("Clipboard unavailable. Select and copy the prompt in Edit prompt."); } }}>Copy prompt</button>
      <button className="admin-secondary" disabled={busy || active} onClick={async () => { if (!veo.enabled) { input.current?.click(); return; } if (!window.confirm("This will call the paid Gemini API for 1 video (8 seconds, 720p). Pricing depends on your configured model and account. Continue?")) return; setBusy(true); setError(""); try { await submit({ action: "generate", confirmPaid: true }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to generate."); } finally { setBusy(false); } }} title={veo.enabled ? "Generate a new paid video" : "Upload a replacement MP4 in Manual mode"}>Regenerate</button>
      <button className="admin-secondary" disabled={!scene.videoUrl || busy || active} onClick={() => setTrim(!trim)}>Trim</button>{scene.videoUrl && <a className="admin-secondary" href={`${scene.videoUrl}?download=1`} download>Download MP4</a>}
    </div><p className="admin-muted">{scene.frameCount ?? 0} desktop frames · {scene.mobileFrameCount ?? 0} mobile frames{scene.duration ? ` · ${scene.duration.toFixed(2)}s source` : ""}{scene.trimStart !== null && scene.trimEnd !== null ? ` · trim ${scene.trimStart.toFixed(2)}–${scene.trimEnd.toFixed(2)}s` : ""}</p>
    {trim && scene.videoUrl && <TrimEditor scene={scene} settings={settings} submit={submit} close={() => setTrim(false)} />}
    <div aria-live="polite">{notice && <p className="admin-muted">{notice}</p>}{error && <p role="alert" className="admin-error">{error}</p>}</div>
  </article>;
}
