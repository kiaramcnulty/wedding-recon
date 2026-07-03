---
name: enrichvenues
description: Enrich a region's seeded venues in Wedding Recon with bot-authored recon entries. Harvests Google Places reviews + venue websites, mines archived/user-pasted Reddit threads and web guides for pricing, capacity, and firsthand commentary, synthesizes 1-3 human-voiced recon entries per venue with curated photos, and uploads them under user-approved, internally-flagged bot accounts. Use when the user wants to enrich, backfill, or bulk-add recon for a region's venues (e.g. "enrich Denver", "add recon for the Austin venues").
---

# /enrichvenues — bot recon for a region's venues

Goal: 1-3 recon entries per venue (mostly 2) authored by `is_bot`-flagged accounts, reading like real couples' research notes. Headless only: prewritten scripts + WebSearch/WebFetch + one CSV the user reviews. **Never drive a browser, Sheets, or the clipboard.**

All commands run from the repo root. Scripts live in `.claude/skills/enrichvenues/scripts/` and need `.env.local` (`GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); they fail fast with a clear message — relay it and stop.

Reference cards in `.claude/skills/enrichvenues/references/` — read each when you reach its phase, not before:
- `research-guide.md` (Phase 2) · `entry-rules.md` + `voice-cards.md` (Phase 3) · `photo-rules.md` (Phase 4)

**Delegation tiers (do not downgrade):** per-venue research and all copy synthesis → **Opus** subagents (or do inline if you are Opus-class or better). Photo screening → **Sonnet** subagents (needs vision + the photo-rules card). Script phases and gates → any tier, run inline.

## Phase 0 — Scope (one exchange)

1. Region from the argument; normalize to `"City, ST"` — the **state** parameterizes everything (rosters are per state). Prereqs to verify, not assume: venues seeded (`/launchvenues` ran) and migration `0012_bot_profiles.sql` applied (1-row select of `profiles.is_bot`; on error, ask the user to run it in the Supabase SQL editor and stop).
2. Workdir `data/enrichvenues/<region-slug>/` (gitignored). Run:
   ```
   node --env-file=.env.local .claude/skills/enrichvenues/scripts/roster.mjs data/enrichvenues/<slug> --region <ST>
   ```
   It lists unenriched venues **ranked by richness (3×reddit-thread mentions + Places reviews + website)** and per-bot entry counts. Reddit-mentioned venues lead every batch.
3. ONE message to the user: proposed batch (first-ever region → pilot ~10 venues; otherwise ~20-30), and ask for Reddit thread pastes (protocol in `research-guide.md`). Then run through Phase 4 without further questions.

## Phase 1 — Harvest (script, no judgment)

```
node --env-file=.env.local .claude/skills/enrichvenues/scripts/harvest.mjs data/enrichvenues/<slug> --region <ST> --venues "Name 1;Name 2;..."
```

Pulls per venue: Places details (up to 5 real Google reviews — coordinator names, tour impressions, complaints), venue-site text (pricing/wedding subpages), image URLs, PDF links → `research/<venue-slug>/`. Relay the one-line summaries. **Do not cat page files or CSVs into context wholesale** — read `harvest.json` review blocks and pricing-relevant `page-*.txt` selectively.

## Phase 2 — Research (judgment; Opus)

Follow `research-guide.md`. Order: archived Reddit threads (save any new user pastes **verbatim** to `research/reddit-NN.txt` before responding to their content) → harvest output → targeted WebSearch for venues still missing pricing (The Knot `/marketplace/` pages time out; use WebSearch `allowed_domains` or `/content/` articles). Batch venues ~8-10 per Opus subagent; each returns per-venue extraction files with a source tag on every fact. **Never invent a number, quote, or event.**

## Phase 3 — Synthesize `recons.csv` (Opus)

Read `entry-rules.md` and `voice-cards.md` in full, plus 2-3 real (non-bot) entries from `recon_entries` for calibration. Columns:

```
venue,vendor_id,recon_type,month,year,price_text,price_details,notes,photos,sources,bot
```

Non-negotiables (upload.mjs hard-fails on most): 1-3 entries/venue mostly 2, split by source cluster; `price_text` + `price_details` on EVERY entry (hedged derivation recipe in the card); real source dates win, else last-3-months; `online` unless the user signed off on a simulated visit; one consistent voice per bot; attribution in-text; banned marketing/AI phrases rejected; a bot never covers the same venue twice.

## Phase 4 — Photos (script + Sonnet eyeball pass)

```
node --env-file=.env.local .claude/skills/enrichvenues/scripts/photos.mjs data/enrichvenues/<slug> [--per-venue 4] [--venues "slug1;slug2"]
```

Then the step no script can do: **view every `_thumb.jpg` before mapping it into the CSV**, applying `photo-rules.md` (venue/space/info shots only; logos, graphics, portraits, watermarks, couple close-ups always dropped; under-target beats a bad image). Spawn Sonnet screener subagents for large batches; they return keep/drop + one-line reason per file.

## Phase 5 — User review (human gate #1 of 3)

Keep a `recons.backup.csv` copy (spreadsheet apps clobber saves). Show 3-4 sample entries in chat — the user judges copy feel. Tell them to edit `recons.csv` freely. On "done", **re-read the file fresh; never assume rows or content survived the edit.**

## Phase 6 — Bots (human gate #2: roster approval)

State roster lives at `data/enrichvenues/rosters/<ST>.json` (`[{ "key": "bot1", "username": "..." }]`). **Bots never cross states**; within a state the same roster is reused for future vendor types (florists, caterers…). Reuse bots with headroom (roster.mjs shows counts; 3-10 entries per bot per run, believable lifetime totals). New usernames: reddit-plausible, not wedding-punny, skew female — **the user approves every new username before any account is created. No exceptions.**

```
node --env-file=.env.local .claude/skills/enrichvenues/scripts/bots.mjs data/enrichvenues/<slug> --roster data/enrichvenues/rosters/<ST>.json            # dry-run
node --env-file=.env.local .claude/skills/enrichvenues/scripts/bots.mjs data/enrichvenues/<slug> --roster data/enrichvenues/rosters/<ST>.json --apply    # after approval
```

Idempotent (existing usernames reused); sets `is_bot` + `tos_accepted_at`; no passwords kept — bots are only written to via the service role.

## Phase 7 — Upload (human gate #3: explicit yes on dry-run)

```
node --env-file=.env.local .claude/skills/enrichvenues/scripts/upload.mjs data/enrichvenues/<slug> --roster data/enrichvenues/rosters/<ST>.json            # dry-run
node --env-file=.env.local .claude/skills/enrichvenues/scripts/upload.mjs data/enrichvenues/<slug> --roster data/enrichvenues/rosters/<ST>.json --apply    # after explicit yes
```

Dry-run validates everything (required prices, banned phrases, types, dates, vendor ids, photo+thumb existence, bot constraints, near-duplicate phrasing warnings) and prints per-bot counts. Show the user; get an **explicit yes** before `--apply`. Idempotent: `(author_id, vendor_id)` is the dedup key, so partial-failure re-runs are safe; `created_at` auto-backdates into each entry's collected month.

After apply: verify with a read-only query (bot entry count, all `active`, media attached as mapped) and fetch one public thumb URL (expect `200 image/jpeg`). Report counts + workdir. **Do not delete the workdir** — research files feed future runs.

## Hard rules (distilled from the Denver pilot)

- Never fabricate facts, quotes, prices, or visits. Hedged variations of sourced ranges are the only permitted derivation; simulated `in_person`/`virtual` entries need per-entry user sign-off.
- `price_text` + `price_details` on every entry.
- Photos: venue-website source only, must show the venue or real info, eyeballed before mapping, never reused across entries; watermarked/logo/portrait images always dropped.
- Bots: per-state rosters, ≤1 entry per venue per bot, 3-10 per bot per run, all flagged `is_bot`, usernames user-approved.
- Save user-pasted Reddit threads verbatim to `research/` before responding to their content.
- Exactly three human gates (batch scope, roster, upload dry-run) — don't add others, never skip these.
- Keep file contents out of context; relay script summaries.
- If Places/Supabase errors persist after one retry, stop and report — don't improvise another data path.
