# Phase B — Admin studio, property editing and uploads

Completed 9 November 2026. Stop here for owner review. Phase C has not started.

## Result

- `/admin/login` provides single-password authentication with jose-signed eight-hour sessions. Cookies are httpOnly, SameSite=Strict and Secure on HTTPS. Either credential changing invalidates existing sessions. Middleware, protected layouts and every admin API verify authentication. Login is limited to five attempts per IP in ten minutes; mutations require a same-site Origin.
- `/admin` lists properties with draft/processing/published badges. `/admin/properties/new` creates a private draft with a derived, editable slug and live uniqueness check.
- `/admin/properties/[id]` provides Basics, Images, Units, Rooms and Amenities editing. Autosave displays Saved/Saving/Not saved, preserves local edits on failure, and supports retry. Server-side Zod errors identify fields. A version check prevents silently overwriting another editor's changes. Units, rooms and properties have deletion confirmations; rooms can be reordered.
- Uploads stream through Busboy to an owned temporary file, with bounded body/file limits, before Sharp fully decodes them. Filenames are generated UUIDs; client MIME and original filenames are not trusted. Originals are retained alongside metadata-stripped WebP copies with a maximum 6000px long edge. Width/aspect warnings are non-blocking. Temporary files are cleaned up.
- The hotspot placer supports clicking the plan, selecting room markers, arrow keys, and precise percentage inputs. Positions and room order persist after reload.
- Publishing requires tower and plan images, at least one unit, 1–8 rooms and an image for every room. New properties use uploaded stills inside the existing tour until Phase C supplies video sequences. Existing Aurelia keeps its original footage, scroll behavior and appearance.
- Draft pages remain 404 publicly; authenticated draft-media previews use private/no-store caching. Stable-ID upload namespaces survive slug changes. 360 and Videos tabs are explicit placeholders for Phases E and C.

## How to review

The production server is available at **http://localhost:3200/admin/login** and **http://localhost:3200/aurelia**. Use `ADMIN_PASSWORD` from the workspace's git-ignored `.env.local`. Both a random password and session secret were generated locally because no environment file was present. Credentials are not included in screenshots or reports. Restart the server after changing them.

Create a draft, fill its tabs, wait for Saved, and publish it. No CLI or database editing is required. The smoke suite's uniquely named properties and uploads were cleaned up; only the original published Aurelia remains.

## Files changed

- Configuration/docs: `package.json`, `pnpm-lock.yaml`, `.env.example`, `README.md`, `next.config.ts`, `tsconfig.json`; Next.js regenerated `next-env.d.ts`. `sharp` is now a runtime dependency; `jose`, `busboy`, and `@types/busboy` were added. Ignored local state: `.env.local`, build outputs, database updates made and cleaned by tests.
- Auth/server: `middleware.ts`; `lib/admin/session.ts`, `http.ts`, `schema.ts`, `property.ts`, `upload.ts`.
- API routes: `app/api/admin/login/route.ts`, `logout/route.ts`, `properties/route.ts`, `properties/[id]/route.ts`, `slugs/route.ts`, `upload/route.ts`.
- Admin routes: `app/admin/layout.tsx`, `admin.css`, `login/page.tsx`; `app/admin/(protected)/layout.tsx`, `page.tsx`, `properties/new/page.tsx`, `properties/[id]/page.tsx`.
- Admin components: `components/admin/api.ts`, `useEditor.ts`, `Fields.tsx`, `Login.tsx`, `SlugField.tsx`, `NewProperty.tsx`, `Shell.tsx`, `ImageUpload.tsx`, `Basics.tsx`, `Units.tsx`, `HotspotPlacer.tsx`, `Rooms.tsx`, `AmenitiesEditor.tsx`, `Editor.tsx`.
- Public compatibility: `data/scenes.ts`, `lib/property.ts`, `app/media/[...path]/route.ts` add still fallbacks and authenticated draft previews while retaining Aurelia sequences.
- Checks/tooling: `scripts/generate-prisma.mjs`, `smoke.mjs`, `smoke-platform.mjs`, `smoke-admin.mjs`, `smoke-admin-security.mjs`; `tests/admin.test.ts`; review captures and JSON reports under `screenshots/phase-B/`.
- No Prisma migration was needed; Phase A already supplied the Phase B tables and fields.

## Commands and results

| Command | Result |
| --- | --- |
| `pnpm add jose busboy` / `pnpm add -D @types/busboy` | Installed |
| `pnpm install --lockfile-only` | Updated Sharp's dependency classification for production uploads |
| `pnpm test:storage` | 2 passed |
| `pnpm test:sequence` | 7 passed |
| `pnpm test:admin` | 2 passed: credential/session tampering and rotation; publication/room validation |
| `pnpm lint` | Passed, zero warnings |
| `NEXT_DIST_DIR=.next-phase-b pnpm build` | Production build and strict type checks passed; no compile warnings in the final build |
| `NEXT_DIST_DIR=.next-phase-b pnpm start --port 3200` | Production server started |
| `SMOKE_CHANNEL=chrome SMOKE_URL=http://localhost:3200 pnpm smoke` | All tour, platform and authenticated admin checks passed |
| Sharp before/after pixel comparison | Desktop/mobile hero 0% changed; floor-plan capture 0.0081% changed pixels at >2/channel threshold |
| Prisma property inventory after cleanup | Only published `aurelia` remains |

