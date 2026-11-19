"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import MobileMenu from "./MobileMenu";
import { gsap } from "gsap";
import { scrollToSection } from "@/lib/scroll";

export default function Nav({ name }: { name: string }) {
  const [glass, setGlass] = useState(false);
  const progressBar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let position = window.scrollY, maximum = 1, painted = -1, wasGlass = false;
    const update = () => {
      position = window.scrollY;
      const next = position > 20;
      if (next !== wasGlass) { wasGlass = next; setGlass(next); }
    };
    const measure = () => { maximum = Math.max(1, document.documentElement.scrollHeight - innerHeight); painted = -1; };
    const paint = () => {
      if (painted === position || !progressBar.current) return;
      progressBar.current.style.transform = `scaleX(${Math.max(0, Math.min(1, position / maximum))})`;
      painted = position;
    };
    update();
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", measure);
    gsap.ticker.add(paint);
    return () => {
      observer.disconnect(); gsap.ticker.remove(paint);
      window.removeEventListener("scroll", update); window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <>
      <div ref={progressBar} aria-hidden="true" className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-champagne" style={{ transform: "scaleX(0)" }} />
      <header className={`fixed inset-x-0 top-0 z-40 border-b transition-colors duration-500 ${glass ? "border-champagne/20 bg-ink/80 backdrop-blur-xl" : "border-transparent bg-transparent"}`}>
        <nav aria-label="Main navigation" className="mx-6 flex min-h-24 flex-row items-center justify-between gap-4 py-4 sm:mx-12 sm:flex-row sm:items-center sm:justify-between lg:mx-20">
          <a href="#main" onClick={(event) => { event.preventDefault(); scrollToSection("main"); }} aria-label={`${name} home`} className="flex w-fit flex-col items-center gap-1">
            <span className="font-display text-2xl font-medium uppercase leading-none tracking-[0.2em] text-ivory sm:text-3xl">{name}</span>
            <span className="text-[7px] uppercase tracking-[0.3em] text-champagne">Exceptional residences</span>
          </a>
          <div className="hidden flex-wrap md:flex gap-x-5 gap-y-2 text-[9px] uppercase tracking-[0.14em] text-ivory/80 sm:gap-x-8 sm:text-[10px]">
            {["Residences", "Rooms", "Amenities", "Contact"].map((label) => <a key={label} href={`#${label.toLowerCase()}`} onClick={(event) => { event.preventDefault(); scrollToSection(label.toLowerCase()); }} className="py-1 transition-colors hover:text-champagne">{label}</a>)}
            <Link href="/" className="py-1 text-champagne">Collection ↗</Link>
          </div>
          <MobileMenu name={name} />
        </nav>
      </header>
    </>
  );
}
