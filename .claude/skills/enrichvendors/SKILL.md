---
name: enrichvendors
description: Enrich a region's seeded vendors of one vendor type (venues, photographers, caterers, music, flowers, bridal/dress shops, wedding planners, hair & makeup artists, hotel room blocks) in Wedding Recon with bot-authored recon entries. Harvests Google Places reviews + vendor websites, compresses research into per-vendor dossiers by script, drafts human-voiced recon entries (1-3 per vendor, richness-driven) via cheap single-turn worker calls, and uploads them under user-approved, internally-flagged bot accounts. Photos are an optional decoupled pass. Use when the user wants to enrich, backfill, or bulk-add recon for a region's vendors (e.g. "enrich Denver", "add recon for the Austin venues", "enrich the Colorado caterers", "enrich the Denver bridal shops", "enrich the Denver wedding planners", "enrich the Denver hair and makeup artists", "enrich the Denver wedding hotel blocks").
---

# /enrichvendors — bot recon for a region's vendors, one type at a time (v2)

Goal: recon entries authored by `is_bot`-flagged accounts that read like real couples' research notes. Headless only: prewritten scripts + per-batch CSVs the user reviews. **Never drive a browser, Sheets, or the clipboard.**

**Two config layers:** `scripts/etype.mjs` holds the mechanical per-type profile (CSV columns, DB vendor_type, harvest/dossier regexes, flags — venue is the default; **`music` selects two vendor_types, `dj` + `band` ("Live music"), and enriches both in one run** — content is subtype-agnostic); `references/` holds the judgment config: shared `common/draft-contract.md` + `common/entry-rules-core.md` + `voice-cards.md`, plus a short per-type `references/<type>/type-rules.md` and `photo-rules.md` (type dirs: venue, photographer, food, music, flowers, dress, planner, hairmakeup, hotelblocks). Every script takes `--type <venue|photographer|caterer|music|flowers|dress|planner|hairmakeup|hotelblocks>` (aliases accepted — `hair`, `makeup`, `beauty`, `hmua` all reach the single joint hair-&-makeup type; `hotel`, `blocks`, `lodging` reach the hotel-block type); omitted = venue. **Load the type's reference cards before running.**

