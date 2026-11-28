# Vendor filter coverage — measured, whole corpus

Companion to `vendor-filters-proposal.md`. That document proposed the filters and
estimated coverage by regex; **this one supersedes its numbers.** Dataset:
`data/filter-extraction/vendor-filters.jsonl`, one row per vendor, 2,163 rows.

Extracted 2026-08-04 with `claude-sonnet-5` over each vendor's recon entries, research
dossier, raw crawled site text (25KB/vendor, ranked), PDF rate-card text, launch-phase
research intel, and Reddit passages matched to that vendor. 191 batch calls, zero failures,
~$31.50.

## Coverage

`±` is the 95% confidence interval, so small types carry real uncertainty (dress n=65 is
±12 while venue n=679 is ±4).

| type | n | attribute | coverage |
|---|---|---|---|
| beauty | 183 | services | **98%** ±2 |
| | | work_mode (on-location / in-studio) | **90%** ±4 |
| | | trial_policy | 44% ±7 |
| | | bride_price_min | 43% ±7 |
| | | party_price_min | 31% ±7 |
| planner | 148 | service_tier | **86%** ±6 |
| | | pricing_model | 57% ±8 |
| | | price_min | 49% ±8 |
| food | 182 | cuisine | **80%** ±6 |
| | | service_style | 68% ±7 |
| | | dietary | 53% ±7 |
| | | price_min (per person) | 31% ±7 |
| | | bar_service | 22% ±6 |
| | | offers_tasting | 22% ±6 |
| venue | 679 | setting | **75%** ±3 |
| | | ceremony_location | 62% ±4 |
| | | capacity_max | 58% ±4 |
| | | catering_policy | 47% ±4 |
| | | price_min | 44% ±4 |
| | | has_lodging | 41% ±4 |
| flowers | 183 | engagement_model | **73%** ±6 |
| | | delivers_installs | 43% ±7 |
| | | style | 38% ±7 |
| | | minimum_spend | 15% ±5 |
| photos | 273 | style | **67%** ±6 |
| | | does_elopements | 58% ±6 |
| | | price_min | 57% ±6 |
| | | travels_destination | 53% ±6 |
| | | turnaround_weeks | 31% ±5 |
| | | includes_engagement | 28% ±5 |
| | | shoots_film | 16% ±4 |
| dress | 65 | off_the_rack | **66%** ±12 |
| | | price_min | 63% ±12 |
| | | sample_sale | 20% ±10 |
| hotel | 253 | block_type | **63%** ±6 |
| | | breakfast_included | 61% ±6 |
| | | parking | 37% ±6 |
| | | has_shuttle | 14% ±4 |
| dj | 91 | specialty (2026-11-28 pass, below) | **70%** ±9 |
| dj | 77 | includes_mc | **58%** ±11 |
| | | production | 49% ±11 |
| | | has_photobooth | 38% ±11 |
| | | price_min | 36% ±11 |
| band | 119 | genre | **57%** ±9 |
| | | plays_ceremony | 47% ±9 |
| | | ensemble | 43% ±9 |
| | | price_min | 29% ±8 |

## Two kinds of missing data (Kiara, 2026-08-04)

Low coverage does not mean "drop the filter", and the reason differs by attribute. This
distinction drives the UI:

- **Unknown is genuinely unknown** — capacity, price, catering policy. The vendor may well
  have the thing; nobody wrote it down. These filters must rank and dim rather than
  exclude, and surface an explicit second tier.
- **Unknown ≈ absent** — hotel shuttle (14%), film photography (16%), sample sales (20%),
  bar service (22%), tastings (22%). These are genuine rarities: a hotel that ran a shuttle
  would say so. Here the *minority who do* is exactly what a couple wants to filter for, so
  they behave as positive filters and need no second tier. **Keep every one of them.**

## Price is multi-valued and multi-basis — do not flatten it

733 vendors have a price. Across all types the basis splits **package 629 / per-person 47 /
per-gown 40 / per-hour 13 / per-night 1**, and venues alone are **273 package / 13
per-person / 10 per-hour**. A single slider over those is meaningless; each type filters
its dominant basis and off-basis vendors keep their own unit.

Other fields the UI must respect:

- `price_kind`: **range 221 / starting_at 51 / single_figure 25** (venues). Because most are
  ranges, matching is range-overlap, not "start price inside the band".
- `price_confidence`: **published 177 / listing 106 / inferred 14** (venues). Roughly 40% is
  aggregator- or review-sourced and should render as an estimate, not a quoted fact.
- `price_tiers`: **150 venues** carry season/day-of-week tiers. Enough to make date-aware
  venue pricing real — the same venue can be $1,500 on a winter Monday and $12,500 on a
  September Saturday, and showing only the floor actively misleads.

