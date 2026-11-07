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
import "./ts-alias.mjs";

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

  const photoSel = guidedSelection("photos", { budget: 4000, picks: { style: ["moody"] } });
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

// ---- search-radius ring (lib/map/ring.ts) ----
{
  const { ringCoordinates, zoomToFitRing } = await import("../lib/map/ring.ts");
  const VAIL = { lat: 39.64, lng: -106.37 };
  for (const miles of [25, 50, 100]) {
    const pts = ringCoordinates(VAIL.lng, VAIL.lat, miles);
    const off = Math.max(...pts.map(([lng, lat]) => Math.abs(milesBetween(VAIL, { lat, lng }) - miles)));
    eq(`ring at ${miles} mi: every point within 0.5% of ${miles} mi`, off < miles * 0.005, true);
    eq(`ring at ${miles} mi is closed`, pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1], true);
  }
  eq("ring zoom: a wider ring zooms out", zoomToFitRing(39.6, 100, 390, 600) < zoomToFitRing(39.6, 25, 390, 600), true);
  // 25 mi across ~390px at Denver latitude is about zoom 8.1.
  const z25 = zoomToFitRing(39.7, 25, 390, 600);
  eq("ring zoom: 25 mi on a phone is about zoom 8", z25 > 7.6 && z25 < 8.6, true);
}

