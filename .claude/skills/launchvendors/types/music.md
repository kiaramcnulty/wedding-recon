# Type card: music (`--type music`)

Profile key `music` → `vendor_type='music'` (app category: Music icon, indigo; plural copy "musicians"), working CSV `vendors.csv`. No instagram capture. No extra preflight.

## Ground truth (from Kiara, 2026-07)
- **Acts range from solo DJs to 10-piece bands to agencies** — a "vendor" here may be a person, a band, or an entertainment company with multiple acts. Keep agencies as one row (their site is the booking surface).
- **Multi-state service is common** — bands tour; expect "Colorado + surrounding states" or regional coverage. The state guard still applies to the sweep, but a research-sourced act based in-state that plays multiple states is squarely in scope; archive the full service footprint into `intel`.
- Mixed footprint: DJ outfits often have offices (place match); bands are often Places-less like photographers. A mid-range centroid/no-match rate in Phase 3 is normal — say so.

## Phase 1 — sweep
Three queries per anchor (encoded in `TYPE_PROFILES.music`): `wedding band near {anchor}`, `wedding dj near {anchor}`, `wedding music near {anchor}` — bands and DJs brand differently, and "wedding music" catches ceremony ensembles/pianists the other two miss. Statewide adds the same trio for `{StateName}`. `place_id` dedup collapses the overlap; expect a higher raw-query count than other types (still pennies).

Noise is handled mechanically, in two layers (Kiara, 2026-07: prune proactively — humans skim, they don't audit): the sweep drops schools/lessons/AV rentals/instrument shops/karaoke **by name** before they enter the CSV, then the **wedding-intent check** (mandatory) prunes what's left with no wedding evidence in name, site, or Google reviews:
```
node --env-file=.env.local .claude/skills/launchvendors/scripts/wedcheck.mjs data/launchvendors/<slug> --type music
```
"wedding music" is the loosest of the three nets, so expect a real pruned count — everything lands in `pruned.csv` with a reason; relay the names, rescue by moving a row back. Only `WED_UNVERIFIED` rows (unreadable site, no rescuing reviews) still need a human glance.

## Phase 2 — web research queries (3–5 WebSearches)
- `{region} wedding bands`
- `{region} wedding DJs`
- `best wedding music {region}`
- `{region} wedding band pricing`
- `{region} string quartet ceremony music wedding`

Fetch-extraction prompt (substitute region/state/domain):

> List every wedding music act on this page that serves {REGION}, {ST} — live bands, DJs, ceremony musicians (string quartets, pianists, guitarists, harpists), singers, and entertainment agencies. Output ONLY JSON lines, one per act: {"name":"...","hint":"<their base city, City ST, if the page says>","website":"<their OWN website if linked — never a social, maps, or directory link>","provenance":"web:{domain}","intel":"<act type (DJ, live band, pianist, quartet, agency), what they cover (ceremony, cocktail hour, reception, late-night/EDM sets), genres or instruments, piece-count pricing tiers (e.g. 5-piece from $X, 7-piece from $Y) and add-ons (uplighting, MC, extra hours), multi-state or regional service area, and any public showcase or 'see us live' events, else omit>"}. Exclude venues, AV/production rental companies, music schools, and photo/video vendors. No commentary, no markdown.

## Phase 2 — Reddit-paste extraction prompt

> Read every `reddit-*.txt` file in `<abs workdir>/research/`. They are raw Reddit-thread pastes about wedding music near {REGION}, {ST}. Extract every distinct wedding music act — DJs, live bands, ceremony musicians (quartets, pianists, guitarists), singers, entertainment agencies. Exclude venues, AV rental companies, music schools, other vendor types, and acts clearly based in and serving another state. Append one JSON line per act to `<abs workdir>/candidates.jsonl`: {"name":"...","hint":"<base city if stated or inferable, else omit>","website":"<their own website if linked, else omit>","provenance":"reddit:<filename>","intel":"<act type, pricing, what parts of the day they covered, genre/instrument, showcase mentions, or experience detail commenters give, else omit>"}. Dedupe within your output; do not modify existing lines. Reply with only the count appended and any names you were unsure about.

## Phase 4 — review watchlist
Beyond the standard flags: venues that host live music that slipped past the filters (delete), duplicate act-vs-agency rows (an agency AND one of its named bands may both appear — keep both only if each has its own booking surface), and name-collision dedup on generic act names ("Soul Fire Band" vs "Soulfire"). Schools/AV/instrument-shop noise is pruned mechanically — mention the pruned count and move on.

## Enrichment handoff (recon guidelines — Kiara, 2026-07)
Archive into `intel` now; the enrichment pass consumes it:
- **Where they service** — becomes `service_region` on every recon entry, **required**; multi-state coverage is common and worth stating exactly ("Colorado + Wyoming", "CO/UT/NM").
- **What they are:** DJ vs live band vs pianist vs singer vs quartet vs agency — the first thing a couple wants to know.
- **What they cover:** ceremony, cocktail hour, reception, late-night/EDM sets.
- **Genres/instruments:** any specific style (Motown, bluegrass, mariachi) or instrumentation.
- **Pricing + packages:** piece-count tiers ("5-piece band min $X, 7-piece min $Y"), hourly rates, add-ons (uplighting, MC services, extra hours, learning a first-dance song).
- **See them live:** free showcases, public gigs, or venue residencies where a couple can check them out — capture dates/venues when stated.
- **Photos:** 1–2 performance shots (band on stage, DJ at a reception) from their own site.
