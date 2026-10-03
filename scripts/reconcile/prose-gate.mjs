/**
 * THE recon-prose gates - one definition, imported by every path that writes bot
 * recon prose:
 *   - .claude/skills/enrichvendors/scripts/pipeline.mjs  (`status`, the cheap pre-check)
 *   - .claude/skills/enrichvendors/scripts/upload.mjs    (the hard gate before insert)
 *   - scripts/reconcile/daily-mine-apply.mjs (and any reconcile writer) via checkProse()
 *
 * Also here: dossierMarker() (dossier labels echoed into prose) and priceContradiction()
 * (a figure plus "no price posted" on one card). checkProse() runs dossierMarker but NOT
 * priceContradiction, because the reconcile edit guard compares the contradiction before
 * and after an edit (a legacy card may already carry one); enrich calls it directly.
 *
 * Until 2026-10 these regexes were COPIED into all three files with "keep in
 * lockstep" comments. The copies did stay identical, and still about 140 live
 * entries carried a tooling leak: the gate was not run on every write path (the
 * supplemental and reconcile paths, a hand-applied SQL rewrite), and the patterns
 * themselves missed whole families ("site kept 404ing", "returned an error",
 * "the site's a no-go", "couldn't get their site to load", "no quote pulled").
 * One module means a pattern added here reaches every gate at once. Provenance
 * and reasoning for each pattern are inline below.
 *
 * Difference between callers: enrich HARD-FAILS the whole upload on any violation,
 * because a human is about to review the batch. The daily reconcile runs
 * unattended, so a violation DROPS that one entry (it is not inserted) and is
 * reported - never fails the cron, never publishes bad prose.
 */

import { MONEY } from "./lib.mjs";

export { MONEY };

// AI-slop tells; entries containing these must be rephrased before upload.
// Empty-evaluative filler is banned too: judgments must be tied to a number or a sourced fact.
export const BANNED = /\b(stunning|breathtaking|nestled|boasts?|elevate[sd]?|unforgettable|magical|dream wedding|exquisite|picturesque|tucked away gem|genuine value|can't go wrong|won't disappoint|something for everyone|truly special)\b/i;

// Process tells: research-tooling OR pipeline/batch self-references no real couple would
// write. Two families: (1) crawler language - rephrase as a person would ("their site
// does not list pricing"); (2) any hint that this entry is part of a scripted set being
// processed ("from this batch", "the enrichment run", "seeded venues").
// (2026-07-29: pipeline status lacked this entirely, so 21 process-tells sailed through
// it and were only caught at the upload dry-run.)
export const PROCESS = /\b(crawl\w*|scrape\w*|fetch\w*|dossier|harvest\w*|parse\w*|garbled text|boilerplate|batch\w*|enrich\w*|seeded|roster|pipeline|dataset|databases?|bots?|launchintel|digest\w*)\b/i;

// The nouns a fetch failure gets pinned on. Used only as the SUBJECT of a failure verb
// below, never on its own, so "their site says..." and "the pricing page lists..." pass.
const SRC = String.raw`(?:site|page|website|link|pdf|url|sheet|card|guide|menu|brochure|form|listing)s?`;

