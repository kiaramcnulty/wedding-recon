# Filter / recon reconciliation

Brings `vendors.filters` and `recon_entries` into agreement, using **only** a
vendor's existing tags and the text of its existing recon entries. No research,
no web access. Finding facts neither store holds is a separate, more expensive
pass and is deliberately out of scope (Kiara, 2026-08-09).

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

`restore.mjs --work <name>` reverts filters and recon text to the export
snapshot. It is the only undo - `recon_entries` keeps no history.

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
  in the entry it cites, checked mechanically by the gate.
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
a recon entry, so a couple's own entry is a valid source. See
`docs/filter-recon-on-write.md`.

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
--apply` is the undo. `.github/workflows/filter-recon-daily.yml` runs the whole
sequence (shipped disabled — manual dispatch, dry-run default).
