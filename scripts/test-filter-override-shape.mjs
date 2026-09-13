#!/usr/bin/env node
/**
 * Shape-fidelity test for the vendor filter-override editor.
 *
 *   node scripts/test-filter-override-shape.mjs
 *
 * The editor (components/portal/filter-override-editor.tsx) and the server
 * sanitizer both emit filter_overrides in the RAW vendors.filters jsonb shape.
 * This proves that shape is exactly what the matcher reads: an override object
 * built the way the editor builds it must produce a FULL match (rank 1) against
 * a selection it satisfies, and the documented non-matches (contradiction /
 * silence) must behave too. If the editor's output shape ever drifts from what
 * lib/filters/match.ts expects, this fails — that is the whole point.
 *
 * Run after touching the editor, the sanitizer, or match.ts.
 */

import { filterMatchFor } from "../lib/filters/match.ts";

let pass = 0,
  fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`);
  }
}

// What the editor produces for a venue that filled every control in:
//   multi  setting        -> ["mountain","garden"]
//   bool   has_lodging    -> true
//   range  capacity_max   -> 200            (point: value at the def key)
//   range  price          -> price_min/max  (overlap: lo/hi keys)
const overrides = {
  setting: ["mountain", "garden"],
  has_lodging: true,
  capacity_max: 200,
  price_min: 5000,
  price_max: 12000,
};

// A couple's selection this vendor SATISFIES on every axis.
const matching = {
  venue: {
    setting: { kind: "multi", values: ["mountain"] },
    has_lodging: { kind: "bool", value: true },
    capacity_max: { kind: "range", mode: "point", lo: "capacity_max", min: 100, max: 300 },
    price: { kind: "range", mode: "overlap", lo: "price_min", hi: "price_max", min: 4000, max: 15000 },
  },
};

eq(
  "editor output is a FULL match against a selection it satisfies (rank 1)",
  filterMatchFor("venue", overrides, matching).rank,
  1,
);

// Multi contradiction: the couple wants a setting the vendor explicitly is not.
eq(
  "a multi value the vendor does not hold is a contradiction (rank -1)",
  filterMatchFor("venue", overrides, {
    venue: { setting: { kind: "multi", values: ["waterfront"] } },
  }).rank,
  -1,
);

// Range point out of band: capacity 200 is not within [300,500].
eq(
  "a point value outside the range is a contradiction (rank -1)",
  filterMatchFor("venue", overrides, {
    venue: { capacity_max: { kind: "range", mode: "point", lo: "capacity_max", min: 300, max: 500 } },
  }).rank,
  -1,
);

// Range overlap: [5000,12000] overlaps [10000,20000] at the top -> match.
eq(
  "an overlapping price range matches (rank 1)",
  filterMatchFor("venue", overrides, {
    venue: { price: { kind: "range", mode: "overlap", lo: "price_min", hi: "price_max", min: 10000, max: 20000 } },
  }).rank,
  1,
);

// Silence: the vendor set no ceremony_location, so a filter on it is unknown,
// which demotes to the partial tier (rank 0), never excludes.
eq(
  "a filter the vendor is silent on demotes to partial (rank 0)",
  filterMatchFor("venue", overrides, {
    venue: { ceremony_location: { kind: "multi", values: ["outdoor"] } },
  }).rank,
  0,
);

// An empty override object is silent on everything -> partial, never a match.
eq(
  "empty overrides are silent (rank 0) under an active filter",
  filterMatchFor("venue", {}, {
    venue: { has_lodging: { kind: "bool", value: true } },
  }).rank,
  0,
);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
