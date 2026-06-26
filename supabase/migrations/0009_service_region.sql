-- Add service_region to recon_entries for non-venue vendors (florist, caterer, etc.).
-- Idempotent so it's safe to re-run.
alter table recon_entries add column if not exists service_region text;
