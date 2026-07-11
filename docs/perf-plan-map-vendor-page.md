# Execution plan: map + vendor-page performance (round 1)

**Status:** approved by Kiara 2026-07-10. This doc is self-contained — an agent
with no other context can execute it. Scope was agreed as "items 1–2" of the
perf investigation: perceived-latency fixes for the vendor page, and
fetch/caching + index fixes for the Explore map. The bigger GeoJSON-layer
marker rewrite is **explicitly out of scope** (see § Out of scope).

## Background — the two symptoms and their root causes

**Symptom A: clicking a map pin → long pause before the vendor page renders.**
- There is no `loading.tsx` anywhere in `app/`, so Next.js shows *nothing*
  until the vendor page's entire server render finishes.
- The server render in `app/(app)/vendor/[id]/page.tsx` is a sequential
  waterfall of network round trips: vendor row → `auth.getUser()` (a network
  call to Supabase Auth) → "does this user already have recon?" query → only
  then the parallel pair (recon entries + Google photos). 4–5 serial round
  trips at ~100–300 ms each.
- The middleware (`proxy.ts` → `lib/supabase/middleware.ts`) makes an
  *additional* `auth.getUser()` network round trip on every navigation.

**Symptom B: map is blank for a few moments after panning/zooming to an area.**
- Pins are fetched only on `moveend` + a 300 ms debounce + a full
  browser→Supabase RPC round trip (`components/map/vendor-map.tsx`).
- Every fetch refetches, even when panning back to an area just viewed —
  there is no coverage cache and the bbox queried is exactly the viewport, so
  every small pan misses.
- The `vendors_in_bbox` RPC (`supabase/migrations/0003_rpc.sql`) filters on
  `st_intersects(v.location::geometry, …)`. The only spatial index
  (`vendors_location_gix`, migration `0001`) is on the **geography** column,
  which cannot serve the geometry cast → sequential scan of `vendors` on
  every pan.

## House rules (do not violate)

- Read `CLAUDE.md` and `AGENTS.md` at the repo root first. This project runs
  **Next.js 16** — newer than your training data. If any Next API surprises
  you, check `node_modules/next/dist/docs/` before improvising.
- Run `npm install` before anything else (fresh clones have no
  `node_modules`).
- `npm run build` and `npm run lint` must pass before every commit.
- New DB changes go in a **new numbered migration** (`0017_…`), written
  idempotently. Migrations are **not auto-applied** — Kiara runs them by hand
  in the Supabase SQL editor. Never edit an existing migration.
- Do not change the visual design of any page; Phase 1 adds a skeleton that
  mimics the existing layout.
- Work on branch `claude/map-rendering-performance-s67lvz`; commit each phase
  separately with a clear message; push with `git push -u origin <branch>`.

---

## Phase 1 — `loading.tsx` for the vendor page

**File to create:** `app/(app)/vendor/[id]/loading.tsx`

This is the single biggest perceived-latency win: the instant a pin is
clicked, the user sees a vendor-page skeleton instead of a frozen map.

The skeleton mirrors the real page's layout (`page.tsx` in the same folder):
sticky header (back button, category chip, name + category label, two action
buttons), a photo-strip placeholder, and two recon-card placeholders. Use the
project's Tailwind utilities; `animate-pulse` + `bg-muted` blocks are fine.

Create exactly this file content:

