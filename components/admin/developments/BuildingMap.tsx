"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { polygonSchema, type Point } from "@/lib/admin/polygon";
import { mapPropertySchema, type MapProperty } from "@/lib/admin/development-schema";
import { adminApi, ApiError } from "../api";
import { Button, buttonClass, Field, Input, Select } from "../ui/controls";
import { Badge, Card, EmptyState, Toast } from "../ui/surfaces";
import { Modal } from "../ui/Modal";
import { useSaveIndicator } from "../ui/save-state";
import MapCanvas from "./MapCanvas";
import usePolygonHistory from "./usePolygonHistory";

type Action = "new" | "fromPolygon" | "link";
export default function BuildingMap({ developmentId, image, initialProperties, active }: {
  developmentId: string; image: string | null; initialProperties: MapProperty[]; active: boolean;
}) {
  const [properties, setProperties] = useState(initialProperties);
  const [selection, setSelection] = useState<string | null>(initialProperties.find((property) => property.polygon)?.id ?? null);
  const [vertex, setVertex] = useState(-1), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [modal, setModal] = useState<Action | null>(null);
  const [name, setName] = useState(""), [linkId, setLinkId] = useState(""), [busy, setBusy] = useState(false);
  const history = usePolygonHistory(initialProperties.find((property) => property.polygon)?.polygon ?? []);
  const { points, drawing } = history.outline;
  const selected = properties.find((property) => property.id === selection);
  const unlinked = properties.filter((property) => !property.polygon && property.id !== selection);
  const dirty = drawing || JSON.stringify(points) !== JSON.stringify(selected?.polygon ?? []);
  const api = `/api/admin/developments/${developmentId}/properties`;
  useSaveIndicator(busy ? "Saving…" : dirty ? "Unsaved changes" : "Saved", active);

  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  function clearStatus() { setMessage(""); setError(""); }
  function select(id: string | null) {
    if (busy || (id !== null && id === selection)) return;
    if (dirty && !window.confirm("Discard the unsaved polygon changes?")) return;
    clearStatus(); setSelection(id); setVertex(-1);
    history.reset(properties.find((property) => property.id === id)?.polygon ?? []);
  }
  function commit(next: Point[]) {
    if (busy) return false;
    clearStatus();
    if (next.length) {
      const result = polygonSchema.safeParse(next);
      if (!result.success) { setError(result.error.issues[0].message); return false; }
    }
    history.push({ points: next, drawing: false });
    return true;
  }
  function addPoint(point: Point) {
    if (busy) return;
    clearStatus();
    if (points.length >= 64) { setError("Use at most 64 points."); return; }
    history.push({ points: [...points, point], drawing: true });
  }
  function removeVertex() {
    if (vertex === -1 || points.length < 4) { setError("Select a point. A polygon needs at least three points."); return; }
    if (commit(points.filter((_, index) => index !== vertex))) setVertex(-1);
  }
  function open(kind: Action) { clearStatus(); setModal(kind); setName(""); setLinkId(unlinked[0]?.id ?? ""); }
  function upsert(property: MapProperty) {
    setProperties((items) => items.some((item) => item.id === property.id) ? items.map((item) => item.id === property.id ? property : item) : [...items, property]);
  }
  async function persist(property: MapProperty, polygon: Point[] | null) {
    return mapPropertySchema.parse(await adminApi(`${api}/${property.id}/polygon`, { method: "PUT", body: JSON.stringify({ polygon, updatedAt: property.updatedAt }) }));
  }
  async function apply() {
    if (busy) return;
    clearStatus(); setBusy(true);
    try {
      let property: MapProperty;
      if (modal === "new" || modal === "fromPolygon") {
        property = mapPropertySchema.parse(await adminApi(api, { method: "POST", body: JSON.stringify({ name, polygon: modal === "fromPolygon" ? points : null }) }));
      } else if (modal === "link") {
        const target = unlinked.find((item) => item.id === linkId);
        if (!target) return;
        property = await persist(target, points);
      } else if (selected) property = await persist(selected, points.length ? points : null);
      else return;
      upsert(property); setSelection(property.id); setVertex(-1); setModal(null);
      history.reset(property.polygon ?? []);
      setMessage(modal ? "Property saved." : "Polygon saved.");
    } catch (error) {
      setError(error instanceof ApiError ? Object.values(error.errors)[0] ?? error.message : error instanceof Error ? error.message : "Unable to save.");
    } finally { setBusy(false); }
  }
  async function unlink() {
    if (!selected?.polygon || busy || !window.confirm(`Unlink the polygon from ${selected.name}?`)) return;
    clearStatus(); setBusy(true);
    try {
      const property = await persist(selected, null);
      upsert(property); setSelection(null); setVertex(-1); history.reset(selected.polygon);
      setMessage("Polygon unlinked. Select a property to link it again.");
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to unlink."); }
    finally { setBusy(false); }
  }
  function duplicate() {
    const shift = (values: number[]) => Math.max(...values) <= 0.96 ? 0.035 : Math.min(...values) >= 0.04 ? -0.035 : 0;
    const x = shift(points.map((point) => point.x)), y = shift(points.map((point) => point.y));
    clearStatus(); setSelection(null); setVertex(-1); history.reset([]);
    history.push({ points: points.map((point) => ({ x: point.x + x, y: point.y + y })), drawing: false });
    setMessage("Copy created. Link it to a property or create a new one.");
  }
  function redo() { clearStatus(); setVertex(-1); history.redo(); }
  function undo() { clearStatus(); setVertex(-1); history.undo(); }
  function cancel() { clearStatus(); setVertex(-1); history.reset(selected?.polygon ?? []); }
  const closed = !drawing && points.length >= 3;

  return <div className="crm-building-map" onKeyDown={(event) => {
    if (busy || modal || /^(INPUT|SELECT|TEXTAREA)$/.test((event.target as HTMLElement).tagName)) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(key)) {
      event.preventDefault(); if (key === "y" || event.shiftKey) redo(); else undo();
    } else if (event.key === "Escape" && drawing) { event.preventDefault(); cancel(); }
    else if (event.key === "Enter" && drawing && (event.target as HTMLElement).getAttribute("aria-label") === "Building map canvas") { event.preventDefault(); commit(points); }
    else if (event.key === "Delete" && !drawing && vertex >= 0) { event.preventDefault(); removeVertex(); }
  }}>
    <Card className="crm-map-card">
      <div className="crm-map-heading"><h2>Building map</h2><p>{drawing ? "Click the first point or press Enter to close the outline." : "Select a property, then click the building to start an outline."}</p></div>
      <div className="crm-map-toolbar">
        <Button disabled={!image || busy} onClick={() => select(null)}>New outline</Button>
        <Button disabled={!history.canUndo || busy} onClick={undo}>Undo</Button>
        <Button disabled={!history.canRedo || busy} onClick={redo}>Redo</Button>
        <Button disabled={!points.length || busy} onClick={() => { commit([]); setVertex(-1); }}>Clear polygon</Button>
        <Button disabled={!closed || busy} onClick={duplicate}>Duplicate polygon</Button>
        {drawing && <Button onClick={() => commit(points)}>Close polygon</Button>}
      </div>
      {image ? <MapCanvas key={image} image={image} points={points} drawing={drawing} vertex={vertex} selection={selection} properties={properties}
        onPoint={addPoint} onClose={() => commit(points)} onSelect={select} onVertex={setVertex} onMove={commit}
        onInsert={(index, point) => { if (commit([...points.slice(0, index + 1), point, ...points.slice(index + 1)])) setVertex(index + 1); }} />
        : <EmptyState title="Upload a building image">Add the building image in Details to begin placing polygons.</EmptyState>}
      <Toast message={modal ? "" : error || message} variant={error ? "alert" : "status"} />
      <div className="crm-map-toolbar crm-map-commit">
        {selected && <Button variant="primary" disabled={!image || !dirty || drawing || busy} onClick={() => void apply()}>Save polygon</Button>}
        {selected?.polygon && <Button disabled={busy} onClick={() => void unlink()}>Unlink polygon</Button>}
        {!selected && <Button variant="primary" disabled={!closed || busy} onClick={() => open("fromPolygon")}>Create property from this polygon</Button>}
        {!selected && <Button disabled={!closed || !unlinked.length || busy} onClick={() => open("link")}>Link existing property</Button>}
        {vertex >= 0 && !drawing && <Button disabled={busy} onClick={removeVertex}>Delete point</Button>}
      </div>
    </Card>
    <Card className="crm-map-properties">
      <h2>Properties</h2>
      <Button variant="primary" onClick={() => {
        if (!dirty || window.confirm("Discard the unsaved polygon changes?")) open("new");
      }} disabled={busy}>Add property</Button>
      {properties.length === 0 && <p>Properties will appear here once added.</p>}
      <ul>{properties.map((property) => <li key={property.id}>
        <button type="button" aria-pressed={selection === property.id} onClick={() => select(property.id)}>
          <span><strong>{property.name}</strong><small>{property.label || property.slug}</small></span><Badge status={property.status} />
        </button>
      </li>)}</ul>
      {selected && <Link href={`/admin/developments/${developmentId}/properties/${selected.id}`} className={buttonClass()}>Open {selected.name}</Link>}
    </Card>
    {modal && <Modal title={modal === "link" ? "Link existing property" : modal === "fromPolygon" ? "Create property from polygon" : "Add property"} onClose={() => { if (!busy) { setModal(null); clearStatus(); } }}>
      <form className="crm-form" onSubmit={(event) => { event.preventDefault(); void apply(); }}>
        <Toast message={error} variant="alert" />
        {modal === "link" ? <Field id="property-link" label="Property"><Select id="property-link" autoFocus required value={linkId} onChange={(event) => setLinkId(event.target.value)}>
          {unlinked.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select></Field> : <Field id="map-property-name" label="Property name"><Input id="map-property-name" autoFocus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></Field>}
        <div className="crm-actions"><Button variant="primary" type="submit" disabled={busy}>{modal === "link" ? "Link property" : "Create property"}</Button>
          <Button disabled={busy} onClick={() => { setModal(null); clearStatus(); }}>Cancel</Button></div>
      </form>
    </Modal>}
  </div>;
}
