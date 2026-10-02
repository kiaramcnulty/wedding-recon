// Compress each harvested vendor's research into ONE dossier.md that a single-turn draft
// call reads inline. Agents never read raw harvest.json / page-*.txt / whole digests — a
// regex pass extracts the pricing, wedding-page, review, and reddit content for free, and
// everything else stays on disk. Pure filesystem: no DB, no network, no env needed.
//
// SIZE (2026-10 audit, plan item 4): this used to aim at ~800 tokens with a hard 4,000-char
// cap, and the cuts were where the facts were: Colorado Bridal Company's fee table was cut
// at its heading, Red Rocks' weddings/private-events page never reached the dossier, the
// d'Anelli price tiers and its "bridal by appointment only" line were dropped, and a review
// cut at "There is no ..." was finished by the drafter with invented text. Drafting runs on
// the Batch API at half price, so a dossier 2-3x larger costs cents per region; a wrong
// card costs a review pass. Budgets now follow CONTENT (see BUDGET below), every cut lands
// on a sentence or line boundary, and every cut is declared in a `SOURCE TRUNCATED:` line.
//
// usage: node .claude/skills/enrichvendors/scripts/dossier.mjs <workdir> [--type photographer]
//          [--venues "slug;slug"] [--cap 12000] [--out <dir>]
//   --out <dir>  write <dir>/<slug>/dossier.md (+ identity.json) instead of into the research
//                dir — for diffing a new dossier against the one a live entry was drafted
//                from, without overwriting it.
import fs from 'node:fs';
import path from 'node:path';
import { norm, argValue } from '../../launchvendors/scripts/lib.mjs';
import { etype } from './etype.mjs';
import { checkIdentity, siblingPageFiles } from './identity.mjs';

const workdir = process.argv[2];
if (!workdir || workdir.startsWith('--')) { console.error('usage: dossier.mjs <workdir> [--venues "a;b"] [--cap 12000] [--out <dir>]'); process.exit(1); }
// Whole-dossier safety net, chars (~= tokens*4). Measured after the section budgets below,
// a typical dossier is 3-7k chars; the cap only bites on vendors with long reviews AND a big
// reddit slice AND several digests, and it trims the lowest-value tail first (see trim order).
const CAP = parseInt(argValue('cap') || '12000', 10);
const OUT = argValue('out');
const only = new Set((argValue('venues') || '').split(';').map((s) => s.trim()).filter(Boolean));

/**
 * Per-section budgets, chars. Old values in brackets.
 * - price 3,500 [1,500]: holds a full rate card + its fee table. A priced passage that
 *   starts inside the budget is kept WHOLE up to priceBlockMax even if it overruns, because
 *   a table cut at its heading reads as "no fees published" (Colorado Bridal Company).
 * - pages 2,500 [none]: wedding / private-event / FAQ page prose. There was no such section,
 *   so a page that states the program in prose with no $ figure (Red Rocks: "The Trading
 *   Post Backyard is the ultimate location for a mountain-view ceremony") vanished.
 * - review 1,200 each, ALL reviews on file [400 each, top 3]: measured over 7,693 CO
 *   reviews, median 465 chars, p90 1,111; at 400, 45% were cut mid-sentence, at 1,200 8%
 *   are cut and those end on a sentence plus "[rest of review omitted]".
 * - filter 1,500 [1,200];
 *   reddit 2,500 [900]; digests 6 x 500 [4 x 300].
 */
const BUDGET = { price: 3500, priceBlockMax: 1800, priceExtra: 800, pages: 2500, pageEach: 1200, filter: 1500, review: 1200, watchN: 4, watchLen: 320, digestN: 6, digestLen: 500, reddit: 2500, line: 500 };

const researchDir = path.join(workdir, 'research');
const digests = fs.readdirSync(researchDir)
  .filter((f) => f.startsWith('pricing-web-') && f.endsWith('.txt'))
  .map((f) => ({ tag: f.replace(/^pricing-web-|\.txt$/g, ''), lines: fs.readFileSync(path.join(researchDir, f), 'utf8').split('\n') }));

const profile = etype();
const PRICE_LINE = profile.priceLine;

/**
 * Lines that answer an Explore FILTER question, across every vendor type. Deliberately
 * one shared pattern rather than per-type: a venue page mentions catering and lodging, a
 * caterer's page mentions bar service and dietary needs, and the cost of carrying a few
 * irrelevant lines is far lower than the cost of dropping a real one (which is invisible
 * downstream — it just looks like the vendor never said it).
 */
const FILTER_FACT = new RegExp([
  // venue: catering / alcohol / spaces / lodging / inclusions
  'outside catering|bring your own caterer|preferred caterer|approved caterer|exclusive caterer',
  'in.?house catering|catering is (required|included|provided)|caterer of your choice',
  'byob|bring your own (alcohol|beer|wine|liquor)|liquor license|bar service|no outside alcohol',
  'on.?site lodging|overnight accommodat|guest rooms?|cabins?|sleeps \\d+|stay on.?site',
  'bridal suite|getting ready (room|suite|space)|bridal (room|cottage)|groom\'?s? (room|suite|loft)',
  'indoor and outdoor|outdoor ceremony|indoor ceremony|covered pavilion|tented|rain plan',
  'accommodates? up to|seats? up to|maximum of \\d+|all.?inclusive|tables and chairs|linens included',
  // photographer
  'engagement session|second shooter|elopement|micro.?wedding|shoots? film|turnaround|weeks? (for|to) deliver',
  // caterer
  'buffet|plated|family style|food truck|passed appetizer|vegan|gluten.?free|full bar|beer and wine|tasting',
  // florist
  'full service|a la carte|delivery and set.?up|installation|minimum (spend|order)',
  // beauty
  'on.?location|in.?studio|travels? to (you|your)|trial|airbrush|per (bridesmaid|attendant)',
  // dress
  'designer|off.?the.?rack|sample sale|trunk show|alterations|plus.?size|appointment (only|required)',
  // planner
  'full planning|partial planning|month.?of|day.?of coordinat|flat fee|% of budget',
  // music
  'uplighting|photo ?booth|emcee|ceremony music|\\d+.?piece|quartet|trio|open format',
  // hotel
  'courtesy block|room block|attrition|shuttle|complimentary breakfast|free parking|cut.?off date',
].join('|'), 'i');

