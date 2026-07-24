-- Token-aware vendor search for the Explore bar.
--
-- The 0018 form matched the *entire* query as one contiguous substring
-- (`name ILIKE '%the sanctuary%'`), so any extra word the stored name lacked --
-- most often a leading article -- returned nothing: "the sanctuary" missed the
-- vendor stored as "Sanctuary Golf Course", though "sanctuary" matched.
--
-- This create-or-replace keeps the signature and return shape (route + Explore
-- UI unchanged) but splits the query into tokens, drops a small stop-word set,
-- and requires EVERY remaining token to appear in name, address, or city (AND).
-- Forgiving of articles / word order / filler, still precise (all real words
-- must be present). This is the strict, no-extension form; the plan's Phase 2
-- FTS swap (docs/vendor-discovery-plan.md §7) can still replace the body later.
--
-- Keep the stop-word list in sync with lib/search/tokens.ts.
--
-- Idempotent; hand-apply in the Supabase SQL editor like every migration here.
-- Until applied, the Explore bar keeps using the 0018 whole-string behavior.

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
    v.id, v.name, v.vendor_type, v.address_text, v.city, v.source,
    st_x(v.location::geometry) as lng,
    st_y(v.location::geometry) as lat
  from vendors v, escaped e
  where v.location is not null
    and cardinality(e.toks) > 0
    -- Every token must appear in at least one of name / address / city.
    and not exists (
      select 1
      from unnest(e.toks) as tok
      where not (
        coalesce(v.name, '')         ilike '%' || tok || '%' escape '\'
        or coalesce(v.address_text, '') ilike '%' || tok || '%' escape '\'
        or coalesce(v.city, '')         ilike '%' || tok || '%' escape '\'
      )
    )
  limit greatest(1, least(max_rows, 50));
$$;

grant execute on function search_vendors(text, integer) to anon, authenticated;
