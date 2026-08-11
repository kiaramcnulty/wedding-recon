# Enrich emits filters too

**Status: BUILT (2026-08-09), pending a small-scale test run.** The code below is
implemented on branch `enrich-filter-emission`; the "Build order" is now a map of
what was done, and "Test plan" is the next step before merging.

**Goal (Kiara, 2026-08-09).** `/enrichvendors` should populate `vendors.filters`
alongside `recon_entries`, from the same research pass, so the two stores are
**equivalent by construction** and never drift again. Today enrich writes only
recon; `vendors.filters` was a one-off backfill (`data/filter-extraction/`), so a
newly launched region gets recon-only vendors that appear in NO filtered search.

The **hard rule** — every filter tag must be documented in the recon a couple
reads — is already written into `references/common/draft-contract.md` (the
"Filter tags" section). This doc is the plumbing that carries the worker's tags
to the database and enforces that rule mechanically.

**Why the draft worker, not a separate pass:** a separate extraction is exactly
what drifted. The worker already reads the dossier to write the prose; emitting
the tags from the same call, in the same judgment, is what makes them agree.

**Must be validated on a real region run** — this changes the working enrich
pipeline. Build it backward-compatible (a call file or worker that emits no
`filters` behaves exactly as today), then run one small type/region and watch the
upload gate before trusting it.

## Build order

### 1. Inline the per-type FILTER VOCABULARY into the call file
`pipeline.mjs batch` assembles each call file header from the references
(contract + core rules + type rules + voices). Add one more block: the vendor
type's allowed filter keys and values, generated from `VENDOR_FILTERS` in
`lib/constants/vendor-filters.ts`.

- Import `VENDOR_FILTERS` (the scripts already run under Node 24, which strips TS
  types — `reconcile/build-calls.mjs` imports it directly, copy that).
- Render, for the run's type, each def as `key (kind) allowed: v1, v2, ...` (multi),
  `key (true/false)` (bool), `key (number range: lo/hi, basis B)` (range). Reuse
  the `vocabulary()` function from `scripts/reconcile/build-calls.mjs` verbatim —
  it already does exactly this.
- Insert under a `FILTER VOCABULARY (vendor type "<type>")` heading so the
  contract's "inlined in the header block above" reference resolves.

### 2. Carry `filters` through the worker output -> CSV
The worker emits `filters` as a JSON object on each vendor's first row. The
intermediate is a flat CSV (`profile.headers` in `etype.mjs`).

- Add one column, `filters_json`, to every type's `headers` in `etype.mjs`.
- `pipeline.mjs merge` (`readWorkerRows`): when a row has a `filters` object,
  `JSON.stringify` it into the `filters_json` cell; leave blank on rows without.
  Everything else about merge is unchanged.
- Keep it OPTIONAL: a row with no `filters` -> empty cell -> no filter write.
  This is what makes the change backward-compatible.

### 3. Write filters in `upload.mjs`, behind the hard gate
This is where the hard rule is ENFORCED. For each vendor's `filters_json`:

- Parse it. For each `key: {value, quote}`:
  - **Validate the value** against `VENDOR_FILTERS` for the type — value in the
    allowed list (multi), boolean (bool), finite number (range). Invalid -> FAIL
    the upload (like a banned phrase), naming the vendor + key.
  - **Enforce the hard rule**: `norm(quote)` must be a verbatim substring of
    `norm(all of this vendor's notes + price_text + price_details)`. Not found ->
    FAIL. This is the mechanism that guarantees tag ⊆ recon. Lift `norm()` and the
    substring check from `scripts/reconcile/gate.mjs` (the Direction-B evidence
    check) — it is the same test, pointed at the recon instead of the research.
  - **Never write `false`/`[]` from silence**: the worker contract forbids it, but
    the gate should also reject a `false` whose quote does not positively state
    the absence. Cheap belt-and-suspenders.
- Assemble the vendor's `filters` jsonb (values only) and `filters_meta`
  (`{key: {source: "recon", updated_at, quote}}`), and `update vendors set
  filters, filters_meta, filters_source='recon', filters_updated_at` — the same
  write `scripts/reconcile/apply.mjs` already does. Skip a vendor whose
  `filters_source` is already `manual`.
- Do it in the same run as the recon insert, AFTER the recon rows for that vendor
  are in (so the quote-in-prose check runs against what actually landed). Resumable
  the same way the recon insert is.

### 4. `pipeline.mjs status` — surface it before upload
Add to the pre-upload check: for each vendor with `filters_json`, run the same
substring check and report any tag whose quote is not in the prose, so it is
caught cheaply at `status` rather than failing the upload. Mirror the existing
prose-gate reporting there.

### 5. Retire the standalone backfill path (doc only)
`scripts/backfill-vendor-filters.mjs` + `data/filter-extraction/` were the
one-off. Leave them (they still regenerate the slider histograms via
`--hist-only`), but note at the top of the backfill script that live filter
population now happens in enrich, and this script is for the histogram artifact
and one-time backfills only.

## Reuse — most of this already exists in `scripts/reconcile/`
- `vocabulary()` (build-calls) -> step 1
- the value validator + `norm()`/substring evidence check (gate.mjs) -> step 3
- the `filters` + `filters_meta` + `filters_source` write (apply.mjs) -> step 3
- migration `0037` (`filters_meta`) is already applied.

## Test plan for the run-backed session
1. Pick the smallest type/region (dress, ~a dozen vendors in a metro).
2. Run through `batch` -> `draft`/workers -> `merge`, and read a few `filters_json`
   cells by hand: are the tags sane, does each quote appear in that vendor's prose?
3. `upload --dry`: confirm the gate passes clean rows and FAILS a deliberately
   broken one (hand-edit a quote so it is not in the prose; the upload must
   reject it).
4. `upload --apply` a few, then verify in the DB: `filters` populated,
   `filters_meta` carries the recon quote, `filters_source='recon'`, and the
   Explore matcher surfaces the vendor under the tagged filters.
5. Only then run a full region.

## Launch skill
`/launchvendors` needs no filter logic — it seeds vendor rows before any research
exists. Filters come from enrich, where the research is. Add one line to
`launchvendors/SKILL.md` pointing at enrich for filter population so the split is
documented.
