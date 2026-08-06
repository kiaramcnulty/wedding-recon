-- Slim the Explore map payload down to what actually draws a pin.
--
-- Measured against the real corpus (2,163 Colorado rows, data/filter-extraction):
-- the previous return shape was about 625 bytes per row, or 1.29 MB for a
-- single zoomed-out fetch. Two thirds of that is never read by the map:
--
--   filters       ~257 B/row. Only the filter sheet and the dimming rank use
--                 it, and most sessions never open the sheet at all. It moves
--                 to its own function below, fetched on demand.
--   google_place_id, address_text, source
--                 ~90 B/row, read ONLY to decide whether a pin gets the dashed
--                 approximate outline. That is a boolean, so send the boolean.
--   city, region, created_by, created_at
--                 ~70 B/row, read by nothing on the map. The preview card
--                 fetches its own vendor rows for the locality subtitle.
--
-- What is left is id, name (pin labels from zoom 12), vendor_type, lng, lat and
-- the approximate flag, which is about 208 B/row or 0.43 MB for the same fetch.
--
-- BACKWARD COMPATIBLE BY CONSTRUCTION. Until this is hand-applied the 0033
-- function keeps serving the map: rows arrive with filters inline and without
-- an approximate column, and vendor-map.tsx handles both shapes (it treats a
-- present filters key as already-loaded, and falls back to the client-side
-- isApproximateLocation heuristic when the column is absent). So applying this
-- is a pure win with no coordinated deploy.

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
  approximate boolean
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
    end as approximate
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

-- The filter attributes for the same box, fetched only once a couple actually
-- opens the filter sheet. Same bbox predicate and same max_rows as the function
-- above so the two line up row for row.
--
-- Still not filtered server-side, for the reasons migration 0033 sets out: the
-- map caches a fetched area and skips refetching while panning inside it, so a
-- filter-specific row set would leave stale pins on screen. This function only
-- moves WHEN the attributes are sent, never WHERE they are matched.
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
    -- Strip the verbatim evidence quotes, exactly as 0033 did. They exist so an
    -- extracted number is auditable and they render on the vendor card, which
    -- loads per-vendor anyway; the matcher never reads them.
    (v.filters - 'price_quote' - 'capacity_quote' - 'block_type_basis') as filters
  from vendors v
  where v.location is not null
    and v.filters is not null
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
