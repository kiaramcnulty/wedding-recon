# Proposal: wedding / elopement price sub-filter (plan step 7b)

Status: **BUILT 2026-10-07** (branch `claude/elopement-price-filter`). As-built notes, including where the build departs from or sharpens this proposal, are in `docs/notes/explore-map.md` under "Weddings | Elopements price mode". Kiara answered the three decisions on 2026-10-07 (see the end). Kiara asked on 2026-10-04 for a price sub-filter that defaults to wedding, to be done at the end of the bot-recon cleanup.

## Problem
The price slider has one number per vendor (`price_min` / `price_max`). During the cleanup we ruled the following:
- A vendor that publishes a wedding price is tagged at the **wedding floor**. Micro-wedding packages count as weddings.
- An **elopement-only** vendor is tagged at its elopement price, so it still shows up in price searches.

As a result, a couple looking for an elopement photographer can't filter by elopement price. About 146 photographers, 39 venues, 23 florists, 20 planners and 18 hair & makeup artists have an elopement price that today lives only in the prose. That count comes from entries that mention elopements together with a $ figure, so treat it as an upper bound.

## Proposed behaviour
- **Toggle.** Add a small **Wedding | Elopement** toggle above the price slider, defaulting to **Wedding**, for the types where elopement pricing is common: `photos`, `planner`, `venue`, `flowers`.
- **Wedding mode** behaves exactly as today: the slider matches `price_min` / `price_max`.
- **Elopement mode** matches new keys, `elopement_price_min` / `elopement_price_max`, using the same overlap rule and unit.
  - A vendor with `does_elopements: true` but no elopement price sorts into the unpriced tier, the same way unpriced vendors do today.
  - A vendor without `does_elopements` is excluded in elopement mode.
- **Display.** The vendor card and page show "Elopements from $X" next to the wedding price when both exist.

## Data changes
1. **New filter keys** (no migration, since `filters` is jsonb): `elopement_price_min`, `elopement_price_max`, `elopement_price_quote` (verbatim from the prose) and `elopement_price_confidence`.
   - `has_price` (migration 0035) already counts any numeric key containing "price", so the ranking needs no SQL change.
2. **Backfill.** A prose-only agent pass, with no web fetching, over the roughly 250 candidate vendors. It tags the elopement price each entry already states, following the usual dry-run, review and Kiara-approval flow, so it's cheap.
3. **Elopement-only vendors** (decision 2 below): copy their current `price_min` / `price_max` into the elopement keys too.

## Code changes (est. one PR)
- `lib/constants/vendor-filters.ts`: elopement range filter entries for the four types, plus a `mode` / toggle grouping with the existing `price` filter.
- The filter sheet UI: render the toggle and send the chosen key pair. The default is Wedding, so existing deep links behave the same.
- `lib/filters/vendor-tags.ts` / the matcher: match the new keys, which reuses the overlap logic.
- `lib/constants/filter-histograms.json`: regenerate it so the slider's axis covers elopement prices.
- `scripts/test-*.mjs`: add assertions for the toggle's matching and default.
- `docs/notes/explore-map.md`: document it.

## Decisions (Kiara, 2026-10-07)
1. **Types:** photos, planner, venue, flowers. Agreed.
2. **Elopement-only vendors:** a checkbox, **"Include elopement-only vendors"**, under the Wedding-mode slider.
   - It is **on by default**, which keeps today's behaviour (ruling A).
   - Unticking it hides vendors tagged `elopement_only: true` from Wedding-mode price results.
   - In Elopement mode the checkbox is hidden, since every vendor there sells elopements.
   - This needs one more boolean key, `elopement_only`, set by the backfill pass. It is never inferred from silence; it is set only when the vendor's own pages show no wedding package.
3. **Backfill first:** run the prose-only elopement-price pass, with Kiara approving it as usual, before building the UI. Agreed.

## UI (matches the current filter sheet)
- **Mode chips.** Inside the existing "Package price" / "Venue fee" / "Price" accordion group, above the histogram, a pair of small chips: **Weddings** | **Elopements**. They are the same `Chip size="sm"` component and category colour as the venue season/day chips, which already sit above that histogram. **Weddings is selected by default and must render as selected (filled chip) on first open, not only after a tap** (Kiara, 2026-10-07). It is a radio pair: exactly one chip is always selected, and tapping the selected one does not deselect it (unlike the season/day chips).
- **Histogram and slider.** These swap to the elopement price distribution in Elopement mode. The summary pill on the closed row reads e.g. "Elopements · $1,500 – $4,000" (Weddings mode shows "Weddings · ..." once a range is set).
- **Checkbox.** Below the price readout in Wedding mode: "Include elopement-only vendors", ticked by default.
- **Elopement mode footnote** (11px muted, like `basisNote`): "Shows vendors' elopement packages. Vendors that do elopements but don't post a price appear after priced ones."
