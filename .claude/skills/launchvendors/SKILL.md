---
name: launchvendors
description: Launch a region's wedding-vendor directory in Wedding Recon for a given vendor type (venues, photographers, caterers, music, flowers, bridal/dress shops, wedding planners, hair & makeup artists, hotel room blocks). Sweeps Google Places for a baseline list, mines web listicles and user-pasted Reddit/Instagram content for vendors Google Maps misses, resolves candidates to canonical Google places (with a centroid fallback), adjudicates questionable rows itself, then bulk-uploads deduplicated vendor-only rows to Supabase. Use when the user wants to seed, launch, or bulk-import a vendor category for a city/region (e.g. "launch Richmond", "seed venues for Austin", "launch Denver photographers", "seed Denver caterers", "launch Denver bridal shops", "launch Denver wedding planners", "launch Denver hair and makeup", "launch Denver wedding hotel blocks").
---

# /launchvendors — seed a region's vendors for one vendor type

Goal: vendor-only placeholder rows in the `vendors` table (pins with name/location/website, plus instagram for types that capture it). **No recon entries, no photos, no schema changes** — recon enrichment is a separate later skill. Everything runs headless: prewritten scripts + web fetches + one working CSV you adjudicate and upload yourself. **Never drive a browser, Google Sheets, or the clipboard. Never fetch Instagram or Facebook** — Meta content only ever arrives as user pastes.

**Two config layers, keep them straight:**
- `scripts/lib.mjs` `TYPE_PROFILES` — mechanical config (sweep query, dedup trade-words, CSV name, instagram capture). Scripts take `--type <alias>`; omitted = venue.
- `types/<type>.md` — judgment config (research queries, extraction prompts, paste protocols, review bars). **Load the type card FIRST and follow it wherever a phase below defers to it.**