All commands run from the repo root. Scripts live in `.claude/skills/enrichvendors/scripts/` and need `.env.local` (`GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); they fail fast with a clear message — relay it and stop. If Places/Supabase errors persist after one retry, stop and report.

References: `common/draft-contract.md` + `common/entry-rules-core.md` + `references/<type>/type-rules.md` + shared `voice-cards.md` are inlined into call files BY SCRIPT (no agent reads them separately); `references/<type>/photo-rules.md` is for optional photo screeners; `research-guide.md` is the orchestrator's reddit-paste protocol.

## Cost doctrine (v2 — from the 100-venue postmortem)

The v1 run burned ~2M tokens on 100 venues. Three sinks, three rules:

1. **Turns are the cost, not agents.** An agent's every tool call re-reads its whole growing context; v1 workers made 50-80 calls each. v2 draft calls are **single-turn**: read ONE pre-assembled file, write ONE csv, reply ONE line. Never give a draft worker research tools, web access, or multiple files.
2. **Scripts compress, models write.** `dossier.mjs` regex-cuts each vendor's harvest/pages/digests/reddit to a ~500-token dossier for free. No agent ever reads `harvest.json`, `page-*.txt`, whole digests, or whole threads. No `extract.md` provenance files — the `sources` column is the provenance.
3. **Never re-touch every row.** No global polish pass: voice rules ride inside the call file; `upload.mjs` dry-run + `pipeline.mjs status` validate mechanically for free. Fix ONLY flagged rows (≤5: orchestrator edits inline; more: one small targeted call).

Budgets (drafting, Sonnet): call file ≈ 3k header + ~600/vendor; ~14-18k/call of 25 vendors (the default) ⇒ **~2k tokens/vendor, 300+ fits one session.** Multi-entry vendors (batch assigns 1-3 by richness) add only ~200 OUTPUT tokens per extra entry — the dossier is already in the worker's context, which is why the old separate RICH pass (header + dossier re-read per second entry) was retired. **Preferred for full-size runs: API drafting mode** (`--mode api` + `draft.mjs`, see Phase 2) — moves drafting off the subscription onto a metered key at batch rates (~$1-1.50/300-vendor run; design + cost controls in `docs/anthropic-batch-drafting.md`). Harness draft-workers remain the fallback (no key needed; fine for pilots/spot re-drafts). Orchestrator stays thin: `pipeline.mjs` does batch/status/merge/verify — do not hand-write per-run scripts for these. Worker replies are one line; nothing bulk ever enters the orchestrator context.

## Phase 0 — Scope (one exchange, human gate #1)

1. Parse the argument as `<type?> <region>` (e.g. `/enrichvendors photographers Colorado`, `/enrichvendors caterers Denver`, `/enrichvendors bridal Denver`, `/enrichvendors hair and makeup Denver`; no type = venue). Normalize region; the **state** parameterizes rosters. Verify prereqs: vendors of that type seeded; migration `0012` applied (1-row select of `profiles.is_bot`); for photographer, dress, and hair-&-makeup runs also `0016` (`vendors.instagram`, which harvest reads into dossiers — hair & makeup artists often have a thin site and a rich IG, so the handle earns its place in the dossier). On error ask the user to run it and stop.
2. Workdir `data/enrichvendors/<type>-<region-slug>/` (one per type+state). Legacy venue workdirs live in `data/enrichvenues/<region-slug>/` — keep using those for venue runs (reddit archive + digests live there).
   - **Name it to match the LAUNCH workdir.** Archived research is found at `data/launchvendors/<name>/research`, and the two skills often disagree on `<name>`: `--type hairmakeup` has profile key `beauty`, so launch may have written `beauty-colorado` while enrich defaults to `hairmakeup-colorado`. `researchDirs()` (etype.mjs) now tries the basename **plus every alias of this type** against the same region slug, so either spelling resolves — but a genuinely odd name still won't. **Verify, don't assume: `roster.mjs` prints `reddit threads on file: N`, and a 0 right after a launch that archived pastes is the tell** (it now also lists every directory it searched). There is no error for this — the run just drafts the whole region with no Reddit content. Never "fix" it by copying `reddit-*.txt` into the enrich workdir: both dirs are scanned, so copies double every excerpt.
3. Run `roster.mjs --type <type>` for the status picture (unenriched counts, bot headroom, reddit coverage). Note: roster.mjs counts only bot recon; `pipeline.mjs batch` enforces the real rule — **vendors with NO recon of any kind**.
4. **Coverage default (Kiara 2026-07-17): "enrich <region>" means ALL unenriched vendors of that type, not one batch.** The ~300-vendor/session bar sets the BATCH size, not the scope — plan `ceil(unenriched / 300)` sequential batches up front, say so in the scope message ("N unenriched → 2 batches"), and run them back-to-back unless the user trims scope. Never end a run with an unmentioned remainder.
5. ONE message: proposed batch size (first-ever region+type → pilot ~10; else up to `bots × 50`), bot roster state (rosters are per-STATE at `data/enrichvenues/rosters/<ST>.json` and shared across vendor types; new usernames need approval — see Phase 5), and ask for Reddit thread pastes (protocol in `research-guide.md`: save each paste **verbatim** to `research/reddit-NN.txt`, then re-run the slice pass). Launch-workdir research (`data/launchvendors/<type>-<region>/research/`) is picked up automatically for BOTH scoring and slices — do **NOT** copy its `reddit-*.txt` into the enrich workdir (both dirs get scanned; copies double every excerpt — measured live 2026-07-09). Only research that exists nowhere else (new pastes, IG transcriptions the fallback dir lacks) goes in the enrich workdir's `research/`. Then run through Phase 3 without questions.
6. **Chained run** (`/launchvendors` just finished this session because the user asked for both — see its Phase 6 handoff): **don't ask for a go-ahead, and don't re-ask the scope question.** Kiara, 2026-07-26: asking for both is the go-ahead. Scope = the vendors that run just seeded (batch them per step 4), roster = the existing state roster, research = the launch workdir's `research/` (already picked up automatically). Post step 5's message as an *announcement* — "enriching the N <type> just launched, M batches, roster <ST>" — and keep going. Gates #2-#4 are unchanged (launch's own upload no longer gates at all — that's its rule, not a precedent for these); only the "shall I start" pause disappears.

## Phase 1 — Harvest → dossiers (scripts, ~free)

```
node --env-file=.env.local .claude/skills/enrichvendors/scripts/harvest.mjs <workdir> --region <ST> --type <type> --venues "Name 1;Name 2;..."
node .claude/skills/enrichvendors/scripts/dossier.mjs <workdir> --type <type>
```

### Harvest is tuned for the Explore FILTER attributes, not just prose (2026-08-01)

The filters need specific, structured facts (capacity, price + its basis, catering policy,
lodging, service style). Three things in the harvest exist to serve that, and they should
be kept working when this code is touched:

- **PDF rate cards are fetched and read** (`pdf-text.mjs`, dependency-free). Vendors very
  often publish pricing ONLY as a PDF. The harvest used to record the link and stop,
  which put a hole in the corpus exactly where pricing lives — measured at **112/679 CO
  venues with an unfetched PDF, 24 explicitly pricing-named**. Salida SteamPlant read as
  "no pricing published" while its own site served a wedding rate card; reading it yields
  `$4,000-$6,500` **and** `Max Guest Count 180` **and** a getting-ready room.
- **Subpages and PDFs are RANKED by filter relevance** before the crawl budget is spent
  (`filterScore` in `harvest.mjs`), so a pricing/capacity/FAQ page beats whatever the nav
  listed first. Previously it was first-N-found.
- **The dossier keeps bare table cells.** PDF rate cards are tables: the price extracts as
  its own short line (`$6500`). The old 20-char floor dropped precisely those headline
  numbers. Short lines are now kept when they carry a 3+ digit figure or a capacity
  phrase, capped at 12 per vendor so a fee schedule ($3 corkage, $15 easel) can't dominate
  — and cheap fees are excluded on purpose, since they make convincing false price floors.

**A HEAD preflight runs before every PDF download**, and the limiter is TIME, not size.
Image streams are skipped by dictionary inspection before inflating, so parse cost is no
longer size-driven — a 48MB brochure parses in 0.03s. The size cap (40MB) only bounds
memory; the 45s download deadline is the real budget, so a large-but-fast PDF is read
while a large-and-slow one is cut off (the same 48MB file took **168s** to download).
Don't reintroduce a tight size cap "for speed" — measure the download, not the bytes.
**And do not filter PDFs to those with a promising filename**: Squarespace and Wix serve
them under opaque hashes (`8ecfd3_c33011dc….pdf`), and one such file held San Sophia
Overlook's rates. Rank by name, never exclude by it.

Expect little from the very large ones regardless: PDFs are big *because* they're
image-heavy, so they skew toward scans and photo lookbooks. Mount Vernon's 48MB "FAQ" is a
scan whose text layer is `H B B B B G B G G G` — the language guard correctly rejects it.

**The dossier carries a `## filter facts` block, so no future market needs a backfill.**
The pricing pass answers "what does it cost"; for a long time it was the whole dossier,
which meant a crawl could contain "outside catering allowed" or "sleeps up to 40" and the
dossier would silently drop it. Measured on 345 CO venues, indoor/outdoor appeared in 28%
of RAW crawled text but only 7% of dossiers; lodging 37% vs 17%; alcohol policy 18% vs 2%.
`FILTER_FACT` in `dossier.mjs` now mines those lines for every type in one shared pattern —
keep it shared, because carrying a few irrelevant lines is far cheaper than dropping a
real one, and a dropped fact is invisible downstream (it just looks like the vendor never
said it). Re-running `dossier.mjs` over an existing region is free and picks these up.

**`--sites-only` re-crawls websites without re-billing Google Places**, preserving the
existing reviews/rating from `harvest.json`. Use it for a filter-attribute pass over an
already-harvested region — site crawling costs time, not money. This is the ONLY sane way
to re-crawl at scale; a plain re-run re-issues a paid Places call per vendor for data you
already have.

**Some attributes need the crawl, not the compression.** Catering policy sits in ~8% of
raw crawled venue text and moved only 1%→2% from better mining, because the old harvest
fetched the first 5 subpages it found and FAQ/policy pages were often never fetched. That
is what `filterScore` ranking fixes on a fresh crawl — mining can only recover what was
downloaded.

**Extraction fails honestly, and that distinction is load-bearing.** A scan, a CID-font
disagreement, or a mis-decode yields nothing rather than a guess, and `dossier.mjs` labels
it `UNREADABLE ... treat as unknown, NOT as "no pricing published"` — a draft that reads an
unread rate card as "they don't publish pricing" is a factual error. Three guards enforce
this, and all three exist because a real file defeated the previous one:

- **Never merge conflicting `ToUnicode` maps.** In SteamPlant's file glyph 23 meant `0` in
  one font and `4` in another; a naive merge silently rewrites digits in a price list.
- **Language check** (`readsAsEnglish`) — the decisive test. A wrong glyph map still emits
  letter-shaped tokens: Telluride's PDF gave 1,059 words of 4+ letters and **zero**
  instances of "the"/"and"/"for". Real prose is dense with function words.
- **Money-shape check** (`moneyLooksSane`) — for the narrower case where prose decodes but
  digits (often a separate subset font) do not. Judge only `$`-followed-by-digit tokens:
  counting `$` in leftover binary once condemned a perfectly good file, and a lost space
  ("$3,000wedding") is a formatting artifact, not corruption.

Once per region+type (fixed cost): the **region pricing pass** — one Sonnet subagent WebSearches `<region> <vendor type> prices/packages`, fetches ~5 multi-vendor sources, saves per-vendor digests to `research/pricing-web-<domain>.txt`, replies one line. **Same pass, negative-signal sweep (harvest only — this feeds free-text recon notes; there is no user-facing "watch-outs" surface):** for the region's top ~20 vendors by Google review count (`ratingCount` in each vendor's `harvest.json`), also run complaint-flavored `"<vendor>" reddit` searches (problems / disappointed / overpriced / avoid) and save those digests as `pricing-web-*.txt` too. The review corpus skews positive (Places returns only 5 "most relevant"; sites and listicles are promotional), so this sweep is where the sourced warts come from — `dossier.mjs` lifts the negative fragments into each vendor's internal `## watch-outs` block, and the draft rules require carrying at least one into an entry's `notes`. Launch-time research intel (candidates.jsonl `intel` fields) can be script-converted into a `research/pricing-web-launchintel.txt` digest — dossiers pick up any `pricing-web-*.txt` automatically. And whenever the reddit archive changed: `roster.mjs --type <type> --slices` (or the thread-digest subagent for messy threads) so per-vendor `reddit-slice.txt` excerpts exist. Re-run `dossier.mjs` after either.

