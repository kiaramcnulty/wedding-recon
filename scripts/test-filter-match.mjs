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
import { filterRank } from "../lib/filters/match.ts";

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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
