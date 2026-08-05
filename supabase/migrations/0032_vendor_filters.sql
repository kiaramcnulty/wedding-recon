-- Vendor filter attributes.
--
-- One jsonb column rather than a column per attribute: no vendor type owns more
-- than about 7 attributes, so a typed-column layout would be roughly 90 percent
-- null across 45 columns, and every future vendor type would need another
-- migration. The keys are documented in lib/constants/vendor-filters.ts, which
-- is also what the UI and the matcher read.
--
-- Shape (only the keys that apply to the vendor type are present):
--   venue   setting[], ceremony_location[], catering_policy[], capacity_max,
--           has_lodging, has_getting_ready_suite, price_min, price_max,
--           price_basis, price_kind, price_confidence, price_quote, price_tiers[]
--   photos  style[], does_elopements, travels_destination, shoots_film, ...
--   ...     see the config module for the full per-type list.
--
-- Values are extracted, evidence-backed, and every price carries a verbatim
-- price_quote. Absence of a key means nobody wrote the fact down, NOT that the
-- vendor lacks the thing, which is why the RPC in 0033 demotes rather than
-- excludes on a missing key.

alter table vendors add column if not exists filters jsonb;

-- Where the current value came from, so a re-run of the extraction pipeline
-- cannot silently clobber something a human set through the app. The backfill
-- and the launch/enrich skills write extraction; app-side recon writes recon;
-- a hand edit writes manual. Precedence is manual over recon over extraction.
alter table vendors add column if not exists filters_source text;

alter table vendors drop constraint if exists vendors_filters_source_check;
alter table vendors add constraint vendors_filters_source_check
  check (filters_source is null or filters_source in ('extraction', 'recon', 'manual'));

alter table vendors add column if not exists filters_updated_at timestamptz;

-- jsonb_path_ops is about half the size of the default opclass and is faster for
-- the containment queries this column actually gets. It does not support the
-- key-exists operators, which is fine: the RPC tests values, never bare keys.
create index if not exists idx_vendors_filters
  on vendors using gin (filters jsonb_path_ops);

comment on column vendors.filters is
  'Extracted filter attributes, keyed per vendor type. See lib/constants/vendor-filters.ts.';
