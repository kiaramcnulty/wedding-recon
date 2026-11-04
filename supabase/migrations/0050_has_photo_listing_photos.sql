-- 0050_has_photo_listing_photos.sql
-- vendors_in_bbox.has_photo now counts a verified vendor whose published
-- listing carries its own uploaded photos.
--
-- Why. has_photo is the photo key of the Explore list order (0035) and has to
-- mirror what the preview card can actually show. Since 2026-11-04 the card
-- leads with a verified vendor upload (photoCandidates in
-- vendor-preview-card.tsx), so a verified vendor whose ONLY photos are its own
-- uploads would show a photo on its card yet rank as photo-less. That is the
-- one gap this closes; everything else in the function is 0045 unchanged.
--
-- How. vendors_in_bbox runs as the caller, and vendor_listings has no anon
-- select (drafts must never leak), so a plain exists() over the listings would
-- be false for every public reader. verified_listing_photo_ids is a SECURITY
-- DEFINER set function on the 0044 pattern: it joins verified_vendor_ids, so
-- the perks rule stays in one place and a draft, unpaid or revoked listing
-- never counts. vendors_in_bbox left-joins it ONCE per query, set-based, the
-- same way it joins verified_vendor_ids (the definer function does not inline,
-- so a per-row call would run once per row of the busiest query in the app).
-- The verified set is tiny, so the join side is too.
--
-- Return shape is unchanged, so this is create or replace (no drop), and the
-- existing grants on vendors_in_bbox carry over. A deploy needs no ordering:
-- the client already reads has_photo, and before this is applied it simply
-- keeps the 0045 value.
--
-- NOTE: no apostrophes and no dollar-quote token in the comments of this file.
-- The Supabase SQL editor mis-lexes them and splits statements. See the
-- Migrations section of CLAUDE.md.
--
-- Not auto-applied to the hosted DB - hand-apply in the Supabase SQL editor,
-- AFTER 0044 and 0045. Idempotent.

-- p_ids null returns every verified vendor with listing photos (the bbox left
-- join below); a non-empty photos ARRAY is required, so an empty or malformed
-- value never counts.
create or replace function public.verified_listing_photo_ids(p_ids uuid[] default null)
returns table (vendor_id uuid)
language sql
stable
security definer
set search_path = public
as $fn$
  select l.vendor_id
  from vendor_listings l
  join verified_vendor_ids(p_ids) vv on vv.vendor_id = l.vendor_id
  where case jsonb_typeof(l.photos)
    when 'array' then jsonb_array_length(l.photos) > 0
    else false
  end;
$fn$;

grant execute on function public.verified_listing_photo_ids(uuid[])
  to anon, authenticated;

create or replace function vendors_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  p_types vendor_type[] default null,
  max_rows integer default 500
)
returns table (
  id uuid,
  name text,
  vendor_type vendor_type,
  lng double precision,
  lat double precision,
  approximate boolean,
  has_price boolean,
  has_photo boolean,
  verified boolean
)
language sql
stable
as $fn$
  select
    v.id, v.name, v.vendor_type,
    st_x(v.location::geometry) as lng,
    st_y(v.location::geometry) as lat,
    -- SQL twin of isApproximateLocation() in lib/map/vendor-location.ts. A
    -- Google-sourced row carries rooftop coordinates; otherwise an address with
    -- no digit in it is a city or region centroid rather than a street address.
    -- Keep the two in lockstep: the dashed pin outline is drawn from this.
    case
      when v.source = 'google' or v.google_place_id is not null then false
      else coalesce(v.address_text, '') !~ '[0-9]'
    end as approximate,
    -- The coalesce is load-bearing, not decoration. Both of these are OR chains
    -- over jsonb tests, and a jsonb test on a missing key yields NULL rather
    -- than false, so false OR NULL is NULL: without it the flags come back NULL
    -- on exactly the rows that mean no, and a later NOT has_price or
    -- has_price = false would match nothing at all.
    coalesce(
      v.filters is not null
      and (
        exists (
          select 1
          from jsonb_each(v.filters) f
          where f.key like '%price%'
            and jsonb_typeof(f.value) = 'number'
        )
        or jsonb_typeof(v.filters -> 'price_quote') = 'string'
      ),
      false
    ) as has_price,
    coalesce(
      -- A verified vendor whose published listing carries its own photos
      -- (0050). First in the chain because it is a null test on a join column,
      -- the cheapest test here; mirrors the vendor-upload candidate that now
      -- leads photoCandidates in vendor-preview-card.tsx.
      (vp.vendor_id is not null)
      -- A case rather than an AND, so the length call cannot be reached for a
      -- non-array. AND happens to short-circuit here, but only a case
      -- GUARANTEES the order, and the alternative is a runtime error on a row
      -- shaped in a way this column is not supposed to hold.
      or case jsonb_typeof(v.google_photos)
        when 'array' then jsonb_array_length(v.google_photos) > 0
        else false
      end
      or (v.google_photos is null and v.google_place_id is not null)
      or exists (
        select 1
        from recon_entries re
        join recon_media rm on rm.recon_entry_id = re.id
        where re.vendor_id = v.id
          and re.status = 'active'
      ),
      false
    ) as has_photo,
    -- Set-based, and never NULL: a left-join miss is false by the is-not-null
    -- test itself, so no coalesce is needed (unlike the jsonb chains above).
    (vv.vendor_id is not null) as verified
  from vendors v
  left join verified_vendor_ids() vv on vv.vendor_id = v.id
  left join verified_listing_photo_ids() vp on vp.vendor_id = v.id
  where v.location is not null
    and st_intersects(
      v.location::geometry,
      st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
    and (p_types is null or v.vendor_type = any(p_types))
  limit max_rows;
$fn$;
