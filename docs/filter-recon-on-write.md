# Filters reconcile on every recon write

**Status: PLAN (2026-08-12, Kiara). Not built.** Agreed shape after a design
pass; this is the spec to implement against.

## Goal

Every recon entry that lands — a couple through the site, a bot from enrich, a
one-off script — should pull `vendors.filters` back into agreement with what the
recon now says. Today only the enrich path emits tags (`upload.mjs:371`); the
app path (`createRecon`, `updateRecon`) writes nothing to `filters`, so a couple
logging a real quote never becomes filterable.

The rule being enforced (unchanged from `filter-recon-reconciliation.md`): **what
recon says and what the tags say should be equivalent, and every keep/extend/
overturn is a model judgment, never a regex.**

## Shape in one paragraph

Do **not** hook tag-writing onto the write. A DB trigger on `recon_entries`
marks the vendor dirty; a **daily batch** recomputes that vendor's tags from
**all** its active entries, using the existing `scripts/reconcile/` pipeline
pointed at dirty vendors instead of a region. Recon submit stays synchronous and
untouched — the model work (minutes, on the Batch API) can never sit in front of
the "Save recon" tap, and recon must save even if reconciliation later fails.

## Two writers, reconciler wins (decided)

Enrich keeps writing tags inline at upload (a freshly launched region is
filterable immediately). The daily reconciler is authoritative and runs last.
They don't drift because both obey the same invariant — **every tag is quoted
verbatim in the recon prose** — so the reconciler, reading that prose, re-derives
what enrich wrote; where they differ it has seen more (later human entries) and
correctly wins. Enrich-created entries also mark the vendor dirty, so they flow
through the same authoritative pass.

## 1. Trigger — new migration `0038`

- Add `vendors.filters_dirty_at timestamptz` (null = clean).
- `mark_vendor_filters_dirty()` AFTER INSERT/UPDATE/DELETE on `recon_entries`,
  `for each row`: set `filters_dirty_at = now()` on `NEW.vendor_id`
  (INSERT/UPDATE) or `OLD.vendor_id` (DELETE). UPDATE covers a status flip
  (active↔removed), which changes the vote and must re-trigger. Idempotent —
  coalesces to one row per vendor no matter how many entries an enrich upload
  inserts.
- Trigger is on `recon_entries`, writes `vendors` — no loop, since the
  reconciler writes `vendors.filters*`, never `recon_entries` structure the
  trigger keys on. (It *does* edit bot prose in Direction A; that fires the
  trigger again, converges on the next run, and is harmless — the entry it just
  wrote already matches the tag.)
- Idempotent DDL per repo convention; hand-applied.

**Why a trigger, not app code:** app code in the Server Actions would miss
script- and enrich-created entries. The requirement is *any* recon write; the
trigger is the one place that sees all of them.

## 2. Selection — `export.mjs --dirty`

Add a `--dirty` mode to `export.mjs` that selects `vendors where
filters_dirty_at is not null` instead of a type/region. Everything downstream is
unchanged: it snapshots each dirty vendor's `filters`/`filters_meta` and all
active entries (the snapshot is the only undo), then writes the pass input.

Record the max `filters_dirty_at` seen. After a successful apply, clear only
`filters_dirty_at <= that watermark`, so an entry that arrives mid-run keeps a
newer timestamp and survives to tomorrow. No entry is lost, none double-processed.

## 3. Recompute-from-all (the model call)

Per dirty vendor, one Batch call given: the type's `VENDOR_FILTERS` vocabulary
(keys, kinds, allowed values — reuse `build-calls.mjs vocabulary()`), the
current `filters` + their `filters_meta` evidence, and **all** active recon
entries, each tagged with its author's `is_bot`. The model returns the
reconciled tag set, a verbatim evidence quote per tag, and **classifies every
change** as create / agree / extend / contradict.

Recompute-from-all is what makes extend, delete-retraction and evidence-counting
fall out in one idempotent, order-independent judgment. It is **not** "regenerate
tags from scratch and discard anything not re-derived" — see the retention rule
below.

### Resolution rules the call must follow

- **create** — an entry states a fact no tag holds → write it (with evidence).
  First recon on a brand-new user vendor lands here: no baseline, create the tags.
