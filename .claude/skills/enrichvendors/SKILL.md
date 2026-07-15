---
name: enrichvendors
description: Enrich a region's seeded vendors of one vendor type (venues, photographers, caterers, music, flowers) in Wedding Recon with bot-authored recon entries. Harvests Google Places reviews + vendor websites, compresses research into per-vendor dossiers by script, drafts human-voiced recon entries (1-3 per vendor, richness-driven) via cheap single-turn worker calls, and uploads them under user-approved, internally-flagged bot accounts. Photos are an optional decoupled pass. Use when the user wants to enrich, backfill, or bulk-add recon for a region's vendors (e.g. "enrich Denver", "add recon for the Austin venues", "enrich the Colorado caterers").
---

# /enrichvendors — bot recon for a region's vendors, one type at a time (v2)

Goal: recon entries authored by `is_bot`-flagged accounts that read like real couples' research notes. Headless only: prewritten scripts + per-batch CSVs the user reviews. **Never drive a browser, Sheets, or the clipboard.**

**Two config layers:** `scripts/etype.mjs` holds the mechanical per-type profile (CSV columns, DB vendor_type, harvest/dossier regexes, flags — venue is the default); `references/` holds the judgment config: shared `common/draft-contract.md` + `common/entry-rules-core.md` + `voice-cards.md`, plus a short per-type `references/<type>/type-rules.md` and `photo-rules.md` (type dirs: venue, photographer, food, music, flowers). Every script takes `--type <venue|photographer|caterer|music|flowers>` (aliases accepted); omitted = venue. **Load the type's reference cards before running.**

