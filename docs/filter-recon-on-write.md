# Filters reconcile on every recon write

**Status: BUILT (2026-08-12), pending a credentialed pilot.** Code is on branch
`claude/filter-tags-vendor-entries-2ewmy5`. The daily Action is shipped
**disabled** (manual dispatch, dry-run default, cron commented) — it mutates
user-visible data on model judgment and the snapshot is the only undo, so it must
be piloted by hand before the cron is enabled.

**Scope: TAGS ONLY.** This loop writes `vendors.filters` from recon and never
edits a recon entry. That is the whole of what was asked (create / agree / extend
/ contradict on the *tags*), and it is why a couple's own human-authored entry is
a first-class input here — we read it, we never rewrite it. Documenting a tag
back into prose (Direction A) and finding facts neither store holds stay with the
separate offline pass (`scripts/reconcile/export.mjs` …), which is unchanged.

**As built:** migration `0038` (trigger) + three scripts that reuse the existing
`lib.mjs` plumbing and the `batch.mjs` Batch-API driver verbatim —
`daily-export.mjs`, `daily-build-calls.mjs`, `daily-apply.mjs` — plus
`.github/workflows/filter-recon-daily.yml`. The merged offline reconcile pass and
enrich's inline filter emission are untouched.

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
  reconciler writes only `vendors.filters*` and never touches `recon_entries`
  (tags-only scope). So a reconcile run cannot re-fire its own trigger.
- Idempotent DDL, apostrophe-free comments, hand-applied — as built in
  `supabase/migrations/0038_recon_marks_filters_dirty.sql`.

**Why a trigger, not app code:** app code in the Server Actions would miss
script- and enrich-created entries. The requirement is *any* recon write; the
trigger is the one place that sees all of them.

## 2. Selection — `daily-export.mjs`

`daily-export.mjs` selects `vendors where filters_dirty_at is not null` (not a
type/region), snapshots each one's `filters`/`filters_meta` and all active
entries (the snapshot is the only undo), and writes the pass input. Unlike the
offline `export.mjs` it is **not edit-only**: a human-only vendor is exported and
reconciled, since Direction-B tag writes read human entries too. A dirty vendor
whose last entry was just deleted is exported with an empty entry list — a
retract candidate.

It records the max `filters_dirty_at` seen to `watermark.json`. `daily-apply.mjs`
clears the flag only where `filters_dirty_at <= that watermark`, so an entry that
arrives mid-run keeps a newer timestamp and survives to the next run. No entry is
lost, none double-processed.

## 3. Recompute-from-all (the model call) — `daily-build-calls.mjs`

Per dirty vendor, one Batch call given: the type's `VENDOR_FILTERS` vocabulary
(keys, kinds, allowed values), the current `filters` with each key's
`filters_meta.source` shown (a `manual` key is rendered **LOCKED**), and **all**
active recon entries, each labelled HUMAN or BOT. The model returns a per-vendor
JSON object classifying every change as **create / extend / overwrite / retract**
(agree = emit nothing), each write carrying `op`, `value`, a verbatim `quote`,
and the `entry_id` it came from; an overwrite also carries `human_support` /
`bot_support`. Call files land in `<work>/calls/` and run through `batch.mjs`
(submit / status / collect) unchanged.

Recompute-from-all is what makes extend, delete-retraction and evidence-counting
fall out in one idempotent, order-independent judgment. It is **not** "regenerate
tags from scratch and discard anything not re-derived" — see the retention rule
below.

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

### Hard rules carried over

Never write `false`/`[]` from silence (the gate flags any `false` for review);
skip any **per-key** `filters_meta.source = 'manual'` — and skip a whole vendor
whose row-level `filters_source = 'manual'` — so a hand edit is never clobbered
(0037 provenance means one manual tag no longer freezes the vendor); every tag
write carries a verbatim quote, checked mechanically as a substring of the cited
entry, so invented evidence fails. **No web research** in this loop (that is the
separate expensive pass, out of scope), which keeps the daily cost in cents.

