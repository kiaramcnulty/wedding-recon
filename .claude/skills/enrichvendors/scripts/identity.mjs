// Identity check: does the crawled website actually belong to THIS vendor, in Colorado?
//
// Why it exists (2026-10 quality audit, 3 of 27 pilot vendors): the Fairmount Cemetery -
// Little Ivy Chapel row (Denver) pointed at fairmountcemetery.com, a cemetery in Newark, NJ
// ("620 Central Avenue Newark, NJ 07107", 973 numbers), and the bot drafted a Denver
// wedding card from it, photos of New Jersey headstones included. Zack Weld Music's site
// now reads "Atlanta based ... throughout Georgia". Nothing between harvest and draft ever
// asked whether the pages were about the right business, so a drafter read them as fact.
//
// Deterministic and free (no model, no network): it reads the harvested page text only.
// Tuned for LOW FALSE POSITIVES over recall, because a flag blocks drafting: every
// out-of-state signal needs an address-shaped or "based in"-shaped context, a bare state
// or city name never counts (a Denver photographer who shot a wedding in Austin, TX, or a
// planner who does destination weddings in Mexico, must not trip it), and a Colorado
// address or "based in Denver" anywhere on the site outweighs the out-of-state evidence.
//
// Used two ways:
//   - imported by dossier.mjs, which writes research/<slug>/identity.json and puts an
//     `IDENTITY CHECK: FAILED` marker at the top of the dossier;
//   - standalone, as a read-only corpus sweep (prints, writes nothing):
//     node .claude/skills/enrichvendors/scripts/identity.mjs <workdir> [--venues "a;b"] [--all]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming',
};
const STATE_NAMES = Object.values(STATES).sort((a, b) => b.length - a.length); // longest first: "West Virginia" before "Virginia"
// Big non-Colorado metros, used ONLY in a "<X>-based" / "based in <X>" shape. Deliberately
// excludes names Colorado shares (Aurora, Louisville, Lafayette, Englewood, Littleton,
// Westminster, Golden, Salida...), which would flag Front Range vendors.
const OTHER_METROS = ['New York City', 'Salt Lake City', 'Oklahoma City', 'Kansas City', 'Los Angeles', 'San Francisco',
  'San Diego', 'Las Vegas', 'Santa Fe', 'Jackson Hole', 'Park City', 'Atlanta', 'Chicago', 'Dallas', 'Houston',
  'Phoenix', 'Scottsdale', 'Tucson', 'Seattle', 'Portland', 'Brooklyn', 'Boston', 'Nashville', 'Charlotte', 'Miami',
  'Orlando', 'Tampa', 'Minneapolis', 'Omaha', 'Albuquerque', 'Cheyenne', 'Philadelphia', 'Newark', 'Bozeman', 'Boise'];
const CO_AREA = new Set(['303', '719', '720', '970', '983']);
const TOLL_FREE = new Set(['800', '833', '844', '855', '866', '877', '888']);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const OTHER_ABBR = Object.keys(STATES).join('|');
const OTHER_NAMES = STATE_NAMES.map(esc).join('|');
const METROS = OTHER_METROS.map(esc).join('|');

