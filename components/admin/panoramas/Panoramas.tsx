"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import type { AdminProperty } from "@/lib/admin/schema";
import { mobilePanorama, type PanoNodeInput } from "@/lib/panorama";
import { usePanoramas } from "./usePanoramas";
import ImageUpload from "../ImageUpload";
import { Field } from "../Fields";
import Positioner from "./Positioner";
import AuthorPreview from "./AuthorPreview";
export type PanoramaEditorHandle = { save: () => Promise<boolean> };
const Panoramas = forwardRef<PanoramaEditorHandle, { property: AdminProperty }>(function Panoramas({ property }, ref) {
  const { data, latest, state, error, change, save, load, refresh } = usePanoramas(property.id);
  useEffect(() => { void refresh(); }, [property.updatedAt, refresh]);
  const [roomId, setRoomId] = useState(""), [selected, setSelected] = useState(""), [preview, setPreview] = useState<string | null>(null);
  const close = useCallback(() => setPreview(null), []);
  useImperativeHandle(ref, () => ({ save }), [save]);
  const inputNodes = data?.nodes;
  const nodes = inputNodes ?? [];
  const room = property.rooms.find((item) => item.id === roomId) ?? property.rooms[0];
  const node = nodes.find((item) => item.id === selected);
  const tourNodes = useMemo(() => (inputNodes ?? []).map((item) => ({ ...item, roomLabel: property.rooms.find((r) => r.id === item.roomId)?.label ?? "Room", mobileImage: mobilePanorama(item.image) })), [inputNodes, property.rooms]);
  function update(patch: Partial<PanoNodeInput>) { change(latest.current!.nodes.map((item) => item.id === selected ? { ...item, ...patch } : item)); }
  return <section className="admin-card"><p className="admin-eyebrow">06 / A sense of place</p><h2>Step inside, look around.</h2><p>Add seamless equirectangular panoramas, place them on the plan, then connect viewpoints with arrows. Recommended: 2:1, at least 4096px wide.</p>
    <div className="admin-toolbar"><span role="status" aria-label="Viewpoint save status">{state}</span><button className="admin-secondary" onClick={() => { void save(); }}>Save viewpoints</button><button className="admin-secondary" onClick={() => { if (state === "Saved" || window.confirm("Reload viewpoints and discard unsaved changes?")) void load(); }}>Reload viewpoints</button></div>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {!room ? <p>Add and save a room in Rooms before adding viewpoints.</p> : <>
      <label className="admin-field"><span>Room for new viewpoints</span><select value={room.id} onChange={(e) => setRoomId(e.target.value)}>{property.rooms.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      {data && nodes.filter((item) => item.roomId === room.id).length < 8 && <ImageUpload key={room.id} propertyId={property.id} label="New panorama" kind="panorama" value={null} onChange={(url) => { if (!url || !latest.current) return; const id = crypto.randomUUID(); change([...latest.current.nodes, { id, roomId: room.id, name: `${room.label} ${latest.current.nodes.filter((item) => item.roomId === room.id).length + 1}`, image: url, planX: null, planY: null, startYaw: 0, links: [] }]); setSelected(id); }} />}
    </>}
    <div className="admin-pano-list" aria-label="Viewpoints">{nodes.map((item) => <button key={item.id} className={selected === item.id ? "admin-primary" : "admin-secondary"} onClick={() => setSelected(item.id)}>{item.name}<small>{property.rooms.find((r) => r.id === item.roomId)?.label}</small></button>)}{data && !nodes.length && <p>No viewpoints yet. Flat room stills are not valid panoramas.</p>}</div>
    {node && <div className="admin-pano-details"><h3>Edit viewpoint</h3><Field label="Viewpoint name" value={node.name} maxLength={100} onChange={(e) => update({ name: e.target.value })} />
      <ImageUpload propertyId={property.id} label="Viewpoint panorama" kind="panorama" allowRemove={false} value={node.image} onChange={(url) => { if (url) update({ image: url }); }} />
      <Field label="Start yaw (radians)" type="number" step="0.01" min={-Math.PI * 2} max={Math.PI * 2} value={node.startYaw} onChange={(e) => update({ startYaw: Number(e.target.value) })} />
      <Positioner image={property.planImage} nodes={nodes} node={node} update={update} />
      <h3>Connected viewpoints</h3>{node.links.length ? node.links.map((link) => <div className="admin-pano-link" key={link.toNodeId}><p>{link.label} <small>yaw {link.yaw.toFixed(3)} / pitch {link.pitch.toFixed(3)}</small></p><button className="admin-danger-link" onClick={() => { if (window.confirm(`Remove arrow to ${link.label}?`)) update({ links: node.links.filter((item) => item.toNodeId !== link.toNodeId) }); }}>Remove arrow</button></div>) : <p>No arrows yet. Open the preview to click an exact position and choose its destination.</p>}
      <div className="admin-toolbar"><button className="admin-primary" onClick={() => setPreview(node.id)}>Preview / place arrows</button><button className="admin-danger-link" onClick={() => { if (!window.confirm(`Delete viewpoint ${node.name} and its incoming arrows?`)) return; change(nodes.filter((item) => item.id !== node.id).map((item) => ({ ...item, links: item.links.filter((link) => link.toNodeId !== node.id) }))); setSelected(""); }}>Delete viewpoint</button></div>
    </div>}
    {preview && <AuthorPreview nodes={tourNodes} selected={preview} planImage={property.planImage} update={update} close={close} />}
  </section>;
});
export default Panoramas;
