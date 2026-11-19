"use client";

import { createContext, useContext, useEffect } from "react";
export type SaveState = "Saved" | "Saving…" | "Unsaved changes" | "Not saved";
export const SaveContext = createContext<(state: SaveState) => void>(() => {});
export function useSaveIndicator(state: SaveState, active = true) {
  const set = useContext(SaveContext);
  useEffect(() => { if (!active) return; set(state); return () => set("Saved"); }, [active, state, set]);
}
