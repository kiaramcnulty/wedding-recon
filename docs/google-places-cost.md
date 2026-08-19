# Where the Google Places money goes

Written after a $76 Google Cloud bill in July 2026 — a month whose "expected spend"
per `SETUP.md` was ~$0. Both numbers were right about different things: `SETUP.md`
was costing the *app*, and the app really is nearly free. The bill is the
`/launchvendors` + `/enrichvendors` pipelines, which did not exist when that line
was written.

Figures below are reconciled against the actual July invoice, not estimated.

Two things to internalize:

1. **Google retired the universal $200/month Maps credit in March 2025.** There is
   no longer a cushion that quietly absorbs a few thousand calls. Each SKU now has
   its own small free monthly allowance — **1,000 calls** at the Enterprise tiers
   these pipelines live on — and bills from the first call past it.
2. **Seeding a vendor type is a capital expense, not a running cost**, and its price
   depends on what else ran that month. One type-launch fits inside the free
   allowance and costs **$0**; each additional type in the same month costs about
   **$29**. Steady-state app traffic is genuinely free — measurably, not roughly.

## The SKUs we actually touch

Prices are per 1,000 calls (US, 2026). The free allowance is **per SKU, per month,
and does not roll over**. A call is billed at the **highest tier any field in its
mask belongs to** — one Enterprise field upgrades the entire call.

| SKU | Price | Free/mo | Where we hit it |
| --- | --- | --- | --- |
| Text Search Enterprise | $35 | 1,000 | `placesSearch()` — sweep, resolve, upload, centroid |
| Place Details Enterprise | $20 | 1,000 | `websiteWithFallback()` (`websiteUri`) |
| Place Details Enterprise + Atmosphere | $25 | 1,000 | `wedcheck` (`reviews`), enrich `harvest` |
| Place Details Essentials | $5 | 10,000 | `lib/google-photos.ts` (`id,photos`) |
| Place Photos | $7 | 1,000 | `/api/vendor-photo` media fetch |
| Autocomplete Requests | $2.83 | 10,000 | `/api/places?q=` |

Two consequences worth noting, because neither is obvious from reading the code:

- `placesSearch()`'s field mask includes `places.websiteUri`, which is an
  **Enterprise** field. Every sweep call therefore bills at Text Search
  **Enterprise** ($35/1k, 1,000 free), not Pro ($32/1k, 5,000 free). **Keep it
  anyway** — one search call returns up to 20 places, so carrying `websiteUri`
  in the sweep costs +$3/1,000 *calls* versus +$20/1,000 *places* to fetch it
  one at a time. The tier upgrade is the cheap side of that trade.
- `reviews` is **Enterprise + Atmosphere**, the most expensive Place Details tier.
  Both `wedcheck` and the enrich `harvest` live there.

## The actual July 2026 bill

Five type build-outs (dress, planner, hair & makeup, hotel blocks, DJ/band split),
grouped by SKU:

| SKU | Calls | Free | Billed | Cost |
| --- | ---: | ---: | ---: | ---: |
| Place Details Enterprise + Atmosphere | 2,970 | 1,000 | 1,970 | **$49.25** |
| Text Search Enterprise | 1,652 | 1,000 | 652 | **$22.82** |
| Place Details Enterprise | 249 | 1,000 | 0 | $0.00 |
| Place Details Photos | 485 | 5,000 | 0 | $0.00 |
| Place Details Essentials (IDs only) | 273 | 10,000 | 0 | $0.00 |
| Text Search Pro | 196 | 5,000 | 0 | $0.00 |
| Autocomplete Requests | 10 | 10,000 | 0 | $0.00 |
| | | | | **$72.07** |

Three things this settles:

**Two SKUs are the entire bill**, and `reviews` alone is 68% of it. Everything else
sits inside its free allowance with room to spare.

**The app costs exactly nothing.** 485 photo fetches, 273 photo-reference lookups, 10
autocomplete calls — all free. The `/api/vendor-photo` caching works. Add Recon search
is barely used. No app-side change is warranted, now or at 10x the traffic.

**The website fallback is vindicated.** `websiteWithFallback` fired 249 times all month
and cost $0, while the reviews call it helps avoid fired 2,970 times at $25/1k. Deferring
it out of `scout` — the fix this document originally proposed — would have traded a free
call for a paid one. Leave it alone.

