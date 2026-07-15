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
  around $30pp for buffet", "Quote only".
- `price_details`: the shape — packages/tiers, minimums, deposits, per-person or hourly
  rates, add-ons, what's included (specifics per type rules).
- No published pricing (common — many say "inquire"): `price_text` = `Quote only`,
  `price_details` honestly says what you checked and that pricing is on inquiry; then let
  `notes` lead with services/style/specialties instead. NEVER invent numbers, NEVER
  extrapolate a market rate onto a specific vendor. Hedged variations of SOURCED ranges
  only, with the hedge framed ("no formal quote - going off their published table...").

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
- Include negatives and quirks when sources have them (slow email replies, bad lighting,
  early last call, travel fees stacking up). Warts make entries credible and useful.

## Other fields
- `venue` column = the vendor's business name (historical column name, all types).
- `vendor_id`: copy VERBATIM from your call file's block. Never guess.
- `bot`: `botN` keys from the roster, VERBATIM per entry from the block. A bot NEVER gets
  two entries for the same vendor (validated); ≤50 entries per bot per run. Bots are PER
  STATE and shared across vendor types — the same account may already have entries for
  other types; that's expected (a real couple researches venues AND caterers AND bands).
