// Source-provenance checks for drafted (or live) bot recon entries: the checks that need
// the RESEARCH an entry was drafted from, not just its text. Text-only prose gates live in
// scripts/reconcile/prose-gate.mjs; these sit beside them because they need a dossier, a
// harvest.json or a call file. All pure functions over strings/objects, no DB, no network,
// so the same code runs in `pipeline.mjs status|merge`, in `upload.mjs`, and in the
// live-corpus remediation sweep (docs/bot-recon-quality-plan.md items 2, 6, 17b).
//
//   planDateMoves()        item 2   collected date earlier than the newest source it uses
//   siteUnread() +
//   absenceClaims()        item 6   "nothing on their site" when no site was ever read
//   contaminationHits()    item 17b a fact from a SIBLING vendor's block in the same call file
//   BOT_CAP                item 11  max bot entries per vendor, live + run
//   identityBlocked()      item 7   the crawled site belongs to a different business
import fs from 'node:fs';
import path from 'node:path';
import { norm } from '../../launchvendors/scripts/lib.mjs';
import { gateText } from '../../../../scripts/reconcile/prose-gate.mjs';

// Max BOT entries per vendor, counting LIVE bot entries plus the run being drafted or
// uploaded; real users' entries do not count (Kiara, 2026-10-02). 37 vendors carried 4-6
// bot entries because the cap was only ever checked within one run, and --supplemental
// topped up vendors that already had three. Enforced in pipeline.mjs batch + upload.mjs.
export const BOT_CAP = 3;

// Research dirs are slugged by vendor NAME (harvest.mjs / dossier.mjs / pipeline.mjs).
export const slugOf = (s) => norm(s).replace(/ /g, '-').slice(0, 60);

// ── tokenizing ────────────────────────────────────────────────────────────────
// Lowercase words with apostrophes dropped ("mom's" -> "moms") and thousands separators
// folded ("$1,500" -> "1500"), so a figure or phrase matches however it was punctuated.
export function words(s) {
  return gateText(s).toLowerCase()
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/(\d)\.00\b/g, '$1')                  // "$350.00" on a site = "$350" in an entry
    .replace(/'/g, '')
    .replace(/&/g, ' and ')
    .match(/[a-z0-9]+(?:\.\d+)?/g) || [];
}
const wordString = (s) => ` ${words(s).join(' ')} `;

// Function words plus the wedding-generic vocabulary EVERY vendor's research shares. A
// phrase made only of these says nothing about which source it came from.
const STOP = new Set(`a an the and or but if so of to in on at by for from with without into onto over under about
after before during between through than then too very really just also even only still yet again ever never
is are was were be been being am do does did done doing have has had having will would could should can may
might must shall i me my we us our you your he him his she her it its they them their this that these those
there here what which who whom whose when where why how all any both each few more most other some such no
nor not own same s t don didnt doesnt dont wasnt werent isnt arent couldnt wouldnt shouldnt cant wont ive
im youre theyre were weve theyve its thats one two three lot lots much many well get got gets go going went
make made said says say told like back up out off down way thing things time times day days per around
wedding weddings bride brides groom couple couples guest guests venue vendor vendors price prices pricing
package packages quote quotes site website page review reviews reviewer reddit google event events great
good nice best love loved amazing beautiful recommend recommended highly team staff service services
experience everything everyone made make sure definitely absolutely would will
warm welcoming atmosphere friendly helpful kind sweet professional fun easy perfect wonderful fantastic
awesome super felt feel feeling incredible lovely gorgeous happy whole entire overall`.split(/\s+/));
const isContent = (w) => !STOP.has(w) && (w.length >= 3 || /\d/.test(w));

function shingles(ws, n = 4, minContent = 2) {
  const out = new Set();
  for (let i = 0; i + n <= ws.length; i++) {
    const g = ws.slice(i, i + n);
    if (g.filter(isContent).length >= minContent) out.add(g.join(' '));
  }
  return out;
}

// ── date floor (item 2) ───────────────────────────────────────────────────────
// Batch pre-assigns each entry a hashed 1-18-months-back collected date BEFORE drafting,
// blind to the sources, and the contract left "a real source date wins" to the drafter,
// who rarely applied it. The 2026-10 pilot found most vendors carrying an entry dated
// before a review it quotes (Courtyard by Marriott Boulder: a 4/2025 card citing "a recent
// review from may 2026"; Urban Cowboy dated 1/2025, its only anecdote a 2026-01 review).
// Kiara's ruling (2026-10-02): move such dates FORWARD automatically, to the month of the
// newest source the entry actually uses, never past the harvest month, keeping sibling
// entries of one vendor on distinct months.

