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
- **Map geo query**: call the `vendors_in_bbox` RPC; it returns flattened `lng`/`lat`.
- **Schema** lives in `supabase/migrations/`. If you change the DB, add a new numbered migration — don't edit applied ones.

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

## Milestone status
M0 foundation (scaffold, design system, DB schema/RLS/RPC/seed, shell) is done. Feature slices M1–M6 build on it. Placeholders exist for `explore`/`add`/`hub` — replace them.
