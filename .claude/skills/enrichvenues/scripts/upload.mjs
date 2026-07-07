// Bulk-upload recons.csv as bot-authored recon entries (+ photos) for /enrichvenues.
// Dry-run by default; nothing is written without --apply.
// Idempotent: a bot never has two entries for one venue, so (author_id, vendor_id)
// is the natural dedup key — rows already in the DB are skipped on re-run.
// usage: node --env-file=.env.local .claude/skills/enrichvenues/scripts/upload.mjs <workdir> [--apply]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseCSV, argValue } from '../../launchvenues/scripts/lib.mjs';

const workdir = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!workdir || workdir.startsWith('--')) { console.error('usage: upload.mjs <workdir> [--apply]'); process.exit(1); }
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[k]) { console.error(`${k} missing — run with --env-file=.env.local from the repo root`); process.exit(1); }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Load roster + csv ─────────────────────────────────────────────────────────
// Rosters are per-state (bots don't cross states; they ARE reused across vendor
// types within a state). Default: <workdir>/bots.json; share via --roster.
const rosterPath = argValue('roster') || path.join(workdir, 'bots.json');
const bots = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
const botByKey = new Map(bots.map((b) => [b.key || b.username, b]));
const HEADERS = ['venue', 'vendor_id', 'recon_type', 'month', 'year', 'price_text', 'price_details', 'notes', 'photos', 'sources', 'bot'];
// --csv <name> lets each batch live in its own file (smaller review artifacts);
// (author_id, vendor_id) dedup makes multi-file uploads safe.
const rows = parseCSV(fs.readFileSync(path.join(workdir, argValue('csv') || 'recons.csv'), 'utf8'));
const hdr = rows[0].map((h) => h.trim());
const recons = rows.slice(1).filter((r) => r.some((c) => c && c.trim()))
  .map((r) => Object.fromEntries(HEADERS.map((h) => { const i = hdr.indexOf(h); return [h, i === -1 ? '' : (r[i] ?? '').trim()]; })));

