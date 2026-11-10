# Phase E — 360° walkthrough

10 November 2026, Asia/Calcutta. Phase F has not started.

**Functional acceptance passed.** The final production lint/build and full smoke rerun passed. The two linked chart panoramas support looking around, arrow navigation and minimap updates. The separate scroll performance capture retains the limitations documented below; no zero-stall claim is made.

## Implementation

- Admin viewpoint uploads use the existing streaming/real-decode pipeline with a panorama mode. Originals are retained; metadata-free desktop WebP copies are capped at a 6000px long edge, with 2048px mobile copies. The 25 MB cap remains. Ratio and width warnings do not block uploads.
- The 360° Walkthrough tab supports up to eight viewpoints per room: names, floor-plan clicks or numeric percentage placement, starting yaw, and links authored by clicking an exact yaw/pitch in the shared viewer. Removal uses confirmation dialogs. Viewpoints autosave with visible status, version conflicts and retained edits on failure. Parent Save now, publishing and returning to the list flush viewpoint changes.
- The new guarded panorama endpoint validates JSON with zod, checks origin and ownership for every room, node, image and link, and rejects cross-property references. A separate snapshot revision avoids conflicts with unrelated property fields. No database migration was needed: the existing PanoNode model is used.
- Public entry appears only after a room's final frame is painted. Only rooms with panoramas track that extra threshold; properties without panoramas retain their existing controls and frame path. Reduced-motion visitors enter from static room sections.
- Photo Sphere Viewer core, markers, virtual-tour and gyroscope plugins are dynamically loaded without SSR. Gallery is not installed. The shared public/admin viewer supports drag/touch, directional walking arrows, fades, minimap jumps across rooms, a live heading cone, fullscreen, Escape/close and return to scroll. Motion controls depend on browser capability and permission.
- The dialog lives outside pinned transforms in a portal, traps keyboard focus, makes the background inert and locks native/Lenis scroll. Close restores focus and scroll position.
- Owned panorama requests are cancellable. Current/next source blobs are retained; distant object URLs and their viewer-cache entries are released. Navigation promises settle/abort before plugin destruction, avoiding late callbacks into destroyed services. Close also releases the WebGL context. Reduced motion removes fades and arrow pulses.

## Test assets and demo

`assets/panoramas/test-living.webp` and `test-kitchen.webp` are generated 4096×2048 spherical grids. They are explicitly labelled **test charts, not property photography**.

```powershell
pnpm pano:fixtures
pnpm pano:demo
```

The second command creates a separate `/walkthrough-demo` property with two linked test viewpoints, reusing Aurelia's existing scroll assets. It leaves Aurelia unchanged, and repeated seeding preserves existing demo edits. Aurelia must stay published while the demo uses its shared scroll assets. See [the asset guide](../../docs/360-assets.md) for obtaining real panoramas, authoring links and mobile/permission limits.

## Scroll regression capture

The owner confirmed switching the display back to 60 Hz; Windows and each blank-page rAF reference agree. The previous Phase D build at port 3400 supplied a fresh control. The final Phase E build at port 4000 used the isolated QA copy with identical Aurelia assets. No extraction, build or other automated browser workload ran concurrently with the captures.

| Device | Capture | Average interval, ms | p95, ms | Estimated dropped frames | Long tasks >=50 ms |
| --- | --- | ---: | ---: | ---: | ---: |
| Desktop | Phase D control | 17.30 | 17.0 | 64 | 3 |
| Desktop | Phase E final | 17.27 | 17.0 | 61 | 2 |
| Mobile, CPU 4x | Phase D control | 18.26 | 33.2 | 159 | 1 |
| Mobile, CPU 4x | Phase E final | 18.03 | 33.1 | 139 | 1 |

Both final runs reached all four scenes and ended with zero tracked bitmaps. Final peak main-renderer JS heap: desktop 6.99 MB, mobile 8.49 MB. Successful HTML/bitmap decode counts remain 8/643 desktop and 8/403 mobile. Sampled peak native bitmap estimate: desktop 287 bitmaps / 1058.00 MB; mobile 201 / 289.44 MB. Main-renderer heap excludes worker heaps and all native/GPU memory; bitmap estimates exclude canvas buffers and GPU copies. No reduction in total browser memory is claimed.

These captures show no increase in p95 or long-task counts versus this fresh control. **They do not pass all Phase D strict gates:** desktop long tasks remain, and mobile p95 is 0.1 ms above the 33 ms target with one long task. The earlier Phase D zero-long-task capture was not reproduced even by its unchanged control in this hardware state. Do not round 33.1 down to a pass or discard the stalls. This remains a measured limitation for subsequent performance work.

