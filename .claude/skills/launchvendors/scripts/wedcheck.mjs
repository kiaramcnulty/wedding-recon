// Wedding-intent check for sweep-sourced rows (types with a profile `intent` regex).
// A sweep query has wedding intent, but Places pads results with general portrait/family
// studios — this keeps a row only when its NAME or its WEBSITE HOMEPAGE shows wedding
// evidence, and flags the rest for Phase 4 review. Flags, never deletes:
//   NON_WEDDING?    site fetched fine, no wedding/elopement/bridal anywhere
//   WED_UNVERIFIED  no website, or the fetch failed — needs a human glance
// Research-sourced rows (reddit/ig/web provenance) are skipped: their sources are already
// wedding-scoped. Idempotent — already-flagged rows are not re-fetched.
// usage: node --env-file=.env.local .claude/skills/launchvendors/scripts/wedcheck.mjs <workdir> [--type photographer]
import path from 'node:path';
import { readVenues, writeVenues, typeProfile } from './lib.mjs';

const workdir = process.argv[2];
if (!workdir || workdir.startsWith('--')) { console.error('usage: wedcheck.mjs <workdir> [--type photographer]'); process.exit(1); }
const profile = typeProfile();
if (!profile.intent) { console.log(`wedcheck(${profile.key}): no intent config for this type — nothing to do`); process.exit(0); }

const file = path.join(workdir, profile.csv);
const venues = readVenues(file);
const addFlag = (v, f) => { v.flags = v.flags ? `${v.flags};${f}` : f; };

const targets = venues.filter((v) =>
  v.provenance === 'places-sweep' && !/NON_WEDDING|WED_UNVERIFIED/.test(v.flags));

let keptName = 0, keptSite = 0, flaggedNo = 0, flaggedUnv = 0;
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

const CONC = 8;
for (let i = 0; i < queue.length; i += CONC) {
  await Promise.all(queue.slice(i, i + CONC).map(async (v) => {
    if (!v.website) { addFlag(v, 'WED_UNVERIFIED'); flaggedUnv++; return; }
    try {
      if (await siteHasIntent(v.website)) keptSite++;
      else { addFlag(v, 'NON_WEDDING?'); flaggedNo++; }
    } catch { addFlag(v, 'WED_UNVERIFIED'); flaggedUnv++; }
  }));
}

writeVenues(file, venues);
console.log(`wedcheck(${profile.key}): ${targets.length} sweep rows | wedding-evident by name/url ${keptName} | by site ${keptSite} | NON_WEDDING? ${flaggedNo} | WED_UNVERIFIED ${flaggedUnv}`);
const flagged = venues.filter((v) => /NON_WEDDING|WED_UNVERIFIED/.test(v.flags));
if (flagged.length) {
  console.log('\nFLAGGED:');
  for (const v of flagged) console.log(`  ${v.name} (${v.city || '?'}) | ${v.flags}${v.website ? ' | ' + v.website : ''}`);
}