```tsx
/** Instant skeleton shown while the vendor page's server render is in flight. */
export default function VendorLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[760px] animate-pulse flex-col pb-6">
      {/* Header skeleton — mirrors the sticky header of the vendor page */}
      <div className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="size-9 shrink-0 rounded-md bg-muted" />
          <div className="mt-0.5 size-9 shrink-0 rounded-lg bg-muted" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
            <div className="h-5 w-2/3 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="size-9 rounded-md bg-muted" />
            <div className="size-9 rounded-md bg-muted" />
          </div>
        </div>
        <div className="mt-3 h-3.5 w-1/2 rounded bg-muted" />
      </div>

      {/* Photo strip placeholder */}
      <div className="mt-4 flex gap-2 overflow-hidden px-4">
        <div className="h-28 w-40 shrink-0 rounded-lg bg-muted" />
        <div className="h-28 w-40 shrink-0 rounded-lg bg-muted" />
        <div className="h-28 w-40 shrink-0 rounded-lg bg-muted" />
      </div>

      {/* Recon entry placeholders */}
      <div className="mt-5 flex flex-col gap-3 px-4">
        <div className="h-3.5 w-28 rounded bg-muted" />
        <div className="h-36 w-full rounded-xl bg-muted" />
        <div className="h-36 w-full rounded-xl bg-muted" />
      </div>
    </div>
  );
}
```

**Acceptance:** `npm run build` passes; the file is a server component (no
`"use client"`, no hooks).

---

## Phase 2 — collapse the vendor-page query waterfall

**File to edit:** `app/(app)/vendor/[id]/page.tsx`

Restructure the data fetching from 4–5 sequential awaits into **two parallel
stages**. Stage 1 runs the three queries that don't depend on each other;
stage 2 runs the two that depend on stage-1 results.

Replace the block that currently spans from `const supabase = await
createClient();` through the `const entries = user ? … : rawList;` sort
(today roughly lines 57–115) with:

```tsx
const supabase = await createClient();

// Stage 1 — independent fetches in parallel: the vendor row, the viewer's
// identity, and the vendor's active recon entries. getClaims() verifies the
// JWT locally (no Auth-server round trip when the project uses asymmetric
// signing keys; falls back to a network check otherwise — never slower than
// the getUser() it replaces, and it runs in parallel here regardless).
const [vendorRes, claimsRes, entriesRes] = await Promise.all([
  supabase.from("vendors").select("*").eq("id", id).single(),
  supabase.auth.getClaims(),
  supabase
    .from("recon_entries")
    .select("*, author:profiles(username, is_bot), media:recon_media(*)")
    .eq("vendor_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false }),
]);

const vendor = vendorRes.data;
if (vendorRes.error || !vendor) {
  notFound();
}

const userId = claimsRes.data?.claims.sub ?? null;

// Stage 2 — both need stage-1 results. The "does the viewer already have
// recon here" check must stay a separate query (it counts `flagged` entries,
// which the active-only list above does not include). getVendorGooglePhotos
// only touches the network on a cache miss, so it's usually free.
const [existingRes, googlePhotos] = await Promise.all([
  userId
    ? supabase
        .from("recon_entries")
        .select("id")
        .eq("vendor_id", id)
        .eq("author_id", userId)
        .neq("status", "removed")
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null }),
  getVendorGooglePhotos(vendor),
]);
const userHasRecon = !!existingRes.data;
```

Then reconcile the rest of the component with the new variables:

1. The old `const { data: { user } } = await supabase.auth.getUser();` and
   the old sequential `userHasRecon` block are **gone** — everything below
   uses `userId` (a `string | null`) instead of `user`.
2. The entries sort becomes:
   ```tsx
   const rawList = (entriesRes.data ?? []) as ReconEntryWithDetails[];
   const entries = userId
     ? [...rawList].sort((a, b) => {
         const aMine = a.author_id === userId ? 0 : 1;
         const bMine = b.author_id === userId ? 0 : 1;
         return aMine - bMine;
       })
     : rawList;
   ```
3. The `ReconCard` prop becomes
   `isMine={!!userId && entry.author_id === userId}`.
4. Everything else (Google-credit line, `photos` mapping, JSX) is unchanged.

**Behavioral invariants to preserve (check yourself against each):**
- A missing/invalid vendor id still 404s (`notFound()`).
- Logged-out viewers still see the page (public deeplinks must work — this is
  a hard product rule).
