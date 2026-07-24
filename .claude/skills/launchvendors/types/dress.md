# Type card: dress (`--type dress`)

Profile key `dress` → `vendor_type='dress'` (app category: Shirt icon, warm orange; plural copy "dress shops"), working CSV `vendors.csv`. **Captures instagram** → bare handle in `vendors.instagram`. Accepts aliases `dress`/`dresses`/`bridal`/`gown(s)`.

**Preflight:** migration `supabase/migrations/0016_vendor_instagram.sql` must be hand-applied (Supabase SQL editor) before Phase 5 — upload fails fast with guidance if it isn't. Confirm with the user in Phase 0. (Same column photographers use; if a photographer run already applied it, nothing to do.)

## Ground truth
- **Most bridal shops are storefronts with a specific Google Maps address** — expect a strong Places sweep and a LOW centroid/no-match rate (like florists, unlike photographers). By-appointment home studios and independent designers exist but are the minority; they come in through research + pastes.
- **THE exclusion — guest attire vs. the bride/bridal party.** This category is shops that sell **wedding gowns for the bride** (and, commonly, the bridal party — bridesmaids). EXCLUDE shops that only dress wedding *guests*: department stores and boutiques selling "wedding guest dresses" / cocktail / evening / prom / mother-of-the-bride attire with **no actual bridal gowns**. A shop that *also* carries guest, mother-of-the-bride, or bridesmaid dresses is **fine to include as long as it sells real bridal gowns for the bride.** Bridal-party-only shops (bridesmaids/flower-girl but no bride gowns) are a judgment call — keep if they clearly serve wedding parties, note that they're party-only.
- Also exclude (different businesses, not dresses): menswear/tuxedo shops, jewelers, dress alterations/preservation/dry-cleaning services, costume shops. The sweep prunes the unambiguous ones by name; the rest are a Phase 4 glance.

## Phase 1 — sweep
Two queries per anchor: `bridal shop near {anchor}` and `wedding dress shop near {anchor}` (place_id dedup collapses the overlap for free); statewide launches add `bridal shops in {StateName}` + `wedding dress shops in {StateName}`. All encoded in `TYPE_PROFILES.dress`.