/**
 * One honest line about the vendor's PDFs. Distinguishes three states that must not be
 * conflated: read (its text is already in the pricing lines above), unreadable (a scan —
 * pricing may well exist, we just can't see it), and never attempted.
 */
function pdfNote(h, pdfs) {
  if (!pdfs.length) return '';
  const attempts = h.pdf_texts || [];
  const read = attempts.filter((p) => p.file).map((p) => p.url);
  const failed = attempts.filter((p) => !p.file).map((p) => p.url);
  const untried = pdfs.filter((u) => !attempts.some((p) => p.url === u));
  const bits = [];
  if (read.length) bits.push(`pdf rate cards READ (text included above): ${read.join(' ; ')}`);
  if (failed.length) bits.push(`pdf rate cards found but UNREADABLE (scanned/image PDF - pricing may exist, treat as unknown, NOT as "no pricing published"): ${failed.join(' ; ')}`);
  if (untried.length) bits.push(`pdf rate cards seen on site (not fetched): ${untried.join(' ; ')}`);
  return bits.join('\n');
}
const NOISE = /cookie|privacy|subscribe|newsletter|copyright|all rights|follow us|instagram|facebook|menu toggle|skip to (content|main)|sign in|log in|gift card|careers/i;
const WEDDINGY = /wedding|recept|ceremon|bride|groom|married|elope/i;
// A line carrying a hard figure: money, a guest count, a per-unit rate. These anchor the
// price blocks; the type's softer PRICE_LINE keywords ("designer", "appointment") only fill
// what is left, because on d'Anelli they burned the whole budget on brand prose before the
// actual "$800-$1,300 / $1,400-$5,000" tiers were reached.
// Also a figure written without a "$" (Two Elk Studios: "Wedding Collections start at 12,000").
const MONEY = /\$\s?\d|\bstart(?:s|ing)? (?:at|from) \$?\d|\b\d{1,3},\d{3}\b(?!\s*(?:sq|square|feet|ft|acres?|people|guests|followers|miles))|\b\d{2,4}\s*(?:guests?|people|seated|standing|attendees)\b|max(?:imum)? guest|\bper (?:person|hour|night|stylist|guest|head|plate|service|bridesmaid)\b/i;
// Prose worth keeping from a home page (which is mostly marketing): wedding content and
// the booking policies a couple acts on ("Our consultants work by appointment only").
const POLICY = /appointment|walk.?ins?\b|minimum|deposit|retainer|availability|capacity|accommodat|travel|lodging|overtime|cancel|refund|exclusive|in.?house|outside (?:vendors?|caterers?|alcohol|food)|required|not (?:allowed|permitted)|private event|rental/i;
// Pages ranked for the price + page-text passes. Calendar pages are detected by CONTENT
// (Red Rocks' "events" page is 31 KB of concert listings; "Alkaline Trio" once matched the
// music filter fact) because plenty of venues call their private-events page /events.
const PAGE_RANK = [[/pric|packag|rate|invest|fee|cost|menu/i, 5], [/^pdf-/, 4], [/wedding|elope|bridal|bride|private|ceremon|reception/i, 4],
  [/faq|polic|question|includ/i, 3], [/venue|space|rental|capacit|book|appoint|service|collection|group|block/i, 2], [/^home$/, 1]];
const EXCERPT_PAGE = /wedding|elope|bridal|bride|private|ceremon|reception|faq|question|polic|includ|venue|space|rental|capacit|appoint|book|packag|pric|group|block/i;
const DATE_LINE = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b/;
const nameKey = (s) => norm(s).replace(/\b(the|at|by|of|a)\b/g, ' ').replace(/\s+/g, ' ').trim();

