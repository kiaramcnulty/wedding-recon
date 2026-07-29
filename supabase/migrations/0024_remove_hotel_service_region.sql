-- Hotel blocks are a fixed property in one place, not a service-area vendor — the
-- "Service region" field never meant anything for this type (it leaked in only
-- because the form's condition was "not a venue", and hotel wasn't carved out yet).
-- Null out whatever the enrich pipeline or a user already wrote for `hotel` vendors.
--
-- Idempotent: re-running just re-nulls an already-null column.

update recon_entries
set service_region = null
where vendor_id in (select id from vendors where vendor_type = 'hotel')
  and service_region is not null;