Noise is handled mechanically (Kiara, 2026-07: prune proactively — humans skim, they don't audit): the sweep drops dry cleaners / dress-preservation services / costume shops **by name**, and prunes menswear/tux + other-vendor-type names via the cross-type guard (a bridal/gown word rescues a "Tux & Bridal" hybrid). Then the **bridal-gown intent check** (mandatory):
```
node --env-file=.env.local .claude/skills/launchvendors/scripts/wedcheck.mjs data/launchvendors/<slug> --type dress
```
Keeps a sweep row when its name, website homepage, or **Google reviews** show `bridal | wedding dress | wedding gown` evidence; a wedding-**guest**-attire retailer or prom-only shop that never says "bridal" gets **pruned automatically** to `pruned.csv` (relay the names; rescue by moving a row back). Only `WED_UNVERIFIED` rows (site we couldn't read, no rescuing reviews) still need a human glance. Research-sourced rows are exempt (their sources are wedding-scoped).

## Phase 2 — web research queries (3–5 WebSearches)
- `{region} bridal shops` / `{region} wedding dress boutiques`
- `best bridal boutiques {region}`
- `affordable wedding dresses {region}` / `budget bridal shops {region}`
- `{region} bridal shop designers carried`
- `{region} where to buy wedding dress reddit`

Fetch-extraction prompt (substitute region/state/domain):

> List every BRIDAL shop / wedding-dress boutique on this page that serves {REGION}, {ST} — shops where a BRIDE can buy or order a WEDDING GOWN. Output ONLY JSON lines, one per shop: {"name":"...","hint":"<their city, City ST, if the page says>","website":"<their OWN website if linked — never a social, maps, or directory link>","instagram":"<their Instagram handle or URL if shown, else omit>","provenance":"web:{domain}","intel":"<designers/labels carried, gown styles or silhouettes (boho, ballgown, fit-and-flare, modest, plus-size), price range (esp. any real figure someone paid for a dress here), whether appointments are required or walk-ins welcome, sample-sale / trunk-show / off-the-rack / made-to-order details, whether they ALSO carry bridesmaid / bridal-party / mother-of-the-bride / accessories, and region served, else omit>"}. EXCLUDE shops that only sell wedding-GUEST attire (cocktail/evening/prom/guest dresses) with no bridal gowns, menswear/tuxedo shops, alterations/preservation/dry-cleaning services, and other vendor types. A shop that sells bridal gowns AND also stocks guest/bridal-party dresses is INCLUDED. No commentary, no markdown.

### Website + Instagram hunt (same subagent, after extraction)
For each candidate **missing a website**, run one WebSearch: `"{full name}" {ST} bridal shop` — take the shop's OWN domain from the results (never a directory/social hit as `website`) and grab the Instagram handle when it surfaces (bridal shops are heavy IG users; the handle is high-value here). Update the candidate's JSON line before appending. Cap ~20 hunt searches per agent run.

## Phase 2 — Reddit/Instagram-paste extraction prompt

> Read every `reddit-*.txt` and `ig-*.txt` file in `<abs workdir>/research/`. They are raw pastes (Reddit threads, Instagram search/hashtag pages) about where to buy a WEDDING DRESS near {REGION}, {ST}. Extract every distinct bridal shop / wedding-dress boutique commenters bought from or recommend — where a BRIDE gets a GOWN. EXCLUDE wedding-guest-attire-only shops, menswear/tux, alterations/preservation services, other vendor types, and shops clearly in and serving another state. Append one JSON line per shop to `<abs workdir>/candidates.jsonl`: {"name":"...","hint":"<city if stated, else omit>","website":"<their own website if linked, else omit>","instagram":"<handle if shown (an @mention counts), else omit>","provenance":"<reddit|ig>:<filename>","intel":"<what a commenter actually PAID for their dress (a real figure is gold), designers/labels named, styles, appointment vs walk-in experience, sample-sale/trunk-show mentions, whether they also do bridesmaids/party, and region served, else omit>"}. Dedupe within your output; do not modify existing lines. Reply with only the count appended and any names you were unsure about.

Instagram pages are browsed and pasted **by the user** — never fetched or automated (Meta ToS).

## Phase 4 — review watchlist
Beyond the standard flags, ask Kiara to eyeball for:
- **Guest-attire shops** that slipped through (cocktail/evening/prom/mother-of-the-bride only, no bridal gowns) — delete.
- **Menswear/tuxedo** shops and jewelers with a "bridal" word (kept by the hybrid rescue) — delete unless they genuinely sell bridal gowns.
- **Bridal-party-only** shops (bridesmaids/accessories, no bride gowns) — keep or delete on the shop's focus.
- Name-variant dedup collisions (the profile treats "X Bridal" ≡ "X Bridal Boutique" — the dry-run's name+city skip list shows what collided).

## Enrichment handoff (recon guidelines)
Archive into `intel` now; the enrichment pass consumes it:
- **Where they serve** — becomes `service_region` on every recon entry, **required**; a storefront's city/metro is an acceptable sourced fallback ("Denver area").
- **Designers/labels carried** — the single most-searched fact for this type; list the ones a source names.
- **Price ranges — anecdotes are gold:** a real figure someone actually paid for their gown here outranks a posted "starting at". Capture published price bands too (sample rack vs. designer, trunk-show pricing), but never invent a number.
- **Try-on process:** appointment required vs. walk-ins welcome, private-suite vs. open floor, appointment fee, how far out to book, sample-size range.
- **Scope:** bridal gowns only, or also bridesmaids / bridal-party / mother-of-the-bride / accessories (veils, etc.); off-the-rack vs. made-to-order / special-order lead times.
- **Photos:** 1–2 gown shots from their own site (see enrich `references/dress/photo-rules.md`).
