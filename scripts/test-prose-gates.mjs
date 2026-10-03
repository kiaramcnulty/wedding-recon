#!/usr/bin/env node
/**
 * Tests for the bot-recon gates: the shared prose gate (scripts/reconcile/prose-gate.mjs)
 * and the research-backed checks (.claude/skills/enrichvendors/scripts/provenance.mjs).
 *
 *   node scripts/test-prose-gates.mjs
 *
 * Every positive below is a phrase that reached a live card before 2026-10 (the bot-recon
 * quality audit); every negative is ordinary couple language the gates must let through.
 * A pattern change that breaks either side is a regression on real data.
 */
import { toolingTell, checkProse, dossierMarker, priceContradiction } from "./reconcile/prose-gate.mjs";
import { guardProseEdit, tagBasisProblem, priceContradiction as evPriceContradiction } from "./reconcile/evidence.mjs";
import {
  absenceClaims, siteUnread, contaminationHits, parseCallFile,
  planDateMoves, sourceFloor, BOT_CAP, dossierBackground, reviewsUsed, identityBlocked,
} from "../.claude/skills/enrichvendors/scripts/provenance.mjs";

let passed = 0;
let failed = 0;
function ok(name, cond) {
  if (cond) passed++;
  else {
    failed++;
    console.error("FAIL:", name);
  }
}

// ── tooling language (plan item 5) ──
const leaks = [
  "No quote found, no pricing available since the site wouldn't load", // Audra Rose, pilot F001
  "their site pricing page would not load for us (site kept 403ing)",
  "-site kept 404ing when we tried to check pricing",
  "checked instagram (@x) since the site's a no-go",
  "the site that's supposed to be theirs actually crawled to a DIFFERENT Fairmount Cemetery",
  "though the quote gets cut off on the listing so no more specifics than that", // McArthur F059
  "Couldn't get an actual number to check against.",
  "site wouldn’t load", // curly apostrophe
  "Site returned a server error when checked",
  "Their site errored out on us, no rate info",
  "couldn't get the hotel's site to load",
  "No fresh quote pulled, reviews back up the $600+ starting packages", // F066
  "-nothing pulled beyond consultation-based booking", // F140
  "the page timed out when I tried it",
  "site blocked me halfway through",
  "a pdf rate sheet linked on their site wouldn't open for us",
  "my pricing came from a search snippet not the live site",
];
for (const s of leaks) ok(`tooling leak caught: ${s}`, !!toolingTell(s));
const fine = [
  "the venue's website has a pricing page with three tiers",
  "their site says Saturdays in June are blocked for corporate events",
  "vendor load-in starts at 9am",
  "guests can load in through the side door",
  "the hotel blocked us 20 rooms at a group rate",
  "Zola shows $10 which has to be a listing error, ask them directly",
  "a guest said the booking system kept erroring out and the front desk fixed it",
  "one review said staff cut off a guest mid question because the office closes at 10",
  "a 1 star review complained their group was cut off and sent out early",
  "without giving a table to check against ahead of time",
  "their pricing page lists a $404 cleaning fee",
  "4.8 stars across 1,403 reviews",
  "the venue wouldn't open early for our setup crew",
  "they pulled off a 200 guest wedding in the rain",
  "per their FAQ the deposit is 50%",
  "they wouldn't work with outside caterers",
];
for (const s of fine) ok(`couple language passes: ${s}`, !toolingTell(s));
ok("checkProse reports the research narration", checkProse({ notes: "site kept 404ing", price_text: "No quote found", price_details: "x" }).some((e) => /research-artifact/.test(e)));

// ── absence claims on an unread site (item 6) ──
ok("SITE CRAWL FAILED marks the site unread", siteUnread("# X\nsite=https://x.com | google 4★ × 3 | SITE CRAWL FAILED (HTTP 403)") === "SITE CRAWL FAILED");
ok("site=none marks the site unread", siteUnread("# X\nsite=none | google 4★ × 3") === "site=none");
ok("a read site is not unread", siteUnread("# X\nsite=https://x.com | google 4★ × 3") === null);
for (const s of ["no pricing posted anywhere", "nothing on their site about weddings", "their site doesn't mention weddings", "this is not a wedding venue", "no site to check for rates"])
  ok(`absence claim caught: ${s}`, absenceClaims(s).length > 0);
