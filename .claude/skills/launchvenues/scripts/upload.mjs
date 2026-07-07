// Bulk-upload venues.csv into Supabase `vendors` (vendor-only placeholder rows, no recon).
// Dry-run by default; nothing is written without --apply. Idempotent: re-runs re-check the DB.
// usage: node --env-file=.env.local .claude/skills/launchvenues/scripts/upload.mjs <workdir> [--apply]
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { readVenues, writeVenues, norm, tokensOverlap, parseCityState, placesSearch, websiteWithFallback, sleep } from './lib.mjs';

const workdir = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!workdir || workdir.startsWith('--')) { console.error('usage: upload.mjs <workdir> [--apply]'); process.exit(1); }
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_PLACES_API_KEY']) {
  if (!process.env[k]) { console.error(`${k} missing — run with --env-file=.env.local from the repo root`); process.exit(1); }
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const file = path.join(workdir, 'venues.csv');
const venues = readVenues(file);
if (!venues.length) { console.error(`no rows in ${file}`); process.exit(1); }

// ── Late-resolve: the user may have filled street addresses during review ────
// A row with an address containing digits but no place_id gets one more Places
// attempt (business match with the token guard; else address geocode for coords only).
let lateResolved = 0, lateGeocoded = 0;
for (const v of venues) {
  if (v.place_id || !/\d/.test(v.address)) continue;
  try {
    const d = await placesSearch(`${v.name} ${v.address}`);
    const p = d.places?.[0];
    if (p && tokensOverlap(v.name, p.displayName?.text || '') && v.state && (p.formattedAddress || '').includes(v.state)) {
      const { city, state, cleanAddress } = parseCityState(p.formattedAddress, v.state);
      Object.assign(v, {
        address: cleanAddress, city: city || v.city, state,
        lat: p.location?.latitude ?? v.lat, lng: p.location?.longitude ?? v.lng,
        place_id: p.id, website: v.website || await websiteWithFallback(p.id, p.websiteUri),
      });
      lateResolved++;
    } else if (!v.lat || !v.lng) {
      const g = (await placesSearch(`${v.address}`)).places?.[0];
      if (g?.location && (!v.state || (g.formattedAddress || '').includes(v.state))) {
        v.lat = g.location.latitude; v.lng = g.location.longitude;   // coords only — an address geocode is not a business place_id
        lateGeocoded++;
      }
    }
  } catch { /* leave row as-is */ }
  await sleep(120);
}

// ── Dedup: DB place_id > DB name+city > within-batch ─────────────────────────
const { data: existing, error } = await supabase
  .from('vendors').select('id, name, city, google_place_id, website').eq('vendor_type', 'venue');
if (error) { console.error('DB read failed:', error.message); process.exit(1); }
const dbPid = new Map(existing.filter((v) => v.google_place_id).map((v) => [v.google_place_id, v]));
const dbName = new Map(existing.map((v) => [norm(v.name) + '|' + norm(v.city || ''), v]));

// An existing DB row that lacks a website but whose CSV twin now has one gets its website
// backfilled (fills blanks only — never overwrites an existing website). Insert is otherwise
// insert-only, so without this a row that first landed website-less stays blank forever.
const toInsert = [], skipDbPid = [], skipDbName = [], skipBatch = [], skipNoName = [], backfill = [];
const batchPid = new Set(), batchName = new Set();
const maybeBackfill = (dbRow, v) => { if (v.website && !(dbRow.website || '').trim()) backfill.push({ id: dbRow.id, name: dbRow.name, website: v.website }); };
for (const v of venues) {
  if (!v.name) { skipNoName.push(v); continue; }
  const nk = norm(v.name) + '|' + norm(v.city);
  if (v.place_id && dbPid.has(v.place_id)) { maybeBackfill(dbPid.get(v.place_id), v); skipDbPid.push(v.name); continue; }
  if (dbName.has(nk)) { maybeBackfill(dbName.get(nk), v); skipDbName.push(`${v.name} ~ ${dbName.get(nk).name}`); continue; }
  if ((v.place_id && batchPid.has(v.place_id)) || batchName.has(nk)) { skipBatch.push(v.name); continue; }
  if (v.place_id) batchPid.add(v.place_id);
  batchName.add(nk);
  toInsert.push(v);
}

