# Phase D: implementation and validation

Continuation: the final desktop/mobile renderer selection and passing local gates are documented in [worker/report.md](worker/report.md). The measurements and partial status below describe the earlier main-thread renderer at 60 Hz; preserve them as historical evidence.

10 November 2026, Asia/Calcutta. Phase E has not started.

The implementation and functional checks are complete. Performance acceptance is **partial**: both measured p95 limits pass with continuous input, but the zero-long-task requirement does not. This report does not claim full Phase D acceptance.

Preview: http://localhost:3400/aurelia. The unchanged compiled Phase C build at port 3300 supplied the baseline; the updated production build is `.next-phase-d`.

## Changes

- Decode frames into ImageBitmaps, with the existing image loader as a compatibility fallback. Prioritize the current scene, preload the next room during idle time, and limit residency to the current/adjacent scene window. Abort distant loads and release bitmaps in short batches.
- Paint frames, update navigation progress and drive Lenis on the GSAP ticker. Displayed frames ease toward the target with a time-adjusted 0.2 lerp. ScrollTrigger uses scrub true; Lenis uses lerp 0.09, smoothWheel, syncTouch false and autoRaf false.
- Update React only at overlay/navigation thresholds. Update hero opacity through its DOM ref. Use opaque canvas contexts, high-quality smoothing and DPR at most 2. Resize only when dimensions change; retain small canvas backing stores until unmount to avoid synchronous GPU flushes during scroll cleanup.
- Establish pins independently of loading/disposal. Refresh after fonts/server-loaded manifests and on unit changes, rather than each load/cleanup. Serve versioned published frames with one-year immutable caching; legacy manifests receive deterministic revisions.
- Preserve approved content and scene geometry. No database schema changes or new dependencies; package.json gains the perf script.

## Continuous-input performance

| Device | Average rAF interval, ms | p95, ms | Estimated dropped frames | Long tasks >=50 ms |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 19.43 -> 17.55 | 33.3 -> 16.9 | 246 -> 88 | 43 -> 7 |
| Mobile, CPU 4x | 23.72 -> 18.16 | 50.1 -> 33.0 | 563 -> 151 | 15 -> 2 |

Desktop p95 limit is 20 ms; mobile is 33 ms. Both captured values pass, with little mobile margin. Strictly greater-than-50-ms violations remain: **desktop 6, longest 174 ms; mobile 2, longest 67 ms**. One desktop entry is exactly 50 ms. The long-task gate therefore remains failed.

| Device | Peak JS heap, MB | Explicit HTML / bitmap decodes, before -> after | Peak live bitmaps | Peak bitmap estimate, MB | Live bitmaps at end |
| --- | ---: | --- | ---: | ---: | ---: |
| Desktop | 11.17 -> 7.07 | 642 / 0 -> 8 / 643 | 274 | 1010.07 | 0 |
| Mobile | 9.17 -> 7.00 | 409 / 0 -> 8 / 403 | 202 | 290.88 | 0 |

Decode counts include posters and re-decodes after eviction, not unique files or all internal GPU decodes. Bitmap estimates use width x height x 4 and exclude GPU copies, decoder working memory and canvas buffers. JS heap excludes native allocations. Lower JS heap does not establish lower total browser memory; desktop bitmap memory remains substantial, though bounded.

[Before JSON](../../perf/before.json) | [After JSON](../../perf/after.json) | [Trace validation](../../perf/validation.json)

## Method and limits

Installed headless Chrome 156.0.8078.80, Windows, Intel Core i5-7300U, 4 logical CPUs and approximately 12.7 GB RAM. Each device gets a fresh browser context. Collection starts after hero readiness and fonts, and includes lazy room loading, setup and disposal. Desktop is 1440x900, DPR 1, CPU 1x. Mobile is 390x844, DPR 2, touch/mobile emulation and CPU 4x.

Requested input speed is 600 CSS px/s. Desktop uses a continuous CDP mouse gesture. Mobile dispatches a captured continuous touch drag driven by elapsed time, then cancels at the bottom. The high-level synthetic touch command produced no scrolling even on a plain test document on this Windows/headless setup; direct touch dispatch was verified and used for both builds. The completed desktop baseline was retained when resuming the mobile capture; its application build and input path did not change. This is desktop Chrome emulation, not a physical handset test.

Frame metrics are rAF intervals, not hardware presentation timestamps. Dropped frames are estimates against 60 Hz. Long tasks come from PerformanceObserver; JS heap is sampled every 500 ms through CDP. Gzip Chrome traces cover the same interval. These are single local captures; tracing, system load and thermal state affect results. The primary traces were decompressed and parsed successfully.

The earlier instant-scroll stress test is retained separately. It emits scrollend repeatedly and exercises a different path from continuous touch input. Do not mix its results with the primary comparison.

| Scripted stress device | p95, ms | Long tasks >=50 ms |
| --- | ---: | ---: |
| Desktop | 33.3 -> 16.8 | 16 -> 0 |
| Mobile, CPU 4x | 133.3 -> 33.4 | 125 -> 8 |

