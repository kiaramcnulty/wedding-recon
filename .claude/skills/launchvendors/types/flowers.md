# Type card: flowers (`--type flowers`)

Profile key `flowers` → `vendor_type='flowers'` (app category: Flower2 icon, pink; plural copy "florists"), working CSV `vendors.csv`. No instagram capture. No extra preflight.

## Ground truth (from Kiara, 2026-07)
- **Most florists are storefronts with a specific Google Maps address** — expect a strong Places sweep and a LOW centroid/no-match rate. Home-studio floral designers exist but are the minority.
- **Non-boutique chains are in scope ONLY via human recon:** Costco, Trader Joe's, grocery floral counters etc. enter through a Reddit paste or review that points at them for wedding flowers — never from the sweep. Resolve to the specific store location the thread names (or the store nearest the region's center if unnamed); their `intel` should cite the human recon since their sites won't say "wedding".
- **Anecdotal customer evidence is the highest-value intel for this type** — a bride's account of her bouquet/centerpieces outranks site copy. Weight Reddit + review mining accordingly.

## Phase 1 — sweep
Query per anchor: `wedding florist near {anchor}`; statewide adds `wedding florists in {StateName}`. Encoded in `TYPE_PROFILES.flowers`.

Then the **wedding-intent check** (mandatory):
```
node --env-file=.env.local .claude/skills/launchvendors/scripts/wedcheck.mjs data/launchvendors/<slug> --type flowers
```
Flags sweep rows with zero wedding/bridal evidence on name/site (`NON_WEDDING?` — mostly everyday-delivery flower shops and garden centers; default delete at review) or with no readable site (`WED_UNVERIFIED` — needs a human glance).

## Phase 2 — web research queries (3–5 WebSearches)
- `{region} wedding florists`
- `best wedding flowers {region}`
- `affordable wedding florist {region}`
- `{region} wedding florist cost minimum`
- `{region} a la carte wedding flowers`

Fetch-extraction prompt (substitute region/state/domain):

> List every wedding florist or floral designer on this page that serves {REGION}, {ST}. Output ONLY JSON lines, one per florist: {"name":"...","hint":"<their base city, City ST, if the page says>","website":"<their OWN website if linked — never a social, maps, or directory link>","provenance":"web:{domain}","intel":"<any pricing (minimums, a la carte vs full-service, package rates), design style or specialty (e.g. experiential installs, dried florals, sustainable/local blooms), delivery/pickup details, customer anecdotes, and region served, else omit>"}. Exclude venues, planners who subcontract florals, garden centers/nurseries with no wedding work, and everyday-delivery-only shops. No commentary, no markdown.

## Phase 2 — Reddit-paste extraction prompt

> Read every `reddit-*.txt` file in `<abs workdir>/research/`. They are raw Reddit-thread pastes about wedding flowers near {REGION}, {ST}. Extract every distinct source of wedding flowers commenters used or recommend — boutique florists, home studios, AND non-boutique options (Costco, Trader Joe's, grocery floral counters, flower markets) when a commenter actually used them for a wedding. Exclude venues, planners, other vendor types, and florists clearly based in and serving another state. Append one JSON line per source to `<abs workdir>/candidates.jsonl`: {"name":"...","hint":"<base city or store location if stated, else omit>","website":"<their own website if linked, else omit>","provenance":"reddit:<filename>","intel":"<pricing, what the commenter ordered (bouquets, centerpieces, DIY buckets), how it turned out, delivery/pickup notes, else omit>"}. Dedupe within your output; do not modify existing lines. Reply with only the count appended and any names you were unsure about.

## Phase 4 — review watchlist
Beyond the standard flags: `NON_WEDDING?` everyday-delivery shops and garden centers (delete unless human recon vouches), chain rows (confirm the resolved store location matches what the thread pointed at), and planner/design studios that subcontract florals rather than doing them (delete).

## Enrichment handoff (recon guidelines — Kiara, 2026-07)
Archive into `intel` now; the enrichment pass consumes it:
- **Where they service** — becomes `service_region` on every recon entry, **required**; for a storefront with no stated service area, the shop's city/metro is an acceptable sourced fallback ("Denver area").
- **Wedding/event validation:** what on the site (or in human recon) proves wedding work.
- **Customer anecdotes — most important:** any firsthand account of ordering wedding flowers from them; attribute it.
- **Style/specialty:** design style (e.g. experiential installs, garden-style, dried/preserved), any niche.
- **Pricing:** a la carte menus, full-service minimums, package rates, consultation process.
- **Logistics:** delivery vs pickup, setup/teardown, day-of install details.
- **Photos:** 1–2 arrangement shots (bouquets, centerpieces, installs) from their own site.