- The viewer's own entry still sorts first; ownership badges unchanged.
- The "Add recon" CTA still hides when the viewer has *any* non-removed entry
  for this vendor, **including `flagged` ones** — that's why the separate
  stage-2 query stays instead of deriving from the active-only list.

**Acceptance:** build + lint pass; net effect is 2 sequential stages
(~2 round trips) instead of 4–5.

---

## Phase 3 — drop the per-navigation Auth round trip in middleware

**File to edit:** `lib/supabase/middleware.ts`

Replace the line

```ts
await supabase.auth.getUser();
```

with

```ts
// Verify the JWT (locally when the project uses asymmetric signing keys) and
// refresh the session when it's near expiry. Replaces getUser(), which made
// a network round trip to Supabase Auth on every navigation.
await supabase.auth.getClaims();
```

Keep the surrounding comment about not gating routes; do not add any
redirect/branching logic. `getClaims` is present in the pinned
`@supabase/auth-js` 2.108.2 and is the pattern current `@supabase/ssr` docs
use in middleware; it still triggers a token refresh when the access token is
expired.

**Caution:** this is the one change in the plan with auth-flow blast radius.
If manual QA (see § Verification) shows any session weirdness — login loops,
users getting logged out, magic-link resume breaking — revert **this file
only** and note it in the commit message; the rest of the plan does not
depend on it.

---

## Phase 4 — padded-bbox fetch + coverage cache on the map

**File to edit:** `components/map/vendor-map.tsx`

Three coordinated changes; do not touch the marker-building, fan-out, or
approximate-pin logic.

**4a. Cut the debounce.** Change `const DEBOUNCE_MS = 300;` to
`const DEBOUNCE_MS = 150;`.

**4b. Fetch a padded bbox.** Add next to the other module constants:

```ts
// Fetch beyond the viewport so small pans land inside already-fetched area.
const BBOX_PAD_FACTOR = 0.5; // half a viewport-span extra on each side
```

**4c. Coverage cache.** Add a ref inside the component alongside the other
refs:

```ts
// Area covered by the last *complete* fetch. When the viewport stays inside
// it, the markers on the map are already correct — skip the refetch.
const coverageRef = useRef<{
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
} | null>(null);
```

Rework the top of `refreshMarkers` so it (1) early-returns on a cache hit,
(2) queries the padded box, (3) records coverage only when the result was
complete:

```ts
const bounds = map.getBounds();
const west = bounds.getWest();
const south = bounds.getSouth();
const east = bounds.getEast();
const north = bounds.getNorth();

// Cache hit: viewport fully inside the area of the last complete fetch —
// every vendor in view is already a marker on the map.
const cov = coverageRef.current;
if (
  cov &&
  west >= cov.minLng &&
  east <= cov.maxLng &&
  south >= cov.minLat &&
  north <= cov.maxLat
) {
  return;
}

const lngPad = (east - west) * BBOX_PAD_FACTOR;
const latPad = (north - south) * BBOX_PAD_FACTOR;
const min_lng = west - lngPad;
const max_lng = east + lngPad;
const min_lat = Math.max(south - latPad, -85);
const max_lat = Math.min(north + latPad, 85);

const { data, error } = await supabase.rpc("vendors_in_bbox", {
  min_lng,
  min_lat,
  max_lng,
  max_lat,
  max_rows: MAX_ROWS,
});

if (error) {
  console.error("[VendorMap] vendors_in_bbox error:", error.message);
  return; // keep existing markers and coverage — stale beats blank
}
```

After the vendor list is materialized (where `markersRef.current =
newMarkers;` context begins today), record coverage:

```ts
// A truncated result (hit MAX_ROWS) means the padded area is only partially
// known — zooming into it could reveal vendors we never received, so only a
// complete result is safe to treat as covered.
coverageRef.current =
  vendors.length < MAX_ROWS
    ? { minLng: min_lng, minLat: min_lat, maxLng: max_lng, maxLat: max_lat }
    : null;
```

