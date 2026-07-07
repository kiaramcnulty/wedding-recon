// One CLI for /enrichvenues batch mechanics. Replaces the throwaway orchestrator
// scripts that previously burned a turn each (assign/coverage/repair/verify/state).
//
//   batch      select venues with NO recon of ANY kind (bot OR human), dedupe same-named
//              twins, assign bots + collected-dates, and write single-turn call files
//              (rules + dossiers inlined) → drafts/<batch>-call-NN.md + <batch>-manifest.json
//   status     parse draft CSVs: coverage vs manifest, field-shape, quick rule violations
//   merge      repair (field overflow, bad vendor_id) + concat → recons-<batch>.csv, print samples
//   verify     post-upload DB check (inserted/active/photo gaps, public thumb); --fix-gaps
//              deletes photo-partial entries so an idempotent upload --apply re-inserts them
//   photos-map map screened keeper photos (photos/screen/keep-batch-*.json) into the CSV
//
// usage: node --env-file=.env.local .claude/skills/enrichvenues/scripts/pipeline.mjs <workdir> <cmd> [flags]
//   batch:      --region ST --roster <path> --size N --batch <id> [--per-call 15]
//   status:     --batch <id>
//   merge:      --batch <id>
//   verify:     --roster <path> --csv <name> [--fix-gaps]
//   photos-map: --csv <name>
//   health:     --batch <id>   (find harvests broken by network blips; exit 1 if any)
//   rich:       --batch <id> --roster <path> --venues "slug;slug"   build a SECOND-entry
//               call file for RICH-flagged venues (commentary cluster, a different bot than
//               entry 1). Output uploads as a SEPARATE recons-<id>-rich.csv (its own run,
//               so the ≤50/bot/run cap is per-file); dedup is safe (different author).
// (status/merge/photos-map/health/rich are FS-only; batch/verify need the DB env keys.)
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { norm, parseCSV, argValue } from '../../launchvenues/scripts/lib.mjs';

