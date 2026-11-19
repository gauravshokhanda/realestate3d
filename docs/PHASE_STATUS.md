# Aurelia phase status — 10 November 2026

This audit concerns `D:\3d`, the actual Aurelia Next.js project. The earlier assessment of the unrelated PropertySense workspace does not describe this project.

| Phase | Implementation found | Acceptance status |
| --- | --- | --- |
| A — Foundation/migration | Prisma SQLite migrations/seed, safe local storage, database-backed index and slug pages, dynamic scenes/rooms | Prior platform evidence verifies published/draft visibility, 1/8 rooms and hashes of all 1,046 migrated frames. Not rerun in this audit. |
| B — Admin | Signed sessions, CRUD, uploads, autosave, units/rooms/hotspot placement and validation | Prior admin report records create/upload/publish, security and responsive tests with no runtime errors. Not rerun in this audit. |
| C — Video pipeline | Queue/leases, manual MP4 upload, extraction/trim/review, video editor and Veo adapter | Prior video report covers the supplied MP4s and manual flow. Live paid Veo generation is explicitly unverified. The kitchen endpoint mismatch correctly requires review rather than false success. |
| D — Scrolling/performance | Shared GSAP ticker, Lenis, bitmap preload/disposal, viewport scene window, reduced motion and profiler | **Incomplete.** Comparable desktop/mobile measurements and the required timing budgets are not established. |
| E — 360 walkthrough | Database node model exists; admin tab is still a placeholder | Not implemented. No Photo Sphere Viewer integration, linked-node editor/minimap or test-panorama script found. |
| F — Premium polish | Some existing hero/preloader/navigation styling overlaps this phase | Incomplete. No evidence of the complete polish checklist and before/after acceptance without performance regression. |

**Count: three phases have implementations and prior test evidence (A–C); D is the first incomplete phase.** This is not a claim that paid generation or every original acceptance criterion has been verified.

## Work started on the remaining phase

Read the prompt, existing source, README, phase reports, performance script and stored measurements. Started the existing isolated production build on port 3400 without changing the development server on port 3000.

Fresh gesture measurement of that production build is preserved in `perf/phase-d-current-before.json`, its desktop trace and top/bottom screenshots. Desktop average was 19.21 ms, p95 33.30 ms, with 230 estimated dropped frames and 30 recorded long tasks (including one at exactly 50 ms). This misses the desktop p95 budget of 20 ms. Concurrent background work limits attribution of these timings to application code alone.

The mobile run failed with `Touch gesture stopped advancing at 0/18015px`. It must not be reported as a completed mobile measurement. The saved historical `before.json` contains only desktop. Historical `after.json` describes scripted scrolling and lacks an explicit `scrollMode`; it cannot substantiate a comparable gesture before/after result and also reports mobile p95 33.4 ms with long tasks.

Added `scripts/check-perf-reports.mjs`, a separate Zod-validated acceptance check. It rejects missing/duplicate device runs, mismatched input methods, hardware/browser/viewport/CPU settings, materially different scroll coverage, missing trace artifacts, and actual timing misses regardless of saved `passes` flags. Both desktop and 4x CPU mobile runs must be present. Scripted input remains a stress test rather than the gesture acceptance measurement.

Run it after producing complete reports:

```sh
node scripts/check-perf-reports.mjs perf/before.json perf/after.json
node --test tests/perf-reports.test.mjs
```

The five new regression tests and `pnpm lint` pass. Running the check on the current canonical reports correctly exits nonzero; `perf/phase-d-readiness.json` records that rejection. No performance threshold or existing test was relaxed. Build and full smoke were not rerun during this audit; no phase-completion claim is made from the lint/unit results.

## Concurrent-work constraint and exact next step

During inspection another process was running `pnpm perf before`, and `scripts/perf.mjs` changed externally from synthetic touch gestures to dispatched touch events. This audit did not edit that script, stop that process, overwrite canonical before/after measurements or change the runtime rendering code. Coordination was requested before overlapping performance work. Newly added files are isolated from those edits.

Finish the mobile-input fix and run comparable gesture baselines/after measurements sequentially on isolated production builds without simultaneous benchmarks/builds. Investigate the resulting traces, fix measured bottlenecks, then run `pnpm lint`, `pnpm build`, `pnpm smoke`, the performance acceptance checker and the existing phase-D visual/resource checks. Do not count Phase D complete unless its acceptance evidence passes; record hardware limitations honestly. Phase E remains the next phase after D acceptance and the phase-boundary instruction to wait for owner continuation.
