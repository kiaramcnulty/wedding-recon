// Merge a user-provided Google Maps scrape CSV (Outscraper-style headers) into the workdir's working CSV.
// usage: node --env-file=.env.local .claude/skills/launchvendors/scripts/ingest.mjs <workdir> <scrape.csv> [--type photographer]
import fs from 'node:fs';
import path from 'node:path';
import { parseCSV, readVenues, writeVenues, nameKey, parseCityState, cleanWebsite, cleanInstagram, typeProfile } from './lib.mjs';

const [workdir, scrape] = process.argv.slice(2);
if (!workdir || !scrape || scrape.startsWith('--')) { console.error('usage: ingest.mjs <workdir> <scrape.csv> [--type photographer]'); process.exit(1); }
if (!fs.existsSync(scrape)) { console.error(`no such file: ${scrape}`); process.exit(1); }
const profile = typeProfile();

const rows = parseCSV(fs.readFileSync(scrape, 'utf8'));
const hdr = (rows[0] || []).map((h) => h.toLowerCase().trim());
const col = (...names) => { for (const n of names) { const i = hdr.indexOf(n); if (i !== -1) return i; } return -1; };
const I = {
  name: col('title', 'name'), address: col('address', 'full_address'), website: col('website', 'site'),
  lat: col('latitude', 'lat'), lng: col('longitude', 'lng', 'lon'), pid: col('place_id', 'placeid'),
  ig: col('instagram', 'ig'),
};
if (I.name === -1) { console.error('scrape CSV has no title/name column'); process.exit(1); }

const file = path.join(workdir, profile.csv);
const venues = readVenues(file);
const seenPid = new Set(venues.map((v) => v.place_id).filter(Boolean));
const seenName = new Set(venues.map((v) => nameKey(v.name, profile) + '|' + nameKey(v.city, null)));

let added = 0, dup = 0;
for (const r of rows.slice(1)) {
  const name = (r[I.name] || '').trim();
  if (!name) continue;
  const pid = I.pid !== -1 ? (r[I.pid] || '').trim() : '';
  const { city, state, cleanAddress } = parseCityState(I.address !== -1 ? r[I.address] : '', '');
  const nk = nameKey(name, profile) + '|' + nameKey(city, null);
  if ((pid && seenPid.has(pid)) || seenName.has(nk)) { dup++; continue; }
  if (pid) seenPid.add(pid);
  seenName.add(nk);
  venues.push({
    name, address: cleanAddress, city, state,
    website: I.website !== -1 ? cleanWebsite(r[I.website]) : '',
    instagram: profile.captureInstagram && I.ig !== -1 ? cleanInstagram(r[I.ig]) : '',
    lat: I.lat !== -1 ? (r[I.lat] || '').trim() : '', lng: I.lng !== -1 ? (r[I.lng] || '').trim() : '',
    place_id: pid, provenance: 'user-scrape', flags: '',
  });
  added++;
}
writeVenues(file, venues);
console.log(`ingest: +${added} from scrape | ${dup} duplicates skipped | total ${venues.length}`);