const MONTH = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONTH_RE = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
// A month-year counts as a SOURCE date only next to a source word. "our date is june
// 2027" or "2026 rates" is about the wedding or the price list, not when a source was
// written, and must not drag the collected date anywhere.
const SOURCE_WORD = String.raw`(?:review(?:s|er|ers|ed)?|post(?:s|ed)?|comment(?:s|er)?|thread|reddit|google|wrote|said|says|rated|rating)`;
const MONTH_NEAR_SOURCE = [
  new RegExp(String.raw`\b${SOURCE_WORD}\b[^.;|\n]{0,40}?\b${MONTH_RE}\.?,?\s+(?:of\s+)?(20\d\d)\b`, 'gi'),
  new RegExp(String.raw`\b${MONTH_RE}\.?,?\s+(?:of\s+)?(20\d\d)\b[^.;|\n]{0,25}?\b${SOURCE_WORD}\b`, 'gi'),
];
const YEAR_NEAR_SOURCE = [
  new RegExp(String.raw`\b(20\d\d)\s+(?:google\s+|yelp\s+|reddit\s+|knot\s+)?(?:review|reviewer|post|comment|thread)s?\b`, 'gi'),
  new RegExp(String.raw`\b(?:review|reviewer|post|comment|thread)s?\s+(?:from|in|dated|back in)\s+(?:early\s+|late\s+|mid\s+)?(20\d\d)\b`, 'gi'),
];
const ym = (y, m) => y * 12 + (m - 1);
const fromYm = (n) => ({ year: Math.floor(n / 12), month: (n % 12) + 1 });
const fmt = (d) => `${d.month}/${d.year}`;

/** Dated Google reviews from a harvest.json object: [{ym, when:'YYYY-MM', text}]. */
export function reviewsFromHarvest(h) {
  return (h?.google?.reviews || [])
    .map((r) => { const m = /^(\d{4})-(\d{2})/.exec(r.when || ''); return m && r.text ? { ym: ym(+m[1], +m[2]), when: r.when, text: r.text } : null; })
    .filter(Boolean);
}

/** The latest month an entry may claim: the harvest month (or today), whichever is earlier. */
export function harvestCeiling(h, now = new Date()) {
  const today = ym(now.getUTCFullYear(), now.getUTCMonth() + 1);
  const f = h?.fetched_at ? new Date(h.fetched_at) : null;
  const hv = f && !isNaN(f) ? ym(f.getUTCFullYear(), f.getUTCMonth() + 1) : today;
  return fromYm(Math.min(hv, today));
}

// Crude stem so "coached"/"coaching" and "balcony"/"balconies" meet. Only for the
// rare-word overlap below, never for the exact-phrase test.
const stem = (w) => w.length > 5 ? w.replace(/(?:ies|ied)$/, 'y').replace(/(?:ing|ed|es|s|ly)$/, '') : w;

/**
 * Document frequency of stemmed content words over a corpus of review texts (every review
 * in the workdir, or in the whole live export). Pass the result to reviewsUsed/sourceFloor
 * /planDateMoves as `df`: a word is RARE when under 1% of reviews use it. Without a df the
 * rarity test falls back to "in no other review of this vendor", which with only five
 * reviews per vendor lets everyday words ("sales", "call", "beyond") through, so it then
 * asks for three such words instead of two.
 */
export function buildDocFreq(texts) {
  const df = new Map();
  for (const t of texts) for (const w of new Set(words(t).filter(isContent).map(stem))) df.set(w, (df.get(w) || 0) + 1);
  return { df, n: texts.length };
}

/**
 * buildDocFreq over EVERY harvest.json under <workdir>/research. merge and upload must
 * judge rarity against the same corpus or they disagree about which review an entry used
 * (a first cut built it from each command's own vendor list, and upload then rejected four
 * dates merge had just set). The workdir's research dir is the one corpus both can see.
 */