(A stray 196 Text Search calls billed at **Pro**, not Enterprise, despite our mask always
requesting `websiteUri`. Best guess: zero-result searches, which return no billable
Enterprise field — roughly 11% of all searches, consistent with `resolve` probing names
that do not exist. Unconfirmed, and free either way.)

## August 2026 — the bill flipped to app photo traffic

A ~$30 month with almost no pipeline activity. Grouped by SKU in the Cloud console
(**Billing -> Reports -> Group by SKU**), the whole bill was one line:

| SKU | Usage | Cost |
| --- | ---: | ---: |
| Place Details Photos (`/api/vendor-photo` bytes) | 5,291 | **$30.04** |
| Place Details Essentials (`id,photos` ref lookup) | 1,451 | $0.00 |
| every pipeline SKU (Text Search Enterprise, reviews, websiteUri) | <100 each | $0.00 |

Two number corrections fell out of it:

- **Place Photos gets ~1,000 free/month, not ~5,000.** $30.04 / ($7/1k) = 4,291
  billed, and 5,291 - 4,291 = 1,000 free. The SKU table above is fixed. This SKU
  crosses into billing far sooner than the July note assumed.
- **The app is not free once real traffic arrives.** July billed app traffic at
  $0 only because volume sat under that (smaller-than-thought) free tier. With a
  few hundred visitors it does not: ~1,451 distinct vendors had their photos
  resolved this month (Essentials is row-cached 30 days, so it counts distinct
  vendors, not views), and the strip fetched up to 3 Google photos per vendor page
  at a different width from the card — so cost scaled with catalog breadth x photos
  x widths.

The CDN cache was working (5,291 fetches is only ~3.6x the 1,451 distinct vendors —
far too low for broken caching with repeat views). The cost was **structural**: you
pay Google roughly once per (vendor, photo, width) per 30 days, against a 1,000 free
tier. Four mitigations shipped (see the per-surface `?w=` note in CLAUDE.md):

1. **Cards prefer the free recon thumbnail**, Google only as a fallback
   (`vendor-preview-card.tsx`) — a card for a vendor with any recon photo now costs
   nothing.
2. **Strip Google photos capped 3 -> 2** (`MAX_PHOTOS`, `lib/google-photos.ts`),
   sliced on read so already-cached rows drop the third immediately.
3. **Strip tiles are `loading="lazy"`** (`photo-lightbox.tsx`) — off-screen Google
   tiles are not fetched on load, and recon photos lead the strip, so on a vendor
   with recon photos the Google tiles usually never fetch at all.
4. **Card and strip share one width** (`600`), so a vendor's `i=0` photo is billed
   once across both surfaces instead of separately at `300` and `600`.

Next levers if it recurs (a scraper, or growth past what the four above absorb): a
**first-party gate** on `/api/vendor-photo` (require `Sec-Fetch-Site: same-origin`
so the endpoint cannot be hotlinked or scraped directly), and a **separate,
quota-capped app API key** so app surfaces physically cannot reach the Enterprise
pipeline SKUs. Neither was needed once the fetch count came down.

## The scheduling lever

Per type-launch, from the actuals above: ~594 Enterprise+Atmosphere, ~370 Text Search,
~50 Details Enterprise. Every one of those is **under the 1,000-call free allowance**.

> **One vendor type per calendar month costs $0. The July bill is almost entirely the
> consequence of batching five into one month.**

At full price — i.e. once the month's free tier is gone — a type costs about **$29**. So
the cost of a type-launch is not fixed: it is $0 for the first one in a month and ~$29 for
each one after. Spreading a multi-type build-out across months is the single largest lever
available, and it costs nothing but patience.

If several types genuinely have to ship together, budget ~$29 each beyond the first and
run them at the start of a month so a re-run lands in the same free window.

## What was done about it

**The on-disk response cache** (`initPlacesCache()` in `launchvendors/scripts/lib.mjs`)
memoizes every Text Search and Place Details response in `<workdir>/places-cache.jsonl`,
keyed by exactly what was asked for (query + pageToken, or place_id + field mask). It is
append-only, so an interrupted run banks what it learned, and it carries the same 30-day
TTL as the `google_photos` cache in `lib/google-photos.ts`. Only successful responses are
cached — an error has to be retried, not memoized.

This is the big one, because it targets the *repeat* runs rather than the first: re-sweeping
after widening the anchors, re-resolving after a paste, re-running wedcheck after a profile
tweak. All of it is now free. `PLACES_CACHE=off` disables it.

