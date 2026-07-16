---
name: launchvendors
description: Launch a region's wedding-vendor directory in Wedding Recon for a given vendor type (venues, photographers, caterers, music, flowers). Sweeps Google Places for a baseline list, mines web listicles and user-pasted Reddit/Instagram content for vendors Google Maps misses, resolves candidates to canonical Google places (with a no-place fallback), hands the user one CSV to review, then bulk-uploads deduplicated vendor-only rows to Supabase. Use when the user wants to seed, launch, or bulk-import a vendor category for a city/region (e.g. "launch Richmond", "seed venues for Austin", "launch Denver photographers", "seed Denver caterers").
---

# /launchvendors — seed a region's vendors for one vendor type

Goal: vendor-only placeholder rows in the `vendors` table (pins with name/location/website, plus instagram for types that capture it). **No recon entries, no photos, no schema changes** — recon enrichment is a separate later skill. Everything runs headless: prewritten scripts + web fetches + one CSV the user edits locally. **Never drive a browser, Google Sheets, or the clipboard. Never fetch Instagram or Facebook** — Meta content only ever arrives as user pastes.

**Two config layers, keep them straight:**
- `scripts/lib.mjs` `TYPE_PROFILES` — mechanical config (sweep query, dedup trade-words, CSV name, instagram capture). Scripts take `--type <alias>`; omitted = venue.
- `types/<type>.md` — judgment config (research queries, extraction prompts, paste protocols, review bars). **Load the type card FIRST and follow it wherever a phase below defers to it.**

