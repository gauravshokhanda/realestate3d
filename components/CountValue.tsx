"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export default function CountValue({ value, active, reduced }: { value: string; active: boolean; reduced: boolean }) {
  const span = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (span.current) span.current.textContent = value;
    if (!active || reduced || !span.current) return;
    const match = value.match(/^(\D*)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!match) return;
    const number = Number(match[2].replaceAll(",", ""));
    const decimals = match[2].split(".")[1]?.length ?? 0;
    const state = { value: number * 0.8 };
    const tween = gsap.to(state, { value: number, duration: 1.2, ease: "power2.inOut", onUpdate: () => { if (span.current) span.current.textContent = match[1] + state.value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + match[3]; }, onComplete: () => { if (span.current) span.current.textContent = value; } });
    return () => { tween.kill(); };
  }, [value, active, reduced]);
  return <><span className="sr-only">{value}</span><span ref={span} aria-hidden="true">{value}</span></>;
}
