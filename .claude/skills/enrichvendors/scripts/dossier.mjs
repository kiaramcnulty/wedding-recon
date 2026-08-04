// Compress each harvested venue's research into ONE ~800-token dossier.md that a
// single-turn draft call reads inline. This is the v2 cost lever: agents never read
// raw harvest.json / page-*.txt / whole digests — a regex pass extracts the pricing,
// capacity, review, and reddit content for free, and everything else stays on disk.
// Pure filesystem: no DB, no network, no env needed.
// usage: node .claude/skills/enrichvendors/scripts/dossier.mjs <workdir> [--type photographer] [--venues "slug;slug"] [--cap 4000]
import fs from 'node:fs';
import path from 'node:path';
import { norm, argValue } from '../../launchvendors/scripts/lib.mjs';
import { etype } from './etype.mjs';

const workdir = process.argv[2];
if (!workdir || workdir.startsWith('--')) { console.error('usage: dossier.mjs <workdir> [--venues "a;b"] [--cap 4000]'); process.exit(1); }
const CAP = parseInt(argValue('cap') || '4000', 10); // chars; ~= tokens*4
const only = new Set((argValue('venues') || '').split(';').map((s) => s.trim()).filter(Boolean));

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
const WEDDINGY = /wedding|recept|ceremon|bride|groom|married/i;
const nameKey = (s) => norm(s).replace(/\b(the|at|by|of|a)\b/g, ' ').replace(/\s+/g, ' ').trim();

