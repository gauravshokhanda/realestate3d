"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { frameUrl, type Scene } from "@/data/scenes";
import { selectScene } from "@/lib/preload";
import { WindowRenderer } from "@/lib/window-renderer";

gsap.registerPlugin(ScrollTrigger);

export function useFrameSequence(scene: Scene, onProgress?: (progress: number) => void, enabled = true, trackLanding = false) {
  const progressCallback = useRef(onProgress);
  useEffect(() => { progressCallback.current = onProgress; }, [onProgress]);
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const target = useRef(0);
  const worker = useRef<WindowRenderer | null>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [landed, setLanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [posterSrc, setPosterSrc] = useState<string | null>(null);
  const [mobile, setMobile] = useState<boolean | null>(null);
  useEffect(() => () => { worker.current?.destroy(); worker.current = null; }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const screen = window.matchMedia("(max-width: 767px)");
    const update = () => setReducedMotion(media.matches);
    const viewport = () => setMobile(screen.matches);
    update();
    viewport(); screen.addEventListener("change", viewport);
    media.addEventListener("change", update);
    return () => { media.removeEventListener("change", update); screen.removeEventListener("change", viewport); };
  }, []);

  // Pins exist independently of decoding, so loading/disposal never changes layout.
  useEffect(() => {
    if (reducedMotion !== false || !sectionRef.current) return;
    const section = sectionRef.current;
    const report = (value: number) => {
      target.current = value;
      section.dataset.progress = String(value);
      progressCallback.current?.(value);
    };
    const trigger = ScrollTrigger.create({ trigger: section, start: "top top", end: "+=" + scene.scrollLength,
      scrub: true, pin: true, pinSpacing: false,
      onEnter: () => section.dispatchEvent(new Event("sequence-enter", { bubbles: true })),
      onEnterBack: () => section.dispatchEvent(new Event("sequence-enter", { bubbles: true })),
      onUpdate: (self) => report(self.progress), onRefresh: (self) => report(self.progress) });
    return () => { trigger.kill(); };
  }, [scene, reducedMotion]);

  useEffect(() => {
    if (reducedMotion === null || mobile === null) return;
    setReady(false); setLanded(false);
    if (!enabled) return;
    if (reducedMotion) { setPosterSrc(frameUrl(selectScene(scene), 0)); setReady(true); return; }
    const abort = new AbortController();
    const canvas = canvasRef.current, section = sectionRef.current;
    if (!canvas || !section) return;
    setError(null); setProgress(0); setPosterSrc(null);
    let painted = false, wasAtEnd = false, foreground = false;
    const visibility = new IntersectionObserver(([entry]) => { foreground = entry.isIntersecting; }, { threshold: .1 });
    visibility.observe(section);
    const selected = selectScene(scene);
    setPosterSrc(frameUrl(selected, Math.round(target.current * (selected.frameCount - 1))));
    try { worker.current ??= new WindowRenderer(canvas); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Frame decoder unavailable"); visibility.disconnect(); return; }
    const renderer = worker.current;
    renderer.profile(mobile);
    const bounds = section.getBoundingClientRect(); foreground = bounds.top < innerHeight && bounds.bottom > 0;
    let width = 0, height = 0, dpr = 0;
    const resize = () => {
      const w = section.clientWidth, h = section.clientHeight, ratio = Math.min(devicePixelRatio || 1, 2);
      if (w === width && h === height && ratio === dpr) return;
      width = w; height = h; dpr = ratio; renderer.resize(w, h, ratio);
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(section);
    renderer.onPaint = (index) => {
      if (abort.signal.aborted) return;
      if (!painted) { painted = true; setProgress(1); setReady(true); }
      if (trackLanding) { const end = index === selected.frameCount - 1; if (end !== wasAtEnd) { wasAtEnd = end; setLanded(end); } }
    };
    let displayed = target.current * (selected.frameCount - 1), lastIndex = -1, lastTarget = -1, lastForeground = !foreground;
    void renderer.load(selected, Math.round(displayed), foreground, abort.signal).catch((cause: unknown) => { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load sequence"); });
      const draw = () => {
        const desired = target.current * (selected.frameCount - 1);
        // Large jumps go directly to the new working set. The painter holds the
        // nearest cached frame, then crossfades when the destination arrives.
        if (Math.abs(desired - displayed) > 24) displayed = desired;
        else displayed += (desired - displayed) * (1 - Math.pow(.8, gsap.ticker.deltaRatio(60)));
        if (Math.abs(desired - displayed) < .01) displayed = desired;
        const index = Math.round(displayed), destination = Math.round(desired);
        if (index === lastIndex && destination === lastTarget && foreground === lastForeground) return;
        lastIndex = index; lastTarget = destination; lastForeground = foreground;
        renderer.seek(index, destination, foreground);
      };
      draw(); gsap.ticker.add(draw); const removeTick = () => gsap.ticker.remove(draw);
    return () => { abort.abort(); observer.disconnect(); visibility.disconnect(); removeTick?.(); renderer.onPaint = undefined; renderer.release(); };

  }, [scene, reducedMotion, enabled, trackLanding, mobile]);

  return { sectionRef, canvasRef, progress, ready, landed, error, reducedMotion, posterSrc };
}
