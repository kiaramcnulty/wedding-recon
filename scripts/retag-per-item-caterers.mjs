#!/usr/bin/env node
/**
 * One-off: retag caterers whose `price_min` is a per-ITEM price as
 * `price_basis: "per_item"`.
 *
 *   node scripts/retag-per-item-caterers.mjs [--dry]
 *
 * Caterers filter on a per-person axis, and `basisScale` divides a `package`
 * quote by PRICE_ASSUMPTIONS.guests to get there. That is right for an event
 * minimum ($5,000 -> $50 a head) and wrong for a single platter: the extraction
 * tagged grazing boards and menu items `package` too, so a $350 platter became
 * $3.50 a head and sixteen caterers piled up under $12, taking four of the ten
 * slider notches with them.
 *
 * `per_item` has no entry in food's `basisScale`, and an unconvertible basis is
 * already handled everywhere it matters — `filterRank` counts it unknown and
 * returns rank 0, so the vendor stays on the map and demotes to the partial
 * tier rather than being excluded, and `valueFor` in the backfill drops it from
 * the histogram. So this is a DATA fix with no code behind it.
 *
 * Only rows whose own `price_quote` is evidence of a per-item price are
 * retagged, listed below with that evidence. Deliberately NOT touched: rows
 * where the figure reads like a genuine event minimum ("$1300.00 food &
 * beverage minimum"), and the ambiguous listing-site "starting around $200"
 * rows on full-service caterers — a low minimum is not the same claim as a
 * per-item price, and guessing on a real business is worse than a wide bin.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "data/filter-extraction/vendor-filters.jsonl");
const DRY = process.argv.includes("--dry");

/** name -> why its price_min is one item rather than a wedding order. */
const PER_ITEM = {
  "Hafa Adai Fiesta Food": "menu item price - quote is a full pan of short ribs",
  "Amazing Graze Charcuterie Co": "retail box - quote is a $85 date night box",
  "The Peppered Pear": "grazing company, listing start price is the smallest board",
  "The Artful Platter": "grazing company, listing start price is the smallest board",
  "Pueblo Charcuterie": "grazing company, listing start price is the smallest board",
  "Get Plattered": "quote says $350/EACH for one 30 inch platter",
  "Justa Grazin'": "grazing company, listing start price is the smallest spread",
};

const lines = readFileSync(SRC, "utf8").split("\n");
let changed = 0;
const seen = new Set();

const out = lines.map((line) => {
  if (!line) return line;
  const row = JSON.parse(line);
  if (row.vendor_type !== "food") return line;
  const why = PER_ITEM[row.name];
  if (!why) return line;
  seen.add(row.name);
  if (row.price_basis !== "package") {
    console.log(`  skip  ${row.name} — basis is ${JSON.stringify(row.price_basis)}, not package`);
    return line;
  }
  console.log(
    `  retag ${row.name.padEnd(30)} $${row.price_min}` +
      ` (was $${(row.price_min / 100).toFixed(2)}/head) — ${why}`,
  );
  changed++;
  row.price_basis = "per_item";
  return JSON.stringify(row);
});

for (const name of Object.keys(PER_ITEM)) {
  if (!seen.has(name)) console.log(`  MISS  ${name} — no food row with this name`);
}

if (DRY) {
  console.log(`\n--dry: ${changed} rows would change, nothing written.`);
  process.exit(0);
}
writeFileSync(SRC, out.join("\n"));
console.log(`\n${changed} rows retagged in ${SRC}`);
