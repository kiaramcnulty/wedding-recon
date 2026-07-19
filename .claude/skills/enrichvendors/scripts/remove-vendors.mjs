// Remove mis-seeded / wrong-type vendors (and everything that cascades from them).
// Dry-run by default; NOTHING is deleted without --apply.
//
// Why this exists: a wrong-type vendor (a stay-only hotel seeded as a VENUE, a retail
// shop swept into a caterer run) should leave the directory entirely, not linger with a
// hedged "call direct" recon. `vendors(id)` cascades to recon_entries -> recon_media,
// saved_vendors, and reports (0001_init.sql), so one delete of the vendor row removes the
// vendor AND all its recon in a single shot. This is the safe, repeatable landing for the
// wrong-type (NOT*) flag from drafting (SKILL.md Phase 3).
//
// It is DELIBERATELY human-gated. Workers over-fire NOT* (real venues like Park Hyatt
// Beaver Creek were wrongly flagged because their dossiers had no wedding-specific text),
// so you vet the list, dry-run to see the blast radius, and only then --apply. See
// SKILL.md line ~86 for the vetting rule: only unambiguous other-type businesses go here;
// anything that could plausibly host an event stays as an unenriched pin.
//
// usage:
//   node --env-file=.env.local .claude/skills/enrichvendors/scripts/remove-vendors.mjs \
//        --id <uuid> [--id <uuid> ...] [--name-has "<substr>"] [--apply]
//   node --env-file=.env.local ... remove-vendors.mjs --ids-file <path> [--apply]
//        (--ids-file: one uuid per line; blank lines and '# ...' comments ignored)
//   node --env-file=.env.local ... remove-vendors.mjs \
//        --strong-from <drafts/ID-flags.json | flags.txt> --manifest <drafts/ID-manifest.json> [--apply]
//        (the auto-remove path: pulls ONLY the strong NOT*! tier and resolves it via the
//         manifest; repeat --manifest for a multi-batch run. Combine with --id if needed.)
//
// Guard rails (dry-run reports each; --apply refuses if any BLOCKER is unresolved):
//   * BLOCKER  vendor was added by a real user (created_by is set) — pass --force-user-vendor
//     to override. A wrong-type cleanup never deletes user-created rows (SKILL.md line 137).
//   * BLOCKER  vendor has recon from a NON-bot author — pass --force-user-recon to override.
//     Real couples' recon is never collateral of a bot-content cleanup.
//   * --name-has "<substr>": every fetched vendor name MUST contain it (case-insensitive),
//     else the whole run aborts. Cheap fat-finger guard against a wrong uuid.
//   * caps at 25 ids per run unless --force (guards a runaway mass delete).
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { argValue, selectAll } from '../../launchvendors/scripts/lib.mjs';

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const FORCE_USER_VENDOR = process.argv.includes('--force-user-vendor');
const FORCE_USER_RECON = process.argv.includes('--force-user-recon');
const nameHas = (argValue('name-has') || '').toLowerCase();

