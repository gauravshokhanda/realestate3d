# Phase F — Premium polish

10 November 2026, Asia/Calcutta. Local Next.js project; no deployment or paid generation.

## Result

**Functional implementation is verified; strict performance acceptance is incomplete.** Final-source production lint/build, all 18 focused tests, the full `pnpm smoke` rerun and the frame/resource compatibility checks passed. Mobile timing and the zero-long-task requirement remain unmet. This is a working local platform, not a completed production deployment.

## Master-prompt audit

| Phase | Current status | Evidence and remaining qualification |
| --- | --- | --- |
| A — foundation | Implemented and regression-tested | Database-driven index/property pages, migration, media protections, dynamic rooms and styled 404 pass. All 1,046 migrated frames match their originals. |
| B — admin | Implemented and regression-tested | Authenticated UI create/upload/edit/publish/visit/unpublish/delete flow passes, alongside autosave recovery and security checks. |
| C — videos | Manual mode verified; paid provider unverified | Four supplied MP4s decode/trim/extract. The mismatched kitchen endpoint correctly becomes needs_review and blocks publication. Live Veo account/model/first-last-frame generation has not been exercised. |
| D — smooth scrolling | Implemented; timing varies by capture | Bitmap lifecycle, single ticker, throttled/mobile worker path and compatibility checks pass. Earlier phases contain both passing captures and captures with stalls; see final paired timing below. |
| E — 360 | Functionally verified with test charts | Admin authoring, two linked nodes, arrows, map, drag/touch, focus/close and owned-resource cleanup pass. Real property panoramas and physical-phone gyro remain to be tested. |
| F — polish | Implemented; performance acceptance incomplete | Loader, motion, chapters, mobile menu, spec counts, texture, section styling, transitions, OG and sitemap pass functional checks. Final timing has not met every gate; visual quality and pacing need owner review. |

## Presentation changes

- Kept the approved tower → isometric plan → room story, existing imagery, dark palette, typography, glass specification panel and panorama navigation.
- The property-name loader retains real sequence progress and fades away after the first canvas paint. The hero has staggered masked copy, a magnetic scroll control and very subtle ambient zoom while resting at the tower.
- Added a clickable five-chapter rail with section progress. Scroll handlers store position; the existing GSAP ticker writes the active fill. Geometry is measured on resize/body-size changes, not every scroll event. React state is not updated for rail or cursor movement.
- Added masked scene-caption reveals, pulsing hotspot rings, hover/focus labels and counting square-footage/price values. Counts preserve a stable accessible text value.
- Added a small desktop cursor ring, a generated static PNG grain tile and soft scene-edge vignette. Native cursors remain available. The custom ring is hidden on touch/coarse pointers and with reduced motion.
- Refined amenity cards with numbered details and hover treatment; retained their staggered entrance. Contact copy/form reveal in sequence, fields have focus feedback, and successful inquiries show an animated confirmation.
- Retained the sticky glass navigation and added a full-screen mobile menu using a native modal dialog, explicit focus wrapping, Escape/close, scroll locking and focus restoration. The Collection link and route-entry fade connect the index and property pages.
- Generated per-property 1200×630 JPEG social cards from published tower images at `/<slug>/og`, with XML-escaped property titles. Unknown/unpublished properties return 404. Added a sitemap of published slugs. Canonical/social/sitemap origins use `NEXT_PUBLIC_SITE_URL`.
- Reduced motion disables decorative entrances, cursor, pulse, ambient zoom and route animation; the existing static unpinned document flow remains.

## Commands and verification

```powershell
$env:NEXT_DIST_DIR = '.next-phase-f'
pnpm lint
pnpm build
pnpm test:sequence
pnpm exec tsx --test tests/worker-renderer.test.ts
pnpm test:panorama
# QA server uses a separate SQLite database/storage on C:.
pnpm start --port 4000
$env:SMOKE_URL = 'http://localhost:4000'
$env:SMOKE_CHANNEL = 'chrome'
$env:SMOKE_OUTPUT = 'D:/3d/screenshots/phase-F'
pnpm smoke
$env:CHECK_PRESENTATION = 'phase-f'
node scripts/check-phase-d.mjs
node scripts/compare-phase-f.mjs
node scripts/record-panorama.mjs
$env:PERF_URL = 'http://localhost:3400'
$env:PERF_OUTPUT = 'D:/3d/perf/phase-F'
pnpm perf release-final
```