// "Newark, NJ 07107" / "Norcross, Georgia 30071". A ZIP is required: a city+state without
// one is how a portfolio says where it shot a wedding, not where the business is.
const OTHER_ADDR = new RegExp(`\\b[A-Z][A-Za-z.'-]+(?:\\s[A-Z][A-Za-z.'-]+){0,3},?\\s+(${OTHER_ABBR}|${OTHER_NAMES})\\.?,?\\s+(\\d{5})(?:-\\d{4})?\\b`, 'g');
const CO_ADDR = /\b(?:CO|Colo\.?|Colorado),?\s+8[01]\d{3}\b/;
// "based in/out of Georgia", "located in Newark", "Atlanta based", "throughout Georgia".
// The negative lookahead stops "based in Washington Park" (a Denver neighborhood) and
// "based in New York City" double-reading as a state.
const PLACE = `(${OTHER_NAMES}|${METROS})(?![ -]?[A-Z][a-z])`;
// "throughout the state of Utah" is excluded: it is how a page explains that a marriage
// license is valid statewide (Shell Creek Photography), not where the vendor lives. A
// "-based couple/bride" is a client story (Courtney Cyr: "This California based couple").
const BASED_OTHER = new RegExp(`\\b(?:based (?:in|out of)|located in|headquartered in|throughout)\\s+(?:the\\s+)?(?:greater\\s+)?${PLACE}|\\b${PLACE}[- ]based\\b(?!\\s+(?:couple|bride|groom|client|family|guest|friend))`, 'g');
// Colorado named right next to the claim makes it a multi-market vendor, not a relocated
// one: "Colorado & California based", "based in New York City and Denver".
const CO_NEAR = /\b(?:Colorado|Denver|Boulder|Fort Collins|Colorado Springs|Aspen|Vail|Durango|Front Range)\b/;
const BASED_CO = /\b(?:based (?:in|out of)|located in|headquartered in)\s+(?:the\s+)?(?:beautiful\s+|sunny\s+|greater\s+)?(?:[A-Z][a-z]+\s+){0,2}(?:Colorado|CO\b|Denver|Boulder|Fort Collins|Colorado Springs|Front Range|Rocky Mountains?)|\b(?:Denver|Colorado|Boulder)[- ]based\b/;
const PHONE = /\(?\b([2-9]\d\d)\)?[-. ]\s?([2-9]\d\d)[-. ](\d{4})\b/g;
const GENERIC = new Set(('the and llc inc co company of at by for with colorado denver boulder wedding weddings event events ' +
  'photography photographer photo photos studio studios music band dj djs entertainment bridal bride beauty hair makeup ' +
  'artistry floral florals flowers florist design designs catering caterer kitchen venue venues ranch hotel inn suites ' +
  'resort lodge group collective planning planner planners coordination services service and mountain mountains rocky ' +
  'productions creative films film video cinema chapel church garden gardens farm barn estate club center').split(' '));

const tokens = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((t) => t.length >= 3);
const snip = (text, i, n = 70) => text.slice(Math.max(0, i - 15), i + n).replace(/\s+/g, ' ').trim();

/**
 * page-*.txt files that belong to a DIFFERENT act on the same multi-vendor site.
 *
 * When a vendor's website is a SUBPATH of a booking agency's site, the crawl ranks same-host
 * links, and an agency page links every act on its roster. Groove Nation Orchestra
 * (celebrationnationentertainment.com/bands/groove-nation-orchestra/) had its crawl read
 * /bands/diamond-orchestra, /bands/into-the-groove, /bands/next-of-kin and
 * /bands/voodoo-syndicate (2026-10 audit), so four other bands' facts and photos were
 * presented as this one's. Rule: if the site URL has a path, a page under the same PARENT
 * path but outside the vendor's own path is a sibling and is excluded. A vendor whose site
 * is a root domain is untouched — an agency listing its OWN acts is the vendor's content.
 */
export function siblingPageFiles(h) {
  const site = h.website || h.google?.websiteUri;
  const out = new Set();
  let scope;
  try { scope = new URL(site); } catch { return out; }
  const segs = scope.pathname.split('/').filter(Boolean);
  if (segs.length < 2) return out;
  const leafTokens = (seg) => tokens(seg.replace(/\.(html?|php|aspx?)$/i, '').replace(/[-_]/g, ' ')).filter((t) => !STOP.has(t));
  const own = leafTokens(segs[segs.length - 1]);
  // Only when the vendor's own leaf IS a name slug (groove-nation-orchestra, vail-haus,
  // denver). A generic leaf (/overview, /weddings.aspx) means the site is the vendor's own
  // property section, and its neighbours are the same business (Ritz-Carlton dining pages).
  const nameToks = new Set(tokens(h.name));
  if (!own.some((t) => nameToks.has(t))) return out;
  const parent = '/' + segs.slice(0, -1).join('/');
  const host = scope.host.replace(/^www\./, '');
  for (const p of h.pages || []) {
    if (!p.file) continue;
    let u;
    try { u = new URL(p.url); } catch { continue; }
    if (u.host.replace(/^www\./, '') !== host) continue;
    const ps = u.pathname.split('/').filter(Boolean);
    // a page BESIDE the vendor's page: same parent, a different segment where the vendor's
    // leaf sits (/visit/houston/private-events beside /visit/denver, Meow Wolf)
    const at = segs.length - 1;
    if (ps.length < segs.length || '/' + ps.slice(0, at).join('/') !== parent || ps[at] === segs[at]) continue;
    const leaf = ps[at];
    if (GENERIC_LEAF.test(leaf.replace(/\.(html?|php|aspx?)$/i, ''))) continue; // the agency /faq, /contact apply to every act
    const lt = leafTokens(leaf);
    // Same act under an alternate slug (chateau-breckenridge vs chateau-of-breckenridge)
    // shares most words BOTH ways; "into-the-groove" shares one of three with
    // "groove-nation-orchestra", so it is a sibling.
    const shared = lt.filter((t) => own.includes(t)).length;
    if (lt.length && shared / lt.length > 0.5 && shared / own.length > 0.5) continue;
    out.add(p.file);
  }
  return out;
}
const STOP = new Set(['the', 'and', 'for', 'with', 'into', 'our']);
const GENERIC_LEAF = /^(faqs?|contact(-us)?|about(-us)?|inquir[ey]|inquiry|book(ing)?|pricing|rates|polic(y|ies)|terms|index|home|weddings?|events?|gallery|reviews|testimonials|services?|introduction)$/i;

