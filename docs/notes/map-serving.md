# How the Explore map is actually served (the 2026-08-14 pool incident)

The map's data path is no longer "the browser calls `vendors_in_bbox`". It goes
through an edge-cached route, with the viewport snapped to a shared grid and the
per-type fan-out both capped and retried. All three exist because of one
production outage, and undoing any of them re-opens it.

**This was undocumented until 2026-09-12** even though it is the most
load-bearing thing about the map, so the old `CLAUDE.md` contract ("call the
`vendors_in_bbox` RPC") described a path the app had stopped using.

## What happened

A Reddit traffic spike on **2026-08-14**. The app was healthy all day, then a
burst of `POST /rpc/vendors_in_bbox` **503s** the instant real traffic arrived --
a blank map for everyone, simultaneously.

The cause was structural, not a bug. A single PostgREST response is capped at
`POSTGREST_MAX_ROWS` and the corpus is larger, so the map issues **one RPC per
vendor type** -- about a dozen -- to get a full viewport. Those calls ran through
`Promise.all`, so **one map load opened ~12 Postgres connections at once**. On
the free-tier pooler a handful of simultaneous visitors exhausted the pool. Note
the shape: nothing degrades gradually. The map is fine until it is completely
gone for everybody.

## The three fixes, and why each is separate

**1. An edge-cached route: `app/api/map/vendors/route.ts`.** The browser calls
this instead of the RPC. It returns the raw `vendors_in_bbox` rows, so the map is
unchanged downstream. The point is purely the cache: `CDN-Cache-Control:
public, s-maxage=60, stale-while-revalidate=300` collapses a spike of identical
viewports into roughly **one DB hit per minute**. `Cache-Control` holds nothing in
the browser -- vendor data changes, and the shared cache is where the win is.

Two things keep it cacheable and **must stay true**:
- it is EXCLUDED from the auth middleware (the `proxy.ts` matcher), so no
  `Set-Cookie` ever lands on the response; and
- it uses a plain **anon** client with no cookies, so nothing varies per user.
  The client also fetches with `credentials: "omit"`.

Anon RLS already allows public vendor reads, so none of this loses data -- the
same reasoning as `app/sitemap.ts`. An upstream error is returned as a **503 with
`no-store`**, so a failure can never stick in the cache.

**2. `snapBbox()` in `lib/map/viewport.ts`.** A cache only helps if requests
repeat, and a raw viewport is a float soup that never repeats -- hit rate ~0%.
Snapping the box to a shared grid makes near-identical viewports resolve to one
URL, so a wave of visitors all landing on the default Denver view becomes one
cached response instead of one query each. The step **scales with the box** (a
fixed-degree grid is far too coarse when zoomed in) and the result always
**CONTAINS** the input, so the map still gets every pin in view -- it just
fetches a slightly larger, grid-aligned area. `scripts/test-snap-bbox.mjs` covers it.

**3. `lib/map/rpc-fanout.ts` -- a concurrency cap plus a bounded retry.**
`RPC_CONCURRENCY = 4` in `vendor-map.tsx` caps one visitor's peak connection
demand so many more visitors fit under the same ceiling; `mapWithConcurrency`
preserves **input order**, because callers index results against
`ALL_VENDOR_TYPES`. `withRpcRetry` re-tries a transient failure (502/503/504,
429, any 5xx, or a network drop at status 0) with exponential backoff **plus
jitter**, so a page's dozen calls do not all retry on the same beat.

The retry is **bounded on purpose**: retrying hard during an overload deepens
it. This smooths a brief blip. Sustained saturation is what the cap -- and
eventually a bigger DB -- are for.

**A deterministic 4xx is never retried**, most importantly a 404 for a function
a migration has not added yet (`PGRST202`). It returns the same thing on a
second call, and the map's graceful fallbacks want to see it promptly rather
than after two backoffs. `scripts/test-rpc-fanout.mjs` covers the classifier.

## Tuning and trade-offs

- `RPC_CONCURRENCY` is the knob: **lower is gentler on the DB, higher fills the
  map in fewer waves.**
- Raising `s-maxage` buys more protection and more staleness. 60s was chosen
  because a newly seeded vendor appearing within a minute is fine.
- The **prefetch-at-mount** behavior is unaffected and still applies: the query
  fires before MapLibre is downloaded, using a bbox computed from center/zoom/
  container size. See `docs/notes/explore-map.md`, "Explore's fetch does not wait
  for the map."
