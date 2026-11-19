"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, ApiError } from "../api";
import { developmentSave, developmentView, type DevelopmentForm } from "@/lib/admin/development-schema";
import type { SaveState } from "../ui/save-state";

function payload(form: DevelopmentForm) {
  const { id, updatedAt, ...details } = form;
  void id; void updatedAt;
  return details;
}
export default function useDevelopmentForm(initial: DevelopmentForm) {
  const [form, setForm] = useState(initial), [persisted, setPersisted] = useState(initial);
  const [busy, setBusy] = useState(false), [failure, setFailure] = useState(""), [errors, setErrors] = useState<Record<string, string>>({});
  const failed = useRef(""), busyRef = useRef(false), revision = useRef(initial.updatedAt);
  const details = JSON.stringify(payload(form));
  const dirty = details !== JSON.stringify(payload(persisted));
  const save = useCallback(async () => {
    if (busyRef.current || !dirty) return;
    const input = developmentSave.safeParse({ ...payload(form), updatedAt: revision.current });
    failed.current = details;
    if (!input.success) {
      setErrors(Object.fromEntries(input.error.issues.map((issue) => [issue.path.join("."), issue.message])));
      setFailure("Check the highlighted fields.");
      return;
    }
    busyRef.current = true; setBusy(true); setFailure(""); setErrors({});
    try {
      const result = developmentView.parse(await adminApi(`/api/admin/developments/${initial.id}`, { method: "PUT", body: JSON.stringify(input.data) }));
      revision.current = result.updatedAt;
      setPersisted({ ...form, updatedAt: result.updatedAt });
      failed.current = "";
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.errors);
      setFailure(error instanceof Error ? error.message : "Unable to save the development.");
    } finally { busyRef.current = false; setBusy(false); }
  }, [details, dirty, form, initial.id]);
  useEffect(() => {
    if (!dirty || busy || failed.current === details) return;
    const timer = window.setTimeout(() => { void save(); }, 600);
    return () => clearTimeout(timer);
  }, [busy, details, dirty, save]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const state: SaveState = busy ? "Saving…" : dirty ? failed.current === details && failure ? "Not saved" : "Unsaved changes" : "Saved";
  return { form, setForm, persisted, busy, failure: state === "Not saved" ? failure : "", errors, save, state };
}
