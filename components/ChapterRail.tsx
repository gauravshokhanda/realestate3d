"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { scrollToSection } from "@/lib/scroll";

const chapters = [["main", "Tower"], ["residences", "Plan"], ["rooms", "Rooms"], ["amenities", "Amenities"], ["contact", "Contact"]];

export default function ChapterRail() {
  const rail = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(min-width: 768px)", () => {
    let starts: number[] = [], position = scrollY, dirty = true, end = 1, previous = -1;
    const measure = () => {
      end = document.documentElement.scrollHeight;
      starts = chapters.map(([id]) => {
        const el = document.getElementById(id);
        const top = (el?.getBoundingClientRect().top ?? 0) + scrollY;
        return id === "residences" ? top + Number(el?.querySelector<HTMLElement>("[data-scroll-length]")?.dataset.scrollLength ?? 0) * 0.7 : top;
      });
      dirty = true;
    };
    const update = () => { position = scrollY; dirty = true; };
    const paint = () => {
      if (!dirty) return;
      dirty = false;
      let active = 0;
      starts.forEach((start, i) => { if (position + innerHeight * 0.35 >= start) active = i; });
      rail.current?.querySelectorAll("a").forEach((link, i) => {
        if (previous !== active) link.setAttribute("aria-current", i === active ? "step" : "false");
        if (previous === active && i !== active) return;
        link.style.setProperty("--chapter-fill", String(Math.max(0, Math.min(1, (position + innerHeight * 0.35 - starts[i]) / Math.max(1, (starts[i + 1] ?? end) - starts[i])))));
      });
      previous = active;
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(document.body);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", measure); gsap.ticker.add(paint);
      return () => { observer.disconnect(); window.removeEventListener("scroll", update); window.removeEventListener("resize", measure); gsap.ticker.remove(paint); };
    });
    return () => media.revert();
  }, []);
  return <nav ref={rail} aria-label="Tour chapters" className="chapter-rail">{chapters.map(([id, label], i) => <a href={`#${id}`} key={id} onClick={(e) => { e.preventDefault(); scrollToSection(id); }}><span className="chapter-label">{label}</span><span className="chapter-track"><i /></span><span className="sr-only">Chapter {i + 1}</span></a>)}</nav>;
}
