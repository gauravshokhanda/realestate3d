"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { lockScrollTour, scrollToSection } from "@/lib/scroll";

export default function MobileMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const opener = trigger.current;
    const overflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = "hidden"; lockScrollTour(true);
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = element?.querySelectorAll<HTMLElement>("a[href],button:not([disabled])");
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    element?.addEventListener("keydown", trap);
    return () => { element?.removeEventListener("keydown", trap); element?.close(); document.body.style.overflow = overflow; lockScrollTour(false); opener?.focus(); };
  }, [open]);
  const jump = (id: string) => { setOpen(false); setTimeout(() => scrollToSection(id), 0); };
  return <><button ref={trigger} type="button" className="mobile-menu-trigger" aria-expanded={open} aria-controls="mobile-tour-menu" onClick={() => setOpen(true)}>Menu <span aria-hidden="true">☰</span></button><dialog ref={dialog} id="mobile-tour-menu" className="mobile-tour-menu" aria-label={`${name} navigation`} onCancel={(e) => { e.preventDefault(); setOpen(false); }}><div className="flex items-center justify-between"><span className="text-xs uppercase tracking-[0.2em] text-champagne">{name}</span><button autoFocus type="button" aria-label="Close navigation" onClick={() => setOpen(false)}>Close ×</button></div><nav aria-label="Mobile navigation">{["Tower", "Residences", "Rooms", "Amenities", "Contact"].map((label, i) => <a key={label} href={`#${i === 0 ? "main" : label.toLowerCase()}`} onClick={(e) => { e.preventDefault(); jump(i === 0 ? "main" : label.toLowerCase()); }}><span>0{i + 1}</span>{label}</a>)}<Link href="/" onClick={() => setOpen(false)} className="collection-link">The collection ↗</Link></nav><p>Exceptional spaces. A new perspective.</p></dialog></>;
}
