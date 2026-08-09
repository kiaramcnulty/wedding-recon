-- Per-key provenance for vendors.filters.
--
-- vendors.filters_source is ONE label for the whole jsonb blob, and it cannot
-- describe a row whose keys came from different places. The reconciliation pass
-- writes individual tags from recon text while the rest of the row stays
-- extraction-sourced, so a single row-level label would relabel six attributes
-- the pass never touched. The same column also means one hand edit through the
-- app freezes the entire vendor against every future update, because the
-- precedence rule skips any row marked manual - all seven of its attributes,
-- permanently, on the strength of one.
--
-- filters_meta is keyed exactly like filters. Every populated key in filters
-- gets an entry:
--
--   {"price_min": {"source": "recon", "updated_at": "...", "quote": "..."}}
--
-- source uses the same vocabulary as the row-level column and the same
-- precedence: manual over recon over extraction.
--
-- quote is the verbatim recon sentence a recon-sourced value was read from. It
-- is REQUIRED on every recon write and absent on extraction rows, which predate
-- the rule. A tag whose evidence is recorded can be audited after the fact; one
-- without evidence cannot. This generalizes what price_quote already does for
-- prices to every attribute.
--
-- The row-level columns are LEFT IN PLACE and still maintained. Nothing reads
-- filters_meta yet, so dropping them would break scripts/backfill-vendor-filters.mjs
-- and the app for no gain.

alter table vendors add column if not exists filters_meta jsonb;

-- Backfill: stamp every existing key with the row label it currently carries.
-- Without this the pass cannot tell "extraction wrote this" from "nobody has
-- written this yet", and would read every pre-existing tag as unattributed.
--
-- Null-valued keys are skipped: absence is the only way this schema says
-- "unknown", so a null carries no provenance worth recording.
--
-- Only rows with no filters_meta are touched, so a second run is UPDATE 0.
update vendors v
set filters_meta = (
  select jsonb_object_agg(
    e.k,
    jsonb_strip_nulls(jsonb_build_object(
      'source', coalesce(v.filters_source, 'extraction'),
      'updated_at', v.filters_updated_at
    ))
  )
  from jsonb_each(v.filters) as e(k, val)
  where jsonb_typeof(e.val) <> 'null'
)
where v.filters is not null
  and jsonb_typeof(v.filters) = 'object'
  and v.filters_meta is null;

-- Deliberately NO index. Every reader of this column looks a vendor up by id
-- and reads its whole provenance map; nothing searches across vendors by
-- provenance. A GIN index would be taxed on every vendor write and read by
-- nothing. Add one when a query actually needs it.

comment on column vendors.filters_meta is
  'Per-key provenance for filters: source, updated_at, and the verbatim recon quote behind a recon-sourced value. See supabase/migrations/0037.';

-- Verification. Every populated, non-null key in filters should now carry a
-- filters_meta entry. Expect 0.
select count(*) as keys_missing_provenance
from vendors v,
     jsonb_each(v.filters) as e(k, val)
where v.filters is not null
  and jsonb_typeof(v.filters) = 'object'
  and jsonb_typeof(e.val) <> 'null'
  and not (coalesce(v.filters_meta, '{}'::jsonb) ? e.k);
