# MASTER PROMPT — Aurelia Platform (Admin + Auto Video + 360 Walkthrough)

Paste this whole file into Codex (or save it as `AGENTS.md`, replacing the old one — keep a copy of the old one as `AGENTS.phase0-5.md`).
Codex must work in **phases A to F**. After each phase: run `pnpm lint && pnpm build && pnpm smoke`, then STOP and report with screenshots. Do not start the next phase until I say "next".

---

## 0. What we are building (read first)

The current site is a single hardcoded demo. It must become a **platform**:

1. An **Admin Panel** at `/admin` where I add a **property** (name, slug, specs, price, rooms) and upload its images: **tower image, floor-plan image, one image per room, and optional 360° panoramas**.
2. The system **automatically generates the camera-move videos** (tower → floor plan, floor plan → each room) from those images, converts them into frame sequences, and shows status in the admin.
3. Every property is published at **`/<slug>`** (e.g. `localhost:3000/aurelia`). The page is generated from database data, not from hardcoded files.
4. Inside each room the visitor can open a **360° walkthrough** (Google-Maps-Street-View style: drag to look around, click arrows to move between viewpoints, minimap showing position on the floor plan).

### Things that are already approved — DO NOT change the look or logic
- The scroll story: **tower → (facade dissolves) → isometric floor plan → click a room hotspot → room**. The transitions are good.
- Existing look: dark theme, champagne accent `#D8B67A`, Cormorant Garamond + Inter, glass spec panel.
- The existing Aurelia content must be migrated as the first property with slug `aurelia` and must look and behave the same at `/aurelia`.

### Problems to fix (the owner says: "looks simple, not smooth")
- Scrolling is not smooth enough.
- The page feels like a plain demo, not a premium product. (Details in Phase F.)

---

## 1. Tech decisions (fixed)

- Next.js App Router + TypeScript strict + Tailwind (keep existing).
- **Database:** Prisma + **SQLite** for local (`DATABASE_URL=file:./data/app.db`). Keep the Prisma schema Postgres-compatible so it can move later.
- **File storage:** a `StorageAdapter` interface with a `LocalStorage` implementation writing to `./storage/` (git-ignored) and served through a route handler `/media/[...path]` with correct caching headers. Leave an `S3Storage` stub (R2/S3 compatible) so production can switch via env.
- **Auth:** single admin password from `ADMIN_PASSWORD`, signed httpOnly cookie session (use `jose`, secret in `SESSION_SECRET`), login page `/admin/login`, middleware protecting `/admin/*` and `/api/admin/*`. Rate-limit login (5 attempts / 10 min / IP).
- **Image handling:** `sharp` to validate (real image decode, not just MIME), strip metadata, cap size (max 6000px long edge, max 25 MB upload), store a WebP copy plus the original.
- **Video generation:** Gemini API **Veo** via `@google/genai`, key in `GEMINI_API_KEY`, model name in `VEO_MODEL` (do NOT hardcode a model string; read the current official Gemini API docs for the right default and image-to-video / first-and-last-frame usage). If the API does not support an end frame, or no key is set, the system must fall back to **Manual Upload mode** (see Phase C).
- **Frames:** `ffmpeg-static` + `sharp`, server-side.
- **360 viewer:** `@photo-sphere-viewer/core` with `markers-plugin` and `virtual-tour-plugin` (and `gallery`-free). Load dynamically (`next/dynamic`, no SSR).
- Validation: `zod` everywhere. No `any`.
- Reserved slugs that must be rejected: `admin`, `api`, `media`, `_next`, `login`, `favicon.ico`, `robots.txt`, `sitemap.xml`.

---

## 2. Data model (Prisma)

```prisma
model Property {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  tagline     String?
  location    String?
  status      String   @default("draft")   // draft | processing | published
  towerImage  String?                       // storage path
  planImage   String?
  heroCopy    String?
  accentColor String?  @default("#D8B67A")
  units       Unit[]
  rooms       Room[]
  amenities   Json?                         // [{icon,title,text}]
  scenes      Scene[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Unit {
  id         String  @id @default(cuid())
  propertyId String
  name       String            // "Residence A"
  beds       Int
  baths      Int
  sqft       Int
  price      String
  property   Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
}

model Room {
  id          String  @id @default(cuid())
  propertyId  String
  key         String            // "living", "kitchen", "primary-bedroom"
  label       String            // caption
  description String?           // used in the video prompt
  image       String?           // the still that the video lands on
  hotspotX    Float             // % on floor plan
  hotspotY    Float
  order       Int     @default(0)
  nodes       PanoNode[]
  property    Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
}

model PanoNode {              // one 360° viewpoint
  id        String  @id @default(cuid())
  roomId    String
  name      String
  image     String            // equirectangular 2:1
  planX     Float?            // % position on floor plan (for minimap)
  planY     Float?
  startYaw  Float   @default(0)
  links     Json?             // [{toNodeId, yaw, pitch, label}]
  room      Room    @relation(fields: [roomId], references: [id], onDelete: Cascade)
}

model Scene {                 // one camera-move video / frame sequence
  id          String   @id @default(cuid())
  propertyId  String
  key         String            // "hero-to-plan", "plan-to-<roomKey>"
  fromImage   String
  toImage     String
  prompt      String
  mode        String   @default("veo")   // veo | manual
  status      String   @default("queued") // queued|generating|extracting|ready|failed
  progress    Int      @default(0)
  error       String?
  videoPath   String?
  frameCount  Int?
  mobileFrameCount Int?
  trimStart   Float?
  trimEnd     Float?
  attempts    Int      @default(0)
  property    Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  @@unique([propertyId, key])
}
```