// harvest.mjs's stripTags decodes only a handful of entities, so "&mdash;", "&ndash;" and
// "&#038;" reached dossiers verbatim ("$800&ndash;$1,300"). Decode the rest here.
const ENT = { mdash: '—', ndash: '–', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', amp: '&', bull: '•', copy: '©', nbsp: ' ', hellip: '…', lsaquo: '', rsaquo: '', laquo: '"', raquo: '"', quot: '"', apos: "'", trade: '™', reg: '®', eacute: 'é', egrave: 'è', times: '×', frac12: '½' };
const decode = (s) => (s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&([a-z]+\d*);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const squash = (s) => decode(s).replace(/\s+/g, ' ').trim();

const SENT_SPLIT = /(?<=[.!?…])["')\]]*\s+/;
/**
 * Cut text to <= max chars ON A SENTENCE BOUNDARY. Returns { text, cut }. The one case that
 * cuts mid-sentence is a single first sentence longer than 1.6x max (a run-on with no
 * punctuation); it ends in "…" so it can never read as a complete thought.
 */
function cutAtSentence(s, max) {
  s = squash(s);
  if (s.length <= max) return { text: s, cut: false };
  const parts = s.split(SENT_SPLIT);
  let out = '';
  for (const p of parts) {
    const next = out ? `${out} ${p}` : p;
    if (next.length > max) break;
    out = next;
  }
  if (!out) {
    if (parts[0].length <= max * 1.6) return { text: parts[0], cut: parts.length > 1 };
    out = s.slice(0, max).replace(/\s+\S*$/, '') + '…';
  }
  return { text: out, cut: true };
}

/** "8 months ago" relative to fetched_at -> "~YYYY-MM", so every review line is datable. */
function reviewMonth(when, fetchedAt) {
  if (/^\d{4}-\d{2}$/.test(when || '')) return when;
  const m = /(\d+|an?) (day|week|month|year)s? ago/i.exec(when || '');
  const base = new Date(fetchedAt || Date.now());
  if (!m || isNaN(base)) return 'undated';
  const n = /^an?$/i.test(m[1]) ? 1 : parseInt(m[1], 10);
  const days = { day: 1, week: 7, month: 30.4, year: 365 }[m[2].toLowerCase()] * n;
  const d = new Date(base.getTime() - days * 864e5);
  return `~${d.toISOString().slice(0, 7)}`;
}

// ── watch-outs classifier (plan item 3) ─────────────────────────────────────────
// The old CAVEAT regex fired on bare "but" / "however" / "although" / "wish", and any
// review rated <= 4 stars counted, so dossiers listed PRAISE as sourced negatives ("I wish
// I'd have stayed longer!", "Not only is she extremely talented but she is such a great
// person!", "I really wish I could rate higher!"). The draft rules then REQUIRED one of
// them to land in the notes. Now a sentence qualifies only if it carries a negative TERM,
// that term is not negated ("no issues", "never late", "didn't disappoint"), and the
// sentence is not a known praise idiom. Conjunctions are not evidence of anything.
// Two tiers. CAVEAT terms are a reviewer flagging a wart on purpose ("my only complaint",
// "a bit rushed", "parking is limited", "too loud") and count in ANY review. GENERAL
// negative vocabulary counts only in 4-star-and-below reviews, digests and reddit: a
// 5-star review uses it to tell a rescue story about someone else ("after a pretty terrible
// experience at David's Bridal", "turning such a disappointment into something perfect",
// "when my cake provider missed the florals, Becky fixed them"; all from the 2026-10 corpus
// run), never to warn about the vendor it is praising.
const CAVEAT_TERMS = [
  // not "heads-up": "a call with a heads-up that the delivery was on its way" is praise
  'downside', 'drawback', 'be aware', 'the bad\b',
  '(?:the|my|our) only (?:thing|issue|problem|con|negative|complaint|downside|gripe|drawback)', 'only (?:issue|complaint|downside|drawback|gripe|negative|con)\b',
  '(?:my|our|one) (?:complaint|gripe)', 'one (?:problem|issue|thing to note)', 'note one problem',
  'slow to (?:respond|reply|answer|get back)', 'hard to (?:reach|get a hold|get ahold|communicate|understand|hear)',
  'difficult to (?:reach|work with|communicate|understand)', 'impossible to (?:reach|understand|hear)',
  'overpriced', 'pricey', 'expensive', 'steep', 'not cheap', 'not worth', 'nickel(?:ed)? and dim\w*',
  'hidden (?:fees?|costs?|charges?)', 'extra (?:fees?|charges?)', 'charged (?:us|me) (?:extra|for|more)',
  'too (?:small|far|expensive|pricey|tight|loud|crowded|hot|cold|long|short|rushed|dark|noisy|cramped)',
  'way too \w+', 'a (?:bit|little) (?:much|pricey|steep|rushed|slow|disorganized|expensive|chaotic|loud|tight|small|cramped)',
  'wish (?:they|it|she|he|there|the \w+) (?:had|would|were|was|offered|did|provided|allowed|could have|included)',
  'rushed', 'understaffed', 'underwhelm\w*', 'mediocre', 'could (?:have been|be) better', 'room for improvement',
  'not (?:great|the best|good|impressed|happy|worth it)',
  '(?:limited|tight|difficult) parking', 'parking (?:is|was) (?:limited|tight|a nightmare|difficult|a pain|expensive)',
  // venue access a reviewer means as a heads-up (Red Rocks: "there's a lot of stairs and uphill")
  'lots? of stairs', 'a lot of stairs', '(?:steep|brutal|long) (?:walk|climb|incline|hike)', 'incline is', 'uphill',
];
const GENERAL_TERMS = [
  'unfortunately', 'disappoint\w*', 'complaints?',
  'no (?:response|reply|call back|communication)', 'never (?:heard back|responded|replied|got back|called back|showed)',
  'unrespons\w*', 'rude', 'unprofessional', 'upsell\w*', 'pushy', 'watch out', 'beware', 'avoid (?:this|them|her|him|at all costs)',
  'regret\w*', '(?:showed|show|arrived|ran|running|were|was) (?:up )?late', 'no.?show(?:ed)?', 'double.?booked', 'cancel+ed on',
  'forgot', 'missed', 'messed up', 'mix.?up', 'mistakes?', 'wrong', 'damaged', 'broken', 'stain\w*',
  'frustrat\w*', 'stressful', 'terrible', 'awful', 'horrible', 'worst', 'poor(?:ly)?', 'lacking',
  'disorganized', 'unorganized', 'chaotic', 'careless', 'condescending', 'refund\w*', 'deposit (?:was )?(?:not|never) (?:returned|refunded)',
  'no parking',
  // food quality (caterers, food trucks: Wheels on Fire's 1-star "soggy", "burnt", "grease")
  'soggy', 'burnt', 'burned', 'greasy', 'bland', 'stale', 'undercooked', 'overcooked', 'cold food', 'food was cold', 'ran out of',
  'issues?', 'problems?', 'hiccups?', 'snafus?',
];
const CAVEAT = new RegExp(`\\b(?:${CAVEAT_TERMS.join('|')})\\b`, 'gi');
const NEG = new RegExp(`\\b(?:${[...CAVEAT_TERMS, ...GENERAL_TERMS].join('|')})\\b`, 'gi');
// A negation within the 4-5 words before a term flips it to praise ("never made me feel
// rushed", "didn't have to stand for too long") ("no issues at all",
// "never once late", "didn't disappoint", "you won’t be disappointed", "made it so much
// less stressful", "they do not nickel and dime you", "you cannot go wrong").
const NEGATED_BEFORE = /\b(?:no|not|never|nothing|without|zero|none|nor|any|less|cannot)\b(?:\W+\w+){0,3}\W*$|n['’]t\b(?:\W+\w+){0,4}\W*$/i;
// Absence-negatives carry their own "no/never/not"; the negation guard must not cancel them.
const SELF_NEGATIVE = /^(?:no |never |not )/i;
const PRAISE_IDIOM = /\bif you (?:complain|think|worry|are worried)\b|\bnot only\b|can(?:'|’|no)?t say enough|cannot say enough|couldn['’]?t have asked for|could not have asked for|wish (?:i|we) (?:could|had|['’]?d)\b|wish there (?:were|was) (?:more|a) (?:stars?|rating)|stress.?free|no regrets?|worth every|without (?:a|any) (?:hitch|issue|problem)|nothing but|no complaints?|did ?n[o'’]?t disappoint|never disappoint|won['’]?t (?:regret|be disappointed)|not disappointed|no problem|but (?:it was |it's |totally |so )?worth it/i;

/** The negative phrase that makes this sentence a genuine watch-out, or null.
 *  caveatOnly = the sentence is from a 5-star review (CAVEAT tier only, see above). */
function negativeSignal(sentence, caveatOnly = false) {
  if (PRAISE_IDIOM.test(sentence)) return null;
  for (const m of sentence.matchAll(caveatOnly ? CAVEAT : NEG)) {
    if (!SELF_NEGATIVE.test(m[0]) && NEGATED_BEFORE.test(sentence.slice(0, m.index))) continue;
    // "issue"/"problem" alone are too often neutral ("any issue, they fixed it"): require an
    // article or quantifier right before them.
    if (/^(?:issues?|problems?|hiccups?|snafus?)$/i.test(m[0]) && !/\b(?:an?|some|one|few|couple|major|minor|big|small|the|only|biggest|real|serious)\s+(?:\w+\s+)?$/i.test(sentence.slice(0, m.index))) continue;
    return m[0];
  }
  return null;
}
const sentencesOf = (t) => squash(t).split(SENT_SPLIT).map((s) => s.trim()).filter((s) => s.length >= 15);

/** The SOURCE TRUNCATED list, kept to one readable line: over-long single lines are
 * counted rather than listed (a long-paragraph site produced dozens), the rest deduped. */
function fmtTruncated(list) {
  const longLines = list.filter((t) => t.startsWith('a long line on ')).length;
  const rest = [...new Set(list.filter((t) => !t.startsWith('a long line on ')))];
  const shown = rest.slice(0, 8);
  if (rest.length > shown.length) shown.push(`${rest.length - shown.length} more`);
  if (longLines) shown.push(`${longLines} over-long site line(s) cut at a sentence`);
  return shown.join('; ');
}

// ── per-vendor build ────────────────────────────────────────────────────────────
let done = 0, withDollar = 0, totalChars = 0, idFlagged = 0, noSite = 0, crawlFailed = 0, truncatedAny = 0;
for (const slug of fs.readdirSync(researchDir).sort()) {
  const dir = path.join(researchDir, slug);
  if (!fs.existsSync(path.join(dir, 'harvest.json'))) continue;
  if (only.size && !only.has(slug)) continue;
  const h = JSON.parse(fs.readFileSync(path.join(dir, 'harvest.json'), 'utf8'));
  const truncated = []; // human-readable list for the SOURCE TRUNCATED line
  const emitted = new Set(); // norm keys of site lines already shown, so sections never repeat each other
  const ekey = (l) => norm(l).slice(0, 90);

  // 0) load site pages once: decoded, trimmed, ranked, calendar pages marked.
  // Sibling-act pages on a shared booking site are another vendor's facts: never read them.
  const siblings = siblingPageFiles(h);
  const pages = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.txt') && f !== 'reddit-slice.txt' && !siblings.has(f))
    .map((f) => {
      const key = f.replace(/\.txt$/, '');
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      // An image or binary served without an extension gets saved as a "page" (Homeslice
      // Band's page-band-color-w-logo-edit.txt is a PNG), and its byte soup matched MONEY
      // hundreds of times. Replacement chars / control bytes mark it; skip the file.
      if ((raw.slice(0, 4000).match(/[\uFFFD\u0000-\u0008\u000E-\u001F]/g) || []).length > 40) return null;
      const lines = raw.split('\n').map(squash).filter(Boolean);
      const calendar = lines.filter((l) => DATE_LINE.test(l) && l.length < 60).length >= 15;
      const rank = calendar ? -5 : PAGE_RANK.reduce((s, [re, w]) => Math.max(s, re.test(key) ? w : 0), 0);
      return { key, lines, calendar, rank, money: lines.filter((l) => MONEY.test(l)).length };
    })
    .filter(Boolean)
    .sort((a, b) => b.rank - a.rank || b.money - a.money || a.key.localeCompare(b.key));
  // Boilerplate = a short line that appears on 2+ pages (nav, footer). Within-page repeats
  // are boilerplate for prose only: a rate card legitimately repeats "$145" and "Trial: $140".
  const pageCount = new Map();
  for (const p of pages) for (const k of new Set(p.lines.map(ekey))) pageCount.set(k, (pageCount.get(k) || 0) + 1);
  const crossPage = (l) => l.length < 100 && !MONEY.test(l) && pages.length > 1 && (pageCount.get(ekey(l)) || 0) >= 2;
  const siteChars = pages.filter((p) => !/^(ig|reddit)-/.test(p.key)).reduce((s, p) => s + p.lines.join(' ').length, 0);

  // 1) PRICE BLOCKS: every hard-figure line with 2 lines of context either side, merged
  // into contiguous passages, so a rate card keeps its row labels ("Bridesmaid Hair" /
  // "$145") and a fee table keeps every row under its heading.
  const blocks = [];
  for (const p of pages) {
    if (p.calendar || /^(ig|reddit)-/.test(p.key)) continue;
    const L = p.lines.filter((l) => !NOISE.test(l) && !crossPage(l));
    const spans = [];
    L.forEach((l, i) => {
      if (!MONEY.test(l)) return;
      // 2 lines of context, then keep walking back through SHORT lines (table header rows:
      // "Serivce" / "Price" / "Travel:") so a fee table keeps its heading (Colorado Bridal).
      let s = Math.max(0, i - 2);
      for (let k = 0; k < 4 && s > 0 && L[s - 1].length <= 60; k++) s--;
      const e = Math.min(L.length - 1, i + 2);
      if (spans.length && s <= spans[spans.length - 1][1] + 2) spans[spans.length - 1][1] = e;
      else spans.push([s, e]);
    });
    for (const [s, e] of spans) {
      const lines = [];
      for (const raw of L.slice(s, e + 1)) {
        const c = cutAtSentence(raw, BUDGET.line);
        if (c.cut) truncated.push(`a long line on ${p.key}`);
        lines.push(c.text);
      }
      if (lines.every((l) => emitted.has(ekey(l)))) continue; // same table already shown from another page
      blocks.push({ page: p.key, lines });
      lines.forEach((l) => emitted.add(ekey(l)));
    }
  }
  const priceOut = [];
  let priceChars = 0, lastPage = null, shownBlocks = 0;
  for (const b of blocks) {
    const len = b.lines.join('\n').length;
    const room = BUDGET.price - priceChars;
    if (room < 300) break;
    let lines = b.lines;
    // Fits: keep. Does not fit but is a table-sized passage and there is real room left:
    // keep it WHOLE anyway (overrun bounded by priceBlockMax), because a table cut at its
    // heading is the exact failure this rewrite exists for. Otherwise cut on a line boundary.
    if (len > room && !(len <= BUDGET.priceBlockMax && room >= 400)) {
      lines = [];
      let n = 0;
      for (const l of b.lines) { if (n + l.length > room) break; lines.push(l); n += l.length + 1; }
      lines.push(`[price passage cut: ${b.lines.length - lines.length} more lines on ${b.page}]`);
      truncated.push(`pricing on ${b.page}`);
    }
    if (b.page !== lastPage) priceOut.push(`[site: ${b.page}]`);
    else priceOut.push('…');
    priceOut.push(...lines);
    priceChars += lines.join('\n').length;
    lastPage = b.page;
    shownBlocks++;
  }
  if (shownBlocks < blocks.length) {
    const rest = blocks.slice(shownBlocks);
    const pagesLeft = [...new Set(rest.map((b) => b.page))];
    priceOut.push(`[${rest.length} more priced passages not shown, on: ${pagesLeft.join(', ')}]`);
    truncated.push(`pricing (${rest.length} passages on ${pagesLeft.join(', ')})`);
    rest.forEach((b) => b.lines.forEach((l) => emitted.delete(ekey(l)))); // let later sections pick their lines up
  }
  // 1a) softer type keywords (no hard figure) fill a small extra budget.
  const extra = [];
  let extraChars = 0;
  outerX: for (const p of pages) {
    if (p.calendar) continue;
    for (const line of p.lines) {
      if (line.length < 25 || line.length > 300 || !PRICE_LINE.test(line) || NOISE.test(line) || crossPage(line) || emitted.has(ekey(line))) continue;
      if (extraChars + line.length > BUDGET.priceExtra) break outerX;
      extra.push(line); emitted.add(ekey(line)); extraChars += line.length;
    }
  }

  // 1b) WEDDING / EVENT / FAQ PAGE TEXT: the prose of the pages that describe the wedding
  // program and its policies, plus wedding/policy sentences from the home page.
  const pageOut = [];
  let pageChars = 0;
  for (const p of pages.filter((x) => !x.calendar && (EXCERPT_PAGE.test(x.key) || x.key === 'home')).sort((a, b) => (a.key === 'home') - (b.key === 'home'))) {
    if (pageChars >= BUDGET.pages) { truncated.push(`page text on ${p.key}`); continue; }
    const within = new Map();
    for (const l of p.lines) within.set(ekey(l), (within.get(ekey(l)) || 0) + 1);
    const prose = (l) => l.split(/\s+/).length >= 6;
    const keep = [];
    let n = 0, cutHere = false;
    p.lines.forEach((l, i) => {
      if (cutHere || NOISE.test(l) || crossPage(l) || (within.get(ekey(l)) || 0) > 1 || emitted.has(ekey(l))) return;
      const heading = !prose(l) && l.length <= 60 && prose(p.lines[i + 1] || '') && !emitted.has(ekey(p.lines[i + 1] || ''));
      if (!prose(l) && !heading) return;
      if (p.key === 'home' && !(WEDDINGY.test(l) || POLICY.test(l) || (heading && (WEDDINGY.test(p.lines[i + 1]) || POLICY.test(p.lines[i + 1]))))) return;
      const c = cutAtSentence(l, BUDGET.line);
      if (n + c.text.length > Math.min(BUDGET.pageEach, BUDGET.pages - pageChars)) { cutHere = true; return; }
      if (c.cut) truncated.push(`a long line on ${p.key}`);
      keep.push(c.text); n += c.text.length + 1;
    });
    // a trailing heading with its body cut off is noise
    while (keep.length && !prose(keep[keep.length - 1])) keep.pop();
    if (!keep.length) continue;
    if (cutHere) { keep.push(`[rest of ${p.key} omitted]`); truncated.push(`page text on ${p.key}`); }
    keep.forEach((l) => emitted.add(ekey(l)));
    pageOut.push(`[site: ${p.key}]`, ...keep);
    pageChars += n;
  }

  // 1c) FILTER FACTS — the attributes the Explore filters are built on.
  //
  // The pricing pass above answers "what does it cost". It was the whole dossier for a
  // long time, which meant a crawl could contain "outside catering allowed" or "sleeps up
  // to 40" and the dossier would drop it: measured on 345 CO venues, indoor/outdoor
  // appeared in 28% of RAW crawled text but only 7% of dossiers, on-site lodging 37% vs
  // 17%, alcohol policy 18% vs 2%. Those facts were fetched and then thrown away.
  // Capturing them here means every future region gets them for free, with no backfill.
  const filterLines = [];
  let filterChars = 0;
  outerF: for (const p of pages) {
    if (p.calendar) continue;
    for (const raw of p.lines) {
      if (raw.length < 25 || !FILTER_FACT.test(raw) || NOISE.test(raw) || crossPage(raw) || emitted.has(ekey(raw))) continue;
      const line = cutAtSentence(raw, 400).text;
      if (filterChars + line.length > BUDGET.filter) { truncated.push('filter facts'); break outerF; }
      emitted.add(ekey(raw));
      filterLines.push(line);
      filterChars += line.length;
    }
  }

  // 2) REVIEWS — every review on file (Places returns at most 5), wedding-relevant first.
  // Each carries a STABLE id = its position in harvest.json plus its month and stars
  // (plan item 17): drafters merged two reviews into "the same review", and the date floor
  // needs to know which month an entry quotes. Cut on a sentence boundary, never mid-word —
  // a review cut at "There is no ..." was completed by a drafter with invented text.
  const allReviews = (h.google?.reviews || []).map((r, i) => ({ ...r, id: `r${i + 1}`, month: reviewMonth(r.when, h.fetched_at), text: squash(r.text) }));
  const label = (r) => `[${r.id} ${r.month} ${r.rating ?? '?'}★]`;
  const revs = allReviews.slice()
    .sort((a, b) => (WEDDINGY.test(b.text) ? 1 : 0) - (WEDDINGY.test(a.text) ? 1 : 0) || b.text.length - a.text.length)
    .map((r) => {
      const c = cutAtSentence(r.text, BUDGET.review);
      if (c.cut) truncated.push(`review ${r.id}`);
      return `- ${label(r)} ${c.text}${c.cut ? ' [rest of review omitted]' : ''}`;
    });

  // 3) region-digest lines naming this vendor, each with a stable id
  const key = nameKey(h.name);
  const digestHits = [];
  if (key.length >= 5) {
    outerD: for (const d of digests) {
      for (let li = 0; li < d.lines.length; li++) {
        let l = d.lines[li];
        if (!nameKey(l).includes(key)) continue;
        // A per-vendor digest file opens with a "## <Vendor> (City)" heading and the facts
        // sit UNDER it; the heading alone told a drafter nothing. Take the section body.
        if (/^#+\s/.test(l.trim())) {
          const body = [];
          for (let j = li + 1; j < d.lines.length && !/^#+\s/.test(d.lines[j].trim()); j++) if (d.lines[j].trim()) body.push(d.lines[j].trim());
          if (!body.length) continue;
          l = body.join(' ');
        }
        const id = `d${digestHits.length + 1}`;
        const c = cutAtSentence(l, BUDGET.digestLen);
        if (c.cut) truncated.push(`digest ${id}`);
        digestHits.push({ id, tag: d.tag, text: c.text + (c.cut ? ' [rest omitted]' : ''), full: squash(l) });
        if (digestHits.length >= BUDGET.digestN) break outerD;
      }
    }
  }

  // 4) reddit slice: chunks (one per `--- reddit ...` header), each with a stable id;
  // property-basis chunks (about THIS vendor) before region-basis market context.
  const rs = path.join(dir, 'reddit-slice.txt');
  const redditFull = fs.existsSync(rs) ? decode(fs.readFileSync(rs, 'utf8')).trim() : '';
  const chunks = [];
  for (const line of redditFull ? redditFull.split('\n') : []) {
    if (/^---/.test(line) || !chunks.length) chunks.push({ head: /^---/.test(line) ? line : '', body: /^---/.test(line) ? [] : [line] });
    else chunks[chunks.length - 1].body.push(line);
  }
  for (let i = chunks.length - 1; i >= 0; i--) if (!chunks[i].body.join('').trim()) chunks.splice(i, 1);
  chunks.forEach((c, i) => { c.id = `rd${i + 1}`; c.head = c.head ? c.head.replace(/^---\s*/, `--- [${c.id}] `) : `--- [${c.id}]`; c.body = c.body.join('\n').trim(); });
  const redditOut = [];
  let redditChars = 0;
  for (const c of chunks.slice().sort((a, b) => /basis=property/.test(b.head) - /basis=property/.test(a.head))) {
    const room = BUDGET.reddit - redditChars;
    const len = c.head.length + c.body.length + 1;
    if (len <= room) { redditOut.push(c.head, c.body); redditChars += len; continue; }
    if (room > 300) {
      const cut = cutAtSentence(c.body, room - c.head.length);
      redditOut.push(c.head, `${cut.text} [rest of reddit excerpt ${c.id} omitted]`);
      redditChars = BUDGET.reddit;
    }
    truncated.push(`reddit ${c.id}`);
  }
  const pdfs = (h.pdfs || []).slice(0, 2);

  // 5) watch-outs — sourced negative/caveat signal that a positivity-skewed review set
  // would otherwise bury. Candidate material, not a mandate: an EMPTY section is correct
  // and common (Places exposes only 5 "most relevant" reviews, which skew positive), and
  // the section is then omitted. Order: <= 3-star reviews (the review itself is the
  // signal), then negative sentences from any review, then name-matched digests, then
  // reddit. Each item names its source id so a drafter can attribute it.
  const watchOuts = [];
  const wseen = new Set();
  const pushWatch = (lbl, text, max = BUDGET.watchLen) => {
    const c = cutAtSentence(text, max);
    const t = c.text + (c.cut && !c.text.endsWith('…') ? ' [rest omitted]' : '');
    const k = norm(t).slice(0, 60);
    if (t.length < 15 || wseen.has(k)) return false;
    wseen.add(k);
    watchOuts.push(`- ${lbl} ${t}`);
    return watchOuts.length >= BUDGET.watchN; // true = section full, stop scanning
  };
  const negSents = (t, caveatOnly) => sentencesOf(t).filter((s) => negativeSignal(s, caveatOnly));
  outerW: {
    for (const r of allReviews) {
      if ((r.rating ?? 5) > 3) continue;
      // the low rating IS the signal: carry the review's own opening sentences, which is
      // where the complaint is ("Dough was super soggy ... the middle sunk")
      if (pushWatch(label(r), r.text, 400)) break outerW;
    }
    for (const r of allReviews) {
      if ((r.rating ?? 5) <= 3) continue;
      for (const s of negSents(r.text, (r.rating ?? 5) >= 5)) if (pushWatch(label(r), s)) break outerW;
    }
    for (const d of digestHits) for (const s of negSents(d.full)) if (pushWatch(`[${d.id} ${d.tag}]`, s)) break outerW;
    // Region-basis chunks are market context shared by every vendor of the type ("FOOD
    // TRUCK SERVICE SPEED is the most-cited failure mode" landed on every caterer): a
    // warning there is not about THIS vendor, so only property-basis chunks feed watch-outs.
    for (const c of chunks) {
      if (/basis=region/.test(c.head)) continue;
      for (const s of negSents(c.body)) if (pushWatch(`[${c.id} reddit]`, s)) break outerW;
    }
  }

  // 6) identity check (plan item 7) — sidecar for gates, marker for drafters.
  const id = checkIdentity(h, dir);

  // 7) header + machine-greppable markers (plan item 6). These prefixes are a CONTRACT:
  // `pipeline.mjs` / `upload.mjs` / the review sweep key on them. Each one starts a line.
  //   IDENTITY CHECK: FAILED   the site likely is a different business / not in Colorado
  //   NO WEBSITE ON FILE       no site URL at all: nothing first-party was read
  //   SITE CRAWL FAILED        a site exists but its home page could not be read
  //   SITE TEXT THIN           the site was read but returned almost no text (JS-rendered)
  //   SITE PAGES UNREAD        some linked subpages failed; absence below is not absence there
  //   OTHER ACTS EXCLUDED      sibling-act pages on a shared agency site were dropped
  //   SOURCE TRUNCATED         one or more sources are shown in part
  const site = h.website || h.google?.websiteUri;
  const failedPages = (h.pages || []).filter((p) => p.error);
  const markers = [];
  if (id.flagged) markers.push(`IDENTITY CHECK: FAILED — ${id.reasons.join('; ')}. The website on file likely belongs to a different business, or this vendor is not in Colorado. Do not draft entries from this dossier; report the vendor instead.`);
  if (!site) markers.push('NO WEBSITE ON FILE — nothing from the vendor\'s own site was read. Never write that something is absent from their site or online ("no pricing posted", "nothing says they do weddings", "no website"); say only what the sources below contain.');
  else if (h.site_error) markers.push(`SITE CRAWL FAILED (${h.site_error}) — the vendor's site exists but could not be read. Never write that something is absent from their site or online; say only what the sources below contain.`);
  else if (siteChars < 600) markers.push(`SITE TEXT THIN (${siteChars} chars) — the site returned almost no readable text (likely script-rendered). Treat it like a failed read: never claim something is absent from their site.`);
  if (siblings.size) markers.push(`OTHER ACTS EXCLUDED: ${siblings.size} crawled page(s) belong to other acts on this shared site (${[...siblings].slice(0, 4).join(', ')}) and were left out — nothing about those acts applies to this vendor.`);
  if (site && !h.site_error && failedPages.length) markers.push(`SITE PAGES UNREAD: ${failedPages.length} of ${(h.pages || []).length - 1} linked pages could not be read (${failedPages.map((p) => { try { return new URL(p.url).pathname; } catch { return p.url; } }).slice(0, 4).join(', ')}) — absence from the pages below is not absence from the site.`);

  const sections = [
    { key: 'price', trim: 1, title: `## ${profile.dossierPriceTitle}`, lines: priceOut.length ? priceOut : [site && !h.site_error && siteChars >= 600 ? '(no priced lines found on the pages read)' : '(no site pages read)'] },
    // soft keyword lines ride in their own section so the cap can drop them FIRST
    { key: 'price extras', trim: 7, title: '[other pricing/offering mentions]', lines: extra },
    { key: 'pdf', trim: 0, title: '', lines: [pdfNote(h, pdfs)].filter(Boolean) },
    { key: 'pages', trim: 4, title: '## wedding/event/FAQ page text', lines: pageOut },
    { key: 'filter', trim: 5, title: '## filter facts (catering, spaces, lodging, services, policies)', lines: filterLines },
    { key: 'reviews', trim: 2, title: `## google reviews (${revs.length} on file of ${h.google?.ratingCount ?? '?'} total; id, month, stars)`, lines: revs },
    { key: 'watch', trim: 0, title: '## watch-outs (sourced negatives/caveats only; quote or paraphrase, never escalate)', lines: watchOuts },
    { key: 'digests', trim: 6, title: '## region pricing digests', lines: digestHits.map((d) => `- [${d.id} ${d.tag}] ${d.text}`) },
    { key: 'reddit', trim: 3, title: '## reddit', lines: redditOut },
  ];
  const build = () => {
    const head = [
      `# ${h.name} (${h.city || '?'}) — vendor_id=${h.vendor_id}`,
      `site=${site || 'none'}${h.instagram ? ` | instagram=@${h.instagram}` : ''} | google ${h.google?.rating ?? '?'}★ × ${h.google?.ratingCount ?? '?'}${h.site_error ? ` | SITE CRAWL FAILED (${h.site_error})` : ''}${site ? '' : ' | NO WEBSITE ON FILE'}`,
      ...markers,
      ...(truncated.length ? [`SOURCE TRUNCATED: ${fmtTruncated(truncated)} — shown in part only. Never finish a cut-off sentence or treat a cut source as the whole story.`] : []),
      h.google?.summary ? `google summary: ${squash(h.google.summary)}` : '',
    ].filter(Boolean);
    return [head.join('\n'), ...sections.filter((s) => s.lines.length).map((s) => (s.title ? `\n${s.title}\n` : '') + s.lines.join('\n'))].join('\n');
  };
  let text = build();
  // Whole-dossier cap: trim whole trailing LINES from the lowest-value section first
  // (soft pricing keywords, then digests, filter facts, page text, reddit, reviews, the
  // hard-figure pricing last), and declare it. Reddit sits high because it is the
  // strongest first-hand signal and drives the entry count in pipeline.mjs. Never a blind
  // character slice: that is what cut the old fee table.
  while (text.length > CAP) {
    const s = sections.filter((x) => x.trim && x.lines.length > (x.trim >= 3 ? 0 : 1)).sort((a, b) => b.trim - a.trim)[0];
    if (!s) break;
    s.lines.pop();
    // never leave a dangling source label ("[site: home]", "--- [rd2] reddit ...") with its body gone
    while (s.lines.length && /^(\[site: |--- \[rd|…$)/.test(s.lines[s.lines.length - 1])) s.lines.pop();
    if (!s.cappedNoted) { truncated.push(`${s.key} (dossier size cap)`); s.cappedNoted = true; }
    text = build();
  }

  const outDir = OUT ? path.join(OUT, slug) : dir;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'dossier.md'), text + '\n');
  fs.writeFileSync(path.join(outDir, 'identity.json'), JSON.stringify({ vendor_id: h.vendor_id, name: h.name, ...id }, null, 2) + '\n');
  done++;
  if (/\$\s?\d/.test(text)) withDollar++;
  if (id.flagged) idFlagged++;
  if (!site) noSite++;
  else if (h.site_error) crawlFailed++;
  if (truncated.length) truncatedAny++;
  totalChars += text.length;
}
console.log(`dossiers written: ${done}${OUT ? ` → ${OUT}` : ''} | containing $ figures: ${withDollar} | avg ~${Math.round(totalChars / Math.max(done, 1) / 4)} tokens each`);
console.log(`markers: IDENTITY CHECK FAILED ${idFlagged} | NO WEBSITE ON FILE ${noSite} | SITE CRAWL FAILED ${crawlFailed} | SOURCE TRUNCATED ${truncatedAny}`);
