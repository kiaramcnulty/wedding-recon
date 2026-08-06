#!/usr/bin/env node
/**
 * Semantic tests for the filter predicate, run against the real 2,163-vendor
 * dataset rather than fixtures.
 *
 *   node scripts/test-filter-match.mjs
 *
 * This is the only executable check on the matching RULES. The SQL twin in
 * migration 0033 cannot be run locally (no Postgres here), so the guarantee is
 * that both implement the same spec and this side is tested. If you change one,
 * change the other and re-run this.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  filterRank, filterRankFor, filterMatch, filterMatchFor, matchedFraction,
  hasAnySelection, countSelections,
} from "../lib/filters/match.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rows = readFileSync(resolve(ROOT, "data/filter-extraction/vendor-filters.jsonl"), "utf8")
  .trim().split("\n").map((l) => JSON.parse(l));

let pass = 0, fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`); }
}

console.log("\nunit — the rules that matter\n");

// Silence must demote, never exclude. This is the whole premise of the design.
eq("no data at all -> partial, not excluded",
  filterRank(null, { setting: { kind: "multi", values: ["mountain"] } }), 0);
eq("silent on the filtered key -> partial",
  filterRank({ has_lodging: true }, { setting: { kind: "multi", values: ["mountain"] } }), 0);
eq("present and matching -> full",
  filterRank({ setting: ["mountain"] }, { setting: { kind: "multi", values: ["mountain"] } }), 1);
eq("present and contradicting -> excluded",
  filterRank({ setting: ["garden"] }, { setting: { kind: "multi", values: ["mountain"] } }), -1);

// A rare filter inverts it: a hotel that ran a shuttle would have said so.
eq("rare + silent -> excluded",
  filterRank({ parking: ["free"] }, { has_shuttle: { kind: "bool", value: true, rare: true } }), -1);
eq("rare + present -> full",
  filterRank({ has_shuttle: true }, { has_shuttle: { kind: "bool", value: true, rare: true } }), 1);
eq("explicit false is a contradiction, not silence",
  filterRank({ has_lodging: false }, { has_lodging: { kind: "bool", value: true } }), -1);

// Range overlap, not start-inside-band: 445 of 736 priced rows are ranges.
const price = (min, max) => ({ kind: "range", mode: "overlap", lo: "price_min", hi: "price_max", min, max });
eq("vendor 4k-12k survives a 6k-8k search",
  filterRank({ price_min: 4000, price_max: 12000 }, { price: price(6000, 8000) }), 1);
eq("vendor 4k-12k excluded by a 1k-2k search",
  filterRank({ price_min: 4000, price_max: 12000 }, { price: price(1000, 2000) }), -1);
eq("touching the boundary counts as overlap",
  filterRank({ price_min: 8000, price_max: 12000 }, { price: price(1000, 8000) }), 1);
eq("starting_at is open-ended upward",
  filterRank({ price_min: 5000, price_kind: "starting_at" }, { price: price(9000, 20000) }), 1);
eq("single_figure is NOT open-ended",
  filterRank({ price_min: 5000, price_kind: "single_figure" }, { price: price(9000, 20000) }), -1);

// A per-person caterer is not comparable to a per-package slider.
eq("off-basis reads as silence, not a miss",
  filterRank({ price_min: 85, price_basis: "per_person" },
    { price: { ...price(5000, 15000), basis: "package" } }), 0);
eq("on-basis compares normally",
  filterRank({ price_min: 8000, price_basis: "package" },
    { price: { ...price(5000, 15000), basis: "package" } }), 1);

// Capacity is a point test in both directions — Kiara: "if I have 100 guests,
// I probably don't want a 400 capacity venue".
const cap = (min, max) => ({ kind: "range", mode: "point", lo: "capacity_max", min, max });
eq("capacity 150 fits a 100-250 search", filterRank({ capacity_max: 150 }, { capacity_max: cap(100, 250) }), 1);
eq("capacity 400 is too big", filterRank({ capacity_max: 400 }, { capacity_max: cap(100, 250) }), -1);
eq("capacity 60 is too small", filterRank({ capacity_max: 60 }, { capacity_max: cap(100, 250) }), -1);

// Season/day tiers override the headline range.
const tiered = {
  price_min: 800, price_max: 4500,
  price_tiers: [
    { season: "peak", day_type: "saturday", min: 4330, max: 4500 },
    { season: "off", day_type: "weekday", min: 800, max: 900 },
  ],
};
eq("peak Saturday uses the peak tier",
  filterRank(tiered, { price: { ...price(4000, 5000), season: "peak", day: "saturday" } }), 1);
eq("peak Saturday excluded from a cheap search",
  filterRank(tiered, { price: { ...price(500, 1000), season: "peak", day: "saturday" } }), -1);
eq("off-peak weekday matches the cheap search the headline would have missed",
  filterRank(tiered, { price: { ...price(500, 1000), season: "off", day: "weekday" } }), 1);

// Multi-select is OR within a filter, AND across filters.
eq("OR within one filter",
  filterRank({ setting: ["garden"] }, { setting: { kind: "multi", values: ["mountain", "garden"] } }), 1);
eq("AND across filters — one miss excludes",
  filterRank({ setting: ["mountain"], has_lodging: false },
    { setting: { kind: "multi", values: ["mountain"] }, has_lodging: { kind: "bool", value: true } }), -1);
eq("a partial anywhere makes the whole row partial",
  filterRank({ setting: ["mountain"] },
    { setting: { kind: "multi", values: ["mountain"] }, has_lodging: { kind: "bool", value: true } }), 0);

// Several categories filtered at once: each vendor is judged ONLY against its
// own type, so a venue filter must never touch a photographer.
const multi = {
  venue: { setting: { kind: "multi", values: ["mountain"] } },
  photos: { shoots_film: { kind: "bool", value: true, rare: true } },
};
eq("venue judged by the venue filter",
  filterRankFor("venue", { setting: ["mountain"] }, multi), 1);
eq("venue contradicting the venue filter is excluded",
  filterRankFor("venue", { setting: ["garden"] }, multi), -1);
eq("photographer is NOT judged by the venue filter",
  filterRankFor("photos", { shoots_film: true }, multi), 1);
eq("photographer judged by its own rare filter",
  filterRankFor("photos", { style: ["documentary"] }, multi), -1);
eq("a type with no filters is untouched",
  filterRankFor("flowers", { style: ["classic"] }, multi), 1);
eq("a venue silent on setting still demotes, not excludes",
  filterRankFor("venue", { has_lodging: true }, multi), 0);
eq("hasAnySelection is false for empty per-type entries",
  hasAnySelection({ venue: {}, photos: {} }), false);
eq("hasAnySelection is true when any type carries one",
  hasAnySelection({ venue: {}, photos: multi.photos }), true);
eq("countSelections sums across types", countSelections(multi), 2);

// --- how MUCH of the ask was met -------------------------------------------
// Grades the partial tier in the Explore list: a vendor silent on 1 filter of 3
// outranks one silent on 2. Only the silences count — a contradiction is
// excluded outright and never reaches the list.
console.log("\nunit — partial-match arithmetic\n");

const three = {
  setting: { kind: "multi", values: ["mountain"] },
  has_lodging: { kind: "bool", value: true },
  has_getting_ready_suite: { kind: "bool", value: true },
};
const detail = (f) => {
  const d = filterMatch(f, three);
  return [d.rank, d.unknown, d.active, Number(matchedFraction(d).toFixed(3))];
};
eq("matches all three", detail({ setting: ["mountain"], has_lodging: true, has_getting_ready_suite: true }),
  [1, 0, 3, 1]);
eq("silent on one of three", detail({ setting: ["mountain"], has_lodging: true }),
  [0, 1, 3, 0.667]);
eq("silent on two of three", detail({ setting: ["mountain"] }),
  [0, 2, 3, 0.333]);
eq("silent on all three (attributes present but unrelated)", detail({ parking: ["free"] }),
  [0, 3, 3, 0]);
eq("no attributes at all is silent on all three", detail(null),
  [0, 3, 3, 0]);
eq("a contradiction is excluded whatever else is silent",
  filterMatch({ setting: ["garden"] }, three).rank, -1);
eq("an unfiltered type scores a full match",
  [filterMatchFor("flowers", { style: ["classic"] }, multi), matchedFraction(filterMatchFor("flowers", null, multi))],
  [{ rank: 1, unknown: 0, active: 0 }, 1]);
eq("unknown can never exceed active",
  filterMatch({}, three).unknown <= filterMatch({}, three).active, true);
// A fraction, not a count of misses: these two are NOT interchangeable once two
// categories with different filter counts are in one feed.
eq("1 of 2 missing ranks below 1 of 3 missing",
  matchedFraction(filterMatch({ setting: ["mountain"] }, {
    setting: three.setting, has_lodging: three.has_lodging,
  })) < matchedFraction(filterMatch({ setting: ["mountain"], has_lodging: true }, three)), true);

// --- corpus behaviour ------------------------------------------------------
console.log("\ncorpus — what real selections return\n");

const norm = (r) => {
  const f = {};
  for (const [k, v] of Object.entries(r)) {
    if (["vendor_id", "name", "vendor_type", "city", "_note"].includes(k)) continue;
    if (v === null || (Array.isArray(v) && !v.length)) continue;
    f[k] = k === "block_type" && !Array.isArray(v) ? [v] : v;
  }
  return Object.keys(f).length ? f : null;
};

function report(label, type, selection) {
  const pool = rows.filter((r) => r.vendor_type === type);
  const ranks = pool.map((r) => filterRank(norm(r), selection));
  const full = ranks.filter((x) => x === 1).length;
  const partial = ranks.filter((x) => x === 0).length;
  const out = ranks.filter((x) => x === -1).length;
  console.log(`  ${label}`);
  console.log(`     ${full} match · ${partial} missing some info · ${out} ruled out  (of ${pool.length})`);
  return { full, partial, out };
}

report("venue · mountain or garden, 100-250 guests", "venue", {
  setting: { kind: "multi", values: ["mountain", "garden"] },
  capacity_max: cap(100, 250),
});
report("venue · outside catering allowed, under $10k", "venue", {
  catering_policy: { kind: "multi", values: ["outside_allowed"] },
  price: { ...price(0, 10000), basis: "package" },
});
report("venue · same, but a peak Saturday", "venue", {
  catering_policy: { kind: "multi", values: ["outside_allowed"] },
  price: { ...price(0, 10000), basis: "package", season: "peak", day: "saturday" },
});
report("photos · documentary, does elopements, under $4k", "photos", {
  style: { kind: "multi", values: ["documentary"] },
  does_elopements: { kind: "bool", value: true },
  price: { ...price(0, 4000), basis: "package" },
});
report("photos · also shoots film (rare)", "photos", {
  shoots_film: { kind: "bool", value: true, rare: true },
});
report("hotel · has a shuttle (rare)", "hotel", {
  has_shuttle: { kind: "bool", value: true, rare: true },
});
report("food · gluten free + vegan, under $80pp", "food", {
  dietary: { kind: "multi", values: ["gluten_free", "vegan"] },
  price: { ...price(0, 80), basis: "per_person" },
});
report("beauty · comes to you, hair and makeup", "beauty", {
  work_mode: { kind: "multi", values: ["on_location"] },
  services: { kind: "multi", values: ["hair", "makeup"] },
});
report("no filters at all", "venue", {});

// Cross-type isolation on the real corpus: filter venues by setting and
// photographers by style at the same time, and confirm neither pool moves when
// only the OTHER type's filter is present.
{
  const venueOnly = { venue: { setting: { kind: "multi", values: ["mountain"] } } };
  const both = {
    ...venueOnly,
    photos: { style: { kind: "multi", values: ["documentary"] } },
  };
  const count = (type, sels) => {
    const pool = rows.filter((r) => r.vendor_type === type);
    const ranks = pool.map((r) => filterRankFor(type, norm(r), sels));
    return { kept: ranks.filter((x) => x >= 0).length, of: pool.length };
  };
  const vA = count("venue", venueOnly), vB = count("venue", both);
  const pA = count("photos", venueOnly), pB = count("photos", both);
  console.log(`\n  venues  · venue filter only: ${vA.kept}/${vA.of} · plus a photo filter: ${vB.kept}/${vB.of}`);
  console.log(`  photos  · venue filter only: ${pA.kept}/${pA.of} · plus a photo filter: ${pB.kept}/${pB.of}`);
  eq("adding a photo filter does not change the venue result", vA.kept, vB.kept);
  eq("photographers are untouched by a venue-only filter", pA.kept, pA.of);
  eq("the photo filter does narrow photographers", pB.kept < pA.kept, true);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
