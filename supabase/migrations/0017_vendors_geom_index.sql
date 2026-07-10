-- vendors_in_bbox (0003) filters on st_intersects(location::geometry, …).
-- The existing GiST index (0001, vendors_location_gix) is on the geography
-- column and cannot serve that cast, so bbox queries sequential-scan the
-- table. This expression index matches the RPC's predicate as written.
create index if not exists vendors_location_geom_gix
  on vendors using gist ((location::geometry));