[Control JSON](../../perf/phase-E/before.json) · [Final JSON](../../perf/phase-E/after-final.json). Compressed traces are stored alongside the JSON. The intermediate Phase E capture in `after.json` is retained; it recorded 12 desktop long tasks. Unnecessary landing-state updates on non-panorama scenes were subsequently removed; the final source is the `after-final` capture. Single captures, system load and native compositor behavior do not establish causality or guarantee timing on other devices.

All six retained compressed traces decompressed and parsed successfully: [validation](../../perf/phase-E/validation.json). All four scenes reached ready state in every capture; false threshold flags were preserved.

Method: installed headless Chrome 156.0.8078.80 on Windows, Intel i5-7300U/HD 620, four logical CPUs. Fresh browser contexts, fonts/hero ready, 600 CSS px/s continuous CDP mouse gesture on desktop and direct touch dispatch on mobile; lazy decoding and cleanup remain inside the measurement. Desktop 1440×900/DPR 1; mobile 390×844/DPR 2 with 4x CPU throttling. Dropped frames are estimates against 60 Hz. This is desktop Chrome emulation, not a physical handset.

## Commands run

```powershell
pnpm test:sequence
pnpm exec tsx --test tests/worker-renderer.test.ts
pnpm test:panorama
$env:NEXT_DIST_DIR = '.next-phase-e-final'
pnpm lint
pnpm build
# QA server: pnpm start --port 4000, with isolated DATABASE_URL/STORAGE_DIR.
$env:SMOKE_URL = 'http://localhost:4000'
$env:SMOKE_CHANNEL = 'chrome'
$env:SMOKE_OUTPUT = 'D:/3d/screenshots/phase-E'
node scripts/check-phase-d.mjs
$env:SMOKE_OUTPUT = 'D:/3d/screenshots/phase-E/final'
pnpm smoke
```

The focused unit suites passed **18 tests** (11 sequence, 3 worker protocol, 4 panorama validation/source lifecycle). Final lint and production build passed, including strict TypeScript checks.

## Final production smoke results

- **PASS** desktop/mobile scroll tours and reduced-motion layouts: no console/runtime/HTTP errors. Requests cancelled when leaving scene windows were expected ERR_ABORTED cancellations.
- **PASS** index, styled unknown-property 404, dynamic 1–8-room properties, metadata, media MIME/caching/ETag/HEAD/traversal protections and cross-property lead rejection. SHA-256 verified all **1,046** migrated frames.
- **PASS** authenticated admin creation, autosave failure/retry, image uploads, units/rooms/hotspots, publication after ready sequences, CSRF/ownership/slug/version/size checks, rate limiting, responsive layout, deletion confirmations and logout.
- **PASS** manual video mode: all four supplied MP4s extracted with trim/delogo; the wrong kitchen endpoint remains needs_review; frame caps/no-upscaling, authenticated byte ranges and interrupted-job recovery work. No paid generation was submitted.
- **PASS** panorama upload/real decoding, 4096px desktop/2048px mobile copies, ratio/width warnings, private draft media, bidirectional arrow authoring and starting-yaw/plan placement.
- **PASS** panorama API revision conflicts, foreign room/node/image/link rejection, bounds and origin checks. Cancelled deletion preserves nodes; confirmed deletion prunes incoming arrows. Mobile admin has no horizontal overflow.
- **PASS** entry only after final-frame paint, desktop drag, mobile touch drag, native fullscreen, arrow navigation, cross-room minimap, live heading cone, keyboard focus trap, Escape/focus/scroll return, reduced motion and hidden entry for rooms without panoramas.
- **PASS** close/reopen, close during transition and close with an intercepted image request still pending. Tracked GPU textures and object URLs return to zero; after four desktop openings the four viewer contexts were lost/released (one reusable library capability-probe context remains). Mobile teardown also returns textures/object URLs to zero. This verifies owned resources, not every browser allocation.

The first full production attempt stopped on a mobile test that emitted only one touch move. Inspection of the installed viewer source confirmed that the first threshold-crossing move starts dragging and later moves apply rotation. The harness now emits a sustained gesture. Its standalone rerun passed, then the entire final **pnpm smoke exited 0**. The initial failure report and successful standalone rerun are retained separately; application code did not change for this harness correction.

[Tour report](final/smoke-report.json) · [Platform](final/platform-report.json) · [Admin](final/admin-report.json) · [Videos](final/videos-report.json) · [Panoramas](final/panoramas-report.json) · [Frame/resource checks](performance-validation.json).

