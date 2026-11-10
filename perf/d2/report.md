# Phase D2 report

Implementation is in place. **Performance acceptance remains open.** The last complete verified bounded-worker cohort met desktop targets; mobile p95 was 33.3 ms, above the strict 33 ms limit. A reliable fresh five-run verification of the rebuilt installation has not been completed. Do not interpret this report as a full performance pass.

Preview: http://localhost:3400/aurelia. Active media stays in D:/3d/storage. Test database/media remain isolated on C:. No paid video calls were made and no next phase was started.

**Five-run evidence**

Installed headed Chrome 156.0.8078.80; actual renderer: ANGLE (Intel, Intel(R) HD Graphics 620 (0x00005916) Direct3D11 vs_5_0 ps_5_0, D3D11-30.0.100.9865). Hardware GPU compositing was verified through Chrome SystemInfo and command-line inspection, with software renderers rejected. Desktop: 1440 x 900, DPR 1, native CPU. Mobile: 390 x 844, DPR 2, touch emulation, CDP 4x CPU. Reference median rAF intervals were approximately 16.7 ms, consistent with available 60 Hz cadence. Mobile emulation is not a physical phone.

Every timed capture used a new browser context, a foreground visible page, 600 CSS px/s continuous CDP input, Chrome tracing and a 1 ms main-thread CPU profile. Builds, extraction and other browser tests did not run concurrently with the timed cohorts. Timings include tracing/profiling overhead. Frame time is the rAF interval; it is not a measurement of every video frame presented by the GPU. No failed or slow run was silently discarded.

p95 and task columns are **median / worst across all five runs**, not the p95 of a pooled sample. Cache peaks are sampled decoded-bitmap estimates, excluding canvas/GPU/decoder scratch memory.

| Configuration | Device | Valid runs | p95 ms median / worst | Tasks >50 ms median / worst | Peak sampled decoded MiB |
| --- | --- | ---: | ---: | ---: | ---: |
| Untouched Phase F control | Desktop | 1/5 | 17.0 / 17.1 | 1 / 5 | 893.0 |
| Untouched Phase F control | Mobile 4x | 5/5 | 33.3 / 33.3 | 0 / 0 | 277.4 |
| Bounded worker (restored design) | Desktop | 5/5 | 17.0 / 17.1 | 0 / 0 | 151.2 |
| Bounded worker (restored design) | Mobile 4x | 5/5 | 33.3 / 33.4 | 0 / 1 | 51.9 |
| Containment/CSS experiment (reverted) | Desktop | 5/5 | 17.0 / 17.0 | 0 / 3 | 144.1 |
| Containment/CSS experiment (reverted) | Mobile 4x | 5/5 | 33.3 / 33.3 | 0 / 2 | 51.9 |

The control's four desktop readiness failures are retained. Its old ready flag waited for complete scene decoding; the bounded renderer reports ready after first paint. Those control captures cannot be presented as fully usable scene-animation runs merely because their rAF p95 was low. Desktop control task counts varied from zero to five, demonstrating material run-to-run noise.

The selected bounded-worker configuration had desktop p95 17.0 / 17.1 ms and zero long tasks in every run. Mobile had 33.3 / 33.4 ms p95 and zero / one long task. Mobile therefore missed its p95 limit by about 0.3 ms at the median. About 33.3 ms represents two available 60 Hz refresh intervals; having no >50 ms task does not guarantee a <=33 ms p95. A single root cause for the remaining sub-50 ms frame-pacing misses was not established, so no hardware or JS cause is asserted without evidence.

Raw data: [control](control.json), [bounded worker](window-initial.json), [reverted experiment](containment.json), [all 38 completed run records](run-index.json). Each record links its compressed Chrome trace and CPU profile. Summary passesMedianTargets checks medians; passes additionally requires every run to meet both limits. Invalid captures remain visible.

**Long-task attribution and changes**

[Control: every recorded task](control-long-tasks.md) and [full trace/CPU details](control-long-tasks.json) identify seven desktop tasks. Six were dominated by native Commit work (about 41-72 ms); another included about 41 ms Layerize work. Their accompanying JS calls were much smaller. The trace does not justify calling these JS decode or GC stalls. The bounded shared worker reduces the decoded working set and moves desktop painting off the main thread; those desktop stalls were absent in the selected five-run cohort. This is measured association, not proof that one isolated change caused every native stall.

[Bounded-worker mobile tasks](window-initial-long-tasks.md) identify the two 55 ms tasks across five mobile runs: run 2 at 1.692 s in the hero included Framer Motion keyframe/animation startup (39.4 ms FireAnimationFrame); run 5 at 18.386 s while the viewport sample was in plan-to-kitchen included 28.9 ms Paint. Sources, function names, compiled locations and source-map locations where available are retained in the JSON. Native time with no identifiable JS function remains explicitly unattributed.

CSS caption/panel and paint-containment experiments were investigated against these paths. The complete containment cohort did not improve results: desktop worst task count was three and mobile worst was two. [Its six tasks](containment-long-tasks.md) include native Layerize/Commit and specification-panel animation startup. These styling experiments were reverted; original presentation/choreography is retained.

