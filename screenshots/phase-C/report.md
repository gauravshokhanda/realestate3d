# Phase C — Video pipeline and Manual Upload

Implemented and verified in Manual Upload mode on 9 November 2026. Phase D has not started.

## Result

- The admin Videos tab derives tower → plan and plan → each room scenes from saved property images. Prompts can be edited/copied, and each scene shows its endpoints, status, progress, first/middle/last thumbnails and frame counts. MP4 upload, replacement/regeneration, trimming, source preview and download are available.
- A database-backed, single-job worker starts lazily from authenticated admin use. Conditional claims and renewable leases protect jobs across processes. Expired generating/extracting leases recover; persisted Veo operations resume polling. An interrupted submission without a saved operation ID stops for billing review instead of automatically risking another paid request.
- Uploads stream to an owned temporary file, validate the actual MP4 container and decode it with ffmpeg-static. Limits: 100 MB, 120 seconds, 4096px per edge. No system ffmpeg is needed.
- Analysis uses small grayscale frames to find target arrival, stability/departure and frozen heads/tails. Manual source-timestamp overrides and an auto-trim reset are available in the preview scrubber.
- Optional visible-watermark delogo defaults off for new scenes. Its editable 1280×720 reference box defaults to x=1130,y=569,w=62,h=64 and scales to the source. It affects extracted frames; the retained source MP4 remains original.
- Desktop: up to 1600px, 24fps, WebP q72. Mobile: up to 800px, 15fps, q65. Neither upscales; fps is reduced to keep each variant at most 240 frames. Outputs/manifests are staged with rollback on commit failure, then temporary files are removed. Revisioned frame URLs prevent cached old sequences after replacement.
- The final frame is checked against the target. `needs_review` scenes block publication. Queued work makes the property processing; all-ready properties return to draft for an explicit publish action. Source MP4 previews/downloads require authentication and support byte ranges.
- Aurelia retains its approved frames, status and scroll behavior. Its four existing source MP4s were attached idempotently for preview/download without re-extraction. The seed now also attaches missing legacy MP4 references when those source files are present.

## Review

Open **http://localhost:3300/admin/properties/aurelia**, then **Videos**. Sign in using `ADMIN_PASSWORD` in the git-ignored `.env.local` if required. The final running server uses `.next-phase-c-final`; normal builds can use `.next` or any separate `NEXT_DIST_DIR` documented in the README.

Existing Aurelia's ready state is preserved from the approved migration. New uploads receive the new quality check. No test property remains in the database; only published Aurelia remains.

## Four supplied MP4s: measured results

All sources are 1280×720, approximately 10.03 seconds. These are the initial automatic extraction results from the final passing video suite:

| Scene | Auto end | Desktop / mobile | Last-frame similarity | Result |
| --- | ---: | ---: | ---: | --- |
| hero-to-plan | 7.50s | 180 / 113 | 98.4% | ready |
| plan-to-living | 5.83s | 140 / 88 | 96.9% | ready |
| plan-to-kitchen | 8.33s | 200 / 125 | 86.5% | needs_review |
| plan-to-bedroom | 6.67s | 160 / 100 | 98.3% | ready |

The kitchen MP4 genuinely lands on a different kitchen from the supplied `assets/stills/kitchen.png`, then dissolves onward. Its automatic proposal is not a confident arrival and is not publishable. The test applied a manual 6.8s end to remove the later dissolve; the wrong-target warning correctly remained. A matching replacement video or a corrected endpoint still is needed for a new, fully publishable property using that footage. The approved Aurelia tour was not downgraded or altered.

The visible sparkle test measured **664 → 0** bright pixels in its known box after delogo. The source sparkle is translucent cream; the test uses its measured luminance range rather than assuming pure white. Delogo interpolation can leave a soft patch; this is not a guarantee of an artifact-free image or removal of embedded provenance.

## Veo finding and verification limits

