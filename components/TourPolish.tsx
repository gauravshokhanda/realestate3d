"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import ChapterRail from "./ChapterRail";
import FrameDebug from "./FrameDebug";

export default function TourPolish() {
  const cursor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
    let x = -100, y = -100, dirty = false;
    const move = (e: PointerEvent) => { x = e.clientX; y = e.clientY; dirty = true; };
    const over = (e: PointerEvent) => { cursor.current?.classList.toggle("is-interactive", e.target instanceof Element && !!e.target.closest("a, button, input, textarea, select")); };
    const paint = () => { if (dirty && cursor.current) { cursor.current.style.transform = `translate3d(${x}px,${y}px,0)`; dirty = false; } };
    window.addEventListener("pointermove", move, { passive: true }); window.addEventListener("pointerover", over); gsap.ticker.add(paint);
      return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerover", over); gsap.ticker.remove(paint); };
    });
    return () => media.revert();
  }, []);
  return <><ChapterRail /><FrameDebug /><div ref={cursor} className="tour-cursor" aria-hidden="true"><i /></div><div className="tour-grain" aria-hidden="true" /></>;
}
