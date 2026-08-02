// Resolve researched candidates (<workdir>/candidates.jsonl) to Google Places -> append to the working CSV.
// Each line: {"name":"...","hint":"City, ST area (optional)","website":"...","instagram":"...","provenance":"reddit:r/Denver-01"}
// usage: node --env-file=.env.local .claude/skills/launchvendors/scripts/resolve.mjs <workdir> --state CO [--region "Denver, CO"] [--type photographer]
import fs from 'node:fs';
import path from 'node:path';
import { readVenues, writeVenues, nameKey, sigTokens, tokensOverlap, parseCityState, placesSearch, websiteWithFallback, centroidLookup, cleanWebsite, cleanInstagram, sleep, argValue, typeProfile, initPlacesCache, placesSpendReport } from './lib.mjs';

const workdir = process.argv[2];
const state = argValue('state');
const region = argValue('region');   // "City, ST" — centroid of last resort when a candidate has no city hint
if (!workdir || workdir.startsWith('--') || !state) { console.error('usage: resolve.mjs <workdir> --state CO [--region "Denver, CO"] [--type photographer]'); process.exit(1); }
if (!process.env.GOOGLE_PLACES_API_KEY) { console.error('GOOGLE_PLACES_API_KEY missing — run with --env-file=.env.local from the repo root'); process.exit(1); }
const profile = typeProfile();
initPlacesCache(workdir);   // reuse Places responses across re-runs — see lib.mjs

const file = path.join(workdir, profile.csv);
const candFile = path.join(workdir, 'candidates.jsonl');
if (!fs.existsSync(candFile)) { console.error(`missing ${candFile}`); process.exit(1); }

const venues = readVenues(file);
const seenPid = new Set(venues.map((v) => v.place_id).filter(Boolean));
const knownNames = venues.map((v) => nameKey(v.name, profile));

// Rows already REJECTED (junk name, wrong type, no wedding evidence, or a Phase-4 judgment
// call) live in pruned.csv, not the working CSV. Without this guard a re-run of resolve
// replays candidates.jsonl and cheerfully re-adds every one of them, silently undoing an
// adjudication pass — measured 2026-07-29 (CO beauty): a single re-run resurrected 5
// removed vendors and duplicated 4 rows that had been renamed in between.
const prunedFile = path.join(workdir, 'pruned.csv');
const prunedKeys = new Set(), prunedPids = new Set();
if (fs.existsSync(prunedFile)) {
  for (const r of readVenues(prunedFile)) {
    if (r.name) prunedKeys.add(nameKey(r.name, profile));
    if (r.place_id) prunedPids.add(r.place_id);
  }
}
// Row lookups so a DEDUP HIT can still donate its research-sourced instagram/website to
// the existing row (fills blanks only) — otherwise a pasted IG handle that collides with
// a sweep row would be silently lost.
const byPid = new Map(venues.filter((v) => v.place_id).map((v) => [v.place_id, v]));
const byKey = new Map();
for (let i = 0; i < venues.length; i++) if (!byKey.has(knownNames[i])) byKey.set(knownNames[i], venues[i]);