// Research-artifact narration: describing the SOURCE MATERIAL instead of the vendor. A
// couple writes "they don't post prices anywhere"; only a script writes "reviews go back
// to 2020-2023" or "site didn't load (404)". Added 2026-07-29 - PROCESS missed this whole
// family, so it reached the CO beauty CSV and needed a 76-row rewrite pass.
// The load-failure half must be SUBJECT-AGNOSTIC. Anchoring it to "site|page|website" let
// eight real variants through in the 2026-07-29 CO hotel run, because the subject was a
// PDF, a bare noun, or the failure was named by status code instead of by verb.
// The negation is REQUIRED before `load` so "vendor load-in starts at 9am" survives.
//
// 2026-10 extension (bot-recon quality audit, docs/bot-recon-quality-plan.md item 5).
// Measured against the 3,386 live bot entries: the 2026-07 patterns flag 144, these flag
// ~330. Every added family below was found on live cards; the false positives found while
// tuning are named on the line that avoids them.
const RESEARCH_PARTS = [
  // Status codes incl. "403s"/"403ing"/"404'd"/"404ing" ("site kept 404ing when we tried"
  // slipped past the old `\b404\b`). Not after `$`, a digit or a decimal point, so a $404
  // fee or "1,404 reviews" is not read as an HTTP status.
  /(?<![$\d.,])\b40[34](?!\d)\w*/,
  /\bunreachable\b|\bautomated (check|lookup|request|tool)s?\b/,   // how it failed / who it failed for
  /\b(reviews (go|going) back to|no pricing to pull|nothing to pull)\b/,
  /(?:(?:did|would|could|does|do|will|can)\s*(?:n'?t|not)|failed to|never)\s+load\b(?!\s*-?\s*in\b)/,
  /\bsite (is|was)?\s*(down|unavailable|unreadable|inaccessible)\b/,
  /\b(couldn'?t|could not|can'?t|cannot) (access|reach|open|read) (the |their )?(site|page|website)\b/,
  /\bsite is (a )?dead link\b|\bper (their|the) (site|listing) copy\b/,
  // --- 2026-10 additions ---
  // "Site returned a server error when checked", "the page threw an error every time".
  /\b(?:returned|returns|threw|throws)\s+(?:an?\s+)?(?:\w+\s+)?error\b/,
  // A fetch failure pinned on a source noun: "their site errored out on us", "the page
  // timed out", "pricing page kept failing to open on my end". Needs the noun AND a verb
  // form: bare "error" is out because "Zola shows $10, which has to be a listing error"
  // is a couple's fair reading of a listing; bare "kept erroring" is out because "the
  // booking system kept erroring out" was a guest's review, not our crawl.
  new RegExp(String.raw`\b${SRC}\b[^.;|\n]{0,50}?\b(?:errored|erroring|error(?:s|ed)? out|timed out|timing out|times out|kept failing|kept erroring|kept crashing)\b`),
  // "the pdf rate sheet wouldn't open for us", "site would not come up", "a PDF I didn't
  // open". Pinned to a source noun: "the venue wouldn't open early for setup" is fine.
  new RegExp(String.raw`\b${SRC}\b[^.;|\n]{0,40}?\b(?:wouldn'?t|would not|didn'?t|did not|won'?t|couldn'?t|could not|never)\s+(?:open|work|come up|pull up)\b`),
  /\bfail(?:ed|ing|s)? to (?:load|open)\b/,
  // "couldn't get their pricing page to load" (60+ live hotel cards): the negation is not
  // next to `load`, so the 2026-07 pattern never saw it.
  /\b(?:couldn'?t|could not|can'?t|cannot|never) get\b[^.;|\n]{0,40}?\bto (?:load|open|come up)\b/,
  // "site blocked me halfway through", "their own page blocked our crawler", "Site: blocked".
  // Pinned to a source noun + a first-person/automated object: a site saying "Saturdays
  // are blocked May-Oct" or a hotel that "blocked us 20 rooms" must pass.
  new RegExp(String.raw`\b${SRC}\b[^.;|\n]{0,30}?\bblock(?:ed|ing|s)\s+(?:me|us|our|access|automated)\b|\b(?:was|is|kept) blocking access\b|\bsite:\s*blocked\b`),
  /\b(?:site|page|website)(?:'s| is| was) (?:a )?no-?go\b/,                 // "checked instagram since the site's a no-go"
  /\b(?:site|page|website|link|url)(?: link)? (?:is|was|went) dead\b|\bdead link\b/,
  // A source the DOSSIER truncated, narrated as a flaw of the listing: "the quote gets cut
  // off on the listing" (McArthur, pilot F059), "comment cut off before finishing the
  // thought". A guest "cut off mid question" by staff, or a group "cut off and sent out
  // early", is the vendor's behaviour and must pass, so the cut-off has to be the TEXT's.
  /\b(?:quote|review|comment|text|snippet|excerpt|post)s?\s+(?:\w+\s+){0,2}(?:gets|got|is|was|being)\s+(?:cut off|truncated)\b|\bcut off (?:before (?:finishing|the end)|mid[- ]?(?:sentence|thought|quote|review)|on the (?:listing|page|site))\b|\btruncat\w*/,
  /\bsnippets?\b/,                                                         // "from a search snippet", "available review snippets"
  // "Couldn't get an actual number to check against" (pilot), "no site to check against".
  // Needs a negation first: "without giving a table to check against" describes the vendor.
  /\b(?:couldn'?t|could not|no|nothing|any)\b[^.;|\n]{0,40}?\bto check (?:it )?against\b/,
  // "nothing pulled on pricing", "no quote pulled", "No fresh/new/separate quote pulled"
  // (pilot F066/F140: "pulled" is our fetch, and "fresh"/"separate" quietly points at a
  // sibling entry). A couple says "didn't get a quote".
  /\b(?:nothing|no [\w ]{0,20}?) pulled\b/,
  /\bfirst[- ]party\b|\bweb[- ]aggregated\b/,
  /\bon (?:my|our) pass\b/,
];
export const RESEARCH = new RegExp(RESEARCH_PARTS.map((r) => r.source).join("|"), "i");

// Curly apostrophes and quotes. Every negation above is written with a straight `'`, so
// "wouldn’t load" (typed on a phone, or pasted from a review) would sail past every
// one of them. Gates match on this normalized text; the stored text is never rewritten.
export const gateText = (s) => String(s ?? "").replace(/[‘’ʼ′]/g, "'").replace(/[“”]/g, '"');

export const EMDASH = /[—–]/; // no em/en dashes anywhere in entry text - real users type hyphens

// Literal line-break ESCAPES (backslash + n) where a real break was meant. NOT a gate in
// enrich: upload.mjs repairs it at insert because the fix is unambiguous (2026-08-04).
export const ESCAPES = /\\{1,2}[rnt]/;

// "Quote only" and its family - the retired price_text sentinel (Kiara, 2026-08-07).
// The wording alone is REPAIRED at insert; the phrase next to a money figure in the same
// field is a HARD GATE (what the headline should say instead is editorial).
export const QUOTE_ONLY = /(?:(?:pricing|price|prices|rates?|available|custom|by|on|via|per)\s+)*quotes?[\s-]+only|only\s+(?:available\s+)?(?:by|upon|on|via)\s+quotes?/i;

// --- dossier markers echoed into prose (2026-10 audit) -------------------------
// The 2026-10 dossier.mjs rewrite labels every source with an id and declares every cut
// ("[r3 2026-06 5★]", "[site: page-venues]", "[rest of review omitted]", "SOURCE
// TRUNCATED: ...") so a drafter can attribute a fact and never treat a cut source as whole
// (docs/bot-recon-quality-plan.md items 4 and 17). Those labels are for the drafter only.
// A model copying one onto a card ("per [r3] the coordinator was great", "[rest of
// review omitted]") would print scaffolding to couples, so every write path rejects it.
// Bracketed forms are matched exactly as dossier.mjs writes them; the all-caps marker
// lines are matched case-insensitively because no couple writes "source truncated".
const MARKER_PARTS = [
  /\[(?:r|d|rd)\d+\b[^\]]*\]/,                    // source ids: [r3 2026-06 5★], [d1 launchintel], [rd2]
  /\((?:r|rd|d)\d+\)|\breview r\d+\b|\breddit rd\d+\b/, // the same ids unbracketed: "(r3)", "review r4"
  /\[rest (?:of [^\]]*)?omitted\]/,                  // [rest of review omitted], [rest of home omitted], [rest omitted]
  /\[price passage cut\b[^\]]*\]/,                  // [price passage cut: 4 more lines on page-pricing]
  /\[site: [^\]]*\]/,                                // [site: page-venues]
  /\[other pricing\/offering mentions\]/,
  /\[basis=[a-z_-]+\]|\bbasis=(?:property|region|chain)\b|\bvendor_id=/,
  // Drafting flag tokens ("RICH:<slug>", "THIN:<slug>"...) are for the orchestrator; the
  // 2026-10 cleanup found 19 photographer service_regions ending in "RICH:<slug>".
  /\b(?:RICH|THIN|SHORT|IDENTITY|NOT[A-Z]+!?):\s*[a-z0-9][a-z0-9-]*/,
  /\b(?:source truncated|other acts excluded|identity check(?::? failed)?|site crawl failed|site text thin|site pages unread|no website on file)\b/i,
];
const DOSSIER_MARKER = new RegExp(MARKER_PARTS.map((r) => r.source).join("|"));
const DOSSIER_MARKER_CI = new RegExp(MARKER_PARTS[MARKER_PARTS.length - 1].source, "i");