[Scripted before](../../perf/scripted-before.json) | [Scripted after](../../perf/scripted-after.json). Initial/iteration captures remain in perf/, including an explicitly named incomplete diagnostic trace from the disk-full attempt. Primary reports do not use that trace.

Protocol reference: [official Chrome DevTools Input protocol](https://chromedevtools.github.io/devtools-protocol/tot/Input/).

## Commands and checks

```powershell
$env:NEXT_DIST_DIR = ".next-phase-d"
pnpm test:sequence
pnpm lint
pnpm build
pnpm start --port 3400
$env:SMOKE_URL = "http://localhost:3400"
$env:SMOKE_CHANNEL = "chrome"
$env:SMOKE_OUTPUT = "screenshots/phase-D"
node scripts/check-phase-d.mjs
pnpm smoke
$env:PERF_URL = "http://localhost:3300"
pnpm perf before
$env:PERF_URL = "http://localhost:3400"
pnpm perf after
node scripts/record-scroll.mjs
pnpm lint
```

PERF_RESUME=1 resumed the missing mobile baseline after verifying matching URL, Chrome version and input mode. PERF_SCROLL=scripted reproduces the archived stress test.

- **Sequence tests: PASS, 10 tests**, including retry/fallback, cancellation during decode, deduplicated cleanup and yielding disposal.
- **Lint: PASS, zero warnings**, including the final harness and recording script.
- **Production build: PASS** for the final application source. Subsequent changes were measurement/recording scripts and documentation.
- **Focused Chrome checks: PASS** for desktop/mobile DPR caps, immutable frame caching, offscreen bitmap release, reverse navigation and runtime reduced-motion changes; zero page errors.
- **pnpm smoke: PASS** for desktop/mobile tour and reduced motion; unit tabs, hotspots/back links, navigation and mocked forms; platform index/404/1-8 rooms; authenticated CRUD/uploads/publication and security; four manual MP4 extractions, trim/delogo, frame caps/no upscaling, private range downloads and job recovery. No paid generation or email delivery occurred.
- Smoke verified SHA-256 identity of all **1,046 migrated frames**. Only the published Aurelia DB property remains, and storage/.jobs is empty. The two pre-existing orphan media directories from Phase C remain unchanged.
- Hero comparison mean absolute channel difference is **0.310 on the 0-255 scale**. High-quality resampling changes about 2.61% of pixels by more than two channel levels. It is not pixel-identical; reviewed composition/layout is retained.
- The recording tail decoded successfully through ffmpeg-static.

[Tour smoke](smoke-report.json) | [Platform](platform-report.json) | [Admin](admin-report.json) | [Videos](videos-report.json) | [Resource checks](performance-validation.json)

## Screenshots and recording

- [Desktop full page, reduced-motion static flow](desktop-reduced-full-page.png)
- [Mobile full page, reduced-motion static flow](mobile-reduced-full-page.png)
- Normal desktop [hero](desktop-000.png) and [plan/spec panel](desktop-080.png)
- Normal mobile [hero](mobile-000.png) and [plan/spec panel](mobile-080.png)
- Rooms: [living](desktop-room-living.png), [kitchen](desktop-room-kitchen.png), [primary bedroom](desktop-room-primary-bedroom.png)
- [Finished desktop scroll recording](desktop-scroll.webm) and [decoded recording tail](recording-last-frame.png)

Full-page captures show the actual reduced-motion document flow, allowing review without pinned-scene gaps. They are not edited or stitched. Normal viewports and the recording show the pinned experience. The mobile viewport and full-page captures were visually reviewed.

## Files changed

- README.md
- package.json
- tsconfig.json
- app/media/[...path]/route.ts
- components/Experience.tsx
- components/FloorPlanScene.tsx
- components/FrameSequence.tsx
- components/Hero.tsx
- components/Nav.tsx
- components/RoomViewer.tsx
- components/SmoothScroll.tsx
- lib/bitmap-preload.ts
- lib/frame-fallback.ts
- lib/property.ts
- lib/refresh.ts
- lib/use-frame-sequence.ts
- scripts/perf.mjs
- scripts/check-phase-d.mjs
- scripts/record-scroll.mjs
- tests/sequence-loader.test.mjs
- Generated evidence in perf/ and screenshots/phase-D/.

## Known issues and exact next step

Remaining >50 ms long tasks block full performance acceptance. Next: deeper browser/render profiling of the saved continuous-input traces, then repeat both device captures until that gate is resolved. Keep Phase E on hold unless the owner explicitly accepts the remaining limitation.

Drive D ran out of space during an intermediate raw trace write. Traces are now compressed; final captures and smoke completed. Free space remains low, approximately 66 MB before final evidence checks. Automatic approval review rejected deletion of unused generated build-cache directories as blocked by policy. Those directories were left in place; no attempt was made to bypass the rejection. Free disk space before importing more footage.