For the Phase F presentation, set `CHECK_PRESENTATION=phase-f` before the compatibility script. Its default still enforces the historical near-identical Phase A full-page screenshot. That strict screenshot check initially failed on the intentional Phase F grain/vignette/UI changes (mean channel difference 6.89/255). The Phase F mode retains that measured difference and independently compares the underlying canvas to the original tower frame: **mean channel difference 0**. DPR, caching, bitmap disposal, reverse scroll, reduced-motion switching and fallback assertions remain enforced. This is not an assertion bypass for frame rendering.

The focused suites passed 18 tests: sequence loader 11, worker protocol 3, panorama graph/source lifecycle 4. The new polish suite checks actual loading, chapter/menu navigation, focus wrapping/Escape, touch/reduced-motion cursor behavior, responsive overflow, contact success, collection navigation, generated JPEG dimensions, metadata and sitemap. The contact success request is intercepted locally; no email is sent.

The initial mobile-menu test found a focus escape at the final tab stop; explicit wrapping was added. A later harness locator was corrected to select the Aurelia card by its route, since its actual property name is “Aurelia residences”. Existing platform metadata assertions now expect the generated property social-card route.

## Performance

The Phase E production build on port 3400 is the control; Phase F on port 4000 uses the isolated QA data with identical Aurelia assets. Installed Chrome, continuous CDP gestures, 600 CSS px/s, desktop 1440×900/native CPU and mobile 390×844/DPR 2/4× CPU throttle. Reports include long tasks, dropped-frame estimates, image decoding, main-renderer heap and bitmap resource estimates. The initial before capture overlapped briefly with screenshot collection and is retained separately; final paired timing uses an isolated control capture.

| Capture | Device | Average ms | p95 ms | Dropped estimate | Long tasks | Ready scenes |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Clean control (`before-clean`) | Desktop | 16.95 | 16.9 | 30 | 0 | 4/4 |
| Initial polish (`after`) | Desktop | 17.07 | 16.9 | 42 | 0 | 4/4 |
| Clean control (`before-clean`) | Mobile 4x | 16.87 | 16.8 | 23 | 0 | 4/4 |
| Initial polish (`after`) | Mobile 4x | 17.54 | 33.2 | 91 | 0 | 4/4 |
| Later control (`control-final`) | Desktop | 20.27 | 33.1 | 308 | 28 | 4/4 |
| Intermediate optimization (`after-final`) | Desktop | 18.44 | 17.0 | 167 | 16 | 2/4 |
| Later control (`control-final`) | Mobile 4x | 17.52 | 17.0 | 90 | 1 | 4/4 |
| Intermediate optimization (`after-final`) | Mobile 4x | 19.03 | 33.3 | 227 | 0 | 4/4 |

The initial polish capture fails the mobile <=33 ms gate. The later capture fails mobile timing and desktop zero-long-task gates; its desktop sweep only observed two scenes ready, so it cannot establish a fully loaded tour pass. All underlying flags and traces are retained. The unchanged control also varied significantly. These measurements do not establish the cause of every stall, and do not establish no regression.

Final compiled source, `release-final`, was profiled on the regular original-data preview after the QA server, extraction and recording had stopped. All four scenes reached ready in both final runs and owned bitmaps returned to zero.

| Final compiled source | Average ms | p95 ms | Dropped estimate | Long tasks | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Desktop | 17.36 | 17.0 | 70 | 4 | p95 passes; zero-long-task gate fails |
| Mobile, CPU 4x | 18.28 | 33.3 | 163 | 1 | p95 and zero-long-task gates fail |

[Final compiled-source report](../../perf/phase-F/release-final.json). Final peak main-renderer JS heap was 7.22 MB desktop / 9.01 MB mobile; peak bitmap estimates were 1098.55 MB desktop / 290.88 MB mobile. These figures exclude other browser/native/GPU allocations. **Do not claim no regression:** the earlier clean control was faster, and later controls also varied. Further scroll/decode/compositor investigation is required.

The optimization removes a relational CSS selector tied to a continuously changing progress attribute. Ambient motion now switches at the resting/scrolling boundary. Hidden chapter/cursor effects are disabled with responsive media subscriptions, including viewport/preference changes. The media effects also react to viewport/preference changes; the final polish test verifies reactivation after mobile/desktop resizing.

Peak native bitmap estimate in the clean control/initial polish pair: desktop 323 bitmaps / 1190.71 MB, mobile 202 / 290.88 MB. End-of-scroll owned bitmaps return to zero. These are native allocation estimates, not total browser memory; JS heap excludes worker/native/GPU allocations. The initial polish peak main JS heap was 7.49 MB desktop / 9.06 MB mobile. Large sequence residency remains a concern for constrained hardware.