// ── Validate ──────────────────────────────────────────────────────────────────
const RECON_TYPES = new Set(['online', 'virtual', 'in_person']);
// AI-slop tells; entries containing these must be rephrased before upload.
// Empty-evaluative filler is banned too: judgments must be tied to a number or a sourced fact.
const BANNED = /\b(stunning|breathtaking|nestled|boasts?|elevate[sd]?|unforgettable|magical|dream wedding|exquisite|picturesque|tucked away gem|genuine value|can't go wrong|won't disappoint|something for everyone|truly special)\b/i;
// Process tells: research-tooling OR pipeline/batch self-references no real couple would
// write. Two families: (1) crawler language — rephrase as a person would ("their site
// doesn't list pricing", "couldn't get the page to load"); (2) any hint that this entry
// is part of a scripted set being processed ("from this batch", "the enrichment run",
// "seeded venues") — a couple's note references the venue, never how the note was made.
const PROCESS = /\b(crawl\w*|scrape\w*|fetch\w*|dossier|harvest\w*|parse\w*|garbled text|boilerplate|batch\w*|enrich\w*|seeded|roster|pipeline|dataset|databases?|bots?)\b/i;
const EMDASH = /[—–]/; // no em/en dashes anywhere in entry text — real users type hyphens
const errors = [];
const perBot = new Map(), perBotVenue = new Set();
for (const [i, r] of recons.entries()) {
  const at = `row ${i + 2} (${r.venue})`;
  if (!r.vendor_id) errors.push(`${at}: missing vendor_id`);
  if (!RECON_TYPES.has(r.recon_type)) errors.push(`${at}: bad recon_type "${r.recon_type}"`);
  if (!r.price_text || !r.price_details) errors.push(`${at}: price_text and price_details are REQUIRED on every entry`);
  const text = `${r.price_text} ${r.price_details} ${r.notes}`;
  const banned = text.match(BANNED);
  if (banned) errors.push(`${at}: banned marketing/AI phrase "${banned[0]}" — rephrase in the entry's voice`);
  const tell = text.match(PROCESS);
  if (tell) errors.push(`${at}: process-tell "${tell[0]}" — rephrase as a person would (never reference scraping, batches, or how this entry was produced)`);
  if (EMDASH.test(text)) errors.push(`${at}: em/en dash in entry text — use a comma, period, or hyphen`);
  const m = parseInt(r.month, 10), y = parseInt(r.year, 10);
  if (!(m >= 1 && m <= 12)) errors.push(`${at}: bad month "${r.month}"`);
  if (!(y >= 2000 && y <= 2100)) errors.push(`${at}: bad year "${r.year}"`);
  const bot = botByKey.get(r.bot);
  if (!bot) errors.push(`${at}: unknown bot "${r.bot}"`);
  else {
    if (APPLY && !bot.user_id) errors.push(`${at}: bot "${r.bot}" has no user_id — run bots.mjs --apply first`);
    const bv = `${r.bot}|${r.vendor_id}`;
    if (perBotVenue.has(bv)) errors.push(`${at}: bot "${r.bot}" already has an entry for this venue in the batch`);
    perBotVenue.add(bv);
    perBot.set(r.bot, (perBot.get(r.bot) || 0) + 1);
  }
  for (const p of (r.photos || '').split(';').map((s) => s.trim()).filter(Boolean)) {
    if (!fs.existsSync(path.join(workdir, p))) errors.push(`${at}: photo missing ${p}`);
    if (!fs.existsSync(path.join(workdir, p.replace(/\.jpg$/, '_thumb.jpg')))) errors.push(`${at}: thumb missing for ${p}`);
  }
}
for (const [b, n] of perBot) if (n > 50) errors.push(`bot "${b}" has ${n} entries (max 50 per run)`);
if (errors.length) { console.error('VALIDATION FAILED:\n' + errors.join('\n')); process.exit(1); }

// Cross-entry redundancy check: two entries sharing a long word-run read as botty.
const shingles = new Map();
const dupWarnings = new Set();
for (const [i, r] of recons.entries()) {
  const words = `${r.price_details} ${r.notes}`.toLowerCase().replace(/[^a-z0-9$ ]+/g, ' ').split(/\s+/).filter(Boolean);
  for (let w = 0; w + 8 <= words.length; w++) {
    const sh = words.slice(w, w + 8).join(' ');
    if (shingles.has(sh) && shingles.get(sh) !== i) dupWarnings.add(`rows ${shingles.get(sh) + 2} & ${i + 2}: shared phrasing "…${sh}…"`);
    else shingles.set(sh, i);
  }
}
if (dupWarnings.size) console.log('WARNING — near-duplicate phrasing across entries (vary the wording):\n  ' + [...dupWarnings].slice(0, 10).join('\n  '));

// Verify vendors exist and (author, vendor) pairs aren't already uploaded.
const vendorIds = [...new Set(recons.map((r) => r.vendor_id))];
const { data: vendors, error: vErr } = await supabase.from('vendors').select('id, name').in('id', vendorIds);
if (vErr) { console.error('DB read failed:', vErr.message); process.exit(1); }
const known = new Set((vendors || []).map((v) => v.id));
const missingVendors = vendorIds.filter((id) => !known.has(id));
if (missingVendors.length) { console.error('unknown vendor_ids:\n' + missingVendors.join('\n')); process.exit(1); }

const botIds = bots.map((b) => b.user_id).filter(Boolean);
const { data: existing } = await supabase.from('recon_entries').select('author_id, vendor_id').in('author_id', botIds.length ? botIds : ['00000000-0000-0000-0000-000000000000']);
const done = new Set((existing || []).map((e) => `${e.author_id}|${e.vendor_id}`));

