#!/usr/bin/env node
/**
 * Checks on the per-service price offer shape (lib/filters/price-offers.ts):
 * what `parseOffer` accepts, what it rejects, and that absent stays absent.
 *
 *   node scripts/test-price-offers-shape.mjs
 */
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) return next(pathToFileURL(resolve(ROOT, `${specifier.slice(2)}.ts`)).href, context);
    return next(specifier, context);
  },
});
const { parseOffer, offerFor } = await import("../lib/filters/price-offers.ts");

let pass = 0, fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`); }
}
const base = { scope: "day_of", price_min: 1400, price_kind: "single_figure", basis: "package", quote: "Investment $1400", source: "x.txt", confidence: "high" };
const err = (o) => ("error" in parseOffer("planner", o) ? parseOffer("planner", o).error : "accepted");

eq("valid single figure accepted", err(base), "accepted");
eq("nulls are dropped, not kept as null", Object.keys(parseOffer("planner", { ...base, price_max: null, percent: null }).offer), ["scope", "price_min", "price_kind", "basis", "quote", "source", "confidence"]);
eq("label_quote kept", parseOffer("planner", { ...base, label_quote: "Day-Of Coordination" }).offer.label_quote, "Day-Of Coordination");
eq("unknown scope rejected", err({ ...base, scope: "elopement" }), "unknown scope elopement");
eq("negative price rejected", err({ ...base, price_min: -5 }), "price_min not a nonnegative number");
eq("reversed range rejected", err({ ...base, price_kind: "range", price_min: 5000, price_max: 3000 }), "price_max below price_min");
eq("range without max rejected", err({ ...base, price_kind: "range" }), "range needs min and max");
eq("starting_at with a max rejected", err({ ...base, price_kind: "starting_at", price_max: 9000 }), "starting_at has no max");
eq("no price rejected", err({ ...base, price_min: undefined }), "no price");
eq("missing quote rejected", err({ ...base, quote: "" }), "missing quote");
eq("percent of budget needs a percent", err({ ...base, basis: "percent_of_budget", price_min: undefined }), "percent_of_budget needs a percent 0-100");
eq("percent of budget with dollar minimum accepted", err({ ...base, basis: "percent_of_budget", percent: 10, price_min: 6500, price_kind: "starting_at" }), "accepted");
eq("offerFor finds the scope", offerFor({ price_offers: [base, { ...base, scope: "full_planning" }] }, "full_planning")?.scope, "full_planning");
eq("offerFor with no offers", offerFor({ price_min: 3000 }, "day_of"), undefined);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