// A street address inside a privacy policy, DMCA notice or data-request block is the
// website PLATFORM, not the vendor (2026-10 sweep: Briadair's Bloom.io privacy page,
// "Vancouver, WA"; Camp Hale's concessionaire "Attention: Data Privacy ... Buffalo, New York").
const LEGAL_CONTEXT = /privacy|dmca|copyright|designated agent|data (protection|request)|attention:|terms of (use|service)|legal notice|send a letter|operated by|principal place of business|agreement/i;
// A parked domain is a wrong website with no address at all (Sanctuary Golf Course,
// Sedalia: sanctuarygolf.com is a "Premium Domain For Sale" page).
const PARKED = /\bdomain (?:name )?(?:is |may be )?for sale\b|\bbuy this domain\b|\bthis domain (?:is|may be) (?:for sale|available)\b|\bpremium domain\b/i;

/**
 * Score one harvested vendor. Returns { flagged, warn, score, reasons[], signals }.
 *
 * STRONG signals: an out-of-state street address (state + ZIP, outside legal boilerplate)
 * with no Colorado address on the site; a "based in / -based / throughout <other state or
 * metro>" claim on a site with no Colorado anchor (CO address, CO phone, "based in
 * Denver"); a parked/for-sale domain. WEAK signals: only non-Colorado phone numbers; a
 * long site that never mentions Colorado or the vendor city; a site name sharing no
 * distinctive word with the vendor name.
 *
 * flagged (blocks drafting) = a parked domain, OR a strong signal on a site that never
 * talks about Colorado, OR a strong signal corroborated by a second strong or weak one.
 * A single strong signal on a site that DOES talk about Colorado is a multi-market vendor
 * or a portfolio story (Harlow Events lists a Seattle wedding venue's address; Brite Beauty
 * has a Dallas studio AND serves Colorado), so it is not enough. Weak-only = `warn`, which
 * is recorded in identity.json for the review sweep but never blocks: a Colorado planner
 * with a Michigan cell number and a sparse site (Karis Elizabeth Weddings) is not wrong.
 */
