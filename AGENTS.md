# MASTER PROMPT — CRM v2 (Development → Properties) + Lightweight Repo

Save as `AGENTS.md` in the project root (keep the previous one as `AGENTS.platform-v1.md`).
Work in phases. **STOP after the phases named at the bottom and report.** Do not continue on your own, even if the next step looks small.

---

## 0. Goal and priorities

1. **Priority 1 (now): a simple, professional CRM** where I manage a **Development** (a building), mark **Properties** (units) on the building image with **polygons**, and fill each property with floor plan, rooms, videos and 360° panoramas.
2. **Priority 2 (later, separate prompt): frontend v2** (slug-based, unique design/animation per property). Do NOT build it now; only keep the data model ready for it (section 7).
3. **Also now: the project must be light and portable.** It has grown to about 2 GB and cloning on another machine is painful. Fix this first (Phase 0).

Keep it **simple**. No new heavy dependencies. No features that were not asked for. When in doubt, choose the smaller solution.

Keep the existing design language (dark, champagne `#D8B67A`, Cormorant Garamond + Inter, thin 1px dividers, pill buttons, glass panels) and **enhance** it into a professional CRM look (section 4). Everything already built and approved stays: admin login, storage adapter, upload validation, job queue, video pipeline (Veo + manual upload), trimming/watermark handling, frame extraction, 360° authoring and viewer, the Aurelia tour at its current look.

---

## 1. PHASE 0 — Repo diet and portability (do this first, no features)

### 1.1 Audit (report numbers before changing anything)
- Print the size of every top-level folder, the 15 biggest folders inside `node_modules` and `.next*`, and the 30 biggest files under the project (excluding node_modules).
- Report `git count-objects -vH`, the size of the git-tracked files (`git ls-files` sizes summed), and the 20 largest blobs in history (`git rev-list --objects --all | git cat-file --batch-check=...`).
- Likely culprits to check (do not assume, measure): `.next` and `.next-phase1-cache`, Playwright traces/videos/screenshots per phase, `/perf` traces, `/screenshots`, original MP4s in `assets/videos`, frame sequences duplicated in `public/sequences` and `storage/`, test panoramas, old placeholder sequences, SQLite copies, Chromium downloaded by Playwright, logs.
- Add `scripts/size-report.mjs` and `pnpm size` that prints the above in a readable table.

### 1.2 Rules going forward
- **Git-tracked source must stay under 25 MB total.** Add `pnpm size:check` that fails if tracked size > 25 MB or any tracked file > 2 MB.
- **Never commit:** `node_modules`, `.next*`, `storage/`, `data/*.db`, `.artifacts/`, `screenshots/`, `perf/`, `test-results/`, `playwright-report/`, `*.mp4`, `*.mov`, `*.webm`, `*.zip`, generated frames, panoramas. Update `.gitignore` accordingly and remove already-tracked heavy files with `git rm --cached` (keep them on disk if needed).
- All test and perf output goes to **`.artifacts/`** (ignored), never into tracked folders.
- Playwright must use the **installed Chrome** (`channel: "chrome"`) so no Chromium is downloaded into the project. Playwright stays a devDependency.
- Do **not** rewrite git history automatically. Report `.git` size. If it is over 100 MB, prepare a clean branch `main-clean` (fresh history from the current clean tree), back up the old repo as `../3d-backup.git`, and explain in the report how I can switch. I decide.

### 1.3 Frames become a cache, MP4 + images are the source of truth
Frame sequences are large and re-creatable. Change the storage layout:
```
storage/
  originals/<developmentSlug>/...        images + original MP4s  (SOURCE, backed up)
  cache/frames/<propertySlug>/<scene>/   WebP frames            (DERIVED, never backed up)
  db → data/app.db                                         (SOURCE)
```
- Keep `Scene.trimStart/trimEnd/delogo` so frames can always be rebuilt from the stored MP4.
- Add `pnpm frames:rebuild [--property <slug>]` and an admin button "Rebuild frames". If a `ready` scene has no frames on disk, the admin shows "Frames missing — Rebuild" and the public page degrades gracefully (poster image) instead of erroring.
- Add `pnpm media:pack` → creates `media-pack.zip` containing `data/app.db` + `storage/originals` only (no frames, no cache). Add `pnpm media:unpack <zip>` to restore it. Print the zip size.
- Remove the committed/duplicated `public/sequences`; the app serves frames only through `/media/...` from `storage/cache`.
- Desktop frames max 1280 px wide (never upscale), mobile 640 px, WebP quality tuned so a scene is ≤ 8 MB desktop / 3 MB mobile.

### 1.4 Dependency diet
- Report `pnpm why` for the 10 heaviest packages. Remove anything unused. No second image/video library if `sharp` + `ffmpeg-static` already cover it.
- README "Clone on a new machine" must work in 5 commands: `git clone` → `pnpm i` → `cp .env.example .env` → `pnpm db:push` → (optional) `pnpm media:unpack media-pack.zip` + `pnpm frames:rebuild` → `pnpm dev`.

