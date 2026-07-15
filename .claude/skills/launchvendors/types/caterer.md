# Type card: caterer (`--type caterer`)

Profile key `food` → `vendor_type='food'` (app category: UtensilsCrossed icon, amber; plural copy "caterers"), working CSV `vendors.csv`. No instagram capture. No extra preflight.

## Ground truth (from Kiara, 2026-07)
- **Most caterers have a real street address** (commissary kitchen or storefront) — expect a strong Places sweep and a LOW centroid/no-match rate, unlike photographers. A caterer resolving to no place is worth a second look at the name.
- **Wedding-specific only, with a human-recon escape hatch:** keep sweep results with wedding evidence (name, site). A caterer with no wedding mention anywhere on its site still stays IF a Reddit thread or a Google review describes their wedding work — human recon outranks site copy. Bare minimum bar: clear large-event catering.
- Service scope matters both ways: WHERE they serve (Denver metro vs across Colorado) and WHO (some do microweddings only, some have guest-count minimums). Archive both into `intel`.

## Phase 1 — sweep
Query per anchor: `wedding caterer near {anchor}`; statewide adds `wedding catering in {StateName}`. Encoded in `TYPE_PROFILES.food`.

Then the **wedding-intent check** (mandatory):
```
node --env-file=.env.local .claude/skills/launchvendors/scripts/wedcheck.mjs data/launchvendors/<slug> --type caterer
```
Flags sweep rows with zero wedding/bridal evidence as `NON_WEDDING?` / `WED_UNVERIFIED`. Default at review is **delete `NON_WEDDING?` rows** — UNLESS a Reddit paste or a Google review ties them to a wedding (check `research/` before deleting; that's Kiara's explicit carve-out for this type).

## Phase 2 — web research queries (3–5 WebSearches)
- `{region} wedding caterers`
- `best wedding catering {region}`
- `affordable wedding caterer {region}`
- `{region} wedding catering cost`
- `{region} food truck wedding catering`

Fetch-extraction prompt (substitute region/state/domain):

> List every wedding or large-event caterer on this page that serves {REGION}, {ST}. Output ONLY JSON lines, one per caterer: {"name":"...","hint":"<their base city, City ST, if the page says>","website":"<their OWN website if linked — never a social, maps, or directory link>","provenance":"web:{domain}","intel":"<any pricing (per-person/plate rates, package tiers, minimums), service style (buffet, plated, stations, family-style, food truck), menu themes or cuisines, tasting/consultation process, who they serve (microweddings only, guest minimums), and region served, else omit>"}. Exclude venues with in-house-only catering, restaurants with no catering operation, bakers/dessert-only shops, and bartending-only services. No commentary, no markdown.

## Phase 2 — Reddit-paste extraction prompt

> Read every `reddit-*.txt` file in `<abs workdir>/research/`. They are raw Reddit-thread pastes about wedding catering near {REGION}, {ST}. Extract every distinct caterer (full-service, drop-off, food truck, or a restaurant commenters used to cater a wedding). Exclude venues, dessert/bakery-only shops, bartending services, other vendor types, and caterers clearly based in and serving another state. Append one JSON line per caterer to `<abs workdir>/candidates.jsonl`: {"name":"...","hint":"<base city if stated or inferable, else omit>","website":"<their own website if linked, else omit>","provenance":"reddit:<filename>","intel":"<any pricing, food-quality opinion, service-style, or wedding-experience detail commenters give, else omit>"}. Dedupe within your output; do not modify existing lines. Reply with only the count appended and any names you were unsure about.

## Phase 4 — review watchlist
Beyond the standard flags: `NON_WEDDING?` rows (delete unless human recon vouches — see above), venues with in-house catering that slipped in (names with "events center"/"banquet"), dessert-only or bartending-only outfits, and restaurant locations where Google matched the dine-in spot rather than the catering arm (fine to keep — same business).

## Enrichment handoff (recon guidelines — Kiara, 2026-07)
Archive into `intel` now; the enrichment pass consumes it:
- **Where + who they serve** — becomes `service_region` on every recon entry, **required** (e.g. "Denver + Front Range", "across Colorado"); note microwedding-only or guest-minimum policies in general notes.
- **Wedding verification:** what proves they do weddings (site page, reddit mention, a Google review describing a wedding) — at minimum large-event catering.
- **Pricing:** anything findable — standard packages, per-person rates, one couple's real spend, or "personalized consultation only".
- **Menu:** specific wedding menus, signature items, cuisines/themes when published.
- **Type + quality:** food truck / buffet / plated courses / stations, and sourced opinions on food quality and vibe.
- **Photos:** food shots specifically, target 1–2 per vendor.