## Every price carries a verbatim quote

`price_quote` is required whenever a price is reported, and **0 of 733 rows are missing
it.** This is the defence against the failure that made regex unusable: of 10 venues where
regex found a price, 7 were wrong — a booking deposit ($3,000), an extra-hours add-on
($375), a cabin nightly rate ($502), a ski season pass ($799), a hotel room rate ($389),
and — worst, because no deposit rule would catch it — a *price delta*, from
"2027 runs about $500 higher across the board".

A model cannot justify `price_min: 500` from that sentence, so requiring the quote makes
the rule self-enforcing and every number auditable after the fact. See
`regex-price-extraction-is-unsafe` in the agent memory.

## Caveats

- Coverage reflects what could be **evidenced**, not what is true. A venue with no stated
  capacity is `null`, however large it looks.
- One vendor (Kiku Ishi Photography) returned no extraction row — its evidence was a
  396-character dossier and nothing else. An all-null row is recorded so the dataset covers
  every vendor; the `_note` field marks it.
- Small types have wide intervals. Treat dress (n=65), dj (n=77) and band (n=119) figures as
  directional.
- Chain- and region-level facts are labelled: `evidence_basis` is `property`, `chain` or
  `region`. Hotel `block_type` in particular leans on chain-level Reddit reports about
  Marriott/Hilton attrition norms, so most values are `basis: chain` — true and useful, but
  not property-confirmed.

## DJ specialty (pass of 2026-11-28)

Separate from the August extraction: a per-DJ judgement over all **91** live DJs, reading our
recon, the enrich dossiers, vendor-level Reddit, the August site crawl (45 DJs), and, for the
46 never crawled, the live site or one listing profile (WeddingWire, The Knot, SoundCloud).
Meta properties were not fetched. Every tag carries a verbatim quote and its source URL:
`data/filter-extraction/dj-style-pass-2026-11-28.json`.

**DJs do not sell by genre.** 48 of 91 explicitly market "open format"; nobody specializes in
pop or country; only 11 put any genre front and centre (9 of them EDM/house/rave, plus one
each Latin, South Asian, Jewish). Most genre evidence is a list on the site.

**Rules (Kiara, 2026-11-28).** `specialty` holds open format and every genre the DJ names,
from a list or a headline alike. **Open format is a specialty that never hides a DJ**
(`nonExcluding` on the filter def): an open-format DJ matches an Open format pick and is
partial under any genre it does not name. Every other value keeps the ordinary `multi` rule,
so a DJ whose named genres all miss the pick is hidden, and a DJ with no specialty is partial.

Merges into the 11 values: rave/festival/bass -> `edm_house`; funk/soul/Motown/disco/decades
-> `throwback`; bluegrass/folk -> `country`; a Spanish-speaking MC or Spanish-language
weddings -> `latin`. A name-only hint ("Basschicken") is never a tag. **64 of 91 DJs (70%)
carry a specialty.**

| pick | match | partial | hidden |
|---|---|---|---|
| Open format | 48 | 27 | 16 |
| Throwbacks | 19 | 60 | 12 |
| EDM & house | 17 | 65 | 9 |
| Pop & Top 40 | 12 | 67 | 12 |
| Hip-hop & R&B | 11 | 66 | 14 |
| Country | 11 | 67 | 13 |
| Latin | 9 | 68 | 14 |
| Rock | 7 | 72 | 12 |
| Jazz & lounge | 3 | 75 | 13 |
| South Asian | 3 | 73 | 15 |
| Jewish | 2 | 74 | 15 |

Partial = the 27 with no music evidence anywhere (sites that name no genre, three sites
blocked or down, two Facebook-only, five with no site) plus the open-format DJs that do not
name the pick. Seven DJs the research judged generalists name genres without ever saying
"open format" (Greatime, Pure Sounds, Encore, Sound Junction, Tidal Wave Dave, DJ Aeryk,
Raphael Batista), so they are hidden from genres they do not list. Six tags rest on a
search engine summary of a listing rather than a fetched page, and four EDM tags on one Reddit
comment or bot recon alone (DJ Laserfrog, Oro y Plata, Paul Andre, DJ Sparkafya); the dataset
marks the source of each.

Written by `scripts/backfill-dj-specialty.mjs` with `filters_meta.specialty.source =
'extraction'` plus the quote and URL. Most of these genres are not in any recon entry; the
reconciler does not retract a tag for silence (`daily-build-calls.mjs`, RETRACT), so they
survive it. Future regions get the tag from enrich (`references/music/type-rules.md`).
