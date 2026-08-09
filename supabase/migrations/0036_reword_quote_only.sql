-- "Quote only" on bot recon entries: wrong when a number exists, confusing when
-- it does not. Reported by Kiara 2026-08-07.
--
-- The drafting contract made the literal string "Quote only" the price_text
-- sentinel for a vendor that publishes nothing. Two problems came out of it.
--
-- 1. It is asserted even when we DO have a number. "Quote only but the knot
--    says $8k" is self-contradicting: quote-only means the only way to get a
--    figure is to ask, and a figure is right there in the same sentence. If we
--    have a number we have a price data point, so the number leads.
-- 2. It reads as jargon. A couple does not parse "Quote only" as "nobody would
--    tell us a price"; they parse it as a category label. The replacement says
--    the plain thing, and varies across entries so a page of recon does not
--    read as one template.
--
-- The scope is deliberately the QUOTE-ONLY family and nothing wider. Phrases
-- like "No published pricing" or "Contact for pricing" are left alone: they are
-- already plain English, and they stay true next to a third-party number,
-- because they describe what the VENDOR published rather than claiming no price
-- exists anywhere. Leaving them also keeps some natural variety in the corpus.
--
-- Bot entries only, gated on profiles.is_bot. A real person who typed "quote
-- only" wrote their own words and this migration must never edit them.
--
-- What each row gets:
--
--   Rule A -- the field already carries a money figure. The quote-only clause
--     is the false part, so it is cut and the number leads.
--       "Quote only but The Knot says $8k"  ->  "The Knot says $8k"
--       "$4k-$6k range, quote only"         ->  "$4k-$6k range"
--     The money test is a deliberate twin of hasPriceQuote() in lib/recon-sort.ts
--     (a currency symbol adjacent to a digit, or a digit next to dollars/usd) so
--     that "we have a number here" means the same thing to this migration as it
--     does to the comparator that sorts priced entries above unpriced ones.
--     Keep the two in lockstep.
--
--   Rule B -- no money figure in the field. The quote-only phrase is swapped for
--     one of three plain wordings, picked per entry id so the choice is stable
--     and an entry never re-randomizes on a re-run.
--       "Quote only"                             ->  "No quote found"
--       "Quote only - nothing on their site"     ->  "No quote provided - nothing on their site"
--       "Packages listed, quote only"            ->  "Packages listed, no quote found"
--     Note this stays honest for the case where the headline has no number but
--     price_details does: "we did not get a quote" is a claim about what we
--     obtained, not a claim that no price information exists. That is exactly
--     the claim "quote only" got wrong.
--
-- Mid-prose occurrences are LEFT ALONE on purpose. A phrase swap inside a
-- sentence produces garbage ("they are no quote found so you email them"), and
-- the qualifier prefix below can legitimately appear in running text ("we asked
-- for a price quote only after the tour"). So a non-leading match is rewritten
-- only when it ends the field and is fenced off by its own punctuation. The
-- REVIEW query at the bottom lists whatever is left, in every prose column
-- including notes, as a hand-fix worklist.
--
-- Idempotent: none of the replacement wordings match the quote-only pattern, so
-- a second run touches only the mid-prose rows it deliberately skipped, which
-- is to say nothing.
--
-- No backslashes anywhere in the patterns -- dollar signs and separators are
-- written as bracket expressions -- so nothing here depends on the value of
-- standard_conforming_strings. Strings that contain an apostrophe are
-- dollar-quoted. Comments are apostrophe-free, per the Supabase SQL editor
-- lexer hazard in CLAUDE.md.

with rx as (
  select
    -- The quote-only family. Branch 1 is the phrase with any stack of leading
    -- qualifiers ("pricing by quote only", "custom quote only"); branch 2 is the
    -- inverted form ("only available by quote").
    '(((pricing|price|prices|rates?|available|custom|by|on|via|per)[[:space:]]+)*quotes?[[:space:]-]+only'
      || '|only[[:space:]]+(available[[:space:]]+)?(by|upon|on|via)[[:space:]]+quotes?)'         as qo,
    -- Twin of MONEY in lib/recon-sort.ts. A bare number is deliberately not a
    -- price: recon prose is full of guest counts, hours and years.
    '[$][[:space:]]*[0-9]|[0-9][[:space:]]*[$]|[0-9][[:space:]]*(dollars|usd)([^[:alpha:]]|$)'   as money,
    -- Clause separators. Excludes the dollar sign, or a greedy run would eat the
    -- currency symbol off the front of the number we are trying to promote.
    '[[:space:],;:.!/-]*'                                                                        as sep,
    -- Fenced separator: the punctuation that marks a trailing quote-only clause
    -- as its own clause rather than part of the sentence before it.
    '[,;:-][[:space:]]*'                                                                         as fence,
    '(but|though|however|although)'                                                              as conj
),

-- Every bot entry, with its wording drawn from the entry id. get_byte on the md5
-- digest is always non-negative, so the pick needs no abs(). Extend the array to
-- add wordings; the modulus follows cardinality.
bot as (
  select
    e.id,
    e.price_text,
    e.price_details,
    (array[
      $v$No quote provided$v$,
      $v$No quote found$v$,
      $v$Didn't get a quote$v$
    ])[1 + get_byte(decode(md5(e.id::text), 'hex'), 0) % 3] as variant
  from recon_entries e
  join profiles p on p.id = e.author_id
  where p.is_bot
),

-- Unpivot so the rewrite is written once and applied to both prose price
-- columns, then repivoted below.
flat as (
  select id, variant, 'price_text'    as col, price_text    as old from bot
  union all
  select id, variant, 'price_details' as col, price_details as old from bot
),

calc as (
  select
    f.id,
    f.col,
    f.old,
    case
      when f.old is null or f.old !~* rx.qo then f.old

      -- Rule A: cut the quote-only clause, let the number lead. Applied only
      -- when the cut actually removed something and the money figure survived
      -- it; otherwise fall through to the wording swap.
      when f.old ~* rx.money and s.stripped <> f.old and s.stripped <> '' and s.stripped ~* rx.money
        then upper(left(s.stripped, 1)) || substr(s.stripped, 2)

      -- Rule B, leading: the sentinel opens the field, so the wording replaces
      -- it and whatever followed is kept.
      when f.old ~* ('^' || rx.sep || rx.qo)
        then regexp_replace(f.old, '^' || rx.sep || rx.qo, f.variant, 'i')

      -- Rule B, trailing clause: fenced by its own punctuation and ends the
      -- field, so swapping it cannot break a sentence. Lowercased, since it is
      -- landing mid-sentence.
      when f.old ~* (rx.fence || rx.qo || '[[:space:].!]*$')
        then regexp_replace(f.old, '[[:space:]]*' || rx.qo || '[[:space:].!]*$', ' ' || lower(f.variant), 'i')

      -- Mid-prose. Left verbatim; the REVIEW query below lists it.
      else f.old
    end as new
  from flat f
  cross join rx
  cross join lateral (
    select btrim(
      regexp_replace(
        regexp_replace(f.old, '^' || rx.sep || rx.qo || rx.sep || '(' || rx.conj || rx.sep || ')?', '', 'i'),
        rx.fence || rx.qo || '[[:space:].!]*$', '', 'i')
    ) as stripped
  ) s
),

fixed as (
  select
    id,
    max(new) filter (where col = 'price_text')    as new_price_text,
    max(new) filter (where col = 'price_details') as new_price_details
  from calc
  group by id
)

update recon_entries e
set price_text    = f.new_price_text,
    price_details = f.new_price_details
from fixed f
where f.id = e.id
  and (e.price_text    is distinct from f.new_price_text
    or e.price_details is distinct from f.new_price_details);

-- REVIEW: every bot entry still carrying the phrase after the pass. Unlike
-- migration 0031 this is a WORKLIST, not an assertion of zero -- mid-sentence
-- occurrences are skipped by design because rewriting them mechanically would
-- produce ungrammatical prose. notes is included here even though the update
-- above does not touch it, for the same reason: it is prose end to end.
-- Expect a short list, and hand-fix it in the style of
-- scripts/fix-comma-split-recon.sql.

select
  e.id,
  v.name as vendor,
  case
    when e.price_text    ~* '(((pricing|price|prices|rates?|available|custom|by|on|via|per)[[:space:]]+)*quotes?[[:space:]-]+only|only[[:space:]]+(available[[:space:]]+)?(by|upon|on|via)[[:space:]]+quotes?)' then 'price_text'
    when e.price_details ~* '(((pricing|price|prices|rates?|available|custom|by|on|via|per)[[:space:]]+)*quotes?[[:space:]-]+only|only[[:space:]]+(available[[:space:]]+)?(by|upon|on|via)[[:space:]]+quotes?)' then 'price_details'
    else 'notes'
  end as still_in,
  e.price_text,
  e.price_details,
  e.notes
from recon_entries e
join profiles p on p.id = e.author_id
join vendors  v on v.id = e.vendor_id
where p.is_bot
  and (e.price_text    ~* '(((pricing|price|prices|rates?|available|custom|by|on|via|per)[[:space:]]+)*quotes?[[:space:]-]+only|only[[:space:]]+(available[[:space:]]+)?(by|upon|on|via)[[:space:]]+quotes?)'
    or e.price_details ~* '(((pricing|price|prices|rates?|available|custom|by|on|via|per)[[:space:]]+)*quotes?[[:space:]-]+only|only[[:space:]]+(available[[:space:]]+)?(by|upon|on|via)[[:space:]]+quotes?)'
    or e.notes         ~* '(((pricing|price|prices|rates?|available|custom|by|on|via|per)[[:space:]]+)*quotes?[[:space:]-]+only|only[[:space:]]+(available[[:space:]]+)?(by|upon|on|via)[[:space:]]+quotes?)')
order by v.name;