Frames live at `storage/properties/<slug>/sequences/<sceneKey>/frame_0001.webp` and `<sceneKey>-mobile/`. A `manifest.json` per scene stores frame counts, dimensions and the trim values.

---

## 3. Phases

### PHASE A — Foundation + migrate Aurelia
1. Add Prisma, schema above, migrations, `pnpm db:seed`.
2. Build the storage adapter and `/media/[...path]` route (path-traversal safe).
3. Replace the static `data/scenes.ts` and `data/units.ts` with DB reads. Create `lib/property.ts` with `getPropertyBySlug(slug)` returning everything the page needs (units, rooms, scenes with manifest).
4. Seed script: import the **existing Aurelia** assets (stills + the four existing sequences) into storage and DB as property `aurelia`, status `published`.
5. Create `app/[slug]/page.tsx` (server component, `notFound()` for missing or draft slugs, `generateMetadata` per property). `app/page.tsx` becomes a simple property index (grid of published properties).
6. Refactor the existing scene components (`Hero`, `FloorPlanScene`, `RoomViewer`, `UnitSelector`, `FrameSequence`, …) to take a `property` prop and build scenes dynamically from `property.scenes`/`rooms`. Number of rooms is variable (1–8), not fixed at 3.
7. **Acceptance:** `/aurelia` looks and behaves exactly like today. `/does-not-exist` shows a styled 404. Smoke test covers both.

### PHASE B — Admin panel (CRUD + uploads)
Routes: `/admin/login`, `/admin` (property list with status badges), `/admin/properties/new`, `/admin/properties/[id]` (edit).
Edit page is a stepper/tabs:
1. **Basics:** name, slug (auto-generated from name, editable, live uniqueness check), tagline, location, hero copy, accent colour, publish/unpublish toggle.
2. **Images:** drag-and-drop upload for **tower image** and **floor-plan image**, with preview and replace/delete. Show warnings if aspect ratio is not ~16:9 or width < 1600.
3. **Units:** add/remove units (name, beds, baths, sqft, price).
4. **Rooms:** add/remove/reorder rooms. Each room: key (auto from label), label, short description, image upload. Then a **Hotspot Placer**: shows the floor-plan image; click to drop/move each room's hotspot; saves percentages.
5. **Amenities:** simple repeatable list.
6. **360° Walkthrough:** (built in Phase E, leave the tab with a "coming next" placeholder now).
7. **Videos:** (built in Phase C).
Requirements: autosave with visible "Saved" state, optimistic UI, form errors from zod, confirm dialogs for delete, the whole admin is responsive and uses the same dark/champagne design language. Upload API: `/api/admin/upload` (multipart, streaming, validated with sharp).
**Acceptance:** I can create a property end-to-end through the UI without touching code, and the draft is visible only in admin.

### PHASE C — Automatic video pipeline
Create a **job system** in `lib/jobs/`: DB-backed queue (Scene.status), one worker loop started lazily in the server process (concurrency 1–2), crash-safe (on boot, reset stuck `generating` jobs to `queued`).
For each property, scenes are derived automatically:
- `hero-to-plan`: from tower image to plan image
- `plan-to-<roomKey>`: from plan image to that room's image
Prompt templates (editable per scene in admin):
- hero-to-plan: *"Start on the luxury building exterior. The camera glides smoothly forward and upward. As it gets close, the glass facade gently dissolves to reveal the apartment inside while the camera tilts down and settles into a 45-degree isometric cutaway view of the apartment. End exactly on the final frame. Constant camera speed, one continuous move, no cuts, no people, no text, no camera shake, no flicker, walls and furniture stay fixed and do not morph, photorealistic architectural visualization, 16:9."*
- plan-to-room: *"Start on the isometric cutaway of the apartment. The camera glides smoothly down and forward toward {room.label} ({room.description}). It lowers to eye level and faces the room. End exactly on the final frame. [same constraints as above]."*

