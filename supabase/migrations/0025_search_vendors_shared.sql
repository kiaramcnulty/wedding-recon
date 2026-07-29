-- One vendor-search implementation for BOTH search surfaces.
--
-- The Explore bar went through this RPC (token-AND over name + address_text +
-- city), while the Add Recon box built its own per-token `ilike` chain over
-- **name only** -- so the same query behaved differently in the two boxes and
-- every search fix had to be made twice. `/api/places` now calls this function
-- too (via lib/search/vendors.ts), which needs two changes to the shape:
--
--   1. Return `google_place_id`, so the Add Recon box can still collapse a
--      Google prediction into the vendor row we already have for that business
--      (the dedup that keeps people attaching recon to a shared record instead
--      of creating a duplicate vendor).
--   2. Stop filtering out rows with no `location`. Explore needs coordinates to
--      fly to a pin, but Add Recon doesn't -- a legacy vendor that never got
--      geocoded is still the right row to attach recon to. `lng`/`lat` are now
--      nullable and the Explore route drops coordinate-less rows itself
--      (`searchVendors(..., { requireCoords: true })`).
--
-- The token/stop-word matching rule from `0019` is unchanged, and so is the
-- signature -- keep the stop-word list in sync with lib/search/tokens.ts.
--
-- Return type changes require drop-then-create (create-or-replace cannot change
-- a function's OUT columns). Idempotent; hand-apply in the Supabase SQL editor
-- like every migration here. Until applied, the `0019` function keeps serving
-- both routes: Explore is unaffected, and Add Recon simply matches on
-- name/address/city without the place_id dedup (a duplicate Google row can show
-- up alongside an existing vendor) until it lands.

drop function if exists search_vendors(text, integer);

create function search_vendors(
  q text,
  max_rows integer default 24
)
returns table (
  id uuid,
  name text,
  vendor_type vendor_type,
  address_text text,
  city text,
  google_place_id text,
  source vendor_source,
  lng double precision,
  lat double precision
)
language sql
stable
as $$
  with parts as (
    -- Lowercase, split on whitespace, drop empties.
    select nullif(trim(tok), '') as tok
    from unnest(
      regexp_split_to_array(lower(coalesce(q, '')), '\s+')
    ) as tok
  ),
  nonempty as (
    select tok from parts where tok is not null
  ),
  meaningful as (
    -- Stop words are noise in a vendor name; keep this list in sync with
    -- lib/search/tokens.ts.
    select tok from nonempty
    where tok not in (
      'the','a','an','and','of','at','on','in','or','to','for','by','&'
    )
  ),
  chosen as (
    -- If the query was *only* stop words, fall back to the raw tokens so we
    -- still match something instead of matching everything.
    select case
             when exists (select 1 from meaningful)
               then array(select tok from meaningful)
             else array(select tok from nonempty)
           end as toks
  ),
  escaped as (
    -- Escape LIKE metacharacters per token so a stray % or _ stays literal.
    select array(
      select replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_')
      from unnest((select toks from chosen)) as t
    ) as toks
  )
  select
    v.id, v.name, v.vendor_type, v.address_text, v.city, v.google_place_id,
    v.source,
    st_x(v.location::geometry) as lng,
    st_y(v.location::geometry) as lat
  from vendors v, escaped e
  where cardinality(e.toks) > 0
    -- Every token must appear in at least one of name / address / city.
    and not exists (
      select 1
      from unnest(e.toks) as tok
      where not (
        coalesce(v.name, '')            ilike '%' || tok || '%' escape '\'
        or coalesce(v.address_text, '') ilike '%' || tok || '%' escape '\'
        or coalesce(v.city, '')         ilike '%' || tok || '%' escape '\'
      )
    )
  limit greatest(1, least(max_rows, 50));
$$;

grant execute on function search_vendors(text, integer) to anon, authenticated;