for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[k]) { console.error(`${k} missing — run with --env-file=.env.local from the repo root`); process.exit(1); }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Collect target ids: repeated --id and/or --ids-file ─────────────────────────
const ids = [];
process.argv.forEach((a, i) => { if (a === '--id' && process.argv[i + 1]) ids.push(process.argv[i + 1].trim()); });
const idsFile = argValue('ids-file');
if (idsFile) {
  for (const raw of fs.readFileSync(idsFile, 'utf8').split('\n')) {
    const l = raw.replace(/#.*$/, '').trim();
    if (l) ids.push(l);
  }
}

// --strong-from <flags file> + --manifest <file>...: the auto-remove path. Resolves ONLY
// the STRONG "!" tier (NOTAVENUE!, NOTCATERER!, ...) to vendor ids via the batch manifest;
// soft NOT* and THIN/SHORT are left alone (they are reports the orchestrator vets by hand).
// Accepts the API-mode drafts/<id>-flags.json ({custom_id: "flag string"}) OR a harness-mode
// flags.txt (one "<FLAG> <slug>" per line).
function strongSlugsFromFlagString(s) {
  const re = /(NOT[A-Z]+!|NOT[A-Z]+|THIN|SHORT)\s*:/g;
  const hits = []; let m;
  while ((m = re.exec(s)) !== null) hits.push({ flag: m[1], at: m.index, slugAt: re.lastIndex });
  const slugs = [];
  for (let i = 0; i < hits.length; i++) {
    if (!hits[i].flag.endsWith('!')) continue;
    const end = i + 1 < hits.length ? hits[i + 1].at : s.length;
    for (const tok of s.slice(hits[i].slugAt, end).split(/[\s,]+/)) {
      if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tok)) slugs.push(tok);
    }
  }
  return slugs;
}
const strongFrom = argValue('strong-from');
if (strongFrom) {
  const raw = fs.readFileSync(strongFrom, 'utf8');
  const strongSlugs = new Set();
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { /* not JSON — treat as flags.txt below */ }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const v of Object.values(parsed)) for (const s of strongSlugsFromFlagString(String(v ?? ''))) strongSlugs.add(s);
  } else {
    for (const line of raw.split('\n')) {
      const l = line.replace(/#.*$/, '').trim(); if (!l) continue;
      const [flag, ...rest] = l.split(/\s+/);
      if (/^NOT[A-Z]+!$/.test(flag)) for (const s of rest) if (s) strongSlugs.add(s.replace(/,+$/, ''));
    }
  }
  const manifestFiles = process.argv.map((a, i) => (a === '--manifest' ? process.argv[i + 1] : null)).filter(Boolean);
  if (!manifestFiles.length) { console.error('--strong-from needs at least one --manifest <file> to resolve slugs to vendor ids'); process.exit(1); }
  const slugToId = new Map();
  for (const mf of manifestFiles) for (const row of JSON.parse(fs.readFileSync(mf, 'utf8'))) if (row.slug && row.vendor_id) slugToId.set(row.slug, row.vendor_id);
  const unresolved = [];
  for (const slug of strongSlugs) { const id = slugToId.get(slug); if (id) ids.push(id); else unresolved.push(slug); }
  console.log(`strong (auto-remove) slugs: ${strongSlugs.size} | resolved ${strongSlugs.size - unresolved.length}${unresolved.length ? ` | UNRESOLVED ${unresolved.length}: ${unresolved.join(', ')}` : ''}`);
  if (unresolved.length) console.log('  (unresolved slugs are not in the given manifest(s) — pass the matching --manifest, or remove by --id)');
}

const targetIds = [...new Set(ids)];
if (!targetIds.length) { console.error('no vendor ids — pass --id <uuid> (repeatable) and/or --ids-file <path>'); process.exit(1); }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const badFmt = targetIds.filter((id) => !UUID.test(id));
if (badFmt.length) { console.error(`not valid uuids:\n${badFmt.map((s) => `  ${s}`).join('\n')}`); process.exit(1); }
if (targetIds.length > 25 && !FORCE) { console.error(`${targetIds.length} ids exceeds the 25-per-run safety cap — re-run with --force if that is intended`); process.exit(1); }

// ── Fetch vendors + full dependency picture ─────────────────────────────────────
const { data: vendors, error: vErr } = await supabase
  .from('vendors').select('id,name,city,region,source,created_by,google_place_id').in('id', targetIds);
if (vErr) { console.error('vendor fetch failed:', vErr.message); process.exit(1); }

const found = new Set(vendors.map((v) => v.id));
const missing = targetIds.filter((id) => !found.has(id));

const { data: recon, error: rErr } = await selectAll(() =>
  supabase.from('recon_entries').select('id,vendor_id,author_id,status').in('vendor_id', targetIds).order('id'));
if (rErr) { console.error('recon fetch failed:', rErr.message); process.exit(1); }

const reconIds = recon.map((r) => r.id);
const authorIds = [...new Set(recon.map((r) => r.author_id))];
const authors = new Map();
if (authorIds.length) {
  const { data: profs, error: pErr } = await supabase.from('profiles').select('id,username,is_bot').in('id', authorIds);
  if (pErr) { console.error('profile fetch failed:', pErr.message); process.exit(1); }
  for (const p of profs) authors.set(p.id, p);
}

const mediaByEntry = new Map();
if (reconIds.length) {
  const { data: media, error: mErr } = await selectAll(() =>
    supabase.from('recon_media').select('id,recon_entry_id').in('recon_entry_id', reconIds).order('id'));
  if (mErr) { console.error('media fetch failed:', mErr.message); process.exit(1); }
  for (const m of media) mediaByEntry.set(m.recon_entry_id, (mediaByEntry.get(m.recon_entry_id) || 0) + 1);
}

