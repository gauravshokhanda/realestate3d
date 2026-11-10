"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { videosViewSchema, type VideosView } from "@/lib/jobs/schema";
import { adminApi } from "../api";
import SceneCard from "./SceneCard";
export default function Videos({ propertyId, propertyChanged }: { propertyId: string; propertyChanged: () => Promise<void> }) {
  const [data, setData] = useState<VideosView | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const mounted = useRef(true), request = useRef(0);
  const refresh = useCallback(async () => {
    const revision = ++request.current;
    const view = videosViewSchema.parse(await adminApi(`/api/admin/properties/${propertyId}/videos`));
    if (mounted.current && revision === request.current) { setData(view); setError(""); }
    await propertyChanged();
  }, [propertyId, propertyChanged]);
  useEffect(() => {
    mounted.current = true;
    const load = () => { void refresh().catch((cause: unknown) => { if (mounted.current) setError(cause instanceof Error ? cause.message : "Unable to load videos."); }); };
    load(); const timer = setInterval(load, 3000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, [refresh]);
  return <section aria-label="Camera move videos"><div className="admin-card admin-video-intro"><p className="admin-eyebrow">07 / Camera moves</p><div className="admin-section-heading"><div><h2>Every move, connected.</h2><p>From the tower to the plan, and into each room.</p></div><button className="admin-primary" disabled={busy || !data?.veo.enabled || !data.scenes.length || data.scenes.some((s) => ["generating", "extracting"].includes(s.status) || (s.status === "queued" && (s.mode === "veo" || s.videoUrl)))} onClick={async () => {
      if (!data || !window.confirm(`This will call the paid Gemini API for ${data.scenes.length} videos (${data.scenes.length * data.veo.duration} seconds total at ${data.veo.resolution}). Actual cost depends on the configured model and your account. Continue?`)) return;
      setBusy(true); setError(""); try { await adminApi(`/api/admin/properties/${propertyId}/videos`, { method: "POST", body: JSON.stringify({ action: "generate-all", confirmPaid: true, sceneIds: data.scenes.map((scene) => scene.id) }) }); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to generate."); } finally { setBusy(false); }
    }}>Generate all videos</button></div>
    {data && <><p className="admin-notice">{data.veo.reason}</p><p className="admin-muted">{data.veo.enabled ? `Configured model: ${data.veo.model}. 8s, 720p, 16:9; first and last frame supplied.` : "Use a first/last-frame tool to create the MP4s. Copy each prompt, reuse the exact stills, then upload here."} Status refreshes every 3 seconds. All scenes must be ready before publishing.</p></>}
    {data?.propertyStatus === "draft" && data.scenes.length > 0 && data.scenes.every((scene) => scene.status === "ready") && <p role="status" className="admin-notice">All scenes are ready. Publish the property from the top bar when you are ready.</p>}
    {!data && !error && <p role="status">Loading camera moves…</p>}{error && <p role="alert" className="admin-error">{error}</p>}
    {data && !data.scenes.length && <p className="admin-notice">Upload the tower, floor plan and room images first. Scenes are created automatically as you save them.</p>}</div>
    <div className="admin-scene-list">{data?.scenes.map((scene) => <SceneCard key={scene.id} scene={scene} propertyId={propertyId} veo={data.veo} refresh={refresh} />)}</div>
  </section>;
}
