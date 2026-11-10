"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { panoSnapshotSchema, type PanoSnapshot, type PanoNodeInput } from "@/lib/panorama";
import { adminApi } from "../api";
export function usePanoramas(propertyId: string) {
  const [data, setData] = useState<PanoSnapshot | null>(null), [state, setState] = useState("Loading viewpoints…"), [error, setError] = useState("");
  const latest = useRef<PanoSnapshot | null>(null), dirty = useRef(false), revision = useRef(0), flight = useRef<Promise<boolean> | null>(null);
  const load = useCallback(async () => {
    try { const snapshot = panoSnapshotSchema.parse(await adminApi(`/api/admin/properties/${propertyId}/panoramas`)); latest.current = snapshot; dirty.current = false; setData(snapshot); setState("Saved"); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load viewpoints."); setState("Not loaded"); }
  }, [propertyId]);
  useEffect(() => { void load(); }, [load]);
  const refresh = useCallback(async () => {
    if (!latest.current || dirty.current || flight.current) return;
    const observed = latest.current.revision;
    try {
      const snapshot = panoSnapshotSchema.parse(await adminApi(`/api/admin/properties/${propertyId}/panoramas`));
      if (!dirty.current && !flight.current && latest.current?.revision === observed && observed !== snapshot.revision) { latest.current = snapshot; setData(snapshot); }
    } catch { /* Keep edits and let explicit reload surface connectivity errors. */ }
  }, [propertyId]);
  const change = (nodes: PanoNodeInput[]) => { if (!latest.current) return; latest.current = { ...latest.current, nodes }; dirty.current = true; revision.current++; setData(latest.current); setState("Unsaved changes"); setError(""); };
  const save = useCallback(async () => {
    if (flight.current) return flight.current;
    const work = async () => {
      while (dirty.current && latest.current) {
        const version = revision.current, parsed = panoSnapshotSchema.safeParse(latest.current);
        if (!parsed.success) { setState("Needs attention"); setError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" · ")); return false; }
        setState("Saving…");
        try {
          const saved = panoSnapshotSchema.parse(await adminApi(`/api/admin/properties/${propertyId}/panoramas`, { method: "PUT", body: JSON.stringify(parsed.data) }));
          latest.current = { ...latest.current, revision: saved.revision }; setData(latest.current);
          if (revision.current === version) dirty.current = false;
        } catch (cause) { setState("Not saved"); setError(cause instanceof Error ? cause.message : "Unable to save viewpoints."); return false; }
      }
      setState("Saved"); setError(""); return true;
    };
    flight.current = work(); try { return await flight.current; } finally { flight.current = null; }
  }, [propertyId]);
  useEffect(() => { if (state !== "Unsaved changes") return; const timer = setTimeout(() => { void save(); }, 650); return () => clearTimeout(timer); }, [data, state, save]);
  useEffect(() => { const prevent = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", prevent); return () => window.removeEventListener("beforeunload", prevent); }, []);
  return { data, latest, state, error, change, save, load, refresh };
}
