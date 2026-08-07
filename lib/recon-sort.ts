/**
 * The order a vendor's recon entries are shown in — one implementation, every
 * surface. The vendor page's entry list and the preview card's text carousel
 * (map peek, cluster feed, results feed, Hub) both call `sortReconEntries`, so
 * the entry a card leads with is always the entry the vendor page leads with.
 *
 * Plain module, no `"use client"`: the vendor page is a Server Component and
 * the preview card is a Client Component, and a client module cannot be called
 * from the server (the mistake `usesServiceRegion()` made — see CLAUDE.md).
 *
 * Three keys, in order:
 *   1. the viewer's own entry first
 *   2. entries that state a price before entries that do not
 *   3. most recently collected first
 */

/**
 * The fields the comparator reads. Both surfaces' row shapes satisfy this
 * structurally, so neither has to build an adapter — but the preview card's
 * query has to actually SELECT the date columns, or every row falls back to
 * `created_at` and the collected-date ordering silently does nothing.
 */
export interface SortableReconEntry {
  author_id: string;
  price_text?: string | null;
  price_details?: string | null;
  recon_collected_month?: number | null;
  recon_collected_year?: number | null;
  created_at?: string | null;
}

/**
 * A money figure: a currency symbol adjacent to a digit, or a digit next to an
 * explicit currency word.
 *
 * A bare number is deliberately NOT a price. Recon prose is full of digits that
 * are guest counts, hours of coverage, party sizes and years ("Up to 150
 * attendees", "8-hr minimum", "2026 dates"), so keying off `\d` would put
 * almost everything in the priced tier and the partition would stop meaning
 * anything. Measured against the 818 real price quotes in
 * `data/filter-extraction/vendor-filters.jsonl`, this matches 97.2%; the misses
 * are all bare numbers lifted off a rate card ("Starting at 2200"), a shape
 * recon text does not use because the drafting contract writes `$` figures.
 */
const MONEY = /\$\s*\d|\d\s*\$|\d\s*(?:dollars|usd)\b/i;

/**
 * Whether an entry actually states a price.
 *
 * **Not** "is `price_text` filled in" — that field is REQUIRED on every
 * bot-drafted entry (`references/common/entry-rules-core.md`) and says so in
 * words when a vendor publishes nothing ("No quote found", "Didn't get a
 * quote"), so a non-blank test would sort every entry into the priced tier
 * including the ones saying there is no price. Those wordings are deliberately
 * open-ended rather than a fixed sentinel — the drafting contract asks for
 * variety — which is another reason the test has to read the text for a figure
 * rather than compare against a known string. (It used to be the single
 * sentinel `Quote only`; retired 2026-08-07, and migration 0036 rewrote the
 * rows that carried it.)
 *
 * `price_details` counts too, not just the headline. The contract puts contract
 * minimums and tier tables there, and hedged-but-sourced ranges land there
 * under a no-price headline ("no formal quote, going off their published
 * table, $4k-$6k"). Both fields render on the card, so a number in either is a
 * number the couple gets. That combination is also why the headline wording is
 * phrased as "we did not get a quote" rather than "there is no price": it has
 * to stay true when the details below it cite a third-party figure.
 */
export function hasPriceQuote(entry: {
  price_text?: string | null;
  price_details?: string | null;
}): boolean {
  return MONEY.test(entry.price_text ?? "") || MONEY.test(entry.price_details ?? "");
}

/**
 * When the recon was COLLECTED, as a sortable number.
 *
 * The collected month/year is the recency that matters and the one the card
 * displays: a quote gathered in 2024 is staler than one gathered last month
 * however recently someone typed it in, and ordering by anything else puts a
 * card reading "Jan 2024" above one reading "Jun 2026", which just looks
 * broken. Pre-migration rows (`0008`/`0009`) have no collected date, so they
 * fall back to `created_at` — both land on one millisecond axis, so the two
 * kinds interleave correctly.
 */
function collectedMs(entry: SortableReconEntry): number {
  const year = entry.recon_collected_year;
  if (typeof year === "number" && Number.isFinite(year)) {
    const month = entry.recon_collected_month;
    const m = typeof month === "number" && month >= 1 && month <= 12 ? month : 1;
    return Date.UTC(year, m - 1, 1);
  }
  return createdMs(entry);
}

function createdMs(entry: SortableReconEntry): number {
  const t = entry.created_at ? Date.parse(entry.created_at) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Order two entries. `viewerId` is null for signed-out readers, where the first
 * key is simply a no-op (Explore and every vendor page are public).
 */
export function compareReconEntries(
  a: SortableReconEntry,
  b: SortableReconEntry,
  viewerId: string | null,
): number {
  if (viewerId) {
    const mine =
      Number(b.author_id === viewerId) - Number(a.author_id === viewerId);
    if (mine !== 0) return mine;
  }

  const priced = Number(hasPriceQuote(b)) - Number(hasPriceQuote(a));
  if (priced !== 0) return priced;

  // Collected date is month-granular, so most comparisons inside a partition
  // tie. `created_at` breaks them: bot entries are backdated to a random moment
  // INSIDE their collected month at upload, so it orders a month sensibly
  // rather than arbitrarily, and it makes the whole comparator total — the
  // result does not depend on the order the rows arrived in.
  return collectedMs(b) - collectedMs(a) || createdMs(b) - createdMs(a);
}

/** Sorted copy, newest-priced-first. Never mutates the input. */
export function sortReconEntries<T extends SortableReconEntry>(
  entries: readonly T[],
  viewerId: string | null,
): T[] {
  return [...entries].sort((a, b) => compareReconEntries(a, b, viewerId));
}
