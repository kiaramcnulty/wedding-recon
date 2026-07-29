-- Fix a class of false positive in the typo tier from `0026`: searching
-- "sanctaury" returned "The Farmhouse Luxury Salon" alongside the three real
-- Sanctuary vendors.
--
-- Cause: `word_similarity(token, name)` scores the token against ANY continuous
-- extent of the trigrams of name -- and an extent may start and end in the
-- MIDDLE of a word. For "sanctaury" it found an extent spanning "...ury Sal..."
-- of "Luxury Salon" and scored 0.400, over the 0.35 bar, while the genuine
-- matches scored 0.500. So the bar cannot be raised to separate them: the junk
-- match is not a weaker version of a real match, it is a different kind of match.
--
-- Fix: `strict_word_similarity`, which forces extent boundaries onto WORD
-- boundaries. Same trigram math, but a token can now only be compared against
-- whole words (or runs of whole words) of the name, which is what "did you spell
-- a word wrong" actually means. On the same pair the junk match drops to 0.211
-- while the real ones sit at 0.429, so 0.35 separates them with room to spare.
--
-- Measured on a 38-name corpus (threshold held at 0.35):
--   kept: sanctaury -> Sanctuary Golf Course / SANCTUARY Floral / Sanctuary Ridge
--         (0.429), spuce -> Spruce (0.444), stanly -> Stanley (0.500),
--         footrs -> Footers (0.500), botanik -> Botanic (0.600),
--         wedgwood -> Wedgewood (0.583), bloome -> Bloom (0.625),
--         montain -> Mountain (0.545), saige -> Sage (0.375)
--   dropped, correctly: sanctaury -> The Farmhouse Luxury Salon (0.211),
--         saige -> Salon Luxe / Bella Salon (0.200), spuce -> Bella Salon (0.250)
--   dropped, a real loss: sprcue -> Spruce (0.273). A transposition in the middle
--         of a short word destroys three of its six trigrams, so it falls under
--         any threshold that also excludes the junk above. Single dropped or
--         transposed letters elsewhere ("spuce", "sanctaury") still resolve.
--         Levenshtein over the words of the name (fuzzystrmatch) is the tool that
--         would catch it; deliberately not adopted yet -- it cannot use an index,
--         and this tier only runs when strict matching found nothing.
--
-- Everything else about the tier is unchanged: still name-only, still every
-- token must clear the bar, still tokens under 4 characters must match
-- literally, still ordered by the weakest token and capped at 5.
--
-- NOTE: no apostrophes and no dollar-quote token in the comments of this file --
-- the Supabase SQL editor mis-lexes them and splits the function body. See the
-- Migrations section of CLAUDE.md.
--
-- Return shape and signature unchanged, so this is a plain create-or-replace and
-- no application code changes with it. Idempotent; hand-apply in the Supabase SQL
-- editor. Until applied, `0026` behaviour stands (typo tolerance works, with the
-- occasional mid-word false positive).

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
  -- Tier 1: strict token-AND over name / address / city (unchanged).
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
  -- Tier 2: word-boundary trigram near-miss on name, only when tier 1 was empty.
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
            when length(tok) >= 4
              then strict_word_similarity(tok, coalesce(v.name, ''))
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
            when length(tok) >= 4
              then strict_word_similarity(tok, coalesce(v.name, '')) >= 0.35
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