## 4. Apply — `daily-apply.mjs`

Validates each write (value in the type's vocabulary, price has a basis, quote
verbatim in its entry), then merges against a **fresh** row read so a value that
changed since the export is not clobbered: **create** sets an absent key,
**extend** unions a list or widens a range (min key down / max key up, derived
from the def), **overwrite** replaces, **retract** deletes the key and its meta.
It sets `filters_meta` (`{key: {source:'recon', updated_at, quote}}`),
`filters_source='recon'`, `filters_updated_at`, and does the `filters_dirty_at`
compare-and-clear from §2. Dry run by default; `--apply` to write; resumable via
`applied.jsonl`.

## 5. Contradictions: apply, alert, undo (decided)

Contradictions are **applied automatically** (not queued) — but each is recorded
for review and revert:

- Each run writes `data/reconcile/<work>/report.md` (a document you can open, and
  the Action uploads it as an artifact). **Contradictions are a called-out
  `REVIEW THESE` section** with vendor, key, old → new, the `human N vs bot N`
  counts, the note, and the winning evidence quote. Retractions and explicit
  `false` writes get their own sections; rejected writes are listed too.
- **Model skips get their own section as well** — an ambiguity the model refused
  to settle, so it left the tag alone. Counted separately in the stats line and
  kept apart from rejected writes: a rejection is a bad write the gate caught, a
  skip is a judgment call, and it is the only thing in the report that asks the
  reader for a decision rather than a check. Also logged to `applied.jsonl` as
  `model_skips`, so they can be queried across runs.
- Undo is the snapshot: `node scripts/reconcile/restore.mjs --work <work> --apply`
  reverts filters to the pre-run state. The report prints this command up top.

## 6. Where it runs — `.github/workflows/filter-recon-daily.yml`

Reuses the repo secrets the SessionStart hook reads (`NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_BATCH_API_KEY`). Runs daily-export →
daily-build-calls → batch submit → poll status → collect → daily-apply →
clear-dirty, and uploads the report artifact. The Batch API is async; if a batch
has not `ended` in the poll window the job exits leaving the vendors dirty, so
the next run re-exports them.

**Shipped disabled:** `workflow_dispatch` only, cron commented out, `dry_run`
input defaulting **true**. Pilot by hand (dry run → read the report → a small
`--apply`) before uncommenting the schedule.

## 7. What does NOT change

- `createRecon` / `updateRecon` / recon delete: untouched. They only fire the
  trigger (for free, via the DB).
- Enrich `upload.mjs`: untouched (two-writer decision).
- The matcher, the RPCs (`0034`/`0035`), the Explore UI: untouched — they read
  `vendors.filters` and don't care who wrote it.
- `scripts/reconcile/` offline pass (`export`/`build-calls`/`gate`/`apply`/
  `restore`) and its phase order: reused where generic (`lib.mjs`, `batch.mjs`,
  `restore.mjs`), otherwise left alone. The new code is migration `0038`, the
  three `daily-*` scripts, and the workflow.

## 8. Validation

Done in this build:
- Migration `0038` is lexer-safe (apostrophes only inside the one string
  literal, none in `--` comments — the Supabase-editor footgun).
- The three scripts pass `node --check`.
- An offline dry-run against a fabricated venue fixture exercised every path:
  extend (range widen + list union), overwrite (reported as a contradiction with
  the vote counts + evidence), retract, a **manual-locked** key refused, and an
  **invented-evidence** write rejected. All behaved correctly.

Still required before enabling the cron (needs the three secrets — this container
has none):
1. Hand-apply `0038`; confirm a recon insert stamps `filters_dirty_at` and a
   delete stamps the right vendor.
2. Trigger the Action with `dry_run=true` on a small dirty set; read the report
   artifact.
3. A small `--apply`, verify in the DB, and confirm `restore.mjs` reverts it.
4. Only then uncomment the `schedule` in the workflow.