[Google's current Veo documentation](https://ai.google.dev/gemini-api/docs/veo) states that Gemini API Veo 3.1 previews shut down on October 22, 2026. Consequently `VEO_MODEL` has no hardcoded/default model. This workspace has neither `GEMINI_API_KEY` nor `VEO_MODEL`; no paid generation was submitted and no account-specific generation error is invented.

The `@google/genai` adapter checks the configured model, supplies the first and last images, requests one 8-second 16:9 720p video, saves its operation ID, polls, downloads and passes it through the same extraction path. Unsupported first/last-frame/model responses switch to Manual Upload with a sanitized provider error; remaining unsubmitted jobs in the same worker process honor that fallback. Quota/429/transient server failures back off with at most three attempts. The UI requires paid-generation confirmation naming the number of videos and duration. Actual pricing, current account/model access, remote operation behavior and live first/last-frame generation remain **unverified**. The implementation does not silently switch to Omni or Vertex AI.

## Commands and checks

| Command/check | Result |
| --- | --- |
| `pnpm add @google/genai ffmpeg-static` | SDK installed; ffmpeg-static moved to runtime dependencies |
| `pnpm install --lockfile-only` | Lock updated |
| `pnpm exec prisma migrate dev --name video_jobs` | Migration applied |
| `pnpm db:generate` / `pnpm exec prisma format` | Client generated; formatted schema matches it |
| `pnpm exec prisma migrate status` | Two migrations; schema up to date |
| `pnpm exec tsx scripts/attach-legacy-videos.ts` | Four source MP4s attached; approved frames/status preserved |
| `pnpm exec tsx scripts/check-video-trims.ts` | Source analysis saved to source-trims.json |
| `pnpm test:storage` | 2 passed |
| `pnpm test:sequence` | 7 passed |
| `pnpm test:admin` | 2 passed |
| `pnpm test:jobs` | 5 passed, including trim cases, validation, retry classification/backoff, credential and custom-storage-path redaction |
| `pnpm worker` | Separate worker started successfully, then stopped after the startup check |
| `pnpm lint` | Passed with zero warnings |
| `pnpm build` with isolated Phase C output | Production compilation/type checking passed; final build passed after a transient Google Fonts fetch retry |
| `SMOKE_CHANNEL=chrome SMOKE_URL=http://localhost:3300 pnpm smoke` | Full tour, platform, admin and video suites passed |
| `node scripts/check-phase-c-final.mjs` | Final rebuilt server: authenticated decoded seek to 6.5s, controls, mobile overflow, hero comparisons and styled 404 passed |

The full smoke suite ran on the production build. The subsequent final hardening build was also checked with the focused final-server browser script and the relevant unit checks. Generated test camera moves are deterministic crossfades for pipeline verification, not AI-generated camera moves.

Chrome's desktop/mobile/reduced-motion tour modes had zero console/runtime/HTTP/failed-request errors. Platform checks verified all **1,046** approved Aurelia frames by SHA-256 and covered index/404, one/eight rooms, hidden drafts/processing, publication/metadata, media traversal/caching/HEAD/ETag and cross-property lead rejection. Admin tests covered real UI create → image upload → matching MP4 upload → automatic extraction → publish → public visit, plus autosave failure/retry, hotspots/order, validation, authentication and deletion.

The video suite processed all four supplied MP4s, blocked publication on the kitchen warning, exercised manual trim and private range downloads, removed the visible sparkle, capped a 14-second extraction at 240 desktop frames, verified both variants remained 320px for a 320px source, recovered a simulated expired extraction lease and rejected an ambiguous interrupted paid submission without contacting Gemini. All final fixture records were removed. Runtime errors were zero.

Final build desktop/mobile hero captures are **pixel-identical** to the pre-migration references. The regular full-suite floor-plan capture differs by 0.0352% of pixels at the >2/channel threshold, consistent with the already animated hotspot rings. No Phase D performance results are claimed.

Evidence: [smoke-report.json](smoke-report.json), [platform-report.json](platform-report.json), [admin-report.json](admin-report.json), [videos-report.json](videos-report.json), [final-validation.json](final-validation.json), [visual-comparison.json](visual-comparison.json).

## Screenshots

- [Videos with all supplied MP4 results, desktop](videos-existing-desktop.png)
- [Videos after manual kitchen trim, mobile](videos-existing-mobile.png)
- [Kitchen needs-review warning and trim controls](videos-trim-preview.png)
- [Decoded source preview seeking to 6.5s on the final build](videos-source-scrubber.png)
- [Prompt and watermark controls](videos-prompt-options.png)
- [Matching synthetic test moves ready for publication](admin-videos-ready.png)
- [Final desktop hero](desktop-000-final.png) / [final mobile hero](mobile-000-final.png)
- [Desktop full page, reduced-motion flow](desktop-reduced-full-page.png) / [mobile](mobile-reduced-full-page.png)
- [Styled 404](not-found.png)

## Files changed

- Config/docs: `package.json`, `pnpm-lock.yaml`, `.env.example`, `README.md`, `next.config.ts`, `tsconfig.json`; Next.js regenerated `next-env.d.ts`.
- Database: `prisma/schema.prisma`; `prisma/migrations/20261109142407_video_jobs/migration.sql` adds settings, analysis, duration, operation identity, retry scheduling, leases and output-path fields.
- Jobs: `lib/jobs/schema.ts`, `prompts.ts`, `derive.ts`, `ffmpeg.ts`, `trim.ts`, `veo.ts`, `extract.ts`, `worker.ts`, `api.ts`, `upload.ts`.
- API: `app/api/admin/properties/[id]/videos/route.ts`, `[sceneId]/route.ts`, `[sceneId]/upload/route.ts`; `app/media/[...path]/route.ts` adds authenticated MP4/range handling and renamed sequence namespaces.
- Admin: `components/admin/videos/Videos.tsx`, `SceneCard.tsx`, `TrimEditor.tsx`; `components/admin/Editor.tsx`, `useEditor.ts`, `app/admin/admin.css`, `app/admin/(protected)/layout.tsx`.
- Shared/server: `lib/admin/property.ts`, `lib/property.ts`, `lib/property-validation.ts`, `data/scenes.ts`, `lib/storage/local.ts`.
- Scripts/tests: `scripts/worker.ts`, `attach-legacy-videos.ts`, `check-video-trims.ts`, `smoke.mjs`, `smoke-platform.mjs`, `smoke-admin.mjs`, `smoke-video-fixtures.mjs`, `smoke-videos.mjs`, `check-phase-c-final.mjs`; `tests/jobs.test.ts`.
- Local generated state: ignored SQLite migration/data, source MP4 copies, build folders and review artifacts under `screenshots/phase-C/`. No credentials were added to reports or client data.

## Issues found, cleanup and remaining limits

- Windows held Prisma's engine DLL while older Next processes were running. Project servers were stopped for client generation; Prisma formatting then prevented unnecessary regeneration caused by alignment-only differences. The final production server is running at port 3300.
- Development editor compilation exceeded the initial browser navigation timeout; final verification used a production build. A final clean build encountered a transient Google Fonts URL/fetch failure and passed on retry without changing the fonts.
- Early video test cleanup held a Sharp file handle. The test now reads image buffers, disables its cache, closes its page and retries owned-file cleanup. Its initial watermark assertion also assumed opaque white; source-pixel inspection corrected the luminance measurement. The full suite subsequently passed.
- **Retained artifacts:** earlier failed runs left unreferenced test media under `storage/properties/studio-34c37de5/` and `storage/properties/video-4448533d/`. Their DB records are gone and the app cannot serve them. Automatic approval review rejected manual removal of `video-4448533d` (including a narrower attempt), reporting only “blocked by policy”; removal was not forced through another mechanism. Current passing runs clean up their own ID and slug namespaces. `storage/.jobs/` is empty after final verification.
- A hard OS/process kill can leave staged private job files/backups for inspection; normal completion/failure cleans owned temporary outputs. There is no general unreferenced-media garbage collector. Source MP4s are retained for preview/re-extraction/download.
- The grayscale trim/quality thresholds are heuristics. The supplied kitchen is intentionally unresolved because its target differs. Original approved Aurelia scenes retain their migrated ready state; new uploads are checked.
- The API adapter is implemented but live Veo access is untested and no current default model is asserted. In-server plus one separate worker gives up to two concurrent jobs; use one worker process for one-job concurrency. Multi-instance hosting, PostgreSQL/S3, provider cancellation, and paid operation guarantees across remote service failures require deployment work.
- No live email, Lighthouse, scroll performance optimization, 360 or premium-polish work was performed in Phase C.

## Exact next step

Stop here. After the owner says **next**, begin **Phase D**: measure `/aurelia` desktop and mobile with 4× CPU throttling, save `/perf/before.json`, then fix the measured scroll bottlenecks and save `/perf/after.json`. Do not start 360 work before that performance phase.
