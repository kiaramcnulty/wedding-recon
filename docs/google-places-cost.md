# Where the Google Places money goes

Written after a $76 Google Cloud bill in July 2026 — a month whose "expected spend"
per `SETUP.md` was ~$0. Both numbers were right about different things: `SETUP.md`
was costing the *app*, and the app really is nearly free. The bill is the
`/launchvendors` + `/enrichvendors` pipelines, which did not exist when that line
was written.

Two things to internalize:

1. **Google retired the universal $200/month Maps credit in March 2025.** There is
   no longer a cushion that quietly absorbs a few thousand calls. Each SKU now has
   its own small free monthly allowance and bills from the first call past it.
2. **Seeding a vendor type is a capital expense, not a running cost.** Launching +
   enriching one type over one metro costs roughly **$13–30**. Five new types in a
   month is the whole bill. Steady-state app traffic is a rounding error.

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
| Place Photos | $7 | ~5,000 | `/api/vendor-photo` media fetch |
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

## Cost of one type-launch over a metro

Assumes statewide query + region + ~10 anchors, ~300 rows surviving the sweep.

| Step | Calls | SKU | Cost |
| --- | --- | --- | --- |
| `scout` sweep | ~36 | Text Search Ent. | ~$1.25 |
| `scout` website fallback | ~100–240 | Details Ent. | $2–5 |
| `wedcheck` reviews | ~50–150 | Details Ent.+Atmos. | $1.25–3.75 |
| `resolve` per candidate | ~50–150 | Text Search Ent. | $2–5 |
| `upload` late-resolve + centroids | ~50–150 | Text Search Ent. | $2–5 |
| **Launch subtotal** | | | **$8–20** |
| `enrich` harvest (1/vendor) | ~200–400 | Details Ent.+Atmos. | $5–10 |
| **Per type, all-in** | | | **$13–30** |

July added dress, planner, hair & makeup, hotel blocks, and the DJ/band split —
five type build-outs. $65–150 expected; $76 observed. That is the bill.

App-side, for contrast: `/api/vendor-photo` is one Details Essentials + one Place
Photos call per vendor per 30 days on first view (CDN-cached after), and
autocomplete is debounced and sits inside a 10,000-call free tier. Even browsing
every seeded vendor in a month is single-digit dollars.

## Confirming against the real bill

The estimates above are derived from the code, not from billing data. To check:
**Billing → Reports → Group by: SKU**, filtered to the Maps Platform project. The
prediction is that Text Search Enterprise and the two Enterprise Details SKUs
dominate, and that Photos/Autocomplete/Essentials are negligible.

## Reducing it

Ranked by savings per unit of effort.

1. **Set a budget alert and per-SKU quota caps** (console, no code). Quotas are the
   only real stop — a runaway loop in a pipeline script can spend faster than a
   budget alert can notify. Cap the three Enterprise SKUs near expected run volume.
2. **Cache Places responses to disk per workdir.** These pipelines get re-run
   constantly during development, and every re-run re-pays in full. A `place_id →
   response` JSON cache in the workdir would make iteration free. Biggest practical
   saver, because it targets repeated runs rather than the first one.
3. **Stop geocoding city centroids through Text Search.** `centroidLookup()` spends
   a $35/1k Enterprise search to turn "Boulder, CO" into a lat/lng. A static table
   of anchor-city coordinates costs nothing and never drifts; the Geocoding API
   ($5/1k, 10k free) is the fallback if a table is too rigid.
4. **Defer `websiteWithFallback` out of `scout`.** It spends an Enterprise Details
   call per swept row for a nice-to-have field — including for the many rows that
   `wedcheck`, the name guards, and `adjudicate` later prune. `backfill-websites.mjs`
   already does this job standalone; running it *after* pruning, over survivors only,
   should roughly halve launch-side Details spend.

`wedcheck` is already well-tuned — the free same-host subpage probe runs before the
paid reviews call specifically so a hit avoids it. No change needed there.
