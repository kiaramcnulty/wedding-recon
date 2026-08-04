-- A bridal shop is a storefront you book an appointment at and return to for
-- fittings — it never travels to the couple, so the "Service region" field never
-- meant anything for this type. It leaked in the same way hotels did: the form
-- condition was an exclusion list that only named venues, so every other type
-- got the field by default, and the enrich pipeline filled it with the shop own
-- city as a fallback.
--
-- Null out whatever the enrich pipeline or a user already wrote for `dress`
-- vendors. Exactly the cleanup `0024` did for `hotel`.
--
-- Idempotent: re-running just re-nulls an already-null column.

update recon_entries
set service_region = null
where vendor_id in (select id from vendors where vendor_type = 'dress')
  and service_region is not null;
