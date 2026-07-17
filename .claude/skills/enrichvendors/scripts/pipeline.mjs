// One CLI for /enrichvendors batch mechanics. Replaces the throwaway orchestrator
// scripts that previously burned a turn each (assign/coverage/repair/verify/state).
// All commands accept --type <venue|photographer|caterer|music|flowers> (default venue).
//
//   batch      select vendors with NO recon of ANY kind (bot OR human), dedupe same-named
//              twins, assign 1-3 ENTRIES per vendor from dossier richness (distinct bots
//              + collected-dates per entry), and write single-turn call files (rules +
//              dossiers inlined) → drafts/<batch>-call-NN.md + <batch>-manifest.json
//              (manifest is FLAT: one row per (vendor, entry) slot)
//   status     parse worker JSONL: coverage vs manifest slots, field-shape, rule violations
//   merge      repair (bad vendor_id, bot reassignment) + concat → recons-<batch>.csv, print samples
//   verify     post-upload DB check (inserted/active/photo gaps, public thumb); --fix-gaps
//              deletes photo-partial entries so an idempotent upload --apply re-inserts them
//   photos-map map screened keeper photos (photos/screen/keep-batch-*.json) into the CSV
//              (first entry per vendor only — the same photo never appears on two entries)
//
// usage: node --env-file=.env.local .claude/skills/enrichvendors/scripts/pipeline.mjs <workdir> <cmd> [flags]
//   batch:      --region ST --roster <path> --size N --batch <id> [--per-call 25]
//   status:     --batch <id>
//   merge:      --batch <id>
//   verify:     --roster <path> --csv <name> [--fix-gaps]
//   photos-map: --csv <name>
//   health:     --batch <id>   (find harvests broken by network blips; exit 1 if any)
// (status/merge/photos-map/health are FS-only; batch/verify need the DB env keys.)
// (The old worker-flagged RICH second-entry pass is gone — richness now sets the entry
//  count up front, inside the same call. See git history for rich/richout.)
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { norm, parseCSV, argValue, selectAll } from '../../launchvendors/scripts/lib.mjs';
import { etype } from './etype.mjs';