const workdir = process.argv[2];
const cmd = process.argv[3];
const CMDS = ['batch', 'status', 'merge', 'verify', 'photos-map', 'health', 'rich'];
if (!workdir || workdir.startsWith('--') || !CMDS.includes(cmd)) {
  console.error(`usage: pipeline.mjs <workdir> <${CMDS.join('|')}> [flags]`); process.exit(1);
}
const req = (k) => { const v = argValue(k); if (!v) { console.error(`--${k} is required for ${cmd}`); process.exit(1); } return v; };
const needEnv = () => { for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) if (!process.env[k]) { console.error(`${k} missing — run with --env-file=.env.local`); process.exit(1); } };
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const HEADERS = ['venue', 'vendor_id', 'recon_type', 'month', 'year', 'price_text', 'price_details', 'notes', 'photos', 'sources', 'bot'];
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
  const perCall = parseInt(argValue('per-call') || '15', 10);
  const supabase = db();

  const { data: venues, error } = await supabase.from('vendors')
    .select('id, name, city, website, google_place_id').eq('vendor_type', 'venue').eq('region', region).order('name');
  if (error) { console.error('DB read failed:', error.message); process.exit(1); }
  // Exclude venues with ANY recon — bot OR human. (roster.mjs only counts bot recon;
  // the product rule for backfills is "no recon of any kind".)
  const { data: allRecon, error: rErr } = await supabase.from('recon_entries').select('vendor_id');
  if (rErr) { console.error('DB read failed:', rErr.message); process.exit(1); }
  const hasRecon = new Set((allRecon || []).map((e) => e.vendor_id));

  // reddit mentions (same signal as roster.mjs) for ordering
  const threads = [];
  for (const dir of [path.join(workdir, 'research'), path.join('data/launchvenues', path.basename(workdir), 'research')]) {
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

  // bots: round-robin with a hard ≤50-per-run cap
  const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  if (picked.length > roster.length * 50) {
    console.error(`batch of ${picked.length} exceeds roster capacity ${roster.length} bots × 50/run — add bots (usernames need user approval) or shrink --size`);
    process.exit(1);
  }
  // collected-date: deterministic hash of vendor_id → 1-18 months back
  const now = new Date();
  const dateFor = (vid) => {
    let h = 0; for (const ch of vid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const back = 1 + (h % 18);
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
  };

  const manifest = picked.map((v, i) => {
    const { month, year } = dateFor(v.id);
    return { name: v.name, vendor_id: v.id, slug: slugOf(v.name), city: v.city, bot: roster[i % roster.length].key, month, year, call: Math.floor(i / perCall) + 1 };
  });

  // call files: header (contract + entry rules + voice cards, inlined ONCE per call) + venue blocks
  const refDir = '.claude/skills/enrichvenues/references';
  const header = ['draft-call-header.md', 'entry-rules.md', 'voice-cards.md']
    .map((f) => fs.readFileSync(path.join(refDir, f), 'utf8')).join('\n\n---\n\n');
  fs.mkdirSync(draftsDir, { recursive: true });
  const nCalls = Math.ceil(manifest.length / perCall);
  let maxTok = 0;
  for (let c = 1; c <= nCalls; c++) {
    const mine = manifest.filter((m) => m.call === c);
    const blocks = mine.map((m) => {
      const dossier = fs.readFileSync(path.join(workdir, 'research', m.slug, 'dossier.md'), 'utf8').trim();
      return `\n\n=== VENUE: ${m.name} | vendor_id=${m.vendor_id} | bot=${m.bot} | date=${m.month}/${m.year} ===\n${dossier}`;
    });
    const out = `${header}${blocks.join('')}\n\nOUTPUT FILE: ${draftsDir}/${batch}-worker-${String(c).padStart(2, '0')}.csv\n`;
    fs.writeFileSync(path.join(draftsDir, `${batch}-call-${String(c).padStart(2, '0')}.md`), out);
    maxTok = Math.max(maxTok, Math.round(out.length / 4));
  }
  fs.writeFileSync(path.join(draftsDir, `${batch}-manifest.json`), JSON.stringify(manifest, null, 2));

  const perBot = {};
  for (const m of manifest) perBot[m.bot] = (perBot[m.bot] || 0) + 1;
  console.log(`batch "${batch}": ${manifest.length} venues (pool had ${uniq.length} unreconned) → ${nCalls} call files of ≤${perCall}`);
  console.log(`bot load: ${Object.entries(perBot).map(([b, n]) => `${b}=${n}`).join(', ')}`);
  console.log(`largest call file ≈ ${maxTok} tokens`);
  console.log(`spawn one Sonnet agent per drafts/${batch}-call-NN.md`);
}

// ── status ────────────────────────────────────────────────────────────────────
function cmdStatus() {
  const batch = req('batch');
  const manifest = loadManifest(batch);
  const wantIds = new Set(manifest.map((m) => m.vendor_id));
  const botByVid = new Map(manifest.map((m) => [m.vendor_id, m.bot]));
  const files = fs.readdirSync(draftsDir).filter((f) => f.startsWith(`${batch}-worker-`) && f.endsWith('.csv')).sort();
  const drafted = new Set(); let total = 0, malformed = 0, badVid = 0, badBot = 0, noPrice = 0, banned = 0, dashes = 0;
  for (const f of files) {
    const { hdr, data } = parseDraftCsv(path.join(draftsDir, f));
    const i = (n) => hdr.indexOf(n);
    for (const r of data) {
      total++;
      if (r.length !== HEADERS.length) malformed++;
      const vid = (r[i('vendor_id')] ?? '').trim();
      if (!wantIds.has(vid)) badVid++; else drafted.add(vid);
      if (vid && botByVid.get(vid) && (r[i('bot')] ?? '').trim() !== botByVid.get(vid)) badBot++;
      if (!(r[i('price_text')] ?? '').trim() || !(r[i('price_details')] ?? '').trim()) noPrice++;
      const text = `${r[i('price_text')]} ${r[i('price_details')]} ${r[i('notes')]}`;
      if (BANNED.test(text)) banned++;
      if (EMDASH.test(text)) dashes++;
    }
    console.log(`  ${f}: ${data.length} rows`);
  }
  const missing = manifest.filter((m) => !drafted.has(m.vendor_id));
  console.log(`\ndrafted ${drafted.size}/${manifest.length} | rows ${total} | malformed ${malformed} | bad vendor_id ${badVid} | bot mismatch ${badBot}`);
  console.log(`missing price fields ${noPrice} | banned phrases ${banned} | em-dashes ${dashes}`);
  if (missing.length) console.log(`MISSING: ${missing.map((m) => m.name).join('; ')}`);
}

// ── merge ─────────────────────────────────────────────────────────────────────
function cmdMerge() {
  const batch = req('batch');
  const manifest = loadManifest(batch);
  const idByName = new Map(manifest.map((m) => [norm(m.name), m.vendor_id]));
  const wantIds = new Set(manifest.map((m) => m.vendor_id));
  const botByVid = new Map(manifest.map((m) => [m.vendor_id, m.bot]));
  const files = fs.readdirSync(draftsDir).filter((f) => f.startsWith(`${batch}-worker-`) && f.endsWith('.csv')).sort();
  if (!files.length) { console.error('no worker CSVs found'); process.exit(1); }

  const out = [HEADERS]; const seenVid = new Set(); const problems = []; let repaired = 0;
  for (const f of files) {
    const { hdr, data } = parseDraftCsv(path.join(draftsDir, f));
    const iV = hdr.indexOf('vendor_id');
    for (let r of data) {
      // field overflow (unquoted comma in sources): rejoin overflow into sources, restore bot from manifest
      if (r.length > HEADERS.length) {
        const vid0 = (r[1] ?? '').trim();
        r = [...r.slice(0, 9), r.slice(9, r.length - 1).join(','), botByVid.get(vid0) ?? r[r.length - 1]];
        repaired++;
      }
      if (r.length < HEADERS.length) { problems.push(`${f}: short row "${(r[0] || '').slice(0, 40)}"`); continue; }
      let vid = (r[1] ?? '').trim();
      if (!wantIds.has(vid)) {
        const fix = idByName.get(norm(r[0] ?? ''));
        if (fix && !seenVid.has(fix)) { r[1] = fix; vid = fix; repaired++; }
        else { problems.push(`${f}: unknown vendor_id for "${r[0]}"`); continue; }
      }
      if (seenVid.has(vid)) { problems.push(`${f}: duplicate venue "${r[0]}"`); continue; }
      seenVid.add(vid);
      if (botByVid.get(vid) && (r[10] ?? '').trim() !== botByVid.get(vid)) { r[10] = botByVid.get(vid); repaired++; }
      out.push(r.map((c) => (c ?? '').replace(/\r?\n/g, ' ').trim()));
    }
  }
  if (problems.length) { console.error('UNRECOVERABLE:\n  ' + problems.join('\n  ')); process.exit(1); }

  const csvName = `recons-${batch}.csv`;
  const text = out.map((row) => row.map(csvEsc).join(',')).join('\n') + '\n';
  fs.writeFileSync(path.join(workdir, csvName), text);
  fs.writeFileSync(path.join(workdir, `recons-${batch}.backup.csv`), text);

  const { recons } = loadCsvRecons(csvName);
  const priced = recons.filter((r) => !/^quote only/i.test(r.price_text)).length;
  console.log(`merged ${recons.length}/${manifest.length} rows → ${csvName} (backup saved) | repaired ${repaired} | real pricing ${priced} | quote-only ${recons.length - priced}`);
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

  const { data: entries, error } = await supabase.from('recon_entries').select('id, author_id, vendor_id, status').in('author_id', uids);
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
    for (const [slug, arr] of Object.entries(JSON.parse(fs.readFileSync(path.join(screenDir, f), 'utf8')))) keepers[slug] = (arr || []).slice(0, 2);
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
  const out = rows.map((r, idx) => {
    if (idx === 0 || !r.some((c) => c && c.trim())) return idx === 0 ? r : null;
    const arr = keepers[slugOf(r[iN] ?? '')] || [];
    if (arr.length) { r[iP] = arr.map((fn) => `photos/${slugOf(r[iN])}/${fn}`).join(';'); mapped++; imgs += arr.length; }
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
  const broken = [];
  for (const m of manifest) {
    const hp = path.join(workdir, 'research', m.slug, 'harvest.json');
    if (!fs.existsSync(hp)) { broken.push({ ...m, why: 'no harvest.json' }); continue; }
    const h = JSON.parse(fs.readFileSync(hp, 'utf8'));
    const placeBroken = h.place_id && (!h.google || h.google.err);
    const siteBroken = h.website && /fetch failed|timeout|ENOTFOUND|ECONN/i.test(h.site_error || '');
    if (placeBroken || siteBroken) broken.push({ ...m, why: [placeBroken && `places:${h.google?.err || 'missing'}`, siteBroken && `site:${h.site_error}`].filter(Boolean).join(' ') });
  }
  const calls = [...new Set(broken.map((b) => b.call))].sort((a, b) => a - b);
  console.log(`broken harvests: ${broken.length}/${manifest.length} | affected calls: ${calls.join(', ') || 'none'}`);
  for (const b of broken) console.log(`  ${b.name} [call ${b.call}] — ${b.why}`);
  if (broken.length) console.log(`\nre-harvest:\nharvest --venues "${broken.map((b) => b.name).join(';')}"`);
  const stale = calls
    .map((c) => `${batch}-worker-${String(c).padStart(2, '0')}.csv`)
    .filter((f) => fs.existsSync(path.join(draftsDir, f)));
  if (stale.length) console.log(`stale worker CSVs to delete before respawn: ${stale.join(', ')}`);
  process.exit(broken.length ? 1 : 0);
}

// ── rich ──────────────────────────────────────────────────────────────────────
function cmdRich() {
  const batch = req('batch'), rosterPath = req('roster');
  const want = (argValue('venues') || '').split(';').map((s) => s.trim()).filter(Boolean);
  if (!want.length) { console.error('--venues "slug;slug" required (the RICH-flagged slugs)'); process.exit(1); }
  const manifest = loadManifest(batch);
  const bySlug = new Map(manifest.map((m) => [m.slug, m]));
  const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  const { recons } = loadCsvRecons(`recons-${batch}.csv`);
  const byVid = new Map(recons.map((r) => [r.vendor_id, r]));
  const load = {}; for (const r of recons) load[r.bot] = (load[r.bot] || 0) + 1;

  const dateFor = (seed) => { let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const back = 1 + (h % 18); const d = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - back, 1)); return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() }; };
  const rich = []; const missing = [];
  for (const slug of want) {
    const m = bySlug.get(slug); if (!m) { missing.push(slug); continue; }
    const first = byVid.get(m.vendor_id);
    const secondBot = roster.map((b) => b.key).filter((k) => k !== first?.bot).sort((a, b) => (load[a] || 0) - (load[b] || 0))[0];
    load[secondBot] = (load[secondBot] || 0) + 1;
    const { month, year } = dateFor(m.vendor_id + 'rich');
    rich.push({ ...m, firstBot: first?.bot, firstPrice: first?.price_text || '', secondBot, month, year });
  }
  if (missing.length) { console.error(`not in ${batch} manifest: ${missing.join('; ')}`); process.exit(1); }

  const refDir = '.claude/skills/enrichvenues/references';
  const header = ['draft-call-header.md', 'entry-rules.md', 'voice-cards.md'].map((f) => fs.readFileSync(path.join(refDir, f), 'utf8')).join('\n\n---\n\n');
  const blocks = rich.map((m) => {
    const dossier = fs.readFileSync(path.join(workdir, 'research', m.slug, 'dossier.md'), 'utf8').trim();
    return `\n\n=== VENUE: ${m.name} | vendor_id=${m.vendor_id} | bot=${m.secondBot} | date=${m.month}/${m.year} ===\n`
      + `SECOND ENTRY — this venue is rich enough for two. A DIFFERENT couple (bot=${m.firstBot}) already wrote entry 1 covering PRICING: "${m.firstPrice}". You are a different couple: lead with the REVIEW / EXPERIENCE / LOGISTICS cluster (staff, vibe, what a real wedding there was like, quirks). price_text + price_details are still required: derive a HEDGED version of the venue's real pricing in your own words (e.g. "going off their posted rates it's about $X-$Y", "reviews put saturdays around $X"), or an honest "Quote only" if the dossier has no number. Do NOT copy entry 1's pricing verbatim, and NEVER reference "entry 1" / the other entry / another listing — a reader sees separate cards from different people, so each entry must stand alone. Clearly different voice and opening from a typical first entry.\n${dossier}`;
  });
  fs.mkdirSync(draftsDir, { recursive: true });
  fs.writeFileSync(path.join(draftsDir, `${batch}-rich-call.md`), `${header}${blocks.join('')}\n\nOUTPUT FILE: ${draftsDir}/${batch}-rich-worker.csv\n`);
  fs.writeFileSync(path.join(draftsDir, `${batch}-rich-manifest.json`), JSON.stringify(rich, null, 2));
  console.log(`rich second-entry call for ${rich.length} venues → drafts/${batch}-rich-call.md`);
  console.log(`second bots: ${rich.map((m) => `${m.slug}=${m.secondBot}(vs ${m.firstBot})`).join(', ')}`);
  console.log(`spawn one Sonnet agent on it; then: validate drafts/${batch}-rich-worker.csv, copy to recons-${batch}-rich.csv, upload as a separate --apply run`);
}

if (cmd === 'batch') await cmdBatch();
else if (cmd === 'status') cmdStatus();
else if (cmd === 'rich') cmdRich();
else if (cmd === 'merge') cmdMerge();
else if (cmd === 'verify') await cmdVerify();
else if (cmd === 'photos-map') cmdPhotosMap();
else if (cmd === 'health') cmdHealth();