Place this so it runs on **every successful fetch**, including the
`vendors.length === 0` early-return path (an empty area is a *complete*
result — cover it, or panning around an empty region refetches forever).
Concretely: set `coverageRef.current` right after `clearMarkers()` /
`const vendors = …`, before the `if (vendors.length === 0) return;`.

**Notes / known trade-offs (accepted, do not "fix"):**
- Coverage is session-scoped and never expires; a vendor added by someone
  else mid-session won't appear until the user pans outside the covered area
  or reloads. Fine for now.
- No antimeridian handling — the product is US-metro-scoped (Denver).
- On a cache hit, markers slightly outside the viewport remain mounted;
  harmless.

**Acceptance:** build + lint pass. Behavior to eyeball in dev (needs
`.env.local`): pan a little → no new network request in the browser dev-tools
network tab; pan far → one RPC request with a bbox larger than the viewport;
pins never vanish while a fetch is in flight.

---

## Phase 5 — migration `0017`: let the RPC use a spatial index

**File to create:** `supabase/migrations/0017_vendors_geom_index.sql`

Do **not** modify the `vendors_in_bbox` function — add an expression index
that matches its existing predicate exactly. This is purely additive and has
zero behavioral risk:

```sql
-- vendors_in_bbox (0003) filters on st_intersects(location::geometry, …).
-- The existing GiST index (0001, vendors_location_gix) is on the geography
-- column and cannot serve that cast, so bbox queries sequential-scan the
-- table. This expression index matches the RPC's predicate as written.
create index if not exists vendors_location_geom_gix
  on vendors using gist ((location::geometry));
```

**Acceptance:** file exists, is idempotent (`if not exists`), and is NOT
applied by the agent. Flag it clearly in the final summary/PR notes:
**Kiara must hand-run `0017` in the Supabase SQL editor** (and can verify
with `explain analyze select * from vendors_in_bbox(-105.3, 39.5, -104.6,
40.0);` — the plan should show an Index Scan on
`vendors_location_geom_gix` instead of a Seq Scan).

---

## Verification

Agent-runnable, required before each commit:
1. `npm install` (once), then `npm run build` — must pass.
2. `npm run lint` — must pass.
3. If a populated `.env.local` is available, `npm run dev` and click through:
   Explore → pan/zoom (watch the network tab per Phase 4 acceptance) → click
   a pin (skeleton appears instantly, then the page) → vendor page renders
   correctly logged-out.

Manual QA for Kiara (put this checklist in the final summary):
- [ ] Logged-out: open a vendor deeplink directly — renders, no redirect.
- [ ] Logged-in: own recon entry sorts first and shows its owner controls.
- [ ] "Add recon" CTA hidden on a vendor where you already have an entry.
- [ ] Login, magic-link guest-publish resume, and logout all still work
      (Phase 3 regression check).
- [ ] Hand-apply migration `0017` in the Supabase SQL editor; optionally
      confirm the index scan via `explain analyze`.

## Commit plan

One commit per phase (5 commits), messages like:
- `perf(vendor): add loading skeleton for vendor page`
- `perf(vendor): parallelize vendor-page queries (4-5 round trips -> 2 stages)`
- `perf(auth): getClaims() in middleware instead of per-nav getUser()`
- `perf(map): padded-bbox fetch + coverage cache, 150ms debounce`
- `perf(db): 0017 expression index for vendors_in_bbox (hand-apply)`

Push to `claude/map-rendering-performance-s67lvz`. Do not open a PR unless
asked.

## Out of scope (deliberately — do not attempt)

- GeoJSON source + symbol-layer marker rewrite (the long-term fix for
  pan/zoom smoothness; separate effort).
- `<Suspense>`-streaming the Google photo strip.
- `router.prefetch` on marker hover.
- Vercel/Supabase region co-location (deployment config, not code).
- Any change to `vendors_in_bbox`'s SQL, marker fan-out, or approximate-pin
  heuristics.