const workdir = process.argv[2];
const cmd = process.argv[3];
const CMDS = ['batch', 'status', 'merge', 'verify', 'photos-map', 'health'];
if (!workdir || workdir.startsWith('--') || !CMDS.includes(cmd)) {
  console.error(`usage: pipeline.mjs <workdir> <${CMDS.join('|')}> [--type venue|photographer|caterer|music|flowers] [flags]`); process.exit(1);
}
const profile = etype();
const req = (k) => { const v = argValue(k); if (!v) { console.error(`--${k} is required for ${cmd}`); process.exit(1); } return v; };
const needEnv = () => { for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) if (!process.env[k]) { console.error(`${k} missing — run with --env-file=.env.local`); process.exit(1); } };
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Per-type CSV shape: venue = the original 11 columns; photos appends service_region
// LAST so every venue column index is untouched. First column is named 'venue' for all
// types (historical; it holds the vendor name).
const HEADERS = profile.headers;
const BANNED = /\b(stunning|breathtaking|nestled|boasts?|elevate[sd]?|unforgettable|magical|dream wedding|exquisite|picturesque|tucked away gem|genuine value|can't go wrong|won't disappoint|something for everyone|truly special)\b/i;
const EMDASH = /[—–]/;
const slugOf = (s) => norm(s).replace(/ /g, '-').slice(0, 60);
const nameKey = (s) => norm(s).replace(/\b(the|at|by|of|a)\b/g, ' ').replace(/\s+/g, ' ').trim();
const csvEsc = (s) => (/[",\n]/.test(s ?? '') ? `"${String(s).replace(/"/g, '""')}"` : (s ?? ''));
const draftsDir = path.join(workdir, 'drafts');

function loadManifest(batch) {
  const p = path.join(draftsDir, `${batch}-manifest.json`);
  if (!fs.existsSync(p)) { console.error(`${p} not found — run batch first`); process.exit(1); }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function parseDraftCsv(p) {
  const rows = parseCSV(fs.readFileSync(p, 'utf8'));
  if (!rows.length) return { hdr: [], data: [] };
  const hdr = rows[0].map((h) => h.trim());
  return { hdr, data: rows.slice(1).filter((r) => r.some((c) => c && c.trim())) };
}
// v3 workers write JSON Lines — JSON.stringify escaping ends the CSV-corruption failure
// class (11/21 workers corrupted their CSVs in the 2026-07 photographer run; a full
// model-repair pass was needed). Rows normalize to HEADERS-ordered string arrays.
// Legacy CSV worker files can't be re-processed by this version — re-draft the batch,
// or check out the pre-JSONL pipeline from git history for an old artifact.
function readWorkerRows(prefix) {
  const all = fs.existsSync(draftsDir) ? fs.readdirSync(draftsDir) : [];
  const files = all.filter((f) => f.startsWith(prefix) && f.endsWith('.jsonl')).sort();
  if (!files.length && all.some((f) => f.startsWith(prefix) && f.endsWith('.csv'))) {
    console.error(`only legacy CSV worker files found for "${prefix}*" — this pipeline reads JSONL worker output (see readWorkerRows comment)`);
    process.exit(1);
  }
  const perFile = [];
  for (const f of files) {
    const rows = [], problems = [];
    fs.readFileSync(path.join(draftsDir, f), 'utf8').split('\n').forEach((l, idx) => {
      const t = l.trim();
      if (!t) return;
      try {
        const o = JSON.parse(t);
        rows.push(HEADERS.map((h) => String(o[h] ?? '').replace(/\r?\n/g, ' ').trim()));
      } catch { problems.push(`${f}:${idx + 1}: unparseable JSON line`); }
    });
    perFile.push({ file: f, rows, problems });
  }
  return { perFile };
}
function loadCsvRecons(csvName) {
  const rows = parseCSV(fs.readFileSync(path.join(workdir, csvName), 'utf8'));
  const hdr = rows[0].map((h) => h.trim());
  return { rows, recons: rows.slice(1).filter((r) => r.some((c) => c && c.trim()))
    .map((r) => Object.fromEntries(HEADERS.map((h) => { const i = hdr.indexOf(h); return [h, i === -1 ? '' : (r[i] ?? '').trim()]; }))) };
}

// ── batch ─────────────────────────────────────────────────────────────────────
async function cmdBatch() {
  needEnv();
  const region = req('region'), rosterPath = req('roster'), size = parseInt(req('size'), 10), batch = req('batch');
  // 25/call keeps files ~14-18k tokens at ≤~600-token dossiers (measured: photographer
  // dossiers avg ~410) — 40% fewer worker spawns than the old 15 default.
  const perCall = parseInt(argValue('per-call') || '25', 10);
  const supabase = db();

  const { data: venues, error } = await supabase.from('vendors')
    .select('id, name, city, website, google_place_id').eq('vendor_type', profile.vendorType).eq('region', region).order('name');
  if (error) { console.error('DB read failed:', error.message); process.exit(1); }
  // Exclude venues with ANY recon — bot OR human. (roster.mjs only counts bot recon;
  // the product rule for backfills is "no recon of any kind".)
  const { data: allRecon, error: rErr } = await selectAll(() => supabase.from('recon_entries').select('id, vendor_id').order('id'));
  if (rErr) { console.error('DB read failed:', rErr.message); process.exit(1); }
  const hasRecon = new Set((allRecon || []).map((e) => e.vendor_id));

  // reddit mentions (same signal as roster.mjs) for ordering
  const threads = [];
  for (const dir of [path.join(workdir, 'research'), path.join('data/launchvenues', path.basename(workdir), 'research'), path.join('data/launchvendors', path.basename(workdir), 'research')]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.startsWith('reddit-') && f.endsWith('.txt')))
      threads.push(norm(fs.readFileSync(path.join(dir, f), 'utf8')));
  }
  const redditScore = (name) => { const n = nameKey(name); return n.length < 5 ? 0 : threads.filter((t) => t.includes(n)).length; };
  const score = (v) => redditScore(v.name) * 3 + (v.google_place_id ? 1 : 0) + (v.website ? 1 : 0);

  const excluded = new Set((argValue('exclude') || '').split(';').map((s) => norm(s)).filter(Boolean));
  const pool = venues.filter((v) => !hasRecon.has(v.id) && !excluded.has(norm(v.name)))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
  const seen = new Set(); const uniq = [];
  for (const v of pool) { const k = norm(v.name); if (seen.has(k)) continue; seen.add(k); uniq.push(v); } // same-named twins defer
  // Twin-collision guard: research dirs are slugged by NAME, so a venue sharing a name
  // with an ALREADY-HARVESTED different vendor would silently reuse the wrong research.
  // Skip those with a warning — they need manual handling (e.g. a city-suffixed rename).
  const picked = []; const collided = [];
  for (const v of uniq) {
    if (picked.length >= size) break;
    const dp = path.join(workdir, 'research', slugOf(v.name), 'dossier.md');
    if (fs.existsSync(dp)) {
      const firstLine = fs.readFileSync(dp, 'utf8').split('\n', 1)[0];
      if (!firstLine.includes(`vendor_id=${v.id}`)) { collided.push(v); continue; }
    }
    picked.push(v);
  }
  if (collided.length) console.error(`SKIPPED ${collided.length} twin-collision venue(s) (research dir belongs to a same-named different vendor — handle manually): ${collided.map((v) => `${v.name} (${v.city})`).join('; ')}`);
  if (!picked.length) { console.error('nothing to enrich — no unreconned venues in region'); process.exit(1); }

  // fail fast if any dossier is missing (harvest + dossier must run first)
  const missing = picked.filter((v) => !fs.existsSync(path.join(workdir, 'research', slugOf(v.name), 'dossier.md')));
  if (missing.length) {
    console.error(`MISSING DOSSIERS for ${missing.length}/${picked.length} venues — run harvest.mjs then dossier.mjs for them first:`);
    console.error(missing.map((v) => `  ${v.name}`).join('\n'));
    console.error(`\nharvest --venues "${missing.map((v) => v.name).join(';')}"`);
    process.exit(1);
  }

  // Entry count per vendor: 1-3, driven purely by the richness the dossier ACTUALLY has
  // (Kiara, 2026-07: variance follows content found, never a forced quota). Reddit is the
  // strongest signal; a 3-entry vendor needs real pricing AND strong commentary.
  const entryCountFor = (dossierText) => {
    const score = (/\$\s?\d/.test(dossierText) ? 1 : 0)
      + (/^## google reviews/m.test(dossierText) ? 1 : 0)
      + (/^## reddit/m.test(dossierText) ? 2 : 0)
      + (/^## region pricing digests/m.test(dossierText) ? 1 : 0)
      + (dossierText.length > 2200 ? 1 : 0);
    return score >= 4 ? 3 : score >= 2 ? 2 : 1;
  };

  // collected-date: deterministic hash of a seed → 1-18 months back. The murmur-style
  // finalizer matters: seeds like "id#0"/"id#1" differ only in the last char, and without
  // it EVERY multi-entry vendor's dates land in consecutive months — a detectable pattern.
  const now = new Date();
  const dateFor = (seed) => {
    let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;   // JS XOR yields signed int32 — keep h unsigned or dates go future
    const back = 1 + (h % 18);
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
  };

  // Manifest is FLAT: one row per (vendor, entry) slot. A vendor's entries get DISTINCT
  // bots (global round-robin keeps load even) and distinct collected-dates, and all live
  // in the same call file (the dossier is inlined once, extra entries only cost output).
  const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  const manifest = [];
  let botPtr = 0;
  picked.forEach((v, i) => {
    const call = Math.floor(i / perCall) + 1;
    const dossierText = fs.readFileSync(path.join(workdir, 'research', slugOf(v.name), 'dossier.md'), 'utf8');
    const n = Math.min(entryCountFor(dossierText), roster.length);
    for (let e = 0; e < n; e++) {
      const { month, year } = dateFor(`${v.id}#${e}`);
      manifest.push({ name: v.name, vendor_id: v.id, slug: slugOf(v.name), city: v.city, bot: roster[(botPtr + e) % roster.length].key, month, year, entry: e + 1, entries: n, call });
    }
    botPtr = (botPtr + n) % roster.length;
  });
  const perBot = {};
  for (const m of manifest) perBot[m.bot] = (perBot[m.bot] || 0) + 1;
  const overloaded = Object.entries(perBot).filter(([, n]) => n > 50);
  if (overloaded.length) {
    console.error(`batch needs ${manifest.length} entries and overloads ${overloaded.map(([b, n]) => `${b}=${n}`).join(', ')} past 50/bot/run — add bots (usernames need user approval) or shrink --size`);
    process.exit(1);
  }

  // call files: header (contract + core rules + type rules + voice cards, inlined ONCE
  // per call) + one block per vendor carrying its per-entry bot/date assignments
  const refDir = '.claude/skills/enrichvendors/references';
  const header = profile.refs
    .map((f) => fs.readFileSync(path.join(refDir, f), 'utf8')).join('\n\n---\n\n');
  fs.mkdirSync(draftsDir, { recursive: true });
  const nCalls = Math.ceil(picked.length / perCall);
  let maxTok = 0;
  for (let c = 1; c <= nCalls; c++) {
    const byVid = new Map();
    for (const m of manifest.filter((m) => m.call === c)) {
      if (!byVid.has(m.vendor_id)) byVid.set(m.vendor_id, []);
      byVid.get(m.vendor_id).push(m);
    }
    const blocks = [...byVid.values()].map((ms) => {
      const m = ms[0];
      const dossier = fs.readFileSync(path.join(workdir, 'research', m.slug, 'dossier.md'), 'utf8').trim();
      const assign = ms.map((x) => `entry${x.entry}: bot=${x.bot} date=${x.month}/${x.year}`).join(' | ');
      return `\n\n=== ${profile.label}: ${m.name} | vendor_id=${m.vendor_id} | entries=${ms.length} | ${assign} ===\n${dossier}`;
    });
    const out = `${header}${blocks.join('')}\n\nOUTPUT FILE: ${draftsDir}/${batch}-worker-${String(c).padStart(2, '0')}.jsonl\n`;
    fs.writeFileSync(path.join(draftsDir, `${batch}-call-${String(c).padStart(2, '0')}.md`), out);
    maxTok = Math.max(maxTok, Math.round(out.length / 4));
  }
  fs.writeFileSync(path.join(draftsDir, `${batch}-manifest.json`), JSON.stringify(manifest, null, 2));

  const dist = {};
  for (const m of manifest.filter((m) => m.entry === 1)) dist[m.entries] = (dist[m.entries] || 0) + 1;
  console.log(`batch "${batch}": ${picked.length} vendors → ${manifest.length} entries (pool had ${uniq.length} unreconned) → ${nCalls} call files of ≤${perCall} vendors`);
  console.log(`entry distribution: ${[1, 2, 3].map((n) => `${n}-entry×${dist[n] || 0}`).join(', ')} (richness-driven)`);
  console.log(`bot load: ${Object.entries(perBot).map(([b, n]) => `${b}=${n}`).join(', ')}`);
  console.log(`largest call file ≈ ${maxTok} tokens`);
  console.log(`spawn one draft-worker agent per drafts/${batch}-call-NN.md`);
}