export function workdirDocFreq(workdir) {
  const dir = path.join(workdir, 'research');
  const texts = [];
  if (fs.existsSync(dir)) for (const slug of fs.readdirSync(dir)) {
    const p = path.join(dir, slug, 'harvest.json');
    if (!fs.existsSync(p)) continue;
    try { texts.push(...reviewsFromHarvest(JSON.parse(fs.readFileSync(p, 'utf8'))).map((r) => r.text)); } catch { /* a broken harvest is health's job */ }
  }
  return buildDocFreq(texts);
}

// A review line in either dossier format. Old dossiers (before the 2026-10 dossier.mjs
// rewrite, still on disk under every 2026-07 workdir and needed to re-check live entries):
// `- (5★ 2025-12) text` in the reviews section and `- (review) text` in watch-outs. New
// dossiers label every review with a stable id, in both sections:
// `- [r3 2025-12 5★] text` (the month may be `~2025-12` or `undated`, stars may be `?★`).
// Digest `- [d1 tag]` and reddit `--- [rd1] ...` lines are NOT reviews and stay.
const REVIEW_LINE = /^\s*-\s*(?:\((?:\d(?:\.\d)?★[^)]*|review)\)|\[r\d+ )/;

/**
 * A dossier with its review quotes removed (see REVIEW_LINE for both formats): what the
 * vendor's research says OTHER than reviews.
 */
export function dossierBackground(dossierText) {
  return String(dossierText || '').split('\n').filter((l) => !REVIEW_LINE.test(l)).join('\n');
}

// ── identity gate (plan item 7) ───────────────────────────────────────────────
// dossier.mjs runs identity.mjs and, on a flag, writes `IDENTITY CHECK: FAILED` as a line
// of the dossier plus research/<slug>/identity.json {flagged:true}. Either one blocks the
// vendor: batch skips it, status and upload fail any drafted row for it. The pilot found
// 3 of 27 vendors drafted from the wrong business's site (Fairmount Cemetery: a cemetery
// in Newark, NJ). KEEP THE LITERAL IN SYNC WITH dossier.mjs.
export const IDENTITY_FAILED_RE = /^IDENTITY CHECK: FAILED/m;

/**
 * Why this vendor's research is identity-blocked, or null. `dir` is its research dir
 * (reads identity.json there when present); `dossierText` the dossier already read.
 */
export function identityBlocked(dossierText, dir = null) {
  if (IDENTITY_FAILED_RE.test(dossierText || '')) {
    const line = String(dossierText).split('\n').find((l) => IDENTITY_FAILED_RE.test(l)) || '';
    return line.replace(/^IDENTITY CHECK: FAILED\s*[—-]?\s*/, '').split('. ')[0].slice(0, 160) || 'IDENTITY CHECK: FAILED';
  }
  if (dir) {
    const p = path.join(dir, 'identity.json');
    if (fs.existsSync(p)) {
      try {
        const j = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (j?.flagged) return `identity.json flagged: ${(j.reasons || []).join('; ').slice(0, 160)}`;
      } catch { /* unreadable sidecar: the dossier marker is the primary signal */ }
    }
  }
  return null;
}

/**
 * Which dated reviews does this entry text actually use? A review counts when the entry
 * shares a DISTINCTIVE phrase with it (a 4-word run carrying 2+ content words, one of them
 * rare), or 2+ rare content words that appear in that review and in no other review of
 * the vendor (the paraphrase case: "multiple couples called themselves not photogenic and
 * said Alton coached them" vs a review's "Neither of us are photogenic ... with his
 * coaching"). Single shared words never count: staff names recur across a vendor's
 * reviews, which is why rarity is also measured against the vendor's OTHER reviews.
 */