- **agree** — entry matches the tag → leave it.
- **extend** — entry expands the tag. Multi-select → union (already what enrich
  does). Range → widen **only** when the new figure is the same basis and kind
  (a full-wedding package, not an add-on, fee, deposit, or per-person number). A
  smart judgment call, explicitly not `Math.max` — an unqualified widen blows the
  Explore price slider open and misprices the vendor.
- **contradict** — an entry explicitly disproves a tag. Resolve by (a) human
  recon over bot recon (read each entry's `is_bot`), then (b) weight of evidence
  (count and confidence of entries on each side). **Silence is never a vote** —
  only an explicit positive claim participates. Applied automatically, but see §5.

### Retention rule (footgun)

A tag no entry mentions is **left untouched** — silence never removes, same as it
never writes a negative. A recon-sourced tag is *retracted* only when the entry
its `filters_meta` quote came from is gone (deleted/removed) **and** no other
entry supports it. Extraction-sourced tags with no prose support predate the
invariant and are left alone. State this in the call; do not let "recompute" read
as "drop anything the current prose doesn't say."

### Hard rules carried over (unchanged)

Never write `false`/`[]` from silence; only ever edit/author recon under a bot
account; skip any **per-key** `filters_meta.source = 'manual'` (0037 provenance
means one hand-edited tag no longer freezes the whole vendor); every tag write
carries a verbatim quote checked mechanically by the gate; all prose passes the
existing `upload.mjs` gates. Prose-only — **no web research** in this loop (that
is the separate expensive pass, out of scope), which is what keeps the daily cost
in cents.

## 4. Apply — reuse `apply.mjs`

`apply.mjs` already merges against a fresh row read and skips manual. It sets
`filters`, `filters_meta` (`{key: {source:'recon', updated_at, quote}}`),
`filters_source='recon'`, `filters_updated_at`. Add the `filters_dirty_at`
compare-and-clear from §2. Resumable via `applied.jsonl` as today.

## 5. Contradictions: apply, alert, undo (decided)

Contradictions are **applied automatically** (not queued), because Kiara wants
the map correct without a human in the loop — but each one is recorded so it can
be reviewed and reverted:

- Every run writes a report to `data/reconcile/daily/<date>/report.md` (a
  document Kiara can open). All changes are listed; **contradictions are a
  called-out section at the top** with vendor, key, old → new, the winning
  evidence and the losing evidence, and the exact `restore.mjs` command to undo
  that vendor.
- Undo is the existing snapshot: `restore.mjs --work daily-<date> --apply`
  reverts filters + prose to the pre-run state (per-vendor or whole run).
- The daily runner surfaces the report (GitHub Action job summary + the committed
  dated file), so a wrong overturn is one revert away rather than silent.

## 6. Where it runs

A scheduled GitHub Action (`.github/workflows/filter-recon-daily.yml`, alongside
`keepalive.yml`), using the same repo secrets the SessionStart hook reads
(`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`ANTHROPIC_BATCH_API_KEY`). It runs export → build-calls → batch submit → poll
status → collect → gate → apply → clear-dirty → write report. The Batch API is
async; if a batch has not `ended` inside the poll window, collect+apply defer to
the next run (the vendors stay dirty), so the job never blocks.

## 7. What does NOT change

- `createRecon` / `updateRecon` / recon delete: untouched. They only fire the
  trigger (for free, via the DB).
- Enrich `upload.mjs`: untouched (two-writer decision).
- The matcher, the RPCs (`0034`/`0035`), the Explore UI: untouched — they read
  `vendors.filters` and don't care who wrote it.
- `scripts/reconcile/` phase order and gates: reused, not rewritten. The only new
  code is the `--dirty` selector, the classification in the call/gate, the
  compare-and-clear, the daily runner, and migration `0038`.

## 8. Build order / validation

1. Migration `0038` + trigger; hand-apply; verify a recon insert stamps
   `filters_dirty_at` and a delete stamps the right vendor.
2. `export.mjs --dirty` + compare-and-clear.
3. Classification in build-calls + gate (create/agree/extend/contradict, the
   resolution and retention rules).
4. Report writer + wire `restore.mjs` per-run.
5. Pilot: hand-dirty ~10 vendors across two types, run the whole pipeline
   locally, read the report, deliberately plant a contradiction and confirm it
   applies **and** is called out **and** reverts cleanly with `restore`.
6. Daily Action last, once the pipeline is trusted by hand.

Pilot before the Action is live: this auto-mutates user-visible data daily, and
the snapshot is the only undo.
