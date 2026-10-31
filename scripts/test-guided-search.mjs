#!/usr/bin/env node
/**
 * Executable checks on the guided search (lib/search/guided.ts): budget and
 * capacity boundaries, the radius ladder, banded distance and the three-card
 * cap. Small hand-built fixtures, no network, no production data.
 *
 *   node scripts/test-guided-search.mjs
 *
 * guided.ts imports through the `@/` path alias, which Node does not know, so
 * a resolve hook maps it onto the repo root before the module is loaded.
 */
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      return next(pathToFileURL(resolve(ROOT, `${specifier.slice(2)}.ts`)).href, context);
    }
    return next(specifier, context);
  },
});

const {
  guidedSelection,
  runGuidedSearch,
  suggestionsOf,
  milesBetween,
  radiusLadder,
  seasonForMonth,
} = await import("../lib/search/guided.ts");

let pass = 0, fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`); }
}

const DENVER = { lat: 39.7392, lng: -104.9903 };
const VAIL = { lat: 39.6403, lng: -106.3742 };
// A point `miles` due north of the anchor (1 degree of latitude ~ 69.05 mi).
const north = (from, miles) => ({ lat: from.lat + miles / 69.05, lng: from.lng });

let n = 0;
function vendor(type, at, filters, extra = {}) {
  n++;
  return {
    id: `v${String(n).padStart(3, "0")}`,
    vendor_type: type,
    lat: at.lat,
    lng: at.lng,
    has_price: filters && filters.price_min != null,
    has_photo: true,
    verified: false,
    approximate: false,
    filters,
    ...extra,
  };
}
const pkg = (min, more = {}) => ({ price_min: min, price_basis: "package", price_kind: "starting_at", ...more });
const verdict = (type, v, sel) => {
  const r = runGuidedSearch([v], type, sel, DENVER, { mode: "manual", miles: 150 });
  return r.ranked.length ? r.ranked[0].rank : -1;
};

console.log("budget and capacity boundaries");
{
  const sel = guidedSelection("venue", { budget: 5000 });
  eq("package 5,000 fits budget 5,000", verdict("venue", vendor("venue", DENVER, pkg(5000)), sel), 1);
  eq("package 5,000 excluded at budget 4,999",
    verdict("venue", vendor("venue", DENVER, pkg(5000)), guidedSelection("venue", { budget: 4999 })), -1);

  const perPerson = vendor("venue", DENVER, { price_min: 100, price_basis: "per_person", capacity_max: 200 });
  eq("$100/person x 150 guests excluded at 14,999",
    verdict("venue", perPerson, guidedSelection("venue", { budget: 14999 }, { guestCount: 150 })), -1);
  eq("$100/person x 150 guests fits 15,000",
    verdict("venue", perPerson, guidedSelection("venue", { budget: 15000 }, { guestCount: 150 })), 1);
  eq("per-person venue with no guest count is partial, not judged at 100",
    verdict("venue", perPerson, guidedSelection("venue", { budget: 15000 })), 0);

  const hourly = vendor("venue", DENVER, { price_min: 1000, price_basis: "per_hour" });
  eq("hourly $1,000 x 5h fits 5,000", verdict("venue", hourly, guidedSelection("venue", { budget: 5000 })), 1);
  eq("hourly $1,000 x 5h excluded at 4,999", verdict("venue", hourly, guidedSelection("venue", { budget: 4999 })), -1);

  const perNight = vendor("venue", DENVER, { price_min: 300, price_basis: "per_night" });
  eq("per-night price on a venue is partial", verdict("venue", perNight, guidedSelection("venue", { budget: 50000 })), 0);

  const g = (cap) => verdict("venue", vendor("venue", DENVER, { capacity_max: cap }), guidedSelection("venue", {}, { guestCount: 150 }));
  eq("capacity 150 seats 150", g(150), 1);
  eq("capacity 149 excluded for 150", g(149), -1);
  eq("capacity 300 seats 150", g(300), 1);
  eq("capacity missing is partial", verdict("venue", vendor("venue", DENVER, {}), guidedSelection("venue", {}, { guestCount: 150 })), 0);

  const photoSel = guidedSelection("photos", { budget: 4000, styles: ["moody"] });
  eq("photographer style + budget match", verdict("photos", vendor("photos", DENVER, pkg(3500, { style: ["moody", "film"] })), photoSel), 1);
  eq("photographer wrong style excluded", verdict("photos", vendor("photos", DENVER, pkg(3500, { style: ["classic"] })), photoSel), -1);
  eq("photographer hourly quote is partial", verdict("photos", vendor("photos", DENVER, { price_min: 300, price_basis: "per_hour", style: ["moody"] }), photoSel), 0);
  eq("empty budget means no filter", Object.keys(guidedSelection("photos", { budget: undefined })).length, 0);
}

console.log("season tiers");
{
  eq("May is peak", seasonForMonth(5), "peak");
  eq("November is shoulder", seasonForMonth(11), "shoulder");
  eq("January is off-peak", seasonForMonth(1), "off");
  const tiered = vendor("venue", DENVER, {
    price_min: 4000, price_basis: "package",
    price_tiers: [{ season: "off", min: 4000 }, { season: "peak", min: 9000 }],
  });
  eq("peak month judged on peak tier", verdict("venue", tiered, guidedSelection("venue", { budget: 6000 }, { weddingMonth: 6 })), -1);
  eq("off-peak month judged on off tier", verdict("venue", tiered, guidedSelection("venue", { budget: 6000 }, { weddingMonth: 1 })), 1);
}

console.log("radius ladder");
{
  eq("venue ladder", radiusLadder("venue"), [25, 50]);
  eq("photos ladder", radiusLadder("photos"), [25, 50, 100, 150]);
  eq("Vail to Denver is ~74 miles", Math.round(milesBetween(VAIL, DENVER)), 74);

  const sel = guidedSelection("venue", { budget: 10000 });
  const at = (miles) => vendor("venue", north(DENVER, miles), pkg(5000));

  const five = [1, 2, 3, 4, 5].map((m) => at(m));
  let r = runGuidedSearch(five, "venue", sel, DENVER, { mode: "auto" });
  eq("five full matches within 25 stays at 25", [r.radiusMiles, r.expanded, suggestionsOf(r).length], [25, false, 3]);

  r = runGuidedSearch([...[1, 2, 3, 4].map(at), ...[30, 31, 32, 33].map(at)], "venue", sel, DENVER, { mode: "auto" });
  eq("venue 4 at 25 + 4 at 50 expands to 50, 8 confirmed", [r.radiusMiles, r.expanded, r.confirmedCount, suggestionsOf(r).length], [50, true, 8, 3]);

  r = runGuidedSearch([30, 40].map(at), "venue", sel, DENVER, { mode: "auto" });
  eq("venue none at 25, two at 50: shows two", [r.radiusMiles, suggestionsOf(r).length], [50, 2]);

  r = runGuidedSearch([at(70)], "venue", sel, DENVER, { mode: "auto" });
  eq("venue never widens past 50", [r.radiusMiles, r.confirmedCount], [50, 0]);

  const partials = [10, 12, 14].map((m) => vendor("venue", north(DENVER, m), {}));
  r = runGuidedSearch(partials, "venue", sel, DENVER, { mode: "auto" });
  eq("zero full but partials: no suggestions, partials kept for the feed", [r.confirmedCount, r.partialCount, suggestionsOf(r).length], [0, 3, 0]);

  r = runGuidedSearch([1, 2, 30, 31, 32, 33].map(at), "venue", sel, DENVER, { mode: "manual", miles: 10 });
  eq("manual 10 miles is honoured, not widened", [r.radiusMiles, r.confirmedCount, r.expanded], [10, 2, false]);

  // Photographers anchored at Vail: the Denver ones are 74 miles away.
  const psel = guidedSelection("photos", { budget: 5000 });
  const denverPhotogs = [0, 1, 2, 3, 4, 5].map((m) => vendor("photos", north(DENVER, m), pkg(3000)));
  r = runGuidedSearch(denverPhotogs, "photos", psel, VAIL, { mode: "auto" });
  eq("Vail-anchored photographers found at 100, not empty", [r.radiusMiles, r.confirmedCount, suggestionsOf(r).length], [100, 6, 3]);

  const far = [0, 1, 2, 3].map((m) => vendor("photos", north(VAIL, 120 + m), pkg(3000)));
  r = runGuidedSearch(far, "photos", psel, VAIL, { mode: "auto" });
  eq("service-area type with 4 at 150 stops at the top step", [r.radiusMiles, r.confirmedCount], [150, 4]);
}

console.log("ranking");
{
  const sel = guidedSelection("photos", { budget: 5000 });
  const centroid = vendor("photos", DENVER, pkg(3000), { id: "zzz-centroid", approximate: true });
  const precise = vendor("photos", north(DENVER, 4), pkg(3000), { id: "aaa-precise" });
  let r = runGuidedSearch([centroid, precise], "photos", sel, DENVER, { mode: "auto" });
  eq("centroid 0.0 mi does not beat a precise vendor in the same band", r.ranked.map((x) => x.id), ["aaa-precise", "zzz-centroid"]);

  const near = vendor("photos", north(DENVER, 1), pkg(3000), { id: "near" });
  const farther = vendor("photos", north(DENVER, 24), pkg(3000), { id: "far" });
  r = runGuidedSearch([farther, near], "photos", sel, DENVER, { mode: "auto" });
  eq("a nearer band still wins", r.ranked.map((x) => x.id), ["near", "far"]);

  const verifiedPartial = vendor("photos", DENVER, {}, { id: "vp", verified: true });
  const unverifiedFull = vendor("photos", north(DENVER, 20), pkg(3000), { id: "uf" });
  r = runGuidedSearch([verifiedPartial, unverifiedFull], "photos", sel, DENVER, { mode: "auto" });
  eq("verified partial stays below an unverified full match", r.ranked.map((x) => x.id), ["uf", "vp"]);

  const verifiedFull = vendor("photos", north(DENVER, 22), pkg(3000), { id: "vf", verified: true });
  r = runGuidedSearch([near, verifiedFull], "photos", sel, DENVER, { mode: "auto" });
  eq("verified full match sorts first within the full tier", r.ranked.map((x) => x.id), ["vf", "near"]);

  const order1 = runGuidedSearch([precise, centroid], "photos", sel, DENVER, { mode: "auto" }).ranked.map((x) => x.id);
  const order2 = runGuidedSearch([centroid, precise], "photos", sel, DENVER, { mode: "auto" }).ranked.map((x) => x.id);
  eq("ties break the same way whatever the input order", order1, order2);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