for (const s of ["No quote found", "none of the reviews mention weddings", "reddit had nothing anywhere on pricing", "a $50 no-show fee is posted"])
  ok(`not an absence claim about the vendor: ${s}`, absenceClaims(s).length === 0);

// ── cross-vendor contamination (item 17b): the d1-call-02 "1970s" case ──
{
  const call = [
    "# Draft call\nrules about weddings and gowns",
    "=== BRIDAL SHOP: d'Anelli Bridal | vendor_id=11111111-1111-1111-1111-111111111111 | entries=1 | entry1: bot=bot1 date=8/2025 ===",
    "- (5★ 2026-03) Elena did a redesign of my mother's wedding dress using the original fabric.",
    "=== BRIDAL SHOP: Donna Beth Creations | vendor_id=22222222-2222-2222-2222-222222222222 | entries=1 | entry1: bot=bot2 date=9/2025 ===",
    "- (5★ 2025-08) They did a vintage custom-redesign of my mom's 1970s wedding gown into a flirty modern look.",
    "OUTPUT FILE: x.jsonl",
  ].join("\n");
  const { header, blocks } = parseCallFile(call);
  ok("call file parses two vendor blocks", blocks.length === 2 && /rules/.test(header));
  const [own, sib] = blocks;
  const hits = contaminationHits("alterations tech elena did a full redesign of a bride's mom's 1970s gown", own.text, [sib], header);
  ok("the sibling's 1970s is flagged", hits.some((h) => h.phrase === "1970s" && h.siblings[0] === "Donna Beth Creations"));
  ok("the vendor's own facts are not flagged", contaminationHits("elena redesigned a mother's wedding dress with the original fabric", own.text, [sib], header).length === 0);
}

// ── date floor (item 2) ──
{
  const reviews = [
    { ym: 2026 * 12 + 4, when: "2026-05", text: "Pool area is not extravagant but a very pleasant place to hang out. Courtyard is a nice touch." },
    { ym: 2025 * 12 + 9, when: "2025-10", text: "Parking was easy and check in was quick." },
  ];
  const f = sourceFloor("one recent review from may 2026 said the pool was fine", reviews);
  ok("a named month-year next to 'review' sets the floor", f.floor && f.floor.month === 5 && f.floor.year === 2026);
  ok("a wedding date is not a source date", sourceFloor("our date is june 2027, booking now", reviews).floor === null);
  const plan = planDateMoves([
    { key: "a", vendor_id: "v", month: 3, year: 2025, text: "one review flagged the pool area as not extravagant but fine to hang out at" },
    { key: "b", vendor_id: "v", month: 4, year: 2025, text: "a recent review from may 2026 said the pool is fine" },
    { key: "c", vendor_id: "v", month: 6, year: 2026, text: "nothing dated here" },
  ], { reviewsFor: () => reviews, ceilingFor: () => ({ month: 7, year: 2026 }) });
  const to = Object.fromEntries(plan.moves.map((m) => [m.key, `${m.to.month}/${m.to.year}`]));
  ok("both anachronistic siblings move forward", to.a && to.b);
  ok("siblings land on distinct months, skipping the unmoved sibling's 6/2026", new Set(Object.values(to)).size === 2 && !Object.values(to).includes("6/2026"));
  ok("never past the harvest month", Object.values(to).every((d) => { const [m, y] = d.split("/").map(Number); return y * 12 + m <= 2026 * 12 + 7; }));
  ok("an entry with no dated source never moves", !to.c);
}

