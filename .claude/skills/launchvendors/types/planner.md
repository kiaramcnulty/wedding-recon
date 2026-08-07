# Type card: planner (`--type planner`)

Profile key `planner` → `vendor_type='planner'` (the app's existing category: ClipboardList
icon, green; plural copy "planners"), working CSV `vendors.csv`. No instagram capture. No
extra preflight (the `planner` type already exists in the schema).

## Ground truth (from Kiara, 2026-07)
- **Planners are service-area vendors** — they travel to the couple's venue, so expect a
  thin Places sweep and a HIGH centroid/no-match rate, like photographers. Research + user
  pastes carry the weight; a home-based planner resolving to a city centroid is normal.
- **Sites are THIN — reviews and reddit are the real intel.** A planner's own site is
  usually just a packages/services list and a portfolio. The high-value detail (what went
  well or badly, what they were great at, where they spent their effort, how hands-on they
  were day-of) lives in Google reviews and reddit anecdotes. Mine those hard and archive the
  color into `intel` — it's what makes the later enrichment entries good.
- **WEDDING planners only:** the sweep pads with corporate/party/event planners and even
  financial "planners". Being an "event planner" isn't enough — run `wedcheck.mjs` every
  time; a planner vouched in a review/reddit thread re-enters via the research path.
- **Loose regional bounds** like photographers: a planner an hour or two out, or one who
  travels the whole state, is fine to include. The state guard still applies to the sweep
  (out-of-state rows come back `NO_MATCH`-flagged — surface them, don't silently drop).

## Phase 1 — sweep
Two queries per anchor (encoded in `TYPE_PROFILES.planner`): `wedding planner near {anchor}`
and `wedding coordinator near {anchor}` — "planner" and "coordinator" brand differently, and
day-of coordinators often don't say "planner". Statewide launches add the same pair for
`{StateName}` (the primary net — planners brand statewide and miss city-"near" queries).
`place_id` dedup collapses the overlap.

Then the **wedding-intent check** (mandatory):
```
node --env-file=.env.local .claude/skills/launchvendors/scripts/wedcheck.mjs data/launchvendors/<slug> --type planner
```
Keeps a sweep row when its name, website, or **Google reviews** show `wedding|elopement|
bridal` evidence; corporate/party/financial planners with no wedding evidence are **pruned
automatically** to `pruned.csv` (humans skim, they don't audit — relay the pruned names; a
row is rescued by moving it back). Obvious non-wedding "planner" senses (financial, estate,
retirement, tax) are dropped by name at sweep time. Only `WED_UNVERIFIED` rows (unreadable
site, no rescuing reviews) still need a human glance. Research-sourced rows are exempt.

## Phase 2 — web research queries (3–5 WebSearches)
- `{region} wedding planners`
- `best wedding planners {region}`
- `affordable wedding coordinator {region}`
- `{region} day of wedding coordinator`
- `{region} wedding planner cost pricing`

Fetch-extraction prompt (substitute region/state/domain):

> List every wedding planner or coordinator on this page that serves {REGION}, {ST}. Output ONLY JSON lines, one per planner: {"name":"...","hint":"<their base city, City ST, if the page says>","website":"<their OWN website if linked — never a social, maps, or directory link>","provenance":"web:{domain}","intel":"<the service levels they offer (full planning, partial planning, day-of/month-of coordination, a la carte, elopement guiding), any pricing (package starting prices, hourly, flat fee, or percentage-of-budget), wedding styles or specialties they name (mountain, beach, destination, microwedding, luxury, cultural/multi-day, budget-friendly), region served and any travel fee, and any firsthand review detail about what they were good/bad at, else omit>"}. Exclude venues that merely have an on-site coordinator, corporate/party/financial planners with no wedding work, and other vendor types (florists, photographers, caterers). No commentary, no markdown.

## Phase 2 — Reddit-paste extraction prompt

> Read every `reddit-*.txt` file in `<abs workdir>/research/`. They are raw Reddit-thread pastes about wedding planners and coordinators near {REGION}, {ST}. Extract every distinct wedding planner or day-of/month-of coordinator commenters used or recommend. Exclude venues, other vendor types, and planners clearly based in and serving another state. Append one JSON line per planner to `<abs workdir>/candidates.jsonl`: {"name":"...","hint":"<base city if stated or inferable, else omit>","website":"<their own website if linked, else omit>","provenance":"reddit:<filename>","intel":"<the anecdotal detail commenters give — what service they booked (full planning vs day-of), what the planner was GREAT at, what went wrong, how hands-on they were, where they spent their effort, real prices paid, wedding style, else omit>"}. Dedupe within your output; do not modify existing lines. Reply with only the count appended and any names you were unsure about.

Anecdotal customer evidence is the highest-value intel for this type — weight the Reddit
pass accordingly and keep the good/bad specifics verbatim in `intel`.

## Phase 4 — adjudication watchlist (your call, not Kiara's)
Beyond the standard docket, scan for and remove: **venues with an in-house coordinator**
that slipped in (the coordinator is a venue staffer, not a standalone planner — delete),
corporate/party/**financial** planners the intent check missed, florists or "event
designers" who style but don't coordinate, and name-variant dedup collisions (the profile
treats "Jane Doe Events" ≡ "Jane Doe Events & Planning"). Non-wedding planners are pruned
mechanically (junk-name filter + wedcheck) — mention the pruned count and move on.

## Enrichment handoff (recon guidelines — Kiara, 2026-07)
Archive into `intel` now; the enrichment pass consumes it:
- **Service packages** — the specific levels offered: full planning, partial planning,
  day-of / month-of coordination, à la carte / hourly, elopement or "wedding guiding".
- **Pricing** — package starting prices, hourly, flat fees, or **percentage-of-budget**
  (a real planner model, ~10-15%); deposits/retainers; what a package includes. Never invent
  numbers — record that only package NAMES were listed and no figures were published. (Do
  not write it up as "quote only"; the enrich pass has plain wordings for that, see
  `enrichvendors/references/common/entry-rules-core.md`.)
- **Service region + travel fees** — becomes `service_region` on every recon entry,
  **required**; **if no service area is stated, default to the whole state** (planners
  travel). Capture any stated travel fee for mountain/destination weddings.
- **Wedding styles / specialties** — mountain, beach, destination, microwedding/elopement,
  luxury/large-format, cultural or multi-day, budget-conscious.
- **Anecdotal detail — most important:** firsthand accounts of what went well or badly, what
  they were great at, where they spent their time/effort, how hands-on they were, problems
  handled. Attribute it. This carries the entries; the site alone won't.
- **Photos:** 1–2 portfolio shots (weddings they produced — ceremony/reception scenes,
  tablescapes, styling) from their own site.