// ── status ────────────────────────────────────────────────────────────────────
function cmdStatus() {
  const batch = req('batch');
  const manifest = loadManifest(batch);   // flat: one row per (vendor, entry) slot
  const wantIds = new Set(manifest.map((m) => m.vendor_id));
  const wantPairs = new Set(manifest.map((m) => `${m.vendor_id}|${m.bot}`));
  const { perFile } = readWorkerRows(`${batch}-worker-`);
  const i = (n) => HEADERS.indexOf(n);
  const drafted = new Set(); let total = 0, malformed = 0, badVid = 0, badBot = 0, noPrice = 0, banned = 0, dashes = 0, noRegion = 0;
  for (const { file: f, rows, problems } of perFile) {
    malformed += problems.length;
    for (const r of rows) {
      total++;
      const vid = (r[i('vendor_id')] ?? '').trim();
      const pair = `${vid}|${(r[i('bot')] ?? '').trim()}`;
      if (!wantIds.has(vid)) badVid++;
      else if (!wantPairs.has(pair)) badBot++;   // bot not assigned to this vendor (merge repairs)
      else drafted.add(pair);
      if (!(r[i('price_text')] ?? '').trim() || !(r[i('price_details')] ?? '').trim()) noPrice++;
      if (profile.serviceRegionRequired && !(r[i('service_region')] ?? '').trim()) noRegion++;
      const text = `${r[i('price_text')]} ${r[i('price_details')]} ${r[i('notes')]}`;
      if (BANNED.test(text)) banned++;
      if (EMDASH.test(text)) dashes++;
    }
    console.log(`  ${f}: ${rows.length} rows${problems.length ? ` | ${problems.length} unparseable JSON lines` : ''}`);
  }
  const missing = manifest.filter((m) => !drafted.has(`${m.vendor_id}|${m.bot}`));
  console.log(`\ndrafted ${drafted.size}/${manifest.length} entry slots | rows ${total} | malformed ${malformed} | bad vendor_id ${badVid} | bot mismatch ${badBot}`);
  console.log(`missing price fields ${noPrice} | banned phrases ${banned} | em-dashes ${dashes}${profile.serviceRegionRequired ? ` | missing service_region ${noRegion}` : ''}`);
  if (missing.length) console.log(`MISSING SLOTS (SHORT/THIN-flagged ones are intentional): ${missing.map((m) => `${m.name} (${m.bot})`).join('; ')}`);
}

