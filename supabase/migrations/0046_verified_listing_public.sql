-- 0046_verified_listing_public.sql
-- Vendor Verification: the public read of a verified vendor's listing content,
-- for the vendor page. Returns the published intro / CTA / pricing / links of a
-- vendor whose perks are live, and NOTHING for anyone else.
--
-- Needed because vendor_listings has no anon select (drafts must never leak), so
-- the public vendor page - viewed logged out - cannot read the table directly.
-- Same SECURITY DEFINER pattern as verified_vendor_ids (0044): it joins that set
-- function, so the perks rule (approved claim + active subscription + published
-- listing) stays in exactly one place, and only a verified vendor's row can come
-- back. search_path is pinned, as every definer function here is.
--
-- Scalar-ish: at most one row (vendor_id is the listings primary key), so the
-- caller reads row[0] or null.
--
-- NOTE: no apostrophes and no dollar-quote token in the comments of this file.
-- Not auto-applied - hand-apply in the Supabase SQL editor, AFTER 0042-0044.

create or replace function public.verified_listing_public(p_vendor_id uuid)
returns table (
  vendor_id uuid,
  intro text,
  cta_label text,
  cta_url text,
  website text,
  instagram text,
  pricing jsonb,
  photos jsonb
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    l.vendor_id, l.intro, l.cta_label, l.cta_url,
    l.website, l.instagram, l.pricing, l.photos
  from vendor_listings l
  join verified_vendor_ids(array[p_vendor_id]) vv on vv.vendor_id = l.vendor_id;
$fn$;

grant execute on function public.verified_listing_public(uuid)
  to anon, authenticated;
