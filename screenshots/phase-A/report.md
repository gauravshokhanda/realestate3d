# Phase A — Foundation and Aurelia migration

Phase A is complete. Stop here for owner review; Phase B has not started.

## Result

- `/` is a responsive published-property collection.
- `/aurelia` reads SQLite, ordered units/rooms/scenes, and storage manifests on the server. The approved scroll engine, easing, assets, captions, specs, two-unit behavior and hotspot coordinates are unchanged.
- `/does-not-exist`, drafts, processing properties and reserved slugs return a styled 404. Draft media is also unavailable publicly.
- Prisma models for Property, Unit, Room, PanoNode and Scene are migrated. Portable optional JSON fields Property.presentation and Unit.roomSettings preserve Aurelia's existing copy and per-unit room variants.
- LocalStorage copies assets under storage/properties/<slug>/, with S3Storage left as an explicit stub. Public media has safe path resolution, junction/symlink rejection, content types, caching, ETag/304 and HEAD handling.
- Five still originals plus stripped/capped WebP copies, four desktop sequences, four mobile sequences, and four manifests were seeded. Every one of the 1,046 frame files matches its legacy source byte-for-byte.
- Rerunning the seed leaves existing records/assets unchanged. Existing Aurelia is the only lasting property; browser test records and their media were cleaned up.
- Lead validation accepts database unit IDs and checks the unit belongs to the published property before delivery.

## Commands and results

| Command | Result |
| --- | --- |
| pnpm install / dependency additions | Prisma 6.19.3, @prisma/client, server-only, dotenv and tsx installed; required build scripts enabled |
| pnpm exec prisma validate | Passed |
| pnpm exec prisma migrate dev --name foundation | Created/applied foundation migration |
| pnpm db:migrate (fresh isolated SQLite file) | Passed; migration applied from scratch |
| pnpm exec prisma migrate status | Schema up to date |
| pnpm db:seed | Imported Aurelia and published it |
| pnpm db:seed (again) | Left existing records/media unchanged |
| pnpm test:storage | 2 passed: storage/ETag/MIME/traversal/junction safety and reserved slugs |
| pnpm test:sequence | 7 passed |
| pnpm test:import | 5 passed; legacy migration-input paths updated |
| pnpm lint | Passed, zero warnings |
| pnpm build | Passed, strict TypeScript and production build |
| SMOKE_CHANNEL=chrome pnpm smoke | All four tour modes and platform checks passed |
| node scripts/check-api.mjs | Validation, honeypot and rate limit passed; no email sent |
| node scripts/compare-phase-a.mjs | Desktop/mobile hero 0% changed pixels; floor plan 0.0323% changed pixels (>2/channel), limited to animated hotspot rings |

The first native SQLite migration attempt needed a preexisting database file on Windows. Prisma config now creates only a missing empty file before invoking the engine; the fresh-file deployment test passed afterward. An initial typecheck found the Uint8Array Response body generic mismatch; it was corrected before the successful build. Lint initially raced with importer fixtures; transient fixture directories are now excluded. No outstanding build or runtime errors remain.

## Browser verification

Chrome desktop 1440x900, mobile 390x844, and both reduced-motion variants passed with zero console, runtime or HTTP errors. Desktop recorded one expected ERR_ABORTED cancellation when a scene went offscreen; mobile recorded none. Tour checks cover scrubbing, panel timing, unit switching, keyboard tabs, hotspots/back links, navigation, contiguous scene tracks and mocked contact success/error/validation.

Platform checks cover index, 404, media byte identity, caching/ETag/HEAD, unsafe paths, hidden drafts/processing, publish-without-rebuild, per-property metadata/canonical/OG, one and eight DB-driven rooms, cross-property lead rejection, and all migrated-frame hashes. Temporary fixtures never invoke paid APIs or email delivery.

Machine-readable evidence:

- [smoke-report.json](smoke-report.json)
- [platform-report.json](platform-report.json)
- [visual-comparison.json](visual-comparison.json)

