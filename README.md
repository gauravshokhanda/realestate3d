# Aurelia platform — Phase C

The approved cinematic tour remains at **/aurelia**; **/** lists published properties. **/admin** is the private property studio, including the working **Videos** tab. Missing, draft, processing, and reserved slugs return a styled 404. Performance work, 360 viewing and premium polish remain in Phases D–F.

## Run locally

```sh
pnpm install
# Copy .env.example to .env and set any optional credentials locally.
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000/aurelia for the tour or http://localhost:3000 for the property collection. DATABASE_URL defaults to `file:./data/app.db`, resolved from the project root for both Prisma CLI and the app. Prisma config initializes a missing SQLite file on Windows before migration. STORAGE_DIR defaults to `./storage`. Both locations are git-ignored. Prisma 6.19.3 is pinned for the existing Next.js stack; the application schema uses portable scalar, Json and relational fields.

The seed requires the five existing PNG stills in `assets/stills/` and four desktop/mobile sequences in `public/sequences/`. It decodes the stills with Sharp, stores original PNGs and metadata-stripped WebP copies, copies every frame unchanged, writes scene manifests, and creates published Aurelia with its two original units. A second seed never overwrites the existing property or its assets.

## Database-driven pages

`lib/property.ts` reads published properties, their units, ordered rooms, scenes and storage manifests on the server. Pages are dynamic, so publication and content changes appear without rebuilding. Client components receive only the public presentation data and media URLs, not filesystem locations, prompts or credentials. Rooms are variable (1–8). Aurelia's per-unit room visibility and hotspot overrides are preserved in Unit.roomSettings; Property.presentation holds the original brand/copy details without hardcoding them in the public components.

`data/scenes.ts` and `data/units.ts` now hold shared types/helpers only. Legacy Aurelia import input is isolated in `prisma/seed-data.ts`; public pages never import it.

## Storage and media

StorageAdapter has a LocalStorage implementation and an explicit, nonfunctional S3Storage extension stub. Files live at `storage/properties/<slug>/...`. Each sequence has `manifest.json` with desktop/mobile dimensions, frame counts, trim values and scroll length. The public `/media/[...path]` handler restricts access to published property assets, rejects traversal and symlinks/junctions, returns correct MIME and content length, supports HEAD and conditional ETag 304, and adds nosniff and public caching headers. Unversioned URLs use one-hour caching and stale-while-revalidate rather than immutable caching that could retain replaced frames indefinitely. Do not place private files under the public property namespace.

## Adding a property

1. Set `ADMIN_PASSWORD` and `SESSION_SECRET` (at least 32 characters) in `.env.local`, then restart the server. This workspace has generated local credentials in that git-ignored file; use its `ADMIN_PASSWORD` to sign in. Do not commit or share it.
2. Visit `/admin/login`, sign in, and choose **Add property**. Enter a name and unique slug; a new property starts as a private draft.
3. In **Basics**, enter copy, location and accent colour. In **Images**, upload the tower and floor plan. JPEG, PNG, WebP, AVIF and TIFF are decoded on the server, capped to a 6000px long edge and converted to metadata-free WebP. Originals are retained. The limit is 25 MB per image; aspect/size warnings do not block saving.
4. Add units with specs/prices. Add 1–8 rooms with images and descriptions, reorder them with the arrow buttons, then choose each room in the hotspot placer and click its location on the floor plan. Arrow keys and percentage inputs also work.
5. Add amenities. Changes autosave after a short pause; wait for **Saved** before leaving, or choose **Save now**. Errors preserve local edits. Concurrent changes from another editor produce a conflict instead of overwriting data; reload to resolve it.
6. Open **Videos**. The tower-to-plan and plan-to-room scenes appear automatically once their images are saved. Upload or generate a video for each scene and wait for **ready**. Resolve any **needs review** warnings; the server blocks publication until every scene is ready.
7. Choose **Publish property**, then visit `/<slug>` using **View property**. The server also requires tower/plan images, at least one unit and an image for every room. Aurelia retains its original sequences. Unpublish to hide the property and protect its media.

The editor also supports image replacement/removal and confirmed deletion of units, rooms, amenities and properties. Property deletion retains unreferenced files for recovery; deleting the DB record removes public access to its namespace. Draft previews require an authenticated cookie and use `private, no-store` caching. A browser may retain a previously public asset until its cache expires after unpublishing; already downloaded media cannot be recalled. Slugs can change without moving uploads, which use stable property IDs in storage. Aurelia's legacy namespace also uses its stable ID.

Admin sessions are signed with jose, httpOnly, SameSite=Strict and expire after eight hours. HTTPS deployments receive Secure cookies; changing either credential invalidates sessions. Middleware and every admin handler verify authentication, and mutations enforce the request Origin. Login allows five attempts per IP per ten minutes in a bounded process-local store. Production proxies must overwrite client-supplied `X-Forwarded-For`; use a shared rate-limit store for multiple instances. No default production password is supplied. The 360 tab remains a Phase E placeholder. Paid generation requires an explicit confirmation in Videos.

Reserved slugs: admin, api, media, _next, login, favicon.ico, robots.txt, sitemap.xml. Shared Zod validation is in `lib/property-validation.ts` and `lib/admin/schema.ts`; admin inputs are validated on the server.

## Manual video and Veo modes

**Manual mode works without an API key.** In Videos, each scene shows its exact start/end stills and a copyable/editable camera prompt. Create an MP4 in a tool that supports those first/last frames, then use **Upload MP4** or drop the file on its scene. MP4s may be up to 100 MB, 120 seconds, and 4096px per edge. The server validates the actual container and decodes the video; file extensions and MIME are not sufficient.

The single-job worker starts lazily when authenticated admin pages or video endpoints are used. It analyses small grayscale frames at 6fps, proposes a trim around the target arrival, and removes clearly frozen head/tail material. The default **Remove watermark** option is off; enable it for a visible sparkle. Its editable box defaults to x=1130,y=569,w=62,h=64 in 1280×720 reference coordinates and scales to the actual source. Delogo interpolation can leave a smudge and does not remove embedded provenance.

Both modes use the same extraction: desktop width at most 1280px / 24fps / WebP quality starting at 72; mobile width at most 640px / 15fps / quality starting at 65. Neither variant upscales. Quality, then frame rate, is reduced to fit 8 MiB desktop / 3 MiB mobile per scene; extraction fails clearly if it cannot fit. Each variant caps at 240 frames, lowering fps when necessary. Sequences and manifests are written at `storage/properties/<slug>/sequences/<sceneKey>/` and `<sceneKey>-mobile/`. Replacements are staged, with rollback backups retained until the scene commits; temporary extraction files are then removed. Revisioned frame URLs avoid reusing cached frames after a rebuild. Source MP4s stay available for authenticated preview/download with byte-range seeking. Uploads and extraction require at least 2 GiB free on the storage drive. The admin footer shows drive capacity and property-owned media usage.

The scene card displays status, progress, first/middle/last thumbnails, frame counts and trim values. **Trim** opens a source-video scrubber and timestamp inputs; **Rebuild with trim** overrides automatic boundaries, while **Use auto trim** clears them. The last extracted frame is checked against the target. A significantly different endpoint is marked **needs_review** and blocks publishing. Regenerate/upload a matching move, or replace the still with the intended endpoint and upload again. This is a grayscale heuristic, not semantic proof of architectural consistency. In the supplied test assets, the kitchen MP4 lands on a different kitchen from `assets/stills/kitchen.png`; its warning is expected and cannot honestly be fixed merely by trimming.

Properties become **processing** when work is queued, return to **draft** after all scenes are ready, and require an explicit publish action. Existing ready Aurelia footage is never automatically regenerated by opening the admin. Replacing source images invalidates their scenes; active jobs must finish before their source images can be changed.

**Veo configuration:** Set `GEMINI_API_KEY` and `VEO_MODEL` locally and restart. No model string is hardcoded and no default is selected: [Google's current documentation](https://ai.google.dev/gemini-api/docs/veo) reports that Gemini API Veo 3.1 preview models shut down on October 22, 2026. Verify a currently supported Veo model with your account before setting the variable. The adapter uses `@google/genai`, checks model availability, supplies the first and last images, requests one 8-second 16:9 video at 720p, persists the long-running operation ID and polls/downloads it. Unsupported end-frame/model errors fall back to Manual Upload with the sanitized provider error. It does not substitute Gemini Omni or Vertex AI, which would change the fixed integration. With no live key/model in this workspace, account access, pricing and live generation are unverified.

**Generate all videos** and per-scene paid regeneration require confirmation naming the number of videos and duration; account/model pricing determines the charge. Quota/429 and transient server failures back off exponentially, with at most three generation/polling attempts. Job leases are renewed while running; expired generating/extracting leases recover after restart. Saved operations resume polling. If a crash occurs after submission but before the operation ID is saved, the worker stops for review rather than risk an automatic duplicate paid request. Explicitly check Gemini billing before regenerating that ambiguous job.

For a persistent local/separate worker, run `pnpm worker` alongside the server. It reads `.env.local`/`.env` and uses the same SQLite database and storage. Its active handle keeps it alive; the in-server worker uses unref'ed idle timers. DB claims prevent the same scene running twice across processes. Use one worker process for the intended concurrency of one; in-server plus one separate process permits at most two simultaneous jobs. Authentication/worker credentials are never returned to the client.

The existing offline CLI still works for legacy source preparation:

```sh
pnpm run import assets/videos/hero-to-plan.mp4 hero-to-plan --end 7.5 --delogo 1130:569:62:64
```

It uses ffmpeg-static, optional source-timestamp --start/--end trims, delogo before scaling, 24fps desktop (maximum 1280px, initial WebP q72), and 15fps mobile (maximum 640px, initial q65), without upscaling. Both variants cap at 240 frames and use the same size budgets and disk-space floor as platform imports. Hero is imported before rooms; the first four room frames blend from the corresponding hero endpoint. Failed imports retain old frames/configuration. Successful imports replace old legacy frames and update `prisma/seed-data.ts`. **This legacy command does not update an already-seeded database property.** Use the admin Videos tab for platform imports. `pnpm frames` also affects only the legacy public placeholder inputs.

Existing delogo interpolation artifacts remain in the migrated footage; Phase A preserves the approved bytes rather than reprocessing the videos. All desktop scenes remain above the earlier 8 MB warning budget.

## 360° walkthroughs

In the property editor's **360° Walkthrough** tab, choose a room and upload seamless 2:1 spherical panoramas. Select a viewpoint to name it and click the floor plan to place it. Open **Preview / place arrows** to set its starting direction and click an exact yaw/pitch for a link to another viewpoint. Add a return arrow in the other viewpoint when needed. Changes autosave with their own visible Saved status; conflicting edits from another session are rejected. Save now, publishing and returning to the property list also flush viewpoint edits.

The public **Explore in 360°** button appears once a room's last frame is painted; rooms without panoramas keep their existing UI. The full-screen overlay supports drag/touch, walking arrows, keyboard controls, a cross-room minimap with a direction cone, fullscreen, and device motion when supported/permitted. Escape or Back to scroll tour closes it and restores focus and scroll position. Reduced motion disables the panorama fade/pulse effects. Mobile requests a 2048px copy. Next-viewpoint fetching is cancellable; only current/next source blobs are retained and closing disposes the viewer, cache entries, object URLs and WebGL context.

```sh
pnpm pano:fixtures  # create two labelled 4096x2048 test charts
pnpm pano:demo      # create /walkthrough-demo with two linked test viewpoints
pnpm test:panorama
```

The separate demo reuses Aurelia's approved scroll frames and clearly labels its spherical grids as test assets. It leaves `/aurelia` unchanged. Repeat seeding preserves existing demo edits. See [docs/360-assets.md](docs/360-assets.md) for obtaining valid panoramas and authoring links. Ordinary flat AI images are not valid spherical panoramas. Sensor behavior needs a physical phone/HTTPS check; desktop emulation does not verify gyroscopes.

## Lead delivery

Set RESEND_API_KEY, LEAD_TO_EMAIL, and a verified LEAD_FROM_EMAIL for live delivery. Without a key, validated inquiries log on the server and return success. The form sends the property slug and selected DB unit ID. The server rejects mismatched units or unpublished properties before delivery. Honeypot and per-process rate limiting remain. Use a shared rate-limit store for distributed production instances.

## Validation and screenshots

```sh
pnpm test:storage
pnpm test:sequence
pnpm test:import
pnpm test:admin
pnpm test:jobs
pnpm test:panorama
pnpm lint
pnpm build
pnpm start
# In a second PowerShell terminal:
$env:SMOKE_CHANNEL = "chrome"
pnpm smoke
```

Install Chromium once with `pnpm exec playwright install chromium` if testing without installed Chrome. Set SMOKE_URL to override the origin. The existing scroll, unit-switching, hotspot, navigation, form and reduced-motion tests now target /aurelia. The platform checks cover the index, styled 404, draft/processing visibility, publication without rebuild, 1/8 rooms, metadata, media byte identity/caching/traversal, and cross-property lead rejection. Delivery is mocked; tests never send email. The platform suite checks hashes of every migrated frame and cleans up only its own uniquely named records/media.

Current reports and screenshots are in `screenshots/phase-D/`; earlier phase evidence is preserved. Full-page tour images use reduced-motion document flow. Chrome smoke also verifies admin login, authenticated creation, image/video uploads, units/rooms/hotspots, publication after matching sequences, security failures, unpublishing and logout. The video suite processes all four supplied MP4s, verifies the kitchen warning, tests manual trimming, watermark filtering, 240-frame caps, no upscaling, private byte-range downloads and expired-lease recovery. Test credentials are read from `.env.local`/`.env` or the process environment and must match the running server. Fixtures use unique names and are removed after testing. Tests do not submit paid generation. Lighthouse and live delivery are not verified by these tests.

When testing a production build alongside `pnpm dev`, use a separate output directory and port. Both the build and start commands must receive the same `NEXT_DIST_DIR`; this prevents the development server from overwriting production JavaScript/CSS during browser checks.

```powershell
$env:NEXT_DIST_DIR = ".next-phase-c"
pnpm lint
pnpm build
pnpm start --port 3300
# In a second terminal:
$env:SMOKE_CHANNEL = "chrome"
$env:SMOKE_URL = "http://localhost:3300"
pnpm smoke
```

## Deployment direction

Local SQLite and filesystem storage are not suitable for persistent writes on Vercel. Before production deployment: switch the Prisma provider to PostgreSQL, generate a PostgreSQL migration baseline and migrate the data; implement S3/R2 storage using the adapter interface and generated object keys; configure production secrets; and run the video queue in a separate persistent worker. The checked-in SQLite migration must not be applied to PostgreSQL. The S3 stub deliberately throws if selected, rather than claiming production uploads work. Set NEXT_PUBLIC_SITE_URL for canonical URLs and per-property social metadata. Vercel deployment is deferred.

## Phase boundary

Phase F adds premium presentation while preserving the tower ? plan ? rooms story and the 360 walkthrough. Its evidence remains in `screenshots/phase-F/report.md`. D2 changes only performance, measurement, endpoint review and disk safety; see `perf/d2/report.md` and `screenshots/phase-D2/` for its results and limitations. Stop for owner review after D2. The build reuses Prisma's generated client when the formatted schema matches, avoiding Windows DLL replacement while another server is running. After a schema change, stop servers using the engine before running `pnpm db:generate` and migrations; `pnpm exec prisma format` keeps the source and generated schema formatting aligned.



## Scroll performance

Run an optimized production server, then profile installed Chrome with `pnpm perf before` (before changes) and `pnpm perf after` (after changes). Set `PERF_URL` to its origin; the default is `http://localhost:3300`. `PERF_CHANNEL` defaults to `chrome`. Reports and compressed Chrome JSON traces are saved in `perf/`. Each run uses a fresh browser context and scrolls `/aurelia` at 600 CSS pixels/second with a continuous Chrome CDP mouse gesture on desktop and touch gesture on mobile, after the hero and fonts are ready, including lazy room loading. The observer never writes scroll position. Set `PERF_SCROLL=scripted` for the separate instant-scroll stress test; that mode emits `scrollend` repeatedly and is not a simulation of a continuous touch gesture. Desktop is 1440x900 at native CPU; mobile is 390x844, DPR 2, touch emulation and 4x CPU throttling. This is desktop Chrome emulation, not a physical phone.

