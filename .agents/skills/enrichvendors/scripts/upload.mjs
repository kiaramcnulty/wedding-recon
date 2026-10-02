// Bulk-upload recons.csv as bot-authored recon entries (+ photos) for /enrichvenues.
// Dry-run by default; nothing is written without --apply.
// Idempotent: a bot never has two entries for one venue, so (author_id, vendor_id)
// is the natural dedup key — rows already in the DB are skipped on re-run.
// usage: node --env-file=.env.local .agents/skills/enrichvendors/scripts/upload.mjs <workdir> [--type photographer] [--apply]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseCSV, argValue, selectAll } from '../../launchvendors/scripts/lib.mjs';
import { etype } from './etype.mjs';
import { VENDOR_FILTERS } from '../../../../lib/constants/vendor-filters.ts';
// ONE definition of every prose gate, shared with pipeline.mjs status and the reconcile
// writers: see the header of prose-gate.mjs for why the hand-kept copies were retired.
import { BANNED, EMDASH, ESCAPES, QUOTE_ONLY, MONEY, toolingTell, dossierMarker, priceContradiction } from '../../../../scripts/reconcile/prose-gate.mjs';
// The chain/region-basis rule for tags, shared with the reconcile writers (plan item 15).
import { tagBasisProblem } from '../../../../scripts/reconcile/evidence.mjs';
import {
  slugOf, parseCallFile, contaminationHits, siteUnread, absenceClaims, identityBlocked,
  planDateMoves, reviewsFromHarvest, harvestCeiling, workdirDocFreq, dossierBackground, BOT_CAP,
} from './provenance.mjs';

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
const profile = etype();
const HEADERS = profile.headers;   // venue: original 11 cols; photos appends service_region
// --csv <name> lets each batch live in its own file (smaller review artifacts);
// (author_id, vendor_id) dedup makes multi-file uploads safe.
const rows = parseCSV(fs.readFileSync(path.join(workdir, argValue('csv') || 'recons.csv'), 'utf8'));
const hdr = rows[0].map((h) => h.trim());
const recons = rows.slice(1).filter((r) => r.some((c) => c && c.trim()))
  .map((r) => Object.fromEntries(HEADERS.map((h) => { const i = hdr.indexOf(h); return [h, i === -1 ? '' : (r[i] ?? '').trim()]; })));

// ── Validate ──────────────────────────────────────────────────────────────────
const RECON_TYPES = new Set(['online', 'virtual', 'in_person']);
// The prose gates are imported from scripts/reconcile/prose-gate.mjs (provenance and
// reasoning for every pattern live there): BANNED marketing/AI phrases, PROCESS tells and
// RESEARCH-artifact narration (both via toolingTell, which also folds curly apostrophes
// so "wouldn\u2019t load" cannot slip past a straight-quote pattern), EMDASH, ESCAPES
// (repaired at insert, not a gate) and QUOTE_ONLY (wording repaired at insert; next to a
// MONEY figure in the same field, a hard gate).
// NO bullet-style check, deliberately (Kiara, 2026-07-29: "the bullets are okay and
// encouraged, the variety is good"). debullet() below renders them. Do not re-add.

