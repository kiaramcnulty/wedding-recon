@AGENTS.md

# Wedding Recon

Mobile-first PWA for engaged couples to (1) explore local wedding vendors on a map and (2) log + save their own "recon" (price quotes, notes, photos) in a personal planning hub. Non-revenue — favor free/low-cost choices. Soft-launch market: Denver, CO.

Full product/dev plan: see the approved plan referenced in the repo history; this file is the working reference for conventions.

## Stack
- Next.js 16 (App Router, TypeScript, Turbopack) — see `AGENTS.md`: this Next is newer than your training data, check `node_modules/next/dist/docs/` when unsure.
- Tailwind v4 (CSS-based config in `app/globals.css`, no `tailwind.config.js`).
- shadcn/ui components in `components/ui/` — these wrap **Base UI** (`@base-ui/react`), not Radix. Follow the existing component files for APIs.
- Icons: `lucide-react`.
- Supabase (Postgres + PostGIS + Auth + Storage + RLS).
- Map: MapLibre GL JS + free OpenFreeMap tiles. Google Places only for business search in Add Recon.

## Conventions & contracts (do not break these)
- **Vendor categories**: import from `lib/constants/categories.ts` (`VENDOR_TYPES`, `CATEGORIES`, `RECON_TYPES`, labels). Each type has a fixed icon + color reused on pins, chips, accordions, tags. Never hardcode category colors elsewhere.
- **Types**: shared row types in `lib/types.ts`.
- **Supabase clients**:
  - Client Components → `createClient()` from `lib/supabase/client.ts`.
  - Server Components / Route Handlers / Server Actions → `await createClient()` from `lib/supabase/server.ts`.
  - Service role (server-only, bypasses RLS) → `createServiceRoleClient()` — use sparingly.