const toInsert = recons.filter((r) => !botByKey.get(r.bot).user_id || !done.has(`${botByKey.get(r.bot).user_id}|${r.vendor_id}`));
const skipped = recons.length - toInsert.length;

console.log(`upload ${APPLY ? 'APPLY' : 'DRY RUN'} — ${recons.length} rows, ${skipped} already uploaded, ${toInsert.length} to insert`);
for (const [b, n] of perBot) console.log(`  ${b}: ${n} entries`);
const photoCount = toInsert.reduce((n, r) => n + (r.photos ? r.photos.split(';').filter(Boolean).length : 0), 0);
console.log(`  photos to upload: ${photoCount} (x2 with thumbs)`);
if (!APPLY) { console.log('\nDRY RUN — nothing written. Re-run with --apply after user confirmation.'); process.exit(0); }

// ── Apply ─────────────────────────────────────────────────────────────────────
// created_at is backdated to a plausible moment inside the collected month so the
// batch doesn't land as N entries created in the same minute.
function backdate(month, year) {
  const start = Date.UTC(year, month - 1, 1);
  const end = Math.min(Date.UTC(year, month, 0, 23, 59), Date.now());
  return new Date(start + Math.random() * Math.max(end - start, 1)).toISOString();
}

let inserted = 0, media = 0;
for (const r of toInsert) {
  const bot = botByKey.get(r.bot);
  const { data: entry, error: eErr } = await supabase.from('recon_entries').insert({
    vendor_id: r.vendor_id,
    author_id: bot.user_id,
    recon_type: r.recon_type,
    recon_collected_month: parseInt(r.month, 10),
    recon_collected_year: parseInt(r.year, 10),
    price_text: r.price_text || null,
    price_details: r.price_details || null,
    notes: r.notes || null,
    service_region: null,
    status: 'active',
    created_at: backdate(parseInt(r.month, 10), parseInt(r.year, 10)),
  }).select('id').single();
  if (eErr) { console.error(`INSERT FAILED at ${r.venue} / ${r.bot} (${inserted} entries already written; re-run is safe): ${eErr.message}`); process.exit(1); }
  inserted++;

  const photos = (r.photos || '').split(';').map((s) => s.trim()).filter(Boolean);
  const sub = crypto.randomUUID();
  for (const [i, p] of photos.entries()) {
    const base = `${bot.user_id}/${sub}/photo-${i + 1}`;
    for (const [suffix, local] of [['', p], ['_thumb', p.replace(/\.jpg$/, '_thumb.jpg')]]) {
      const { error: sErr } = await supabase.storage.from('recon-media')
        .upload(`${base}${suffix}.jpg`, fs.readFileSync(path.join(workdir, local)), { contentType: 'image/jpeg', upsert: true });
      if (sErr) { console.error(`STORAGE FAILED ${base}${suffix}.jpg: ${sErr.message}`); process.exit(1); }
    }
    const { error: mErr } = await supabase.from('recon_media').insert({
      recon_entry_id: entry.id,
      storage_path: `${base}.jpg`,
      thumb_path: `${base}_thumb.jpg`,
      media_type: 'image',
    });
    if (mErr) { console.error(`MEDIA ROW FAILED for ${r.venue}: ${mErr.message}`); process.exit(1); }
    media++;
  }
}

// ── Verify ────────────────────────────────────────────────────────────────────
const { data: after } = await supabase.from('recon_entries').select('author_id, vendor_id').in('author_id', botIds);
const pairs = (after || []).map((e) => `${e.author_id}|${e.vendor_id}`);
const dups = pairs.filter((p, i) => pairs.indexOf(p) !== i);
console.log(`\nAPPLIED: ${inserted} entries, ${media} photos | bot entries in DB now: ${after?.length ?? '?'}`);
console.log(`verify — duplicate (bot, venue) pairs: ${dups.length ? dups.join(', ') : 'none'}`);