## Cloud/web runs — the split workflow

Cloud sessions (Claude Code on the web) can run **everything except harvest's vendor-site
crawl**: sandbox egress is allowlist-only (None/Trusted/Custom), and the open web —
arbitrary vendor domains — can't be allowlisted. Places data (`*.googleapis.com`) IS
default-allowlisted, so a cloud harvest technically runs but produces thinner dossiers
(reviews only, no site pricing pages). Don't accept that silently for a real run.

- **Environment prereqs (one-time, web UI):** secrets `NEXT_PUBLIC_SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_PLACES_API_KEY`, `ANTHROPIC_BATCH_API_KEY`;
  network access **Custom** + "include default list" + `*.supabase.co`. The committed
  SessionStart hook (`.claude/hooks/session-start.sh`) materializes `.env.local` from
  those secrets, so every `--env-file=.env.local` command here runs unchanged.
- **Local half (per new region+type, at Kiara's machine):** Phase 0 pastes + `harvest.mjs`
  + pricing digests, then hand off the research dir on the session branch:
  `git add -f data/enrichvendors/<workdir>/research && git commit && git push`.
  The dir is gitignored on purpose — force-add it **only on an enrichment work branch**
  (scraped site text + review excerpts stay out of `main`; these branches don't merge).
- **Cloud half (everything else, any batch, any later session):** `dossier.mjs` (pure
  filesystem) → `pipeline.mjs batch --mode api` → `draft.mjs submit/status/collect` →
  merge → validate → the usual human gates. Harvest re-runs for *new* vendors need the
  local half again; batches over already-harvested vendors need nothing local.

## Phase 2 — Batch + single-turn draft calls (Sonnet)

```
node --env-file=.env.local .claude/skills/enrichvendors/scripts/pipeline.mjs <workdir> batch \
  --type <type> --region <ST> --roster data/enrichvenues/rosters/<ST>.json --size N --batch <id> [--per-call 25] [--exclude "Name;Name"] [--mode harness]
```

`batch` selects the N richest vendors of the type with **no recon of any kind**, defers same-named twins (and skips twin research collisions and filename/url-looking vendor names with a warning — the latter need their vendors row fixed, then re-run), and assigns each vendor **1–3 entries from its dossier's actual richness** ($ figures / reviews / reddit / digests — Kiara 2026-07: variance follows content found, never a forced quota), with a DISTINCT bot and collected-date per entry (≤50/bot/run). It writes `drafts/<id>-call-NN.md` files with the TYPE'S rules + voices + dossiers **inlined** (a vendor's entries share one call, so extra entries cost only output tokens) and a FLAT manifest (one row per vendor+entry slot). It fails fast listing any vendor missing a dossier.

**API drafting is the DEFAULT** (needs `ANTHROPIC_BATCH_API_KEY` in `.env.local`) — `batch` writes API-mode call files unless you pass `--mode harness`. Then, instead of spawning workers:
```
node --env-file=.env.local .claude/skills/enrichvendors/scripts/draft.mjs <workdir> submit  --batch <id>          # cost-gated (--max-cost 12 default); --max-tokens defaults to 96000 so entry-dense call files don't truncate; --dry-run to preview
node --env-file=.env.local .claude/skills/enrichvendors/scripts/draft.mjs <workdir> status  --batch <id> --wait   # polls to ended (usually <1h)
node --env-file=.env.local .claude/skills/enrichvendors/scripts/draft.mjs <workdir> collect --batch <id>          # writes worker JSONLs + <id>-flags.json, prints actual $ cost
```
`collect` refuses truncated/errored results and prints the exact `submit --calls "NN"` resubmit command; batch ids persist in `drafts/<id>-batchapi.json` so every step is resumable. Reply-line flags arrive in `drafts/<id>-flags.json` instead — process them identically (below). Never point draft.mjs at `ANTHROPIC_API_KEY`/subscription auth. **If `ANTHROPIC_BATCH_API_KEY` is absent, `draft.mjs submit` fails fast — fall back to `batch --mode harness` + harness workers below.**

**Harness mode (fallback — no API key, or `--mode harness`):** spawn one agent (`subagent_type: "draft-worker"`, background OK) per call file — that agent type is `model: sonnet` with tools **gated to Read + Write**. Prompt, verbatim short: *"Read `<workdir>/drafts/<id>-call-NN.md` and follow it exactly. It contains every rule and all research. Write the output file it specifies in one Write, then reply with the one line it specifies. Do not read anything else back."* Workers get NO gap searches — a vendor with no pricing in its dossier gets an honest no-price row (plain varied wording per `common/entry-rules-core.md`, never the retired "Quote only"). **Workers write JSON Lines** (`drafts/<id>-worker-NN.jsonl`) — JSON escaping ends the CSV-corruption failure class that forced a full repair pass in the 2026-07 run; `merge` still emits the reviewable `recons-<id>.csv`.

Collect flags from the worker reply lines — or, in API mode, from `drafts/<id>-flags.json` (defined in `common/draft-contract.md`; the wrong-type flag name is per type). Wrong type comes in **two tiers — the trailing `!` is the whole difference:**
- **`NOTAVENUE!`/`NOTPHOTOG!`/`NOTCATERER!`/`NOTMUSIC!`/`NOTFLORIST!`/`NOTDRESS!`/`NOTPLANNER!`/`NOTBEAUTY!`/`NOTHOTEL!:<slug>`** (STRONG — positive evidence, **auto-remove**) — the worker found affirmative proof this is a different KIND of business (planner, rental co, shop, officiant, tour operator; for a dress run: a guest-attire-only / menswear / preservation shop with no bridal gowns; for a hair-&-makeup run: a nail salon, barbershop, med spa, lash- or brow-only bar, or permanent-makeup studio; for a hotel-block run: a property that is really a wedding VENUE with ballroom/ceremony space — venue supersedes hotel — or a hostel/RV park/rental agency) OR that it has no capacity for the type's core service (a stay-only hotel / dine-in-only restaurant in a venue run — all per-night-stay pricing, summary + every review about rooms/meals, zero event/banquet/ceremony/rental/capacity language). Remove without per-vendor vetting: `node --env-file=.env.local .claude/skills/enrichvendors/scripts/remove-vendors.mjs --strong-from drafts/<id>-flags.json --manifest drafts/<id>-manifest.json` (dry-run) then add `--apply`. This is safe to automate ONLY because the script **refuses any user-created vendor (`created_by` set) or any vendor with non-bot recon** — a mistaken strong flag can at worst drop a bot-enriched seed, recoverable from the launch CSV. Repeat `--manifest` per batch.
- **`NOTAVENUE:`/`NOTPHOTOG:`/`NOTCATERER:`/`NOTMUSIC:`/`NOTFLORIST:`/`NOTDRESS:`/`NOTPLANNER:`/`NOTBEAUTY:`/`NOTHOTEL:<slug>`** (SOFT — a report, **never an auto-delete; workers over-fire it**) — 2026-07 run: real venues like Keystone Ranch, Park Hyatt Beaver Creek, Ski Tip Lodge, and golf clubs got flagged because their dossiers lacked wedding-specific text; that situation is THIN, not NOT*. The hair-&-makeup equivalent is an everyday hair salon whose crawled pages never mention weddings — also THIN, not NOT*. **Hotel blocks are the one deliberate exception**: a real hotel with no evidence it takes wedding room blocks IS a soft `NOTHOTEL:` (the type's whole premise is documented blocks), and the orchestrator vets it before removing — block language often just hides on an uncrawled subpage. The worker drafted normal rows for these — **keep the rows for anything that could plausibly host an event.** Only for unambiguous other-type businesses (planners, rental companies, caterers, officiants, tour operators, day-use attractions, chambers, schools, salons): build a vetted list from the dossiers, show the user, then `remove-vendors.mjs --id <uuid> [...]` (or `--ids-file`). Its seed-only/bot-only guards catch fuzzy-name mistakes ("Cowboy & the Rose Catering" once nearly deleted "The Rose Event Center"), but still eyeball the dry-run.
- **After ANY removal:** re-type instead when a vendor clearly belongs to another supported type. If vendors are deleted AFTER drafting, also drop their rows from the batch CSV/manifest before upload (dead `vendor_id`s fail the upload dry-run). The cheapest way to catch stragglers is to key the CSV against the live DB rather than against your own list of removals.
  `remove-vendors.mjs` also **syncs the launch workdir**: deleted rows are moved out of `data/launchvendors/<dir>/vendors.csv` into that dir's `pruned.csv`. Without this the launch CSV still lists them and the next `launchvendors upload.mjs --apply` re-inserts every one (2026-07-29: 5 removals showed up as `TO INSERT: 5` afterwards). It also keeps `resolve.mjs`'s pruned-guard suppressing them. Workdirs cleaned before this existed need it by hand — a launch dry-run printing a non-zero `TO INSERT` on an already-uploaded workdir is the symptom.
- **`THIN:<slug>`** (data floor) — nothing real to write; the vendor ships with zero entries this run. Report the list; do NOT re-spawn or pad.
- **`SHORT:<slug>`** — the worker wrote fewer than the assigned entries (dossier couldn't honestly support them). Expected occasionally; report, don't pad.

**Persist flags between batches:** append every THIN/NOT*/SHORT-to-zero slug from worker replies to `drafts/flags.txt` (one `<flag> <slug>` per line). A follow-up batch in the same workdir passes those vendors to `batch --exclude` — re-selecting them re-reads ~500-token dossiers per vendor only to re-earn the same flags (measured 2026-07: wco2 re-selected ~50 wco1-flagged vendors; every one re-flagged identically, ~1 full call file of pure waste).

## Phase 3 — Merge + validate (script; spot-fix only)

```
node --env-file=.env.local .claude/skills/enrichvendors/scripts/pipeline.mjs <workdir> status --type <type> --batch <id>
node --env-file=.env.local .claude/skills/enrichvendors/scripts/pipeline.mjs <workdir> merge  --type <type> --batch <id>
node --env-file=.env.local .claude/skills/enrichvendors/scripts/upload.mjs <workdir> --type <type> --roster <roster> --csv recons-<id>.csv   # dry-run validation
```

**`status` is the real quality gate — read its second line.** It now reports `process-tells`, `research-artifact narration`, and `bullet-style notes` alongside the field checks, using the same regexes `upload.mjs` fails on. Fix these here, before `merge`: they are cheap to repair in the JSONLs and expensive afterwards. (2026-07-29: `status` had no process-tell check at all, so 21 of them plus 69 bullet-style rows passed it cleanly and only surfaced at the upload gate, after the CSV was built — a 76-row rewrite pass.) The voice failures that matter most in practice are **research-artifact narration** ("site didn't load (404)", "reviews go back to 2020-2023") and **notes that open with a dash**; both read as a scraper's scratchpad rather than a person's notes.

**Worker "failed"? Check the files before re-spawning.** A worker that errors out (session/rate limit especially) usually already landed its one Write — the JSONL is complete and only the final one-line reply died. Run `status --batch` FIRST and re-spawn only call files whose rows are ACTUALLY missing from disk (THIN/NOTTYPE/SHORT-flagged slots are intentionally missing — don't). Measured 2026-07: 7 workers reported a session-limit error, all 7 had complete JSONLs on disk; blind re-spawning burned ~600k tokens re-deriving identical output. If the subscription session cap is hit, the JSONLs are the checkpoint — wait for the reset, `status`, and continue from Phase 3; nothing is lost.

Validation failures/near-dup warnings: fix only those rows (≤5 inline, else one small call). **Make it ONE combined pass:** extract every offender — banned phrases, process-tell, AND near-dup/shared-phrasing rows (both boilerplate filler reused across vendors and same-venue sibling echoes) — into one JSON keyed by `vendor_id|bot`, hand one Sonnet agent the whole rephrase, apply by key. Sequential fix passes (banned first, dups later) re-bill validation and agent spin-up for nothing. Two entries citing the same *published price fact* is acceptable residue, not a dup to chase. Non-venue, non-hotel rows additionally hard-require `service_region` (hotels are a fixed property, not a service-area vendor, so the type carries no `service_region` column).

(The old worker-flagged `RICH` second-entry pass is retired — richness now sets each vendor's entry count up front in `batch`, inside the same call file, which is strictly cheaper: the dossier is read once and extra entries only cost output tokens.)

## Phase 4 — User review (human gate #2)

`merge` already printed samples and wrote `recons-<id>.backup.csv`. Tell the user to edit `recons-<id>.csv` freely. On "done", **re-read the file fresh — never assume rows survived the edit**.

## Phase 5 — Bots (human gate #3: roster approval)

State roster `data/enrichvenues/rosters/<ST>.json` (`[{ "key": "botN", "username": "..." }]`). **Bots never cross states; the state roster IS shared across vendor types** (a real couple researches venues and photographers alike — cross-type reuse is a feature). New usernames: reddit-plausible anonymous handles, skew female, avoid real first+last names. Search/scout-style handles (`vendorscout`, `rockymtnsearch`) and occasional wedding-themed ones (`mountainwedding26`) are FINE — Kiara 2026-07-17: real users are searching/scouting for vendors too; don't over-sanitize toward generic-hiker names. **The user approves every new username before any account is created. No exceptions.**

```
node --env-file=.env.local .claude/skills/enrichvendors/scripts/bots.mjs <workdir> --roster <roster>            # dry-run
node --env-file=.env.local .claude/skills/enrichvendors/scripts/bots.mjs <workdir> --roster <roster> --apply    # after approval
```

## Phase 6 — Upload (human gate #4: explicit yes on dry-run)

Show the dry-run summary; get an **explicit yes** before `--apply` (a user may pre-authorize an unattended run — record that authorization before starting). Idempotent by `(author_id, vendor_id)`; `created_at` auto-backdates.

```
node --env-file=.env.local .claude/skills/enrichvendors/scripts/upload.mjs <workdir> --type <type> --roster <roster> --csv recons-<id>.csv --apply
node --env-file=.env.local .claude/skills/enrichvendors/scripts/pipeline.mjs <workdir> verify --type <type> --roster <roster> --csv recons-<id>.csv [--fix-gaps]
```

Supabase Storage intermittently drops uploads; the converging loop is `verify --fix-gaps` → `upload --apply` → `verify`, until verify exits 0. Two consecutive no-progress failures → stop and report. Report counts + workdir; **do not delete the workdir.**

## Photo pass (decoupled — ON by default)

**Runs by default on every enrichment run** (Kiara, 2026-07-22) — the photo pass is no longer opt-in; run it unless the user explicitly opts out (e.g. "no photos"). Still decoupled and **between Phase 3 and Phase 6** (or, if entries were already uploaded photo-less, attach after the fact via the `verify --fix-gaps` → `upload --apply` → `verify` loop). It uses cheap Haiku screeners + a modest storage/egress cost; the orchestrator never views images, so it does not affect the drafting token budget. Rules are PER TYPE (`references/<type>/photo-rules.md`). Venue target: 1-2 photos on ~75% of entries. **Photographer target: ~3 per vendor that has that many qualifying images** (photos are critical for this type — Kiara 2026-07); run `photos.mjs --type photographer --per-venue 5` so screeners can keep ~3. **Hair & makeup target: 2-3 CLOSE-UPS of brides or bridal-party members** where the hair/makeup is readable in frame (also `--per-venue 5`); wide venue shots where the face is small are drops. Hotel target: 1-2 (guest-room/property shots; ballroom and event-space shots are DROPS — that's the venue category's product). Caterer/music/flowers/dress/planner target: 1-2 (food shots / performance shots / arrangement shots / gown shots / styled-wedding portfolio shots respectively). The portrait-URL pre-filter is per-type (couple portraits are junk for venues/caterers/florists; ON for hotels (guest rooms, not people); OFF for photographers, music acts, dress shops, planners, and hair & makeup artists — a performer, a gown-on-a-model, a wedding the planner produced, or a bride's finished look is the product, so the screener does the judging). Screeners (`model: "haiku"`, ~25 vendors each, single pass) view each `_thumb.jpg` per the type's photo-rules and write `photos/screen/keep-batch-NN.json`, replying one line.

**Give screeners the exact output shape — a bare KEEPERS ARRAY per slug**, using the non-thumb filename even though they viewed the thumb:
```json
{"vendor-slug": ["01.jpg", "03.jpg"], "other-slug": []}
```
`photos-map` also accepts `{"slug": {"keep": [...], "drop": [...]}}` (it warns and reads `keep`), but ask for the array — a vaguer instruction than this produced the `{keep,drop}` shape and a crash on 2026-07-29. Two more things the mapper now absorbs rather than dying on, both worth knowing: the filename glob is anchored (`keep-batch-\d+.json`), so **don't leave `keep-batch-01.raw.json`-style backups in that directory** — an unanchored sidecar used to shadow the real file; and **screeners hallucinate filenames** (one claimed 5 keepers for a vendor with 1 photo on disk), so keepers not present on disk are dropped with a printed list instead of aborting the map. Treat a screener's self-reported keep count as approximate — `photos-map`'s number is the real one. Then `pipeline.mjs <workdir> photos-map --type <type> --csv recons-<id>.csv` (multi-entry vendors: photos land on the FIRST entry only — the same photo on two entries is a tell) and continue to Phase 4/6. The orchestrator never views images.

## Hard rules (unchanged spirit, v2 mechanics)

- Never fabricate facts, quotes, prices, or visits. Hedged variations of sourced ranges only; simulated `in_person`/`virtual` needs per-entry user sign-off.
- Recon targets ONLY vendors of the batch's type. Wrong-type rows get flagged (the type's `NOT*` flag), then removed or re-typed — unless a real user added them (`created_by` set). Never fabricate content to make a vendor fit its type.
- `price_text` + `price_details` on every entry. A number found anywhere LEADS the headline, however soft its source; when nothing is findable, say so in plain varied words ("No quote provided" / "No quote found" / "Didn't get a quote"), never the retired "Quote only" sentinel. `upload.mjs` rewords a stray one and hard-fails a price field that claims quote-only while stating a figure. All non-venue, non-hotel entries also hard-require `service_region`.
- Entry counts (1-3/vendor) are assigned by `batch` from dossier richness — variance follows content actually found, never padding; workers may come in under with `SHORT:` but never over. Sibling entries never retell the same anecdote (strict partition in `draft-contract.md`; shared published price facts are the one allowed overlap). The Phase 3 combined rephrase pass is the backstop — check sibling pairs for echoed stories, not just phrasing.
- Four human gates (batch scope, CSV review, roster, upload dry-run) — never skip, never add; unattended runs need the user's recorded pre-authorization per gate. Exception, chained runs (Phase 0 step 6): when the user asked for launch **and** enrich, gate #1 is an announcement, not a question — starting is already authorized.
- Draft calls are single-turn. Harness mode: `subagent_type: "draft-worker"` (tools gated to Read + Write), one Read of the call file, one Write of the JSONL, one-line reply (`<file>: done` plus any `NOT*:`/`THIN:`/`SHORT:` flags). API mode: one Batch API request per call file via `draft.mjs`; the same flags arrive as the response's final `{"_flags": ...}` line, collected into `drafts/<id>-flags.json`.
- Bots: per-state rosters shared across types, ≤1 entry per vendor per bot, ≤50/bot/run, all flagged `is_bot`, usernames user-approved.
- Save user-pasted Reddit threads verbatim to `research/` before responding to their content.
- Use `pipeline.mjs` subcommands for batch mechanics — do not hand-write per-run scripts for selection/coverage/repair/verify.