const hasLoc = (v) => v.lat !== '' && v.lng !== '' && !Number.isNaN(parseFloat(v.lat)) && !Number.isNaN(parseFloat(v.lng));
const payload = toInsert.map((v) => ({
  name: v.name,
  vendor_type: 'venue',
  google_place_id: v.place_id || null,
  address_text: v.address || null,
  city: v.city || null,
  region: v.state || null,
  website: v.website || null,
  source: v.place_id ? 'google' : 'user',
  location: hasLoc(v) ? `SRID=4326;POINT(${parseFloat(v.lng)} ${parseFloat(v.lat)})` : null,
}));

const noLoc = payload.filter((p) => !p.location).map((p) => p.name);
const approx = toInsert.filter((v) => !v.place_id && hasLoc(v)).map((v) => v.name);

// Reviewable export of exactly what would be inserted (download & spot-check before --apply).
const toInsertCsv = path.join(workdir, 'to-insert.csv');
writeVenues(toInsertCsv, toInsert);

const lines = [];
lines.push(`upload ${APPLY ? 'APPLY' : 'DRY RUN'} — ${file}`);
lines.push(`rows in csv: ${venues.length}${lateResolved ? ` | late-resolved to place_id: ${lateResolved}` : ''}${lateGeocoded ? ` | late-geocoded coords: ${lateGeocoded}` : ''}`);
lines.push(`skip — already in DB by place_id (${skipDbPid.length}): ${skipDbPid.join(', ') || '—'}`);
lines.push(`skip — already in DB by name+city (${skipDbName.length}): ${skipDbName.join('; ') || '—'}`);
lines.push(`skip — duplicate within batch (${skipBatch.length}): ${skipBatch.join(', ') || '—'}`);
if (skipNoName.length) lines.push(`skip — blank name: ${skipNoName.length}`);
if (backfill.length) lines.push(`BACKFILL website on existing rows (${backfill.length}): ${backfill.map((b) => b.name).join(', ')}`);
lines.push(`TO INSERT: ${payload.length}  (google-matched ${payload.filter((p) => p.source === 'google').length}, approximate-pin ${approx.length}, NO LOCATION ${noLoc.length})`);
if (approx.length) lines.push(`  approximate (city-centroid, dashed pin): ${approx.join(', ')}`);
if (noLoc.length) lines.push(`  no location — searchable by name but NO map pin: ${noLoc.join(', ')}`);
lines.push(`to-insert export (for review/download): ${toInsertCsv}`);
console.log(lines.join('\n'));

if (!APPLY) {
  console.log('\nDRY RUN — nothing written. Re-run with --apply after user confirmation.');
  fs.writeFileSync(path.join(workdir, 'upload-report.txt'), lines.join('\n') + '\n');
  process.exit(0);
}

let inserted = [];
if (payload.length) {
  const { data, error: insErr } = await supabase.from('vendors').insert(payload).select('id');
  if (insErr) { console.error('INSERT FAILED (nothing partially written — safe to fix & re-run):', insErr.message); process.exit(1); }
  inserted = data;
}

// ── Backfill websites on existing rows (fills blanks only) ──────────────────────
let backfilled = 0;
for (const b of backfill) {
  const { error: uErr } = await supabase.from('vendors').update({ website: b.website }).eq('id', b.id);
  if (uErr) { console.error(`website backfill failed for ${b.name}: ${uErr.message}`); continue; }
  backfilled++;
}

// ── Verify ────────────────────────────────────────────────────────────────────
const { data: after } = await supabase.from('vendors').select('name, city, google_place_id').eq('vendor_type', 'venue');
const pidCount = new Map(), nameCount = new Map();
for (const v of after ?? []) {
  if (v.google_place_id) pidCount.set(v.google_place_id, (pidCount.get(v.google_place_id) || 0) + 1);
  const nk = norm(v.name) + '|' + norm(v.city || '');
  nameCount.set(nk, (nameCount.get(nk) || 0) + 1);
}
const dupPids = [...pidCount.entries()].filter(([, n]) => n > 1);
const dupNames = [...nameCount.entries()].filter(([, n]) => n > 1);
const verify = [
  `\nAPPLIED: inserted ${inserted.length} venues${backfill.length ? ` | website backfilled on ${backfilled}/${backfill.length} existing rows` : ''} | DB venue total now ${after?.length ?? '?'}`,
  `verify — duplicate place_ids in DB: ${dupPids.length ? dupPids.map(([p]) => p).join(', ') : 'none'}`,
  `verify — duplicate name+city in DB: ${dupNames.length ? dupNames.map(([n]) => n).join('; ') : 'none'}`,
];
console.log(verify.join('\n'));
fs.writeFileSync(path.join(workdir, 'upload-report.txt'), lines.join('\n') + verify.join('\n') + '\n');