**Phase 0 acceptance:** before/after size table; tracked source < 25 MB; a fresh clone in a temp folder (`git clone` of the working tree, then the 5 steps above, with media pack unpacked) boots `/aurelia` correctly with frames rebuilt.

---

## 2. PHASE 1 — Data model (Development → Property)

Replace the old `Property`-with-`Unit[]` shape with this hierarchy. Keep everything already attached to a property (rooms, pano nodes, scenes) attached to the new `Property`. Use a Prisma migration and a data migration script; **do not lose existing data**.

```prisma
model Development {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  tagline     String?
  location    String?
  description String?
  buildingImage String?          // storage path (the image polygons are drawn on)
  logoImage   String?
  theme       Json?              // default Theme for all its properties (section 6)
  status      String   @default("draft")   // draft | published
  properties  Property[]
  leads       Lead[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Property {                 // = one unit/residence inside a development
  id            String   @id @default(cuid())
  developmentId String
  slug          String                      // unique per development
  name          String                      // "Residence A", "Penthouse 42"
  label         String?                     // short tag shown on the map
  beds          Int?
  baths         Int?
  sqft          Int?
  price         String?
  planImage     String?                     // floor plan image
  polygon       Json?                       // [{x,y}...] normalized 0..1 on buildingImage
  focus         Json?                       // {cx, cy, w, h} computed from polygon (bbox + centroid)
  theme         Json?                       // optional override of the development theme
  status        String   @default("draft")  // draft | processing | published
  order         Int      @default(0)
  rooms         Room[]
  scenes        Scene[]
  leads         Lead[]
  development   Development @relation(fields: [developmentId], references: [id], onDelete: Cascade)
  @@unique([developmentId, slug])
}

model Lead {
  id            String   @id @default(cuid())
  developmentId String?
  propertyId    String?
  name          String
  email         String
  phone         String?
  message       String?
  status        String   @default("new")    // new | contacted | closed
  createdAt     DateTime @default(now())
  development   Development? @relation(fields: [developmentId], references: [id], onDelete: SetNull)
  property      Property?    @relation(fields: [propertyId], references: [id], onDelete: SetNull)
}
```
`Room`, `PanoNode`, `Scene` stay as they are, now pointing at the new `Property`. Remove the old `Unit` table (its fields live on `Property`).

**Migration of existing data:** create Development `aurelia` (building image = current tower image, status published) and one Property `residence-a` (the one that has all the media; the existing floor plan, rooms, panoramas, scenes). If a `Residence B` row exists without media, import it as a `draft` property. Give `residence-a` a reasonable default polygon in the middle of the tower so the polygon editor has something to show.

**Compatibility routes (public pages keep working, same look, no redesign now):**
- `/[dev]/[property]` renders the **existing tour component** for that property.
- `/[dev]` renders the existing tour if the development has exactly one published property (so `/aurelia` still works); otherwise a simple temporary list of its published properties.
- Reserved slugs rejected: `admin`, `api`, `media`, `_next`, `login`, plus file names (`favicon.ico`, `robots.txt`, `sitemap.xml`).

**Phase 1 acceptance:** `/aurelia` and `/aurelia/residence-a` look and behave exactly like today; existing admin flows still work against the new model; migration is idempotent and tested on a copy of the database.

---

## 3. PHASE 2 — CRM shell and design system

Routes under `/admin`: `/admin` (dashboard), `/admin/developments`, `/admin/developments/new`, `/admin/developments/[id]`, `/admin/developments/[id]/properties/[pid]`, `/admin/leads`, `/admin/settings`.
Layout: fixed left **sidebar** (logo, Dashboard, Developments, Leads, Settings), slim top bar (breadcrumbs, "Saved" indicator, user menu with logout), content area with max width and generous spacing.

Build a tiny shared UI kit in `components/admin/ui/` (no external UI library): `Button` (primary champagne / ghost / danger), `Input`, `Select`, `Textarea`, `Field` (label + help + error), `Card`, `Table`, `Badge` (status chips), `Tabs`, `Modal/ConfirmDialog`, `Toast`, `EmptyState`, `Skeleton`, `ImageDropzone`.

## 4. CRM visual direction (professional, same family as the public site)
- Background near-black `#0A0A0B`, panels `#111113` with 1px `rgba(255,255,255,0.08)` borders, champagne accent only for primary actions, active nav item, focus rings and key numbers.
- Headings in Cormorant Garamond, everything else Inter; small uppercase letter-spaced labels; 8px grid; rounded 10–12px cards; pill buttons.
- Tables: sticky header, zebra off, row hover, thumbnail column, status badges (Draft grey, Processing amber, Published green).
- Empty states with one clear action. Skeleton loaders. Toasts for save/errors. Keyboard focus visible everywhere. Responsive to tablet; usable on phone for viewing leads.
- No animations beyond small fades/slides (150–200 ms). Respect `prefers-reduced-motion`.

---

## 5. PHASE 3 and 4 — Development and Property management

### 5.1 Developments
- List page: card/table with thumbnail, name, slug, location, number of properties, status, last updated, "Open" and "View site" buttons.
- Create/Edit: name, slug (auto from name, editable, live uniqueness check), tagline, location, description, **building image** (ImageDropzone, warns if not ~16:9 or < 1600 px wide), logo image, publish toggle, theme (section 6). Autosave with "Saved" state, delete with confirm.

