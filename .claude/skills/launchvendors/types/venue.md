# Type card: venue (`--type venue`, the default)

Profile key `venue` → `vendor_type='venue'`, working CSV `venues.csv` (historical name — pre-rename workdirs in `data/launchvenues/` stay re-runnable). No instagram capture. No extra preflight.

## Phase 1 — sweep
Query per anchor: `wedding venue near {anchor}` ("event venue" pulls in meeting rooms / corporate banquet space that isn't wedding-relevant — keep the intent tight). Encoded in `TYPE_PROFILES.venue`.

## Phase 2 — web research queries (3–5 WebSearches)
- `{region} wedding venues list`
- `{region} unique unconventional wedding venues`
- `{region} affordable budget wedding venues`
- `best hidden gem wedding venues {region}`

Then WebFetch the top listicle/aggregator hits (Here Comes The Guide, local blogs, photographer guides, **Zola**). Fetch-extraction prompt (substitute region/state/domain):

> List every wedding venue or event space on this page located in or near {REGION}, {ST}. Output ONLY JSON lines, one per venue: {"name":"...","hint":"City, ST","website":"<the venue's OWN website if the page links it, else omit — never a social, maps, or directory link>","provenance":"web:{domain}","intel":"<any pricing, capacity, or package detail the page gives, else omit>"}. No commentary, no markdown.

## Phase 2 — Reddit-paste extraction prompt

> Read every `reddit-*.txt` file in `<abs workdir>/research/`. They are raw Reddit-thread pastes about wedding venues near {REGION}, {ST}. Extract every distinct venue/event space that could host a wedding (restaurants, parks, rec centers, galleries, breweries, hotels, campuses count). Exclude pure service vendors (florist/DJ/photographer/planner/caterer), venues clearly in another state, and generic non-places ("a park", "an Airbnb"). Append one JSON line per venue to `<abs workdir>/candidates.jsonl`: {"name":"...","hint":"<city/area if stated or inferable, else omit>","website":"<the venue's own website if a commenter linked it, else omit>","provenance":"reddit:<filename>"}. Dedupe within your output; do not modify existing lines. Reply with only the count appended and any names you were unsure about.

## Phase 4 — review watchlist
Standard flags only (`CHECK`, `APPROX`, `NO_MATCH`); no venue-specific exclusions beyond the extraction prompt's.

## Enrichment handoff
`intel` (pricing/capacity/package details) and raw `research/` files feed the later enrichment pass. Venue recon focuses: pricing/packages, capacity, catering policy, indoor/outdoor spaces.
