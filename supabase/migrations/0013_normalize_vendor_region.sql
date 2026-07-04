-- 0013_normalize_vendor_region.sql
-- Canonicalize vendors.region to a 2-letter USPS state code.
--
-- The column is meant to hold a 2-letter state code ("CO") — what the bulk importer
-- writes and what every reader filters on (`region = 'CO'`). The Google-Places "Add
-- Recon" path, however, captured the "ST ZIP" segment of the formatted address and
-- stored e.g. "CO 80513", so those rows fall out of every region-scoped query.
--
-- Going forward these are normalized at write time by lib/normalize-region.ts; this
-- migration cleans the rows already in the table. It only touches values shaped like
-- "<2 letters> <5 digits...>" and rewrites them to the leading 2-letter code, so clean
-- "CO" rows and any other values are left alone.
--
-- Idempotent: after it runs, no row matches the WHERE clause, so re-running is a no-op.
-- NOT auto-applied to the hosted DB — run by hand in the Supabase SQL editor.

update vendors
set region = upper(substring(region from '^\s*([A-Za-z]{2})'))
where region ~ '^\s*[A-Za-z]{2}\s+\d{5}';