### 5.2 Polygon editor ("Mark properties on the building")
On the development page, tab **"Building map"**:
- Shows the building image with an **SVG overlay** (viewBox 0 0 1 1 scaled to the image), all polygons visible, the selected one highlighted in champagne, others in translucent white, labels at centroids.
- Right panel: list of properties (name, label, status) + "Add property". Selecting one enters edit mode.
- **Drawing:** click to add points, click the first point (or press Enter) to close; **drag points** to adjust; click a point + Delete to remove; click on an edge to insert a point; Esc cancels; Ctrl+Z / Ctrl+Y undo/redo; "Clear polygon"; "Duplicate polygon" helper.
- Zoom (wheel) and pan (space + drag or middle mouse) for large images; coordinates always stored normalized 0–1.
- Validation: at least 3 points, all within the image, polygon not self-intersecting, minimum area. Computes and stores `focus` (centroid and bounding box).
- Custom SVG code only — no polygon/editor library.
- Quick actions: "Create property from this polygon" (asks for name and creates the Property), link/unlink an existing property.

### 5.3 Properties (inside a development)
Property edit page with tabs, **reusing what already exists**:
1. **Details:** name, slug (unique within development), label, beds/baths/sqft/price, status.
2. **Images:** floor plan image upload; rooms with image + label + description; hotspot placer on the floor plan.
3. **360° Walkthrough:** existing panorama/nodes/links/minimap editor.
4. **Videos:** existing pipeline UI. The `hero-to-plan` scene now uses the **development building image** as the start frame; additionally generate and store a **focus crop** (`focus.webp`, 16:9, centered on the polygon bounding box with padding) for the frontend to use later. The scene still works if no polygon exists.
5. **Theme:** the override of the development theme (section 6), with a small live preview card (fonts, colours, caption style sample, motion name). A "Reset to development theme" button.
Property cards in the development view show completeness (plan ✓, rooms n, videos ready n/m, 360 ✓).

---

## 6. Theme / "unique per property" settings (data only, no code per property)
Store as JSON, validated with zod, resolved by `resolveTheme(development.theme, property.theme)` (property overrides development):
```ts
type Theme = {
  accent: string;                                   // hex
  fontPair: "serif-classic" | "serif-modern" | "sans-minimal" | "display-bold";
  motion: "glide" | "editorial" | "snappy" | "dreamy";        // ease curves, scroll length multiplier, caption reveal
  transition: "dissolve" | "wipe" | "zoom-through";            // between scenes
  captionStyle: "chip" | "lowerThird" | "minimal";
  overlay: "grain" | "vignette" | "none";
  logoImage?: string;
};
```
In this phase only the **CRM editor, storage, validation and `resolveTheme`** are built. The public pages will consume it in the frontend phase.

---

## 7. PHASE 5 — Leads, dashboard, storage

- **Leads:** the public "Register Interest" form (existing `/api/lead`) now saves to the database (with development/property when known) and still emails if Resend is configured. `/admin/leads`: table (date, name, email, phone, development, property, message), filter by status/development, change status inline, delete, **CSV export**.
- **Dashboard:** counts (developments, properties, published, new leads), "needs attention" list (properties with failed/needs_review scenes, missing frames), pending job count, and storage line (free disk space, size of originals, size of cache).
- **Settings:** admin password change info (from env), a "Rebuild all frames" button, a "Create media pack" button (calls the same code as `pnpm media:pack`), storage paths, and the free-space guard (refuse uploads/extractions when < 2 GB free, with a clear message).

---

## 8. Frontend v2 — NOT NOW (for context only)
Later prompt will cover: `/[dev]` page with the building image and clickable polygons (hover highlight, click → zoom into the polygon using the stored `focus`, then the property journey), `/[dev]/[property]` cinematic journey (tower → floor plan → rooms → 360°) with minimal chrome like the reference (small logo, "Back to the tower", "Register Interest", room chip), and the theme driving fonts, motion presets, transitions and captions per property. Do not implement any of this now.

## 9. Backlog (not now)
Performance gates from Phase D (sliding-window frame cache, measurement), live Veo test on one scene, real panoramas and phone testing, email delivery check, production setup (Postgres, S3/R2 adapter, worker).

---

## 10. Rules for every phase
1. Strict TypeScript, zod validation on every API, auth check inside every `/api/admin/*` handler, CSRF-safe mutations (same-site cookie + origin check), sanitized filenames, size/type limits.
2. After each phase run `pnpm lint && pnpm build && pnpm smoke`, update tests (Playwright with system Chrome, output in `.artifacts/`), and run `pnpm size` — **report the numbers**.
3. Smoke tests must cover: `/aurelia`, `/aurelia/residence-a`, a 404, admin login, create development → upload building image → draw polygon → create property → publish → visit its URL.
4. Be honest about what you could not verify. No fake success.
5. Report format: files changed, commands run, results, size table, known issues, exact next step.

**START WITH PHASE 0 AND PHASE 1 ONLY. STOP AFTER PHASE 1 AND REPORT.**