**Persistent city centroids** (`launchvendors/centroids.json`, committed). A town's centre
does not move, and the same anchors recur across every vendor type and every re-run, so
paying a $35/1k Enterprise search to re-learn where Boulder is — once per type, per run —
was pure waste. Resolved once, reused forever, reviewable in a diff. It self-populates;
no new API and no console setup needed.

**Harvest is resumable** (`enrichvendors/scripts/harvest.mjs`). Its Places call carries
`reviews`, so it bills at the priciest SKU we touch, once per vendor. It had no resume, so
re-running it to pick up newly-seeded vendors, a widened subpage regex, or a crashed run
re-paid for the entire region. A vendor whose `harvest.json` already holds a clean Google
block is now skipped; one whose block carries an `err` still retries, since a *failed*
$25/1k call is worth repeating and a successful one is not. `--refresh` forces.

**Every run reports its own spend.** `placesSpendReport()` tallies calls by SKU, prices
them, and prints the total plus what the cache saved. Cost stops being invisible until the
invoice arrives:

```
places: $4.31 across 187 billed calls
  Text Search Enterprise                    98 calls  $3.43
  Place Details Enterprise                  44 calls  $0.88
  (cache hits)                             213 calls  $6.12 saved
```

Counted, not invoiced — the per-SKU free allowance is consumed across every run in the
calendar month, so read these as the marginal cost of this run once the month's free tier
is gone.

## What was deliberately NOT changed

**`websiteWithFallback` stays in `scout`.** The first pass of this analysis proposed
deferring it to `backfill-websites.mjs` so it only ran over rows that survive pruning.
That is wrong, and the reason is worth recording: `wedcheck` crawls `v.website` for free
before it falls back to the paid reviews call. Removing the website from the sweep would
push those rows onto Enterprise+Atmosphere ($25/1k) instead of Enterprise ($20/1k) — more
expensive, *and* the website is lost. The fallback pays for itself.

**The sweep field mask keeps `places.websiteUri`**, for the reason in the table note above.

**`wedcheck` is already well-tuned.** The free same-host subpage probe runs before the paid
reviews call specifically so a hit avoids it.

## Adjacent cost surfaces (checked 2026-08, all clear)

Raised alongside the Places audit, measured, and found fine. Recorded so they do not
get re-litigated from guesswork — the storage number in particular was predicted to be
near its limit and was not close.

**Supabase (Free Plan)** — storage **0.245 / 1 GB**, database **0.046 / 0.5 GB**, egress
**0.036 / 5 GB** per cycle at 2 MAU. Photo uploads from the enrich pass cost about
**0.027 GB per type-launch**, so Denver's nine types account for the whole 0.245 GB and
there is room for roughly three more metros of that size before storage is the binding
constraint. Note the Free Plan does **not** bill overages — exceeding a quota restricts
the project rather than charging for it, so the failure mode is an outage, not a bill.

The two limits move for different reasons, which is what to watch:

- **Storage grows with vendors** (~0.027 GB per type-launch) and is the slow one.
- **Egress grows with users** — ~18 MB per active user per cycle, implying a ceiling
  around 275 MAU. That is the first Supabase limit real traffic would reach, well
  before storage. If it ever gets close, the lever is the vendor-page carousel, which
  serves full-size 1600px images where `recon-card` already uses thumbnails.
  `Cached Egress` currently reads 0 GB, so nothing is being served from Supabase's CDN
  yet either — worth revisiting only if egress becomes the constraint.

This view was filtered to a single project; Supabase bills and quotas at the
**organization** level, so re-check with the project filter on *All Projects* before
treating these as the true quota position.

**Anthropic Batch API** — already self-limiting: `draft.mjs` estimates before submitting,
gates on `--max-cost` (default $12), and `collect` prints actuals. ~$1–1.50 per 300-vendor
run. No action.

**Vercel (Hobby)** — 100 GB/month bandwidth; `/api/vendor-photo` bytes count against it on
a CDN miss. Scales with traffic, not vendor count, and traffic is currently ~2 MAU.

**OpenFreeMap tiles** — free, no key, no quota, no exposure.

## Still worth doing by hand

**Set a budget alert and per-SKU quota caps in the Cloud console** — see
`SETUP.md` §3. Quotas are the only true stop; a runaway loop spends faster than a budget
alert can notify, because alerts are evaluated on a delay and never block a request.
