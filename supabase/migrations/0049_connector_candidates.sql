-- 0049_connector_candidates.sql
-- Read-only, bounded public projection for the Muse connector. The caller is
-- still the anon role and RLS remains in force for vendors/recon. Protected
-- listing drafts and subscription rows are crossed only by the narrow verified
-- function below, which returns published perks for currently verified vendors.

create or replace function public.verified_listing_search_public(p_ids uuid[] default null)
returns table (
  vendor_id uuid,
  filter_overrides jsonb,
  website text,
  instagram text
)
language sql
stable
security definer
set search_path = public
as $fn$
  select l.vendor_id, l.filter_overrides, l.website, l.instagram
  from vendor_listings l
  join verified_vendor_ids(p_ids) vv on vv.vendor_id = l.vendor_id;
$fn$;

grant execute on function public.verified_listing_search_public(uuid[])
  to anon, authenticated;

create or replace function public.connector_vendor_candidates(
  p_vendor_type vendor_type default null,
  p_after_id uuid default null,
  p_ids uuid[] default null,
  p_limit integer default 500
)
returns table (
  id uuid,
  name text,
  vendor_type vendor_type,
  address_text text,
  city text,
  region text,
  website text,
  instagram text,
  source vendor_source,
  google_place_id text,
  created_at timestamptz,
  lng double precision,
  lat double precision,
  approximate boolean,
  base_filters jsonb,
  filters_meta jsonb,
  filters_updated_at timestamptz,
  filters_dirty_at timestamptz,
  filter_overrides jsonb,
  verified boolean,
  has_price boolean,
  has_photo boolean
)
language sql
stable
security invoker
set search_path = public
as $fn$
  select
    v.id,
    v.name,
    v.vendor_type,
    v.address_text,
    v.city,
    v.region,
    coalesce(nullif(vp.website, ''), v.website) as website,
    coalesce(nullif(vp.instagram, ''), v.instagram) as instagram,
    v.source,
    v.google_place_id,
    v.created_at,
    st_x(v.location::geometry) as lng,
    st_y(v.location::geometry) as lat,
    case
      when v.source = 'google' or v.google_place_id is not null then false
      else coalesce(v.address_text, '') !~ '[0-9]'
    end as approximate,
    v.filters - 'price_quote' - 'capacity_quote' - 'block_type_basis' as base_filters,
    v.filters_meta,
    v.filters_updated_at,
    v.filters_dirty_at,
    coalesce(vp.filter_overrides, '{}'::jsonb) as filter_overrides,
    (vp.vendor_id is not null) as verified,
    coalesce(
      v.filters is not null and exists (
        select 1 from jsonb_each(v.filters) f
        where f.key like '%price%'
          and jsonb_typeof(f.value) = 'number'
      ),
      false
    ) as has_price,
    coalesce(
      case jsonb_typeof(v.google_photos)
        when 'array' then jsonb_array_length(v.google_photos) > 0
        else false
      end
      or (v.google_photos is null and v.google_place_id is not null)
      or exists (
        select 1
        from recon_entries re
        join recon_media rm on rm.recon_entry_id = re.id
        where re.vendor_id = v.id and re.status = 'active'
      ),
      false
    ) as has_photo
  from vendors v
  left join verified_listing_search_public(p_ids) vp on vp.vendor_id = v.id
  where (p_vendor_type is not null or p_ids is not null)
    and (p_vendor_type is null or v.vendor_type = p_vendor_type)
    and (p_ids is null or v.id = any(p_ids))
    and (p_after_id is null or v.id > p_after_id)
  order by v.id
  limit least(greatest(p_limit, 1), 1000);
$fn$;

grant execute on function public.connector_vendor_candidates(
  vendor_type, uuid, uuid[], integer
) to anon, authenticated;