export function reviewsUsed(text, reviews, docFreq = null, background = '') {
  const ews = words(text), eSh = shingles(ews), bws = words(background), bSh = shingles(bws);
  const bStems = new Set(bws.map(stem));
  // A word or phrase the vendor's NON-review research also carries (its name, site copy,
  // digests) proves nothing about which review was used: "Heart of Jerusalem Cafe serves
  // Mediterranean cuisine" matched a 2026-06 review on cafe/mediterranean, both of which
  // are in the vendor's own name and site text.
  const eStems = new Set(ews.filter(isContent).map(stem).filter((w) => !bStems.has(w)));
  const rw = reviews.map((r) => words(r.text));
  const local = new Map();
  for (const ws of rw) for (const w of new Set(ws.filter(isContent).map(stem))) local.set(w, (local.get(w) || 0) + 1);
  const globallyRare = (w) => !docFreq || (docFreq.df.get(w) || 0) <= Math.max(2, docFreq.n * 0.01);
  const rare = (w) => w.length >= 4 && !/^\d+$/.test(w) && local.get(w) === 1 && globallyRare(w);
  const need = docFreq ? 2 : 3;
  const used = [];
  reviews.forEach((r, i) => {
    const shared = [...shingles(rw[i])].filter((s) => eSh.has(s) && !bSh.has(s) && s.split(' ').some((w) => isContent(w) && rare(stem(w)) && !bStems.has(stem(w))));
    const rareShared = [...new Set(rw[i].filter(isContent).map(stem))].filter((w) => rare(w) && eStems.has(w));
    if (shared.length || rareShared.length >= need) used.push({ ...r, why: shared.length ? `phrase "${shared[0]}"` : `words ${rareShared.slice(0, 4).join('/')}` });
  });
  return used;
}

/**
 * The floor for one entry: the newest of (a) the reviews it uses and (b) any month-year or
 * year it names next to a source word. Returns {floor:{month,year}|null, evidence:[...]}.
 * A year-only mention ("a 2026 review") floors at the earliest harvested review of that
 * year, else January of it.
 */
export function sourceFloor(text, reviews = [], docFreq = null, background = '') {
  const ev = [];
  for (const r of reviewsUsed(text, reviews, docFreq, background)) ev.push({ ym: r.ym, why: `review ${r.when} (${r.why})` });
  const t = gateText(text);
  for (const re of MONTH_NEAR_SOURCE) for (const m of t.matchAll(re)) {
    const mon = MONTH[m[1].toLowerCase().slice(0, 3)], yr = +m[2];
    if (mon) ev.push({ ym: ym(yr, mon), why: `names "${m[0].trim().slice(0, 60)}"` });
  }
  for (const re of YEAR_NEAR_SOURCE) for (const m of t.matchAll(re)) {
    const yr = +m[1];
    const inYear = reviews.filter((r) => Math.floor(r.ym / 12) === yr).map((r) => r.ym);
    ev.push({ ym: inYear.length ? Math.min(...inYear) : ym(yr, 1), why: `names "${m[0].trim().slice(0, 60)}"` });
  }
  if (!ev.length) return { floor: null, evidence: [] };
  const top = Math.max(...ev.map((e) => e.ym));
  return { floor: fromYm(top), floorYm: top, evidence: ev.filter((e) => e.ym === top).map((e) => e.why) };
}

/**
 * Plan forward date moves for a set of entries. Reusable over a drafting batch (merge)
 * and over LIVE entries (remediation).
 *
 *   entries: [{ key, vendor_id, month, year, text }]   text = price_text + details + notes
 *   ctx.reviewsFor(vendor_id)  -> reviewsFromHarvest(...) for that vendor ([] if none)
 *   ctx.ceilingFor(vendor_id)  -> {month, year} (harvestCeiling); default today
 *   ctx.docFreq                -> buildDocFreq(all review texts in scope). Strongly
 *                                 recommended: it is what keeps everyday words out.
 *   ctx.backgroundFor(vid)     -> the vendor's NON-review research text (name + dossier
 *                                 minus its review lines: dossierBackground()). Words it
 *                                 carries are not evidence that a REVIEW was used.
 *   ctx.takenFor(vendor_id)    -> extra "M/YYYY" strings already used by entries NOT in
 *                                 `entries` (e.g. a vendor's live siblings in a
 *                                 supplemental run). Optional.
 *
 * Returns { moves, conflicts, clamped }:
 *   moves:     [{ key, vendor_id, from, to, evidence }]  apply every one
 *   conflicts: moves whose floor month (and every month up to the ceiling) is already
 *              held by a sibling. The move is still planned onto the floor, because an
 *              anachronism is worse than a shared month, but it is reported.
 *   clamped:   floors later than the ceiling (a source date after the harvest), moved to
 *              the ceiling instead.
 * Never moves a date backward. Siblings that do not move keep their months, and those
 * months are reserved before any mover picks one.
 */
