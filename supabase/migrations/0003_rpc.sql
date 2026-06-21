-- Viewport query for the Explore map: returns vendors whose location falls
-- within the given bounding box, optionally filtered by type. Longitude/latitude
-- are flattened out of the PostGIS geography for easy client consumption.

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
  google_place_id text,
  address_text text,
  city text,
  region text,
  lng double precision,
  lat double precision,
  source vendor_source,
  created_by uuid,
  created_at timestamptz
)
language sql
stable
as $$
  select
    v.id, v.name, v.vendor_type, v.google_place_id, v.address_text, v.city, v.region,
    st_x(v.location::geometry) as lng,
    st_y(v.location::geometry) as lat,
    v.source, v.created_by, v.created_at
  from vendors v
  where v.location is not null
    and st_intersects(
      v.location::geometry,
      st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    )
    and (p_types is null or v.vendor_type = any(p_types))
  limit max_rows;
$$;

grant execute on function vendors_in_bbox(
  double precision, double precision, double precision, double precision, vendor_type[], integer
) to anon, authenticated;