// ---- every vendor type (GUIDED_CONTROLS) ----
console.log("every vendor type");
{
  const { GUIDED_CONTROLS, GUIDED_TYPES, hasGuidedQuestions, floralFloor } = await import("../lib/search/guided.ts");
  const { VENDOR_TYPES } = await import("../lib/constants/categories.ts");
  const { filtersForType } = await import("../lib/constants/vendor-filters.ts");
  eq("every selectable type is in the journey", [...GUIDED_TYPES], [...VENDOR_TYPES]);
  eq("hotel blocks and Other ask no questions",
    GUIDED_TYPES.filter((t) => !hasGuidedQuestions(t)), ["hotel", "other"]);
  // Every control names a real filter of the right kind, or the screen shows
  // nothing for it and the matcher ignores the answer.
  const bad = [];
  for (const t of GUIDED_TYPES) {
    const defs = filtersForType(t);
    const kind = (k) => defs.find((d) => d.key === k)?.kind;
    const c = GUIDED_CONTROLS[t];
    if (c.budget && kind(c.budget.key) !== "range") bad.push(`${t}.${c.budget.key}`);
    for (const p of c.picks) if (kind(p.key) !== "multi") bad.push(`${t}.${p.key}`);
    for (const f of c.flags) if (kind(f.key) !== "bool") bad.push(`${t}.${f.key}`);
  }
  eq("every control is a real filter of the right kind", bad, []);

  // Caterers: per guest. A package is divided by the REAL guest count only.
  const perHead = vendor("food", DENVER, { price_min: 60, price_basis: "per_person", price_kind: "starting_at" });
  const minimum = vendor("food", DENVER, { price_min: 6000, price_basis: "package", price_kind: "starting_at" });
  eq("caterer $60/person fits $60/guest", verdict("food", perHead, guidedSelection("food", { budget: 60 })), 1);
  eq("caterer $60/person excluded at $59/guest", verdict("food", perHead, guidedSelection("food", { budget: 59 })), -1);
  eq("caterer package with no guest count is partial",
    verdict("food", minimum, guidedSelection("food", { budget: 50 })), 0);
  eq("caterer $6,000 package / 120 guests = $50 fits $50",
    verdict("food", minimum, guidedSelection("food", { budget: 50 }, { guestCount: 120 })), 1);
  eq("caterer $6,000 package / 100 guests = $60 excluded at $50",
    verdict("food", minimum, guidedSelection("food", { budget: 50 }, { guestCount: 100 })), -1);
  eq("caterer cuisine + service style both apply",
    verdict("food", vendor("food", DENVER, { cuisine: ["bbq"], service_style: ["plated"] }),
      guidedSelection("food", { picks: { cuisine: ["bbq"], service_style: ["buffet"] } })), -1);
  eq("caterer screen never filters on capacity",
    Object.keys(guidedSelection("food", {}, { guestCount: 150 })), []);

  // DJs: an unticked box is "don't care", a ticked one requires it.
  const noMc = vendor("dj", DENVER, { includes_mc: false });
  eq("DJ: unticked emcee box filters nothing", Object.keys(guidedSelection("dj", {})), []);
  eq("DJ: emcee required excludes a DJ who says no", verdict("dj", noMc, guidedSelection("dj", { flags: { includes_mc: true } })), -1);
  eq("DJ: emcee required, DJ silent is partial",
    verdict("dj", vendor("dj", DENVER, {}), guidedSelection("dj", { flags: { includes_mc: true } })), 0);
  eq("DJ hourly quote is partial on a package budget",
    verdict("dj", vendor("dj", DENVER, { price_min: 200, price_basis: "per_hour" }), guidedSelection("dj", { budget: 1500 })), 0);

  // Live music, dress, hair & makeup: their own price fields and units.
  eq("band genre + budget match",
    verdict("band", vendor("band", DENVER, pkg(2000, { genre: ["jazz_swing"] })),
      guidedSelection("band", { budget: 2500, picks: { genre: ["jazz_swing", "latin"] } })), 1);
  eq("dress per-gown price judged per gown",
    verdict("dress", vendor("dress", DENVER, { price_min: 1800, price_basis: "per_gown", price_kind: "starting_at" }),
      guidedSelection("dress", { budget: 1500 })), -1);
  eq("dress in-house alterations required",
    verdict("dress", vendor("dress", DENVER, { in_house_alterations: true }),
      guidedSelection("dress", { flags: { in_house_alterations: true } })), 1);
  const artist = vendor("beauty", DENVER, { bride_price_min: 300, bride_price_max: 450, work_mode: ["on_location"] });
  eq("hair & makeup judged on the bride price", verdict("beauty", artist, guidedSelection("beauty", { budget: 300 })), 1);
  eq("hair & makeup bride price over budget excluded", verdict("beauty", artist, guidedSelection("beauty", { budget: 250 })), -1);
  eq("hair & makeup in-studio only excludes an on-location artist",
    verdict("beauty", artist, guidedSelection("beauty", { picks: { work_mode: ["in_studio"] } })), -1);

  // Planners: the budget is per service tier.
  const dayOf = (offers, tiers) => vendor("planner", DENVER, {
    service_tier: tiers, price_min: 1400, price_basis: "package", price_kind: "starting_at",
    price_offers: offers,
  });
  const offer = (scope, min) => ({ scope, price_min: min, price_kind: "starting_at", basis: "package", quote: "from $x", source: "s", confidence: "high" });
  const psel = guidedSelection("planner", { budget: 2000, picks: { service_tier: ["day_of"] } });
  eq("planner tier scopes the budget", psel.price.scopes, ["day_of"]);
  eq("planner day-of $1,400 within $2,000 matches",
    verdict("planner", dayOf([offer("day_of", 1400), offer("full_planning", 8000)], ["day_of", "full_planning"]), psel), 1);
  eq("planner priced only for full planning is excluded from a day-of search",
    verdict("planner", dayOf([offer("full_planning", 8000)], ["full_planning"]), psel), -1);

  // Florists: a comparable floor, never a bouquet price.
  const fsel = (budget, models) => guidedSelection("flowers", { budget, ...(models && { picks: { engagement_model: models } }) });
  const florist = (f) => vendor("flowers", DENVER, f);
  eq("florist: floor is the larger of price and minimum",
    floralFloor({ price_min: 500, minimum_spend: 3000, price_basis: "package", engagement_model: ["full_service"] }, 2000), 3000);
  eq("florist full-service $3,000 minimum fits $3,000",
    verdict("flowers", florist({ price_min: 2500, minimum_spend: 3000, price_basis: "package", engagement_model: ["full_service"] }), fsel(3000)), 1);
  eq("florist full-service $3,000 minimum excluded at $2,999",
    verdict("flowers", florist({ price_min: 2500, minimum_spend: 3000, price_basis: "package", engagement_model: ["full_service"] }), fsel(2999)), -1);
  eq("florist doing both: a $175 bouquet price never confirms a $5,000 budget",
    verdict("flowers", florist({ price_min: 175, price_basis: "package", engagement_model: ["full_service", "a_la_carte"] }), fsel(5000)), 0);
  eq("florist doing both: a floor over budget still excludes",
    verdict("flowers", florist({ price_min: 8000, minimum_spend: 8000, price_basis: "package", engagement_model: ["full_service", "a_la_carte"] }), fsel(5000)), -1);
  eq("florist per-person price is partial",
    verdict("flowers", florist({ price_min: 150, price_basis: "per_person", engagement_model: ["full_service"] }), fsel(5000)), 0);
  eq("florist $0 minimum proves nothing",
    verdict("flowers", florist({ minimum_spend: 0, engagement_model: ["full_service"] }), fsel(5000)), 0);
  eq("florist: ticking both structures means either (no filter)",
    Object.keys(fsel(undefined, ["full_service", "a_la_carte"])), []);
  eq("florist: a la carte only excludes a full-service-only florist",
    verdict("flowers", florist({ engagement_model: ["full_service"] }), fsel(undefined, ["a_la_carte"])), -1);
  const sel0 = fsel(5000);
  eq("florist floor field is never stored on the vendor", "guided_floral_floor" in florist({ price_min: 1 }).filters, false);
  eq("florist selection reads the derived floor", sel0.price.lo, "guided_floral_floor");

  // No questions: every vendor in range is a match.
  const h = runGuidedSearch([vendor("hotel", DENVER, {}), vendor("hotel", north(DENVER, 10), null)], "hotel",
    guidedSelection("hotel", {}), DENVER, { mode: "auto" });
  eq("hotel blocks: every nearby hotel is a match", [h.confirmedCount, h.partialCount], [2, 0]);
}