An additional panel experiment was stopped under system pressure after four runs per device. It is **not** a completed acceptance cohort. Windows reported only 456,536 KiB free physical RAM during capture; after closing the benchmark browser it reported about 1.8 GiB free and 69% CPU load. Two desktop captures failed scene readiness. All eight completed captures and their 75 observed tasks remain in [system-pressure.json](system-pressure.json), [task table](system-pressure-long-tasks.md) and [task details](system-pressure-long-tasks.json). Their memory/load conditions are observations; their precise causal contribution was not quantified.

Task timestamps align to the d2-scroll-start Chrome trace marker. Scene labels come from the preceding scroll-position sample (up to about 100 ms earlier); they describe viewport context, not ownership of a painted node. Native operation times are inclusive/nested and must not be summed. Main-thread CPU profiles do not profile worker CPU execution.

**Retained renderer changes**

A single shared worker owns decoded ImageBitmaps. The foreground window contains 16 frames behind / 32 ahead, reversed with scroll direction; background views use five-frame windows. Six spare LRU frames are retained. Obsolete fetches abort and evicted bitmaps close. Reservations precede bitmap allocation, enforcing a shared 250 MiB desktop / 120 MiB mobile bitmap budget. This is an estimated decoded-pixel budget, not a promise that total browser RSS or GPU memory stays below that number.

Far jumps hold the nearest cached frame, prioritize the destination and crossfade for approximately 140 ms when it arrives. OffscreenCanvas painting is used where supported. The compatibility painter receives one bitmap at a time and closes/acknowledges it. Compressed frames use versioned immutable HTTP caching. Add ?debug=1 for decoded frames, estimated MiB/reservations/budget, and current versus target indexes. Counters are zero-based and update without per-scroll React state.

The browser cache checks passed desktop, mobile, OffscreenCanvas-disabled fallback and a cold initial-frame stall followed by a far jump. They verified actual destination painting/crossfade, bounded resources, reverse seeks, immutable headers and release under reduced motion. A settled desktop seek test peaked near 207 MiB; mobile near 48 MiB, within their budgets.

**Frame sizing and preservation**

Desktop caps at 1280 px and mobile at 640 px, without upscaling. Platform and legacy CLI extraction cap at 240 frames; quality, then fps, is reduced to fit 8 MiB desktop / 3 MiB mobile. Unachievable budgets fail clearly. The synthetic 320 px importer fixture remains 320 px in both variants.

| Scene | Desktop dimensions | Desktop MiB | Mobile dimensions | Mobile MiB |
| --- | --- | ---: | --- | ---: |
| hero-to-plan | 1280 x 720 | 7.4 | 640 x 360 | 2.4 |
| plan-to-living | 1280 x 720 | 7.3 | 640 x 360 | 1.8 |
| plan-to-kitchen | 1280 x 720 | 7.3 | 640 x 360 | 2.0 |
| plan-to-bedroom | 1280 x 720 | 7.8 | 640 x 360 | 1.8 |

[Asset sizes](asset-sizes.json) and [activation proof](asset-activation.json) record seven scene-reference updates and 1050 hash-verified new files. Existing frame counts and scroll lengths were retained. Active frames were re-encoded/resized; they are not claimed byte-identical to the originals. Original media was retained, and the original SQLite database was backed up before activation: D:/3d/perf/d2/original-db-before-assets-dfed86d9-151b-452f-a98f-eb226f7748d1.db. No whole-database replacement was used to activate the assets.

**QC override and disk safety**

Needs-review cards compare the actual last frame against the intended end image. Approve anyway requires a warning confirmation, an 8-1000 character audit note and the current sequence revision. The server records note, warning, similarity, revision, actor and timestamp. Stale/repeated/cross-origin approvals are rejected. Approval makes a scene ready but leaves publication separate. Re-extraction runs QC again and preserves historical approvals without applying them to a new revision.

Image/MP4 uploads, LocalStorage writes, platform extraction and legacy CLI extraction check at least 2 GiB free on the destination drive. Low space returns a clear storage error (HTTP 507 for admin writes). Unit tests exercise below-threshold, zero and exact-threshold capacity without filling the user's disk. The authenticated Storage footer shows drive capacity and property-owned media, with shared media counted under its owner. The live D: capture reported 22.0 GiB free; the earlier disk-space blocker is resolved. This disk safeguard is separate from the later physical-RAM constraint.

**Verification status**

