# "2026 Colorado Wedding Cost Spreadsheet" — build plan (handoff — executable by an agent)

Goal: the giveaway artifact for the Reddit/FB distribution pilot. A clean, filterable
spreadsheet of real Colorado wedding-vendor pricing, generated from our own data, honest about
provenance, with weddingrecon.com mentioned once as the living version. Model it on the
vendor-research spreadsheets couples already share in wedding subreddits (a real example is in
the repo root: `2025_wedding_vendors_for_reddit.xlsx` — match its spirit, not its layout).

## Data source — use the PARSED prices only

- **Source of truth: the hosted Supabase DB** — `vendors` (name, `vendor_type`, city, region,
  website, `filters` jsonb, id) via the service-role client, same env/pattern as
  `.claude/skills/launchvendors/scripts/upload.mjs`. A local snapshot of the parsed price data
  exists at `data/filter-extraction/vendor-filters.jsonl` (2,163 rows) — usable for developing
  the script, but the shipped sheet must be built from a fresh DB pull.
- **Prices come exclusively from the numeric filter keys** (`price_min`, `price_max`,
  `minimum_spend`, and the per-type variants like `bride_price_min`, `trial_price`), plus the
  verbatim `price_quote` string alongside. **NEVER re-extract prices from recon prose with a
  regex** — validated finding: ~70% of regex-pulled figures are deposits/add-ons/junk
  (`docs/` and memory both record this).
- Respect `price_basis`: never mix `per_person` and `package` figures in one aggregate.
  Venues: convert per-person to package at the stated assumption (100 guests — the same
  `VENUE_PRICE_ASSUMPTIONS` the app uses) and say so in the sheet. Any open-ended-range
  sentinel max is NOT a price — drop the max, keep the min.
- **Public-defensibility filter:** this sheet attaches prices to named businesses in public.
  Only include a vendor's price row when `price_confidence` is `published` or `quoted`, and
  always carry the verbatim `price_quote` in its own column so every figure is traceable.
  Vendors with no qualifying price still count toward category totals but get no price row.
- **Hotels (`hotel` type) have no price model** — exclude from cost tabs entirely in v1.

## Tabs (exact order)

1. **READ ME** — what this is, one-paragraph methodology ("aggregated from vendors' published
   rate cards, review content, and public Reddit/web threads, collected mid-2026"), the
   as-of date, "prices change — always confirm with the vendor," an invitation to share the
   sheet freely, and ONE link: `https://weddingrecon.com` described as the searchable/living
   version. No "real couples" claims anywhere.
2. **Overview** — one row per category: vendor count in DB, count with usable pricing, and
   median / 25th / 75th percentile of the normalized starting price, plus a plain-English
   basis note per category ("venue figures = venue fee for ~100 guests"). Use spreadsheet
   formulas (`MEDIAN`, `COUNTIFS`, `QUARTILE` over the category tabs) so it recalculates;
   don't hardcode Python-computed numbers.
3. **By region** — same medians split Denver metro / Boulder / Colorado Springs / Fort
   Collins–NoCo / Mountains. Map `vendors.region`+`city` to those five buckets in Python
   before writing; leave a bucket blank rather than showing a median of n<5 (mark "too few
   to say", n shown).
4. **One tab per category** — Venues, Catering, Photography, Florals, DJs, Live Music,
   Planners, Hair & Makeup, Bridal Shops. Columns: Name · City · Starting price (numeric,
   normalized) · Price basis · Verbatim quote (`price_quote`) · Website · Wedding Recon page
   (`https://weddingrecon.com/vendor/<id>`). Venues additionally get a
   `Publishes pricing? (Y)` column — that flag is a selling point of the whole sheet.
   Sort each tab by starting price ascending, unpriced vendors omitted (the tab header
   states "N more <category> vendors with no public pricing are on the map").

## Format

Arial throughout; bold frozen header row + autofilter on every data tab; currency `$#,##0`;
column widths sized to content; a single accent color for headers (use the brand green
`#1D9E75`, white text). No merged cells in data tables. Follow the xlsx skill's rules:
run `recalc.py`, zero formula errors, no XLOOKUP/FILTER-family functions.

## Verification (agent, before handing over)

1. Spot-check 10 random price rows: the numeric figure must be consistent with its own
   verbatim `price_quote` text.
2. Overview counts must equal the DB counts per type.
3. Confirm no vendor appears twice and no hotel-type row appears in any cost tab.
4. Skim the venues tab for absurd outliers (a $50 or $500,000 "starting price" is an
   extraction bug, not a data point) — flag any to the human rather than silently dropping.

## Human steps (Kiara)

- Review the sheet before anything is posted — especially the READ ME framing and any
  outliers the agent flags.
- For Reddit, upload to Google Sheets and share a view-only link (Reddit culture strongly
  prefers a Sheets link over an .xlsx attachment); keep the xlsx as the canonical artifact.

Deliverable: `2026_colorado_wedding_costs.xlsx` written to the repo's scratch/output location
the human specifies (not committed to git).
