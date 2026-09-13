#!/usr/bin/env node
/**
 * Ordering tests for the Explore list comparator.
 *
 *   node scripts/test-rank-order.mjs
 *
 * `compareRanked` is the shared list order for BOTH feeds (the on-screen
 * results list and the tapped-cluster sheet). Vendor Verification adds a
 * `verified` key immediately after `rank`, so the invariant that MUST hold is:
 * verified only ever reorders WITHIN a rank partition, and never lifts a
 * verified partial match above an unverified full match.
 *
 * Run after any change to lib/map/rank.ts.
 */

import { compareRanked } from "../lib/map/rank.ts";

let pass = 0,
  fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(
      `  FAIL ${label}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`,
    );
  }
}

// A ranked row with sensible defaults; override only what a case exercises.
function row(over = {}) {
  return {
    id: over.id ?? "x",
    vendorType: "venue",
    rank: 1,
    verified: false,
    matched: 1,
    priced: false,
    photo: false,
    d: 0,
    ...over,
  };
}

/** Sort a copy by the comparator and return the ids in order. */
function order(rows) {
  return [...rows].sort(compareRanked).map((r) => r.id);
}

// 1. Verified sorts before unverified within the same rank tier.
eq(
  "verified full match before unverified full match",
  order([
    row({ id: "plain", verified: false }),
    row({ id: "verified", verified: true }),
  ]),
  ["verified", "plain"],
);

// 2. Rank still dominates: a verified PARTIAL match must stay below an
//    unverified FULL match. This is the whole point of placing the key after
//    rank, and the case most likely to regress if someone reorders the keys.
eq(
  "unverified full match outranks verified partial match",
  order([
    row({ id: "verifiedPartial", rank: 0, verified: true }),
    row({ id: "plainFull", rank: 1, verified: false }),
  ]),
  ["plainFull", "verifiedPartial"],
);

// 3. Within the partial tier, verified still wins.
eq(
  "verified partial before unverified partial",
  order([
    row({ id: "plainPartial", rank: 0, verified: false }),
    row({ id: "verifiedPartial", rank: 0, verified: true }),
  ]),
  ["verifiedPartial", "plainPartial"],
);

// 4. Verified outranks the price key: a verified vendor with no price sorts
//    above an unverified vendor with a price (same rank). Verification is a
//    stronger signal than an extracted price by design.
eq(
  "verified-no-price before unverified-priced",
  order([
    row({ id: "priced", verified: false, priced: true }),
    row({ id: "verified", verified: true, priced: false }),
  ]),
  ["verified", "priced"],
);

// 5. Between two verified vendors, the lower keys (priced, photo, distance)
//    still decide — verification is not a distance override.
eq(
  "two verified vendors fall through to distance",
  order([
    row({ id: "far", verified: true, d: 100 }),
    row({ id: "near", verified: true, d: 1 }),
  ]),
  ["near", "far"],
);

// 6. No verified vendors: order is byte-for-byte what it was before this key
//    (priced, then photo, then distance). This is the pre-migration state, and
//    the key must be a pure no-op there.
eq(
  "all unverified: priced-then-photo-then-distance unchanged",
  order([
    row({ id: "c", verified: false, priced: false, photo: false, d: 1 }),
    row({ id: "a", verified: false, priced: true, photo: false, d: 9 }),
    row({ id: "b", verified: false, priced: false, photo: true, d: 5 }),
  ]),
  ["a", "b", "c"],
);

// 7. The comparator is total (antisymmetric): swapping two rows negates the
//    sign, so neither feed depends on input order or sort stability.
{
  const a = row({ id: "a", verified: true, rank: 1 });
  const b = row({ id: "b", verified: false, rank: 1 });
  eq("comparator is antisymmetric", Math.sign(compareRanked(a, b)), -Math.sign(compareRanked(b, a)));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
