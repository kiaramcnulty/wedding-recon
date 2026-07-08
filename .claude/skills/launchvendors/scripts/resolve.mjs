// Resolve researched candidates (<workdir>/candidates.jsonl) to Google Places -> append to the working CSV.
// Each line: {"name":"...","hint":"City, ST area (optional)","website":"...","instagram":"...","provenance":"reddit:r/Denver-01"}
// usage: node --env-file=.env.local .claude/skills/launchvendors/scripts/resolve.mjs <workdir> --state CO [--type photographer]
import fs from 'node:fs';
import path from 'node:path';
import { readVenues, writeVenues, nameKey, sigTokens, tokensOverlap, parseCityState, placesSearch, websiteWithFallback, cleanWebsite, cleanInstagram, sleep, argValue, typeProfile } from './lib.mjs';

const workdir = process.argv[2];
const state = argValue('state');
if (!workdir || workdir.startsWith('--') || !state) { console.error('usage: resolve.mjs <workdir> --state CO [--type photographer]'); process.exit(1); }
if (!process.env.GOOGLE_PLACES_API_KEY) { console.error('GOOGLE_PLACES_API_KEY missing — run with --env-file=.env.local from the repo root'); process.exit(1); }
const profile = typeProfile();

const file = path.join(workdir, profile.csv);
const candFile = path.join(workdir, 'candidates.jsonl');
if (!fs.existsSync(candFile)) { console.error(`missing ${candFile}`); process.exit(1); }

const venues = readVenues(file);
const seenPid = new Set(venues.map((v) => v.place_id).filter(Boolean));
const knownNames = venues.map((v) => nameKey(v.name, profile));

const cands = fs.readFileSync(candFile, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
let resolved = 0, approx = 0, nomatch = 0, dups = 0, researchSite = 0;
const flagged = [];

for (const c of cands) {
  const key = nameKey(c.name, profile);
  const ig = profile.captureInstagram ? cleanInstagram(c.instagram) : '';
  // Name-level dedup vs everything already in the file (exact, or containment when name is distinctive enough).
  const already = knownNames.some((n) => n === key || (sigTokens(c.name).length >= 2 && (n.includes(key) || key.includes(n))));
  if (already) { dups++; continue; }

  let p = null;
  try { const d = await placesSearch(`${c.name} ${c.hint || state}`); p = d.places?.[0] ?? null; } catch { /* fall through to no-match */ }
  await sleep(120);

  // Match guard: must share a significant name token AND sit in the right state.
  if (p && tokensOverlap(c.name, p.displayName?.text || '', profile.weak) && (p.formattedAddress || '').includes(state)) {
    if (seenPid.has(p.id)) { dups++; console.log(`  = "${c.name}" resolved to a place_id we already have — dropped as duplicate`); continue; }
    const gName = p.displayName.text; // canonical Google name
    const gKey = nameKey(gName, profile);
    const { city, state: st, cleanAddress } = parseCityState(p.formattedAddress, state);
    const exactish = gKey === key || gKey.includes(key) || key.includes(gKey);
    const flags = exactish ? '' : `CHECK: was "${c.name}"`;
    // Prefer Google's own website; fall back to a website surfaced by research (backend-only).
    const gSite = await websiteWithFallback(p.id, p.websiteUri);
    const website = gSite || cleanWebsite(c.website);
    if (!gSite && website) researchSite++;
    venues.push({
      name: gName, address: cleanAddress, city, state: st, website, instagram: ig,
      lat: p.location?.latitude ?? '', lng: p.location?.longitude ?? '', place_id: p.id,
      provenance: c.provenance || 'research', flags,
    });
    seenPid.add(p.id); knownNames.push(gKey); resolved++;
    if (flags) flagged.push(`${gName} | ${flags}`);
  } else {
    // No trusted business match — fall back to a city-centroid approximate row.
    // address stays "City, ST" (no street digits) so the app's dashed approximate-pin heuristic fires.
    const cityHint = (c.hint || '').split(',')[0].replace(/\barea\b/gi, '').trim();
    // No Google place, but keep a website research surfaced (backend-only, non-Google row).
    const researchWebsite = cleanWebsite(c.website);
    if (researchWebsite) researchSite++;
    let row = {
      name: c.name, address: '', city: '', state, website: researchWebsite, instagram: ig, lat: '', lng: '', place_id: '',
      provenance: c.provenance || 'research', flags: 'NO_MATCH;NEEDS_ADDRESS',
    };
    if (cityHint) {
      try {
        const d = await placesSearch(`${cityHint}, ${state}`);
        const g = d.places?.[0];
        if (g && (g.formattedAddress || '').includes(state)) {
          row = { ...row, address: `${cityHint}, ${state}`, city: cityHint, lat: g.location?.latitude ?? '', lng: g.location?.longitude ?? '', flags: 'APPROX;NEEDS_ADDRESS' };
        }
      } catch { /* keep NO_MATCH */ }
      await sleep(120);
    }
    venues.push(row);
    knownNames.push(key);
    if (row.flags.startsWith('APPROX')) approx++; else nomatch++;
    flagged.push(`${c.name} | ${row.flags}`);
  }
}

writeVenues(file, venues);
console.log(`resolve: ${cands.length} candidates | +${resolved} matched | +${approx} approx-centroid | +${nomatch} no-match | ${dups} already-known | +${researchSite} using a research website | total ${venues.length}`);
if (flagged.length) { console.log('\nFLAGGED FOR REVIEW:'); for (const f of flagged) console.log('  ' + f); }