// Research-backed gates (provenance.mjs), the same ones `pipeline.mjs status` runs, so a
// hand-edited CSV or a CSV merged by an older pipeline cannot skip them:
//   - date floor: an entry may not be dated before the newest source it uses (merge moves
//     such dates forward; this catches a CSV that never went through that merge),
//   - absence claims on a vendor whose dossier never read a site,
//   - cross-vendor contamination against the batch call file the row was drafted from,
//   - the identity gate: no row for a vendor whose dossier says IDENTITY CHECK: FAILED
//     (or whose identity.json is flagged), plan item 7.
// Text-only gates added in 2026-10 alongside them: dossier labels/markers copied into the
// prose (dossierMarker) and a figure + "no price posted" on one card (priceContradiction).
// Research is looked up by the row's NAME slug, like every other enrich step, and only
// trusted when the dossier's first line carries this row's vendor_id (twin guard).
const researchByVid = new Map();
for (const r of recons) {
  if (researchByVid.has(r.vendor_id)) continue;
  const dir = path.join(workdir, 'research', slugOf(r.venue));
  const read = (f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8') : null);
  const dossier = read('dossier.md') || '';
  if (!dossier.split('\n', 1)[0].includes(`vendor_id=${r.vendor_id}`)) { researchByVid.set(r.vendor_id, null); continue; }
  let harvest = null;
  try { harvest = JSON.parse(read('harvest.json') || 'null'); } catch { harvest = null; }
  researchByVid.set(r.vendor_id, { name: r.venue, dossier, harvest, identity: identityBlocked(dossier, dir), dir });
}
const noResearch = [...researchByVid.values()].filter((v) => !v).length;
const docFreq = workdirDocFreq(workdir);   // same corpus merge used, so the two agree
const datePlan = planDateMoves(recons.map((r, i) => ({ key: i, vendor_id: r.vendor_id, month: r.month, year: r.year, text: `${r.price_text} ${r.price_details} ${r.notes}` })), {
  docFreq,
  reviewsFor: (vid) => reviewsFromHarvest(researchByVid.get(vid)?.harvest),
  ceilingFor: (vid) => harvestCeiling(researchByVid.get(vid)?.harvest),
  backgroundFor: (vid) => `${researchByVid.get(vid)?.name || ''}\n${dossierBackground(researchByVid.get(vid)?.dossier)}`,
});
const floorByRow = new Map(datePlan.moves.map((m) => [m.key, m]));
// The batch's call files (recons-<batch>.csv -> drafts/<batch>-call-NN.md) for the
// contamination check; vendor_id -> {own block, sibling blocks, header}.
const callByVid = new Map();
{
  const batchId = (/^recons-(.+?)(?:\.prephotos|\.backup)?\.csv$/.exec(path.basename(argValue('csv') || 'recons.csv')) || [])[1];
  const dd = path.join(workdir, 'drafts');
  const calls = batchId && fs.existsSync(dd) ? fs.readdirSync(dd).filter((f) => f.startsWith(`${batchId}-call-`) && f.endsWith('.md')) : [];
  for (const f of calls) {
    const c = parseCallFile(fs.readFileSync(path.join(dd, f), 'utf8'));
    for (const b of c.blocks) callByVid.set(b.vendor_id, { own: b, siblings: c.blocks.filter((x) => x !== b), header: c.header });
  }
  if (!calls.length) console.log('NOTE: no call files found for this CSV\'s batch, so the cross-vendor contamination check is skipped');
}
if (noResearch) console.log(`NOTE: ${noResearch} vendor(s) have no matching research dir (by name slug + vendor_id), so their date-floor / absence checks are skipped`);
const errors = [];
const perBot = new Map(), perBotVenue = new Set();
let escaped = 0, quoteOnly = 0;
for (const [i, r] of recons.entries()) {
  const at = `row ${i + 2} (${r.venue})`;
  if (!r.vendor_id) errors.push(`${at}: missing vendor_id`);
  if (!RECON_TYPES.has(r.recon_type)) errors.push(`${at}: bad recon_type "${r.recon_type}"`);
  if (!r.price_text || !r.price_details) errors.push(`${at}: price_text and price_details are REQUIRED on every entry`);
  // Comma-split tell: "$3,400" torn across two columns ("Starting at $3" + "400…").
  if (/\$\d{1,3}$/.test(r.price_text) && /^\d{3}\b/.test(r.price_details)) errors.push(`${at}: price looks comma-split across price_text/price_details ("${r.price_text}" + "${r.price_details.slice(0, 20)}") — rejoin the dollar amount`);
  if (profile.serviceRegionRequired && !(r.service_region || '').trim()) errors.push(`${at}: service_region is REQUIRED on every ${profile.key} entry`);
  const text = `${r.price_text} ${r.price_details} ${r.notes}`;
  const banned = text.match(BANNED);
  if (banned) errors.push(`${at}: banned marketing/AI phrase "${banned[0]}" — rephrase in the entry's voice`);
  const tell = toolingTell(text);
  if (tell?.kind === 'process-tell') errors.push(`${at}: process-tell "${tell.match}" — rephrase as a person would (never reference scraping, batches, or how this entry was produced)`);
  else if (tell) errors.push(`${at}: research-artifact narration "${tell.match}" — say what's true of the VENDOR ("they don't post pricing"), not what the source material looked like or how it was fetched`);
  const floor = floorByRow.get(i);
  if (floor) errors.push(`${at}: dated ${floor.from.month}/${floor.from.year} but uses a newer source (${floor.evidence.join('; ')}) — re-run pipeline.mjs merge, which moves it to ${floor.to.month}/${floor.to.year}, or redate it`);
  const res = researchByVid.get(r.vendor_id);
  const unread = res && siteUnread(res.dossier);
  if (unread) {
    const claims = absenceClaims(text);
    if (claims.length) errors.push(`${at}: absence claim "${claims[0].match}" but the dossier never read a site (${unread}) — nobody knows what that site lacks; drop the claim (a "No quote found" headline is fine)`);
  }
  const call = callByVid.get(r.vendor_id);
  if (call) {
    const hits = contaminationHits(text, call.own.text, call.siblings, call.header);
    if (hits.length) errors.push(`${at}: cross-vendor contamination ${hits.map((h) => `"${h.phrase}" (found only in ${h.siblings.join(', ')}'s research)`).join('; ')} — that fact belongs to another vendor in the same call file`);
  }
  if (EMDASH.test(text)) errors.push(`${at}: em/en dash in entry text — use a comma, period, or hyphen`);
  const mk = dossierMarker(text);
  if (mk) errors.push(`${at}: dossier label/marker "${mk}" copied into the entry — those are drafting scaffolding, never card text`);
  const pc = priceContradiction(r);
  if (pc) errors.push(`${at}: ${pc} — keep the figure and drop the no-price clause, or vice versa`);
  if (res?.identity) errors.push(`${at}: IDENTITY CHECK failed for this vendor (${res.identity}) — the crawled site likely belongs to another business; drop the row and fix the vendors row`);
  if (ESCAPES.test(text)) escaped++;
  // Per FIELD, not per entry. A plain "no quote found" headline above a price_details
  // that cites a third-party figure is honest and must not fail: it says we did not get a
  // quote, not that no price exists. The contradiction is a single field claiming pricing
  // is quote-only while stating a figure in that same breath.
  for (const col of ['price_text', 'price_details']) {
    if (!QUOTE_ONLY.test(r[col])) continue;
    quoteOnly++;
    if (MONEY.test(r[col])) errors.push(`${at}: ${col} says pricing is quote-only but states a figure in the same breath ("${r[col].slice(0, 70)}") — if you have a number you have a price data point, so lead with it and drop the quote-only framing`);
  }
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
for (const c of datePlan.conflicts) console.log(`  WARNING row ${c.key + 2} (${recons[c.key].venue}): its source-floor month ${c.to.month}/${c.to.year} is shared with a sibling entry`);
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
const { data: vendors, error: vErr } = await supabase.from('vendors').select('id, name, vendor_type, filters_source').in('id', vendorIds);
if (vErr) { console.error('DB read failed:', vErr.message); process.exit(1); }
const known = new Set((vendors || []).map((v) => v.id));
const vendorById = new Map((vendors || []).map((v) => [v.id, v]));
const missingVendors = vendorIds.filter((id) => !known.has(id));
if (missingVendors.length) { console.error('unknown vendor_ids:\n' + missingVendors.join('\n')); process.exit(1); }
// --type must match the vendors being uploaded. The profile decides whether service_region
// is required and kept; the 2026-07 supplemental CSVs were uploaded with no --type, so the
// venue profile skipped the service_region gate and nulled the column: 185 live
// service-area entries have no region (bot-recon quality plan, item 13).
const typeOk = new Set(profile.vendorTypes ?? [profile.vendorType]);
const wrongType = (vendors || []).filter((v) => !typeOk.has(v.vendor_type));
if (wrongType.length) {
  console.error(`TYPE MISMATCH: this run is --type ${profile.key} (${[...typeOk].join('/')}) but ${wrongType.length} vendor(s) are another type, e.g. ${wrongType.slice(0, 5).map((v) => `${v.name} (${v.vendor_type})`).join('; ')} — re-run with that vendor type's --type`);
  process.exit(1);
}

// ── Filter tags — the structured half, gated against the recon prose ───────────
// The HARD RULE (draft-contract.md): a tag may exist only if a sentence in this
// vendor's recon documents it. We enforce it mechanically here — every tag's
// quote must be a verbatim substring of the prose being uploaded — so a tag the
// couple would not find on the card cannot reach the database. Values are checked
// against VENDOR_FILTERS. Absent for old runs (no filters file) -> nothing happens.
const NORM = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const DESCRIPTOR = /^(price_basis|price_kind|price_confidence)$/;   // describe a price, ride on its sentence, need no quote
const csvBase = (argValue('csv') || 'recons.csv');
const filtersPath = path.join(workdir, argValue('filters') || csvBase.replace(/^recons/, 'filters').replace(/\.csv$/, '.jsonl'));

// The full recon prose per vendor (all its rows), normalized once — this is what
// a tag's quote must appear in. Built from the CSV being uploaded.
const proseByVid = new Map();
for (const r of recons) {
  const prev = proseByVid.get(r.vendor_id) || '';
  proseByVid.set(r.vendor_id, prev + ' ' + NORM([r.notes, r.price_text, r.price_details].join(' ')));
}

function gateFilters(vid, obj) {
  const v = vendorById.get(vid);
  const defs = Object.fromEntries((VENDOR_FILTERS[v?.vendor_type] || []).map((d) => [d.key, d]));
  const rangeKeys = new Set();
  for (const d of Object.values(defs)) if (d.kind === 'range') { rangeKeys.add(d.lo ?? d.key); if (d.hi) rangeKeys.add(d.hi); }
  const prose = proseByVid.get(vid) || '';
  const out = {}, errs = [];
  for (const [key, spec] of Object.entries(obj)) {
    const value = spec && typeof spec === 'object' && 'value' in spec ? spec.value : spec;
    const quote = spec && typeof spec === 'object' ? spec.quote : undefined;
    const def = defs[key];
    const isRange = rangeKeys.has(key), isDesc = DESCRIPTOR.test(key);
    if (!def && !isRange && !isDesc) { errs.push(`${v?.name} [${key}]: not an attribute of vendor type ${v?.vendor_type}`); continue; }
    // value shape
    if (def?.kind === 'multi') {
      const allowed = new Set(def.options.map((o) => o.value));
      const vals = Array.isArray(value) ? value : [value];
      const bad = vals.filter((x) => !allowed.has(String(x)));
      if (!vals.length || bad.length) { errs.push(`${v?.name} [${key}]: value(s) not allowed: ${bad.join(', ') || '(empty)'}`); continue; }
    } else if (def?.kind === 'bool') {
      if (typeof value !== 'boolean') { errs.push(`${v?.name} [${key}]: expected true/false`); continue; }
    } else if (!isDesc && (typeof value !== 'number' || !Number.isFinite(value))) {
      errs.push(`${v?.name} [${key}]: expected a number`); continue;
    }
    // THE HARD RULE: the fact must live in the recon. Descriptor keys ride on the
    // priced sentence and carry no quote of their own.
    if (!isDesc) {
      if (!quote) { errs.push(`${v?.name} [${key}]: no quote - every tag must cite the recon sentence that documents it`); continue; }
      if (!prose.includes(NORM(quote))) { errs.push(`${v?.name} [${key}]: quote not found in this vendor's recon - a tag cannot exist without prose documenting it ("${String(quote).slice(0, 50)}")`); continue; }
      // For a number, the cited sentence must actually STATE the number, not just
      // be a real sentence. Stops a lazy citation pointing capacity_max at the
      // price sentence. Comma-insensitive so "200" matches "2,00" -> normalize both.
      if (typeof value === 'number') {
        const nums = (NORM(quote).match(/\d[\d,.]*/g) || []).map((s) => s.replace(/,/g, ''));
        if (!nums.includes(String(value))) { errs.push(`${v?.name} [${key}]=${value}: the number is not in its own quote ("${String(quote).slice(0, 50)}") - cite the sentence that states it`); continue; }
      }
    }
    // Basis (plan item 15): brand/chain wording, or a reddit-based sentence when every
    // reddit excerpt on file for the vendor is region/chain-level, may not set a property tag.
    if (!isDesc) {
      const res = researchByVid.get(vid);
      const rs = res?.dir && path.join(res.dir, 'reddit-slice.txt');
      const why = tagBasisProblem(quote, { prose, redditSlice: rs && fs.existsSync(rs) ? fs.readFileSync(rs, 'utf8') : null });
      if (why) { errs.push(`${v?.name} [${key}]: ${why}`); continue; }
    }
    out[key] = { value, quote: quote ?? null };
  }
  return { out, errs };
}

const gatedFilters = new Map();   // vid -> {key: {value, quote}}
let filterErrs = [];
if (fs.existsSync(filtersPath)) {
  const frows = fs.readFileSync(filtersPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  for (const fr of frows) {
    if (!known.has(fr.vendor_id)) continue;
    if (vendorById.get(fr.vendor_id)?.filters_source === 'manual') continue;   // never clobber a hand edit
    const { out, errs } = gateFilters(fr.vendor_id, fr.filters);
    filterErrs.push(...errs);
    if (Object.keys(out).length) gatedFilters.set(fr.vendor_id, out);
  }
  if (filterErrs.length) {
    console.error(`FILTER GATE — ${filterErrs.length} problems (fix the drafts and re-merge; nothing written):\n  ` + filterErrs.join('\n  '));
    process.exit(1);
  }
  console.log(`filter tags gated: ${gatedFilters.size} vendors will get filters written`);
}

const botIds = bots.map((b) => b.user_id).filter(Boolean);
const { data: existing } = await selectAll(() => supabase.from('recon_entries').select('author_id, vendor_id').order('id').in('author_id', botIds.length ? botIds : ['00000000-0000-0000-0000-000000000000']));
const done = new Set((existing || []).map((e) => `${e.author_id}|${e.vendor_id}`));

const toInsert = recons.filter((r) => !botByKey.get(r.bot).user_id || !done.has(`${botByKey.get(r.bot).user_id}|${r.vendor_id}`));
const skipped = recons.length - toInsert.length;

// BOT_CAP (provenance.mjs): at most 3 BOT entries per vendor, counting the ACTIVE bot
// entries already live (any roster, any run) plus the rows this upload would insert. Real
// users' entries do not count. The per-run check above (one entry per bot per vendor)
// never saw earlier runs, which is how 37 vendors reached 4-6 bot entries. Read-only, in
// chunks of 100 ids so the `.in()` list stays well under the URL limit (see verify).
const liveBots = new Map();
for (let k = 0; k < vendorIds.length; k += 100) {
  const { data, error: cErr } = await selectAll(() => supabase.from('recon_entries')
    .select('id, vendor_id, status, profiles!inner(is_bot)').in('vendor_id', vendorIds.slice(k, k + 100)).order('id'));
  if (cErr) { console.error('DB read failed (live bot-entry count):', cErr.message); process.exit(1); }
  for (const e of data || []) if (e.status === 'active' && e.profiles?.is_bot) liveBots.set(e.vendor_id, (liveBots.get(e.vendor_id) || 0) + 1);
}
const newPerVendor = new Map();
for (const r of toInsert) newPerVendor.set(r.vendor_id, (newPerVendor.get(r.vendor_id) || 0) + 1);
const overCap = [...newPerVendor].filter(([vid, n]) => (liveBots.get(vid) || 0) + n > BOT_CAP);
if (overCap.length) {
  console.error(`BOT CAP — ${overCap.length} vendor(s) would exceed ${BOT_CAP} bot entries (live + this upload); drop rows for them, nothing written:\n  `
    + overCap.map(([vid, n]) => `${vendorById.get(vid)?.name} (${vid}): ${liveBots.get(vid) || 0} live + ${n} new`).join('\n  '));
  process.exit(1);
}

console.log(`upload ${APPLY ? 'APPLY' : 'DRY RUN'} — ${recons.length} rows, ${skipped} already uploaded, ${toInsert.length} to insert`);
for (const [b, n] of perBot) console.log(`  ${b}: ${n} entries`);
const photoCount = toInsert.reduce((n, r) => n + (r.photos ? r.photos.split(';').filter(Boolean).length : 0), 0);
console.log(`  photos to upload: ${photoCount} (x2 with thumbs)`);
if (escaped) console.log(`  literal line-break escapes repaired at insert: ${escaped} rows (see ESCAPES above)`);
if (quoteOnly) console.log(`  quote-only wording reworded at insert: ${quoteOnly} fields (see QUOTE_ONLY above)`);
if (!APPLY) { console.log('\nDRY RUN — nothing written. Re-run with --apply after user confirmation.'); process.exit(0); }

// ── Apply ─────────────────────────────────────────────────────────────────────
// created_at is backdated to a plausible moment inside the collected month so the
// batch doesn't land as N entries created in the same minute.
function backdate(month, year) {
  const start = Date.UTC(year, month - 1, 1);
  const end = Math.min(Date.UTC(year, month, 0, 23, 59), Date.now());
  return new Date(start + Math.random() * Math.max(end - start, 1)).toISOString();
}

// Turn the literal ESCAPES flagged by ESCAPES above into the real characters they stand
// for. Runs on all three prose columns, not just notes: price_details renders
// whitespace-pre-line too, and in price_text a real newline collapses to a space in HTML,
// which is the right outcome for a one-line headline. The CR+LF pair is collapsed first
// so it yields ONE newline; {1,2} covers the doubly-escaped form.
const unescapeBreaks = (t) => (t || '')
  .replace(/\\{1,2}r\\{1,2}n/g, '\n')
  .replace(/\\{1,2}[rn]/g, '\n')
  .replace(/\\{1,2}t/g, ' ');

// CSV notes are one physical line (serialization contract); the app renders notes with
// whitespace-pre-line, so bullet boundaries become REAL newlines here at insert:
// glued bullets ('-beau is...') and spaced label bullets (' - Style:').
// Unescaping runs FIRST so the char preceding a bullet is real whitespace — otherwise the
// `\s+` below is looking at the "n" of an escape and the bullet never becomes a line.
const debullet = (t) => unescapeBreaks(t).replace(/\s+(?=-[A-Za-z])/g, '\n').replace(/ - (?=[A-Z0-9])/g, '\n- ');

// Swap the retired quote-only wording (flagged by QUOTE_ONLY above) for plain language.
// Only the two positions that cannot break a sentence are touched, matching migration
// 0036: the phrase OPENING the field, and the phrase closing it as its own fenced clause.
// A mid-sentence occurrence is left verbatim — "they are no quote found so you email
// them" is worse than the phrase it replaces — and the validation loop above has already
// hard-failed the case where the field states a figure anyway, so the money-bearing shape
// never reaches here.
//
// The wording is drawn from the vendor+bot pair rather than at random so the same CSV
// uploads identically on a re-run, and so two entries on one vendor can still differ.
const WORDINGS = ['No quote provided', 'No quote found', "Didn't get a quote"];
const wordingFor = (seed) => WORDINGS[[...seed].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) % WORDINGS.length];
const QO_LEAD = /^[\s,;:.!/-]*(?:(?:pricing|price|prices|rates?|available|custom|by|on|via|per)\s+)*quotes?[\s-]+only|^[\s,;:.!/-]*only\s+(?:available\s+)?(?:by|upon|on|via)\s+quotes?/i;
const QO_TAIL = /[,;:-]\s*(?:(?:pricing|price|prices|rates?|available|custom|by|on|via|per)\s+)*quotes?[\s-]+only[\s.!]*$/i;
const plainQuoteOnly = (t, seed) => {
  const s = t || '';
  if (!QUOTE_ONLY.test(s)) return s;
  const w = wordingFor(seed);
  if (QO_LEAD.test(s)) return s.replace(QO_LEAD, w);
  if (QO_TAIL.test(s)) return s.replace(/\s*(?:(?:pricing|price|prices|rates?|available|custom|by|on|via|per)\s+)*quotes?[\s-]+only[\s.!]*$/i, ` ${w.toLowerCase()}`);
  return s;
};

let inserted = 0, media = 0;
for (const r of toInsert) {
  const bot = botByKey.get(r.bot);
  const { data: entry, error: eErr } = await supabase.from('recon_entries').insert({
    vendor_id: r.vendor_id,
    author_id: bot.user_id,
    recon_type: r.recon_type,
    recon_collected_month: parseInt(r.month, 10),
    recon_collected_year: parseInt(r.year, 10),
    price_text: plainQuoteOnly(unescapeBreaks(r.price_text), `${r.vendor_id}|${r.bot}`) || null,
    price_details: plainQuoteOnly(unescapeBreaks(r.price_details), `${r.vendor_id}|${r.bot}|d`) || null,
    notes: debullet(r.notes) || null,
    service_region: profile.serviceRegionRequired ? (r.service_region || null) : null,
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

// ── Write filter tags (after the recon they cite is in) ───────────────────────
// Merged with the vendor's current filters so an attribute another run already
// set is preserved; a manual row was skipped at the gate. filters_meta records
// the recon quote as evidence and filters_source flips to recon so a re-run of
// the extraction backfill cannot clobber these (precedence manual>recon>extraction).
let filtersWritten = 0;
if (APPLY && gatedFilters.size) {
  for (const [vid, tags] of gatedFilters) {
    const { data: live } = await supabase.from('vendors').select('filters, filters_meta, filters_source').eq('id', vid).single();
    if (live?.filters_source === 'manual') continue;
    const filters = { ...(live?.filters || {}) }, meta = { ...(live?.filters_meta || {}) }, stamp = new Date().toISOString();
    for (const [key, { value, quote }] of Object.entries(tags)) {
      filters[key] = Array.isArray(value) && Array.isArray(filters[key]) ? [...new Set([...filters[key], ...value])] : value;
      meta[key] = quote ? { source: 'recon', updated_at: stamp, quote } : { source: 'recon', updated_at: stamp };
    }
    const { error } = await supabase.from('vendors').update({ filters, filters_meta: meta, filters_source: 'recon', filters_updated_at: stamp }).eq('id', vid);
    if (error) { console.error(`FILTER WRITE FAILED for ${vendorById.get(vid)?.name}: ${error.message}`); process.exit(1); }
    filtersWritten++;
  }
  console.log(`filter tags written to ${filtersWritten} vendors`);
} else if (gatedFilters.size) {
  console.log(`(dry run) would write filter tags to ${gatedFilters.size} vendors`);
}

// ── Verify ────────────────────────────────────────────────────────────────────
const { data: after } = await selectAll(() => supabase.from('recon_entries').select('author_id, vendor_id').order('id').in('author_id', botIds));
const pairs = (after || []).map((e) => `${e.author_id}|${e.vendor_id}`);
const dups = pairs.filter((p, i) => pairs.indexOf(p) !== i);
console.log(`\nAPPLIED: ${inserted} entries, ${media} photos | bot entries in DB now: ${after?.length ?? '?'}`);
console.log(`verify — duplicate (bot, venue) pairs: ${dups.length ? dups.join(', ') : 'none'}`);