**Veo mode:** send start image + end image + prompt, 16:9, longest allowed duration, lowest-cost resolution that gives ≥720p. Poll the long-running operation, download the MP4, store it. Handle quota/429 with exponential backoff, max 3 attempts, then `failed` with a readable error.
**Manual mode (must work without any API key):** the Videos tab shows each scene with its start/end images, the ready-to-copy prompt (copy button), and a drop zone to upload an MP4 made elsewhere (e.g. in the Gemini app). Uploading starts the same extraction step.
**Extraction step (both modes), fully automatic:**
1. Probe with ffmpeg. Decode to small grayscale frames.
2. **Auto-trim end:** find the first frame whose similarity to the target end image is above a threshold *and* after which the picture stays stable or dissolves into something else. Cut there. This is essential: a past video of ours dissolved into a different room after reaching its target, and had 3–4 s of frozen tail. Also trim frozen head frames. Allow manual override of `trimStart/trimEnd` in the admin with a preview scrubber.
3. **Watermark removal:** optional `delogo` box per scene (default off; Gemini-app downloads have a ✦ sparkle near x=1130,y=569,w=62,h=64 on a 1280×720 frame; API output may not). Add a "Remove watermark" checkbox with those defaults.
4. Extract frames: desktop = `min(source width, 1600)` px, 24 fps, WebP q72; mobile = 800 px, 15 fps, q65. Never upscale. Cap total frames per scene at 240; if more, lower fps.
5. Write `manifest.json`, update `Scene` (frameCount, mobileFrameCount, status `ready`), delete the temp files.
6. **Quality check** after extraction: compare last extracted frame with the end image; if very different, mark scene `needs_review` with a warning and a "Regenerate" button.
Admin Videos tab: per-scene card with status chip, progress bar (poll every 3 s), thumbnail strip of first/middle/last frame, buttons: Regenerate, Edit prompt, Upload MP4, Trim, Download MP4. "Generate all videos" button. Show estimated cost warning before calling Veo ("this will call the paid Gemini API for N videos").
Property status becomes `processing` until every scene is `ready`, then the admin may publish.
**Acceptance:** with `GEMINI_API_KEY` unset, uploading the four existing MP4s in manual mode produces correct, trimmed, watermark-free sequences. With a key set, "Generate all" runs the full flow (if the account/model allows it; otherwise report the exact API error and keep manual mode working).

### PHASE D — Smooth scrolling and performance (do this BEFORE Phase E)
I could not profile the live page, so **measure first, then fix**. Write `scripts/perf.mjs` (Playwright + Chrome tracing) that scrolls `/aurelia` top to bottom at a steady speed on desktop and mobile-emulated CPU 4× throttle and reports: average/p95 frame time, dropped frames, long tasks, JS heap, number of decoded images. Save the report to `/perf/before.json`, then fix, then `/perf/after.json`.
Likely causes to check and fix:
1. **React state updated on every scroll tick** (the `onProgress` → `setState` path drives text/panel). Replace with refs and direct DOM/GSAP updates; only set React state at threshold crossings (e.g. caption index changes).
2. **Drawing from `<img>` per frame.** Decode frames once into `ImageBitmap` (`createImageBitmap`) and draw bitmaps; free bitmaps for scenes far from the viewport (keep a window of ±1 scene).
3. **Scrub lag / jitter:** use one render loop on `gsap.ticker`; compute a target frame from scroll progress and **ease the displayed frame toward it** (lerp ~0.15–0.25) so wheel steps never feel stepped. Keep `ScrollTrigger scrub: true` and let our own interpolation do the smoothing (avoid double smoothing with large scrub values + Lenis).
4. **Lenis config:** `lerp ~0.08–0.1`, `smoothWheel`, `syncTouch: false` on mobile (native scroll is smoother on phones), `autoRaf: false` and driven by the single gsap ticker, `gsap.ticker.lagSmoothing(0)`.
5. Canvas: size at `min(devicePixelRatio, 2)`, `alpha:false` context, `imageSmoothingQuality: "high"`, avoid resizing per frame, use `will-change: transform` only on the pinned wrapper.
6. Preloading: prioritise the current scene, then the next scene during idle (`requestIdleCallback`), abort loads for far scenes. Use `fetchPriority`, HTTP caching (`Cache-Control: public, max-age=31536000, immutable` for frames).
7. Remove layout thrash: no `getBoundingClientRect` in scroll callbacks; avoid animating `box-shadow`/`filter` on large areas; backdrop-blur only on small panels.
8. Check ScrollTrigger pin spacing doesn't cause jumps; call `ScrollTrigger.refresh()` once after fonts and manifests are ready, not repeatedly.
**Acceptance:** p95 frame time ≤ 20 ms on desktop and ≤ 33 ms with 4× CPU throttle; no long tasks > 50 ms during scroll; before/after report included in your answer.

