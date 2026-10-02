# Filter / recon reconciliation

Brings `vendors.filters` and `recon_entries` into agreement. No web access.
Finding facts neither store holds is a separate, more expensive pass and is
deliberately out of scope (Kiara, 2026-08-09).

**Changed 2026-10-02 (bot-recon quality audit, `docs/bot-recon-quality-plan.md`
items 1, 12, 15).** The 2026-08-09/11 Direction-A run used only tags + recon, so
for a tag with no prose it wrote a sentence to match the TAG: 1,301 live entries
were edited, some falsely ("walk-ins welcome" on an appointment-only shop), and
its snapshot lived in a since-deleted worktree, so there was no undo. Now:

- **Every prose edit and every tag read off a BOT entry needs source evidence**:
  a verbatim quote from a harvested source about this one vendor (its fetched
  site pages, its Google reviews, a `[basis=property]` reddit excerpt, or this
  run's fetched site text), checked by `evidence.mjs`. Tags and filters_meta
  quotes, the model's own text, bot entries, dossiers and region-wide digests are
  NOT evidence. Every number the new text states must appear in that evidence.
  A HUMAN entry remains a primary source on its own quote.
- **Brand/chain-level evidence never sets a property fact** (`brandLevel()`,
  `tagBasisProblem()`): "any Marriott or Hilton brand hotel will do blocks", or
  a reddit block labelled `[basis=region|chain]`, set `block_type: guaranteed`
  on individual hotels. The enrich upload gate uses the same helper.
- **An edit that fails takes its tags with it**: an unconfirmable fact gets
  neither the sentence nor the tag (Kiara, 2026-10-02).
- **Shared gate modules**: text gates in `prose-gate.mjs` (incl.
  `priceContradiction()` and `dossierMarker()`), source checks in
  `evidence.mjs`. `gate.mjs`, `gate-corrections.mjs`, `gate-contradictions.mjs`
  and the apply scripts import them; none keeps its own copy.
- **Retired writers**: `reconcile-mismatch.mjs` / `reconcile-remaining.mjs`
  refuse `--apply` (they rewrote price_text from tags with no source: Et Voila),
  and `apply-creates.mjs` refuses to run (the 138 templated "creates" entries,
  plan item 12, are to be removed; new vendors go through the enrich drafter).

Requires migration `0037` (per-key filter provenance) applied first.

## The three directions

- **A - filters to recon.** A tag exists, no entry mentions it. Append a short
  clause to a **bot** entry so a couple reading the recon learns the fact. This
  is where essentially all the value is.
- **B - recon to filters.** An entry states a fact, no matching tag. Write the
  tag, with the verbatim sentence as evidence. Near-zero yield in practice - the
  price gaps it chases are usually a fee, a ticket price, or a discount, not a
  wedding rate. That is correct behaviour, not a miss.
- **Corrections - a tag disproves what an entry says.** Where the tag is
  well-evidenced (a published quote that is not garbled), replace the false
  clause with the true fact. This is the ONE replace in the system; everything
  else is append-only, which is why the rest is safe to run at scale.

## Phase order (load-bearing)

```
export        snapshot EVERYTHING first, then write the pass input
build-calls   contract + per-type allowed-value vocabulary -> Batch call files
batch         submit / status / collect  (ANTHROPIC_BATCH_API_KEY)
gate          prose gates + value validation + verbatim-quote evidence check
apply         --apply to write; dry run by default; resumable
```

Corrections branch off `results.jsonl` after a run:

```
build-corrections   contradictions with clean evidence -> calls-fix/
batch ... --calls calls-fix --results results-fix.jsonl
gate-corrections    old must be a verbatim substring; new must state the fact
apply-corrections   clause-level replace on the LIVE field; --apply to write
```

**Undo lives outside any worktree** (`audit.mjs`). Every write goes through a
`WriteRun`, which snapshots exactly the rows it will touch from a fresh read
(fsynced) BEFORE the first write and appends one line per field write to an
audit log. Both live in the **MAIN checkout**, found via `git rev-parse
--git-common-dir`, so deleting the worktree a run came from can never delete its
undo again:

```
<main checkout>/data/reconcile/<work>/runs/<run_id>/run.json
<main checkout>/data/reconcile/<work>/runs/<run_id>/snapshot-<table>.jsonl
<main checkout>/data/reconcile/<work>/audit.jsonl
```

There is no skip-snapshot flag: `WriteRun.update/insert/remove` throw unless the
row was snapshotted first.

`restore.mjs --work <name> --run <run_id> [--apply]` reverts one run,
`--runs` every run of the work, `--from-export` the export snapshot (the old
behaviour). With none of the three it lists the runs on file, or falls back to the
export snapshot when there are no runs. It is the only undo -
`recon_entries` keeps no history.

## Rules that cause real damage if broken

- **Snapshot before writing.** A run with no snapshot must not proceed.
- **Bot entries only.** A real person's words are never edited (the `is_bot`
  gate, the same line migration `0036` drew).
