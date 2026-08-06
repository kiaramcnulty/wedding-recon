-- Two ranking flags for the Explore list view: does this vendor have a price,
-- and will its card draw a photo.
--
-- The list orders priced-before-unpriced, then photo-before-no-photo, then
-- nearest the map center. That sort runs over every vendor in the viewport
-- BEFORE the feed pages 20 at a time, so the flags have to arrive with the pin
-- rows; they cannot come from the per-card fetch, which only ever sees the page
-- already chosen. Two booleans is about 2 bytes per row against the 208 that
-- migration 0034 measured, so this does not undo that work.
--
-- Same reasoning as the approximate flag 0034 added: the client needs a
-- boolean, so send the boolean rather than the columns it would be derived
-- from.
--
-- BACKWARD COMPATIBLE IN BOTH DIRECTIONS, so there is no deploy ordering to get
-- right. Until this is hand-applied the 0034 function keeps serving the map,
-- rows arrive without the two columns, and vendor-map.tsx treats a missing flag
-- as false for every row alike - which makes both keys no-ops and leaves the
-- list in exactly the nearest-first order it has today.

-- has_price
--   The objective pricing tag is vendors.filters, written by the extraction
--   pipeline (migration 0032). Any NUMERIC key whose name contains price counts,
--   which is what makes this generalize across vendor types without naming them:
--   most types use price_min and price_max, hair and makeup uses
--   bride_price_min, party_price_max and trial_price. A verbatim price_quote
--   with no parsed number counts too.
--   Deliberately NOT the string keys price_basis, price_kind and
--   price_confidence: those describe a price rather than being one, and a vendor
--   carrying them without a number has nothing for a couple to compare.
--   Measured on the 2,163 Colorado rows in data/filter-extraction: 818 of them,
--   or 37.8 percent, which is a real split rather than a near-empty tier.
--   Note hotels model no price at all - the type has block_type and min_rooms,
--   never a rate - so every hotel lands in the unpriced tier permanently. That
--   is honest, and inside a category-filtered view they all tie and the sort
--   falls through to photos and distance.
--
-- has_photo
--   The SQL twin of what the preview card actually does (see photoCandidates in
--   components/map/vendor-preview-card.tsx), so the flag agrees with whether a
--   card draws an image or a category placeholder:
--     - google_photos holding a non-empty array: resolved, definitely has one.
--     - google_photos null with a google_place_id: never resolved. This is the
--       common case and it is optimistic on purpose. That column is a LAZY
--       cache, filled on the first view of a vendor page and re-resolved
--       monthly, so a null means nobody has looked yet - never that the vendor
--       has no photos. Testing it strictly would rank vendors by whether
--       somebody happened to open them, which is view history, not a fact about
--       the vendor.
--     - an empty array is the one negative: resolved, and Google had nothing.
--       Such a row only counts if it has a recon photo.
--     - any active recon photo counts. This is what a user-created vendor with
--       no Google identity has, and it is the clause that keeps a hand-added
--       vendor with real photos out of the bottom tier.
--   The recon clause is an EXISTS, and it sits LAST in the OR on purpose: the
--   two cheap column tests are true for almost every seeded vendor, and an OR
--   stops at the first true, so the semi-join is skipped on the common path.

-- Return shape changes, so this cannot go through create or replace.
drop function if exists vendors_in_bbox(
  double precision, double precision, double precision, double precision,
  vendor_type[], integer
);

create function vendors_in_bbox(
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
  has_photo boolean
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
      -- A case rather than an AND, so the length call cannot be reached for a
      -- non-array. AND happens to short-circuit here, but only a case
      -- GUARANTEES the order, and the alternative is a runtime error on a row
      -- shaped in a way this column is not supposed to hold.
      case jsonb_typeof(v.google_photos)
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
    ) as has_photo
  from vendors v
  where v.location is not null
    and st_intersects(
      v.location::geometry,
      st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
    and (p_types is null or v.vendor_type = any(p_types))
  limit max_rows;
$fn$;

grant execute on function vendors_in_bbox(
  double precision, double precision, double precision, double precision,
  vendor_type[], integer
) to anon, authenticated;
