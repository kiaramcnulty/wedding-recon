-- Light typo tolerance for vendor search ("sanctaury" still finds "Sanctuary
-- Golf Course"), for both search bars at once since `0025` made them share this
-- RPC.
--
-- Deliberately a SECOND TIER, not a loosening of the first. The strict
-- token-AND match from `0019` runs unchanged and, whenever it finds anything,
-- is the entire answer -- so no query that works today changes its results, and
-- typo tolerance cannot push a real match down the list. The fuzzy tier fires
-- only when strict matching finds NOTHING, i.e. exactly the case where the user
-- currently sees an empty dropdown and has no recourse.
--
-- Shape:
--   * trigram similarity (pg_trgm `word_similarity`), NAME only -- addresses and
--     city names are noisy and a misspelled street name is a rare query.
--   * EVERY token must clear the threshold, mirroring the AND semantics of the
--     strict tier. That is what keeps precision: "mountain view lodge" does not
--     match "Spruce Mountain Ranch" just because one token is close.
--   * tokens under 4 characters must still match literally -- trigram scores on
--     2-3 character tokens are noise ("dj", "co", "the").
--   * threshold 0.35, measured against realistic typos: transpositions
--     ("sanctaury" 0.50, "sprcue" 0.43), dropped letters ("spuce" 0.44,
--     "stanly", "footrs"), and insertions ("saige" -> "Sage") all clear it,
--     while unrelated-but-plausible queries ("sweet pea events", "vista ridge
--     barn", "hair by jess", "copper room") return nothing rather than a wrong
--     guess. Noise grows with directory size, so fuzzy rows are also capped at
--     FUZZY_MAX and ordered best-first.
--   * ordered by the similarity of the WEAKEST token (the binding constraint), so
--     closest overall name comes first. `lib/search/vendors.ts` scores fuzzy
--     rows below every literal match and relies on a stable sort to preserve
--     this order.
--
-- NOTE: no apostrophes anywhere in the comments of this file -- keep it that way.
-- The Supabase SQL editor tracks string literals without skipping `--` comments,
-- so an apostrophe in a comment opens a phantom string. An odd number of them
-- desyncs its lexer, it stops recognizing the dollar-quoted body boundary, and
-- it splits the body at the semicolon inside it -- which the server then rejects
-- with `42601: syntax error at or near "limit"`. `0025` survived on even parity;
-- this file failed a hand-apply on 2026-07-29 with seven.
--
-- Return shape and signature are unchanged from `0025`, so this is a plain
-- create-or-replace (no drop) and no application code has to change for it.
-- Idempotent; hand-apply in the Supabase SQL editor like every migration here.
-- Until applied, search behaves exactly as it does today -- strict only.

-- Supabase usually ships pg_trgm in the `extensions` schema, where this is a
-- no-op; on a bare Postgres it lands in the search path. The function below sets
-- `search_path = public, extensions` so `word_similarity` resolves either way.
create extension if not exists pg_trgm;

-- Trigram index so the fuzzy tier stays cheap as the directory grows. Also
-- speeds up the leading-wildcard `ilike` of the strict tier on name.
create index if not exists vendors_name_trgm_idx
  on vendors using gin (name gin_trgm_ops);

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
  google_place_id text,
  source vendor_source,
  lng double precision,
  lat double precision
)
language sql
stable
set search_path = public, extensions
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
  ),
  -- ── Tier 1: strict token-AND over name / address / city (unchanged) ────────
  strict_hits as (
    select
      v.id, v.name, v.vendor_type, v.address_text, v.city, v.google_place_id,
      v.source,
      st_x(v.location::geometry) as lng,
      st_y(v.location::geometry) as lat,
      1 as tier,
      1::real as sim
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
    limit greatest(1, least(max_rows, 50))
  ),
  -- ── Tier 2: trigram near-miss on name, only when tier 1 came up empty ─────
  fuzzy_hits as (
    select
      v.id, v.name, v.vendor_type, v.address_text, v.city, v.google_place_id,
      v.source,
      st_x(v.location::geometry) as lng,
      st_y(v.location::geometry) as lat,
      2 as tier,
      -- Weakest token similarity = how good the *whole* name match is.
      (
        select min(
          case
            when length(tok) >= 4 then word_similarity(tok, coalesce(v.name, ''))
            else 1
          end
        )
        from unnest(c.toks) as tok
      )::real as sim
    -- Raw (unescaped) tokens here: LIKE escaping would corrupt the trigrams, so
    -- the short-token branch below escapes inline instead.
    from vendors v, chosen c
    where cardinality(c.toks) > 0
      and not exists (select 1 from strict_hits)
      -- Every token must clear the bar (short ones literally).
      and not exists (
        select 1
        from unnest(c.toks) as tok
        where not (
          case
            when length(tok) >= 4 then word_similarity(tok, coalesce(v.name, '')) >= 0.35
            else coalesce(v.name, '') ilike
                 '%' || replace(replace(replace(tok, '\', '\\'), '%', '\%'), '_', '\_') || '%'
                 escape '\'
          end
        )
      )
    order by sim desc
    -- A near-miss list is a "did you mean", not a browse surface.
    limit 5
  ),
  combined as (
    select * from strict_hits
    union all
    select * from fuzzy_hits
  )
  -- Order explicitly rather than trusting UNION ALL to preserve CTE order:
  -- strict rows first, then near-misses best-first. `sim` and `tier` are ordering
  -- columns only -- the return shape stays the nine columns above.
  select
    id, name, vendor_type, address_text, city, google_place_id, source, lng, lat
  from combined
  order by tier, sim desc, name
  limit greatest(1, least(max_rows, 50));
$$;

grant execute on function search_vendors(text, integer) to anon, authenticated;
