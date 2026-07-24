// Bulk-upload the working CSV into Supabase `vendors` (vendor-only placeholder rows, no recon).
// Dry-run by default; nothing is written without --apply. Idempotent: re-runs re-check the DB.
// usage: node --env-file=.env.local .claude/skills/launchvendors/scripts/upload.mjs <workdir> [--type photographer] [--apply]
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { readVenues, writeVenues, nameKey, tokensOverlap, parseCityState, placesSearch, websiteWithFallback, sleep, typeProfile, selectAll } from './lib.mjs';

const workdir = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!workdir || workdir.startsWith('--')) { console.error('usage: upload.mjs <workdir> [--type photographer] [--apply]'); process.exit(1); }
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_PLACES_API_KEY']) {
  if (!process.env[k]) { console.error(`${k} missing — run with --env-file=.env.local from the repo root`); process.exit(1); }
}
const profile = typeProfile();
// A type may fan one sweep across several vendor_types (music → dj|band). typeScope is the
// set of vendor_types this run owns — used for dedup scoping and the final verify. Single-
// type runs (venue, photos, …) keep the original one-element scope, unchanged behavior.
const typeScope = profile.vendorTypes ?? [profile.vendorType];

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const file = path.join(workdir, profile.csv);
const venues = readVenues(file);
if (!venues.length) { console.error(`no rows in ${file}`); process.exit(1); }

// Split types carry each row's vendor_type in the `subtype` column (scout auto-classifies;
// the human may edit it during review). Repair any blank/invalid subtype so every row has a
// concrete type before dedup + insert — a research-merged row with no subtype is classified
// here as a safety net (default = profile.vendorType).
if (profile.vendorTypes) {
  for (const v of venues) {
    if (!profile.vendorTypes.includes(v.subtype)) {
      const guess = profile.classify ? profile.classify(v.name) : '';
      v.subtype = profile.vendorTypes.includes(guess) ? guess : profile.vendorType;
    }
  }
}

