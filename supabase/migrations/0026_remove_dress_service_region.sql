-- Bridal shops are a fixed storefront, not a service-area vendor — the "Service
-- region" field never meant anything for this type. Null out whatever the enrich
-- pipeline or a user already wrote for `dress` vendors.
--
-- Idempotent: re-running just re-nulls an already-null column.

update recon_entries
set service_region = null
where vendor_id in (select id from vendors where vendor_type = 'dress')
  and service_region is not null;
