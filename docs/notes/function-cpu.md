# Function CPU on Vercel (the Hobby "Fluid Active CPU" allowance)

As-built, 2026-11-14. Vercel emailed that the `wedding-recon` team had used
**90% of the Hobby plan's 4 CPU-hours** of Fluid Active CPU. Past 100%, Hobby
**pauses every deployment** (visitors get `503 DEPLOYMENT_PAUSED`), and Vercel's
docs say a paused Hobby team does not reliably resume on its own. So this is an
availability limit, not a billing one.

## What is billed, and what is free

- **Active CPU** is CPU time while our code runs. Time spent awaiting I/O (a
  Supabase query, a Google fetch) is *not* billed as CPU (it is billed as
  Provisioned Memory, a separate and much larger allowance).
- **The proxy (`proxy.ts`, Next 16's middleware) is billed the same way.** It
  runs on the Node runtime as a Fluid function, so every request it matches is
  an invocation.
- **CDN hits cost no function CPU.** Static/prerendered pages and their
  prefetch segments, cached route-handler responses, and the PostHog `/ingest`
  rewrite (an external rewrite the CDN proxies) are all free *unless the proxy
  matches them first*.
- **The CDN cache is keyed per deployment**, and segmented by region. Every
  deploy starts the map, photo and every other cached response over from cold.

## What one visit actually cost (measured, before)

`next start` on a production build, CPU read from the server process tree
around N sequential requests (`ps` user+sys, so network wait is excluded --
the same quantity Vercel bills, on faster hardware). Local Apple silicon, so
treat absolute numbers as a floor and the ratios as the finding.

| Request | CPU / request |
|---|---|
| Vendor page, full SSR | ~37 ms |
| Vendor page, client navigation (RSC) | ~21 ms |
| **Vendor page prefetch** (loading boundary) | **~11.5 ms** -- runs `generateMetadata`, a DB read |
| Vendor page prefetch, route tree | ~1.5 ms |
| `/api/map/vendors`, cache miss | ~9-10 ms (~5 ms of it fixed, even for an empty box) |
| `/api/vendor-search` | ~12.5 ms |
| Static page or segment **through the proxy** | ~1.5-3.5 ms, and a separate invocation |
| Static file with the proxy excluded | ~1 ms locally; on Vercel, a CDN hit (0) |

And what a browser sends (anonymous, mobile viewport, real browser against the
local build):

- **Explore, first load: 39 server requests.** 13 `/api/map/vendors` (one per
  vendor type, including the hidden legacy `music`, at a Colorado-wide box), 22
  `<Link>` prefetch requests (Next 16 prefetches per segment, so one link is
  2-5 requests: `/`, `/add`, `/login`, `/explore`, `/hub`, `/portal` from the
  bottom nav and profile menu), and 4 `/ingest` calls. **27 of the 39 ran the
  proxy**, and for an anonymous visitor every one of those 27 was a no-op.
- **Scrolling the Explore list: ~2 vendor prefetch requests per card scrolled
  past** (21 for ~10 cards), each dynamic one a ~11.5 ms server render. A
  couple browsing 40 cards cost more CPU than ten vendor page views.
- PostHog batches events, but every flush is another `/ingest` request, and
  impression tracking (PR #78) adds flushes.

So per visit, most of the CPU was **request amplification**, not pages people
read: no-op proxy runs, the map fan-out missing its 60-second cache, and
prefetches for cards nobody stopped on. (This is from per-request cost times
per-visit request counts. The real per-route split is in the Vercel dashboard,
and was not available when this was written; crawler renders of vendor pages
are the one large line this cannot see.)

## What changed

1. **The proxy runs only where it does something** (`proxy.ts`, commented in
   full there). For every visitor: `/` (first-visit gate, except `/?ref=app`,
   which the gate always renders and every app page prefetches) and
   `/vendor/<uuid>` (the legacy 308). Everything else only when the request carries the
   Supabase auth cookie, via a matcher `has` condition. An anonymous visitor
   or crawler no longer invokes it at all; a signed-in one gets the session
   refresh exactly as before. `ingest/`, `robots.txt`, `sitemap.xml` and
   `api/health` are excluded even for signed-in visitors.
   - The matcher must name the cookie as a literal, so the name is pinned in
     `lib/supabase/auth-cookie.ts` (identical to @supabase/ssr's default for
     this project, so no session changed) and passed as `cookieOptions.name`
     by all three cookie-bound clients. A chunked session is `<name>.0`, so the
     matcher checks both.
   - `scripts/test-proxy-matcher.mjs` compiles the matcher with Next's own
     `getMiddlewareMatchers` and pins both directions, the cookie literals, and
     the outage-critical API exclusions.
   - Every response the proxy produced carries `x-wr-proxy: 1`, so production
     behavior is checkable from outside (below).
2. **The map route is CDN-cached for an hour**, not 60 s
   (`s-maxage=3600, stale-while-revalidate=3600`, so nobody sees rows older
   than ~2 hours; the stale window was briefly a day, cut because after a
   quiet stretch the first visitor got day-old rows). The map's URLs are snapped
   to a shared grid and the default view is one Colorado-wide box, so almost
   every Explore visitor asks for the same 13 URLs; at 60 s, any two visitors
   more than a minute apart each paid for all 13. Cost: a new vendor, verification, or recon count
   can take up to an hour to reach the map (the vendor page is always live).
   - **The author is exempt**: a recon save, a recon edit and a portal listing
     save set a one-hour `wr_map_fresh` cookie (`lib/map/fresh-server.ts`),
     and while it lives that browser's map and guided-search requests add
     `&fresh=<token>` -- a separate CDN key, so they get current rows while
     everyone else shares the cached ones. The route ignores the parameter.
   - Verification has no browser to mark (the Stripe webhook is
     server-to-server), so instead every map response carries
     `Vercel-Cache-Tag: map-vendors`, and the writes that can change who is
     verified drop that tag (`purgeMapCache()` in `lib/map/purge.ts`,
     `dangerouslyDeleteByTag` from `@vercel/functions`): `mirrorSubscription()`
     when a vendor's status crosses `active` either way, a portal listing
     save, and an admin claim revoke. The next request for each map URL is
     rebuilt, so the badge shows on the vendor's next load. Kept off routine
     writes on purpose: each purge refills the map cache for everyone. Outside
     a Vercel function it does nothing, so local runs cannot exercise it.
4. **Commits that change nothing deployed do not deploy** (`vercel.json`
   `ignoreCommand` -> `scripts/vercel-ignore-build.sh`). Every deploy starts
   the CDN cache over, and this repo merges a lot of notes, pipeline scripts,
   migrations and skill files. The build is skipped only when EVERY file
   changed since the branch's last successful deployment is outside the app
   (the list is in the script); anything uncertain builds.
   `scripts/test-vercel-ignore-build.mjs` runs it against throwaway repos.
5. **Vendor cards prefetch on dwell or intent, not on scroll**
   (`lib/use-intent-prefetch.ts`, used by `VendorPreviewCard`, so the Explore
   feed, cluster sheet, pin peek, guided results and the Hub all move
   together). The Link's `prefetch` stays `false` until the card has been at
   least half on screen for 600 ms, or is touched, hovered or focused
   anywhere (photos included); then it flips to the default, which Next
   honors immediately for an on-screen link. The tap-feel contract in
   CLAUDE.md (a card's main control is a `<Link>` so `loading.tsx` is
   prefetched) still holds for every card someone stops on.

## Deliberately NOT done (yet), and why

- **Vendor page ISR.** The vendor page is the single most expensive request
  (~37 ms) and every crawler hit is a full render. Caching it means moving the
  viewer-specific parts (own entry first in `sortReconEntries`, "you already
  have recon", admin edit controls, the `from` back link) to the client so the
  server render reads no cookies, plus `revalidatePath` on every write. Worth
  doing -- `docs/seo-aeo-plan.md` item 9 wants it for crawl speed too -- but it
  is a refactor of the most important page, not a matcher change, so it was
  left for its own change with real per-route data to size it.
- **Collapsing the map's per-type fan-out into one request.** ~5 ms of each
  ~9 ms miss is fixed per-request overhead, so 13 requests -> 1 would roughly
  halve a miss. But the per-type split, concurrency cap and retry are the
  2026-08-14 outage fix (`docs/notes/map-serving.md`); with the hour-long cache
  most loads no longer miss at all, so the risk was not worth it now.
- **Blocking AI crawlers.** Vercel's AI Bots managed ruleset is free on Hobby
  and would cut crawler renders of vendor pages, but `docs/seo-aeo-plan.md`
  deliberately courts answer-engine bots. That is a product call, not a perf
  default; if crawler volume turns out to dominate, block the *training*
  crawlers (GPTBot, ClaudeBot, CCBot, Bytespider, meta-externalagent) and keep
  the search/answer ones.
- **The bottom nav's `/hub` prefetch and the profile menu's `/portal`.** Both
  dynamic, so each is an invocation per page view, but each costs ~2 ms
  anonymous; not worth bending the tap feel of the Hub tab for.

## Checking it in production

- Anonymous requests must NOT carry the marker; `/` must:

  ```bash
  curl -sI https://www.weddingrecon.com/explore | grep -i x-wr-proxy   # nothing
  curl -sI https://www.weddingrecon.com/ | grep -i x-wr-proxy          # x-wr-proxy: 1
  ```
- A request carrying the auth cookie (any value) must:

  ```bash
  curl -sI -H "Cookie: sb-pssxwffssopyomlzdtdo-auth-token=x" https://www.weddingrecon.com/explore | grep -i x-wr-proxy
  ```

  If this prints nothing, Vercel is not honoring the `has` condition and
  signed-in sessions are not being refreshed by the proxy: revert the matcher
  to the single unconditional entry (keeping the `ingest/` and other
  exclusions) until it is understood.
- A map response should come back `x-vercel-cache: HIT` on a second request
  to the same URL within the hour.
- The real breakdown lives in the Vercel dashboard: project -> Observability
  -> Functions (Hobby shows per-function totals; per-path breakdown needs
  Observability Plus), and the team Usage tab for the CPU-hours line.