Reports include average/p95/max rAF interval, estimated dropped frames against 60 Hz, scroll long tasks, JS heap samples, successful image/bitmap decode counts, and live/peak bitmap counts. A blank-page rAF sample records the available refresh cadence before each capture. Bitmap byte estimates use width x height x 4; JS heap excludes worker heaps and native image/GPU allocations. Worker resource peaks are sampled from progress notifications. Timing includes tracing overhead and depends on display refresh, hardware, temperature and background load. A whole-page p95 includes static sections, so consult long tasks and the trace as well. Open `*-trace.json.gz` in Chrome DevTools Performance to investigate stalls. `PERF_OUTPUT` selects another output directory; `SMOKE_OUTPUT` does the same for smoke screenshots/reports.

Frame selection and Lenis share GSAP's ticker. The displayed frame eases toward scroll progress; overlay React state changes only at caption/panel boundaries. Canvas DPR is capped at 2, uses an opaque context, and only resizes when dimensions change. Its backing store remains until unmount. A shared worker decodes a directional working window (16 frames behind / 32 ahead, reversed when scrolling back), small background windows and six spare LRU frames. Evicted ImageBitmaps close immediately. Reservations precede allocation, enforcing a shared 250 MiB desktop / 120 MiB mobile decoded-bitmap budget. Canvas backing stores, decoder scratch memory and GPU allocations are additional browser memory, outside that estimate. Compressed frames use HTTP caching. Fast jumps hold the nearest decoded frame and crossfade into the destination. Reduced motion uses static posters and no pins. Versioned published frame URLs receive one-year immutable caching; replacing a sequence changes its revision.

