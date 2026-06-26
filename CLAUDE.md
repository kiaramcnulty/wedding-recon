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
- **Server Actions with file uploads:** pass `FormData` (images survive serialization boundary); send structured data as JSON string in a reserved key (`__input`), then `JSON.parse()` on the server.

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
- **Image uploads:** accept as `File[]` via a combobox UI, serialize via `FormData`, upload server-side to Supabase Storage, then insert `recon_media` rows with storage paths.

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

**Hosted-DB note:** migrations `0008_recon_collected_at.sql` and `0009_service_region.sql` are **applied** (2026-06-26); both are idempotent (safe to re-run). Reminder for future schema changes: migrations are **not** auto-applied to the hosted DB — run new ones by hand in the Supabase SQL editor.
