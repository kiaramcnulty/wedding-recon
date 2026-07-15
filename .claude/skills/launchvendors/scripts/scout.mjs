// Baseline sweep: Places Text Search -> merge into the workdir's working CSV (rows arrive pre-matched with place_id).
// usage: node --env-file=.env.local .claude/skills/launchvendors/scripts/scout.mjs <workdir> --region "Denver, CO" [--type photographer] [--statewide Colorado] [--anchors "Boulder, CO;Golden, CO"]
import fs from 'node:fs';
import path from 'node:path';
import { readVenues, writeVenues, appendPruned, parseCityState, placesSearch, websiteWithFallback, sleep, argValue, typeProfile } from './lib.mjs';

const workdir = process.argv[2];
const region = argValue('region');
const anchors = (argValue('anchors') || '').split(';').map((s) => s.trim()).filter(Boolean);
if (!workdir || workdir.startsWith('--') || !region) {
  console.error('usage: scout.mjs <workdir> --region "Denver, CO" [--type photographer] [--statewide Colorado] [--anchors "Boulder, CO;Golden, CO"]');
  process.exit(1);
}
const profile = typeProfile();
const state = (region.match(/\b([A-Z]{2})\b/) || [])[1];
if (!state) { console.error('--region must include a 2-letter state, e.g. "Denver, CO"'); process.exit(1); }
if (!process.env.GOOGLE_PLACES_API_KEY) { console.error('GOOGLE_PLACES_API_KEY missing — run with --env-file=.env.local from the repo root'); process.exit(1); }

fs.mkdirSync(path.join(workdir, 'research'), { recursive: true });
const file = path.join(workdir, profile.csv);
const venues = readVenues(file);
// seen includes pruned.csv so a re-sweep doesn't resurrect rows wedcheck/junk removed
const seen = new Set([...venues, ...readVenues(path.join(workdir, 'pruned.csv'))].map((v) => v.place_id).filter(Boolean));

// Query intent per type lives in TYPE_PROFILES (lib.mjs) — keep it tight there.
// --statewide <StateName> prepends a generic state-level query (e.g. "wedding photographer
// in Colorado") ahead of the per-anchor queries — the primary net for service-area types.
// A profile may return one query or an array per anchor (music sweeps band + dj + music).
const statewide = argValue('statewide');
const queries = [
  ...(statewide ? [].concat(profile.statewideQuery(statewide)) : []),
  ...[region, ...anchors].flatMap((a) => [].concat(profile.sweepQuery(a))),
];
let added = 0, dup = 0, offState = 0;
const junk = [];
for (const q of queries) {
  let pageToken;
  for (let page = 0; page < 3; page++) {
    let data;
    try { data = await placesSearch(q, pageToken); }
    catch (e) { console.error(`  query failed: "${q}" -> ${e.message}`); break; }
    for (const p of data.places ?? []) {
      if (!p.id) continue;
      if (seen.has(p.id)) { dup++; continue; }
      const { city, state: st, cleanAddress } = parseCityState(p.formattedAddress || '', state);
      if (st !== state) { offState++; continue; }
      seen.add(p.id);
      const name = p.displayName?.text || '';
      const row = {
        name, address: cleanAddress, city, state: st,
        website: '', instagram: '',
        lat: p.location?.latitude ?? '', lng: p.location?.longitude ?? '',
        place_id: p.id, provenance: 'places-sweep', flags: '',
      };
      // Obvious noise by name (schools, AV rentals, nurseries — per-type junkName regex)
      // never enters the CSV; it goes to pruned.csv with a reason (skip the website call).
      if (profile.junkName?.test(name)) { row.flags = 'PRUNED:junk-name'; junk.push(row); continue; }
      row.website = await websiteWithFallback(p.id, p.websiteUri);
      venues.push(row);
      added++;
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
    await sleep(1000);
  }
  await sleep(150);
}
writeVenues(file, venues);
appendPruned(workdir, junk);
console.log(`scout(${profile.key}): ${queries.length} queries | +${added} new | ${dup} repeat | ${offState} out-of-state | ${junk.length} junk-name pruned | total ${venues.length} rows -> ${file}`);
if (junk.length) console.log(`  pruned by name (see pruned.csv): ${junk.map((v) => v.name).join('; ')}`);