// ── merge ─────────────────────────────────────────────────────────────────────
function cmdMerge() {
  const batch = req('batch');
  const manifest = loadManifest(batch);   // flat: one row per (vendor, entry) slot
  const idByName = new Map(manifest.map((m) => [norm(m.name), m.vendor_id]));
  const wantIds = new Set(manifest.map((m) => m.vendor_id));
  const botsByVid = new Map();            // vid → assigned bots in entry order
  for (const m of manifest) {
    if (!botsByVid.has(m.vendor_id)) botsByVid.set(m.vendor_id, []);
    botsByVid.get(m.vendor_id).push(m.bot);
  }
  const { perFile } = readWorkerRows(`${batch}-worker-`);
  if (!perFile.length) { console.error('no worker JSONL files found'); process.exit(1); }

  const iBot = HEADERS.indexOf('bot');
  const out = [HEADERS]; const seenPair = new Set(); const rowsPerVid = new Map(); const problems = []; let repaired = 0;
  for (const { file: f, rows, problems: fileProblems } of perFile) {
    problems.push(...fileProblems);
    for (const r of rows) {
      let vid = (r[1] ?? '').trim();
      if (!wantIds.has(vid)) {
        const fix = idByName.get(norm(r[0] ?? ''));
        if (fix) { r[1] = fix; vid = fix; repaired++; }
        else { problems.push(`${f}: unknown vendor_id for "${r[0]}"`); continue; }
      }
      const assigned = botsByVid.get(vid);
      if ((rowsPerVid.get(vid) || 0) >= assigned.length) { problems.push(`${f}: extra row for "${r[0]}" beyond its ${assigned.length} assigned entries`); continue; }
      // Bot must be one of THIS vendor's assigned bots and unused for it — repair to the
      // next open slot otherwise (a bot posting twice on one vendor is a hard tell).
      const bot = (r[iBot] ?? '').trim();
      if (!assigned.includes(bot) || seenPair.has(`${vid}|${bot}`)) {
        r[iBot] = assigned.find((b) => !seenPair.has(`${vid}|${b}`));
        repaired++;
      }
      seenPair.add(`${vid}|${r[iBot]}`);
      rowsPerVid.set(vid, (rowsPerVid.get(vid) || 0) + 1);
      out.push(r);
    }
  }
  if (problems.length) { console.error('UNRECOVERABLE:\n  ' + problems.join('\n  ')); process.exit(1); }

  const csvName = `recons-${batch}.csv`;
  const text = out.map((row) => row.map(csvEsc).join(',')).join('\n') + '\n';
  fs.writeFileSync(path.join(workdir, csvName), text);
  fs.writeFileSync(path.join(workdir, `recons-${batch}.backup.csv`), text);

  const { recons } = loadCsvRecons(csvName);
  const priced = recons.filter((r) => !/^quote only/i.test(r.price_text)).length;
  const nVendors = new Set(recons.map((r) => r.vendor_id)).size;
  console.log(`merged ${recons.length}/${manifest.length} entry slots (${nVendors} vendors) → ${csvName} (backup saved) | repaired ${repaired} | real pricing ${priced} | quote-only ${recons.length - priced}`);
  for (const r of recons.filter((_, i) => i % Math.ceil(recons.length / 3) === 0).slice(0, 3)) {
    console.log(`\n── ${r.venue} [${r.bot}, ${r.month}/${r.year}]\n   ${r.price_text}\n   ${r.notes.slice(0, 220)}${r.notes.length > 220 ? '…' : ''}`);
  }
}

