-- Add service_region to recon_entries for non-venue vendors (florist, caterer, etc.)
alter table recon_entries add column service_region text;