let done = 0, withDollar = 0, totalChars = 0;
for (const slug of fs.readdirSync(researchDir).sort()) {
  const dir = path.join(researchDir, slug);
  if (!fs.existsSync(path.join(dir, 'harvest.json'))) continue;
  if (only.size && !only.has(slug)) continue;
  const h = JSON.parse(fs.readFileSync(path.join(dir, 'harvest.json'), 'utf8'));

  // 1) pricing/capacity lines from site text — pricing-ish pages first, then home
  const pageFiles = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.txt') && f !== 'reddit-slice.txt')
    .sort((a, b) => (/pric|packag|rate|invest|wedding|event|faq|rental/i.test(a) ? 0 : 1) - (/pric|packag|rate|invest|wedding|event|faq|rental/i.test(b) ? 0 : 1));
  const seen = new Set();
  const priceLines = [];
  let priceChars = 0;
  let shortKept = 0; // budget for bare PDF-table cells (see the short-line branch below)
  outer: for (const pf of pageFiles) {
    for (const raw of fs.readFileSync(path.join(dir, pf), 'utf8').split('\n')) {
      const line = raw.trim();
      // PDF rate cards are TABLES: the price sits in its own cell, so it extracts as a
      // line of its own ("$6500", "Max Guest Count 180"). A flat 20-char floor silently
      // dropped exactly the headline numbers the filters need, keeping only the chattier
      // hourly-rate prose around them. Keep short lines when they carry a figure.
      const short = line.length < 20;
      if (short) {
        // Bare table cells. Require a SUBSTANTIAL figure (3+ digits) or a capacity
        // phrase: a rate card's back page is a fee schedule ($3 corkage, $15 easel), and
        // letting those through both drowns the package rates and hands the extractor a
        // plausible-looking false floor. Cap the count so a fee table can't dominate.
        const substantial = /\$\s?\d{3,}|\$\s?\d{1,3},\d{3}/.test(line);
        const capacityish = /\b\d{2,4}\s*(guests?|people)\b|max guest/i.test(line);
        if ((!substantial && !capacityish) || shortKept >= 12) continue;
        shortKept++;
      } else if (line.length > 300) continue;
      if (!PRICE_LINE.test(line) || NOISE.test(line)) continue;
      const k = norm(line).slice(0, 80);
      if (seen.has(k)) continue;
      seen.add(k);
      priceLines.push(line);
      priceChars += line.length;
      if (priceChars > 1500) break outer;
    }
  }

  // 1b) FILTER FACTS — the attributes the Explore filters are built on.
  //
  // The pricing pass above answers "what does it cost". It was the whole dossier for a
  // long time, which meant a crawl could contain "outside catering allowed" or "sleeps up
  // to 40" and the dossier would drop it: measured on 345 CO venues, indoor/outdoor
  // appeared in 28% of RAW crawled text but only 7% of dossiers, on-site lodging 37% vs
  // 17%, alcohol policy 18% vs 2%. Those facts were fetched and then thrown away.
  // Capturing them here means every future region gets them for free, with no backfill.
  const filterSeen = new Set();
  const filterLines = [];
  let filterChars = 0;
  outerF: for (const pf of pageFiles) {
    for (const raw of fs.readFileSync(path.join(dir, pf), 'utf8').split('\n')) {
      const line = raw.trim();
      if (line.length < 25 || line.length > 260) continue;
      if (!FILTER_FACT.test(line) || NOISE.test(line)) continue;
      if (PRICE_LINE.test(line)) continue; // already carried by the pricing block
      const k = norm(line).slice(0, 70);
      if (filterSeen.has(k)) continue;
      filterSeen.add(k);
      filterLines.push(line);
      filterChars += line.length;
      if (filterChars > 1200) break outerF;
    }
  }

  // 2) top 3 reviews — wedding-relevant first, then longest; trimmed to 400 chars
  const revs = (h.google?.reviews || []).slice()
    .sort((a, b) => (WEDDINGY.test(b.text) ? 1 : 0) - (WEDDINGY.test(a.text) ? 1 : 0) || (b.text?.length || 0) - (a.text?.length || 0))
    .slice(0, 3)
    .map((r) => `- (${r.rating}★ ${r.when || ''}) ${r.text.replace(/\s+/g, ' ').slice(0, 400)}`);

  // 3) region-digest lines naming this venue
  const key = nameKey(h.name);
  const digestHits = [];
  if (key.length >= 5) {
    for (const d of digests) {
      for (const l of d.lines) {
        if (!nameKey(l).includes(key)) continue;
        digestHits.push(`- [${d.tag}] ${l.trim().slice(0, 300)}`);
        if (digestHits.length >= 4) break;
      }
      if (digestHits.length >= 4) break;
    }
  }

  // 4) reddit slice (already pre-cut) + pdf pointers (not fetched — honesty hint only)
  const rs = path.join(dir, 'reddit-slice.txt');
  const redditFull = fs.existsSync(rs) ? fs.readFileSync(rs, 'utf8').trim() : '';
  const reddit = redditFull.slice(0, 900);
  const pdfs = (h.pdfs || []).slice(0, 2);

  // 5) watch-outs — rescue SOURCED negative/caveat signal that the positivity-skewed
  // top-3 review pick and the 900-char reddit cut above would otherwise bury: sub-5★
  // review text, caveat sentences ("...but...", "only downside...") from any review,
  // and negative-valence reddit fragments. This is candidate material, not a mandate —
  // the draft rules forbid inventing criticism, so an empty section is correct and common
  // (Places exposes only 5 "most relevant" reviews, which skew positive). Sub-5★ first
  // (strongest signal), then review caveats, then reddit; capped + deduped.
  const CAVEAT = /\b(but|however|although|only downside|downside|drawback|unfortunately|disappoint|wish (?:they|it|we|the|i)|complaint|the only (?:thing|issue|problem)|slow to|no response|never (?:heard|got|responded)|unrespons|rude|unprofessional|overpriced|pricey|not worth|nickel and dim|hidden fee|watch out|avoid|beware|regret|too (?:small|far|expensive|pricey|tight))\b/i;
  const clip = (s, n) => { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
  const watchOuts = [];
  const wseen = new Set();
  const pushWatch = (label, text) => {
    const t = clip(text, 200);
    const k = norm(t).slice(0, 60);
    if (t.length < 15 || wseen.has(k)) return false;
    wseen.add(k);
    watchOuts.push(`- ${label} ${t}`);
    return watchOuts.length >= 4; // true = section full, stop scanning
  };
  const reviews = h.google?.reviews || [];
  for (const r of reviews) { if ((r.rating ?? 5) <= 4 && pushWatch(`(${r.rating}★)`, r.text)) break; }
  if (watchOuts.length < 4) outerW: for (const r of reviews) {
    for (const sent of (r.text || '').split(/(?<=[.!?])\s+/)) if (CAVEAT.test(sent) && pushWatch('(review)', sent)) break outerW;
  }
  if (watchOuts.length < 4) for (const line of redditFull.split('\n')) if (CAVEAT.test(line) && pushWatch('(reddit)', line)) break;

  const parts = [
    `# ${h.name} (${h.city || '?'}) — vendor_id=${h.vendor_id}`,
    `site=${h.website || h.google?.websiteUri || 'none'}${h.instagram ? ` | instagram=@${h.instagram}` : ''} | google ${h.google?.rating ?? '?'}★ × ${h.google?.ratingCount ?? '?'}${h.site_error ? ` | SITE CRAWL FAILED (${h.site_error})` : ''}`,
    h.google?.summary ? `google summary: ${h.google.summary}` : '',
    `\n## ${profile.dossierPriceTitle}\n${priceLines.length ? priceLines.join('\n') : '(none found on site)'}`,
    // Report what actually happened per PDF. Saying "not fetched" for a file we DID read
    // invites a draft to write "their pricing isn't published" when the rates are sitting
    // in the dossier above; saying nothing about an unreadable scan invites the same
    // error in reverse. `harvest.mjs` records the outcome in `pdf_texts`.
    pdfNote(h, pdfs),
    filterLines.length ? `\n## filter facts (catering, spaces, lodging, services, policies)\n${filterLines.join('\n')}` : '',
    revs.length ? `\n## google reviews (top ${revs.length})\n${revs.join('\n')}` : '',
    watchOuts.length ? `\n## watch-outs (sourced negatives)\n${watchOuts.join('\n')}` : '',
    digestHits.length ? `\n## region pricing digests\n${digestHits.join('\n')}` : '',
    reddit ? `\n## reddit\n${reddit}` : '',
  ].filter(Boolean);
  let text = parts.join('\n');
  if (text.length > CAP) text = text.slice(0, CAP) + '\n[truncated]';
  fs.writeFileSync(path.join(dir, 'dossier.md'), text + '\n');
  done++;
  if (/\$\s?\d/.test(text)) withDollar++;
  totalChars += text.length;
}
console.log(`dossiers written: ${done} | containing $ figures: ${withDollar} | avg ~${Math.round(totalChars / Math.max(done, 1) / 4)} tokens each`);
