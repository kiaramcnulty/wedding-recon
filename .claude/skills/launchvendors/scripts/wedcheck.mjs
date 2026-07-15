// Wedding-intent check for sweep-sourced rows (types with a profile `intent` regex).
// A sweep query has wedding intent, but Places pads results with noise (portrait studios,
// music schools, everyday flower shops, corporate caterers). Evidence is checked in cost
// order — NAME/URL → WEBSITE HOMEPAGE → GOOGLE REVIEWS (Kiara's rule: a review describing
// their wedding rescues a vendor whose site never says "wedding") — and rows with no
// evidence anywhere are PRUNED, not flagged (Kiara, 2026-07: humans skim large lists,
// they don't audit them). Pruned rows move to <workdir>/pruned.csv with a reason; a
// reddit-vouched vendor re-enters later via the research/candidates path.
//   kept       name/url, site, or reviews show wedding|bridal|... evidence
//   PRUNED:non-wedding   site read fine + reviews read fine, zero wedding evidence
//   PRUNED:no-evidence   no website at all and no wedding evidence in reviews
//   WED_UNVERIFIED       has a website we could NOT read and reviews don't rescue it —
//                        the only case a human still glances at (kept, flagged)
// Research-sourced rows (reddit/ig/web provenance) are skipped: their sources are already
// wedding-scoped. Idempotent — flagged/pruned rows are not re-fetched or resurrected.
// usage: node --env-file=.env.local .claude/skills/launchvendors/scripts/wedcheck.mjs <workdir> [--type music]
import path from 'node:path';
import { readVenues, writeVenues, appendPruned, placeDetails, sleep, typeProfile } from './lib.mjs';

const workdir = process.argv[2];
if (!workdir || workdir.startsWith('--')) { console.error('usage: wedcheck.mjs <workdir> [--type <type>]'); process.exit(1); }
const profile = typeProfile();
if (!profile.intent) { console.log(`wedcheck(${profile.key}): no intent config for this type — nothing to do`); process.exit(0); }

const file = path.join(workdir, profile.csv);
const venues = readVenues(file);

const targets = venues.filter((v) =>
  v.provenance === 'places-sweep' && !/WED_UNVERIFIED/.test(v.flags));

let keptName = 0, keptSite = 0, keptReviews = 0, flaggedUnv = 0;
const pruned = [];
const queue = [];
for (const v of targets) {
  // Name OR website-URL evidence skips the fetch ("boulderweddingphoto.com" speaks for itself).
  if (profile.intent.test(v.name) || profile.intent.test(v.website || '')) { keptName++; continue; }
  queue.push(v);
}

async function siteHasIntent(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(9000),
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WeddingRecon/1.0; +vendor-directory-check)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = (await res.text()).slice(0, 400_000);
  return profile.intent.test(text);
}

// Kiara's rescue rule, mechanized: a Google review describing their wedding keeps the
// row even when the site never says "wedding". Reviews ride the SKU we already pay for.
async function reviewsHaveIntent(placeId) {
  if (!placeId) return false;
  try {
    const d = await placeDetails(placeId, 'reviews');
    await sleep(120);
    return (d.reviews || []).some((r) => profile.intent.test(r.text?.text || r.originalText?.text || ''));
  } catch { return false; }
}

const CONC = 8;
for (let i = 0; i < queue.length; i += CONC) {
  await Promise.all(queue.slice(i, i + CONC).map(async (v) => {
    let siteVerdict = null;                 // true=evidence, false=read-fine-no-evidence, null=unreadable/none
    if (v.website) { try { siteVerdict = await siteHasIntent(v.website); } catch { siteVerdict = null; } }
    if (siteVerdict === true) { keptSite++; return; }
    if (await reviewsHaveIntent(v.place_id)) { keptReviews++; return; }
    if (v.website && siteVerdict === null) {
      // A site exists but we couldn't read it, and reviews don't rescue — the one case
      // that still needs a human glance. Keep, flagged.
      v.flags = v.flags ? `${v.flags};WED_UNVERIFIED` : 'WED_UNVERIFIED';
      flaggedUnv++;
      return;
    }
    v.flags = siteVerdict === false ? 'PRUNED:non-wedding' : 'PRUNED:no-evidence';
    pruned.push(v);
  }));
}

const prunedSet = new Set(pruned);
writeVenues(file, venues.filter((v) => !prunedSet.has(v)));
appendPruned(workdir, pruned);
console.log(`wedcheck(${profile.key}): ${targets.length} sweep rows | kept by name/url ${keptName}, by site ${keptSite}, by reviews ${keptReviews} | PRUNED ${pruned.length} → pruned.csv | WED_UNVERIFIED ${flaggedUnv}`);
if (pruned.length) {
  console.log('\nPRUNED (rescue by moving the row back from pruned.csv):');
  for (const v of pruned) console.log(`  ${v.name} (${v.city || '?'}) | ${v.flags}${v.website ? ' | ' + v.website : ''}`);
}
const flagged = venues.filter((v) => !prunedSet.has(v) && /WED_UNVERIFIED/.test(v.flags));
if (flagged.length) {
  console.log('\nFLAGGED (site exists but unreadable — glance at these):');
  for (const v of flagged) console.log(`  ${v.name} (${v.city || '?'}) | ${v.website}`);
}
