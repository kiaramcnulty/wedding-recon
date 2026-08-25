-- 0045_vendors_in_bbox_verified.sql
-- Vendor Verification, part 4 of 4: the verified flag on the map payload, and
-- the read-time filter merge.
--
-- vendors_in_bbox gains one server-computed boolean, verified, which the
-- Explore list order sorts on immediately after rank (within-partition only -
-- see List view order in CLAUDE.md). Computed with a SET-BASED left join
-- against verified_vendor_ids() (0044), never a per-row scalar call - this is
-- the busiest query in the app, and the definer function does not inline, so
-- it must run once per query, not once per row. The verified set holds only
-- claimed-and-paying vendors, so the join side is tiny.
--
-- A left-join null test is never NULL, so verified needs no coalesce - but the
-- client still guards with === true, so a deploy before this migration is
-- applied reads every row as unverified and the new sort key is a no-op (the
-- 0034/0035 backward-compatibility discipline; no deploy ordering to get
-- right).
--
-- vendor_filters_in_bbox now merges a verified vendors published
-- filter_overrides over its extracted filters (override keys win, extracted
-- keys survive where not overridden). The merge is READ-TIME ONLY -
-- vendors.filters is never mutated, so flipping perks off reverts to the
-- original data with no restore step. The WHERE widens to include a verified
-- vendor whose extracted filters are null but who has overrides - without
-- that, a vendor the extraction pipeline never reached could pay, fill in
-- their filters, and still be invisible to the filter sheet.
--
-- Return shape of vendors_in_bbox changes, so it is drop + create; the filters
-- function keeps its shape and goes through create or replace.
--
-- NOTE: no apostrophes and no dollar-quote token in the comments of this file -
-- the Supabase SQL editor mis-lexes them and splits statements. See the
-- Migrations section of CLAUDE.md.
--
-- Not auto-applied to the hosted DB - hand-apply in the Supabase SQL editor,
-- AFTER 0042-0044 (the functions referenced here are created in 0044).

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
    ) as has_photo,
    -- Set-based, and never NULL: a left-join miss is false by the is-not-null
    -- test itself, so no coalesce is needed (unlike the jsonb chains above).
    (vv.vendor_id is not null) as verified
  from vendors v
  left join verified_vendor_ids() vv on vv.vendor_id = v.id
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

-- Same bbox predicate and max_rows as the function above so the two line up
-- row for row. Still not filtered server-side, for the reasons 0033 sets out.
create or replace function vendor_filters_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  p_types vendor_type[] default null,
  max_rows integer default 500
)
returns table (
  id uuid,
  filters jsonb
)
language sql
stable
as $fn$
  select
    v.id,
    -- Strip the verbatim evidence quotes, exactly as 0033 did, then merge a
    -- verified vendors published overrides on top (jsonb concat: override keys
    -- win, extracted keys survive where not overridden). The unverified branch
    -- is byte-for-byte what 0034 returned.
    case
      when vo.vendor_id is null
        then (v.filters - 'price_quote' - 'capacity_quote' - 'block_type_basis')
      else
        coalesce(
          v.filters - 'price_quote' - 'capacity_quote' - 'block_type_basis',
          '{}'::jsonb
        ) || coalesce(vo.filter_overrides, '{}'::jsonb)
    end as filters
  from vendors v
  left join verified_listing_overrides() vo on vo.vendor_id = v.id
  where v.location is not null
    and (v.filters is not null or vo.vendor_id is not null)
    and st_intersects(
      v.location::geometry,
      st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
    and (p_types is null or v.vendor_type = any(p_types))
  limit max_rows;
$fn$;

grant execute on function vendor_filters_in_bbox(
  double precision, double precision, double precision, double precision,
  vendor_type[], integer
) to anon, authenticated;
