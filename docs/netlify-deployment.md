# Netlify deployment status

The Netlify-branded "Page not found" screen is a hosting-level 404. It does
not identify which deployment setting failed. Check the deployed file list,
build log, and Next.js adapter output before attributing the cause.

## Build settings

Connect the source repository to Netlify and use the project root as the base
directory. The root `netlify.toml` specifies `pnpm build`, publishes `.next`,
and resets `NEXT_DIST_DIR` to `.next` so local profiling directories are not used.
Netlify automatically applies its Next.js adapter. Do not drag the source folder,
`public`, or a locally generated `.next` folder into Netlify's static uploader.
Do not add an SPA rewrite to `/index.html`: this application has server routes.

Official setup: https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/

## Remaining production work

The build settings alone do **not** make this platform production-ready:

- Prisma currently uses SQLite. Provision a persistent database and migrate the
  schema and data before enabling a serverless deployment. Setting a PostgreSQL
  URL alone is insufficient while the Prisma provider remains `sqlite`.
- Media currently lives in local `storage/`, excluded from Git. Implement the
  existing S3/R2 adapter stub, transfer media, and verify access controls. Removing
  `storage/` or database files from `.gitignore` is not a production storage fix.
- Video generation and ffmpeg extraction need a separate persistent worker and
  storage integration; the current in-process worker must not be assumed to
  continue after a serverless request finishes.
- Configure admin/session secrets and the public site URL through hosting
  environment variables. Never commit `.env.local` or credentials.

For the current implementation, a persistent Node server with SQLite and a
mounted media directory matches the existing architecture. Netlify requires the
database, storage, and worker changes above for the full admin platform.

## Verification

After a real deployment, verify `/`, `/aurelia`, `/admin/login`, a missing slug,
authenticated uploads, media access, and a complete video job. A successful
local build does not verify the Netlify deployment. No live deployment was
performed when these settings were added.
