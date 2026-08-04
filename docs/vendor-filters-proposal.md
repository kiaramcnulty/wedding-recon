# Vendor filter system — Phase 1: what to filter on, and how much data we actually have

Status: **proposal, awaiting sign-off.** Covers step (1) only — the filter inventory and
coverage estimates. Tagging pipeline and UI follow once this is agreed.

Measured against the live DB on 2026-08-01: **2,163 vendors / 3,109 recon entries**, all
`status=active`, 26 distinct authors (bot roster).

---

## How to read the coverage numbers

Every filter below has two numbers, and the gap between them is the whole point.

| | meaning |
|---|---|
| **Now** | Vendors whose **existing recon text** already contains the answer, measured by regex. **This is a floor, not the truth.** |
| **Ceiling** | What we'd reach if `/launchvendors` + `/enrichvendors` explicitly hunted the field. Judgment call, anchored on what's already sitting in the raw dossiers. |

**Why "Now" is a floor — worked example.** My first pass scored venue capacity at
**16%**. That was the regex being too strict, not the data being thin. Loosening it to
count `seats 160`, `capacity chart maxes at 220 rounds`, `capped at 75 guests` and
similar took the same corpus to **46%**, with a sane distribution (median 150, p25 98,
p75 220, p90 350). Same text, 3× the yield.

So: treat "Now" as the pessimistic bound. A real backfill should use an **LLM extraction
pass** over recon + archived dossiers, not regex — it will beat every "Now" figure here,
probably by 10–20 points on the prose-heavy fields.