// ── dossier formats (both must parse: old dossiers stay on disk for live re-checks) ──
{
  const oldDossier = [
    "# Shop (Denver) \u2014 vendor_id=x",
    "site=https://x.com | google 4.8\u2605 \u00d7 41",
    "## google reviews (top 3)",
    "- (5\u2605 2026-05) Mrs. Patty stayed late so we could try on gowns after work.",
    "## watch-outs (sourced negatives)",
    "- (review) The fitting room was cramped.",
    "## region pricing digests",
    "- [launchintel] Shop sells sample gowns under $1200",
  ].join("\n");
  const bg = dossierBackground(oldDossier);
  ok("old format: review lines stripped", !/Patty|cramped/.test(bg));
  ok("old format: digest line kept", /sample gowns/.test(bg));
  const newDossier = [
    "# Lionsgate (Lafayette) \u2014 vendor_id=y",
    "SOURCE TRUNCATED: review r4 \u2014 shown in part only.",
    "## google reviews (5 on file of 653 total; id, month, stars)",
    "- [r4 2026-06 5\u2605] Alaina was exceptional throughout the planning. [rest of review omitted]",
    "- [r1 ~2025-12 ?\u2605] I photographed here and the getting ready spaces are spacious.",
    "- [r2 undated 4\u2605] The garden roses at sunset were lovely.",
    "## watch-outs (sourced negatives/caveats only; quote or paraphrase, never escalate)",
    "- [r3 2026-03 2\u2605] Parking filled up early.",
    "- [d1 launchintel] the barn runs hot in July",
    "## region pricing digests",
    "- [d1 launchintel] Lionsgate packages start around $18,000",
    "## reddit",
    "--- [rd1] reddit-04.txt: [r/Denver \u2014 venues] [basis=property]",
    "Sent them a request, under 50,000 budget",
  ].join("\n");
  const nbg = dossierBackground(newDossier);
  ok("new format: [rN ...] review lines stripped (reviews and watch-outs)", !/Alaina|getting ready|garden roses|Parking filled/.test(nbg));
  ok("new format: digest [dN] and reddit [rdN] lines kept", /barn runs hot/.test(nbg) && /18,000/.test(nbg) && /50,000 budget/.test(nbg));
  // A word that lives in the vendor's own non-review research is not evidence that a
  // REVIEW was used (the background test), for the new format too.
  const reviews = [{ ym: 2026 * 12 + 5, when: "2026-06", text: "Alaina was exceptional throughout the planning, coordination worth it." }];
  ok("new format: a review-only phrase still counts as used", reviewsUsed("alaina was exceptional throughout planning", reviews, null, nbg).length === 1);
  ok("identity: marker line blocks", !!identityBlocked("# X\nIDENTITY CHECK: FAILED \u2014 out-of-state address \"Newark, NJ 07107\". The website on file likely belongs to someone else."));
  ok("identity: the reason is carried", /Newark/.test(identityBlocked("# X\nIDENTITY CHECK: FAILED \u2014 out-of-state address Newark, NJ 07107. More text")));
  ok("identity: no marker, no dir -> not blocked", identityBlocked(newDossier) === null);
  ok("identity: the marker must start a line", identityBlocked("# X\nnotes: IDENTITY CHECK: FAILED") === null);
}

// ── dossier markers must never reach prose (2026-10 dossier rewrite) ──
const markerLeaks = [
  "Alaina was great [rest of review omitted]",
  "per [r3 2026-06 5\u2605] the coordinator was great",
  "a review (r4) says the barn runs hot",
  "review r4 says the barn runs hot",
  "[site: page-venues] three venues on one estate",
  "[price passage cut: 4 more lines on page-pricing]",
  "[other pricing/offering mentions] linens included",
  "the digest line [d2 zola] puts it at $6k",
  "reddit [rd1] said under 50k",
  "SOURCE TRUNCATED so not sure about the rest",
  "OTHER ACTS EXCLUDED from the agency page",
  "Source truncated, but the gist is clear",
  "reddit chunk [basis=region] says blocks are free",
];
for (const s of markerLeaks) ok(`dossier marker caught: ${s}`, !!dossierMarker(s));
const markerFine = [
  "Alaina was great, the rest of the review is about the food",
  "they have three rooms (R1 to R3 on the floor plan)",
  "the D1 lot fills up early",
  "[Edit: we booked them]",
  "Package 3 runs $4,200",
  "the site lists rooms 101-120 for the block",
];
for (const s of markerFine) ok(`not a dossier marker: ${s}`, !dossierMarker(s));
ok("checkProse reports a dossier marker", checkProse({ notes: "great [rest of review omitted]", price_text: "No quote found", price_details: "x" }).some((e) => /dossier label/.test(e)));