This auto-mutates user-visible data on model judgment; the snapshot is the only
undo.

---

## Update 2026-08-17: cron enabled, website backfill, own-site miner

The header above is superseded. The cron has been **enabled** since 2026-08-13
(it writes on the schedule; a hand dispatch still defaults to a dry run). Two
changes landed 2026-08-17, plus a crash fix.

**Crash fix.** A dirty vendor of a type with no filter vocabulary (`other`, e.g.
transportation) makes `daily-build-calls` emit zero call files, and `batch
submit` then exited 1 and failed the job. Guarded: no calls is a clean no-op.

**Dirty-on-human-only (migration `0040`).** The `0038` trigger stamped every
recon write. It now stamps only **human** inserts/edits; a bot insert or bot
content edit does not (removals and status flips still do, for any author). The
reason: a bot writer emits the vendor tags in the same pass it writes the entry
(enrich at upload, the miner as it drafts), so re-reconciling a bot entry only
re-derives what it already wrote — the redundant work that, once the miner also
INSERTS recon, would re-fire the trigger forever. The async pass exists to tag
recon whose author could not tag it, and that is only a human.

**Website backfill + filter-less drain (`daily-websites.mjs`).** For each dirty
vendor with no website but a `google_place_id`, one Google Places Details call
(`websiteUri`, Enterprise SKU, 1,000 free/mo) sets `vendors.website` —
deterministic, no model, covers every type incl. `other`. It also **drains**
filter-less-type vendors (clears their `filters_dirty_at`), since they get no
model result and nothing else would clear them; left set they re-export and
re-probe Places every run. Needs repo secret `GOOGLE_PLACES_API_KEY` (skips
cleanly without it). Runs before the miner so a just-found site is minable.

**Own-site tag/recon miner — BUILT, shipped GATED OFF.** Reads a vendor OWN
website only (no reviews, no web search, no third-party — an own-site quote can
only be about that business) for filter tags it does not yet have, and authors a
bot recon entry capturing each. Pieces: `site-fetch.mjs` (homepage + a few
same-host pricing/wedding/FAQ pages, capped), the mining section of
`daily-build-calls.mjs` (site vendors chunk small; `--no-mine` disables), and
`daily-mine-apply.mjs` — the one place the pass authors recon.

Guards (Kiara: same key gates as enrichvendors): `prose-gate.mjs` carries the
enrich recon-prose regexes copied verbatim (drop the entry on a violation, never
fail the run); every mined tag quote must be verbatim in its own drafted entry
and a number must appear in its quote; the author is a CO roster bot **not**
already writing for that vendor, so the one-per-author index (`0028`) cannot
collide; mining only CREATES an absent tag, never overwrites, never touches a
manual key, and authors nothing if every mined tag is already present (the
convergence guard). A run that adds recon opens a GitHub issue (the notification,
via the built-in token). `restore.mjs` undo now also deletes the inserted entries
and clears the dirty flag the delete sets.

**The miner is gated off** — the workflow passes `--no-mine`, so the live cron
does website-backfill + tag-reconcile (both tested) and the miner stays dormant.
It has only run in dry-run (a live site fetch, the prose gate, a real mining
call, the apply path over a crafted result). **Pilot before enabling:**

1. `node scripts/reconcile/daily-export.mjs --work pilot` then
   `daily-websites.mjs --work pilot --apply` (or dry).
2. `daily-build-calls.mjs --work pilot` (mining ON — no `--no-mine`), `batch.mjs
   submit/status/collect --work pilot`.
3. `daily-mine-apply.mjs --work pilot` (dry) → read `mine-report.md`.
4. A small `daily-mine-apply.mjs --work pilot --apply`; verify the entries and
   tags in the app; confirm `restore.mjs --work pilot --apply` reverts them.
5. Then delete `--no-mine` from the workflow to enable it on the schedule.