Environment assignments use compact notation above; the README includes executable PowerShell instructions. Smoke reports are [smoke-report.json](smoke-report.json), [platform-report.json](platform-report.json), [admin-report.json](admin-report.json), and [visual-comparison.json](visual-comparison.json).

Production Chrome passed desktop 1440×900, mobile 390×844 and both reduced-motion variants with zero console/runtime/HTTP/failed-request errors. Platform checks cover styled 404, one/eight-room rendering, dynamic metadata/publication, unpublished visibility, media traversal/caching/HEAD/ETag, and SHA-256 identity of all 1,046 Aurelia frames.

Authenticated browser checks cover incorrect password, cookie properties, UI creation, incomplete-publication validation, autosave failure/retry without losing edits, image uploads/decoding/privacy, units/rooms/order/hotspots, publish/visit, mobile overflow, unpublish, delete cancellation/confirmation and logout. Security requests deliberately exercise 400/401/403/409/413/429 and a mocked 503: reserved/duplicate slugs, foreign assets/IDs, stale edits, invalid image bytes, >25 MB rejection, valid >10 MB uploads, metadata stripping, generated filenames, 6000px resizing and login throttling. No live email or paid video request occurred.

## Issues found and resolved

- A running Windows server held Prisma's engine DLL, preventing unconditional generation. The build now compares schemas and reuses an identical generated client; genuine schema changes still require generation after stopping processes that hold the engine.
- The initial Busboy part cap also marked a single valid file invalid when the cap was reached. The parser now allows the terminating part count while independently enforcing one file and zero fields.
- Next 15's default middleware body buffer truncated uploads above 10 MB. Its installed `middlewareClientMaxBodySize` setting is now 26 MB, and the route applies the separate 25 MB file cap. The [official Next documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/middlewareClientMaxBodySize) describes this middleware buffering behavior; this project uses the Next 15 setting name verified in its installed type definitions.
- Named jose signing/verification imports remove unrelated Edge compression API warnings. [jose's official documentation](https://github.com/panva/jose/blob/main/docs/README.md) documents those JWT APIs.
- The initial smoke fixture URL matcher also matched `/new`; it was corrected to wait for the actual created ID. The two identified temporary fixtures from those failed runs were removed. The final run also cleaned up all of its fixtures.
- Screenshot capture now eagerly decodes visible-tab images before saving full-page previews.

## Screenshots

- [Admin login desktop](admin-login-desktop.png) / [mobile](admin-login-mobile.png)
- [Property list](admin-properties-desktop.png)
- [Create draft](admin-new-property.png)
- [Basics desktop](admin-basics.png) / [mobile editor](admin-editor-mobile.png)
- [Tower and plan uploads](admin-images.png)
- [Unit editor](admin-units.png)
- [Rooms and hotspot placer](admin-rooms-hotspots.png) / [mobile](admin-rooms-mobile.png)
- [Amenities](admin-amenities.png)
- [Published property state](admin-published.png)
- [New property public mobile view](new-property-published-mobile.png)
- [Aurelia desktop full page, reduced-motion flow](desktop-reduced-full-page.png) / [mobile](mobile-reduced-full-page.png)
- [Aurelia floor plan](desktop-080.png) and [styled 404](not-found.png)

## Known limits and exact next step

- New properties currently use stills, without generated camera moves. Phase C must implement the queue, Manual Upload, Veo, trimming, extraction and video-ready publication rules. Model availability, Gemini credentials and paid quotas have not been tested.
- Login throttling is process-local. Production proxies must overwrite untrusted `X-Forwarded-For`, and multi-instance deployments need a shared limiter. Local HTTP cookies are intentionally not Secure; configure the public HTTPS site URL in production.
- Deleted/unreferenced files are retained for recovery rather than garbage-collected. Property deletion removes public namespace access. Previously published media can remain in browser caches until expiry after unpublishing; downloads cannot be recalled. Originals retain original metadata; the displayed WebP copy is stripped.
- Unsaved edits are kept in the current tab, not persisted offline. Closing/reloading with unsaved edits prompts the browser; conflicts require reloading. The admin has no draft public-tour preview link; it provides private image previews, with public tour access after publication.
- Photo Sphere Viewer/360, scroll profiling, final polish, production PostgreSQL/S3 and generated OG artwork/sitemap remain in their later phases. Existing footage artifacts and transfer budgets are unchanged. No Phase D performance improvement is claimed.

Stop after Phase B. The exact next step, after the owner says **next**, is Phase C: database-backed video jobs and Manual Upload mode, then verified Veo first/last-frame integration and shared trimming/frame extraction.
