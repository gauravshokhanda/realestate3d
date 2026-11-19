"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { propertyInput, type AdminProperty } from "@/lib/admin/schema";
import { adminApi, ApiError } from "./api";

export function useEditor(initial: AdminProperty) {
  const [data, setData] = useState(initial);
  const latest = useRef(initial), dirty = useRef(false), revision = useRef(0);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const [state, setState] = useState("Saved"), [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const change = useCallback((next: AdminProperty) => {
    latest.current = next; revision.current++; dirty.current = true;
    setData(next); setState("Unsaved changes"); setError(""); setErrors({});
  }, []);
  const save = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return inFlight.current;
    const work = async () => {
      while (dirty.current) {
        const snapshot = latest.current, version = revision.current;
        const parsed = propertyInput.safeParse(snapshot);
        if (!parsed.success) {
          setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message])));
          setError("Please check the form details. Your changes are kept here."); setState("Needs attention"); return false;
        }
        setState("Saving…");
        try {
          const saved = propertyInput.parse(await adminApi(`/api/admin/properties/${snapshot.id}`, { method: "PUT", body: JSON.stringify(parsed.data) }));
          latest.current = { ...latest.current, updatedAt: saved.updatedAt };
          setData(latest.current);
          if (revision.current === version) dirty.current = false;
          setErrors({}); setError("");
        } catch (cause) {
          setState("Not saved"); setError(cause instanceof Error ? cause.message : "Unable to save.");
          setErrors(cause instanceof ApiError ? cause.errors : {}); return false;
        }
      }
      setState("Saved"); return true;
    };
    inFlight.current = work();
    try { return await inFlight.current; } finally { inFlight.current = null; }
  }, []);
  useEffect(() => {
    if (state !== "Unsaved changes") return;
    const timer = setTimeout(() => { void save(); }, 650);
    return () => clearTimeout(timer);
  }, [data, state, save]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, []);
  const restoreStatus = (status: AdminProperty["status"]) => { latest.current = { ...latest.current, status }; setData(latest.current); revision.current++; dirty.current = false; setState("Publication unchanged"); };
  const refresh = useCallback(async () => {
    if (dirty.current || inFlight.current) return;
    const remote = propertyInput.parse(await adminApi(`/api/admin/properties/${initial.id}`));
    if (!dirty.current && !inFlight.current && remote.updatedAt !== latest.current.updatedAt) { latest.current = remote; setData(remote); }
  }, [initial.id]);
  return { data, change, save, state, error, errors, latest, restoreStatus, refresh };
}