const cands = fs.readFileSync(candFile, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
let resolved = 0, approx = 0, nomatch = 0, dups = 0, researchSite = 0, donated = 0, revived = 0;
const flagged = [];
const revivedNames = [];

const donate = (row, c, ig) => {
  if (!row) return;
  let hit = false;
  if (ig && !row.instagram) { row.instagram = ig; hit = true; }
  const w = cleanWebsite(c.website);
  if (w && !(row.website || '').trim()) { row.website = w; hit = true; }
  if (hit) donated++;
};

for (const c of cands) {
  const key = nameKey(c.name, profile);
  const ig = profile.captureInstagram ? cleanInstagram(c.instagram) : '';
  // Previously pruned by name — don't resurrect it. `--rescue` in adjudicate.mjs is the
  // one supported way back out of pruned.csv, so a rejection survives any number of re-runs.
  if (prunedKeys.has(key)) { revived++; if (revivedNames.length < 12) revivedNames.push(c.name); continue; }
  // Name-level dedup vs everything already in the file (exact, or containment when name is distinctive enough).
  const dupKey = knownNames.find((n) => n === key || (sigTokens(c.name).length >= 2 && (n.includes(key) || key.includes(n))));
  if (dupKey !== undefined) { dups++; donate(byKey.get(dupKey), c, ig); continue; }

  let p = null;
  try { const d = await placesSearch(`${c.name} ${c.hint || state}`); p = d.places?.[0] ?? null; } catch { /* fall through to no-match */ }
  await sleep(120);

  // Match guard: must share a significant name token AND sit in the right state.
  if (p && tokensOverlap(c.name, p.displayName?.text || '', profile.weak) && (p.formattedAddress || '').includes(state)) {
    if (seenPid.has(p.id)) { dups++; donate(byPid.get(p.id), c, ig); console.log(`  = "${c.name}" resolved to a place_id we already have — dropped as duplicate (ig/website donated if blank)`); continue; }
    // Same guard as the name check, but on the RESOLVED place: a candidate can reach a
    // pruned row under a different name (a rebrand, or two businesses sharing a listing).
    if (prunedPids.has(p.id)) { revived++; if (revivedNames.length < 12) revivedNames.push(`${c.name} -> ${p.displayName?.text || p.id}`); continue; }
    const gName = p.displayName.text; // canonical Google name
    const gKey = nameKey(gName, profile);
    const { city, state: st, cleanAddress } = parseCityState(p.formattedAddress, state);
    const exactish = gKey === key || gKey.includes(key) || key.includes(gKey);
    const flags = exactish ? '' : `CHECK: was "${c.name}"`;
    // Prefer Google's own website; fall back to a website surfaced by research (backend-only).
    const gSite = await websiteWithFallback(p.id, p.websiteUri);
    const website = gSite || cleanWebsite(c.website);
    if (!gSite && website) researchSite++;
    const newRow = {
      name: gName, address: cleanAddress, city, state: st, website, instagram: ig,
      lat: p.location?.latitude ?? '', lng: p.location?.longitude ?? '', place_id: p.id,
      provenance: c.provenance || 'research', flags,
      subtype: profile.classify ? profile.classify(gName) : '',
    };
    venues.push(newRow);
    seenPid.add(p.id); byPid.set(p.id, newRow);
    knownNames.push(gKey); if (!byKey.has(gKey)) byKey.set(gKey, newRow);
    resolved++;
    if (flags) flagged.push(`${gName} | ${flags}`);
  } else {
    // No trusted business match — fall back to an approximate centroid row: the candidate's
    // own city hint first, then the run's region (Kiara, 2026-07-26: a vendor we believe in
    // but can't place gets a centroid pin rather than a row waiting on a human for an
    // address — service-area vendors often have no street address to find).
    // address stays "City, ST" (no street digits) so the app's dashed approximate-pin heuristic fires.
    const cityHint = (c.hint || '').split(',')[0].replace(/\barea\b/gi, '').trim();
    // No Google place, but keep a website research surfaced (backend-only, non-Google row).
    const researchWebsite = cleanWebsite(c.website);
    if (researchWebsite) researchSite++;
    let row = {
      name: c.name, address: '', city: '', state, website: researchWebsite, instagram: ig, lat: '', lng: '', place_id: '',
      provenance: c.provenance || 'research', flags: 'NO_MATCH',
      subtype: profile.classify ? profile.classify(c.name) : '',
    };
    const hit = await centroidLookup([cityHint && `${cityHint}, ${state}`, region], state);
    if (hit) {
      row = {
        ...row, address: hit.label, city: hit.city, lat: hit.lat, lng: hit.lng,
        flags: hit.label === region ? 'APPROX:region' : 'APPROX:city',
      };
    }
    venues.push(row);
    knownNames.push(key); if (!byKey.has(key)) byKey.set(key, row);
    if (row.flags.startsWith('APPROX')) approx++; else nomatch++;
    flagged.push(`${c.name} | ${row.flags}`);
  }
}

writeVenues(file, venues);
console.log(`resolve: ${cands.length} candidates | +${resolved} matched | +${approx} approx-centroid | +${nomatch} no-match | ${dups} already-known (${donated} donated ig/website to existing rows) | +${researchSite} using a research website | ${revived} skipped as previously-pruned | total ${venues.length}`);
if (revived) {
  console.log(`  skipped (already in pruned.csv — rescue with: adjudicate.mjs ... --rescue "<name>" --apply):\n    ${revivedNames.join('\n    ')}`);
  console.log(`  NOTE: adjudicate is TERMINAL — if you are re-running resolve after adjudicating, you are probably re-doing work. Resolve everything first, then adjudicate once.`);
}
if (flagged.length) { console.log('\nFLAGGED (adjudicate in Phase 4 — see adjudicate.mjs):'); for (const f of flagged) console.log('  ' + f); }
console.log(placesSpendReport());
