---
name: enrichvenues
description: Enrich a region's seeded venues in Wedding Recon with bot-authored recon entries. Harvests Google Places reviews + venue websites, compresses research into per-venue dossiers by script, drafts human-voiced recon entries via cheap single-turn worker calls, and uploads them under user-approved, internally-flagged bot accounts. Photos are an optional decoupled pass. Use when the user wants to enrich, backfill, or bulk-add recon for a region's venues (e.g. "enrich Denver", "add recon for the Austin venues").
---

# /enrichvenues — bot recon for a region's venues (v2)

Goal: recon entries authored by `is_bot`-flagged accounts that read like real couples' research notes. Headless only: prewritten scripts + per-batch CSVs the user reviews. **Never drive a browser, Sheets, or the clipboard.**

All commands run from the repo root. Scripts live in `.claude/skills/enrichvenues/scripts/` and need `.env.local` (`GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); they fail fast with a clear message — relay it and stop. If Places/Supabase errors persist after one retry, stop and report.

References: `draft-call-header.md` + `entry-rules.md` + `voice-cards.md` are inlined into call files BY SCRIPT (no agent reads them separately); `photo-rules.md` is for optional photo screeners; `research-guide.md` is the orchestrator's reddit-paste protocol.

## Cost doctrine (v2 — from the 100-venue postmortem)

The v1 run burned ~2M tokens on 100 venues. Three sinks, three rules:

1. **Turns are the cost, not agents.** An agent's every tool call re-reads its whole growing context; v1 workers made 50-80 calls each. v2 draft calls are **single-turn**: read ONE pre-assembled file, write ONE csv, reply ONE line. Never give a draft worker research tools, web access, or multiple files.
2. **Scripts compress, models write.** `dossier.mjs` regex-cuts each venue's harvest/pages/digests/reddit to a ~500-token dossier for free. No agent ever reads `harvest.json`, `page-*.txt`, whole digests, or whole threads. No `extract.md` provenance files — the `sources` column is the provenance.
3. **Never re-touch every row.** No global polish pass: voice rules ride inside the call file; `upload.mjs` dry-run + `pipeline.mjs status` validate mechanically for free. Fix ONLY flagged rows (≤5: orchestrator edits inline; more: one small targeted call).

Budgets (drafting, Sonnet): call file ≈ 3k header + ~600/venue; ~30k/call of 15 venues ⇒ **~2-2.5k tokens/venue, ~210k per 100 venues, 300+ venues fits one session.** Orchestrator stays thin: `pipeline.mjs` does batch/status/merge/verify — do not hand-write per-run scripts for these. Worker replies are one line; nothing bulk ever enters the orchestrator context.

## Phase 0 — Scope (one exchange, human gate #1)

1. Region from the argument; normalize `"City, ST"` — the **state** parameterizes rosters. Verify prereqs: venues seeded; migration `0012` applied (1-row select of `profiles.is_bot`; on error ask the user to run it and stop).
2. Workdir `data/enrichvenues/<region-slug>/` (one per state — reuse the existing dir if the state already has one, whatever its name; it holds the reddit archive + digests).
3. Run `roster.mjs` for the status picture (unenriched counts, bot headroom, reddit coverage). Note: roster.mjs counts only bot recon; `pipeline.mjs batch` enforces the real rule — **venues with NO recon of any kind**.
4. ONE message: proposed batch size (first-ever region → pilot ~10; else up to `bots × 10`), bot roster state (new usernames need approval — see Phase 5), and ask for Reddit thread pastes (protocol in `research-guide.md`: save each paste **verbatim** to `research/reddit-NN.txt`, then re-run the thread-digest pass). Then run through Phase 3 without questions.

## Phase 1 — Harvest → dossiers (scripts, ~free)

```
node --env-file=.env.local .claude/skills/enrichvenues/scripts/harvest.mjs <workdir> --region <ST> --venues "Name 1;Name 2;..."
node .claude/skills/enrichvenues/scripts/dossier.mjs <workdir>
```

Once per region (fixed cost): the **region pricing pass** — one Sonnet subagent WebSearches `<region> wedding venue prices`, fetches ~5 multi-venue sources (wedding-spot/Zola city pages, local planner guides), saves per-venue digests to `research/pricing-web-<domain>.txt`, replies one line. And whenever the reddit archive changed: the **thread digest pass** — one Sonnet subagent reads all `research/reddit-*.txt` once and writes complete, pronoun-resolved `research/<slug>/reddit-slice.txt` excerpts. Re-run `dossier.mjs` after either (dossiers embed digest + reddit lines).

## Phase 2 — Batch + single-turn draft calls (Sonnet)

```
node --env-file=.env.local .claude/skills/enrichvenues/scripts/pipeline.mjs <workdir> batch \
  --region <ST> --roster data/enrichvenues/rosters/<ST>.json --size N --batch <id> [--per-call 15] [--exclude "Name;Name"]
```

`batch` selects the N richest venues with **no recon of any kind**, defers same-named twins (and skips twin research collisions with a warning), assigns bots (≤10/bot/run) and collected-dates, and writes `drafts/<id>-call-NN.md` files with rules + voices + dossiers **inlined**. It fails fast listing any venue missing a dossier.

Spawn one Sonnet agent (`model: "sonnet"`, background OK) per call file. Prompt, verbatim short: *"Read `<workdir>/drafts/<id>-call-NN.md` and follow it exactly. It contains every rule and all research; use no other file, no web access. Write the CSV it specifies in one Write, then reply with the one-line summary it specifies."* Workers get NO gap searches — a venue with no pricing in its dossier gets an honest "Quote only" row (v1 data: live gap-searching had poor ROI; ~36% ended quote-only anyway). If the user wants deeper pricing on specific venues, run ONE targeted search agent for just those, before batching.

Collect two flags from the worker reply lines:
- **`NOTAVENUE:<slug>`** — the dossier shows a SERVICE vendor mis-seeded as a venue (caterer, photographer, DJ, florist, planner, officiant, stationery shop) with no space of its own. Confirm against the dossier, then **remove the seeded row** unless it was user-added: a seed has `created_by = null`; an app-user-added vendor has `created_by` set and is NEVER auto-removed. Removal = delete its `recon_media` → `recon_entries` → the `vendors` row, and strip it from the batch CSV/manifest. A caterer that rents its OWN hall is a real venue — keep it.
- **`RICH:<slug>`** — carry to the optional second-entry pass below.

## Phase 3 — Merge + validate (script; spot-fix only)

```
node --env-file=.env.local .claude/skills/enrichvenues/scripts/pipeline.mjs <workdir> status --batch <id>   # coverage + violations
node --env-file=.env.local .claude/skills/enrichvenues/scripts/pipeline.mjs <workdir> merge  --batch <id>   # repair + recons-<id>.csv + samples
node --env-file=.env.local .claude/skills/enrichvenues/scripts/upload.mjs <workdir> --roster <roster> --csv recons-<id>.csv   # dry-run validation
```

Missing venues (a call died): re-spawn just that call file. Validation failures/near-dup warnings: fix only those rows (≤5 inline, else one small call). Never re-draft or re-read the whole batch. The dry-run also blocks **crawler-tell** language ("crawl"/"fetch"/"parse"/"boilerplate"/"garbled text" — research-tooling words no real couple writes); collect the offending rows into one JSON and hand a single Sonnet agent a rephrase-in-place pass.

### Optional: RICH second entries (only if the user wants depth)
Venues flagged `RICH` can earn a 2nd entry (review/experience cluster, a different bot than entry 1 — the source-cluster split in the entry rules). It's a SEPARATE run:

```
node --env-file=.env.local .claude/skills/enrichvenues/scripts/pipeline.mjs <workdir> rich --batch <id> --roster <roster> --venues "<rich slugs>"
```

Spawn ONE Sonnet agent on `drafts/<id>-rich-call.md`, validate its `drafts/<id>-rich-worker.csv`, copy to `recons-<id>-rich.csv`, and upload it as its own `--apply` run (the ≤10/bot/run cap is per-file; dedup is safe since the second entry's author differs from the first). `rich` load-balances the second bot and guarantees it differs from entry 1's.

## Phase 4 — User review (human gate #2)

`merge` already printed samples and wrote `recons-<id>.backup.csv`. Tell the user to edit `recons-<id>.csv` freely. On "done", **re-read the file fresh — never assume rows survived the edit** (the upload dry-run re-validates everything).

## Phase 5 — Bots (human gate #3: roster approval)

State roster `data/enrichvenues/rosters/<ST>.json` (`[{ "key": "botN", "username": "..." }]`). **Bots never cross states**; the state roster is reused across vendor types. New usernames: reddit-plausible anonymous handles (place/hobby/wordplay — e.g. `i70skier`, `bouldergirl`), not wedding-punny, skew female, avoid real first+last names — **the user approves every new username before any account is created. No exceptions.**

```
node --env-file=.env.local .claude/skills/enrichvenues/scripts/bots.mjs <workdir> --roster <roster>            # dry-run
node --env-file=.env.local .claude/skills/enrichvenues/scripts/bots.mjs <workdir> --roster <roster> --apply    # after approval
```

## Phase 6 — Upload (human gate #4: explicit yes on dry-run)

Show the dry-run summary; get an **explicit yes** before `--apply`. Idempotent by `(author_id, vendor_id)`; `created_at` auto-backdates.

```
node --env-file=.env.local .claude/skills/enrichvenues/scripts/upload.mjs <workdir> --roster <roster> --csv recons-<id>.csv --apply
node --env-file=.env.local .claude/skills/enrichvenues/scripts/pipeline.mjs <workdir> verify --roster <roster> --csv recons-<id>.csv [--fix-gaps]
```

Supabase Storage intermittently drops uploads (`fetch failed`); upload.mjs exits on the first one, and plain re-runs skip already-inserted entries WITHOUT retrying their missing photos. The loop that converges: `verify --fix-gaps` (deletes photo-partial entries) → `upload --apply` → `verify`, until verify exits 0. Two consecutive no-progress failures → stop and report. Report counts + workdir; **do not delete the workdir.**

## Optional photo pass (decoupled — OFF by default)

Run ONLY when the user asks for photos, and only **between Phase 3 and Phase 6** (attaching photos to already-uploaded entries is not built). Costs ~1.3k tokens/venue screened:

1. `node --env-file=.env.local .claude/skills/enrichvenues/scripts/photos.mjs <workdir> --venues "<slugs>" --per-venue 1` (script pre-picks the largest real-photo candidate; junk/portrait URLs regex-filtered).
2. Haiku screeners (`model: "haiku"`, ~25 venues each, single pass): view each `_thumb.jpg` per `photo-rules.md`, write keep/drop to `photos/screen/keep-batch-NN.json`, reply one line per venue. Under-coverage always beats a bad image.
3. `node .claude/skills/enrichvenues/scripts/pipeline.mjs <workdir> photos-map --csv recons-<id>.csv` — then continue to Phase 4/6. The orchestrator never views images.

## Hard rules (unchanged spirit, v2 mechanics)

- Never fabricate facts, quotes, prices, or visits. Hedged variations of sourced ranges only; simulated `in_person`/`virtual` needs per-entry user sign-off.
- Recon is for VENUES only. Service vendors mis-seeded as venues (catering/photography/DJ/florist/planner/officiant/stationery) get removed, not enriched — unless a real user added them (`created_by` set). Never fabricate a "space" for a service business.
- `price_text` + `price_details` on every entry (honest "quote only" wording when nothing is findable).
- Four human gates (batch scope, CSV review, roster, upload dry-run) — never skip, never add.
- Draft calls are single-turn and tool-less (one Read implicit in the call file, one Write, one-line reply). Orchestrator never reads dossiers/research/images; nothing bulk in the orchestrator context.
- Bots: per-state rosters, ≤1 entry per venue per bot, ≤10/bot/run, all flagged `is_bot`, usernames user-approved.
- Save user-pasted Reddit threads verbatim to `research/` before responding to their content.
- Use `pipeline.mjs` subcommands for batch mechanics — do not hand-write per-run scripts for selection/coverage/repair/verify.