const { data: saves, error: sErr } = await selectAll(() =>
  supabase.from('saved_vendors').select('id,vendor_id').in('vendor_id', targetIds).order('id'));
if (sErr) { console.error('saves fetch failed:', sErr.message); process.exit(1); }
const savesByVendor = new Map();
for (const s of saves) savesByVendor.set(s.vendor_id, (savesByVendor.get(s.vendor_id) || 0) + 1);

// ── Per-vendor report + blockers ────────────────────────────────────────────────
const reconByVendor = new Map();
for (const r of recon) { (reconByVendor.get(r.vendor_id) || reconByVendor.set(r.vendor_id, []).get(r.vendor_id)).push(r); }

let nameMismatch = false;
const blocked = [];
const clear = [];
console.log(`\nTargets: ${targetIds.length} id(s) | found ${vendors.length}${missing.length ? ` | NOT FOUND ${missing.length}` : ''}\n`);
if (missing.length) console.log(`  not in vendors table (already gone?):\n${missing.map((id) => `    ${id}`).join('\n')}\n`);

for (const v of vendors) {
  const rs = reconByVendor.get(v.id) || [];
  const media = rs.reduce((n, r) => n + (mediaByEntry.get(r.id) || 0), 0);
  const savedCount = savesByVendor.get(v.id) || 0;
  const botAuthors = [], userAuthors = [];
  for (const r of rs) {
    const a = authors.get(r.author_id);
    (a && a.is_bot ? botAuthors : userAuthors).push(a ? a.username : r.author_id);
  }
  const reasons = [];
  if (v.created_by && !FORCE_USER_VENDOR) reasons.push('user-created vendor (created_by set) — needs --force-user-vendor');
  if (userAuthors.length && !FORCE_USER_RECON) reasons.push(`${userAuthors.length} recon from non-bot author(s): ${[...new Set(userAuthors)].join(', ')} — needs --force-user-recon`);
  if (nameHas && !(v.name || '').toLowerCase().includes(nameHas)) { reasons.push(`name does not contain --name-has "${nameHas}"`); nameMismatch = true; }

  console.log(`  ${v.name}  [${v.id}]`);
  console.log(`    ${v.city || '?'}, ${v.region || '?'} | source=${v.source || '?'} | ${v.created_by ? 'created_by=' + v.created_by : 'seed (created_by=null)'}`);
  console.log(`    recon: ${rs.length} (${botAuthors.length} bot${userAuthors.length ? `, ${userAuthors.length} USER` : ''}) | media: ${media} | hub saves: ${savedCount}`);
  if (reasons.length) { console.log(`    BLOCKED: ${reasons.join(' | ')}`); blocked.push(v); }
  else clear.push(v);
  console.log('');
}

// --name-has mismatch is a hard, whole-run abort: a wrong uuid slipped in.
if (nameMismatch) { console.error('ABORT: at least one vendor name does not match --name-has. Fix the id list; nothing was touched.'); process.exit(1); }

console.log(`Clear to delete: ${clear.length} | blocked: ${blocked.length}`);
if (!clear.length) { console.log('nothing to delete.'); process.exit(blocked.length ? 1 : 0); }

if (!APPLY) {
  console.log('\nDRY RUN — nothing deleted. Re-run with --apply after reviewing the list above.');
  console.log('(delete cascades: vendors -> recon_entries -> recon_media, plus saved_vendors + reports.)');
  process.exit(0);
}

// ── Apply: delete the vendor rows; cascade removes recon/media/saves/reports ─────
const delIds = clear.map((v) => v.id);
const { error: dErr } = await supabase.from('vendors').delete().in('id', delIds);
if (dErr) { console.error('delete failed:', dErr.message); process.exit(1); }

// Verify the rows are actually gone.
const { data: still } = await supabase.from('vendors').select('id').in('id', delIds);
const remaining = (still || []).map((r) => r.id);
if (remaining.length) { console.error(`WARNING: ${remaining.length} still present after delete: ${remaining.join(', ')}`); process.exit(1); }
console.log(`\nDELETED ${delIds.length} vendor(s) and all cascaded recon/media/saves.`);
if (blocked.length) console.log(`(skipped ${blocked.length} blocked — override flags above if those were also intended.)`);
