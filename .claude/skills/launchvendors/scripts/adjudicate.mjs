// Phase 4 — settle the flagged rows of the working CSV WITHOUT a human review pass.
//
// Kiara, 2026-07-26: don't hold a run open waiting on my review of questionable rows. The
// agent decides — if you think it's a <type>, keep; if you think not, remove; and a valid
// vendor with no address gets a centroid (especially when Reddit/Google reviews vouch for
// it). A few wrong on the margin is fine; a stalled run is not.
//
// Two modes:
//   (default)  print the flagged docket — one line per row still carrying a review flag,
//              with the evidence needed to judge it (city, website, provenance). This is
//              what the orchestrator reads; the CSV itself never enters its context.
//   --apply    enact the decisions: --remove rows move to pruned.csv (PRUNED:judgment),
//              --rescue rows come back from pruned.csv, every kept row gets a centroid if
//              it has no coordinates, and review flags are cleared to OK:auto so nothing
//              downstream still looks like it is waiting on a person.
//
// Row keys are place_id or the normalized name — never row numbers (rows move between the
// working CSV and pruned.csv). An unmatched or ambiguous key aborts the whole apply before
// anything is written, so a typo can't silently keep a row you meant to drop.
//
// usage:
//   node --env-file=.env.local .claude/skills/launchvendors/scripts/adjudicate.mjs <workdir> [--type music] [--region "Denver, CO"] [--names]
//   node --env-file=.env.local .claude/skills/launchvendors/scripts/adjudicate.mjs <workdir> [--type music] [--region "Denver, CO"] \
//        --remove "Some Portrait Studio" --remove "Corporate Catering Co" --rescue "Vouched Florist" --subtype "Mile High Sound=dj" --apply
import path from 'node:path';
import fs from 'node:fs';
import { readVenues, writeVenues, appendPruned, norm, centroidLookup, argValue, typeProfile } from './lib.mjs';

const workdir = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!workdir || workdir.startsWith('--')) {
  console.error('usage: adjudicate.mjs <workdir> [--type <type>] [--region "City, ST"] [--names] [--remove "Name" ...] [--rescue "Name" ...] [--subtype "Name=dj" ...] [--apply]');
  process.exit(1);
}
const profile = typeProfile();
const region = argValue('region');

// Repeatable flags: --remove "A" --remove "B" (and --remove-file / --rescue-file, one key per line).
function multi(flag) {
  const out = [];
  for (let i = 0; i < process.argv.length; i++) if (process.argv[i] === `--${flag}` && process.argv[i + 1]) out.push(process.argv[i + 1]);
  const f = argValue(`${flag}-file`);
  if (f) out.push(...fs.readFileSync(f, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean));
  return out;
}
const removeKeys = multi('remove');
const rescueKeys = multi('rescue');
// Split types (music → dj|band) — retype a row the name-only classifier got wrong:
// --subtype "Mile High Sound=dj". Same key rules as --remove.
const subtypeArgs = multi('subtype').map((s) => {
  const i = s.lastIndexOf('=');
  if (i === -1) { console.error(`--subtype expects "Name=value", got "${s}"`); process.exit(1); }
  return { key: s.slice(0, i).trim(), value: s.slice(i + 1).trim() };
});

const file = path.join(workdir, profile.csv);
const prunedFile = path.join(workdir, 'pruned.csv');
const venues = readVenues(file);
if (!venues.length) { console.error(`no rows in ${file}`); process.exit(1); }

// A row still awaiting a decision. Legacy flags from workdirs started before this script
// existed (NEEDS_ADDRESS, bare APPROX) count too.
const NEEDS_DECISION = /CHECK|WED_UNVERIFIED|APPROX|NO_MATCH|NEEDS_ADDRESS/i;
const isFlagged = (v) => NEEDS_DECISION.test(v.flags || '');
const hasStreet = (v) => /\d/.test(v.address || '');
const sub = (v) => (profile.vendorTypes ? ` | ${v.subtype || '?'}` : '');

/** Resolve a user-supplied key to exactly one row: place_id, then exact normalized name, then a unique substring. */
function pick(rows, key, label) {
  const k = norm(key);
  const byPid = rows.filter((v) => v.place_id && v.place_id === key);
  if (byPid.length) return byPid;
  const exact = rows.filter((v) => norm(v.name) === k);
  if (exact.length) return exact;
  const partial = rows.filter((v) => norm(v.name).includes(k));
  if (partial.length === 1) return partial;
  if (partial.length > 1) {
    console.error(`${label} key "${key}" is ambiguous — matches: ${partial.map((v) => v.name).join(' | ')}`);
    process.exit(1);
  }
  console.error(`${label} key "${key}" matched no row in ${label === 'rescue' ? prunedFile : file}`);
  process.exit(1);
}

