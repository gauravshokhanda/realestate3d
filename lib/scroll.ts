import type Lenis from "lenis";

let scroller: Lenis | null = null;

export function setScroller(value: Lenis | null) { scroller = value; }
export function lockScrollTour(locked: boolean) { if (locked) scroller?.stop(); else scroller?.start(); }

export function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  let top = target.getBoundingClientRect().top + window.scrollY;
  if (id === "residences") {
    const scene = target.querySelector<HTMLElement>("[data-scroll-length]");
    if (scene) top += Number(scene.dataset.scrollLength) * 0.8;
  } else if (id === "amenities" || id === "contact") top -= (document.querySelector("header")?.getBoundingClientRect().height ?? 80) + 24;
  if (scroller) scroller.scrollTo(top, { duration: 1.5 });
  else window.scrollTo({ top, behavior: "instant" });
}