- **Auth session** is refreshed in `proxy.ts` (Next 16's renamed middleware). Don't gate public vendor pages — shared deeplinks must render without an account.
- **Map geo query**: call the `vendors_in_bbox` RPC; it returns flattened `lng`/`lat` (plus `source`, `google_place_id`, `address_text` used for pin styling).
- **Map markers**: `components/map/vendor-map.tsx` gives approximate-location pins a dashed outline and fans out pins that share a coordinate (deterministic phyllotaxis). See "Approximate-location map pins" below.
- **Schema** lives in `supabase/migrations/`. If you change the DB, add a new numbered migration — don't edit applied ones. Write them idempotent and **apply new ones by hand in the Supabase SQL editor** (not auto-applied to the hosted DB). See "Migrations" below.
- **Copy/nomenclature**: the recon CTA is **"Save recon"** (not "Publish"); user-facing labels say **"Vendor"**, not "Business".

## App structure
- `app/(app)/` — main screens with the mobile frame + bottom nav: `explore`, `add`, `hub`, and `vendor/[id]`.
- `app/(auth)/` — login / onboarding (no bottom nav).
- `components/` — shared components (`bottom-nav.tsx`, plus feature components).
- Mobile frame is `max-w-[480px]`, centered.

## Env
Copy `.env.example` → `.env.local` and fill in. See `SETUP.md` for how to obtain each value.

## Run
- `npm run dev` — dev server (needs `.env.local`).
- `npm run build` — production build (must pass before commit).
- `npm run lint` — eslint.

## Skills
- **`/launchvendors <type> <region>`** — seed a region's vendors for one vendor type (venue default; photographer supported — more types over time). Places sweep + web research + user-pasted Reddit/IG content → canonical Google-place resolve (city-centroid fallback) → local CSV review → deduped bulk Supabase insert. Headless (no browser/Sheets; never fetches Meta). Shared engine in `.claude/skills/launchvendors/scripts/` (mechanical config: `TYPE_PROFILES` in `lib.mjs`) + per-type judgment cards in `types/*.md`. Photographer runs also capture `vendors.instagram` (needs migration `0016`). Recon enrichment is a separate later step. (Renamed from `/launchvenues`; old venue workdirs stay in `data/launchvenues/`.)
- **`/enrichvendors <type> <region>`** — enrich seeded vendors of one type (venue default; photographer supported) with bot-authored recon entries (Places reviews + site crawl + Reddit/web research → per-vendor dossiers → single-turn Sonnet draft workers → human-voiced `recons.csv` → upload under user-approved `is_bot` accounts). Requires migration `0012` (+`0016` for photographers); per-STATE bot rosters in `data/enrichvenues/rosters/` are shared across vendor types. Human gates: batch scope, CSV review, roster, upload dry-run (pre-authorizable for unattended runs). Mechanical type profiles in `scripts/etype.mjs`; judgment cards in `references/<type>/`. Photographer entries hard-require `service_region`; photographer photo target ~3/vendor. (Renamed from `/enrichvenues`; legacy venue workdirs stay in `data/enrichvenues/`.)

## Key patterns & learnings

### Navigation with return context
- Use a `from` query param to track origin page (e.g., `?from=/explore` or `?from=/vendor/123`).
- Always validate: `from && from.startsWith("/") && !from.startsWith("//")` to prevent open redirects.
- Encode return paths: `encodeURIComponent(returnTo)` when serializing, `decodeURIComponent()` when reading (though next/navigation handles this).
- Example: guest clicks "Save" on vendor → redirects to `/login?from=/vendor/123` → after login, back button returns to that vendor (not Explore).

### React + SSR patterns
- **Portal rendering requires mounted state guard:** use `useEffect` with `setTimeout(..., 0)` to defer `setMounted(true)` (satisfies `react-hooks/set-state-in-effect` lint rule and ensures DOM exists).
  ```tsx
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);
  ```
- **Portals escape containing block constraints:** `createPortal(el, document.body)` escapes `position: fixed` being relative to an ancestor with `backdrop-filter` or `transform`. Use for modals, drawers, popovers that need viewport-level positioning.
- **Server Actions + file uploads:** don't route image bytes through a Server Action — Next caps the action body at 1 MB, Vercel at ~4.5 MB. Compress + upload client-side directly to Supabase Storage and pass only the storage paths to the action (small structured data can ride along as a serialized arg). See **Recon photo uploads** below.

### UI layout & constraints
- Mobile frame: `max-w-[480px]` centered, tight padding, bottom nav always visible.
- Wider content (hub, vendor page): `max-w-[760px]` for better use of desktop space while staying readable.
- Bottom nav items: grid layout centered via `mx-auto` with the `max-w-[520px]` constraint (matches mobile frame + padding).
- Headers with profile menu: use `ProfileMenu className="ml-auto shrink-0"` to right-align; it auto-portals internally.

### Supabase patterns
- **Idempotent upserts:** `upsert(..., { onConflict: "col1,col2" })` for operations that might repeat (e.g., save vendor to hub).
- **Case-insensitive uniqueness:** use a functional unique index `CREATE UNIQUE INDEX idx_name ON table (LOWER(col))` instead of relying on app-level normalization.
- **Vendor dedup:** 
  - Google Places path: upsert by `google_place_id` (guaranteed unique from Google).
  - Manual/user path: soft-dedup by `ilike("name", name)` + `ilike("city", city)` to catch duplicates, then insert if not found.
  - Pre-resolved vendor: lock the vendor type since it's canonical data; don't allow user to override.
- **RLS for public pages:** enable public read on `vendors`, `profiles.username`, `recon_entries` (filtered by status), `recon_media`; restrict write to authenticated users, update/delete to row owners.

### Form & field handling
- **Vendor type locking:** when adding recon for an existing vendor (via Hub "Add Recon" button), pass `vendorId` + `vendorType` as query params. Lock the type chip (read-only display) if both are present — the user cannot override.
- **Google Places integration:** server-side only; call `/api/places` route handler with an API key in `.env.local` (never exposed to client). Return place data (id, name, address, lat/lng) to client.
- **Image uploads:** compressed in the browser and uploaded **directly to Storage** (not through the action); the action only records `recon_media` paths. See **Recon photo uploads** below.

### Errors & gotchas
- **Base UI + Radix confusion:** shadcn/ui wraps Base UI, not Radix — APIs differ. Check existing component files for patterns.
- **Console warning with render prop:** `<Button render={<Link>} />` triggers a warning; instead use `<Link className={buttonVariants()} />` directly.
- **Unique violation handling:** Google Places upsert can hit duplicate key; handle gracefully with `error?.code === "23505"` check.
- **Supabase free tier pausing:** after 7 days with zero requests, the project pauses (not deleted). Keep-alive via a daily `/api/health` ping (GitHub Actions or Vercel Cron) during cold-start.
- **react-hook-form + React Compiler:** `watch("field")` triggers a benign "Compilation Skipped: incompatible library" lint warning (the compiler skips memoizing that component). Functionally fine; not worth chasing.

### Blended vendor search (dedup) — `/api/places`
- The business-search box searches **Google Places autocomplete AND existing vendors (Supabase) in parallel**, then merges. A Google prediction whose `place_id` matches an existing vendor is collapsed to the DB row (dedup).
- Returns a `SearchSuggestion` union: `{ kind: "existing", vendorId, vendorType, source, ... }` or `{ kind: "google", placeId, ... }`, sorted by a lightweight **name-match relevance score** (exact > starts-with > word-boundary > contains), source-agnostic (Google exposes no score).
- Combobox (`components/add/places-combobox.tsx`) tags each row **"Google" / "User created" / "Featured"** (seed). Picking an existing vendor calls `onSelectExisting` → resolves straight to its `vendorId` (no new row, no Places details call) and **locks the type chip** (vendor type is canonical).

### Recon entry fields: collected date + service region
- `recon_entries` has `recon_collected_month` / `recon_collected_year` (two dropdowns, default **current** month/year, year range 2000–present) and `service_region` (text, shown **only for non-venue** vendor types). Migrations `0008`, `0009`.
- Form lives in `app/(app)/add/page.tsx`; display in `components/vendor/recon-card.tsx`. Cards **guard for null** so pre-migration rows render without an "Invalid Date" badge.
- **SSR/timezone:** compute "current month/year" defaults on the client in a `useEffect` (then `setValue`), not during render, to avoid an SSR/client hydration mismatch.

### Recon photo uploads (client-side compress + direct-to-Storage)
- Photos are **compressed in the browser** (`lib/image-compress.ts` — ~1600px full + ~400px thumbnail, JPEG) and **uploaded straight to Supabase Storage** (`lib/recon-upload.ts`); they never pass through the `createRecon` Server Action body. This sidesteps Next's 1 MB action-body cap **and** Vercel's ~4.5 MB serverless limit, and is the main lever on Storage/egress cost (~10× smaller files).
- `createRecon` (`app/(app)/add/actions.ts`) takes the typed input **directly** (no FormData) and only **records media paths** on `recon_media` (`storage_path` + `thumb_path`). Uploads land under `${userId}/<submissionUuid>/…`.
- Picker (`components/add/image-upload.tsx`): **max 4 photos, 50 MB each** (per-file, client-side); the bucket also enforces a 50 MB `file_size_limit` (migration `0010`) as a server-side backstop.
- Display: `recon-card.tsx` previews use `thumb_path ?? storage_path` (egress saver); the vendor-page carousel uses the full image. Reads select `recon_media(*)`, so a missing `thumb_path` is null-safe on pre-migration rows.
- **Guest flow:** raw photos are stashed in IndexedDB and compressed + uploaded on **resume** (post-auth), since Storage RLS requires an authenticated uploader.
- Storage RLS (`0005_storage.sql`) already lets any authenticated user upload to `recon-media`; Supabase stamps `owner = auth.uid()` so the owner-only update/delete policies still apply — **no new policy needed** for client uploads.

### Approximate-location map pins
- `isApproximateLocation(vendor)` heuristic: **non-Google source + no digit in the address** ⇒ approximate (geocoded to a city/region centroid, not a street address). Known blind spot: numbered street names ("E 17th Ave") read as precise. The robust replacement is to **store geocode precision at save time** (Nominatim returns `addresstype` + a `boundingbox`) and key off that field instead.
- Approximate pins get a **dashed** white outline (vs solid); pins sharing a rounded coordinate are **fanned out** across a compact phyllotaxis disc (`~110m·√n`, deterministic by vendor id so they don't jump on pan). Both live entirely in `vendor-map.tsx` — no migration, since the RPC already returns `source`/`google_place_id`/`address_text`.
- For very large piles (~50) the fan-out only fully separates at city zoom; if that becomes common, add a click-to-list drawer (discussed, not built).

### Migrations
- **Write idempotent:** `add column if not exists`; for constraints use `drop constraint if exists` then `add constraint` (Postgres has **no** "add constraint if not exists").
- **One ALTER per constraint** — you cannot chain multiple `add constraint` clauses in a single `alter table` (syntax error).
- **Not auto-applied** to the hosted DB — run new migrations by hand in the Supabase SQL editor.

## Milestone status
M0 foundation done; M1 (Auth) → M2 (Explore map) → M3 (Vendor page) → M4 (Add Recon) → M5 (Hub) → M6 (T&S) all built and functional. Current work is polish/edge-cases.

Recent (2026-06, all on `main`): blended vendor search w/ source tags; guest recon publish via magic link + IndexedDB draft (same-device); required geocoded location for manual vendors; "Recon collected at" (month/year) + "Service region" fields; dashed-outline + fan-out for approximate map pins; "Save recon"/"Vendor" copy.

**Hosted-DB note:** migrations `0008`–`0011` are **applied** (`0011_vendor_website.sql` adds `vendors.website`, shown as a "Visit website" link). `0016_vendor_instagram.sql` adds `vendors.instagram` (bare handle, rendered as an "Instagram" link next to the website link; populated by pipelines only — no user-facing input) — **hand-apply before the first photographer upload**. All migrations are idempotent. Reminder: migrations are **not** auto-applied to the hosted DB — run new ones by hand.
