"use client";

import { useEffect } from "react";

type Props = { name: string; progress: number; error: string | null; ready?: boolean };

export default function Preloader({ name, progress, error, ready = false }: Props) {
  useEffect(() => {
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = previous; };
  }, []);
  const percent = Math.round(progress * 100);
  return (
    <div data-complete={ready} className="intro-loader fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-ink px-8" role="status" aria-live="polite">
      <p className="font-display text-4xl uppercase tracking-[0.2em]">{name}</p>
      <p className="text-xs uppercase tracking-[0.2em] text-champagne">
        {error ? "Unable to load the experience" : "Preparing your perspective"}
      </p>
      <div className="h-px w-full max-w-xs bg-ivory/20" role="progressbar" aria-label="Loading sequence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="h-full origin-left bg-champagne" style={{ transform: `scaleX(${progress})` }} />
      </div>
      <span className="text-xs tabular-nums text-ivory/60">{percent}%</span>
      {error && <><p className="max-w-sm text-center text-sm text-ivory/70">Check your connection and try again.</p>
        <button className="border border-champagne px-6 py-3 text-sm text-champagne" onClick={() => window.location.reload()}>Retry loading</button></>}
    </div>
  );
}