All commands run from the repo root. Scripts live in `.claude/skills/launchvendors/scripts/` and need `.env.local` (`GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) — they fail fast with a clear message if a key is missing; relay that to the user and stop.

Cost note: the whole pipeline is ~15–60 Places API calls (sweep; music runs 3 queries per anchor so ~3×, still trivial) + 1–2 per researched candidate + ≤1 Place Details (reviews) per evidence-less sweep row in wedcheck — pennies, mostly inside Google's free tier. `wedcheck` also follows up to 3 of a vendor's OWN same-host subpages when its homepage is silent; those are plain HTTP fetches (no API quota, no tokens) and they run BEFORE the paid reviews call, so they save quota more often than they cost wall-clock.

## Phase 0 — Setup (one short exchange, then no questions for the rest of the run)

1. Parse the skill argument as `<type?> <region>` (e.g. `/launchvendors photographer Denver` or `/launchvendors Richmond`). If the leading token(s) are a known type alias (venue(s), photographer(s)/photos, caterer(s)/catering, music/band/dj, flowers/florist(s), dress(es)/bridal/gown(s), planner(s)/coordinator(s), hair/makeup/"hair and makeup"/beauty/hmua, hotel(s)/hotel block(s)/lodging — see `typeProfile()` in `lib.mjs`), use it; otherwise the type is **venue**. A multi-word type phrase ("hair and makeup", "hair & makeup") normalizes to one alias token before it reaches a script. Read the type's judgment card before anything else — `types/<type>.md`, where the card names are `venue`, `photographer`, `caterer`, `music`, `flowers`, `dress`, `planner`, `hairmakeup`, `hotelblocks` (the card is named for the type, not for the profile key: `--type photographer` → profile `photos`, `--type hair` → profile `beauty` → card `types/hairmakeup.md`). It may add preflight requirements (e.g. photographers and dress shops require migration `0016` for the instagram column; hair & makeup requires `0016` **and** `0022` for the `beauty` enum value; hotel blocks require `0023` for the `hotel` enum value).
2. Normalize region to `"City, ST"`. If the state isn't obvious from the city name, ask. **The state parameterizes everything downstream** — never assume CO. A bare state ("Colorado") means a **statewide** launch: pick the largest city as the region arg and pass `--statewide <StateName>` to scout (prepends a generic state-level query — the primary net for service-area types that brand statewide and miss city-"near" queries).
3. Propose 4–8 anchor towns (suburbs/nearby towns that widen the sweep, e.g. Denver → Boulder, Golden, Littleton, Aurora, Morrison, Westminster; statewide launches span the state's metros + relevant destination towns and may run longer). One message: confirm type, region, state, anchors. **Never ask about scrape CSVs** — if the user has one they'll volunteer it (Kiara, 2026-07: "default is that it's not coming"); `ingest.mjs` handles a volunteered file. Wait for the reply, then run everything through Phase 6 without further questions.
   - This is the **only** exchange in the pipeline. After the reply, the run is yours end to end — research, adjudication, and upload all proceed without another question, and a launch+enrich request chains straight into `/enrichvendors` (Phase 6).
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

**Cross-type mentions (don't lose them, don't chase them now):** wedding threads name many vendor types at once — a budget recap lists its DJ, florist, caterer, and photographer alongside the venue. Keep THIS run's `candidates.jsonl` scoped to its own type so resolve/dedup stay clean. The other **supported** types (photographer, caterer, music, flowers, dress, planner, hair & makeup, hotel blocks — see `typeProfile()` aliases in `lib.mjs`) are **not lost**: raw pastes are archived verbatim, so a later `/launchvendors <that-type> <same-region>` run re-extracts them from the same `research/` files for free. This is a core reason the workdir must never be deleted. To give a future run a head start, additionally instruct the extractor to append any other-supported-type vendor it notices to `research/crosstype-finds.jsonl` — one `{"name","type","hint","provenance"}` line each (`type` = the alias it belongs to). That file is a plain archive: nothing auto-ingests it, but a later run (or you) can seed candidates from it instead of re-searching. Ignore vendor types the app doesn't support (officiant, rentals, bakery, shuttle) — note nothing.

## Phase 3 — Resolve candidates to Google places

```
node --env-file=.env.local .claude/skills/launchvendors/scripts/resolve.mjs data/launchvendors/<slug> --state CO --region "Denver, CO" --type <type>
```

The script dedupes against known names (type-aware: trade words like "Photography"/"Photo" are stripped so sole-proprietor variants collide), applies the **wrong-match guard** (matched name must share a significant, non-generic token AND sit in the target state — "first Google result" is NOT a match without this), adopts the canonical Google name, keeps research-sourced website/instagram, and falls back to a centroid row for no-matches — the candidate's own city hint, then `--region` (`address` stays `"City, ST"`, no street digits, so the app renders the dashed approximate pin). Pass `--region` always; without it a hintless candidate lands as `NO_MATCH` with no pin. Relay the FLAGGED list verbatim — it becomes the Phase 4 docket. For service-area types, a high no-match/centroid rate is expected — say so rather than treating it as failure.

## Phase 4 — Adjudicate the flagged rows (your judgment — do NOT wait for the user)

**Kiara, 2026-07-26: don't hold the run open for my review of questionable rows. Decide yourself — your call is usually right and a few wrong on the margin is fine.** The standing rule:

- **Think it's a `<type>` → keep.**
- **Think it isn't → remove.**
- **Think it's a valid `<type>` but there's no address → keep it on a centroid**, especially when Reddit or Google reviews vouch for it. A pin in the right city beats no vendor.

Decide from the docket alone where you can. Ask the user nothing, and never end the turn on "let me know which to keep" — if you genuinely can't call a row from its name, city, and website, spend one cheap `WebSearch` on it (delegate to a subagent if it's more than ~3 rows), then decide. Ties go to keep for a research-sourced row (a human already vouched for it) and to remove for a bare sweep row with no wedding evidence.

```
node --env-file=.env.local .claude/skills/launchvendors/scripts/adjudicate.mjs data/launchvendors/<slug> --type <type> --region "Denver, CO"
node --env-file=.env.local .claude/skills/launchvendors/scripts/adjudicate.mjs data/launchvendors/<slug> --type <type> --region "Denver, CO" \
  --remove "Portrait Studio" --remove "Corporate Catering Co" [--rescue "Vouched Florist"] --apply
```

The dry run prints the **docket** — one line per undecided row (name | city | flags | website | provenance), which is all you need to judge; **still never cat the CSV**. Add `--names` when the type card's watchlist targets rows that were never flagged — wrong-type businesses that passed the intent check clean (venue: service vendors and non-venues; dress: alterations/menswear hybrids; planner: in-house venue coordinators; photographer: video-only outfits; hair & makeup: everyday non-bridal salons and bridal-dress-shop hybrids; hotel blocks: properties with no evidence of an actual block, and hotels that are really wedding venues). It prints name | city (| subtype for split types) for every row, still far cheaper than the CSV. For split types, `--subtype "Name=dj"` retypes a row the name-only classifier got wrong (see `types/music.md`) — do that here, not by editing the CSV. `--apply` moves your `--remove` rows to `pruned.csv` (`PRUNED:judgment`), pulls any `--rescue` row back out of it, **centroid-fills every kept row that has no coordinates** (its own city first, then `--region`), and clears the review flags to `OK:auto`. Keys are `place_id` or normalized name — **never row numbers**; an unmatched or ambiguous key aborts the apply before anything is written. (This rule is absolute even now that the user isn't editing: rows move between the two CSVs. Violating it corrupted data in a live session.)

What lands on the docket: `CHECK: was "X"` (resolver matched a differently-named place — is it the same vendor?), `WED_UNVERIFIED` (site exists but unreadable, reviews didn't rescue it), `APPROX:city` / `APPROX:region` (centroid pin — keep unless the vendor itself is wrong), `NO_MATCH` (no place and no centroid yet). Apply the type card's review watchlist here (e.g. photographers: photo-booth rentals, video-only outfits) — that's a removal list, not a question list.

Mechanically **pruned** rows (junk names; wrong-type names — a planner/florist/etc. caught in another type's sweep, `PRUNED:wrong-type-name`; no wedding evidence in name/site/Google reviews) never reach the docket — they're in `pruned.csv` with a reason. Report the count and names in the wrap-up, and `--rescue` any you think the guard got wrong. The wrong-type guard is decisive only on unambiguous names and keeps hybrids, so it under-prunes rather than over-prunes; the enrich-time `NOT*` flag is the backstop for whatever slips through.

The user may still ask to look — if they do, give them the CSV path, wait for "done", and **re-read the file fresh** (they may have added, deleted, or reordered rows). That's their option to exercise, never a gate you impose.

## Phase 5 — Upload (no gate — run it)

```
node --env-file=.env.local .claude/skills/launchvendors/scripts/upload.mjs data/launchvendors/<slug> --type <type>            # dry-run
node --env-file=.env.local .claude/skills/launchvendors/scripts/upload.mjs data/launchvendors/<slug> --type <type> --apply    # then this, same turn
```

Dry-run first, always — but as a **self-check, not a gate** (Kiara, 2026-07-26): read the summary, then run `--apply` in the same turn. Don't ask, don't wait, don't end the turn on "ready to upload?"; post the dry-run summary (including any `BACKFILL` line) alongside the applied result. The dry run late-resolves rows carrying a street address but no `place_id` (business match with guard, else coords-only geocode — an address geocode is never stored as a `place_id`), then dedupes: DB `place_id` → DB name+city (type-aware keys) → within-batch. A dedup hit against an existing DB row whose `website`/`instagram` is blank gets that column **backfilled** from the CSV row (fills blanks only, never overwrites — insert is otherwise insert-only). The script verifies after applying (count delta + DB-wide duplicate place_id/name scan) and writes `upload-report.txt`.

The one thing that **does** stop you: a dry run that looks wrong — a to-insert count wildly off the resolved count, an unexpected vendor type in the by-type breakdown, or a DB error. Insert semantics make a mistake cheap to undo (insert-only, deduped, re-runnable), so weigh a surprise and decide; report what you did either way.

Types that capture instagram (photographer, dress, hair & makeup) require migration `0016_vendor_instagram.sql` applied (hand-run in the Supabase SQL editor); upload fails fast with that guidance if the column is missing. Hair & makeup additionally needs `0022_add_beauty_vendor_type.sql` (the `beauty` enum value), and hotel blocks need `0023_add_hotel_vendor_type.sql` (the `hotel` enum value) — without them Postgres rejects the insert outright. If the insert fails, nothing was partially written — fix and re-run; dedup makes re-runs safe.

**Website capture:** Google Text Search routinely returns an empty `websiteUri` even for vendors that have a site, so `scout`, `resolve`, and `upload`'s late-resolve fall back to a **Place Details** lookup by `place_id` whenever the search hit lacks a website (the extra call fires only for those rows). To repair vendors launched before this fallback existed:

```
node --env-file=.env.local .claude/skills/launchvendors/scripts/backfill-websites.mjs [--type <type>] [--region CO] [--limit N]           # dry-run
node --env-file=.env.local .claude/skills/launchvendors/scripts/backfill-websites.mjs --apply [--type <type>] [--region CO] [--limit N]   # write
```

**Research-sourced websites:** when research (a web listicle, a scrape CSV, or a Reddit link) surfaces a vendor's own website and Google has none, `resolve`/`ingest` keep that URL in the `website` column so the vendor page can still show a "Visit website" link. Google's own `websiteUri` always wins when present; the research URL is only a fallback. All research/scrape URLs pass through `cleanWebsite()` in `lib.mjs`, which normalizes the scheme, requires a valid dotted host, and stores **only a vendor's own domain** — social, maps/search, and wedding/review directory links are dropped rather than stored. Instagram references are the one exception: for types with `captureInstagram`, they're normalized by `cleanInstagram()` to a bare handle and stored in the `instagram` column (never in `website`).

## Phase 6 — Wrap up

Report: baseline count, researched count, resolved/approx/no-match, adjudication (kept / removed by judgment / centroid-filled, with the removed names), skipped duplicates, inserted total, and the workdir path. Remind the user that `research/` (raw pastes + web extracts) and the `provenance`/`intel` fields are the starting inventory for the recon-enrichment skill — **do not delete the workdir**.

**Chained handoff — don't wait for a "go."** If the user asked for enrichment too ("launch and enrich Denver photographers", "then enrich them"), invoke `/enrichvendors <type> <region>` **immediately** after this report, in the same turn. Kiara, 2026-07-26: asking for both *is* the go-ahead — never end the turn on "ready to enrich whenever you are." Say one line ("launch done — starting enrichment"), then start. The enrich skill's own gates still apply, but its Phase 0 scope becomes an announcement rather than a question (see its Phase 0 chained-run note): the batch is what you just launched. Only when the user asked for launch alone do you stop here.

## Hard rules (distilled from live runs)

- Headless only: files + scripts + WebSearch/WebFetch. No browser automation, no Sheets, no clipboard, no screenshots. No fetching or automating Instagram/Facebook — user pastes only.
- `place_id` is dedup truth. Type-aware name+city (normalized: lowercase, `&`→`and`, alnum-only, trade words stripped per type) is the fallback. Both are enforced in scripts — don't hand-dedupe.
- Insert semantics: `vendor_type=<profile.vendorType>`, `source='google'` iff `place_id` else `'user'`, `region=<ST>`, `location='SRID=4326;POINT(lng lat)'` (**lng first**), nulls allowed elsewhere. Direct service-role Supabase insert — there is no app bulk endpoint (`/api/places` is autocomplete-only).
  - **Split types** (music) fan one sweep across several `vendor_type`s: `upload.mjs` writes `vendor_type` per-row from the CSV `subtype` column (`dj`/`band`), not a fixed profile type, and dedup is scoped across all of them. Review `subtype` before `--apply` — see `types/music.md`.
- Rows without any location still upload (findable via name search) but get no map pin — call them out in the summary. A vendor you believe in should rarely be one: centroid it (Phase 4) rather than shipping it pinless.
- **No gates after Phase 0.** Phase 4 is yours to decide (keep / remove / centroid) and Phase 5 uploads itself after the dry-run self-check — never convert either back into a question, and never end a turn waiting on approval. Stop only for a broken dry run, a script error, or something genuinely outside the run's scope.
- Don't research reviews/pricing/recon depth at this stage; archive raw sources + provenance/intel tags only.
- Keep file contents out of the ORCHESTRATOR context: relay script summaries, one-line agent replies, and flagged lists — never CSVs, fetched pages, paste text, or candidate JSONL (Write-tool round-trips count as context too). Research passes run in subagents.
- If Places/Supabase errors persist after one retry, stop and report — don't improvise an alternative data path.