export function planDateMoves(entries, ctx = {}) {
  const now = new Date();
  const todayCeil = { month: now.getUTCMonth() + 1, year: now.getUTCFullYear() };
  const byVid = new Map();
  for (const e of entries) { if (!byVid.has(e.vendor_id)) byVid.set(e.vendor_id, []); byVid.get(e.vendor_id).push(e); }
  const moves = [], conflicts = [], clamped = [];
  for (const [vid, es] of byVid) {
    const reviews = ctx.reviewsFor ? ctx.reviewsFor(vid) || [] : [];
    const c = ctx.ceilingFor ? ctx.ceilingFor(vid) || todayCeil : todayCeil;
    const ceil = ym(c.year, c.month);
    const taken = new Set(ctx.takenFor ? ctx.takenFor(vid) || [] : []);
    const background = ctx.backgroundFor ? ctx.backgroundFor(vid) || '' : '';
    const movers = [];
    for (const e of es) {
      const cur = ym(+e.year, +e.month);
      const { floorYm, evidence } = sourceFloor(e.text, reviews, ctx.docFreq || null, background);
      if (floorYm != null && floorYm > cur && cur < ceil) movers.push({ e, cur, floor: Math.min(floorYm, ceil), raw: floorYm, evidence });
      else taken.add(`${+e.month}/${+e.year}`);
    }
    movers.sort((a, b) => a.floor - b.floor);
    for (const m of movers) {
      if (m.raw > ceil) clamped.push({ key: m.e.key, vendor_id: vid, floor: fmt(fromYm(m.raw)), ceiling: fmt(fromYm(ceil)) });
      let t = m.floor;
      while (taken.has(fmt(fromYm(t))) && t < ceil) t++;
      const to = fromYm(t);
      const mv = { key: m.e.key, vendor_id: vid, from: { month: +m.e.month, year: +m.e.year }, to, evidence: m.evidence };
      if (taken.has(fmt(to))) conflicts.push(mv);
      taken.add(fmt(to));
      moves.push(mv);
    }
  }
  return { moves, conflicts, clamped };
}

// ── absence claims on an unread site (item 6) ─────────────────────────────────
// "no pricing posted anywhere", "nothing says they do weddings", "not a wedding venue",
// written when the crawl FAILED or the row had no website at all, so nobody read the site
// the claim is about. The pilot found most of them false: Red Rocks runs a weddings
// program, Audra Rose has a separate weddings site behind the 403, and Fairmount's
// "nothing wedding-related on the site" was read off a cemetery in Newark, NJ.
// 280 of 2,084 live vendors have no website on the row.
// The explicit no-website marker dossier.mjs writes (plan item 6). KEEP THIS LITERAL IN
// SYNC WITH dossier.mjs; `site=none` and SITE CRAWL FAILED also mark older dossiers.
export const DOSSIER_NO_WEBSITE_MARKER = 'NO WEBSITE ON FILE';
export const SITE_UNREAD_MARKERS = [
  { re: /SITE CRAWL FAILED/, why: 'SITE CRAWL FAILED' },
  { re: /^site=none\b/m, why: 'site=none' },
  { re: new RegExp(DOSSIER_NO_WEBSITE_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), why: DOSSIER_NO_WEBSITE_MARKER },
];
/** Why this dossier's site was never read ('SITE CRAWL FAILED' / 'site=none'), or null. */
export function siteUnread(dossierText) {
  const hit = SITE_UNREAD_MARKERS.find((m) => m.re.test(dossierText || ''));
  return hit ? hit.why : null;
}

