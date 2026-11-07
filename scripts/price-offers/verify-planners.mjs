#!/usr/bin/env node
/**
 * Check the extracted planner offers and write the review file.
 *
 *   node scripts/price-offers/verify-planners.mjs
 *
 * For every offer in `data/price-offers/planner/offers/*.jsonl`:
 *   - the shape passes `parseOffer` (lib/filters/price-offers.ts);
 *   - the quote appears verbatim (whitespace-collapsed) in the pack section
 *     for the cited file, and ideally in the research file itself (a quote
 *     that only matches the pack spans an elided gap, and is flagged);
 *   - every dollar figure in price_min/price_max appears in the quote;
 *   - an optional `label_quote` (the package name, when the site prints it far
 *     from the price) is verbatim in the same research file.
 * Files are read in name order and a later file's offer for the same vendor
 * and scope replaces an earlier one, so a hand-checked second pass
 * (`zz-second-pass.jsonl`) overrides the agent batches.
 * Writes `review.csv` (one row per offer, with the checks) and prints counts.
 * Its `approve` column is what apply-planners.mjs reads: "yes" by default for
 * rows that pass, "check" for the ones flagged in FLAGGED below, "no" for rows
 * that fail. Edit it by hand to approve or reject.
 * Reads and writes local files only.
 */
import { registerHooks } from "node:module";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) return next(pathToFileURL(resolve(ROOT, `${specifier.slice(2)}.ts`)).href, context);
    return next(specifier, context);
  },
});
const { parseOffer } = await import("../../lib/filters/price-offers.ts");

const DIR = resolve(ROOT, "data/price-offers/planner");

// Rows a person should look at before they go live. The 2026-10-31 spot
// check flagged Forget Me Knot (631 number; confirmed legit, Lakewood CO),
// KM Flowers (flattened table) and Bella Notte (2021 pages); Kiara approved
// all three on 2026-11-01.
const FLAGGED = {};
const norm = (s) => s.replace(/\s+/g, " ").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').trim().toLowerCase();

// Pack sections by "### file:" header, per vendor.
const packSections = new Map(); // `${vendor_id}|${source}` -> text
const fetchedAt = new Map();
for (const f of readdirSync(join(DIR, "packs"))) {
  for (const block of readFileSync(join(DIR, "packs", f), "utf8").split("\n\n---\n\n")) {
    const id = block.match(/^vendor_id: (\S+)/m)?.[1];
    if (!id) continue;
    fetchedAt.set(id, block.match(/^research fetched: (\S+)/m)?.[1]);
    const parts = block.split(/^### file: /m).slice(1);
    for (const p of parts) {
      const nl = p.indexOf("\n");
      packSections.set(`${id}|${p.slice(0, nl).trim()}`, p.slice(nl + 1));
    }
  }
}

const digits = (n) => {
  const s = String(n);
  const withComma = Number(n).toLocaleString("en-US");
  const k = n >= 1000 && n % 100 === 0 ? `${n / 1000}k` : null;
  return [s, withComma, k].filter(Boolean);
};

const rows = [];
const perVendor = new Map();
const perVendorOffers = new Map();
const names = new Map();
let bad = 0;
for (const f of readdirSync(join(DIR, "offers")).filter((n) => n.endsWith(".jsonl")).sort()) {
  for (const line of readFileSync(join(DIR, "offers", f), "utf8").split("\n").filter(Boolean)) {
    const v = JSON.parse(line);
    const prior = perVendorOffers.get(v.vendor_id) ?? new Map();
    for (const raw of v.offers ?? []) prior.set(raw.scope, raw);
    perVendorOffers.set(v.vendor_id, prior);
    names.set(v.vendor_id, v.name);
  }
}
for (const [vendorId, offers] of perVendorOffers) {
  const v = { vendor_id: vendorId, name: names.get(vendorId) };
  {
    const accepted = [];
    for (const raw of offers.values()) {
      const parsed = parseOffer("planner", raw);
      const problems = [];
      if ("error" in parsed) problems.push(`shape: ${parsed.error}`);
      const quote = String(raw.quote ?? "");
      const section = packSections.get(`${v.vendor_id}|${raw.source}`);
      const inPack = section ? norm(section).includes(norm(quote).replace(/ ?… ?/g, " … ")) || norm(section.replace(/\n…\n/g, " ")).includes(norm(quote)) : false;
      const filePath = resolve(ROOT, String(raw.source).replace(/ \(.*\)$/, ""));
      const fileText = existsSync(filePath) ? norm(readFileSync(filePath, "utf8")) : "";
      const inFile = fileText.includes(norm(quote));
      if (!inPack && !inFile) problems.push(section ? "quote not found in pack or file" : "quote not found in source file");
      if (raw.label_quote && !fileText.includes(norm(String(raw.label_quote)))) problems.push("label_quote not found in source file");
      const quoteDigits = quote.replace(/[\s,]/g, "").toLowerCase();
      for (const n of [raw.price_min, raw.price_max].filter((x) => typeof x === "number")) {
        if (!digits(n).some((d) => quoteDigits.includes(String(d).replace(/,/g, "").toLowerCase()))) problems.push(`figure ${n} not in quote`);
      }
      if (raw.basis === "percent_of_budget" && raw.percent != null && !quote.includes(String(raw.percent))) problems.push(`percent ${raw.percent} not in quote`);
      if (problems.length) bad++;
      else accepted.push(raw.scope);
      rows.push({
        name: v.name, vendor_id: v.vendor_id, scope: raw.scope, price_min: raw.price_min ?? "", price_max: raw.price_max ?? "",
        kind: raw.price_kind, basis: raw.basis, percent: raw.percent ?? "", confidence: raw.confidence,
        checks: problems.length ? problems.join("; ") : inFile ? "ok" : "ok (quote spans a pack gap; not verbatim in the file)",
        approve: problems.length ? "no" : FLAGGED[v.name] ? "check" : "yes",
        flag: FLAGGED[v.name] ?? "",
        note: raw.note ?? "", label_quote: raw.label_quote ?? "", quote, source: raw.source, as_of: fetchedAt.get(v.vendor_id)?.slice(0, 10) ?? "",
      });
    }
    perVendor.set(v.vendor_id, { name: v.name, tiers: accepted.length });
  }
}

const cols = ["approve", "flag", "name", "scope", "price_min", "price_max", "kind", "basis", "percent", "confidence", "checks", "note", "label_quote", "quote", "source", "as_of", "vendor_id"];
const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => `"${String(r[c]).replace(/"/g, '""')}"`).join(","))].join("\n");
writeFileSync(join(DIR, "review.csv"), csv);

const v = [...perVendor.values()];
console.log(`planners read: ${v.length}; offers: ${rows.length}; failing checks: ${bad}`);
console.log(`planners with 2+ tiers: ${v.filter((x) => x.tiers >= 2).length}; 1 tier: ${v.filter((x) => x.tiers === 1).length}; none: ${v.filter((x) => x.tiers === 0).length}`);
for (const r of rows.filter((r) => !r.checks.startsWith("ok"))) console.log(`  FAIL ${r.name} ${r.scope}: ${r.checks}`);
console.log(`review: ${join(DIR, "review.csv")}`);
