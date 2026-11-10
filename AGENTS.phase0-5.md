# Cinematic Scroll Website for New-Development Real Estate — Codex Build Spec

Save this file in the project root as `AGENTS.md` (Codex reads it automatically), or paste the sections into Codex.
Work in **phases**. Finish one phase, run it, then share the result with Claude for review before the next.

---

## 1. Product summary

A scroll-driven, cinematic one-page website for a luxury new-development tower. Scrolling plays a pre-rendered animation (image sequence on canvas) that moves the viewer:

1. **Hero:** dusk exterior of the tower, with a small info card and minimal nav.
2. **Fly-in:** camera moves into the building and becomes a **3D isometric cutaway floor plan** (Residence A) with a spec panel (beds / baths / sqft / price).
3. **Interior views:** living room, kitchen, primary bedroom, each with a caption label.
4. **Unit selector + hotspots:** clicking a room on the floor plan jumps to that room's view.
5. **Amenities, then contact form (lead capture).**

The site must feel smooth and premium on desktop and work well on mobile.

## 2. Tech stack (fixed, don't substitute)

- **Next.js 14+ (App Router) + TypeScript**
- **Tailwind CSS**
- **GSAP + ScrollTrigger** for scroll-scrubbing and pinning
- **Lenis** for smooth scrolling (synced with ScrollTrigger)
- **Framer Motion** for UI transitions (panels, captions)
- **HTML `<canvas>`** for frame-sequence playback
- Lead form: Next.js route handler + **Resend** (env var `RESEND_API_KEY`), with a graceful fallback that logs to console in dev
- Deploy target: **Vercel**
- Package manager: `pnpm`

No heavy UI kits. No Three.js in v1 (the 3D look comes from pre-rendered frames).

## 3. Project structure

```
/app
  layout.tsx
  page.tsx
  api/lead/route.ts
/components
  SmoothScroll.tsx        // Lenis + ScrollTrigger sync
  FrameSequence.tsx       // canvas scrubber (reusable)
  Hero.tsx
  FloorPlanScene.tsx      // pinned scene + spec panel + hotspots
  RoomViewer.tsx          // interior views + captions
  UnitSelector.tsx
  Amenities.tsx
  ContactForm.tsx
  Nav.tsx
  Preloader.tsx
/data
  units.ts                // typed unit data (see schema)
  scenes.ts               // sequence config (folder, frame count, scroll length)
/public
  /sequences
    /hero-to-plan/frame_0001.webp ...
    /plan-to-living/...
    /plan-to-bedroom/...
  /images                 // posters / fallbacks
/lib
  preload.ts              // image preloader with progress
  utils.ts
/scripts
  make-placeholder-frames.mjs   // generates placeholder frames so the site runs with no real assets
  extract-frames.sh             // ffmpeg: mp4 -> webp frames
```

## 4. Data schemas

```ts
// data/units.ts
export type Room = {
  id: string;            // "living", "kitchen", "primary-bedroom"
  label: string;         // caption shown in UI
  sequence: string;      // scene id to play when selected
  hotspot: { x: number; y: number }; // % position on floor plan
};

export type Unit = {
  id: string;            // "residence-a"
  name: string;          // "Residence A"
  beds: number;
  baths: number;
  sqft: number;
  price: string;         // "From $1.2M"
  floorPlanSequence: string;
  rooms: Room[];
};

// data/scenes.ts
export type Scene = {
  id: string;
  folder: string;        // "/sequences/hero-to-plan"
  frameCount: number;
  pad: number;           // zero-pad length, e.g. 4
  ext: "webp";
  scrollLength: number;  // px of scroll the scene occupies (e.g. 3000)
};
```

## 5. Hard rules for Codex

1. TypeScript strict mode. No `any`.
2. `FrameSequence` must **preload all frames of a scene before it is scrubbed**, and report progress to `Preloader`.
3. Use `requestAnimationFrame`-safe drawing: only redraw the canvas when the frame index changes.
4. Canvas must be **DPR-aware** and **resize-safe** (object-fit: cover behavior drawn manually).
5. Respect `prefers-reduced-motion`: show static poster images with normal scrolling, no pinning.
6. Always clean up ScrollTrigger instances on unmount (`ctx.revert()`).
7. Mobile: load a lighter sequence if `window.innerWidth < 768` (folder suffix `-mobile`, fewer frames). Fall back to desktop sequence if mobile folder is absent.
8. No layout shift: reserve scene height before assets load.
9. Accessibility: semantic landmarks, visible focus states, alt text or `aria-label` on canvas, form labels.
10. Keep each component under ~200 lines; extract hooks when needed.
11. After each phase, run `pnpm lint && pnpm build` and fix all errors before stopping.

## 6. Design direction

- Palette: near-black (`#0A0A0B`), warm champagne accent (`#D8B67A`), soft white text.
- Type: serif display (Cormorant Garamond or Playfair Display) + clean sans (Inter).
- Generous spacing, thin 1px dividers, small uppercase tracking-wide labels.
- Spec panel: translucent glass card (backdrop-blur), thin border.
- Motion: slow, eased (`power2.inOut`), nothing bouncy.

---

## 7. Phases and prompts for Codex

### Phase 0: Scaffold

