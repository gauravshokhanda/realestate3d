"use client";

import { useRef } from "react";
import { scrollToSection } from "@/lib/scroll";

export default function ExploreButton() {
  const button = useRef<HTMLButtonElement>(null);
  return <button ref={button} type="button" className="explore-button" onClick={() => scrollToSection("residences")} onPointerMove={(e) => {
    if (!matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.transform = `translate(${(e.clientX - rect.left - rect.width / 2) * 0.12}px,${(e.clientY - rect.top - rect.height / 2) * 0.12}px)`;
  }} onPointerLeave={() => { if (button.current) button.current.style.transform = ""; }}><span aria-hidden="true">↓</span>Scroll to explore</button>;
}