// Grouped so a sweep can report which kind of claim it found. All of them fail the same
// way: on an unread site none of them can be known. `no` never matches "no-show" ("a $50
// no-show fee is posted" is a presence claim).
const NO = String.raw`(?:no(?![- ]show)|nothing|zero|none|not any)`;
export const ABSENCE_FAMILIES = [
  // "no pricing anywhere", "nothing on block rates anywhere"
  { family: 'anywhere', re: new RegExp(String.raw`\b${NO}\b[^.;|\n]{0,40}?\banywhere\b`, 'i') },
  // "nothing on their site", "nothing property specific on the website"
  { family: 'nothing-on-site', re: /\bnothing\b(?:\s+\w+){0,3}\s+(?:on|in)\s+(?:their|the|its|his|her)\s+(?:own\s+)?(?:site|website|page)s?\b/i },
  // "nothing says they do weddings", "doesn't mention weddings", "not a wedding venue"
  { family: 'no-weddings', re: new RegExp([
    String.raw`\b(?:doesn'?t|does not|don'?t|do not|never|no(?![- ]show))\b[^.;|\n]{0,30}?\b(?:mention|mentions|list|lists|say|says|reference|references|show|shows)\b[^.;|\n]{0,20}?\bweddings?\b`,
    String.raw`\bnothing\b(?:\s+\w+){0,4}\s+(?:says|suggests|mentions|indicates|about)\b[^.;|\n]{0,30}?\bweddings?\b`,
    String.raw`\bnot\s+(?:really\s+|actually\s+)?(?:a\s+|an\s+)?wedding[- ](?:venue|vendor|business|photographer|florist|caterer|shop|band|dj)\b`,
    String.raw`\bno\s+(?:dedicated\s+)?wedding[- ](?:specific\s+)?(?:page|info|offering|services?|packages?|section|menu)\b`,
  ].join('|'), 'i') },
  // "no site", "they don't have a website" (280 of 2,084 live vendors have no website on
  // the row; the pilot found sites for the ones it checked)
  { family: 'no-website', re: /\b(?:no|doesn'?t have an?|don'?t have an?|without an?)\s+(?:dedicated\s+|real\s+|actual\s+|own\s+)?(?:website|site)\b(?!\s+(?:visit|tour|fee|pricing|rates?|coordinator))/i },
  // "no block rate published", "pricing isn't posted", "no published rates"
  { family: 'not-published', re: new RegExp(String.raw`\b(?:${NO}|isn'?t|aren'?t|not)\b[^.;|\n]{0,30}?\b(?:posted|listed|published|advertised)\b|\bno\s+(?:published|posted|listed|public|online)\b`, 'i') },
];
// A clause that names the source it is summarizing ("none of the reviews mention
// weddings", "reddit had nothing on pricing") is a claim about a source we DID read, so it
// is exempt; the check is aimed at claims about the vendor or its unread site.
const READ_SOURCE = /\b(reviews?|reviewers?|reddit|thread|comments?|google|zola|knot|weddingwire|yelp|instagram|facebook|guide|listing)\b/i;

/** Absence claims in an entry's text: [{family, match, clause}] (clauses naming a read source are exempt). */
export function absenceClaims(text) {
  const out = [];
  for (const clause of gateText(text).split(/[.;|\n,]+|\s-\s/)) {
    if (READ_SOURCE.test(clause)) continue;
    for (const { family, re } of ABSENCE_FAMILIES) {
      const m = clause.match(re);
      if (m) { out.push({ family, match: m[0], clause: clause.trim().slice(0, 120) }); break; }
    }
  }
  return out;
}

// ── call files + cross-vendor contamination (item 17b) ────────────────────────
// A call file inlines ~25 vendors' dossiers, and a drafter can carry a fact across: the
// 2026-10 pilot found "1970s" (from Donna Beth's review in dress-colorado d1-call-02)
// written into d'Anelli's entry. The check: a distinctive phrase in an entry that appears
// in a SIBLING vendor's block of the same call file but nowhere in this vendor's own block
// (or the shared rules header) did not come from this vendor's research.

/** Split a call file into its shared header and per-vendor blocks. */
export function parseCallFile(text) {
  const lines = text.split('\n');
  const HEAD = /^=== [^:\n]+: (.*?) \| vendor_id=([0-9a-f-]{36})\b.*===\s*$/;
  const END = /^(OUTPUT FILE:|=== API MODE)/;
  const blocks = []; const header = [];
  let cur = null;
  for (const l of lines) {
    const h = HEAD.exec(l);
    if (h) { cur = { name: h[1], vendor_id: h[2], lines: [l] }; blocks.push(cur); continue; }
    if (END.test(l)) { cur = null; continue; }
    if (cur) cur.lines.push(l); else if (!blocks.length) header.push(l);
  }
  return { header: header.join('\n'), blocks: blocks.map((b) => ({ name: b.name, vendor_id: b.vendor_id, text: b.lines.join('\n') })) };
}

// Numbers that identify a fact: a decade ("1970s"), a 3+ digit figure that is neither a
// recent year (years are everywhere: dates, "since 2015") nor a round hundred-ish number
// ($100, $1,000 and 400 guests recur across unrelated vendors), or a decimal of 10 or more
// ("$12.50"; 4.5 and 3.9 are star ratings every block carries).
const distinctNumber = (w) => /^\d{4}s$/.test(w)
  || (/^\d{3,}$/.test(w) && !(+w >= 1990 && +w <= 2035) && +w % 50 !== 0)
  || (/^\d+\.\d+$/.test(w) && +w >= 10);