### PHASE E — 360° walkthrough
**Admin tab "360° Walkthrough":** per room, upload one or more **equirectangular (2:1) panoramas** as viewpoints (`PanoNode`). Validate ratio ≈ 2:1 and width ≥ 4096 (warn, don't block). Per node: name, start direction, **position on the floor plan** (click on the floor-plan image to place the dot), and **links to other nodes**: open the panorama inside the admin viewer and click to place an arrow at the exact yaw/pitch, choosing the target node. Preview mode identical to the public viewer.
**Public experience:**
1. When a room scene finishes landing on the room still, show a champagne button **"Explore in 360°"** (keyboard accessible).
2. Clicking it opens a full-screen viewer (Photo Sphere Viewer + virtual-tour plugin): drag/touch to look around, gyroscope on mobile if permitted, smooth cross-fade between nodes when clicking arrows, animated arrows (Street-View style).
3. **Minimap** (bottom-left): the floor-plan image with dots for all nodes of the property and a direction cone showing the current node and heading; clicking a dot jumps there. This also lets the visitor go to another room's 360.
4. Top bar: room name, close (Esc), fullscreen, "Back to scroll tour".
5. If a room has **no panorama**, hide the button and do not break anything.
6. Preload the next likely node's panorama; use `resolution`-appropriate tiles/downscale on mobile; dispose the viewer on close (no memory leak).
**Docs for me:** add `docs/360-assets.md` explaining how to obtain panoramas: real 360 camera or phone panorama app, rendered panoramas from the architect's 3D model, or AI panorama tools (equirectangular output, seamless left/right edge). State clearly that normal AI-generated flat images are NOT valid panoramas.
**Acceptance:** with 2 test panoramas linked to each other, I can look around, walk between them with arrows, and see the minimap update. Include test panoramas generated by a script (a simple labelled equirectangular grid) so this is testable without real assets.

### PHASE F — Premium polish (the site must stop looking "simple")
Implement, keeping the existing design language:
1. **Intro loader** with the property name, a thin champagne progress line, and a smooth reveal into the hero (no blank flash).
2. **Hero:** slow ambient motion (very subtle zoom/parallax on the poster), staggered text reveal, magnetic "Scroll to explore".
3. **Scene chrome:** a vertical **chapter indicator** at the right (Tower · Plan · Rooms · Amenities · Contact) that fills with scroll and is clickable; scene captions with mask/slide reveals; consistent easing (`power2.inOut`, slow).
4. **Floor-plan scene:** hotspots with a pulsing ring, label on hover, and the unit spec panel that animates numbers (counting up for sqft/price) when it appears.
5. **Custom cursor** on desktop only (small ring that grows on hotspots/buttons); disabled on touch and `prefers-reduced-motion`.
6. Subtle film-grain overlay (very light, static PNG, no animation cost) and soft vignette on scene edges for depth.
7. Amenities and contact sections as full designed sections (large serif headings, thin dividers, generous spacing, staggered fade-ups); contact form with elegant focus states and a success animation.
8. Sticky nav that turns to glass; mobile menu with full-screen overlay.
9. Page transitions between `/` (index) and `/<slug>` (fade).
10. SEO: per-property metadata, OG image generated from the tower image, sitemap including published slugs.
**Acceptance:** side-by-side screenshots before/after, no regression in Phase D numbers.

---

## 4. Global rules

1. Never break `/aurelia`. Keep Playwright smoke tests for `/aurelia`, `/does-not-exist`, `/admin/login`, and an authenticated admin flow (create property → upload → publish → visit slug).
2. Security: server-side zod validation for every API; check auth on every `/api/admin/*` handler (not only middleware); sanitize filenames (store with generated ids); never trust client MIME; never expose `GEMINI_API_KEY` or storage paths to the client; limit upload size; add CSRF protection for admin mutations (same-site cookie + origin check).
3. `.env.example` must list: `ADMIN_PASSWORD`, `SESSION_SECRET`, `DATABASE_URL`, `STORAGE_DIR`, `GEMINI_API_KEY`, `VEO_MODEL`, `RESEND_API_KEY`, `LEAD_TO_EMAIL`.
4. `README.md`: how to run, how to add a property, how to use Manual mode, how to switch to Veo mode, how to deploy (Postgres + S3/R2 + a separate worker note).
5. Keep components small (~200 lines), strict TypeScript, accessible (labels, focus, aria on viewer buttons), responsive.
6. Be honest: if something cannot be verified (Veo access, model name, API limits), say exactly what you could not verify and what you did instead. No fake success.
7. After each phase: list files changed, commands run, test results, screenshots in `/screenshots/phase-X/`, known issues, and the exact next step.

START WITH PHASE A ONLY. Stop after Phase A and report.