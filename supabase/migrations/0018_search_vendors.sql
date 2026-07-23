-- Name/address vendor search for the Explore search bar. Returns vendors whose
-- name, street address, or city matches the query, with lng/lat flattened out of
-- the PostGIS geography (same st_x/st_y trick as vendors_in_bbox) so the client
-- can fly the map straight to the pin.
--
-- This is the early, ilike-based form of the plan's search_vendors RPC
-- (docs/vendor-discovery-plan.md §7 Phase A, "Shipped early"); Phase 2 swaps the
-- body for a full-text-search variant via create-or-replace, keeping the shape.

create or replace function search_vendors(
  q text,
  max_rows integer default 24
)
returns table (
  id uuid,
  name text,
  vendor_type vendor_type,
  address_text text,
  city text,
  source vendor_source,
  lng double precision,
  lat double precision
)
language sql
stable
as $$
  with needle as (
    -- Escape LIKE metacharacters so a stray % or _ in the query stays literal.
    select '%' ||
      replace(replace(replace(coalesce(q, ''), '\', '\\'), '%', '\%'), '_', '\_')
      || '%' as pat
  )
  select
    v.id, v.name, v.vendor_type, v.address_text, v.city, v.source,
    st_x(v.location::geometry) as lng,
    st_y(v.location::geometry) as lat
  from vendors v, needle n
  where v.location is not null
    and (
      v.name ilike n.pat escape '\'
      or v.address_text ilike n.pat escape '\'
      or v.city ilike n.pat escape '\'
    )
  limit greatest(1, least(max_rows, 50));
$$;

grant execute on function search_vendors(text, integer) to anon, authenticated;
