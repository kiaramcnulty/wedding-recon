#!/usr/bin/env node
/**
 * Executable checks on the journey account-sync rules: which copy wins when a
 * signed-in page loads (`syncDecision` in lib/search/journey-state.ts, used by
 * lib/search/journey-sync.ts), and that a stored journey round-trips through
 * the parser the account copy is read back with. No network, no database.
 *
 *   node scripts/test-journey-sync.mjs
 */
import "./ts-alias.mjs";

const { syncDecision, parseJourney, journeyProgress } = await import("../lib/search/journey-state.ts");

let pass = 0, fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`); }
}

const ME = "user-a";
const OTHER = "user-b";
const at = (updatedAt) => ({ updatedAt });

console.log("which copy wins");
eq("answers given before signing up are adopted by the account",
  syncDecision(at(100), null, null, ME), { dropLocal: false, action: "push" });
eq("a second device with nothing local gets the account copy",
  syncDecision(null, at(100), null, ME), { dropLocal: false, action: "pull" });
eq("a newer account copy replaces an older one here",
  syncDecision(at(100), at(200), ME, ME), { dropLocal: false, action: "pull" });
eq("a newer browser copy goes up",
  syncDecision(at(300), at(200), ME, ME), { dropLocal: false, action: "push" });
eq("identical versions: nothing to do",
  syncDecision(at(200), at(200), ME, ME), { dropLocal: false, action: "none" });
eq("nothing anywhere: nothing to do",
  syncDecision(null, null, null, ME), { dropLocal: false, action: "none" });

console.log("shared devices");
eq("another account's newer journey is dropped, never uploaded",
  syncDecision(at(999), null, OTHER, ME), { dropLocal: true, action: "none" });
eq("another account's journey is dropped and this account's copy pulled",
  syncDecision(at(999), at(1), OTHER, ME), { dropLocal: true, action: "pull" });
eq("an anonymous journey (no owner yet) is adopted",
  syncDecision(at(5), at(1), null, ME), { dropLocal: false, action: "push" });

console.log("Explore filters before signing in");
eq("a never-started copy (Explore filters only) never replaces a real journey",
  syncDecision({ updatedAt: 999, started: false }, { updatedAt: 1, started: true }, null, ME), { dropLocal: false, action: "pull" });
eq("a newer never-started account copy never wipes a real journey here",
  syncDecision({ updatedAt: 1, started: true }, { updatedAt: 999, started: false }, ME, ME), { dropLocal: false, action: "push" });
eq("...unless that browser copy belongs to another account",
  syncDecision({ updatedAt: 1, started: true }, { updatedAt: 999, started: false }, "someone-else", ME), { dropLocal: true, action: "pull" });
eq("a never-started copy still goes up when the account has nothing",
  syncDecision({ updatedAt: 999, started: false }, null, null, ME), { dropLocal: false, action: "push" });
eq("two never-started copies: the newer wins as usual",
  syncDecision({ updatedAt: 999, started: false }, { updatedAt: 1, started: false }, ME, ME), { dropLocal: false, action: "push" });

console.log("account copy round trip");
const journey = {
  version: 1,
  hasVenue: true,
  location: { kind: "venue", label: "Briarhurst Manor", lat: 38.86, lng: -104.9, vendorId: "v1" },
  venueLocation: { kind: "venue", label: "Briarhurst Manor", lat: 38.86, lng: -104.9, vendorId: "v1" },
  weddingMonth: 6,
  weddingYear: 2027,
  selectedVendorType: "photos",
  byType: {
    photos: { budget: 4000, picks: { style: ["documentary"] } },
    dj: { budget: 1500, flags: { includes_mc: true } },
  },
  step: "results",
  status: "completed",
  updatedAt: 1793990000000,
};
// What Postgres hands back for a jsonb column is the same JSON, re-parsed.
const back = parseJourney(JSON.parse(JSON.stringify(journey)));
eq("venue, date, preferences and progress survive the trip", {
  label: back?.venueLocation?.label,
  vendorId: back?.location?.vendorId,
  month: back?.weddingMonth,
  year: back?.weddingYear,
  photos: back?.byType?.photos,
  dj: back?.byType?.dj,
  step: back?.step,
  status: back?.status,
  updatedAt: back?.updatedAt,
}, {
  label: "Briarhurst Manor",
  vendorId: "v1",
  month: 6,
  year: 2027,
  photos: { budget: 4000, picks: { style: ["documentary"] } },
  dj: { budget: 1500, flags: { includes_mc: true } },
  step: "results",
  status: "completed",
  updatedAt: 1793990000000,
});
eq("a journey saved before per-type questions keeps its chips",
  parseJourney({ ...journey, byType: { venue: { budget: 9000, styles: ["garden"] } } })?.byType?.venue,
  { budget: 9000, picks: { setting: ["garden"] } });
eq("answers that are not a filter of the type are dropped",
  parseJourney({ ...journey, byType: { hotel: { budget: 200, picks: { cuisine: ["bbq"], parking: ["valet", "nonsense"] } } } })?.byType?.hotel,
  { picks: { parking: ["valet"] } });
eq("Advanced answers survive the trip",
  parseJourney({ ...journey, byType: { beauty: { budget: 300, flags: { airbrush: true }, limits: { party_price: 150 } }, venue: { day: "friday" } } })?.byType,
  { beauty: { budget: 300, flags: { airbrush: true }, limits: { party_price: 150 } }, venue: { day: "friday" } });
eq("a corrupt account copy is rejected, not applied", parseJourney({ version: 2 }), null);

console.log("progress tracker");
const prog = (step, hasVenue, status = "in_progress") => journeyProgress({ step, hasVenue, status });
eq("welcome, venue answer unknown: step 1 of the longer path", prog("welcome", null), { step: 1, total: 4 });
eq("booked venue: venue search is step 2 of 4", prog("venue", true), { step: 2, total: 4 });
eq("booked venue, picked a town instead: still step 2 of 4", prog("city", true), { step: 2, total: 4 });
eq("booked venue: vendor type is step 3 of 4", prog("category", true), { step: 3, total: 4 });
eq("booked venue: preferences are the last step", prog("prefs", true), { step: 4, total: 4 });
eq("no venue: town is step 2 of 3", prog("city", false), { step: 2, total: 3 });
eq("no venue: preferences are step 3 of 3", prog("prefs", false), { step: 3, total: 3 });
eq("results show no tracker", prog("results", true), null);
eq("next vendor: the type grid is step 1 of 2", prog("category", true, "completed"), { step: 1, total: 2 });
eq("next vendor: preferences are step 2 of 2", prog("prefs", false, "completed"), { step: 2, total: 2 });
eq("editing the place of a finished search shows no tracker", prog("venue", true, "completed"), null);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
