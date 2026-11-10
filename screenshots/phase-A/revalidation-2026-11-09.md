# Phase A verification — 9 November 2026

The attached master prompt was checked against the existing Phase A implementation. Phase A was already implemented; no Phase B work was started. The original implementation inventory and detailed phase limits remain in [report.md](report.md).

## Changes in this pass

- `next.config.ts`: optional `NEXT_DIST_DIR` with the existing `.next` default, allowing isolated production verification alongside a running development server.
- `README.md`: PowerShell commands for isolated build/start/smoke verification.
- `tsconfig.json`: Next.js added the isolated build's generated route types to `include` and reformatted the file.
- Refreshed `screenshots/phase-A/` desktop/mobile scene captures, reduced-motion full-page captures, index/404 and database fixture captures, `smoke-report.json`, `platform-report.json`, and `visual-comparison.json`.
- Added this verification report. No visual styling, tour behavior, or production data was changed. The seed rerun preserved Aurelia; smoke fixtures were cleaned up.

## Commands and results

| Command | Result |
| --- | --- |
| `pnpm exec prisma validate` | Passed |
| `pnpm exec prisma migrate status` | Schema up to date |
| `pnpm db:seed` | Existing Aurelia preserved |
| `pnpm test:storage` | 2 passed |
| `pnpm test:sequence` | 7 passed |
| `NEXT_DIST_DIR=.next-phase-a pnpm lint` | Passed, no warnings |
| `NEXT_DIST_DIR=.next-phase-a pnpm build` | Passed, including strict type checking |
| `NEXT_DIST_DIR=.next-phase-a pnpm start --port 3100` | Production server started |
| `SMOKE_CHANNEL=chrome SMOKE_URL=http://localhost:3100 pnpm smoke` | Passed all four tour modes and platform checks |
| `node scripts/compare-phase-a.mjs` | Hero desktop/mobile: 0% changed pixels; floor-plan capture: 0.0189% changed pixels at >2/channel threshold |

Environment assignments in the table use compact notation; executable PowerShell instructions are in the README.

An initial lint/build succeeded using the default directory, but its smoke run failed after a separate development server started and replaced shared `.next` assets. Production JS/CSS requests then returned HTTP 400. The isolated build and production smoke run above resolved this interference without stopping the development session.

Chrome passed desktop 1440×900, mobile 390×844, and both reduced-motion variants with zero console errors, runtime errors, HTTP errors, or failed requests. Checks cover tour scrubbing, unit selection, hotspots, navigation, mocked contact submission, and responsive overflow. Platform checks passed for the property index, styled 404, media caching/HEAD/ETag/path safety, unpublished visibility, dynamic publication/metadata, one and eight rooms, cross-property lead rejection, and SHA-256 identity of all 1,046 migrated frames.

## Screenshots

- [Desktop hero](desktop-000.png)
- [Mobile hero](mobile-000.png)
- [Desktop full page, reduced-motion document flow](desktop-reduced-full-page.png)
- [Mobile full page, reduced-motion document flow](mobile-reduced-full-page.png)
- [Floor plan](desktop-080.png)
- [Styled 404](not-found.png)
- [Property index](index-desktop.png)

Full-page captures use the existing reduced-motion static layout because pinned scroll scenes cannot all be represented by a single normal full-page capture. Normal-motion scene captures are included separately.

## Limits and next step

Admin authentication/CRUD and authenticated create/upload/publish checks are Phase B and remain absent. Video generation/manual upload jobs, performance profiling, 360 viewing, and premium polish remain in Phases C–F. S3 is a stub; PostgreSQL deployment and live email/Veo access are not verified. Existing video artifacts and transfer sizes remain unchanged. No new stills or paid videos were generated for this Phase A request.

Review `http://localhost:3100/aurelia` and these screenshots. Stop here. The exact next implementation step, only after the owner says **next**, is Phase B admin authentication, CRUD, validated uploads, autosave, and hotspot placement.
