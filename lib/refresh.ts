import { ScrollTrigger } from "gsap/ScrollTrigger";

let pending: AbortController | null = null;
export function refreshSequences() {
  pending?.abort();
  const request = new AbortController();
  pending = request;
  // Data/manifests arrive with the server page. Wait once for font metrics and
  // mounted pins; bitmap loading/disposal deliberately never refreshes layout.
  void document.fonts.ready.then(() => requestAnimationFrame(() => {
    if (request.signal.aborted) return;
    ScrollTrigger.refresh(); pending = null;
  }));
}