- **Never write a negative from silence.** An explicit `false` removes a vendor
  from a filter; only write one when an entry says the vendor lacks the thing.
- **Creating a multi-value list asserts completeness** and can hide a vendor;
  appending to an existing one only adds matches. The gate counts the two
  separately for a human read.
- **Every tag write carries its evidence** - a quote that must appear verbatim
  in the entry it cites, checked mechanically by the gate, AND (when that entry
  is a bot's) a verbatim quote from a harvested source (see above).
- **Every prose edit carries source evidence** - see above. The same prose gates
  as enrich run on the result, so an edit can never make a card worse.
- **Corrections only from a tag you can trust** - published confidence, a quote
  that is not scrape concatenation. Everything else stays a report.

## Typical run

```sh
node scripts/reconcile/export.mjs      --work co-full
node scripts/reconcile/build-calls.mjs --work co-full          # or --type X --limit N to pilot
node scripts/reconcile/batch.mjs submit  --work co-full
node scripts/reconcile/batch.mjs status  --work co-full        # until "ended"
node scripts/reconcile/batch.mjs collect --work co-full
node scripts/reconcile/gate.mjs        --work co-full          # read gate-report.txt
node scripts/reconcile/apply.mjs       --work co-full          # dry run
node scripts/reconcile/apply.mjs       --work co-full --apply
```

Pilot a small `--type ... --limit 60` slice and read the report by hand before a
full run. Working artifacts land in `data/reconcile/<work>/` (gitignored).

## On-write reconcile (the `daily-*` scripts)

A separate, **tags-only** flow that keeps `vendors.filters` in agreement with
recon on an ongoing basis, instead of a one-off region sweep. A DB trigger
(migration `0038`) stamps `vendors.filters_dirty_at` whenever recon changes
(insert/update/delete, human or bot); a daily batch reconciles the stamped
vendors from **all** of their active entries. It writes tags only and never edits
a recon entry, so a couple's own entry is a valid source. **Since 2026-10-02 a
BOT entry is not a source on its own**: the contract asks the model to cite a
human entry wherever one states the fact, and a write whose only support is a bot
entry is rejected at apply unless it also carries a verbatim harvested-source
quote (`reviewTagWrite()` in `evidence.mjs`). In practice the daily pass takes
tags from human entries. See `docs/filter-recon-on-write.md`.

```sh
node scripts/reconcile/daily-export.mjs     --work daily-20260812   # dirty vendors + snapshot + watermark
node scripts/reconcile/daily-build-calls.mjs --work daily-20260812  # tags-only contract -> calls/
node scripts/reconcile/batch.mjs submit  --work daily-20260812      # shared driver, unchanged
node scripts/reconcile/batch.mjs status  --work daily-20260812      # until "ended"
node scripts/reconcile/batch.mjs collect --work daily-20260812
node scripts/reconcile/daily-apply.mjs   --work daily-20260812          # dry run: writes report.md
node scripts/reconcile/daily-apply.mjs   --work daily-20260812 --apply
```

Each write is classified create / extend / overwrite / retract (agree writes
nothing). A contradiction is resolved human-over-bot then by weight of evidence,
applied, and called out in `report.md` for review; `restore.mjs --work <name>
--apply` is the undo (`--run <run_id>` for one day's run). `.github/workflows/filter-recon-daily.yml`
runs the whole sequence. It shipped disabled and has run on a writing daily cron
since Kiara enabled it on 2026-08-13; whether to pause it is her call.
