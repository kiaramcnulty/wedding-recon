import type { VendorType } from "@/lib/constants/categories";

/**
 * The Explore list order: the scored row shape and the comparator.
 *
 * Extracted from `components/map/vendor-map.tsx` (which still owns
 * `rankVendor()`, the scoring) so the ordering rule is a plain module a node
 * test can import — `scripts/test-rank-order.mjs` is the executable check on
 * it, same pattern as `scripts/test-filter-match.mjs` for the matcher.
 */

/** A vendor scored for the list order. `d` is squared distance from the map center. */
export interface RankedVendor {
  id: string;
  vendorType: VendorType;
  rank: 0 | 1;
  /** Vendor Verification: paying vendors sort first WITHIN their rank tier. */
  verified: boolean;
  matched: number;
  priced: boolean;
  photo: boolean;
  d: number;
}

/**
 * The list order. Six keys:
 *
 *   rank     full matches before the "missing some information" ones. This has
 *            to stay outermost: it is the partition the list draws its divider
 *            on, and what the cap keeps when it bites. Nothing below — verified
 *            included — may ever lift a row across it.
 *   verified Vendor Verification (paid tier): a verified vendor sorts first
 *            within its partition only. Deliberately AFTER rank: a verified
 *            partial match stays below every full match, per the locked
 *            decision in docs/vendor-verification-plan.md. The flag comes from
 *            `vendors_in_bbox` (migration 0045) and is tested `=== true`
 *            upstream, so until that migration is applied the key is a no-op
 *            for every row alike.
 *   matched  how MUCH of the ask a vendor met — the partial tier is itself
 *            graded, so a venue silent on 1 filter of 3 outranks one silent on
 *            2. A no-op above the divider, where every row matched everything
 *            and scores 1, which is why it can sit here rather than being
 *            special-cased to rank 0.
 *   priced   a vendor with an extracted price before one without. A couple is
 *            shopping on budget, and a card that can answer "what does this
 *            cost" is worth more than one that cannot. No divider — this tier
 *            is internal, unlike rank.
 *   photo    a card that draws an image before one that falls through to a
 *            category placeholder.
 *   d        then nearest the map center.
 *
 * Each key only ever reorders within the tier above it, so distance still
 * decides everything at the bottom.
 *
 * **Shared by BOTH feeds** — the on-screen results list and the tapped-cluster
 * sheet. The cluster sheet used to render MapLibre leaf order, which is
 * supercluster tree order and arbitrary to a reader, so the same two vendors
 * came out in a different order depending on which way you opened the list
 * (reported 2026-08-07: a "No quote found" photographer above one quoting
 * $2.5k). If a seventh key is ever added, add it here and both move together.
 */
export function compareRanked(a: RankedVendor, b: RankedVendor): number {
  return (
    b.rank - a.rank ||
    Number(b.verified) - Number(a.verified) ||
    b.matched - a.matched ||
    Number(b.priced) - Number(a.priced) ||
    Number(b.photo) - Number(a.photo) ||
    a.d - b.d
  );
}
