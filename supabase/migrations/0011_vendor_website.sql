-- Vendor website (from Google Place Details), shown as a "Visit website" link on
-- the vendor page. Populated for vendors created via the Google Places path
-- going forward; existing rows stay null until re-created/backfilled.
--
-- Idempotent. Apply by hand in the Supabase SQL editor BEFORE deploying — the
-- Google vendor insert references this column, so without it vendor creation
-- via Add Recon fails.
alter table vendors add column if not exists website text;
