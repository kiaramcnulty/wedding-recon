-- Literal line-break ESCAPES in recon text, printed as visible junk on the card.
--
-- Enrich draft workers emit one JSON object per row, and the draft contract asks
-- for notes on one logical line. A worker that wanted a break between bullets
-- therefore wrote the two-character ESCAPE (a backslash followed by the letter n)
-- inside the JSON string instead of a real newline. Nothing downstream undid it:
-- pipeline.mjs strips only REAL newlines, the CSV had nothing to quote, and
-- debullet() in upload.mjs keys off WHITESPACE before a bullet, which an escape
-- is not. So it landed in this table verbatim, and the vendor card, which renders
-- with whitespace-pre-line, printed it mid-sentence (reported 2026-08-04):
--   ...reviews describe them as a team on shoots{escape}-she is described as...
--
-- upload.mjs now unescapes at insert, so new rows are clean. This repairs the
-- rows already written. Three columns, because all three carry entry prose:
-- notes and price_details render whitespace-pre-line, and price_text renders as
-- an ordinary paragraph where a real newline collapses to a space, which is the
-- right outcome for a one-line headline.
--
-- chr(92) is a backslash. The patterns are composed from it rather than written
-- with backslash literals so the migration cannot depend on the value of
-- standard_conforming_strings, and so nothing in this file needs escaping twice.
-- chr(92) || chr(92) is the REGEX for one literal backslash, and {1,2} then
-- allows the doubly-escaped form a worker sometimes emits.
--
-- The paired carriage-return form is collapsed FIRST so it yields one newline
-- rather than two; the bare form is handled after; tabs become a space.
--
-- Idempotent: real newlines contain no backslash, so a second run matches nothing.

update recon_entries
set
  notes = regexp_replace(
            regexp_replace(
              regexp_replace(notes, chr(92) || chr(92) || '{1,2}r' || chr(92) || chr(92) || '{1,2}n', chr(10), 'g'),
              chr(92) || chr(92) || '{1,2}[rn]', chr(10), 'g'),
            chr(92) || chr(92) || '{1,2}t', ' ', 'g'),
  price_details = regexp_replace(
            regexp_replace(
              regexp_replace(price_details, chr(92) || chr(92) || '{1,2}r' || chr(92) || chr(92) || '{1,2}n', chr(10), 'g'),
              chr(92) || chr(92) || '{1,2}[rn]', chr(10), 'g'),
            chr(92) || chr(92) || '{1,2}t', ' ', 'g'),
  price_text = regexp_replace(
            regexp_replace(
              regexp_replace(price_text, chr(92) || chr(92) || '{1,2}r' || chr(92) || chr(92) || '{1,2}n', chr(10), 'g'),
              chr(92) || chr(92) || '{1,2}[rn]', chr(10), 'g'),
            chr(92) || chr(92) || '{1,2}t', ' ', 'g')
-- Matched with the regex operator, never LIKE: backslash is LIKE default ESCAPE
-- character, so a LIKE pattern here would quietly test for a bare letter n.
where notes ~ (chr(92) || chr(92) || '{1,2}[rnt]')
   or price_details ~ (chr(92) || chr(92) || '{1,2}[rnt]')
   or price_text ~ (chr(92) || chr(92) || '{1,2}[rnt]');

-- REVIEW: this runs as part of the migration and must report 0. It is a real
-- statement rather than a commented-out one on purpose -- a commented query
-- would put quote characters inside a -- comment, which is the exact thing the
-- Supabase SQL editor lexer mis-parses.

select count(*) as rows_with_escapes_remaining
from recon_entries
where notes ~ (chr(92) || chr(92) || '{1,2}[rnt]')
   or price_details ~ (chr(92) || chr(92) || '{1,2}[rnt]')
   or price_text ~ (chr(92) || chr(92) || '{1,2}[rnt]');
