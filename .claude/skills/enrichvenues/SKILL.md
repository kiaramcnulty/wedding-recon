---
name: enrichvenues
description: Enrich a region's seeded venues in Wedding Recon with bot-authored recon entries. Harvests Google Places reviews + venue websites, mines archived/user-pasted Reddit threads and region-level pricing guides, drafts 1-2 human-voiced recon entries per venue with curated photos via cheap worker agents, and uploads them under user-approved, internally-flagged bot accounts. Use when the user wants to enrich, backfill, or bulk-add recon for a region's venues (e.g. "enrich Denver", "add recon for the Austin venues").
---

# /enrichvenues — bot recon for a region's venues

Goal: recon entries authored by `is_bot`-flagged accounts that read like real couples' research notes. Headless only: prewritten scripts + WebSearch/WebFetch + per-batch CSVs the user reviews. **Never drive a browser, Sheets, or the clipboard.**

All commands run from the repo root. Scripts live in `.claude/skills/enrichvenues/scripts/` and need `.env.local` (`GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); they fail fast with a clear message — relay it and stop.

Reference cards in `.claude/skills/enrichvenues/references/`: `research-guide.md`, `entry-rules.md`, `voice-cards.md` (given to draft workers), `photo-rules.md` (given to photo screeners).

## Cost discipline (why this pipeline is shaped this way)

The scripts and API calls are nearly free; **LLM tokens are the only real cost**, and they burn in three ways: big models doing extraction, images entering a long-lived context, and one giant conversation re-read on every call. Therefore, non-negotiable:

- **The orchestrator stays thin.** It runs scripts, spawns workers, relays summaries, and manages gates. It NEVER reads research pages, extracts, or photos itself — no "do it inline" exception, regardless of what model the orchestrator is.
- **Draft workers are Sonnet** (`model: "sonnet"`). **Voice polish is Opus** and reads only drafted CSV rows. **Photo screeners are Haiku** (`model: "haiku"`).
- Workers read the per-venue `reddit-slice.txt` (pre-cut by script), never whole threads.
- Nothing bulk (CSV contents, page text, extracts) is ever echoed into the orchestrator context.

## Tiering (what each venue gets)

`roster.mjs` scores every unenriched venue (3×reddit mentions + Places reviews + website):
- **Tier 1** — any reddit mention or clearly rich sources: **2 entries** (rarely 3), photos.
- **Tier 2** — any recon signal at all (a website OR Google reviews): **1 entry**. Photos optional.
- **Skip** only venues with zero signal (no website, no reviews, no mentions). Every venue with anything gets at least one entry.

Tiers set defaults, not blinders — the cheap sources (reviews, site crawl, reddit slice, digests) are read for EVERY venue regardless of tier. Two adjustments prevent leaving fruit on the table:
- **Gap-triggered searches**: live web searches follow missing data, not tier. Any venue whose site crawl failed or whose pricing isn't in harvest+digests earns up to 2 searches, tier-2 included. Venues whose cheap sources already answered everything get zero, tier-1 included.
- **Promotion/demotion**: a tier-2 venue whose sources turn out rich (real pricing table + strong firsthand) gets the second entry; a thin tier-1 drops to one. The research is already read — use what's found.

## Phase 0 — Scope (one exchange, human gate #1)

1. Region from the argument; normalize `"City, ST"` — the **state** parameterizes rosters. Verify prereqs (don't assume): venues seeded, migration `0012` applied (1-row select of `profiles.is_bot`; on error ask the user to run it and stop).
2. Workdir `data/enrichvenues/<region-slug>/`. Run:
   ```
   node --env-file=.env.local .claude/skills/enrichvenues/scripts/roster.mjs data/enrichvenues/<slug> --region <ST> --slices
   ```
   (`--slices` pre-cuts per-venue reddit excerpts into `research/<slug>/reddit-slice.txt`.)
3. ONE message: proposed batch (tier-1 list + tier-2 count; first-ever region → pilot ~10) and ask for Reddit thread pastes (protocol in `research-guide.md`: save each paste **verbatim** to `research/reddit-NN.txt` before using it, then re-run `--slices`). Then run through Phase 4 without questions.

## Phase 1 — Harvest + region pricing (scripts + ~5 fetches)

```
node --env-file=.env.local .claude/skills/enrichvenues/scripts/harvest.mjs data/enrichvenues/<slug> --region <ST> --venues "Name 1;Name 2;..."
```

Relay the one-line summaries only. Then two once-per-region passes (fixed cost, independent of venue count):

**Region pricing pass**: WebSearch `<region> wedding venue prices`, fetch ~5 multi-venue sources — wedding-spot city page, Zola city page, 2-3 local photographer "venue guide" posts — with a prompt asking for per-venue pricing/capacity blurbs, and save each digest to `research/pricing-web-<domain>.txt`. These files cover pricing for dozens of venues at once; workers read them locally instead of running per-venue searches.

**Thread digest pass** (whenever the reddit archive has changed since the last run): one Sonnet subagent reads ALL `research/reddit-*.txt` in full, once, and writes/overwrites `research/<venue-slug>/reddit-slice.txt` for every venue discussed — **complete comments, never clipped**, with pronoun and cross-thread references resolved and annotated (e.g. "commenter never names the venue here, but booked it per reddit-02"). This is the only agent that ever reads whole threads; it exists because keyword slicing misses unnamed references (the best pricing datapoint of the Denver run was in a comment that never named its venue). The mechanical `roster.mjs --slices` output is the fallback when the archive hasn't changed.

## Phase 2 — Draft workers (Sonnet, research → CSV rows in one pass)

Spawn Sonnet subagents (`model: "sonnet"`), ~8-10 venues each, background OK. Each worker gets: its venue list with tiers + vendor_ids + assigned bot keys per entry (assign bots up front — a bot never repeats a venue; 3-10 per bot per run), and instructions to read `research-guide.md`, `entry-rules.md`, `voice-cards.md` in full. Per venue the worker:

1. Reads `research/<slug>/harvest.json` (reviews), `reddit-slice.txt` if present, the `research/pricing-web-*.txt` digests, and pricing-relevant `page-*.txt` — skipping calendar/api dumps.
2. Tier 1 only: up to 2 WebSearches to fill pricing gaps (The Knot `/marketplace/` times out — use WebSearch `allowed_domains` or `/content/` articles; one timeout = skip).
3. Writes a **≤400-word** bullet scratch `research/<slug>/extract.md` (provenance trail; nobody re-reads it in-pipeline).
4. Appends finished CSV rows (schema + rules from `entry-rules.md`) to its own `drafts/<worker>.csv`.

Worker reply = one line per venue (tier, entries drafted, pricing found Y/N). **Never invent a number, quote, or event** — no-pricing venues get an honest "quote only" entry.

## Phase 3 — Voice polish (Opus, rows only)

An Opus pass (subagent, or orchestrator only if it is Opus-class — this is the single allowed inline step because it reads only finished rows) reads `drafts/*.csv` + `voice-cards.md`, rewrites anything off-voice or rule-breaking in place, merges to `recons-<batch>.csv`, and reports per-venue counts. It does not re-research; facts are the workers' job.

## Phase 4 — Photos (script + Haiku screeners, only for venues with entries)

```
node --env-file=.env.local .claude/skills/enrichvenues/scripts/photos.mjs data/enrichvenues/<slug> --venues "<slugs of venues with drafted entries>"
```

The script pre-filters junk/portrait URLs by regex and keeps ≤3 candidates per venue. Then spawn **Haiku** screener subagents (~10 venues each) with `photo-rules.md`: view each `_thumb.jpg`, reply keep/drop + 3-word reason, stop at 2 keepers per venue. Orchestrator maps keepers into the CSV `photos` column without viewing images itself. Under-coverage always beats a bad image.

## Phase 5 — User review (human gate #2... of the CSV)

Copy `recons-<batch>.csv` to `recons-<batch>.backup.csv`. Show the user 3-4 sample entries in chat and tell them to edit the batch CSV freely. On "done", **re-read the file fresh — never assume rows survived the edit.**

## Phase 6 — Bots (human gate #3: roster approval)

State roster: `data/enrichvenues/rosters/<ST>.json` (`[{ "key": "botN", "username": "..." }]`). **Bots never cross states**; the same state roster is reused across vendor types. Reuse bots with headroom (roster.mjs prints lifetime counts). New usernames: reddit-plausible, not wedding-punny, skew female — **the user approves every new username before any account is created. No exceptions.**

```
node --env-file=.env.local .claude/skills/enrichvenues/scripts/bots.mjs data/enrichvenues/<slug> --roster data/enrichvenues/rosters/<ST>.json            # dry-run
node --env-file=.env.local .claude/skills/enrichvenues/scripts/bots.mjs data/enrichvenues/<slug> --roster data/enrichvenues/rosters/<ST>.json --apply    # after approval
```

## Phase 7 — Upload (human gate #4: explicit yes on dry-run)

```
node --env-file=.env.local .claude/skills/enrichvenues/scripts/upload.mjs data/enrichvenues/<slug> --roster data/enrichvenues/rosters/<ST>.json --csv recons-<batch>.csv            # dry-run
node --env-file=.env.local .claude/skills/enrichvenues/scripts/upload.mjs data/enrichvenues/<slug> --roster data/enrichvenues/rosters/<ST>.json --csv recons-<batch>.csv --apply    # after explicit yes
```

Dry-run validates everything (required prices, banned phrases, types, dates, vendor ids, photo+thumb existence, bot constraints, near-duplicate phrasing). Show the summary; get an **explicit yes** before `--apply`. Idempotent by `(author_id, vendor_id)`; `created_at` auto-backdates. After apply: one read-only verification query (counts, all `active`, one public thumb returns `200 image/jpeg`). Report counts + workdir; **do not delete the workdir.**

## Hard rules (distilled from the Denver runs)

- Never fabricate facts, quotes, prices, or visits. Hedged variations of sourced ranges only; simulated `in_person`/`virtual` needs per-entry user sign-off.
- `price_text` + `price_details` on every entry (honest "quote only" wording when nothing is findable).
- Photos: venue-website source only, screened by a vision agent before mapping, never reused across entries; logos/graphics/portraits/watermarks always dropped.
- Bots: per-state rosters, ≤1 entry per venue per bot, all flagged `is_bot`, usernames user-approved.
- Save user-pasted Reddit threads verbatim to `research/` before responding to their content.
- Four human gates (batch scope, CSV review, roster, upload dry-run) — never skip, never add.
- Orchestrator never reads research/extracts/images; workers never see whole threads. Keep every artifact out of the orchestrator context except script summaries and worker one-liners.
- If Places/Supabase errors persist after one retry, stop and report — don't improvise another data path.
