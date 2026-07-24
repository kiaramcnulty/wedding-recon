-- Split the legacy `music` vendor type into two: `dj` (DJs) and `band`
-- ("Live music" — ALL live performers: bands, string quartets, soloists,
-- pianists, ceremony ensembles). This migration ONLY adds the two enum values.
--
-- ORDER OF OPERATIONS (important): Postgres will not let you ADD an enum value
-- and then USE that value in the SAME transaction. So run THIS file first, on
-- its own, and only then run 0021 (the reclassification that reads/writes the
-- new values) as a SEPARATE execution in the Supabase SQL editor.
--
-- `add value if not exists` makes this idempotent — re-running is a no-op.
-- The old `music` value is intentionally LEFT in the enum: Postgres can't drop
-- an enum value without recreating the type, and keeping it is harmless once
-- 0021 has reclassified every row away from it. The app treats `music` as a
-- hidden legacy value (lib/constants/categories.ts → LEGACY_VENDOR_TYPES).

alter type vendor_type add value if not exists 'dj';
alter type vendor_type add value if not exists 'band';