// ── Late-resolve: the user may have filled street addresses during review ────
// A row with an address containing digits but no place_id gets one more Places
// attempt (business match with the token guard; else address geocode for coords only).
let lateResolved = 0, lateGeocoded = 0;
for (const v of venues) {
  if (v.place_id || !/\d/.test(v.address)) continue;
  try {
    const d = await placesSearch(`${v.name} ${v.address}`);
    const p = d.places?.[0];
    if (p && tokensOverlap(v.name, p.displayName?.text || '', profile.weak) && v.state && (p.formattedAddress || '').includes(v.state)) {
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

// ── Dedup: DB place_id (GLOBAL) > DB name+city (type-scoped) > within-batch ──
// google_place_id is unique across the WHOLE vendors table, so the pid dedup must span
// all vendor types — a venue that leaked into a photographer sweep is skipped, never
// re-inserted as a new type. Name+city dedup stays type-scoped ("The Broadmoor" the venue
// must not swallow "The Broadmoor Photography"). Types with captureInstagram require
// migration 0016 — the select fails fast with guidance if the column is missing.
// MUST page every row via selectAll: a plain .select() caps at 1000, so on a DB with >1000
// vendors the pid dedup would miss existing place_ids past row 1000 and the insert would
// then trip the global google_place_id unique constraint (ordered by id for stable paging).
const { data: existing, error } = await selectAll(() => supabase
  .from('vendors')
  .select(`id, name, city, vendor_type, google_place_id, website${profile.captureInstagram ? ', instagram' : ''}`)
  .order('id'));
if (error) {
  console.error(error.code === '42703'
    ? 'vendors.instagram column missing — hand-apply supabase/migrations/0016_vendor_instagram.sql in the Supabase SQL editor, then re-run.'
    : `DB read failed: ${error.message}`);
  process.exit(1);
}
const dbPid = new Map(existing.filter((v) => v.google_place_id).map((v) => [v.google_place_id, v]));
// Name+city dedup is scoped to the run's type(s). For a split run this spans BOTH dj and band
// so the same act can't land twice differing only by subtype ("The Groove Band" the band must
// swallow a "The Groove Band" re-swept as a dj).
const dbName = new Map(existing.filter((v) => typeScope.includes(v.vendor_type))
  .map((v) => [nameKey(v.name, profile) + '|' + nameKey(v.city || '', null), v]));

// An existing DB row that lacks a website/instagram but whose CSV twin now has one gets the
// blank backfilled (fills blanks only — never overwrites). Insert is otherwise insert-only,
// so without this a row that first landed website-less stays blank forever.
const toInsert = [], skipDbPid = [], skipDbName = [], skipBatch = [], skipNoName = [], skipOtherType = [], backfill = [];
const batchPid = new Set(), batchName = new Set();
const maybeBackfill = (dbRow, v) => {
  const patch = {};
  if (v.website && !(dbRow.website || '').trim()) patch.website = v.website;
  if (profile.captureInstagram && v.instagram && !(dbRow.instagram || '').trim()) patch.instagram = v.instagram;
  if (Object.keys(patch).length) backfill.push({ id: dbRow.id, name: dbRow.name, patch });
};
for (const v of venues) {
  if (!v.name) { skipNoName.push(v); continue; }
  const nk = nameKey(v.name, profile) + '|' + nameKey(v.city, null);
  if (v.place_id && dbPid.has(v.place_id)) {
    const hit = dbPid.get(v.place_id);
    if (typeScope.includes(hit.vendor_type)) { maybeBackfill(hit, v); skipDbPid.push(v.name); }
    else skipOtherType.push(`${v.name} (already in DB as ${hit.vendor_type})`);
    continue;
  }
  if (dbName.has(nk)) { maybeBackfill(dbName.get(nk), v); skipDbName.push(`${v.name} ~ ${dbName.get(nk).name}`); continue; }
  if ((v.place_id && batchPid.has(v.place_id)) || batchName.has(nk)) { skipBatch.push(v.name); continue; }
  if (v.place_id) batchPid.add(v.place_id);
  batchName.add(nk);
  toInsert.push(v);
}

const hasLoc = (v) => v.lat !== '' && v.lng !== '' && !Number.isNaN(parseFloat(v.lat)) && !Number.isNaN(parseFloat(v.lng));
// `instagram` is only included when a row actually has one, so venue runs (and any run
// with no handles) never reference the column and work without migration 0016.
const payload = toInsert.map((v) => ({
  name: v.name,
  // Split types write the per-row subtype (dj|band); everything else the fixed profile type.
  vendor_type: profile.vendorTypes ? v.subtype : profile.vendorType,
  google_place_id: v.place_id || null,
  address_text: v.address || null,
  city: v.city || null,
  region: v.state || null,
  website: v.website || null,
  ...(profile.captureInstagram && v.instagram ? { instagram: v.instagram } : {}),
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
if (skipOtherType.length) lines.push(`skip — same place exists as ANOTHER vendor type (${skipOtherType.length}): ${skipOtherType.join('; ')}`);
lines.push(`skip — already in DB by name+city (${skipDbName.length}): ${skipDbName.join('; ') || '—'}`);
lines.push(`skip — duplicate within batch (${skipBatch.length}): ${skipBatch.join(', ') || '—'}`);
if (skipNoName.length) lines.push(`skip — blank name: ${skipNoName.length}`);
if (backfill.length) lines.push(`BACKFILL on existing rows (${backfill.length}): ${backfill.map((b) => `${b.name} (${Object.keys(b.patch).join('+')})`).join(', ')}`);
lines.push(`TO INSERT: ${payload.length}  (google-matched ${payload.filter((p) => p.source === 'google').length}, approximate-pin ${approx.length}, NO LOCATION ${noLoc.length}${profile.captureInstagram ? `, with instagram ${toInsert.filter((v) => v.instagram).length}` : ''})`);
if (profile.vendorTypes) lines.push(`  by type (from CSV subtype — review before --apply): ${typeScope.map((t) => `${t} ${payload.filter((p) => p.vendor_type === t).length}`).join(', ')}`);
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

// ── Backfill website/instagram on existing rows (fills blanks only) ─────────────
let backfilled = 0;
for (const b of backfill) {
  const { error: uErr } = await supabase.from('vendors').update(b.patch).eq('id', b.id);
  if (uErr) { console.error(`backfill failed for ${b.name}: ${uErr.message}`); continue; }
  backfilled++;
}

// ── Verify ────────────────────────────────────────────────────────────────────
const { data: after } = await selectAll(() => supabase.from('vendors').select('id, name, city, google_place_id').in('vendor_type', typeScope).order('id'));
const pidCount = new Map(), nameCount = new Map();
for (const v of after ?? []) {
  if (v.google_place_id) pidCount.set(v.google_place_id, (pidCount.get(v.google_place_id) || 0) + 1);
  const nk = nameKey(v.name, profile) + '|' + nameKey(v.city || '', null);
  nameCount.set(nk, (nameCount.get(nk) || 0) + 1);
}
const dupPids = [...pidCount.entries()].filter(([, n]) => n > 1);
const dupNames = [...nameCount.entries()].filter(([, n]) => n > 1);
const verify = [
  `\nAPPLIED: inserted ${inserted.length} ${typeScope.join('+')} vendors${backfill.length ? ` | backfilled ${backfilled}/${backfill.length} existing rows` : ''} | DB ${typeScope.join('+')} total now ${after?.length ?? '?'}`,
  `verify — duplicate place_ids in DB: ${dupPids.length ? dupPids.map(([p]) => p).join(', ') : 'none'}`,
  `verify — duplicate name+city in DB: ${dupNames.length ? dupNames.map(([n]) => n).join('; ') : 'none'}`,
];
console.log(verify.join('\n'));
fs.writeFileSync(path.join(workdir, 'upload-report.txt'), lines.join('\n') + verify.join('\n') + '\n');
