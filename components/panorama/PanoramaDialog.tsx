"use client";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { lockScrollTour } from "@/lib/scroll";
import type { PanoramaViewProps } from "./PanoramaView";
import "./panorama.css";
const PanoramaView = dynamic(() => import("./PanoramaView"), { ssr: false, loading: () => <p role="status" className="pano-loading">Preparing your walkthrough…</p> });
export default function PanoramaDialog({ toolbar, ...props }: PanoramaViewProps & { toolbar?: ReactNode }) {
  const { onClose } = props;
  const root = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted || !root.current) return;
    const previous = document.activeElement, bodyOverflow = document.body.style.overflow;
    const siblings = [...document.body.children].filter((element): element is HTMLElement => element instanceof HTMLElement && !element.contains(root.current));
    const inert = siblings.map((element) => element.inert);
    siblings.forEach((element) => { element.inert = true; });
    document.body.style.overflow = "hidden"; lockScrollTour(true);
    root.current.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === "Tab") {
        const focusable = [...root.current!.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, [tabindex="0"]')].filter((element) => element.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (!first) { event.preventDefault(); root.current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keyboard, true);
    return () => { document.removeEventListener("keydown", keyboard, true); siblings.forEach((element, i) => { element.inert = inert[i]; }); document.body.style.overflow = bodyOverflow; lockScrollTour(false); if (previous instanceof HTMLElement) previous.focus({ preventScroll: true }); };
  }, [mounted, onClose]);
  if (!mounted) return null;
  return createPortal(<div ref={root} className="pano-dialog" role="dialog" aria-modal="true" aria-label="360° walkthrough" tabIndex={-1} data-lenis-prevent>
    <PanoramaView {...props} /><div className="pano-loading-close"><button onClick={props.onClose} aria-label="Close loading viewer">×</button></div>{toolbar && <div className="pano-edit-toolbar">{toolbar}</div>}
  </div>, document.body);
}
