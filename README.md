# Aurelia CRM

Developments contain residences, and each residence owns its floor plan, rooms, video scenes, and 360° viewpoints. The cinematic tour is available at `/aurelia` and `/aurelia/residence-a`. A development with several published residences shows a list of links. Draft residences have no public route.

## Clone on a new machine

Use Node.js 22.13 or later, pnpm 10, and system Chrome for browser tests. Media packs use BSD tar, included on Windows and macOS. On Linux, install `bsdtar`.

```sh
git clone --single-branch --branch main-clean <repository-url> aurelia
# Run the remaining commands from the aurelia directory.
pnpm i
cp .env.example .env
pnpm db:push
# Optional: restore a media pack and rebuild its derived frames.
pnpm media:unpack /path/to/media-pack.zip
pnpm frames:rebuild
pnpm dev
```

In PowerShell, use `Copy-Item .env.example .env`. The optional media pack provides the database and assets needed for the Aurelia tour. A source-only clone starts with an empty collection. If you have the five legacy PNG stills in `assets/stills/` and four MP4s in `assets/videos/`, `pnpm db:seed` can populate Aurelia locally. Subsequent seed runs keep existing records.

## Upgrade an existing checkout

Stop the server and worker. Run `pnpm db:migrate:crm` to create a SQLite backup in `.artifacts/crm/`, apply the migrations, and compare the migrated records against the backup. Then run `pnpm db:generate` and `pnpm media:migrate` to copy legacy assets into the new layout. The migration keeps the source assets available for rollback. Restart once the commands finish. On Windows, closing processes that use the Prisma engine lets generation replace its DLL.

Aurelia’s former primary residence keeps its existing room and scene IDs. Residence B remains visible in the legacy tour’s selector and is a draft in the database. It has no standalone public tour. The existing property editor remains available at `/admin`; its **Units** tab edits residence records under the development.

## Manage developments

Sign in at `/admin/login` and open **Developments**. Create a development, then add its building image, location, and theme. Details autosave and the top bar reports the save state. A public development also needs at least one published property to appear in the collection.

Open **Building map** and click the elevation to draw. Click the first point or press Enter to close the outline. Drag a point to move it, click an edge to insert one, or select a point and press Delete. Use Ctrl+Z and Ctrl+Y for undo and redo. Scroll to zoom and hold Space while dragging to pan. Select **Save polygon**, **Link existing property**, or **Create property from this polygon** to commit the outline. Open a property to reach its existing tour editor.

## Add a residence using the existing editor

1. Set `ADMIN_PASSWORD` and a random `SESSION_SECRET` of at least 32 characters in your local environment file. Sign in at `/admin/login`.
2. Choose **Add property**. This creates a development and a draft primary residence. The entered slug becomes the development URL segment.
3. In **Images**, upload the tower and floor plan. Use **Units** for residence specs and **Rooms** for room images, descriptions, and floor-plan hotspots. Wait for **Saved** before leaving an edit.
4. In **Videos**, add a video to each scene and wait for **Ready**. Review quality warnings before publishing. In **360° Walkthrough**, add linked equirectangular viewpoints when available.
5. Choose **Publish property**. A single published residence is accessible at both `/<development>` and `/<development>/residence-a` in this editor.

Uploads are decoded with Sharp and generate stripped WebP copies. Images may be up to 25 MB. MP4s may be up to 100 MB and 120 seconds. Admin mutations require the signed session and a same-origin request.

## Manual video and Veo

Manual mode works with the Gemini variables empty. In **Videos**, copy the prompt, make an MP4 from the shown start and end images, and upload it. The same worker extracts both desktop and mobile frames. **Trim** previews the source and sets explicit endpoints. Optional watermark filtering uses the saved per-scene box.

For Veo, set `GEMINI_API_KEY` and `VEO_MODEL` to a model available to your account that supports start and end images, then restart. Review the paid generation confirmation before starting a job. The worker uses the configured model and reports provider errors in the admin. Manual upload remains available.

Use `pnpm worker` to run a persistent worker alongside the app with the same database and storage. A separate worker host requires shared production storage and database connectivity.

## Portable media

- `data/app.db` stores the SQLite records.
- `storage/originals/<developmentSlug>/` contains original images and MP4s, plus the optimized display images and panorama copies.
- `storage/cache/frames/<developmentSlug>/<propertySlug>/` contains derived frame variants and per-scene manifests. Older cache paths remain usable until the scene is rebuilt.

Run `pnpm media:pack` to create `media-pack.zip` containing the SQLite snapshot and originals. For a consistent media set, suspend edits and video uploads while packing. Restore into an empty database and storage folder with `pnpm media:unpack <zip>`. The archive excludes generated frames and local secrets.

Use `pnpm frames:rebuild` for all approved scenes, or `pnpm frames:rebuild --property aurelia/residence-a` for one residence. The existing **Videos** tab also has **Rebuild frames** per ready scene. Restoring frames uses the saved trims and watermark settings and preserves publication. Each scene targets at most 1280 px / 8 MiB desktop and 640 px / 3 MiB mobile, without upscaling. When cache files are absent, the public tour uses its still images and the editor offers a rebuild.

## Verification and Git size

After building, `pnpm smoke` starts a temporary production preview and runs all Chrome suites in sequence. Set `SMOKE_URL` to run the same suites against an existing development or production preview. Configure admin credentials locally for the authenticated checks. When a development server is running, set `NEXT_DIST_DIR` to a separate directory for the build and smoke commands, such as `.next-smoke`. `SMOKE_KEEP_MAP_DEMO=1` retains the three draft properties created by the map smoke run.

```sh
pnpm lint
pnpm build
pnpm smoke
pnpm size
pnpm size:check
```

Playwright launches installed Chrome. Screenshots and perf reports go under `.artifacts/`. Run `pnpm clean` to remove Next.js builds and test outputs and print the space freed. `pnpm size:check --index` checks staged content. The source budget is under 25 MB total, with a 2 MB limit per file. Media, SQLite files, build outputs, and generated captures stay outside Git.

To adopt the clean history locally, clone a second copy with `git clone --no-local --single-branch --branch main-clean <local-repo> aurelia-clean`, then restore the media pack there. Keep the current checkout and repository backup until you have verified the new one.

## Deployment

For persistent production use, migrate SQLite data to PostgreSQL with a PostgreSQL migration baseline and implement the S3/R2 storage adapter. Configure production session, email, and site URL environment variables and run the video worker as a separate persistent process. Existing 360° authoring is described in [360 asset notes](docs/360-assets.md). The current inquiry form still uses Resend when configured. Lead persistence and CRM management screens belong to later work.
