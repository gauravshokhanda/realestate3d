"use client";
import { useEffect, useRef, useState } from "react";

/** Keep the existing wait-for-exit choreography without a JS animation driver. */
export default function ScrollCaption({ caption, brand }: { caption: string | null; brand: string }) {
  const requested = useRef(caption);
  const [displayed, setDisplayed] = useState(caption), [leaving, setLeaving] = useState(false);
  useEffect(() => {
    requested.current = caption;
    if (displayed === null) setDisplayed(caption);
    else if (caption !== displayed) setLeaving(true);
  }, [caption, displayed]);
  if (displayed === null) return null;
  return <div key={displayed} className={`scroll-caption ${leaving ? "is-leaving" : ""} pointer-events-none absolute bottom-16 left-6 right-6 sm:left-12 lg:left-20`} onAnimationEnd={(event) => {
    if (event.target !== event.currentTarget || !leaving) return;
    setDisplayed(requested.current); setLeaving(false);
  }}>
    <p className="text-[10px] uppercase tracking-[0.3em] text-champagne">Discover {brand}</p>
    <p className="mt-3 font-display text-5xl text-ivory sm:text-6xl">{displayed}</p>
  </div>;
}