// ---- Explore's filter sheet: the couple's guest count, else 100 ----
console.log("explore guest count");
{
  const { filtersForType } = await import("../lib/constants/vendor-filters.ts");
  const { buildSelection, filterRank } = await import("../lib/filters/match.ts");
  const venuePP = { price_min: 150, price_basis: "per_person", price_kind: "starting_at" };
  const catererPkg = { price_min: 6000, price_basis: "package", price_kind: "starting_at" };
  const rank = (t, f, max, guests) =>
    filterRank(f, buildSelection(filtersForType(t, { guests }), { price: { max } }));
  eq("explore: no guest count assumes 100 ($150pp venue = $15,000)", rank("venue", venuePP, 15000), 1);
  eq("explore: 180 guests makes that venue $27,000", rank("venue", venuePP, 15000, 180), -1);
  eq("explore: 180 guests, $27,000 budget fits", rank("venue", venuePP, 27000, 180), 1);
  eq("explore: caterer $6,000 package at 100 guests is $60/guest", rank("food", catererPkg, 59), -1);
  eq("explore: same caterer at 150 guests is $40/guest", rank("food", catererPkg, 40, 150), 1);
  eq("explore: nonsense guest count falls back to 100", rank("venue", venuePP, 15000, -5), 1);
  eq("explore: the note says whose count it is",
    filtersForType("venue", { guests: 180 }).find((d) => d.key === "price").basisNote,
    "Venues quoting per person are shown at 180 guests (your count), per hour at 5 hours.");
  eq("explore: default note unchanged",
    filtersForType("venue").find((d) => d.key === "price").basisNote,
    "Venues quoting per person are shown at 100 guests, per hour at 5 hours.");
  eq("explore: other types ignore the guest count",
    filtersForType("photos", { guests: 180 }) === filtersForType("photos"), true);
}

// ---- partial fill under the suggestions ----
console.log("partial fill");
{
  const { partialFillOf } = await import("../lib/search/guided.ts");
  const res = (full, part) => ({
    ranked: [...Array(full)].map((_, i) => ({ id: `f${i}`, rank: 1 })).concat([...Array(part)].map((_, i) => ({ id: `p${i}`, rank: 0 }))),
    confirmedCount: full, partialCount: part,
  });
  eq("1 match: two partials fill the screen", partialFillOf(res(1, 86)).map((r) => r.id), ["p0", "p1"]);
  eq("0 matches: three partials", partialFillOf(res(0, 5)).length, 3);
  eq("3 matches: no partial section", partialFillOf(res(3, 9)), []);
  eq("fewer partials than slots: all of them", partialFillOf(res(2, 0)), []);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
