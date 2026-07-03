# Entry synthesis rules (all mandatory)

## How many entries
- 1-3 per venue, **mostly 2**. Never 4+.
- Split by SOURCE CLUSTER, never by padding: e.g. entry 1 = website pricing page,
  entry 2 = review/Reddit commentary. A venue with only one thin source gets exactly 1 entry.
- Conflicting prices from different sources go in SEPARATE entries — that's a feature
  (more data points for users), not a bug to reconcile.
- Tiering (from roster.mjs scores): reddit-mentioned venues get the full treatment and
  should lean on the thread content; long-tail venues get 1 website-sourced entry;
  venues with no website, no reviews, and no mentions get skipped, not padded.

## price_text + price_details — REQUIRED on every entry
- `price_text`: compact headline, e.g. "$3.5k-$8k depending on season/day",
  "$11k venue for a sunday, saturdays run $12k+ more".
- `price_details`: packages, seasonal tables, minimums, deposits, per-person rates.
- Commentary-only entry? Derive a hedged variation of the venue's known pricing and
  FRAME THE HEDGE: "no formal quote - going off their published table it's $X-$Y",
  "reviews + their site put saturdays around $X". Ideally cite a different source than
  the sibling entry. NEVER invent numbers outside sourced ranges. NEVER leave blank
  (upload.mjs hard-fails).

## Dates (recon_collected_month/year)
- A real source date wins: a Reddit comment from "3mo ago" on a thread captured July 2026
  → collected 4/2026; a 2024 comment → 2024.
- Otherwise: spread across the LAST 3 MONTHS only. Vary months across entries.

## recon_type
- `online` is the default and should be ~all entries.
- `in_person` / `virtual` implies the bot visited or called — that's a fabricated event.
  Only with the user's explicit per-entry sign-off, at most one per batch, if at all.

## Truth and attribution
- Every fact traces to a named source (the `sources` column: site pages, guide domains,
  `google-reviews`, `reddit:reddit-NN.txt`).
- Borrowed experiences are attributed IN the text: "a bride on reddit said...",
  "a photographer review called it...". Never first person for things the bot didn't do.
- Include negatives and quirks when sources have them (bad lighting, slow email replies,
  funky smell, early last call). Warts make entries credible and useful.
- What users actually want captured: pricing packages (season/day-of-week/ceremony vs
  reception), capacity, what's included vs required (catering policy especially),
  how the ownership/staff operates (responsive? family-run? corporate?), vibe,
  and ANY firsthand commentary.

## Other fields
- `service_region`: always null for venues (leave the column out; upload.mjs sets null).
- `vendor_id`: from `research/<slug>/harvest.json`. Never guess.
- `bot` column: `bot1..botN` keys from the roster. A bot NEVER gets two entries for the
  same venue (validated). 3-10 entries per bot per run. Bots are PER STATE — they never
  cross states, but the same state roster is reused for future vendor types
  (florists, caterers...), so keep per-bot lifetime totals believable (check roster.mjs).