// ── price contradiction: one definition, shared (prose-gate.mjs; evidence.mjs re-exports) ──
ok("evidence.mjs re-exports the prose-gate priceContradiction", evPriceContradiction === priceContradiction);
ok("figure + 'no pricing posted' is a contradiction", !!priceContradiction({ price_text: "$65 to $85 per person", price_details: "their site has no published pricing", notes: "" }));
ok("figure + 'doesn't post any actual pricing' in notes", !!priceContradiction({ price_text: "$65/pp", price_details: "per their menu", notes: "they don\u2019t post any actual pricing" }));
ok("figure + 'exact quote on request' is fine", priceContradiction({ price_text: "From $3,000", price_details: "exact quote on request", notes: "" }) === null);
ok("third-party figure + 'no pricing posted' is honest", priceContradiction({ price_text: "many gowns under $800 per a Google review", price_details: "no rate card on their site", notes: "" }) === null);
ok("fee amount + 'no pricing posted' is honest", priceContradiction({ price_text: "No quote found", price_details: "site doesn't post per-dress pricing, appointments are $0, $50 fee if you cancel late", notes: "" }) === null);
ok("scoped 'no price listed for that tier' is honest", priceContradiction({ price_text: "Signature package starts at $9,500", price_details: "a lighter tier exists, no price listed for that one", notes: "" }) === null);
ok("unattributed headline + 'doesn't publish pricing' still fails", !!priceContradiction({ price_text: "$6,000-$8,800 per wedding", price_details: "Their own site doesn't publish pricing directly", notes: "" }));
ok("no figure, no contradiction", priceContradiction({ price_text: "No quote found", price_details: "no published pricing", notes: "" }) === null);

// ── a gated phrase in a reconcile append is reported ONCE (gate.mjs used to double it) ──
{
  const before = { notes: "Nice barn.", price_text: "$5,000", price_details: "site fee" };
  const after = { ...before, notes: "Nice barn. The views are stunning." };
  const errs = guardProseEdit(before, after, "The views are stunning.");
  ok("one banned-phrase error for one 'stunning'", errs.filter((e) => /stunning/.test(e)).length === 1);
}

// ── tag basis (plan item 15), shared by reconcile and enrich ──
ok("brand wording in the quote blocks a tag", !!tagBasisProblem("any Marriott property will hold a courtesy block"));
ok("brand wording in the surrounding sentence blocks a tag", !!tagBasisProblem("courtesy block", { prose: "Like any Hilton, they do a courtesy block with no attrition. Parking is $20." }));
ok("reddit-based sentence with only region-level reddit blocks a tag", !!tagBasisProblem("no attrition", { prose: "A reddit thread said there is no attrition.", redditSlice: "--- reddit (r/Denver) [basis=region]\nblocks are usually courtesy" }));
ok("reddit-based sentence with a property-level excerpt passes", tagBasisProblem("no attrition", { prose: "A reddit thread said there is no attrition.", redditSlice: "--- reddit (r/Denver) [basis=property]\nthis hotel did no attrition" }) === null);
ok("a property fact with no reddit or brand wording passes", tagBasisProblem("shuttle to the venue", { prose: "Their site says they run a shuttle to the venue.", redditSlice: "--- reddit (r/Denver) [basis=region]\nx" }) === null);

ok("bot cap is 3 (Kiara, 2026-10-02)", BOT_CAP === 3);

console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

// 2026-10 cleanup: drafting flag tokens leaked into service_region
{
  const { dossierMarker: dm } = await import("./reconcile/prose-gate.mjs");
  const cases = [["Colorado + destination RICH:tayler-carlisle-photography", true], ["Denver metro + 100 miles", false], ["rich colors, thin crust", false]];
  for (const [t, want] of cases) {
    const got = Boolean(dm(t));
    if (got !== want) { console.error(`FAIL drafting-flag marker: ${t} -> ${got}`); process.exitCode = 1; } else console.log(`  ok   drafting-flag marker: ${t.slice(0, 40)}`);
  }
}
