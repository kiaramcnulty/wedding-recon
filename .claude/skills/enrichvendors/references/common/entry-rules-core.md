# Entry rules — core (all vendor types, all mandatory)

## Entry counts come from the call file
- Each vendor block assigns `entries=N` (1–3) with per-entry bots and dates — the batch
  script sets N from how rich the vendor's research actually is. Follow the assignment
  exactly; never add rows beyond it. If the dossier can't honestly support N distinct
  entries, write fewer and flag ` SHORT:<slug>` (see the contract). Kiara's rule: fewer
  or zero entries beats invented content — every entry must carry at least one sourced fact.
- Multi-entry split is by SOURCE CLUSTER (contract): pricing / experience-review /
  logistics. Never split by restating the same facts twice.

## Notes length (concision beats coverage-theater — Kiara, 2026-07)
- **There is NO minimum length.** A ~200-character note that covers everything the dossier
  actually gave you is a GREAT entry. Length follows intel: write every concrete fact
  discovered, as tightly as it can be said, then STOP. Cap ~90 words even for rich
  dossiers. Never stretch, restate, or editorialize to look researched.
- Every sentence earns its place with a concrete fact. Delete connective filler
  ("I dug into...", "it's worth noting...", "all in all...").

## price_text + price_details — REQUIRED on every entry
- `price_text`: compact headline, e.g. "$3.5k-$8k depending on season/day", "starts
  around $30pp for buffet", "No quote found".
- `price_details`: the shape — packages/tiers, minimums, deposits, per-person or hourly
  rates, add-ons, what's included (specifics per type rules).
- **Contract minimums are MUST-SURFACE — if any source states one, DEFINITELY call it out
  (every vendor type).** This means any floor a couple is forced to clear: a spend /
  food-and-beverage minimum, a minimum guest count, minimum hours or coverage, a minimum
  order or booking value, an off-peak/weekday minimum, or a minimum-budget requirement.
  Put it in `price_details`, and lift it into the `price_text` headline when it's the number
  a couple would actually budget around ("$5k F&B minimum", "8-hr minimum booking"). A
  minimum is the hidden cost that blows a budget, so never bury it or leave a sourced one
  out. Attribute it like any other fact; never invent, round up, or estimate a minimum no
  source states.
- **If you have a number ANYWHERE, you have a price data point — lead with it.** A
  headline that says pricing is quote-only while the same entry states a figure
  contradicts itself: "Quote only but The Knot says $8k" is two claims, and the second one
  is the useful one. Write "The Knot lists $8k" and drop the quote-only framing. This holds
  however soft the number is (a directory listing, a review, a reddit comment) — hedge it
  and name the source, but do not bury it under a headline that says there is no price.
  `upload.mjs` HARD-FAILS a price field that does both.
- No pricing found at all (common — many say "inquire"): `price_text` says so in plain
  words, `price_details` honestly says what you checked and that pricing is on inquiry;
  then let `notes` lead with services/style/specialties instead. NEVER invent numbers,
  NEVER extrapolate a market rate onto a specific vendor. Hedged variations of SOURCED
  ranges only, with the hedge framed ("no formal quote, going off their published
  table...").
- **Do NOT write "Quote only"** (retired 2026-08-07). It reads as a category label rather
  than as something a couple would say, and it was being written on entries that stated a
  price anyway. Use one of these, and VARY it across entries so a page of recon does not
  read as one template: **"No quote provided" / "No quote found" / "Didn't get a quote"**.
  Any of "no published pricing", "they would not give a number over email", or whatever
  the honest specific is, is also fine and better than a formula. Note these stay true even
  when `price_details` cites a third-party figure — they say what WE got, not that no
  price exists anywhere. `upload.mjs` rewords a stray "quote only" at insert.

## Dates (recon_collected_month/year)
- Use each entry's pre-assigned `date=M/YYYY` from the block.
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
  "a review called it...". Never first person for things the bot didn't do.
- **Carry a sourced negative into the notes when the dossier has one.** Include negatives
  and quirks when sources have them (slow email replies, bad lighting, early last call,
  travel fees stacking up) — warts make entries credible and useful. If the dossier has a
  `## watch-outs` section, at least ONE of its items must land in the free-text `notes` of
  at least one of the vendor's entries, attributed inline ("a review flagged...", "a bride
  on reddit warned..."). On a multi-entry vendor it rides the experience/review entry. It
  goes in the prose of `notes` like any other fact — there is no separate field, label, or
  "watch-out" heading in the entry itself.
- **Never manufacture a negative.** No `## watch-outs` section (or nothing negative in the
  sources) means the entry stays positive — do NOT invent a downside for "balance".
  Unsourced criticism of a real business is worse than none; every wart traces to a named
  source in `sources`, exactly like every other fact.

## Other fields
- `venue` column = the vendor's business name (historical column name, all types).
- `vendor_id`: copy VERBATIM from your call file's block. Never guess.
- `bot`: `botN` keys from the roster, VERBATIM per entry from the block. A bot NEVER gets
  two entries for the same vendor (validated); ≤50 entries per bot per run. Bots are PER
  STATE and shared across vendor types — the same account may already have entries for
  other types; that's expected (a real couple researches venues AND caterers AND bands).
