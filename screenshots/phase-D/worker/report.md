# Phase D continuation: worker rendering

10 November 2026. Phase E has not started. This continuation preserves the original Phase D evidence in the parent directory.

**Final outcome: functional checks and the final local performance gates pass.** Preview: http://localhost:3400/aurelia, using original project data. QA-only servers have been stopped.

## Final performance capture

Both final captures pass the requested timing and long-task gates. The same-condition control was the previously completed Phase D main-thread renderer at port 3400; the final build ran at port 3800 against the isolated QA copy. The control already passes in this later hardware state. These results do **not** establish an incremental worker speedup. They establish that the selected desktop/mobile paths meet the gates in this capture.

| Capture | Device | Average, ms | p95, ms | Estimated dropped frames | Long tasks >=50 ms |
| --- | --- | ---: | ---: | ---: | ---: |
| Control | Desktop | 16.92 | 16.9 | 27 | 0 |
| Final | Desktop | 16.95 | 16.9 | 30 | 0 |
| Control | Mobile, CPU 4x | 16.95 | 16.8 | 31 | 0 |
| Final | Mobile, CPU 4x | 17.00 | 16.8 | 36 | 0 |

Desktop limit: 20 ms. Mobile limit: 33 ms. All four scenes reached ready state in both control and final runs. Each run used a fresh Chrome context, hero/fonts ready, continuous input at 600 CSS px/s, and tracing throughout lazy loading, scene transitions and disposal. Desktop is 1440x900/DPR 1; mobile is 390x844/DPR 2 with 4x CPU throttling. Chrome 156.0.8078.80, Windows, Intel i5-7300U/HD 620, four logical CPUs. The final blank-page median was 16.6 ms desktop / 16.7 ms mobile (approximately 60 Hz).

| Final device | Main-renderer peak JS heap, MB | HTML / bitmap decodes | Worker bitmap decodes | Sampled peak live bitmaps | Estimated peak bitmap MB | Live bitmaps at end |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| Desktop | 7.61 | 8 / 643 | 0 | 323 | 1190.71 | 0 |
| Mobile | 8.43 | 8 / 403 | 403 | 202 | 290.88 | 0 |

[Control JSON](../../../perf/worker/before.json) · [Final JSON](../../../perf/worker/after.json) · [Trace validation](../../../perf/worker/validation.json). Matching compressed traces are stored beside the reports. Original Phase C baseline and earlier Phase D after reports remain in `perf/before.json` and `perf/after.json`; they are historical captures, not this same-condition pair. Earlier 48 Hz failures and experimental worker captures remain in the C: QA perf directory.

## Implementation

ImageBitmap decoding, native bitmap cleanup and canvas drawing now run in dedicated OffscreenCanvas workers on narrow viewports where supported. The existing GSAP ticker supplies eased frame indices; the worker acknowledges first paint before the poster disappears. Mobile decoding is serial. Desktop retains the main-thread bitmap renderer: the paired control had zero long tasks, while the desktop worker had one 53 ms task (51.2 ms waiting for compositor commit). A serial-desktop worker experiment also delayed room readiness and was not retained. The compatibility renderer remains available without OffscreenCanvas.

Aborted and replaced loads have generation IDs, stale replies cannot complete newer loads, and late decodes are released. Leaving the scene window releases bitmaps; unmount terminates the worker. Browser checks cover reverse navigation, runtime reduced motion and the compatibility path. Resource telemetry now includes worker decodes and native bitmap estimates.

## Validation environment

D: had approximately 65 MB free at the start of this continuation. Builds and upload/extraction smoke fixtures used C: temporary directories. A consistent SQLite snapshot and a copy of Aurelia storage isolated test mutations from the original project database/storage. Production source, original Aurelia frame bytes and browser tests remained the same. The scoped temporary build parent links to the project's existing node_modules. No dependencies were installed, and old build caches were retained.

The production build is `.next-phase-d-final`, a junction into `C:/Users/PC/AppData/Local/Temp/aurelia-offscreen-build-root/build-release`. QA database/storage and complete raw artifacts remain under `C:/Users/PC/AppData/Local/Temp/aurelia-worker-qa-UF1ISQ/`.

Early continuation captures ran at **48 Hz**, with approximately 20.8 ms between frames even on a blank page. Later paired captures returned to approximately 60 Hz. Codex did not change display settings; the cause of the cadence change is unconfirmed. Every new report records its own blank-page cadence. Do not compare the 48 Hz results directly with the earlier or later 60 Hz captures. Mobile remains Chrome emulation with CPU throttled 4x, not a physical phone.

Main-renderer JS heap measurements exclude worker heaps, native image memory and GPU allocations. Bitmap estimates are width × height × 4, excluding canvas buffers and GPU copies. Worker peak counts are sampled from progress notifications. Dropped-frame estimates still use the explicitly documented 60 Hz reference. None of these figures establishes lower total browser RAM.

## Commands and checks