- pnpm lint: passed after the retained code and final smoke-script changes.
- NEXT_DIST_DIR=.next-d2 pnpm build: final project-local build passed.
- pnpm smoke: final rebuilt installation passed the complete suite: public desktop/mobile, reduced motion, platform, authenticated admin, manual video QC/audit and re-extraction, panoramas, and presentation/SEO (exit 0).
- pnpm exec tsx --conditions react-server --test tests/jobs.test.ts tests/storage.test.ts tests/admin.test.ts tests/frame-window.test.ts tests/window-renderer.test.ts tests/disk-space.test.ts: 16 passed.
- pnpm test:import: five passed, including real bundled-ffmpeg sample imports, rollback/validation, trims and no-upscaling.
- node scripts/check-d2.mjs: all four cache/seek/compatibility modes passed on the working bounded renderer.
- node scripts/capture-d2.mjs: live D: desktop/mobile/full-page screenshots and MP4/WebM recording saved; no page errors. Recording is separate from performance measurement.
- pnpm install --frozen-lockfile: restored five packages after temporary dependency targets disappeared; no version upgrade.

[Verification history](verification-history.json) records the initial queue-wide test timeout, a transport ECONNRESET and the corrections. Adaptive re-encoding required increasing the test queue deadline from four to fifteen minutes. Only the idempotent security-test GET retries ECONNRESET; HTTP failures and mutations are not retried. Final smoke room seeks now wait for actual navigation and target-frame painting instead of assuming fixed sleeps imply completion.

**Installation repair and current verification limit**

Temporary build folders and panorama dependency junction targets disappeared during this work. Ten dangling build links were removed without deleting existing target data; [link inventory](removed-dangling-build-links.json) is retained. Locked dependencies were restored through pnpm and the final build now lives in D:/3d/.next-d2. Source, database, media and the permanent reports/screenshots remained intact.

The original control build matched all 229 saved compiled-file hashes at capture time ([integrity record](control-integrity.json)); its temporary compiled folder is no longer available to rerun. Its complete trace/profile/report evidence survives. The rebuilt installation matches 47 of 55 archived JS/CSS assets; dependency relinking changed bundle identifiers/hashes. Thus the old cohort is evidence for the restored renderer configuration, not a newly verified binary-identical final package.

After the rebuild settled, Windows still reported about 1.5 GiB free physical RAM and 65% CPU load. Another timing claim under that condition would not resolve the measurement uncertainty. **Still required:** a quiet-machine five-run desktop/mobile verification of this rebuilt installation, with a preserved permanent control. Mobile's strict p95 target remains unmet in the last complete verified cohort. No success is claimed for that gate.

**Review artifacts**

- [Desktop](../../screenshots/phase-D2/live-desktop.png), [mobile](../../screenshots/phase-D2/live-mobile.png), [full page](../../screenshots/phase-D2/live-full-page-reduced-motion.png). Full-page capture uses reduced-motion document flow so all sections can be reviewed in one image; it is labeled accordingly.
- [Finished scroll MP4](../../screenshots/phase-D2/finished-scroll.mp4), [WebM](../../screenshots/phase-D2/finished-scroll.webm).
- [Storage footer](../../screenshots/phase-D2/live-storage.png), [QC override](../../screenshots/phase-D2/d2-qc-approved.png), [desktop debug counters](../../screenshots/phase-D2/d2-desktop-cache.png), [mobile counters](../../screenshots/phase-D2/d2-mobile-cache.png).

**Files changed / added**

- README.md
- next.config.ts
- next-env.d.ts
- tsconfig.json
- app/admin/admin.css
- app/api/admin/storage/route.ts
- app/api/admin/properties/[id]/videos/[sceneId]/route.ts
- app/media/[...path]/route.ts
- components/FrameSequence.tsx
- components/FrameDebug.tsx
- components/TourPolish.tsx
- components/admin/Shell.tsx
- components/admin/StorageSummary.tsx
- components/admin/videos/SceneCard.tsx
- lib/use-frame-sequence.ts
- lib/frame-window.ts
- lib/frame-cache.worker.ts
- lib/window-protocol.ts
- lib/window-renderer.ts
- lib/window-paint.ts
- lib/property-validation.ts
- lib/storage/disk.ts
- lib/storage/usage.ts
- lib/storage/local.ts
- lib/admin/http.ts
- lib/admin/upload.ts
- lib/jobs/api.ts
- lib/jobs/schema.ts
- lib/jobs/approve.ts
- lib/jobs/encode.ts
- lib/jobs/extract.ts
- lib/jobs/upload.ts
- scripts/perf-d2.mjs
- scripts/attribute-d2.mjs
- scripts/check-d2.mjs
- scripts/capture-d2.mjs
- scripts/optimize-sequences-d2.ts
- scripts/activate-d2-assets.mjs
- scripts/import-sequence.mjs
- scripts/smoke.mjs
- scripts/smoke-admin.mjs
- scripts/smoke-admin-security.mjs
- scripts/smoke-videos.mjs
- scripts/check-phase-d.mjs
- tests/frame-window.test.ts
- tests/window-renderer.test.ts
- tests/disk-space.test.ts
- tests/import-sequence.test.mjs

[Source inventory with SHA-256 hashes](source-inventory.json) records these files. Local data changes are limited to the seven activated scene sequence references and new media namespaces described above. Caption/panel/containment experiments are not retained. The workspace has no Git metadata, so this inventory is not presented as a Git diff.