[Clean control](../../perf/phase-F/before-clean.json) ? [Initial polish](../../perf/phase-F/after.json) ? [Later control](../../perf/phase-F/control-final.json) ? [Intermediate optimization](../../perf/phase-F/after-final.json) ? [All capture summaries](../../perf/phase-F/capture-summary.json).

## Evidence and environment

Before/after full-page screenshots use the reduced-motion layout so the entire document is visible. Normal hero/contact viewport images and the recording show the pinned experience. Test-chart panoramas remain clearly identified as fixtures, not property photography.

D: has about 68 MB free. New build output is linked from `.next-phase-f` to `C:/Users/PC/AppData/Local/Temp/aurelia-offscreen-build-root/build-f`. Screenshots and traces are linked at their project paths to `C:/Users/PC/AureliaWorkspaceArtifacts/phase-F-screenshots` and `phase-F-perf`. Previous evidence/builds were retained. QA reuses the isolated Phase E database/storage under `C:/Users/PC/AppData/Local/Temp/aurelia-phase-e-qa-AtW4d9`; original property data is not used for mutation tests.

## Files changed

- `app/globals.css`, `app/template.tsx`, `app/[slug]/page.tsx`, `app/[slug]/og/route.ts`, `app/sitemap.ts`
- `components/ChapterRail.tsx`, `TourPolish.tsx`, `MobileMenu.tsx`, `ExploreButton.tsx`, `CountValue.tsx`
- `components/Hero.tsx`, `Preloader.tsx`, `FrameSequence.tsx`, `FloorPlanScene.tsx`, `RoomViewer.tsx`, `ResidencePanel.tsx`, `Hotspots.tsx`, `Amenities.tsx`, `ContactForm.tsx`, `Nav.tsx`
- `public/grain.png`, `scripts/smoke-polish.mjs`, `scripts/compare-phase-f.mjs`, `scripts/check-phase-d.mjs`, `scripts/smoke.mjs`, `scripts/smoke-platform.mjs`, `README.md`, `tsconfig.json`
- This report and generated screenshots/performance evidence.

## Verification limits and next step

Chrome mobile emulation does not verify physical-phone gyroscope permission or photographic panorama stitching. Real email delivery and paid Veo access were not exercised. Set the correct public site origin before deployment. Original property assets/content and the database schema remain unchanged.

Production hosting remains separate work: migrate SQLite data to Postgres, implement the currently explicit S3/R2 stub, configure secrets/mail/sending domain and run a persistent worker. Local functionality is not proof of production readiness. Local D: storage needs more free capacity before substantial real uploads; the evidence/build links on C: preserve work but do not enlarge the original storage directory.

## Review assets

[Desktop before/after](comparison-desktop.png) · [Mobile before/after](comparison-mobile.png) · [Desktop hero comparison](comparison-desktop-hero.png) · [Mobile hero comparison](comparison-mobile-hero.png).

[Mobile menu](mobile-menu.png) · [Loader](intro-loader.png) · [Generated OG](aurelia-og.jpg) · [Finished scroll and 360 recording](walkthrough-scroll.webm). The recording uses the clearly labelled walkthrough-demo property and its two chart panoramas.

[Tour smoke](smoke-report.json) · [Platform](platform-report.json) · [Admin](admin-report.json) · [Manual videos](videos-report.json) · [Panoramas](panoramas-report.json) · [Polish](polish-report.json) · [Renderer/resource checks](performance-validation.json).

Stop after Phase F. Next step: owner reviews the final desktop/mobile presentation and pacing; no further phase starts automatically.


## Final handoff

Final `pnpm smoke` exited 0 after the responsive-media optimization. All functional reports have empty runtime-error arrays. The recorder was rerun against the final build; desktop/mobile hero and contact captures, the mobile menu, full-page comparisons, loader and OG image were reviewed. The normal preview now serves Phase F at http://localhost:3400/aurelia; http://localhost:3400/admin opens the studio and http://localhost:3400/walkthrough-demo opens the linked chart demo. [Read-only original-data preview check](preview-check.json) passed. The QA server was stopped; the regular preview remains available.

Remaining priorities are performance acceptance, supported live Veo/account verification, real panorama assets plus physical-device tests, real mail delivery and production deployment/storage. A source video with the mismatched kitchen endpoint needs replacement or regeneration before a newly processed property can publish; tests left the approved Aurelia sequence intact.
