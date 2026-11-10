"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type AdminProperty } from "@/lib/admin/schema";
import { useEditor } from "./useEditor";
import Basics from "./Basics";
import Units from "./Units";
import Rooms from "./Rooms";
import ImageUpload from "./ImageUpload";
import AmenitiesEditor from "./AmenitiesEditor";
import Panoramas, { type PanoramaEditorHandle } from "./panoramas/Panoramas";
import { adminApi } from "./api";
import Videos from "./videos/Videos";

const tabs = ["Basics", "Images", "Units", "Rooms", "Amenities", "360° Walkthrough", "Videos"];
export default function Editor({ initial }: { initial: AdminProperty }) {
  const { data, change: updateData, save, state, error, errors, latest, restoreStatus, refresh } = useEditor(initial);
  const [tab, setTab] = useState("Basics"), [actionError, setActionError] = useState(""), [busy, setBusy] = useState(false);
  const router = useRouter();
  const panoramas = useRef<PanoramaEditorHandle>(null);
  async function saveAll() { if (!await save()) return false; return await panoramas.current?.save() ?? true; }
  const change = (next: AdminProperty) => { setActionError(""); updateData(next); };
  const props = { data, change, errors };
  const imageChange = (field: "towerImage" | "planImage", url: string | null) => change({ ...latest.current, [field]: url });
  const roomImageChange = (id: string, url: string | null) => change({ ...latest.current, rooms: latest.current.rooms.map((r) => r.id === id ? { ...r, image: url } : r) });
  async function togglePublish() {
    setBusy(true); setActionError("");
    if (!await saveAll()) { setBusy(false); return; }
    const previous = latest.current.status;
    change({ ...latest.current, status: latest.current.status === "published" ? "draft" : "published" });
    const ok = await save();
    if (!ok) { restoreStatus(previous); setActionError("Publication did not change. Check the validation messages below."); }
    router.refresh(); setBusy(false);
  }
  return <>
    <div className="admin-breadcrumb"><button onClick={async () => { if (await saveAll()) { router.push("/admin"); router.refresh(); } }}>← All properties</button><span>Property editor</span></div>
    <div className="admin-page-heading"><div><p className="admin-eyebrow">Your property, in focus</p><h1>{data.name || "Untitled property"}</h1><p>/{data.slug} <span className={`admin-badge ${data.status}`}>{data.status}</span></p></div><div className="admin-toolbar"><span className="admin-save-state" role="status" aria-live="polite">{state}</span><button className="admin-secondary" onClick={() => { void saveAll(); }}>Save now</button>{data.status === "published" && <a className="admin-secondary" href={`/${data.slug}`} target="_blank" rel="noreferrer">View property ↗</a>}<button className="admin-primary" disabled={busy} onClick={() => { void togglePublish(); }}>{busy ? "Updating…" : data.status === "published" ? "Unpublish" : "Publish property"}</button></div></div>
    {(error || actionError) && <div role="alert" className="admin-error-summary"><p>{error || actionError}</p>{Object.entries(errors).map(([key, message]) => <p key={key}><strong>{key}:</strong> {message}</p>)}<button className="admin-secondary" onClick={() => { void save(); }}>Retry save</button></div>}
    <div className="admin-editor-layout"><div className="admin-tabs" role="tablist" aria-label="Property sections">{tabs.map((name, index) => <button role="tab" aria-selected={tab === name} aria-controls="property-panel" id={`property-tab-${index}`} key={name} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={(e) => { if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(e.key)) { e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (index + (["ArrowDown", "ArrowRight"].includes(e.key) ? 1 : -1) + tabs.length) % tabs.length; setTab(tabs[next]); document.getElementById(`property-tab-${next}`)?.focus(); } }}><span>{String(index + 1).padStart(2, "0")}</span>{name}</button>)}</div>
      <div id="property-panel" role="tabpanel" aria-labelledby={`property-tab-${tabs.indexOf(tab)}`} tabIndex={0} className="admin-panel">
        {tab === "Basics" && <Basics {...props} />}
        {tab === "Images" && <section className="admin-card"><p className="admin-eyebrow">02 / First impressions</p><h2>Set the scene</h2><p>Recommended: 16:9 images, at least 1600px wide. Originals are retained; the tour uses clean WebP copies.</p><div className="admin-form-grid"><ImageUpload propertyId={data.id} label="Tower image" value={data.towerImage} onChange={(url) => imageChange("towerImage", url)} error={errors.towerImage} /><ImageUpload propertyId={data.id} label="Floor-plan image" value={data.planImage} onChange={(url) => imageChange("planImage", url)} error={errors.planImage} /></div></section>}
        {tab === "Units" && <Units {...props} />}
        {tab === "Rooms" && <Rooms {...props} imageChange={roomImageChange} />}
        {tab === "Amenities" && <AmenitiesEditor {...props} />}
        <div hidden={tab !== "360° Walkthrough"}><Panoramas ref={panoramas} property={data} /></div>
        {tab === "Videos" && <Videos propertyId={data.id} propertyChanged={refresh} />}
      </div>
    </div><div className="admin-delete"><p>Deleting a property removes its units, rooms and viewpoints. Media files are retained for recovery.</p><button className="admin-danger-link" onClick={async () => { if (!window.confirm(`Permanently delete ${data.name}? This cannot be undone.`)) return; setBusy(true); try { await adminApi(`/api/admin/properties/${data.id}`, { method: "DELETE" }); router.push("/admin"); router.refresh(); } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Unable to delete property."); setBusy(false); } }} disabled={busy}>Delete property</button></div>
  </>;
}
