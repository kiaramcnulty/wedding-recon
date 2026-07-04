---
name: launchvenues
description: Launch a region's wedding-venue directory in Wedding Recon. Sweeps Google Places for a baseline venue list, mines web listicles and user-pasted Reddit threads for venues Google Maps misses, resolves everything to canonical Google places, hands the user one CSV to review, then bulk-uploads deduplicated vendor-only rows to Supabase. Use when the user wants to seed, launch, or bulk-import venues for a city/region (e.g. "launch Richmond", "seed venues for Austin").
---

# /launchvenues — seed a region's venues

Goal: vendor-only placeholder rows in the `vendors` table (pins with name/location/website). **No recon entries, no photos, no schema changes** — recon enrichment is a separate later skill. Everything runs headless: prewritten scripts + web fetches + one CSV the user edits locally. **Never drive a browser, Google Sheets, or the clipboard.**

All commands run from the repo root. Scripts live in `.claude/skills/launchvenues/scripts/` and need `.env.local` (`GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) — they fail fast with a clear message if a key is missing; relay that to the user and stop.

Cost note: the whole pipeline is ~15–60 Places API calls (sweep) + 1–2 per researched candidate — pennies, mostly inside Google's free tier.

## Phase 0 — Setup (one short exchange, then no questions until Phase 4)

1. Region comes from the skill argument (e.g. `/launchvenues Denver area`). Normalize to `"City, ST"`. If the state isn't obvious from the city name, ask. **The state parameterizes everything downstream** — never assume CO.
2. Propose 4–8 anchor towns (suburbs/nearby towns that widen the sweep, e.g. Denver → Boulder, Golden, Littleton, Aurora, Morrison, Westminster). One message: confirm region, state, anchors, and ask whether they have a Google Maps scrape CSV to ingest. Wait for the reply, then run everything through Phase 3 without further questions.
3. Workdir: `data/launchvenues/<region-slug>/` (gitignored). Scripts create it.

## Phase 1 — Baseline (scripts, no judgment)

```
node --env-file=.env.local .claude/skills/launchvenues/scripts/scout.mjs data/launchvenues/<slug> --region "Denver, CO" --anchors "Boulder, CO;Golden, CO;..."
node --env-file=.env.local .claude/skills/launchvenues/scripts/ingest.mjs data/launchvenues/<slug> <scrape.csv>   # only if user provided one
```

Rows arrive pre-matched with `place_id`. Relay the one-line summaries. **Do not cat venues.csv into context** — trust the counts.

## Phase 2 — Research (the only judgment step)

### Web listicles (do inline)
Run 3–5 WebSearch queries: `{region} wedding venues list`, `{region} unique unconventional wedding venues`, `{region} affordable budget wedding venues`, `best hidden gem wedding venues {region}`. WebFetch the top listicle/aggregator hits (Here Comes The Guide, local blogs, photographer guides, **Zola**). Use this exact fetch prompt, substituting region/state/domain:

> List every wedding venue or event space on this page located in or near {REGION}, {ST}. Output ONLY JSON lines, one per venue: {"name":"...","hint":"City, ST","provenance":"web:{domain}","intel":"<any pricing, capacity, or package detail the page gives, else omit>"}. No commentary, no markdown.

Save each fetch's raw output to `research/web-<domain>.txt` (Write tool), then append only the `{...}` lines to `candidates.jsonl` (Bash heredoc `cat >>`). The `intel` field costs nothing here and doubles as a region pricing digest for the later `/enrichvenues` pass.

**Source quirks (measured, not assumed):** Zola and most blogs/guides fetch fine. **The Knot** — its `/marketplace/…` listing pages reliably time out (~60s, heavy JS + bot-throttle), but its `/content/<region>-wedding-venues` **articles** fetch fine, and `WebSearch` with `allowed_domains: ["theknot.com"]` returns venue names + summaries without touching the slow page — prefer those two over the marketplace URL. A WebFetch timeout is transient/page-specific: skip that URL and move on, don't conclude the domain is blocked.

### Reddit (user paste protocol → delegate extraction)
Reddit blocks both the Anthropic crawler and browser-connector navigation — **do not attempt to fetch it**. Ask the user to search Reddit themselves (`site:reddit.com {region} wedding venue` etc.), and for each good thread: select-all, copy, paste into chat. For every paste, immediately save it **verbatim** to `research/reddit-NN.txt` — do not summarize, extract, or respond to its content yet (raw threads are hard to re-acquire; the enrichment skill needs them). Loop until the user says done.

Then spawn the extractor (skip the spawn and do it inline only if you are already Sonnet-class or better):

Agent tool → `subagent_type: "general-purpose"`, `model: "sonnet"`, prompt:

> Read every `reddit-*.txt` file in `<abs workdir>/research/`. They are raw Reddit-thread pastes about wedding venues near {REGION}, {ST}. Extract every distinct venue/event space that could host a wedding (restaurants, parks, rec centers, galleries, breweries, hotels, campuses count). Exclude pure service vendors (florist/DJ/photographer/planner/caterer), venues clearly in another state, and generic non-places ("a park", "an Airbnb"). Append one JSON line per venue to `<abs workdir>/candidates.jsonl`: {"name":"...","hint":"<city/area if stated or inferable, else omit>","provenance":"reddit:<filename>"}. Dedupe within your output; do not modify existing lines. Reply with only the count appended and any names you were unsure about.

## Phase 3 — Resolve candidates to Google places

```
node --env-file=.env.local .claude/skills/launchvenues/scripts/resolve.mjs data/launchvenues/<slug> --state CO
```

The script dedupes against known names, applies the **wrong-match guard** (matched name must share a significant token AND sit in the target state — "first Google result" is NOT a match without this), adopts the canonical Google name, and falls back to a city-centroid row for no-matches (`address` stays `"City, ST"` — no street digits — so the app renders the dashed approximate pin). Relay the FLAGGED list verbatim.

## Phase 4 — User review (local CSV, the only human step)

Tell the user: open `data/launchvenues/<slug>/venues.csv` in any spreadsheet app or editor. Only flagged rows need attention:
- `CHECK: was "X"` — resolver matched a differently-named place; confirm or fix.
- `APPROX;NEEDS_ADDRESS` — city-centroid only; paste a street address into `address` if known.
- `NO_MATCH;NEEDS_ADDRESS` — nothing found; fix the name/city or add an address.

They may freely edit/add/delete rows (keep the header row). Wait for "done", then **re-read the file fresh. Never reference or assume row numbers across a user-edit boundary** — the user may have added, deleted, or reordered rows; every operation keys on `place_id` (else normalized name). This rule is absolute; violating it corrupted data in a live session.

## Phase 5 — Upload (one confirmation gate)

```
node --env-file=.env.local .claude/skills/launchvenues/scripts/upload.mjs data/launchvenues/<slug>            # dry-run
node --env-file=.env.local .claude/skills/launchvenues/scripts/upload.mjs data/launchvenues/<slug> --apply    # after explicit user yes
```

Dry-run first, always. It late-resolves rows where the user added a street address (business match with guard, else coords-only geocode — an address geocode is never stored as a `place_id`), then dedupes: DB `place_id` → DB name+city → within-batch. Show the user the dry-run summary and get an **explicit yes** before `--apply`. This is the only confirmation gate in the pipeline — don't add others, never skip this one. The script verifies after applying (count delta + DB-wide duplicate place_id/name scan) and writes `upload-report.txt`.

If the insert fails, nothing was partially written — fix and re-run; dedup makes re-runs safe.

## Phase 6 — Wrap up

Report: baseline count, researched count, resolved/approx/no-match, skipped duplicates, inserted total, and the workdir path. Remind the user that `research/` (raw threads + web extracts) and the `provenance` column are the starting inventory for the future recon-enrichment skill — **do not delete the workdir**.

## Hard rules (distilled from the live Denver run)

- Headless only: files + scripts + WebSearch/WebFetch. No browser automation, no Sheets, no clipboard, no screenshots.
- `place_id` is dedup truth. Name+city (normalized: lowercase, `&`→`and`, alnum-only) is the fallback. Both are enforced in scripts — don't hand-dedupe.
- Insert semantics: `vendor_type='venue'`, `source='google'` iff `place_id` else `'user'`, `region=<ST>`, `location='SRID=4326;POINT(lng lat)'` (**lng first**), nulls allowed elsewhere. Direct service-role Supabase insert — there is no app bulk endpoint (`/api/places` is autocomplete-only).
- Rows without any location still upload (findable via name search) but get no map pin — call them out in the summary.
- Don't research reviews/pricing/recon at this stage; archive raw sources + provenance tags only.
- Keep file contents out of context: relay script summaries and flagged lists, not CSVs.
- If Places/Supabase errors persist after one retry, stop and report — don't improvise an alternative data path.
