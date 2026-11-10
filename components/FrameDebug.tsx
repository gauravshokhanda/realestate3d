"use client";
import { useEffect, useRef, useState } from "react";
import type { CacheStats } from "@/lib/window-protocol";

export default function FrameDebug() {
  const [enabled, setEnabled] = useState(false);
  const output = useRef<HTMLOutputElement>(null);
  useEffect(() => { setEnabled(new URLSearchParams(location.search).get("debug") === "1"); }, []);
  useEffect(() => {
    if (!enabled) return;
    let stats: CacheStats | undefined;
    const update = (event: Event) => { stats = (event as CustomEvent<CacheStats>).detail; };
    window.addEventListener("frame-cache-stats", update);
    const timer = setInterval(() => {
      if (!output.current || !stats) return;
      const canvases = [...document.querySelectorAll<HTMLCanvasElement>("canvas[data-frame]")];
      output.current.textContent = `Decoded: ${stats.frames} frames · ${(stats.bytes / 1048576).toFixed(1)} MiB + ${(stats.reserved / 1048576).toFixed(1)} reserved / ${stats.budget / 1048576} MiB\n${canvases.map((c) => `${c.closest<HTMLElement>("[data-scene]")?.dataset.scene}: ${c.dataset.frame} → ${c.dataset.targetFrame}`).join("\n")}`;
    }, 250);
    return () => { clearInterval(timer); window.removeEventListener("frame-cache-stats", update); };
  }, [enabled]);
  return enabled ? <output ref={output} aria-label="Frame cache diagnostics" style={{ position: "fixed", bottom: 12, left: 12, zIndex: 100, pointerEvents: "none", whiteSpace: "pre-wrap", background: "#000e", color: "#ddd", padding: 12, font: "11px monospace" }}>Waiting for frame cache…</output> : null;
}