if (!APPLY) {
  const flagged = venues.filter(isFlagged);
  console.log(`adjudicate(${profile.key}): ${venues.length} rows | ${flagged.length} awaiting a decision`);
  if (flagged.length) {
    console.log('\nDOCKET (keep = do nothing, remove = --remove "<name>"):');
    for (const v of flagged) {
      console.log(`  ${v.name} | ${v.city || v.address || '?'} | ${v.flags}${sub(v)} | ${v.website || 'no site'} | ${v.provenance || '?'}`);
    }
  }
  // --names: every kept row, name only. For the type cards whose watchlist is a name skim
  // across the WHOLE list (venue: service vendors that aren't venues at all), not just the
  // flagged rows. One short line each — cheaper than the CSV, which never enters context.
  if (process.argv.includes('--names')) {
    console.log(`\nALL ROWS (skim for wrong-type names${profile.vendorTypes ? ' and wrong subtypes' : ''}):`);
    for (const v of venues) console.log(`  ${v.name} | ${v.city || '?'}${sub(v)}`);
  }
  const pruned = readVenues(prunedFile);
  if (pruned.length) console.log(`\npruned.csv holds ${pruned.length} row(s) — rescue one with --rescue "<name>"`);
  console.log('\nnothing written (dry run) — re-run with --apply and your --remove/--rescue decisions');
  process.exit(0);
}

// ── Apply ───────────────────────────────────────────────────────────────────
// Resolve every key first: an unmatched key exits above, before any write.
const removals = new Set();
for (const k of removeKeys) for (const v of pick(venues, k, 'remove')) removals.add(v);

let rescued = 0;
const prunedRows = readVenues(prunedFile);
const rescues = new Set();
for (const k of rescueKeys) for (const v of pick(prunedRows, k, 'rescue')) rescues.add(v);
for (const v of rescues) {
  v.flags = 'RESCUED:judgment';
  venues.push(v);
  rescued++;
}

// Subtype corrections (split types only) — applied before dedup/upload reads the column.
let retyped = 0;
for (const { key, value } of subtypeArgs) {
  if (!profile.vendorTypes) { console.error(`--subtype is only meaningful for split types (${profile.key} has one vendor_type)`); process.exit(1); }
  if (!profile.vendorTypes.includes(value)) { console.error(`--subtype value "${value}" is not one of ${profile.vendorTypes.join('|')}`); process.exit(1); }
  for (const v of pick(venues, key, 'subtype')) { v.subtype = value; retyped++; }
}

const kept = venues.filter((v) => !removals.has(v));

// Centroid backfill: a kept vendor with no coordinates gets an approximate pin rather than
// no pin at all. City first (its own row/hint), then the run's region.
let centroided = 0, stillNoPin = 0;
if (kept.some((v) => !v.lat || !v.lng) && !process.env.GOOGLE_PLACES_API_KEY) {
  console.error('GOOGLE_PLACES_API_KEY missing (needed to centroid-fill pinless rows) — run with --env-file=.env.local from the repo root');
  process.exit(1);
}
for (const v of kept) {
  if (v.lat && v.lng) continue;
  const cityLabel = v.city && v.state ? `${v.city}, ${v.state}` : (v.city || '');
  const hit = await centroidLookup([cityLabel, region], v.state || '');
  if (hit) {
    Object.assign(v, { address: hasStreet(v) ? v.address : hit.label, city: v.city || hit.city, lat: hit.lat, lng: hit.lng });
    centroided++;
  } else {
    stillNoPin++;
  }
}

// Clear the review flags on everything we kept — the decision is made. APPROX is preserved
// as documentation of a centroid pin (the app derives approximate-ness from the address, not
// from this column, so it is a human-readable note only).
let cleared = 0;
for (const v of kept) {
  if (!isFlagged(v)) continue;
  v.flags = v.lat && v.lng && !hasStreet(v) ? 'OK:auto;APPROX' : 'OK:auto';
  cleared++;
}

const dropped = [...removals];
for (const v of dropped) v.flags = 'PRUNED:judgment';

// Order matters: drop the rescued rows out of pruned.csv FIRST — appendPruned re-reads that
// file from disk, so writing it afterwards would clobber the rows we just pruned.
if (rescues.size) writeVenues(prunedFile, prunedRows.filter((v) => !rescues.has(v)));
writeVenues(file, kept);
appendPruned(workdir, dropped);

console.log(`adjudicate(${profile.key}) --apply: ${kept.length} kept | ${dropped.length} removed → pruned.csv | ${rescued} rescued | ${retyped} retyped | ${centroided} centroid-filled | ${cleared} flags cleared${stillNoPin ? ` | ${stillNoPin} still without a pin (uploads, no map pin)` : ''}`);
if (dropped.length) { console.log('\nREMOVED (judgment):'); for (const v of dropped) console.log(`  ${v.name} (${v.city || '?'})`); }
if (rescued) { console.log('\nRESCUED:'); for (const v of rescues) console.log(`  ${v.name} (${v.city || '?'})`); }
