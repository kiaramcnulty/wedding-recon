-- Carry filter attributes to the Explore map.
--
-- This adds ONE column to the existing viewport query and changes nothing else.
-- In particular it deliberately does NOT filter server-side, which an earlier
-- draft of this migration did. Three reasons, all of them about how the map
-- already works:
--
--   1. The client passes max_rows 5000 and Colorado holds about 2200 vendors,
--      so a fetch already returns everything in the box. There is no truncated
--      sample for a client-side filter to get wrong.
--   2. Vendor-type filtering is ALREADY client-side (the caller passes no
--      p_types and toggles MapLibre layer visibility), so local filtering is
--      the established pattern here, not a workaround.
--   3. vendor-map.tsx caches a fetched area in coverageRef and skips refetching
--      while panning inside it. Server-side filtering would make those cached
--      rows filter-specific, so changing a filter would leave stale pins on
--      screen with no refetch. That is a real bug, not a theoretical one.
--
-- Above all, a vendor missing the filtered attribute stays visible as a dimmed
-- second tier rather than disappearing, so an active filter barely shrinks the
-- row set. Server-side filtering would buy almost no payload back while costing
-- a network round trip per chip tap.
--
-- If the corpus ever outgrows max_rows in a single viewport, revisit this: the
-- rule set is specified and tested in lib/filters/match.ts, so a SQL twin can
-- be written from it.

-- Return shape gains a column, so this cannot go through create or replace.
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
  google_place_id text,
  address_text text,
  city text,
  region text,
  lng double precision,
  lat double precision,
  source vendor_source,
  created_by uuid,
  created_at timestamptz,
  filters jsonb
)
language sql
stable
as $fn$
  select
    v.id, v.name, v.vendor_type, v.google_place_id, v.address_text, v.city, v.region,
    st_x(v.location::geometry) as lng,
    st_y(v.location::geometry) as lat,
    v.source, v.created_by, v.created_at,
    -- Strip the verbatim evidence quotes. They exist so every extracted number
    -- is auditable and they render on the vendor card, which loads per-vendor
    -- anyway; the matcher never reads them. Across the corpus they are about a
    -- quarter of the column, which is bandwidth on a fetch that repeats as the
    -- couple pans the map.
    (v.filters - 'price_quote' - 'capacity_quote' - 'block_type_basis') as filters
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