All commands run from the repo root. Scripts live in `.claude/skills/launchvendors/scripts/` and need `.env.local` (`GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) — they fail fast with a clear message if a key is missing; relay that to the user and stop.

Cost note: the whole pipeline is ~15–60 Places API calls (sweep; music runs 3 queries per anchor so ~3×, still trivial) + 1–2 per researched candidate + ≤1 Place Details (reviews) per evidence-less sweep row in wedcheck — pennies, mostly inside Google's free tier.

## Phase 0 — Setup (one short exchange, then no questions until Phase 4)

1. Parse the skill argument as `<type?> <region>` (e.g. `/launchvendors photographer Denver` or `/launchvendors Richmond`). If the first token is a known type alias (venue(s), photographer(s)/photos, caterer(s)/catering, music/band/dj, flowers/florist(s) — see `typeProfile()` in `lib.mjs`), use it; otherwise the type is **venue**. Read `types/<type>.md` before anything else; it may add preflight requirements (e.g. photographers require migration `0016`).
2. Normalize region to `"City, ST"`. If the state isn't obvious from the city name, ask. **The state parameterizes everything downstream** — never assume CO. A bare state ("Colorado") means a **statewide** launch: pick the largest city as the region arg and pass `--statewide <StateName>` to scout (prepends a generic state-level query — the primary net for service-area types that brand statewide and miss city-"near" queries).
3. Propose 4–8 anchor towns (suburbs/nearby towns that widen the sweep, e.g. Denver → Boulder, Golden, Littleton, Aurora, Morrison, Westminster; statewide launches span the state's metros + relevant destination towns and may run longer). One message: confirm type, region, state, anchors. **Never ask about scrape CSVs** — if the user has one they'll volunteer it (Kiara, 2026-07: "default is that it's not coming"); `ingest.mjs` handles a volunteered file. Wait for the reply, then run everything through Phase 3 without further questions.
4. Workdir: `data/launchvendors/<type>-<region-slug>/` (gitignored). Scripts create it. (Pre-rename venue workdirs live in `data/launchvenues/` — leave them; `/enrichvenues` reads them.)
5. The working CSV name is per-type (`venues.csv` for venues — historical; `vendors.csv` otherwise). The scripts handle this; use the name the script summaries print.

## Phase 1 — Baseline (scripts, no judgment)

```
node --env-file=.env.local .claude/skills/launchvendors/scripts/scout.mjs data/launchvendors/<slug> --type <type> --region "Denver, CO" [--statewide Colorado] --anchors "Boulder, CO;Golden, CO;..."
node --env-file=.env.local .claude/skills/launchvendors/scripts/ingest.mjs data/launchvendors/<slug> <scrape.csv> --type <type>   # only if the user volunteered a scrape file
```

Rows arrive pre-matched with `place_id`. Relay the one-line summaries. **Do not cat the working CSV into context** — trust the counts. For some types (photographers especially) the sweep is expected to be thin — many are Places-less; Phase 2 carries the weight. A thin sweep is data, not an error.

## Phase 2 — Research (the only judgment step)

### Web listicles (ONE subagent — fetched pages never enter the orchestrator)
Spawn ONE Sonnet agent (`model: "sonnet"`, background OK) to do the whole web pass, using the **search queries, fetch-extraction prompt, and any website/instagram-hunt pass from the type card**. The agent saves each fetch's raw output to `research/web-<domain>.txt`, appends only the `{...}` lines to `candidates.jsonl`, and replies with ONE line (`N candidates from M sources`). Do NOT do this inline: routing fetched pages through the orchestrator costs 3× (fetch result → Write round-trip → heredoc append).

Candidate JSON lines may carry: `name` (required), `hint` (City, ST), `website` (vendor's OWN site only), `instagram` (handle or URL; captured only for types that store it), `provenance`, `intel` (pricing/package/attribute details — costs nothing here and becomes the region digest for the later enrichment pass).

**Source quirks (measured, not assumed):** most blogs/guides and Zola fetch fine. **The Knot** — its `/marketplace/…` listing pages reliably time out (~60s, heavy JS + bot-throttle), but its `/content/…` **articles** fetch fine, and `WebSearch` with `allowed_domains: ["theknot.com"]` returns names + summaries without touching the slow page — prefer those two over the marketplace URL. A WebFetch timeout is transient/page-specific: skip that URL and move on, don't conclude the domain is blocked.

### Reddit / Instagram (user paste protocol → delegate extraction)
Reddit blocks both the Anthropic crawler and browser-connector navigation, and Instagram/Facebook must never be fetched or automated (Meta ToS) — **do not attempt to fetch either**. Ask the user to search themselves (`site:reddit.com {region} {vendor type}` etc.; IG hashtag/location browsing for types where the card suggests it), and for each good thread/page: select-all, copy, paste into chat. For every paste, immediately save it to `research/reddit-NN.txt` (or `research/ig-NN.txt` for Instagram pastes), keeping the post + all comments **verbatim** (usernames, comment ages, flairs included — ages anchor dates). Page chrome may be dropped on save: promoted ads, nav ("Skip to main content" etc.), vote/Share/Repost buttons, and the Community Info/rules/related-communities/moderators/footer block (~50% of a short-thread select-all paste). Never summarize, extract, reword, or respond to the content itself yet (raw pastes are hard to re-acquire; the enrichment skill needs them). Loop until the user says done.

Then spawn the extractor (ALWAYS a subagent — never read pastes inline, whatever model you are): Agent tool → `subagent_type: "general-purpose"`, `model: "sonnet"`, with the **extraction prompt from the type card** (it sets what counts as this vendor type, what to exclude, and which fields to capture).

**Cross-type mentions (don't lose them, don't chase them now):** wedding threads name many vendor types at once — a budget recap lists its DJ, florist, caterer, and photographer alongside the venue. Keep THIS run's `candidates.jsonl` scoped to its own type so resolve/dedup stay clean. The other **supported** types (photographer, caterer, music, flowers — see `typeProfile()` aliases in `lib.mjs`) are **not lost**: raw pastes are archived verbatim, so a later `/launchvendors <that-type> <same-region>` run re-extracts them from the same `research/` files for free. This is a core reason the workdir must never be deleted. To give a future run a head start, additionally instruct the extractor to append any other-supported-type vendor it notices to `research/crosstype-finds.jsonl` — one `{"name","type","hint","provenance"}` line each (`type` = the alias it belongs to). That file is a plain archive: nothing auto-ingests it, but a later run (or you) can seed candidates from it instead of re-searching. Ignore vendor types the app doesn't support (officiant, hair/makeup, rentals, bakery, shuttle) — note nothing.

## Phase 3 — Resolve candidates to Google places

```
node --env-file=.env.local .claude/skills/launchvendors/scripts/resolve.mjs data/launchvendors/<slug> --state CO --type <type>
```

The script dedupes against known names (type-aware: trade words like "Photography"/"Photo" are stripped so sole-proprietor variants collide), applies the **wrong-match guard** (matched name must share a significant, non-generic token AND sit in the target state — "first Google result" is NOT a match without this), adopts the canonical Google name, keeps research-sourced website/instagram, and falls back to a city-centroid row for no-matches (`address` stays `"City, ST"` — no street digits — so the app renders the dashed approximate pin). Relay the FLAGGED list verbatim. For service-area types, a high no-match/centroid rate is expected — say so rather than treating it as failure.

## Phase 4 — User review (local CSV, the only human step)

Tell the user: open the working CSV in any spreadsheet app or editor. Only flagged rows need attention:
- `CHECK: was "X"` — resolver matched a differently-named place; confirm or fix.
- `APPROX;NEEDS_ADDRESS` — city-centroid only; paste a street address into `address` if known (fine to leave for service-area vendors).
- `NO_MATCH;NEEDS_ADDRESS` — nothing found; fix the name/city or add an address.
- `WED_UNVERIFIED` (intent-checked types) — site exists but unreadable and reviews don't rescue it; keep or delete on a glance.

Mechanically **pruned** rows (junk names, no wedding evidence in name/site/Google reviews) never reach this CSV — they're in `pruned.csv` with a reason; report the count and names, and a row is rescued by moving it back. Humans skim large lists rather than audit them (Kiara, 2026-07) — the pipeline prunes proactively so this review stays short.

Also relay any type-card review watchlist (e.g. photographers: photo-booth rentals, video-only outfits). They may freely edit/add/delete rows (keep the header row). Wait for "done", then **re-read the file fresh. Never reference or assume row numbers across a user-edit boundary** — the user may have added, deleted, or reordered rows; every operation keys on `place_id` (else normalized name). This rule is absolute; violating it corrupted data in a live session.

## Phase 5 — Upload (one confirmation gate)

```
node --env-file=.env.local .claude/skills/launchvendors/scripts/upload.mjs data/launchvendors/<slug> --type <type>            # dry-run
node --env-file=.env.local .claude/skills/launchvendors/scripts/upload.mjs data/launchvendors/<slug> --type <type> --apply    # after explicit user yes
```

Dry-run first, always. It late-resolves rows where the user added a street address (business match with guard, else coords-only geocode — an address geocode is never stored as a `place_id`), then dedupes: DB `place_id` → DB name+city (type-aware keys) → within-batch. A dedup hit against an existing DB row whose `website`/`instagram` is blank gets that column **backfilled** from the CSV row (fills blanks only, never overwrites — insert is otherwise insert-only). Show the user the dry-run summary (including any `BACKFILL` line) and get an **explicit yes** before `--apply`. This is the only confirmation gate in the pipeline — don't add others, never skip this one. The script verifies after applying (count delta + DB-wide duplicate place_id/name scan) and writes `upload-report.txt`.

Types that capture instagram require migration `0016_vendor_instagram.sql` applied (hand-run in the Supabase SQL editor); upload fails fast with that guidance if the column is missing. If the insert fails, nothing was partially written — fix and re-run; dedup makes re-runs safe.

**Website capture:** Google Text Search routinely returns an empty `websiteUri` even for vendors that have a site, so `scout`, `resolve`, and `upload`'s late-resolve fall back to a **Place Details** lookup by `place_id` whenever the search hit lacks a website (the extra call fires only for those rows). To repair vendors launched before this fallback existed:

```
node --env-file=.env.local .claude/skills/launchvendors/scripts/backfill-websites.mjs [--type <type>] [--region CO] [--limit N]           # dry-run
node --env-file=.env.local .claude/skills/launchvendors/scripts/backfill-websites.mjs --apply [--type <type>] [--region CO] [--limit N]   # write
```

**Research-sourced websites:** when research (a web listicle, a scrape CSV, or a Reddit link) surfaces a vendor's own website and Google has none, `resolve`/`ingest` keep that URL in the `website` column so the vendor page can still show a "Visit website" link. Google's own `websiteUri` always wins when present; the research URL is only a fallback. All research/scrape URLs pass through `cleanWebsite()` in `lib.mjs`, which normalizes the scheme, requires a valid dotted host, and stores **only a vendor's own domain** — social, maps/search, and wedding/review directory links are dropped rather than stored. Instagram references are the one exception: for types with `captureInstagram`, they're normalized by `cleanInstagram()` to a bare handle and stored in the `instagram` column (never in `website`).

## Phase 6 — Wrap up

Report: baseline count, researched count, resolved/approx/no-match, skipped duplicates, inserted total, and the workdir path. Remind the user that `research/` (raw pastes + web extracts) and the `provenance`/`intel` fields are the starting inventory for the recon-enrichment skill — **do not delete the workdir**.

## Hard rules (distilled from live runs)

- Headless only: files + scripts + WebSearch/WebFetch. No browser automation, no Sheets, no clipboard, no screenshots. No fetching or automating Instagram/Facebook — user pastes only.
- `place_id` is dedup truth. Type-aware name+city (normalized: lowercase, `&`→`and`, alnum-only, trade words stripped per type) is the fallback. Both are enforced in scripts — don't hand-dedupe.
- Insert semantics: `vendor_type=<profile.vendorType>`, `source='google'` iff `place_id` else `'user'`, `region=<ST>`, `location='SRID=4326;POINT(lng lat)'` (**lng first**), nulls allowed elsewhere. Direct service-role Supabase insert — there is no app bulk endpoint (`/api/places` is autocomplete-only).
- Rows without any location still upload (findable via name search) but get no map pin — call them out in the summary.
- Don't research reviews/pricing/recon depth at this stage; archive raw sources + provenance/intel tags only.
- Keep file contents out of the ORCHESTRATOR context: relay script summaries, one-line agent replies, and flagged lists — never CSVs, fetched pages, paste text, or candidate JSONL (Write-tool round-trips count as context too). Research passes run in subagents.
- If Places/Supabase errors persist after one retry, stop and report — don't improvise an alternative data path.