QA cleanup was verified: only Aurelia and the intentional walkthrough demo remain, with two demo panoramas and zero active jobs. Re-running the demo seed preserved existing edits.

## Screenshots and recording

[Desktop viewer](demo-desktop-360.png) · [Mobile viewer](demo-mobile-360.png) · [Admin arrow authoring](final/admin-panorama-author.png) · [Mobile admin](final/admin-panorama-mobile.png).

[Finished scroll + walkthrough recording](walkthrough-scroll.webm) · [Room landing/entry button](demo-room-landed.png).

[Aurelia desktop full page](final/desktop-reduced-full-page.png) · [Aurelia mobile full page](final/mobile-reduced-full-page.png). Full-page images use actual reduced-motion document flow; normal viewport captures and the recording show the pinned scroll experience. Production mobile/public and admin-authoring screenshots were visually reviewed.

## Environment and reproducibility

D: is nearly full. New package files were installed on C: and linked into the existing node_modules; package.json and pnpm-lock.yaml record the normal dependencies. Fresh installations can use ordinary pnpm install when adequate space is available. Old generated build caches were retained.

The final production output is `.next-phase-e-final`, linked to `C:/Users/PC/AppData/Local/Temp/aurelia-offscreen-build-root/build-e-final`. A consistent SQLite snapshot and copied Aurelia storage under `C:/Users/PC/AppData/Local/Temp/aurelia-phase-e-qa-AtW4d9/` isolate automated upload/processing tests from original data. Final evidence lives at `C:/Users/PC/AureliaWorkspaceArtifacts/phase-E-screenshots` and `phase-E-perf`, linked at their documented project paths. Phase D worker performance evidence was moved intact to `C:/Users/PC/AureliaWorkspaceArtifacts/phase-D-perf-worker`; its original `perf/worker` links still work.

## Files changed

- package.json, pnpm-lock.yaml, tsconfig.json, README.md, docs/360-assets.md
- assets/panoramas/test-living.webp, assets/panoramas/test-kitchen.webp
- lib/panorama.ts, lib/panorama-source.ts, lib/property.ts, lib/property-types.ts, lib/scroll.ts, lib/use-frame-sequence.ts
- lib/admin/panoramas.ts, lib/admin/upload.ts
- app/api/admin/properties/[id]/panoramas/route.ts, app/api/admin/upload/route.ts, app/admin/admin.css
- components/FrameSequence.tsx, components/RoomViewer.tsx, components/admin/Editor.tsx, components/admin/ImageUpload.tsx
- components/admin/panoramas/{Panoramas,Positioner,AuthorPreview,usePanoramas}.tsx/ts
- components/panorama/{TourLauncher,PanoramaDialog,PanoramaView,Minimap}.tsx, panorama.css
- scripts/make-test-panoramas.mjs, scripts/seed-panorama-demo.ts, scripts/record-panorama.mjs, scripts/smoke-panoramas.mjs, scripts/smoke.mjs, scripts/smoke-admin.mjs
- tests/panorama.test.ts, tests/panorama-source.test.ts, this report and generated validation evidence

## Known verification limits

Physical-device gyroscope behavior and permission prompts cannot be verified by desktop emulation. Test with HTTPS on a real phone. Real property panoramas were not supplied; test grids verify navigation and projection plumbing, not photographic stitching quality. Paid Veo access and real email delivery remain untested. No paid generation or email was sent in this phase.

Stop after Phase E validation and report. The next phase, only after owner review and an explicit next, is **Phase F — premium polish**.

## Final regular preview check

The final Phase E production build is running at http://localhost:3400. Open http://localhost:3400/aurelia for the original property and http://localhost:3400/walkthrough-demo for the two linked test panoramas. Desktop and mobile Chrome checks returned 200 for both properties and admin login, 404 for the missing property, working arrows/minimap, and no runtime errors: [preview check](preview-check.json).

The original Aurelia property, units, rooms, scenes and panorama records are unchanged, verified by a before/after fingerprint: [original data verification](original-aurelia-fingerprint.json). The original-database demo seed succeeded after its initial disk-space failure was resolved by preserving generated evidence on C:.

The entire Phase D screenshot directory was also moved intact to C:/Users/PC/AureliaWorkspaceArtifacts/phase-D-screenshots and linked back at screenshots/phase-D. Existing reports remain accessible. The final desktop/mobile viewer screenshots were retaken on the regular preview after image decoding and visually reviewed.