## Screenshots

- [Index desktop](index-desktop.png)
- [Index mobile](index-mobile.png)
- [Aurelia desktop hero](desktop-000.png)
- [Aurelia desktop floor plan](desktop-080.png)
- [Aurelia mobile hero](mobile-000.png)
- [Desktop full page, reduced motion](desktop-reduced-full-page.png)
- [Mobile full page, reduced motion](mobile-reduced-full-page.png)
- [Styled 404](not-found.png)
- [One-room database fixture](db-1-rooms.png)
- [Eight-room database fixture](db-8-rooms.png)
- [Original desktop hero](before/desktop-000.png)
- [Original floor plan](before/desktop-080.png)
- [Original mobile hero](before/mobile-000.png)

## Files changed

- Instructions/configuration: AGENTS.md, AGENTS.phase0-5.md, .env.example, .gitignore, package.json, pnpm-lock.yaml, prisma.config.ts, eslint.config.mjs, tsconfig.json, tailwind.config.ts, README.md.
- Database: prisma/schema.prisma, prisma/migrations/migration_lock.toml, prisma/migrations/20261107180143_foundation/migration.sql, prisma/seed.ts, prisma/seed-data.ts.
- Data/server: data/scenes.ts, data/units.ts, lib/database-url.ts, lib/db.ts, lib/property.ts, lib/property-types.ts, lib/property-validation.ts, lib/storage/local.ts, lib/storage/index.ts, lib/lead-schema.ts.
- Routes: app/page.tsx, app/[slug]/page.tsx, app/not-found.tsx, app/layout.tsx, app/media/[...path]/route.ts, app/api/lead/route.ts.
- Components: Experience.tsx, FloorPlanScene.tsx, FrameSequence.tsx, Preloader.tsx, Hero.tsx, RoomViewer.tsx, ResidencePanel.tsx, UnitSelector.tsx, Nav.tsx, ContactForm.tsx, Amenities.tsx.
- Verification/legacy tooling: scripts/smoke.mjs, scripts/smoke-platform.mjs, scripts/compare-phase-a.mjs, scripts/record-scroll.mjs, scripts/import-sequence.mjs, scripts/review-sequences.mjs, tests/import-sequence.test.mjs, tests/storage.test.ts.
- Local generated state: ignored data/app.db and storage/properties/aurelia/. Review artifacts are in screenshots/phase-A/.

## Known limits and phase boundary

- Admin/login/CRUD/uploads are Phase B and intentionally absent. Their authenticated smoke coverage is deferred until those routes exist.
- Video generation/manual upload/auto-trim are Phase C. No Gemini API calls occurred; model availability, credentials, paid quotas and first/last-frame support are not verified here. VEO_MODEL stays unset.
- The legacy importer now updates prisma/seed-data.ts and public migration inputs only; it does not republish an existing database property. The platform job/upload pipeline arrives in Phase C.
- Scroll performance profiling and optimization are Phase D. Existing transfer-budget overruns and delogo smudges remain in the unchanged footage. No performance gains or new Lighthouse scores are claimed.
- 360 viewing, richer polish, per-property generated OG artwork and sitemap remain in Phases E/F. Phase A already supplies per-property title/description/canonical and tower-image OG metadata.
- S3/R2 and PostgreSQL deployment are not operational yet. The schema remains portable; deployment requires a PostgreSQL migration baseline/data migration, an implemented S3 adapter and a separate persistent video worker.
- Live Resend delivery was not tested; browser delivery was mocked, and API tests use invalid inputs/honeypots.

## Exact next step

Owner reviews the screenshots and Phase A behavior at http://localhost:3000/aurelia. After an explicit **next**, start Phase B: single-admin password/cookie authentication, responsive property CRUD, validated image uploads, units/rooms/amenities editing, hotspot placement, autosave, and authenticated smoke coverage. Do not start Phase B before that instruction.