/** The first dossier label or marker copied into entry text, or null. */
export function dossierMarker(text) {
  const t = gateText(text);
  const m = t.match(DOSSIER_MARKER) || t.match(DOSSIER_MARKER_CI);
  return m ? m[0] : null;
}

// --- MONEY figure + "no price posted" in one card (2026-10 audit) -------------------
// Et Voila: a reconcile edit rewrote the headline to a figure while price_details still
// said no pricing is published, so the card contradicted itself. Fees, deposits and "by
// quote" are deliberately not matched: "from $3,000, exact quote on request" is fine.
// "No WEDDING pricing" is not matched either (dropped 2026-10-02): on enrich drafts it sits
// beside the vendor's real non-wedding rates ("lash extensions $225", "general tours $20
// a person"), which is an honest card, and it made up most first-cut hits across the CO
// workdirs.
// Moved here from evidence.mjs (2026-10-02) so the enrich gates and the reconcile writers
// share one definition.
const NO_PRICE = new RegExp(
  [
    /\bno (?:published |posted |listed |public |online |actual |real )*(?:pric(?:e|es|ing)|rate (?:sheet|card)|rates?|figures?)\b/,
    /\b(?:does ?n[o']?t|do ?n[o']?t|never|won'?t|will not) (?:post|publish|list|share|show|put)\w* (?:up )?(?:any )?(?:actual |public |real )*(?:pric|rate|figure|numbers)/,
    /\bpric(?:e|es|ing) (?:is|are) ?(?:n'?t|not) (?:posted|published|listed|public|online|available)\b/,
    /\bnot (?:posted|published|listed) (?:online|anywhere|publicly)\b/,
  ]
    .map((r) => r.source)
    .join("|"),
  "i",
);

// Only a figure presented as THE VENDOR'S OWN PRICE contradicts "no price posted". Two
// kinds of figure do not, and both are common and honest on enrich drafts. Tuned
// 2026-10-02 on every drafted row of the CO enrich workdirs: the first cut (any figure +
// any no-price phrase) hit 8 rows in dress-colorado d1 alone and ~50 corpus-wide, all of
// them honest; with the exemptions below 2 remain, both a headline stating a third-party
// figure with no attribution (Katie Dawn, Venetucci Farm), which is worth a redraft:
//   - attributed to someone else: "many gowns under $800 per a Google review", "one bride
//     paid about $2,000", "$600-$3k per a regional pricing writeup" (the vendor posts no
//     prices; a third party reported one);
//   - a fee or policy amount rather than a price: "appointments are $0 ... $50 fee if you
//     cancel" on a shop that posts no gown prices.
// Et Voila's headline ("$65 to $85 per person", lifted from a tag) is neither, so it is
// still caught. Attribution is judged on the whole priced FIELD ("a regional guide's the
// only sourced number, $600-3k for in store gowns" splits the two across a comma); the fee
// test per clause, so a fee does not excuse a real price stated beside it.
const THIRD_PARTY = /\b(?:reviews?|reviewers?|reddit\w*|thread|comment(?:er)?s?|brides?|couples?|groom|guests?|people|someone|a friend|zola|knot|weddingwire|yelp|google|guide|write-?up|article|blog|regional|market|listings?|another (?:shop|vendor)|nearby|paid|spent|quoted|cite[sd]?|director(?:y|ies)|comps?|based on|hedg\w*|estimate[sd]?|eventective)\b/i;
// Fee, policy and side-offering amounts, plus figures explicitly for a non-wedding product
// (Brown Palace "self-park about $39/day", a florist's "$150 per one non wedding order",
// an HMUA "$150 trial rate", a salon "membership program is $99 a month").
const FEE_AMOUNT = /\b(?:fees?|deposits?|retainers?|cancel\w*|appointments?|consultations?|tax|tips?|gratuity|parking|self-park|valet|shipping|surcharge|late|insurance|membership|trials?|extra|add-?ons?|upcharge|minimums?|travel|per mile|non[- ]wedding|everyday|birthday|corporate|general (?:salon|menu|services?|rates?|styling))\b|\d\s+(?:more|extra)\b/i;
const ownPriceClause = (field) => {
  const t = gateText(field);
  if (THIRD_PARTY.test(t)) return null;
  return t.split(/[;.|\n]|,\s|\s-(?=\S)/).find((c) => MONEY.test(c) && !FEE_AMOUNT.test(c)) || null;
};

/**
 * A card that states the vendor's own price (a MONEY figure in price_text/price_details
 * that is neither third-party-attributed nor a fee) while one of its fields says no price
 * is posted. Returns a human-readable error, or null.
 */
export function priceContradiction({ price_text, price_details, notes }) {
  const priced = [price_text, price_details].map((t) => t && ownPriceClause(t)).find(Boolean);
  if (!priced) return null;
  for (const [col, val] of [["price_text", price_text], ["price_details", price_details], ["notes", notes]]) {
    const m = unscopedNoPrice(gateText(val));
    if (m) return `card states a figure ("${String(priced).slice(0, 50)}") but ${col} says "${m}" - MONEY + no-price contradiction`;
  }
  return null;
}

// A "no price" that is about ONE THING rather than the vendor is not a contradiction:
// "no price listed for that tier", "no pricing mentioned in either comment", "full
// planning exists as a package too but has no price listed", "hall rentals exist but no
// rates posted". Those made up nearly every remaining hit on the CO drafts (2026-10-02).
// Scoped = followed within a few words by for/beyond/mentioned/..., or preceded in its
// clause by but/though/exists or a sub-offering noun. "the site has no rate sheet" and
// "doesn't post any actual pricing" (Et Voila) stay unscoped.
const SCOPE_AFTER = /^[^.;,|\n]{0,25}?\b(?:for|beyond|besides|except|other than|outside|mentioned|in (?:either|the|those|any|that)|on (?:that|those|this|the))\b/i;
const SCOPE_BEFORE = /\b(?:but|though|although|exists?|other|that|those|these|lighter|additional|add-?ons?|tiers?|options?|rentals?|extras?)\b/i;
function unscopedNoPrice(t) {
  const re = new RegExp(NO_PRICE.source, "gi");
  for (const m of t.matchAll(re)) {
    const after = t.slice(m.index + m[0].length);
    const head = t.slice(0, m.index);
    const clause = head.slice(Math.max(head.lastIndexOf("."), head.lastIndexOf(";"), head.lastIndexOf("|"), head.lastIndexOf("\n"), head.lastIndexOf(" -")) + 1);
    if (SCOPE_AFTER.test(after) || SCOPE_BEFORE.test(clause)) continue;
    return m[0];
  }
  return null;
}

/**
 * The tooling-language verdict for one entry's text: the first PROCESS or RESEARCH match
 * (as {kind, match}), or null. Matching is on gateText(), so curly apostrophes count.
 */
export function toolingTell(text) {
  const t = gateText(text);
  const p = t.match(PROCESS);
  if (p) return { kind: "process-tell", match: p[0] };
  const r = t.match(RESEARCH);
  if (r) return { kind: "research-artifact narration", match: r[0] };
  return null;
}

/** Repair literal line-break escapes to real newlines (as enrich does at insert). */
export function repairBreaks(text) {
  return String(text ?? "").replace(/\\{1,2}r?\\?n/g, "\n");
}

/**
 * Check one drafted entry against the enrich prose gates. Returns an array of
 * human-readable errors (empty = clean). The caller drops any entry with errors.
 */
export function checkProse({ notes, price_text, price_details }) {
  const errors = [];
  if (!notes || !String(notes).trim()) errors.push("empty notes");
  if (!price_text || !String(price_text).trim()) errors.push("price_text is required on every entry");
  if (!price_details || !String(price_details).trim())
    errors.push("price_details is required on every entry");

  const text = gateText(`${price_text ?? ""} ${price_details ?? ""} ${notes ?? ""}`);
  const banned = text.match(BANNED);
  if (banned) errors.push(`banned marketing/AI phrase "${banned[0]}"`);
  const tell = text.match(PROCESS);
  if (tell) errors.push(`process-tell "${tell[0]}"`);
  const artifact = text.match(RESEARCH);
  if (artifact) errors.push(`research-artifact narration "${artifact[0]}"`);
  if (EMDASH.test(text)) errors.push("em/en dash in entry text");
  if (ESCAPES.test(text)) errors.push("literal line-break escape in entry text");
  const marker = dossierMarker(text);
  if (marker) errors.push(`dossier label/marker copied into the entry "${marker}"`);

  // Per field: a quote-only headline that also states a figure contradicts itself.
  for (const [col, val] of [["price_text", price_text], ["price_details", price_details]]) {
    if (val && QUOTE_ONLY.test(val) && MONEY.test(val))
      errors.push(`${col} says pricing is quote-only but states a figure ("${String(val).slice(0, 60)}")`);
  }
  return errors;
}