export function checkIdentity(h, dir) {
  // Legal pages (privacy, terms, DMCA) are the site PLATFORM talking, never the vendor.
  const siblings = siblingPageFiles(h);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^(home|page-.*|pdf-.*)\.txt$/.test(f) && !/privacy|terms|legal|dmca|cookie|policy/i.test(f) && !siblings.has(f)) : [];
  const text = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const signals = { site_text_chars: text.length };
  const strong = [], weak = [];
  if (text.length < 200) return { flagged: false, warn: false, score: 0, reasons: [], signals };

  if (PARKED.test(text.slice(0, 3000))) strong.push('parked / for-sale domain, not a vendor site');

  // Distinct LINES naming Colorado or the vendor city: one passing mention ("destination
  // weddings at ... Aspen, Colorado") is not a Colorado business; nav + copy that keep
  // saying it is.
  const city = (h.city || '').trim();
  const coRe = new RegExp(`\\bcolorado\\b|,\\s?CO\\b|\\b8[01]\\d{3}\\b${city.length >= 4 ? `|\\b${esc(city)}\\b` : ''}`, 'i');
  const coLines = new Set(text.split('\n').map((l) => l.trim()).filter((l) => coRe.test(l))).size;
  signals.co_lines = coLines;

  const phones = [...new Set([...text.matchAll(PHONE)].map((m) => `${m[1]}-${m[2]}-${m[3]}`))].filter((p) => !TOLL_FREE.has(p.slice(0, 3)));
  const coPhones = phones.filter((p) => CO_AREA.has(p.slice(0, 3)));
  const otherPhones = phones.filter((p) => !CO_AREA.has(p.slice(0, 3)));
  signals.phones = { co: coPhones.slice(0, 3), other: otherPhones.slice(0, 3) };

  const otherAddr = [...text.matchAll(OTHER_ADDR)]
    .filter((m) => (STATES[m[1]] || m[1]) !== 'Colorado')
    .filter((m) => !LEGAL_CONTEXT.test(text.slice(Math.max(0, m.index - 250), m.index)));
  const coAddr = CO_ADDR.test(text);
  signals.other_addresses = [...new Set(otherAddr.map((m) => m[0].replace(/\s+/g, ' ')))].slice(0, 3);
  signals.co_address = coAddr;
  if (otherAddr.length && !coAddr) strong.push(`out-of-state address "${signals.other_addresses[0]}" and no Colorado address on the site`);

  // A "based in" phrase is the noisiest signal: on a real Colorado site it is usually about
  // someone ELSE (a touring act on a concert venue page, a DJ quoted in a testimonial, a
  // golf club management firm "located in Scottsdale, AZ"; all seen in the 2026-10 sweep).
  // So it only counts when the site has NO Colorado anchor at all.
  const basedOther = [...text.matchAll(BASED_OTHER)].filter((m) => !CO_NEAR.test(text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 80)));
  const basedCo = BASED_CO.test(text);
  signals.based_other = [...new Set(basedOther.map((m) => snip(text, m.index, 60)))].slice(0, 3);
  signals.based_co = basedCo;
  if (basedOther.length && !basedCo && !coAddr && !coPhones.length) strong.push(`site says "${signals.based_other[0]}"`);

  if (otherPhones.length && !coPhones.length) weak.push(`only non-Colorado phone area codes (${[...new Set(otherPhones.map((p) => p.slice(0, 3)))].join(', ')})`);
  if (!coLines && text.length >= 1500) weak.push('site never mentions Colorado or the vendor city');

  // Name check against what the site calls itself: the <title> line stripTags leaves at the
  // top of home.txt, plus the host. Generic words ("colorado", "wedding", "photography")
  // are excluded or every vendor would match every site; with nothing distinctive left the
  // check is skipped rather than guessed.
  const home = fs.existsSync(path.join(dir, 'home.txt')) ? fs.readFileSync(path.join(dir, 'home.txt'), 'utf8') : '';
  const homeUrl = (h.pages || []).find((p) => p.kind === 'home')?.url || h.website || h.google?.websiteUri || '';
  let host = '';
  try { host = new URL(homeUrl).host.replace(/^www\./, '').toLowerCase(); } catch { /* no site */ }
  const distinctive = tokens(h.name).filter((t) => !GENERIC.has(t));
  const siteSide = `${host.replace(/[^a-z0-9]/g, '')} ${tokens(home.slice(0, 1500)).join(' ')}`;
  const nameShared = distinctive.some((t) => siteSide.includes(t));
  signals.name_check = distinctive.length ? (nameShared ? 'match' : 'mismatch') : 'skipped';
  if (distinctive.length && !nameShared) weak.push(`site (${host || 'no host'}) shares no distinctive word with "${h.name}"`);

  const parked = strong.some((r) => r.startsWith('parked'));
  const flagged = parked || (strong.length > 0 && (coLines < 2 || strong.length + weak.length >= 2));
  return { flagged, warn: !flagged && strong.length + weak.length > 0, score: strong.length * 2 + weak.length, reasons: [...strong, ...weak], signals };
}

// ── standalone read-only sweep ────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const workdir = process.argv[2];
  if (!workdir || workdir.startsWith('--')) { console.error('usage: identity.mjs <workdir> [--venues "a;b"] [--all]'); process.exit(1); }
  const i = process.argv.indexOf('--venues');
  const only = new Set((i === -1 ? '' : process.argv[i + 1] || '').split(';').map((s) => s.trim()).filter(Boolean));
  const all = process.argv.includes('--all');
  const researchDir = path.join(workdir, 'research');
  let n = 0, flagged = 0;
  for (const slug of fs.readdirSync(researchDir).sort()) {
    const dir = path.join(researchDir, slug);
    if (!fs.existsSync(path.join(dir, 'harvest.json')) || (only.size && !only.has(slug))) continue;
    const h = JSON.parse(fs.readFileSync(path.join(dir, 'harvest.json'), 'utf8'));
    const r = checkIdentity(h, dir);
    n++;
    if (r.flagged) flagged++;
    if (r.flagged || (all && r.warn)) console.log(`${r.flagged ? 'FLAG' : 'warn'} ${slug} (score ${r.score}): ${r.reasons.join('; ')}`);
  }
  console.log(`identity check: ${flagged} flagged of ${n} vendors`);
}