**Why "Ceiling" is credible.** The raw dossiers already carry more structure than the
recon prose preserved. Pikes Peak Ranch's dossier contains `Ceremony Seating (Up to 145
guests)`, a four-tier price table ($4,500 / $3,500 / $2,000 / $1,200), *and* a structured
aggregator line:

```
[eventective-coloradosprings] Pikes Peak Ranch | $1,000-$10,500/wedding | 145 | Banquet/event hall
```

That's `name | price range | capacity | category` — already machine-readable. The recon
entry rendered it as prose and dropped the fields. Same for music (`7-piece`,
`open-format`), planners (explicit service tiers), photographers (style + starting price).
**We are discarding structure we already paid to collect.**

---

## The one constraint that shapes everything

**Nothing except a handful of booleans clears ~85% coverage.** Best-covered real
attributes: planner service tier 84%, hotel block language 84%, photographer style 72%,
venue setting 65%, music genre 64%.

Median filterable attribute sits at **30–50%**.

Consequence for the UI phase: **hard filters would hide most of the directory.** Select
"capacity 150+" as an exclusive filter and 54% of venues vanish — not because they're too
small, but because nobody wrote the number down. Default behavior should be rank/dim, not
exclude, with an explicit "unknown" affordance. Flagging now because it determines which
filters are even worth building.

---

## Cross-cutting filters (all vendor types)

| Filter | Now | Ceiling | Notes |
|---|---|---|---|
| **Publishes pricing publicly** (bool) | **~100%** | ~100% | **Sleeper pick — build this first.** Derivable today with near-perfect accuracy: 67–100% of entries per type already say "Quote only" / "no published rates" / "contact for pricing" in so many words. Directly answers the loudest complaint in wedding planning, and no competitor filters on it. |
| Price band | 30–55% | ~65% | Per type below. Semantics differ (total vs per-person vs per-piece) — must not share one slider. |
| Service area / travels to you | **100% fill** | ~100% | `service_region` is a **required field** for photos/food/flowers/beauty/dj/band/planner (100% populated). Free text today (`"Denver + statewide Colorado travel"`) so it needs normalizing to a radius/region set — but the raw signal is already there on every row. Null by design for venue/dress/hotel (fixed locations). |
| Google rating + review count | ~0% stored | ~95% | **Not currently a DB column** — needs a migration. Harvest already pulls it (`google 4.8★ × 351`). Cheap, high-coverage, high-trust. |
| Has photos | exact | exact | Already known from `recon_media` + `google_photos`. |
| Has firsthand/Reddit-sourced intel | exact | exact | 10–76% carry a Reddit citation (hotel 76%, band 36%, dj 34%). A "real couples have vouched for this" badge is computable today. |
| LGBTQ+ inclusive | 0–4% | ~60% | Real search need, near-zero capture because nothing asks for it. Photographers surface it most (2%) and even then only when the vendor has a dedicated page. **Worth adding to the research cards explicitly.** |
| Accessibility (step-free, ADA) | ~0% | ~50% | Same story. Surfaced only as complaints today (a hotel dossier flags "three levels connected only by stairs"). Genuine unmet need. |

---

## Venue (679 vendors, 649 with recon)

| Filter | Now | Ceiling | Tier | Notes |
|---|---|---|---|---|
| **Capacity** (slider) | **46%** | ~85% | **A** | Median 150, p75 220, p90 350. Aggregator digests carry it as a clean integer. Venues nearly always publish it — this is a harvest gap, not a data gap. |
| **Setting / vibe** (multi) | **65%** | ~95% | **A** | mountain 37 · barn/rustic 18 · historic 14 · urban/industrial 12 · garden 6 · winery 2. Nearly always inferable from name + site + Google summary. Highest-value discovery filter for the map. |
| **Publishes pricing** | ~100% | ~100% | **A** | 67% explicitly quote-gated. |
| Price band (total) | 37% | ~70% | **A** | Median entry point $2,250. Two aggregators (eventective, weddingspot) publish ranges. |
| Indoor / outdoor / both | 45% | ~90% | **B** | Almost always determinable; just never asked for. |
| **Catering policy** (in-house / outside allowed / approved list) | **~5%** | ~75% | **B** | **Biggest value-per-point-of-coverage gap in the corpus.** The venue type card already calls catering policy the thing couples most want — and we capture almost none of it. 26% of entries mention catering at all; only ~5% state the *policy*. |
| On-site lodging / getting-ready suite | 15% | ~80% | **B** | Matters disproportionately for CO mountain + destination weddings. |
| All-inclusive package | 8% | ~65% | **B** | |
| BYO alcohol | 2% | ~55% | **B** | High user value, near-zero capture. |
| Rentals included (tables/chairs/linens) | 4% | ~60% | C | |
| F&B minimum | 11% | ~50% | C | Often conflated with deposits in current text. |

---

## Photographer (274 / 231)

| Filter | Now | Ceiling | Tier | Notes |
|---|---|---|---|---|
| **Style** (multi: documentary, editorial, fine-art, film, light-and-airy, moody, classic) | **72%** | ~90% | **A** | Best-covered discovery axis for this type. Launch digests already carry style words verbatim. |
| **Elopement / micro-wedding specialist** | **52%** | ~85% | **A** | Unusually strong signal — a real CO segment. |
| Price band | 51% | ~70% | **A** | Median entry $2,000. |
| Travels / destination | 39% | ~85% | **A** | Plus 100% `service_region` fill. |
| Engagement session included | 28% | ~60% | B | |
| Album included | 18% | ~55% | B | |
| Second shooter | 15% | ~55% | B | |
| Shoots film / hybrid | 10% | ~55% | B | Niche but a genuine dealbreaker filter for the couples who want it. |
| **Turnaround time** | **5%** | ~50% | B | Commonly published in FAQs; we just never look. Frequently-asked question. |
| Hours of coverage | 6% | ~45% | C | Too package-dependent to filter cleanly. |

---

## Hair & makeup (183 / 151)

| Filter | Now | Ceiling | Tier | Notes |
|---|---|---|---|---|
| **On-location vs in-studio** | **52%** | ~90% | **A** | Your "travels to you" instinct is right, and it's the single most important filter for this type — it's a hard logistics constraint on the wedding morning. On-location 26% / in-studio 7% explicitly, 52% determinable. Plus 100% `service_region` fill. |
| **Hair + makeup vs one only** | **42%** | ~85% | **A** | The joint-type decision makes this necessary — the category deliberately mixes both-service and single-service artists, so users need to split them back out. |
| Trial offered / trial fee | 48% | ~80% | **A** | Already well captured. |
| Price band (bride) | 18% | ~60% | B | Median $375. Rate cards exist but often as images. |
| Per-bridesmaid / party rate | 14% | ~55% | B | |
| Airbrush | 10% | ~50% | B | |
| **Textured / Black hair specialist** | **6%** | ~40% | **B** | Low coverage, high value. One entry captures it well ("denver isn't an easy place to find good black hair care and this is where she finally found it"). Chronically under-served search — worth an explicit research prompt even at modest ceiling. |
| Early-start capability | 5% | ~40% | C | |

---

## Music — DJ (77 / 77) and Live music (119 / 106)

Filters should be **shared across both types** but weighted differently.

| Filter | Now | Ceiling | Tier | Notes |
|---|---|---|---|---|
| **Genre** (multi) | **64%** | ~90% | **A** | Your genre instinct confirmed. Band: rock/cover 32 · classical/strings 25 · country/bluegrass 11 · jazz 8. DJ genre coverage is much weaker (rock 4%, jazz 0%) because DJs market as open-format — **use "open format" as an explicit value** rather than forcing DJs into genres. |
| **Ensemble size / instrument** (solo, duo, trio, quartet, N-piece) | **34% (band)** | ~85% | **A** | Band-only. Launch digests already carry `7-piece`, `Little Blu 3-4 piece`. A harpist vs a 9-piece funk band is a different purchase; this is the second real axis. |
| MC / emcee included | 44% (DJ) | ~80% | **A** | DJ-weighted. |
| Price band | 32% | ~60% | **A** | DJ median $1,295, band $1,000. |
| Lighting / production (uplighting, dance floor) | 26% (DJ) | ~70% | B | |
| Photo booth | 27% (DJ) | ~70% | B | Frequently bundled — good cross-sell filter. |
| Ceremony coverage (prelude/processional) | 5–8% | ~65% | B | Low capture, but it's how couples actually shop strings/harp. |

---

## Wedding planner (148 / 136)

| Filter | Now | Ceiling | Tier | Notes |
|---|---|---|---|---|
| **Service tier** (full / partial / month-of / day-of / a-la-carte) | **84%** | ~95% | **A** | **Best-covered attribute in the entire corpus.** Full 47% · month-or-day-of 51% · partial 24%. It's also exactly how couples shop planners. Ship this one first — near-zero backfill risk. |
| Price band | 44% | ~65% | **A** | Median $2,750. |
| Pricing model (flat fee vs % of budget) | 9% | ~50% | B | Meaningful distinction, poorly captured (% of budget: 1%). |
| Design / styling services | 9% | ~60% | B | |

---

## Caterer (182 / 152)

| Filter | Now | Ceiling | Tier | Notes |
|---|---|---|---|---|
| **Cuisine** (multi) | **56%** | ~90% | **A** | |
| **Service style** (buffet / plated / family / stations / food truck / drop-off) | **51%** | ~85% | **A** | buffet 26 · plated 19 · family 9 · stations 9 · truck 10. |
| Dietary accommodation (vegan/GF/allergen) | 24% | ~70% | **A** | Rising expectation; cheap to capture. |
| Per-person price band | 11% | ~45% | B | Median $28pp. Genuinely hard — caterers quote by menu. Note only 13% of entries carry any per-person figure, so a `$/head` slider will be sparse. |
| Bar / beverage service | 11% | ~70% | B | Big gap — most caterers state this plainly on their site. |
| Tasting offered | 20% | ~55% | B | |
| Service/gratuity fee disclosed | 5% | ~40% | C | |

---

## Florist (183 / 170)

Weakest type overall — 84% quote-gated, the highest of any service vendor.

| Filter | Now | Ceiling | Tier | Notes |
|---|---|---|---|---|
| **Full-service vs a-la-carte** | **31%** | ~75% | **A** | full 22 / a-la-carte 9. The key structural split, and it maps to budget. |
| Delivery + setup / install | 58% | ~80% | **A** | Well captured already. |
| **Minimum spend** | **6%** | ~45% | **B** | The number couples most need (it's the actual gate on whether a florist will take the job) and we almost never have it. Worth targeting even at a 45% ceiling. |
| Ceremony structures (arch/arbor/chuppah) | 12% | ~55% | B | Often a rental line item. |
| Style (garden, modern, dried, native) | <5% | ~70% | B | Very low now; highly inferable from portfolio/site language. |
| Locally grown / seasonal | 3% | ~45% | C | |

---

## Bridal / dress (65 / 58)

Smallest type; percentages are noisy (each vendor ≈ 1.7 points).

| Filter | Now | Ceiling | Tier | Notes |
|---|---|---|---|---|
| **Designers carried** (multi) | **53%** | ~85% | **A** | How gown shopping actually works. Shops publish designer lists reliably. |
| **Size range / plus-size inclusive** | **28%** | ~60% | **A** | High-value, under-served, and a frequent explicit search. |
| Gown price band | 29% | ~65% | **A** | Median entry $899. |
| Sample sale / off-the-rack | 40% | ~65% | **A** | Strong signal already; matters for short timelines and budget. |
| In-house alterations | 33% | ~75% | B | Also disambiguates the alterations-shop false positives the launch card fights. |
| Appointment required vs walk-in | 24% | ~80% | B | Cheap to capture, practical. |
| Accessories / veils | 16% | ~55% | C | |
| Consignment / pre-owned | 0% | ~40% | C | Zero capture today. |

---

## Hotel blocks (253 / 217)

Structurally different: **100% quote-gated, 3% usable price.** A price filter is not
viable here and shouldn't be built — block rates are negotiated, never published.

| Filter | Now | Ceiling | Tier | Notes |
|---|---|---|---|---|
| **Block type** (courtesy vs guaranteed/attrition) | **84% mention / ~63% classifiable** | ~80% | **A** | The defining economic distinction for this type, and unusually well captured because the type card already demands block evidence. Courtesy = no financial risk to the couple; that's the filter people need. |
| Star rating / brand tier | ~0% stored | ~95% | **A** | From Google + chain name. Needs the rating column. |
| Parking (free/paid) | 29% | ~80% | **A** | |
| Breakfast included | 12% | ~75% | B | |
| Shuttle / transport | 8% | ~70% | B | Matters a lot for guest logistics; heavily under-captured. |
| Minimum rooms | 6% | ~45% | B | |
| Pet friendly | 3% | ~70% | C | |
| Block rate / discount | 2–3% | ~25% | **skip** | Not obtainable. Don't build. |

---

## Recommendations

**1. Build "Publishes pricing publicly" first.** ~100% coverage today, zero backfill
risk, real user pain, and no competitor offers it.

**2. Ship a Tier-A core of ~3 filters per type**, not a comprehensive set. The strongest
per type: venue → capacity + setting; photos → style + elopement; beauty → on-location +
both-services; music → genre + ensemble size; planner → service tier; food → cuisine +
service style; dress → designers + size range; hotel → block type; flowers →
full-service vs a-la-carte.

**3. Backfill with LLM extraction, not regex.** Run over existing recon **and** the
archived dossiers in `data/launchvendors/*/research` + `data/enrichvendors/*/drafts` —
the dossiers hold structure the recon prose discarded (the aggregator lines are already
`name | price | capacity | category`). Extract once, write vendor-level tags, keep
provenance + confidence per tag.

**4. Add the targeted fields to the research cards.** Highest value-per-effort, in order:
venue catering policy (~5% → ~75%), caterer bar service (11% → 70%), hotel shuttle +
breakfast, photographer turnaround, florist minimum spend, beauty textured-hair, and
LGBTQ+/accessibility across all types.

**5. Two schema items to decide now**, because they gate the rest: a `vendors.rating` /
`review_count` column (cheap, high coverage, currently thrown away at harvest), and
normalizing `service_region` from free text into something filterable (100% populated on
7 types — the most under-exploited field we already have).

**6. Design filters for absence.** At 30–50% median coverage, filtering must rank and dim
rather than exclude, with "unknown" visible and selectable. This is the main open UI
question for step (3).

---

## Method / caveats

- Coverage measured at **vendor** level (any of a vendor's entries containing the signal
  counts), since filters are vendor-level. Denominators are **vendors of that type with
  ≥1 recon entry** — noted per section.
- Regex over `price_text + price_details + notes + service_region`. Systematically
  **undercounts** prose-expressed facts; see the 16%→46% capacity case.
- Price extraction distinguishes per-person / hourly / nightly from totals by local
  context, and bounds plausible values (totals $300–$100k, per-person $5–$1,000). 7 venue
  capacity extractions exceeded 1,000 guests and are likely false positives.
- "Ceiling" figures are **my judgment**, not measurements — anchored on what appears in
  the raw dossiers, but they should be treated as targets to validate on the first
  enrich run that adopts them, not as promises.