> Create a Next.js 14 App Router + TypeScript + Tailwind project using pnpm. Install `gsap`, `lenis`, `framer-motion`, `resend`. Create the folder structure from AGENTS.md. Add the fonts (Cormorant Garamond + Inter via `next/font`). Set up the color tokens in Tailwind config. Make `pnpm dev` show a blank dark page with the Nav. Do not build any scenes yet.

**Review checklist:** builds clean, fonts load, tokens set, structure matches.

### Phase 1: Placeholder assets and the FrameSequence engine

> 1. Write `scripts/make-placeholder-frames.mjs` (use `sharp`) that generates 3 placeholder sequences (`hero-to-plan`, `plan-to-living`, `plan-to-bedroom`), 90 frames each at 1600x900 WebP, each frame showing a gradient that shifts over time plus the scene name and frame number in large text. Run it.
> 2. Build `lib/preload.ts` (preload N images, progress callback, returns `HTMLImageElement[]`).
> 3. Build `components/FrameSequence.tsx`: props `scene: Scene`. Pins a full-viewport `<canvas>`, scrubs frames with GSAP ScrollTrigger (`scrub: 0.5`, `pin: true`, `end: "+=" + scene.scrollLength`), DPR-aware, cover-fit drawing, cleanup on unmount.
> 4. Build `SmoothScroll.tsx` (Lenis synced to ScrollTrigger via `lenis.on('scroll', ScrollTrigger.update)` and `gsap.ticker`).
> 5. Build `Preloader.tsx` with a progress bar. In `page.tsx` render the hero-to-plan scene.

**Review checklist:** scrolling scrubs frames smoothly, no flicker, no console errors, resizing works, ScrollTrigger cleanup works.

### Phase 2: Hero + Floor-plan scene + spec panel

> Build `Hero.tsx` (tower poster image, headline, subtext, "Scroll to explore" cue, info card at top right). Then `FloorPlanScene.tsx`: pins the `hero-to-plan` sequence, and as it reaches ~70% progress, fades in a glass spec panel (Framer Motion) showing the unit's name, beds, baths, sqft, price from `data/units.ts`. Add scroll-linked text captions that change per progress range.

**Review checklist:** panel appears at the right time, text is readable over frames, panel is responsive.

### Phase 3: Interior views + hotspots + unit selector

> Build `RoomViewer.tsx` that plays the selected room's sequence (`plan-to-living`, `plan-to-bedroom`) and shows a caption chip (e.g. "Primary Bedroom") bottom-left. Add clickable hotspot dots over the floor plan using `room.hotspot` (percent positions). Clicking a hotspot smooth-scrolls (Lenis `scrollTo`) to that room's scene. Build `UnitSelector.tsx` (tabs for units; use 2 sample units in `units.ts`).

**Review checklist:** hotspot click scrolls to the right scene, captions match, keyboard accessible.

### Phase 4: Amenities + Contact form + API

> Build `Amenities.tsx` (6-card grid with icons and short copy, fade-up on scroll). Build `ContactForm.tsx` (name, email, phone, interested unit, message; client + server validation with zod). Build `app/api/lead/route.ts` that sends the lead via Resend to `LEAD_TO_EMAIL`; if no API key, log to console and return success. Add honeypot field and basic rate limiting.

**Review checklist:** validation messages, success and error states, no secrets in client code.

### Phase 5: Performance, mobile, polish

> Add mobile sequence fallback logic, `prefers-reduced-motion` handling, lazy loading of non-hero sequences (start preloading the next scene when the current is 50% done), `next/image` for posters, and meta tags + OG image. Run Lighthouse and report scores. Reduce total initial transfer under 3 MB before first scroll.

**Review checklist:** mobile smooth, Lighthouse performance 80+ on mobile, no memory blowup (check frame count and sizes).

### Phase 6: Swap in real assets and deploy

> Replace placeholders with real sequences (see section 8). Update `scenes.ts` frame counts. Deploy to Vercel, add env vars, and verify the lead form works in production.

---

## 8. How to produce the real assets (done outside Codex)

1. **Stills:** tower exterior (dusk), isometric floor plan, living room, kitchen, primary bedroom. Use the developer's renders, or generate with an image model using the floor plan PDF as a reference.
2. **Camera moves:** in an AI video tool (Kling / Runway / Veo / Luma) use start-frame to end-frame:
   - Move A: tower exterior, then floor plan
   - Move B: floor plan, then living room
   - Move C: floor plan, then primary bedroom
   Keep each 5-8 seconds.
3. **Extract frames** (`scripts/extract-frames.sh`):
   ```bash
   ffmpeg -i move.mp4 -vf "fps=24,scale=1600:-1" -c:v libwebp -quality 72 \
     public/sequences/hero-to-plan/frame_%04d.webp
   # mobile version
   ffmpeg -i move.mp4 -vf "fps=15,scale=800:-1" -c:v libwebp -quality 65 \
     public/sequences/hero-to-plan-mobile/frame_%04d.webp
   ```
4. **Budget:** aim for 90-150 frames per move at ~40-70 KB each on desktop, and under 25 KB on mobile.

## 9. When you come back to Claude

After each phase, send:

- A screen recording or screenshots of the result
- Any console or build errors
- The key file if something feels off (e.g. `FrameSequence.tsx`)

I'll review against the checklists above and give you the exact next prompt or fix for Codex.