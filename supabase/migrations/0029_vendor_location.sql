-- 0029_vendor_location.sql
-- Flatten ONE vendor location to lng/lat, for the map preview on the vendor page.
--
-- Why a function at all: vendors.location is geography(Point, 4326), and
-- PostgREST serializes that column as hex EWKB. A plain select("*") therefore
-- hands the page an opaque blob rather than coordinates. Every other surface
-- that needs a pin already goes through an RPC that flattens the point with
-- st_x/st_y -- vendors_in_bbox for the map, search_vendors for the two search
-- bars -- so a by-id lookup is the missing third member of that family rather
-- than a new pattern.
--
-- Scoped deliberately narrow: it returns coordinates only, not a vendor row.
-- The page already has the row from its own select, and keeping the return
-- shape to two numbers means this never has to change when columns are added.
--
-- SECURITY INVOKER (the default), so the public-read RLS policy on vendors
-- applies exactly as it does to a direct select. Shared vendor deeplinks must
-- render without an account, hence the grant to anon.
--
-- Returns zero rows for an unknown id or a vendor with no location; the caller
-- treats that as "no map preview" and renders the rest of the page unchanged.
--
-- NOTE: no apostrophes and no dollar-quote token in the comments of this file --
-- the Supabase SQL editor mis-lexes them and splits the function body. See the
-- Migrations section of CLAUDE.md.
--
-- Idempotent (plain create-or-replace); hand-apply in the Supabase SQL editor.
-- Until applied, the vendor page simply shows no map preview.

create or replace function vendor_location(p_id uuid)
returns table (
  lng double precision,
  lat double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    st_x(v.location::geometry) as lng,
    st_y(v.location::geometry) as lat
  from vendors v
  where v.id = p_id
    and v.location is not null;
$$;

grant execute on function vendor_location(uuid) to anon, authenticated;
