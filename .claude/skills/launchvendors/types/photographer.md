# Type card: photographer (`--type photographer`)

Profile key `photos` → `vendor_type='photos'` (the app's existing category: Camera icon, blue), working CSV `vendors.csv`. **Captures instagram** → bare handle in `vendors.instagram`.

**Preflight:** migration `supabase/migrations/0016_vendor_instagram.sql` must be hand-applied (Supabase SQL editor) before Phase 5 — upload fails fast with guidance if it isn't. Confirm with the user in Phase 0.

## Ground truth (from Kiara, 2026-07)
- Expect **most photographers to be Google-Places-less** — the sweep is a floor, not the list. Research + user pastes carry the weight; a high centroid/no-match rate in Phase 3 is normal, say so.
- **Loose regional bounds:** a photographer 3 hours out, or servicing only part of the region, is fine to include. The state guard still applies (out-of-state rows come back `NO_MATCH`-flagged — surface them for Kiara to decide rather than silently dropping).
- All vendors show on the map: base-city centroid when research gives a home base (`hint`), else the region anchor; pin-less rows are acceptable and called out at upload.

## Phase 1 — sweep
Query per anchor: `wedding photographer near {anchor}` (encoded in `TYPE_PROFILES.photos`).

## Phase 2 — web research queries (3–5 WebSearches)
- `{region} wedding photographers`
- `best wedding photographers {region}`
- `{region} elopement photographer`
- `affordable wedding photographer {region}`
- `{region} wedding photographer pricing`

Fetch-extraction prompt (substitute region/state/domain):

> List every wedding photographer or photography studio on this page that serves {REGION}, {ST}. Output ONLY JSON lines, one per photographer: {"name":"...","hint":"<their base city, City ST, if the page says>","website":"<their OWN website if linked — never a social, maps, or directory link>","instagram":"<their Instagram handle or URL if shown, else omit>","provenance":"web:{domain}","intel":"<any pricing/package tiers, add-ons (video, engagement session, second shooter, albums, extra hours), whether travel is included IF stated, photo vs video, wedding/elopement/engagement coverage, specialties (e.g. outdoor/mountain, micro-weddings), and region served, else omit>"}. Exclude photo-booth rentals, video-only outfits, and boudoir/portrait-only studios with no wedding work. No commentary, no markdown.

### Website + Instagram hunt (same subagent, after extraction)
Most Places-less photographers still have a findable site. For each candidate **missing a website**, run one WebSearch: `"{full name}" {ST} wedding photographer` — take the vendor's OWN domain from the results (never a directory/social hit as `website`) and grab the Instagram handle when it surfaces. Update the candidate's JSON line before appending. Cap ~20 hunt searches per agent run; leave the rest for the resolve fallback and CSV review.

## Phase 2 — Reddit/Instagram-paste extraction prompt

> Read every `reddit-*.txt` and `ig-*.txt` file in `<abs workdir>/research/`. They are raw pastes (Reddit threads, Instagram search/hashtag pages) about wedding photographers serving {REGION}, {ST}. Extract every distinct wedding photographer or photography studio (photo, or photo+video). Exclude video-only outfits, photo-booth rentals, venues and other vendor types, and photographers clearly based in and serving another state. Append one JSON line per photographer to `<abs workdir>/candidates.jsonl`: {"name":"...","hint":"<base city if stated or inferable, else omit>","website":"<their own website if linked, else omit>","instagram":"<handle if shown (an @mention counts), else omit>","provenance":"<reddit|ig>:<filename>","intel":"<any pricing, package, style, or region-served detail commenters give, else omit>"}. Dedupe within your output; do not modify existing lines. Reply with only the count appended and any names you were unsure about.

Instagram pages are browsed and pasted **by the user** — never fetched or automated (Meta ToS).

## Phase 4 — review watchlist
Beyond the standard flags, ask Kiara to eyeball for: photo-booth rentals that slipped through (names containing "booth"), video-only outfits, and name-variant dedup collisions (the type profile treats "Jane Doe Photography" ≡ "Jane Doe Photo" — the dry-run's name+city skip list shows what collided).

## Enrichment handoff (recon guidelines — Kiara, 2026-07)
Archive into `intel` now; the enrichment pass consumes it:
- **Where they service** — becomes `service_region` on every recon entry, **required** (infer from name clues like "…Colorado Weddings", site copy, IG bio).
- **Pricing:** package tiers like venues, plus add-ons (video, engagement session, second shooter, albums, extra hours/speeches coverage). Note travel-cost inclusion **only if explicit** — if unclear, don't mention. Never invent numbers; if no published pricing, the entry leads with style/services and says pricing is on inquiry.
- **General notes:** photo and/or video; wedding/elopement/engagement coverage; specialties (outdoor/mountain landscapes, micro-weddings, etc.).
- **Photos:** sourced from Google Places photos + the photographer's own site by default (Kiara-confirmed: welcome advertising with crediting). Portfolio couple portraits are the product — keep; own-site watermarks are the photographer's credit — keep. Per-photo `source_url` provenance stays mandatory.