// Words that are capitalized in every block without naming anything specific to one
// vendor: calendar words, platforms, and Colorado geography (a Denver hotel entry naming
// Rocky Mountain National Park is not contamination from the Estes Park block).
const COMMON_NAMES = new Set(`january february march april may june july august september october november december
jan feb mar apr jun jul aug sep sept oct nov dec monday tuesday wednesday thursday friday saturday sunday
mon tue wed thu fri sat sun instagram facebook google yelp zola knot weddingwire tiktok pinterest reddit
the colorado denver boulder rocky mountain mountains national park springs fort collins estes vail aspen
breckenridge front range red rocks golden lakewood arvada aurora littleton englewood castle rock loveland
greeley longmont evergreen durango telluride steamboat keystone grand junction pueblo highlands ranch
downtown hilton marriott hyatt ihg wyndham choice airport metro`.split(/\s+/));

/**
 * Distinctive pieces of `entryText` that appear in 1..maxSiblings SIBLING blocks of the
 * same call file but nowhere in the vendor's own block or the shared header.
 * Returns [{phrase, kind:'phrase'|'number'|'name', siblings:[names]}].
 *
 * Tuned on every 2026-07 CO workdir (2,909 drafted rows) for low false positives: a first
 * cut that flagged any foreign 4-word run hit 113 rows, mostly "cocktail hour and
 * reception", "free hot breakfast", month names and "Rocky Mountain National Park". So a
 * candidate now needs its own distinctive WORD (absent from this vendor's block, present
 * in exactly one sibling): a 4-word run or a multi-word name qualifies only through such
 * a word. Numbers may sit in up to maxSiblings siblings; anything more widely shared is
 * common knowledge rather than one vendor's fact.
 */
export function contaminationHits(entryText, ownText, siblings, headerText = '', { maxSiblings = 2 } = {}) {
  const own = wordString(ownText), hdr = wordString(headerText);
  const ownSet = new Set(words(ownText)), hdrSet = new Set(words(headerText));
  const sibs = siblings.map((s) => ({ name: s.name, ws: wordString(s.text), set: new Set(words(s.text)) }));
  const sibCount = (w) => sibs.filter((s) => s.set.has(w)).length;
  // A word that marks a fact as belonging to ONE other vendor's research: absent from this
  // vendor's block and the header, present in exactly one sibling, 5+ letters ("tax",
  // "stayed" and "feels" in two siblings each were the residue that needed this).
  const foreign = (w) => isContent(w) && w.length >= 5 && !COMMON_NAMES.has(w) && !ownSet.has(w) && !hdrSet.has(w) && sibCount(w) === 1;
  const ews = words(entryText);
  const cands = new Map();
  for (const sh of shingles(ews, 4, 3)) if (sh.split(' ').some(foreign)) cands.set(sh, 'phrase');
  for (const w of ews) if (distinctNumber(w)) cands.set(w, 'number');
  // Multi-word proper names in the entry ("Donna Beth", "Ken Caryl"), carrying at least one
  // foreign word. Single capitalized words were tried and dropped: "Heads up", "Saw",
  // "French", "Valley" and "Ski" made up every single-word hit and none was a real leak.
  for (const m of gateText(entryText).matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g)) {
    const ws = words(m[1]);
    if (ws.some((w) => foreign(w) && !STOP.has(w))) cands.set(ws.join(' '), 'name');
  }
  const hits = [];
  for (const [phrase, kind] of cands) {
    const pad = ` ${phrase} `;
    if (own.includes(pad) || hdr.includes(pad)) continue;
    const where = sibs.filter((s) => s.ws.includes(pad)).map((s) => s.name);
    if (where.length && where.length <= (kind === 'number' ? maxSiblings : 1)) hits.push({ phrase, kind, siblings: where });
  }
  // Collapse overlapping 4-word runs into one reported phrase per sibling set.
  const seen = new Set();
  return hits.filter((h) => { const k = `${h.kind === 'phrase' ? h.phrase.split(' ').filter(foreign).join(' ') : h.phrase}|${h.siblings.join(',')}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
