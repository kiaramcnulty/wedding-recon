# Entry synthesis rules (all mandatory)

## Not a venue? Flag it (do NOT draft a row)
- If a venue's dossier makes clear it is a SERVICE vendor, not a place that hosts weddings
  — a caterer, photographer, DJ/entertainment, florist, planner, officiant, stationery/
  invitations shop — with no event space of its own, do NOT write a row for it. Instead
  add ` NOTAVENUE:<slug>` to your reply line. (Signals: site sells "our services"/"our
  packages" with no room/capacity/rental, name like "X Catering"/"X Photography", reviews
  about food/photos/music rather than a space.) A caterer that ALSO rents its own hall is
  a venue — keep it. When unsure, draft the row and flag it; the orchestrator decides.

## How many entries
- **Exactly ONE row per venue listed in your call file**, by that venue's assigned bot.
  If a dossier is unusually rich (real pricing table AND strong firsthand commentary),
  still write one row and flag ` RICH:<slug>` in your reply — a second entry may be
  commissioned separately with a different bot.
- When a second entry IS commissioned, split by SOURCE CLUSTER, never by padding:
  entry 1 = website pricing, entry 2 = review/Reddit commentary. Conflicting prices from
  different sources go in SEPARATE entries — that's a feature (more data points).
- No-pricing venues still get their entry: price_text `Quote only` with price_details
  explaining what you checked. Honest thinness beats invented numbers.

## Notes length (concision beats coverage-theater — Kiara, 2026-07)
- **There is NO minimum length.** A ~200-character note that covers everything the dossier
  actually gave you is a GREAT entry. Length follows intel: write every concrete fact
  discovered, as tightly as it can be said, then STOP. Cap ~90 words even for rich
  dossiers. Never stretch, restate, or editorialize to look researched.
- Every sentence earns its place with a concrete fact: pricing shape, capacity,
  what's included vs required (catering policy especially), staff/ownership feel,
  a review specific, a logistics quirk. Delete connective filler ("I dug into...",
  "it's worth noting...", "all in all...").

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
- Your call file pre-assigns each venue's `date=M/YYYY` — use it.
- Exception: a real source date wins. A Reddit comment from "3mo ago" on a thread
  captured July 2026 → collected 4/2026; a 2024 comment → 2024.

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
- `vendor_id`: copy VERBATIM from your call file's venue block. Never guess.
- `bot` column: `bot1..botN` keys from the roster. A bot NEVER gets two entries for the
  same venue (validated). 3-10 entries per bot per run. Bots are PER STATE — they never
  cross states, but the same state roster is reused for future vendor types
  (florists, caterers...), so keep per-bot lifetime totals believable (check roster.mjs).