// ── verify ────────────────────────────────────────────────────────────────────
async function cmdVerify() {
  needEnv();
  const rosterPath = req('roster'), csvName = req('csv');
  const fix = process.argv.includes('--fix-gaps');
  const supabase = db();
  const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  const uidByKey = new Map(roster.map((b) => [b.key, b.user_id]));
  const { recons } = loadCsvRecons(csvName);
  const items = recons.map((r) => ({ ...r, uid: uidByKey.get(r.bot), expPhotos: r.photos ? r.photos.split(';').filter(Boolean).length : 0 }));
  const uids = [...new Set(items.map((r) => r.uid).filter(Boolean))];
  const batchVids = new Set(items.map((r) => r.vendor_id));

  const { data: entries, error } = await selectAll(() => supabase.from('recon_entries').select('id, author_id, vendor_id, status').order('id').in('author_id', uids));
  if (error) { console.error('DB read failed:', error.message); process.exit(1); }
  const mine = (entries || []).filter((e) => batchVids.has(e.vendor_id));
  const byPair = new Map(mine.map((e) => [`${e.author_id}|${e.vendor_id}`, e]));
  const { data: media } = mine.length
    ? await supabase.from('recon_media').select('recon_entry_id, thumb_path').in('recon_entry_id', mine.map((e) => e.id))
    : { data: [] };
  const mCount = new Map();
  for (const m of media || []) mCount.set(m.recon_entry_id, (mCount.get(m.recon_entry_id) || 0) + 1);

  let inserted = 0, active = 0; const gaps = [], notIn = [];
  for (const r of items) {
    const e = byPair.get(`${r.uid}|${r.vendor_id}`);
    if (!e) { notIn.push(r.venue); continue; }
    inserted++;
    if (e.status === 'active') active++;
    if ((mCount.get(e.id) || 0) < r.expPhotos) gaps.push({ venue: r.venue, eid: e.id, have: mCount.get(e.id) || 0, want: r.expPhotos });
  }
  console.log(`inserted ${inserted}/${items.length} | active ${active}/${inserted} | photo gaps ${gaps.length} | not inserted ${notIn.length}`);
  if (notIn.length) console.log(`  not inserted: ${notIn.slice(0, 20).join('; ')}${notIn.length > 20 ? ` (+${notIn.length - 20})` : ''}`);
  for (const g of gaps) console.log(`  gap: ${g.venue} ${g.have}/${g.want}`);

  const sample = (media || []).find((m) => m.thumb_path);
  if (sample) {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/recon-media/${sample.thumb_path}`).catch(() => null);
    console.log(`public thumb: ${res ? `${res.status} ${res.headers.get('content-type')}` : 'fetch failed'}`);
  }

  if (fix && gaps.length) {
    const ids = gaps.map((g) => g.eid);
    await supabase.from('recon_media').delete().in('recon_entry_id', ids);
    const { error: dErr } = await supabase.from('recon_entries').delete().in('id', ids);
    if (dErr) { console.error('gap delete failed:', dErr.message); process.exit(1); }
    console.log(`deleted ${gaps.length} photo-gap entries — re-run upload.mjs --apply to re-insert them with photos`);
  }
  if (notIn.length || gaps.length) process.exit(1); // non-zero = loop: (fix-gaps →) upload --apply → verify
}

// ── photos-map ────────────────────────────────────────────────────────────────
function cmdPhotosMap() {
  const csvName = req('csv');
  const screenDir = path.join(workdir, 'photos', 'screen');
  const keepers = {};
  for (const f of fs.readdirSync(screenDir).filter((f) => /^keep-batch-.*\.json$/.test(f)).sort()) {
    for (const [slug, arr] of Object.entries(JSON.parse(fs.readFileSync(path.join(screenDir, f), 'utf8')))) keepers[slug] = (arr || []).slice(0, profile.photoCap ?? 2);
  }
  const missing = [];
  for (const [slug, arr] of Object.entries(keepers)) for (const fn of arr) {
    const full = path.join(workdir, 'photos', slug, fn);
    if (!fs.existsSync(full)) missing.push(`${slug}/${fn}`);
    if (!fs.existsSync(full.replace(/\.jpg$/, '_thumb.jpg'))) missing.push(`${slug}/${fn} thumb`);
  }
  if (missing.length) { console.error('missing keeper files: ' + missing.join(', ')); process.exit(1); }

  const csvPath = path.join(workdir, csvName);
  fs.copyFileSync(csvPath, csvPath.replace(/\.csv$/, '.prephotos.csv'));
  const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
  const hdr = rows[0].map((h) => h.trim());
  const iN = hdr.indexOf('venue'), iP = hdr.indexOf('photos');
  let mapped = 0, imgs = 0;
  const usedSlug = new Set();   // multi-entry vendors: photos go on the FIRST entry only
  const out = rows.map((r, idx) => {
    if (idx === 0 || !r.some((c) => c && c.trim())) return idx === 0 ? r : null;
    const slug = slugOf(r[iN] ?? '');
    const arr = keepers[slug] || [];
    if (arr.length && !usedSlug.has(slug)) {
      usedSlug.add(slug);
      r[iP] = arr.map((fn) => `photos/${slug}/${fn}`).join(';'); mapped++; imgs += arr.length;
    }
    return r;
  }).filter(Boolean);
  fs.writeFileSync(csvPath, out.map((row) => row.map(csvEsc).join(',')).join('\n') + '\n');
  console.log(`photos mapped into ${csvName}: ${mapped} rows, ${imgs} images (backup: .prephotos.csv)`);
}

// ── health ────────────────────────────────────────────────────────────────────
// Transient network blips (DNS, fetch failed) leave harvest.json rows with
// google.err / site_error instead of data; drafts from those read hollow. This
// finds them so the loop is: health → re-harvest listed → dossier → batch (same
// flags regenerate identical assignments with fresh dossiers) → respawn stale calls.
function cmdHealth() {
  const batch = req('batch');
  const manifest = loadManifest(batch);
  const broken = []; const seenSlug = new Set();
  for (const m of manifest) {
    if (seenSlug.has(m.slug)) continue;   // flat manifest repeats multi-entry vendors
    seenSlug.add(m.slug);
    const hp = path.join(workdir, 'research', m.slug, 'harvest.json');
    if (!fs.existsSync(hp)) { broken.push({ ...m, why: 'no harvest.json' }); continue; }
    const h = JSON.parse(fs.readFileSync(hp, 'utf8'));
    const placeBroken = h.place_id && (!h.google || h.google.err);
    const siteBroken = h.website && /fetch failed|timeout|ENOTFOUND|ECONN/i.test(h.site_error || '');
    if (placeBroken || siteBroken) broken.push({ ...m, why: [placeBroken && `places:${h.google?.err || 'missing'}`, siteBroken && `site:${h.site_error}`].filter(Boolean).join(' ') });
  }
  const calls = [...new Set(broken.map((b) => b.call))].sort((a, b) => a - b);
  console.log(`broken harvests: ${broken.length}/${seenSlug.size} vendors | affected calls: ${calls.join(', ') || 'none'}`);
  for (const b of broken) console.log(`  ${b.name} [call ${b.call}] — ${b.why}`);
  if (broken.length) console.log(`\nre-harvest:\nharvest --venues "${broken.map((b) => b.name).join(';')}"`);
  const stale = calls
    .map((c) => `${batch}-worker-${String(c).padStart(2, '0')}.jsonl`)
    .filter((f) => fs.existsSync(path.join(draftsDir, f)));
  if (stale.length) console.log(`stale worker JSONL files to delete before respawn: ${stale.join(', ')}`);
  process.exit(broken.length ? 1 : 0);
}

if (cmd === 'batch') await cmdBatch();
else if (cmd === 'status') cmdStatus();
else if (cmd === 'merge') cmdMerge();
else if (cmd === 'verify') await cmdVerify();
else if (cmd === 'photos-map') cmdPhotosMap();
else if (cmd === 'health') cmdHealth();