All commands run from the repo root. Scripts live in `.claude/skills/enrichvendors/scripts/` and need `.env.local` (`GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); they fail fast with a clear message — relay it and stop. If Places/Supabase errors persist after one retry, stop and report.

References: `common/draft-contract.md` + `common/entry-rules-core.md` + `references/<type>/type-rules.md` + shared `voice-cards.md` are inlined into call files BY SCRIPT (no agent reads them separately); `references/<type>/photo-rules.md` is for optional photo screeners; `research-guide.md` is the orchestrator's reddit-paste protocol.

## Cost doctrine (v2 — from the 100-venue postmortem)

The v1 run burned ~2M tokens on 100 venues. Three sinks, three rules:

1. **Turns are the cost, not agents.** An agent's every tool call re-reads its whole growing context; v1 workers made 50-80 calls each. v2 draft calls are **single-turn**: read ONE pre-assembled file, write ONE csv, reply ONE line. Never give a draft worker research tools, web access, or multiple files.
2. **Scripts compress, models write.** `dossier.mjs` regex-cuts each vendor's harvest/pages/digests/reddit to a ~500-token dossier for free. No agent ever reads `harvest.json`, `page-*.txt`, whole digests, or whole threads. No `extract.md` provenance files — the `sources` column is the provenance.
3. **Never re-touch every row.** No global polish pass: voice rules ride inside the call file; `upload.mjs` dry-run + `pipeline.mjs status` validate mechanically for free. Fix ONLY flagged rows (≤5: orchestrator edits inline; more: one small targeted call).

Budgets (drafting, Sonnet): call file ≈ 3k header + ~600/vendor; ~14-18k/call of 25 vendors (the default) ⇒ **~2k tokens/vendor, 300+ fits one session.** Multi-entry vendors (batch assigns 1-3 by richness) add only ~200 OUTPUT tokens per extra entry — the dossier is already in the worker's context, which is why the old separate RICH pass (header + dossier re-read per second entry) was retired. (A deferred plan to move drafting onto the metered Anthropic Batch API — off the subscription, ~$1-1.50/run — is written up in `docs/anthropic-batch-drafting.md`; blocked on a Kiara billing decision.) Orchestrator stays thin: `pipeline.mjs` does batch/status/merge/verify — do not hand-write per-run scripts for these. Worker replies are one line; nothing bulk ever enters the orchestrator context.

## Phase 0 — Scope (one exchange, human gate #1)

1. Parse the argument as `<type?> <region>` (e.g. `/enrichvendors photographers Colorado`, `/enrichvendors caterers Denver`; no type = venue). Normalize region; the **state** parameterizes rosters. Verify prereqs: vendors of that type seeded; migration `0012` applied (1-row select of `profiles.is_bot`); for photographer runs also `0016` (`vendors.instagram`). On error ask the user to run it and stop.
2. Workdir `data/enrichvendors/<type>-<region-slug>/` (one per type+state). Legacy venue workdirs live in `data/enrichvenues/<region-slug>/` — keep using those for venue runs (reddit archive + digests live there).
3. Run `roster.mjs --type <type>` for the status picture (unenriched counts, bot headroom, reddit coverage). Note: roster.mjs counts only bot recon; `pipeline.mjs batch` enforces the real rule — **vendors with NO recon of any kind**.
4. ONE message: proposed batch size (first-ever region+type → pilot ~10; else up to `bots × 50`), bot roster state (rosters are per-STATE at `data/enrichvenues/rosters/<ST>.json` and shared across vendor types; new usernames need approval — see Phase 5), and ask for Reddit thread pastes (protocol in `research-guide.md`: save each paste **verbatim** to `research/reddit-NN.txt`, then re-run the slice pass). Launch-workdir research (`data/launchvendors/<type>-<region>/research/`) is picked up automatically for BOTH scoring and slices — do **NOT** copy its `reddit-*.txt` into the enrich workdir (both dirs get scanned; copies double every excerpt — measured live 2026-07-09). Only research that exists nowhere else (new pastes, IG transcriptions the fallback dir lacks) goes in the enrich workdir's `research/`. Then run through Phase 3 without questions.

## Phase 1 — Harvest → dossiers (scripts, ~free)

```
node --env-file=.env.local .claude/skills/enrichvendors/scripts/harvest.mjs <workdir> --region <ST> --type <type> --venues "Name 1;Name 2;..."
node .claude/skills/enrichvendors/scripts/dossier.mjs <workdir> --type <type>
```

Once per region+type (fixed cost): the **region pricing pass** — one Sonnet subagent WebSearches `<region> <vendor type> prices/packages`, fetches ~5 multi-vendor sources, saves per-vendor digests to `research/pricing-web-<domain>.txt`, replies one line. Launch-time research intel (candidates.jsonl `intel` fields) can be script-converted into a `research/pricing-web-launchintel.txt` digest — dossiers pick up any `pricing-web-*.txt` automatically. And whenever the reddit archive changed: `roster.mjs --type <type> --slices` (or the thread-digest subagent for messy threads) so per-vendor `reddit-slice.txt` excerpts exist. Re-run `dossier.mjs` after either.

## Phase 2 — Batch + single-turn draft calls (Sonnet)

```
node --env-file=.env.local .claude/skills/enrichvendors/scripts/pipeline.mjs <workdir> batch \
  --type <type> --region <ST> --roster data/enrichvenues/rosters/<ST>.json --size N --batch <id> [--per-call 25] [--exclude "Name;Name"]
```

`batch` selects the N richest vendors of the type with **no recon of any kind**, defers same-named twins (and skips twin research collisions with a warning), and assigns each vendor **1–3 entries from its dossier's actual richness** ($ figures / reviews / reddit / digests — Kiara 2026-07: variance follows content found, never a forced quota), with a DISTINCT bot and collected-date per entry (≤50/bot/run). It writes `drafts/<id>-call-NN.md` files with the TYPE'S rules + voices + dossiers **inlined** (a vendor's entries share one call, so extra entries cost only output tokens) and a FLAT manifest (one row per vendor+entry slot). It fails fast listing any vendor missing a dossier.

Spawn one agent (`subagent_type: "draft-worker"`, background OK) per call file — that agent type is `model: sonnet` with tools **gated to Read + Write**. Prompt, verbatim short: *"Read `<workdir>/drafts/<id>-call-NN.md` and follow it exactly. It contains every rule and all research. Write the output file it specifies in one Write, then reply with the one line it specifies. Do not read anything else back."* Workers get NO gap searches — a vendor with no pricing in its dossier gets an honest "Quote only" row. **Workers write JSON Lines** (`drafts/<id>-worker-NN.jsonl`) — JSON escaping ends the CSV-corruption failure class that forced a full repair pass in the 2026-07 run; `merge` still emits the reviewable `recons-<id>.csv`.

Collect flags from the worker reply lines (defined in `common/draft-contract.md`; the wrong-type flag name is per type):
- **`NOTAVENUE:`/`NOTPHOTOG:`/`NOTCATERER:`/`NOTMUSIC:`/`NOTFLORIST:<slug>`** — the dossier shows a vendor of the WRONG type for this run. Confirm against the dossier, then handle: a mis-typed **seed** (`created_by = null`) is removed (its `recon_media` → `recon_entries` → `vendors` row) or re-typed if it clearly belongs to another supported type; an app-user-added vendor (`created_by` set) is NEVER auto-removed. Strip it from the batch CSV/manifest.
- **`THIN:<slug>`** (data floor) — nothing real to write; the vendor ships with zero entries this run. Report the list; do NOT re-spawn or pad.
- **`SHORT:<slug>`** — the worker wrote fewer than the assigned entries (dossier couldn't honestly support them). Expected occasionally; report, don't pad.

## Phase 3 — Merge + validate (script; spot-fix only)

```
node --env-file=.env.local .claude/skills/enrichvendors/scripts/pipeline.mjs <workdir> status --type <type> --batch <id>
node --env-file=.env.local .claude/skills/enrichvendors/scripts/pipeline.mjs <workdir> merge  --type <type> --batch <id>
node --env-file=.env.local .claude/skills/enrichvendors/scripts/upload.mjs <workdir> --type <type> --roster <roster> --csv recons-<id>.csv   # dry-run validation
```

Missing entry slots (a call died): re-spawn just that call file (THIN/NOTTYPE/SHORT-flagged ones are intentionally missing — don't). Validation failures/near-dup warnings: fix only those rows (≤5 inline, else one small call). Non-venue rows additionally hard-require `service_region`. The dry-run also blocks **process-tell** language — research-tooling words AND pipeline/batch self-references; collect offenders into one JSON and hand a single Sonnet agent a rephrase-in-place pass.

(The old worker-flagged `RICH` second-entry pass is retired — richness now sets each vendor's entry count up front in `batch`, inside the same call file, which is strictly cheaper: the dossier is read once and extra entries only cost output tokens.)

## Phase 4 — User review (human gate #2)

`merge` already printed samples and wrote `recons-<id>.backup.csv`. Tell the user to edit `recons-<id>.csv` freely. On "done", **re-read the file fresh — never assume rows survived the edit**.

## Phase 5 — Bots (human gate #3: roster approval)

State roster `data/enrichvenues/rosters/<ST>.json` (`[{ "key": "botN", "username": "..." }]`). **Bots never cross states; the state roster IS shared across vendor types** (a real couple researches venues and photographers alike — cross-type reuse is a feature). New usernames: reddit-plausible anonymous handles, not wedding-punny, skew female, avoid real first+last names — **the user approves every new username before any account is created. No exceptions.**

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

## Optional photo pass (decoupled — OFF by default)

Run ONLY when the user asks for photos, and only **between Phase 3 and Phase 6**. Rules are PER TYPE (`references/<type>/photo-rules.md`). Venue target: 1-2 photos on ~75% of entries. **Photographer target: ~3 per vendor that has that many qualifying images** (photos are critical for this type — Kiara 2026-07); run `photos.mjs --type photographer --per-venue 5` so screeners can keep ~3. Caterer/music/flowers target: 1-2 (food shots / performance shots / arrangement shots respectively). The portrait-URL pre-filter is per-type (couple portraits are junk for venues/caterers/florists, the PRODUCT for photographers and music acts). Screeners (`model: "haiku"`, ~25 vendors each, single pass) view each `_thumb.jpg` per the type's photo-rules, write keep/drop to `photos/screen/keep-batch-NN.json`, reply one line per vendor. Then `pipeline.mjs <workdir> photos-map --type <type> --csv recons-<id>.csv` (multi-entry vendors: photos land on the FIRST entry only — the same photo on two entries is a tell) and continue to Phase 4/6. The orchestrator never views images.

## Hard rules (unchanged spirit, v2 mechanics)

- Never fabricate facts, quotes, prices, or visits. Hedged variations of sourced ranges only; simulated `in_person`/`virtual` needs per-entry user sign-off.
- Recon targets ONLY vendors of the batch's type. Wrong-type rows get flagged (the type's `NOT*` flag), then removed or re-typed — unless a real user added them (`created_by` set). Never fabricate content to make a vendor fit its type.
- `price_text` + `price_details` on every entry (honest "quote only" wording when nothing is findable). All non-venue entries also hard-require `service_region`.
- Entry counts (1-3/vendor) are assigned by `batch` from dossier richness — variance follows content actually found, never padding; workers may come in under with `SHORT:` but never over.
- Four human gates (batch scope, CSV review, roster, upload dry-run) — never skip, never add; unattended runs need the user's recorded pre-authorization per gate.
- Draft calls are single-turn, spawned as `subagent_type: "draft-worker"` (tools gated to Read + Write): one Read of the call file, one Write of the JSONL, one-line reply. The reply is `<file>: done` plus any `NOT*:`/`THIN:`/`SHORT:` flags.
- Bots: per-state rosters shared across types, ≤1 entry per vendor per bot, ≤50/bot/run, all flagged `is_bot`, usernames user-approved.
- Save user-pasted Reddit threads verbatim to `research/` before responding to their content.
- Use `pipeline.mjs` subcommands for batch mechanics — do not hand-write per-run scripts for selection/coverage/repair/verify.