Desktop and mobile use OffscreenCanvas painting in the shared worker where supported. The compatibility path transfers one bitmap at a time to the main painter and closes it after drawing; it shares the same bounded worker decoder. Aborted loads release late bitmaps, inactive scenes release their decoded frames, and unmount terminates the worker. Add `?debug=1` for decoded-frame count, estimated MiB and current/target frame counters. Run `pnpm exec tsx --test tests/frame-window.test.ts tests/window-renderer.test.ts tests/disk-space.test.ts` and `node scripts/check-d2.mjs` for D2 resource, fast-jump, reduced-motion and compatibility checks.

For the five-run D2 comparison, preserve a complete prior production build and its database/media copy, start it separately, then run `PERF_URL=<control-origin> node scripts/perf-d2.mjs control` and `PERF_URL=<candidate-origin> node scripts/perf-d2.mjs candidate` (set environment variables using your shell). This harness always uses headed installed Chrome and refuses software GPU compositing. It saves all ten runs, GPU details, CPU profiles and traces per configuration under `perf/d2/`; median and worst results include every run, with invalid captures explicitly flagged. Run `node scripts/attribute-d2.mjs <configuration>` for trace-backed long-task tables; set `ATTRIBUTION_BUILD` to that configuration's build folder for available source maps. Do not run builds, extraction or other browser tests during benchmarking. Mobile is desktop Chrome emulation at 4x CPU, not a physical phone.