```powershell
pnpm test:sequence
pnpm exec tsx --test tests/worker-renderer.test.ts
$env:NEXT_DIST_DIR = '.next-phase-d-final'
pnpm lint
pnpm build
# Start final build against the isolated QA database/storage at port 3800.
$env:PERF_URL = 'http://localhost:3800'
# PERF_OUTPUT selects the C: QA perf directory.
node scripts/perf.mjs after-release
$env:SMOKE_URL = 'http://localhost:3800'
$env:SMOKE_CHANNEL = 'chrome'
# SMOKE_OUTPUT selects the C: QA screenshots/release directory.
node scripts/check-phase-d.mjs
pnpm smoke
node scripts/record-scroll.mjs
```

- Sequence tests: **11 passed**; protocol/abort/error tests: **3 passed**.
- Final lint: **passed**, zero warnings. Final production build: **passed**, including TypeScript checks.
- Final focused Chrome checks: **passed**, no runtime errors. Verified DPR <=2, immutable cache headers, released frames at contact, reverse navigation to frame zero, runtime reduced-motion changes, and the mobile fallback without OffscreenCanvas.
- Hero comparison against the earlier approved capture: mean absolute channel error **0.310/255**. High-quality resampling changes approximately 2.61% of pixels beyond the comparison tolerance; composition is retained, not pixel-identical.
- All four retained control/final gzip traces decompressed and parsed successfully; all performance flags are true and all scenes reached ready.
- Final **pnpm smoke passed**: desktop/mobile and reduced-motion tours; navigation, unit tabs, hotspots and mocked forms; index/styled 404 and dynamic 1/8-room properties; authenticated admin CRUD, uploads, publication and security; all four supplied MP4 extractions, kitchen review warning, manual trim/delogo, 240-frame caps/no upscaling, private byte-range downloads and lease recovery. No console/runtime/HTTP errors; interrupted desktop requests were expected ERR_ABORTED cancellations.
- SHA-256 verified all **1,046** migrated frames. Original project DB remains the single published Aurelia property, with no active jobs. QA fixtures were cleaned by the smoke harness.
- Read-only Chrome checks against the regular port 3400 preview passed on desktop/mobile: tour 200, unknown property 404, login 200, expected renderer selected, no runtime errors.
- Scroll recording completed; its last frame decoded through ffmpeg-static and was visually checked.

[Tour smoke](smoke-report.json) · [Platform](platform-report.json) · [Admin](admin-report.json) · [Videos](videos-report.json) · [Focused resource checks](performance-validation.json) · [Regular preview check](preview-check.json).

## Screenshots

[Desktop full page](desktop-reduced-full-page.png) · [Mobile full page](mobile-reduced-full-page.png) · [Desktop plan/spec panel](desktop-080.png) · [Mobile plan/spec panel](mobile-080.png).

[Finished scroll recording](desktop-scroll.webm) · [Decoded final frame](recording-last-frame.png).

Full-page images use the actual reduced-motion static document flow so pinned gaps do not hide content. Normal viewport screenshots and the recording show the scroll experience. Final desktop/mobile plan screenshots were visually reviewed. Complete unselected admin, room and other screenshots remain in the C: QA release directory.

## Files changed in this continuation

- `lib/sequence-worker-protocol.ts`, `lib/sequence.worker.ts`, `lib/worker-renderer.ts`
- `lib/use-frame-sequence.ts`, `lib/bitmap-preload.ts`
- `tests/worker-renderer.test.ts`, `tests/sequence-loader.test.mjs`
- `scripts/perf.mjs`, `scripts/check-phase-d.mjs`, `scripts/smoke-videos.mjs`
- `README.md`, `tsconfig.json`, parent report and evidence directories

The video smoke assertion now includes the underlying scene error. An initial worker-build run failed during kitchen re-trimming; the repeated full run on the serial-worker build passed. The original failure's cause is unconfirmed. No backend video processing behavior was changed to hide or bypass it. No paid Veo generation or email delivery was tested.

## Known limits and exact next step

The final measured gates pass on this computer at approximately 60 Hz. They are single captures, not a guarantee of zero stalls on every device or power state; the retained 48 Hz captures failed timing gates, and an experimental desktop worker had a compositor stall. Mobile results are emulated. Bitmap residency is bounded but substantial (desktop sampled peak approximately 1.19 GB before GPU copies); no total-memory reduction is claimed. Paid Veo access and real email delivery remain unverified.

D: has approximately **11 MB free** after saving selected evidence. Builds and full QA artifacts remain on C:. Do not expect a normal new D:-resident build or large asset import to fit until space is available. Earlier automatic review rejected cache deletion; those caches remain untouched. The C:-backed final build is temporary local verification infrastructure, not a portable deployment artifact.

Stop here for owner review. On the owner's next explicit "next", begin **Phase E only**: linked test panoramas, admin node/link editing, dynamically loaded public 360 viewer and minimap, then lint/build/smoke and screenshots. Preserve these reports for the Phase F regression comparison.
