// One-off repair: backfill vendors.website for already-launched venues that have a
// google_place_id but a null/empty website. Text Search routinely omits websiteUri even
// when the place has a site, and the launch upload is insert-only, so these rows never
// self-heal. This fetches Place Details per row and fills the blank.
//
// Dry-run by default (lists what it WOULD write); --apply writes. Idempotent — only ever
// touches rows that are currently missing a website, never overwrites an existing one.
// usage: node --env-file=.env.local .claude/skills/launchvendors/scripts/backfill-websites.mjs [--apply] [--type photographer] [--region CO] [--limit N]
import { createClient } from '@supabase/supabase-js';
import { placeDetails, sleep, argValue, typeProfile } from './lib.mjs';

const APPLY = process.argv.includes('--apply');
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_PLACES_API_KEY']) {
  if (!process.env[k]) { console.error(`${k} missing — run with --env-file=.env.local from the repo root`); process.exit(1); }
}
const profile = typeProfile();
// Split types (music → dj|band) own several vendor_types; scope the backfill to all of them.
const typeScope = profile.vendorTypes ?? [profile.vendorType];
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const region = argValue('region');           // optional: limit to one state, e.g. --region CO
const limit = parseInt(argValue('limit') || '0', 10);   // optional: cap Places calls this run

let query = supabase.from('vendors').select('id, name, region, website, google_place_id')
  .in('vendor_type', typeScope).not('google_place_id', 'is', null).order('name');
if (region) query = query.eq('region', region);
const { data: rows, error } = await query;
if (error) { console.error('DB read failed:', error.message); process.exit(1); }

const targets = rows.filter((r) => !(r.website || '').trim());
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — venues with place_id + no website${region ? ` in ${region}` : ''}: ${targets.length}${limit ? ` (capped at ${limit})` : ''}`);

let checked = 0, found = 0, updated = 0, none = 0, failed = 0;
for (const r of targets) {
  if (limit && checked >= limit) break;
  checked++;
  let uri = '';
  try { uri = ((await placeDetails(r.google_place_id, 'websiteUri')).websiteUri || '').trim(); }
  catch (e) { console.error(`  ! ${r.name}: Place Details failed — ${e.message}`); failed++; await sleep(120); continue; }
  await sleep(120);
  if (!uri) { none++; continue; }
  found++;
  console.log(`  + ${r.name} (${r.region || '?'}) -> ${uri}`);
  if (APPLY) {
    const { error: uErr } = await supabase.from('vendors').update({ website: uri }).eq('id', r.id);
    if (uErr) { console.error(`  ! update failed for ${r.name}: ${uErr.message}`); failed++; continue; }
    updated++;
  }
}
console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN'} — checked ${checked} | website found ${found} | no website on Google ${none} | failed ${failed}${APPLY ? ` | updated ${updated}` : ''}`);
if (!APPLY && found) console.log('Re-run with --apply to write these websites.');
