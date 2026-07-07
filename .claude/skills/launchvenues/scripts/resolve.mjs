// Resolve researched candidates (<workdir>/candidates.jsonl) to Google Places -> append to venues.csv.
// Each line: {"name":"...","hint":"City, ST area (optional)","provenance":"reddit:r/Denver-01"}
// usage: node --env-file=.env.local .claude/skills/launchvenues/scripts/resolve.mjs <workdir> --state CO
import fs from 'node:fs';
import path from 'node:path';
import { readVenues, writeVenues, norm, sigTokens, tokensOverlap, parseCityState, placesSearch, websiteWithFallback, sleep, argValue } from './lib.mjs';

const workdir = process.argv[2];
const state = argValue('state');
if (!workdir || workdir.startsWith('--') || !state) { console.error('usage: resolve.mjs <workdir> --state CO'); process.exit(1); }
if (!process.env.GOOGLE_PLACES_API_KEY) { console.error('GOOGLE_PLACES_API_KEY missing — run with --env-file=.env.local from the repo root'); process.exit(1); }

const file = path.join(workdir, 'venues.csv');
const candFile = path.join(workdir, 'candidates.jsonl');
if (!fs.existsSync(candFile)) { console.error(`missing ${candFile}`); process.exit(1); }

const venues = readVenues(file);
const seenPid = new Set(venues.map((v) => v.place_id).filter(Boolean));
const knownNames = venues.map((v) => norm(v.name));

const cands = fs.readFileSync(candFile, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
let resolved = 0, approx = 0, nomatch = 0, dups = 0;
const flagged = [];

for (const c of cands) {
  const key = norm(c.name);
  // Name-level dedup vs everything already in the file (exact, or containment when name is distinctive enough).
  const already = knownNames.some((n) => n === key || (sigTokens(c.name).length >= 2 && (n.includes(key) || key.includes(n))));
  if (already) { dups++; continue; }

  let p = null;
  try { const d = await placesSearch(`${c.name} ${c.hint || state}`); p = d.places?.[0] ?? null; } catch { /* fall through to no-match */ }
  await sleep(120);

  // Match guard: must share a significant name token AND sit in the right state.
  if (p && tokensOverlap(c.name, p.displayName?.text || '') && (p.formattedAddress || '').includes(state)) {
    if (seenPid.has(p.id)) { dups++; console.log(`  = "${c.name}" resolved to a place_id we already have — dropped as duplicate`); continue; }
    const gName = p.displayName.text; // canonical Google name
    const { city, state: st, cleanAddress } = parseCityState(p.formattedAddress, state);
    const exactish = norm(gName) === key || norm(gName).includes(key) || key.includes(norm(gName));
    const flags = exactish ? '' : `CHECK: was "${c.name}"`;
    venues.push({
      name: gName, address: cleanAddress, city, state: st, website: await websiteWithFallback(p.id, p.websiteUri),
      lat: p.location?.latitude ?? '', lng: p.location?.longitude ?? '', place_id: p.id,
      provenance: c.provenance || 'research', flags,
    });
    seenPid.add(p.id); knownNames.push(norm(gName)); resolved++;
    if (flags) flagged.push(`${gName} | ${flags}`);
  } else {
    // No trusted business match — fall back to a city-centroid approximate row.
    // address stays "City, ST" (no street digits) so the app's dashed approximate-pin heuristic fires.
    const cityHint = (c.hint || '').split(',')[0].replace(/\barea\b/gi, '').trim();
    let row = {
      name: c.name, address: '', city: '', state, website: '', lat: '', lng: '', place_id: '',
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
console.log(`resolve: ${cands.length} candidates | +${resolved} matched | +${approx} approx-centroid | +${nomatch} no-match | ${dups} already-known | total ${venues.length}`);
if (flagged.length) { console.log('\nFLAGGED FOR REVIEW:'); for (const f of flagged) console.log('  ' + f); }