For `needs_review` videos, compare the actual last frame with the intended endpoint, enter an audit note, and choose **Approve anyway** only after reviewing the warning. The server records the note, warning, similarity, revision and timestamp. Approval makes the scene ready but does not publish the property. Re-extraction runs QC again and keeps historical approvals without applying them to the new revision.

Mouse gestures and direct touch dispatch follow the [official Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/tot/Input/). The high-level synthetic touch command is a no-op on this Windows/headless Chrome setup, including a plain test page; the mobile harness uses verified direct touch dispatch instead. Both builds must use the same input mode for comparison. Archived `scripted-before.json` and `scripted-after.json` retain the programmatic-scroll stress results separately. Valid captures can finish successfully while their JSON threshold flags remain false; inspect the flags when assessing acceptance.


## Premium presentation and sharing

The tour includes a loading reveal, chapter navigation, a full-screen mobile menu, subtle scene texture, animated specifications and inquiry success feedback. Motion respects the reduced-motion preference; touch devices keep the native cursor. The Collection link returns to the property index, and route entries fade in. Published property social cards are generated from the tower image at `/<slug>/og`; `/sitemap.xml` includes published property slugs. Set `NEXT_PUBLIC_SITE_URL` to the production origin before building/deploying so canonical, sitemap and social URLs use the correct host. Replacing a tower image updates the generated social image after its five-minute cache lifetime.

Run `node scripts/smoke-polish.mjs` against an optimized server using `SMOKE_URL` and `SMOKE_OUTPUT`. This covers responsive navigation, keyboard focus, reduced motion and generated social assets. Its inquiry success test intercepts the request locally and sends no email.
#   r e a l e s t a t e 3 d  
 