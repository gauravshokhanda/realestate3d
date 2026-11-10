"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { frameUrl, type Scene } from "@/data/scenes";
import { useFrameSequence } from "@/lib/use-frame-sequence";
import Preloader from "@/components/Preloader";
import type { PropertyView } from "@/lib/property-types";

type Props = {
  property: PropertyView;
  scene: Scene;
  onProgress?: (progress: number) => void;
  enabled?: boolean;
  priority?: boolean;
  children?: (reducedMotion: boolean, landed: boolean) => ReactNode;
};

export default function FrameSequence({ property, scene, onProgress, children, enabled = true, priority = false }: Props) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  useEffect(() => {
    if (!priority || !wrapper.current) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: "400px" });
    observer.observe(wrapper.current);
    return () => observer.disconnect();
  }, [priority]);
  const active = enabled && (!priority || near);
  const trackLanding = property.panoramas.some((node) => property.rooms.some((room) => room.id === node.roomId && room.sequence === scene.id));
  const { sectionRef, canvasRef, progress, ready: loaded, landed, error, reducedMotion, posterSrc } = useFrameSequence(scene, onProgress, active, trackLanding);
  const ready = loaded && active;
  const mobileScene = scene.mobileFolder && scene.mobileFrameCount ? { ...scene, folder: scene.mobileFolder, frameCount: scene.mobileFrameCount } : null;
  useEffect(() => { if (!ready) return; const id = setTimeout(() => setHasLoaded(true), 700); return () => clearTimeout(id); }, [ready]);
  return (
    <>
      {priority && active && !hasLoaded && <Preloader name={property.brandName} progress={progress} error={error} ready={ready} />}
      <div ref={wrapper} className="sequence-space" data-scene={scene.id} data-scroll-length={scene.scrollLength} data-ready={ready} data-enabled={active} style={{ "--scroll-length": `${scene.scrollLength}px` } as CSSProperties}>
        <section ref={sectionRef} className={`${priority ? "tower-at-rest " : ""}sequence-stage relative h-[100svh] w-full max-w-full overflow-hidden bg-ink motion-reduce:h-auto motion-safe:will-change-transform`} aria-label={`${scene.id.replaceAll("-", " ")} sequence`} aria-busy={!ready}>
          {(reducedMotion || (!ready && !hasLoaded)) && <div className={reducedMotion ? "relative h-[50svh] w-full" : "absolute inset-0"}><picture>{mobileScene && <source media="(max-width: 767px)" srcSet={posterSrc ?? frameUrl(mobileScene, 0)} />}<Image src={posterSrc ?? frameUrl(scene, 0)} alt={`${scene.id.replaceAll("-", " ")} — static sequence preview`} fill priority={priority} unoptimized className="object-cover" /></picture></div>}
          <canvas ref={canvasRef} className={`${reducedMotion ? "hidden" : "block"} h-full w-full max-w-full ${(ready || hasLoaded) && !reducedMotion ? "visible" : "invisible"}`} role="img" aria-label={`${scene.id.replaceAll("-", " ")} animation controlled by scrolling`} aria-hidden={reducedMotion === true}>
            Scroll-driven architectural sequence. Enable images to view the experience.
          </canvas>
          <div className="scene-vignette" aria-hidden="true" />
          {children?.(reducedMotion === true, ready && landed)}
          {!ready && !priority && enabled && <p role="status" className="absolute right-6 top-28 border border-champagne/30 bg-ink/80 px-4 py-2 text-xs text-ivory">{error ? "View unavailable. Please refresh to retry." : `Preparing room · ${Math.round(progress * 100)}%`}</p>}
        </section>
      </div>
    </>
  );
}
