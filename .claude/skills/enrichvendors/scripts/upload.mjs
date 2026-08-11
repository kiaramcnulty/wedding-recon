// Bulk-upload recons.csv as bot-authored recon entries (+ photos) for /enrichvenues.
// Dry-run by default; nothing is written without --apply.
// Idempotent: a bot never has two entries for one venue, so (author_id, vendor_id)
// is the natural dedup key — rows already in the DB are skipped on re-run.
// usage: node --env-file=.env.local .claude/skills/enrichvendors/scripts/upload.mjs <workdir> [--type photographer] [--apply]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseCSV, argValue, selectAll } from '../../launchvendors/scripts/lib.mjs';
import { etype } from './etype.mjs';
import { VENDOR_FILTERS } from '../../../../lib/constants/vendor-filters.ts';

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
// AI-slop tells; entries containing these must be rephrased before upload.
// Empty-evaluative filler is banned too: judgments must be tied to a number or a sourced fact.
const BANNED = /\b(stunning|breathtaking|nestled|boasts?|elevate[sd]?|unforgettable|magical|dream wedding|exquisite|picturesque|tucked away gem|genuine value|can't go wrong|won't disappoint|something for everyone|truly special)\b/i;
// Process tells: research-tooling OR pipeline/batch self-references no real couple would
// write. Two families: (1) crawler language — rephrase as a person would ("their site
// doesn't list pricing", "couldn't get the page to load"); (2) any hint that this entry
// is part of a scripted set being processed ("from this batch", "the enrichment run",
// "seeded venues") — a couple's note references the venue, never how the note was made.
const PROCESS = /\b(crawl\w*|scrape\w*|fetch\w*|dossier|harvest\w*|parse\w*|garbled text|boilerplate|batch\w*|enrich\w*|seeded|roster|pipeline|dataset|databases?|bots?|launchintel|digest\w*)\b/i;
// Research-artifact narration: describing the SOURCE MATERIAL instead of the vendor. A
// couple writes "they don't post prices anywhere"; only a script writes "reviews go back
// to 2020-2023" or "site didn't load (404)". Added 2026-07-29 — PROCESS missed this whole
// family, so it reached the CO beauty CSV and needed a 76-row rewrite pass.
// The load-failure half must be SUBJECT-AGNOSTIC. Anchoring it to "site|page|website" let
// eight real variants through in the 2026-07-29 CO hotel run — "kept 403ing on me", "their
// site 403s to any automated check", "rate card PDFs did not load", "Site pricing wouldn't
// load", "sites dont load for automated lookups" — because the subject was a PDF, a bare
// noun, or the failure was named by status code instead of by verb. Each escape cost a
// rewrite pass, and each narrower patch found one more spelling.
// The negation is REQUIRED before `load` so legitimate wedding usage survives: "vendor
// load-in starts at 9am" and "guests can load in through the side door" must NOT match.
const RESEARCH = new RegExp([
  /\b404\b|\b403\w*/,                                             // status codes, incl. "403s"/"403ing"
  /\bunreachable\b|\bautomated (check|lookup|request|tool)s?\b/,   // how it failed / who it failed for
  /\b(reviews (go|going) back to|no pricing to pull|nothing to pull)\b/,
  /(?:(?:did|would|could|does|do|will|can)\s*(?:n'?t|not)|failed to|never)\s+load\b(?!\s*-?\s*in\b)/,
  /\bsite (is|was)?\s*(down|unavailable|unreadable|inaccessible)\b/,
  /\b(couldn'?t|could not|can'?t|cannot) (access|reach|open|read) (the |their )?(site|page|website)\b/,
  /\bsite is (a )?dead link\b|\bper (their|the) (site|listing) copy\b/,
].map((r) => r.source).join('|'), 'i');
// NO bullet-style check here, deliberately. A NOTESTYLE regex briefly flagged notes that
// OPEN with a bullet as "a research scratchpad" — Kiara reversed that on 2026-07-29:
// "the bullets are okay and encouraged, the variety is good." Real people jot notes both
// ways, and a corpus where every entry is uniform prose reads MORE synthetic, not less.
// `debullet()` below already turns bullet boundaries into real newlines at insert, and the
// vendor page renders them with whitespace-pre-line, so this is a supported format that
// displays correctly. Do not re-add the check.
const EMDASH = /[—–]/; // no em/en dashes anywhere in entry text — real users type hyphens
// Literal line-break ESCAPES (backslash + n) rather than real newlines. Workers hand back
// one JSON object per row and the draft contract asks for `notes` on one logical line, so
// a worker wanting a break between bullets writes the escape. Nothing upstream undoes it:
// pipeline.mjs strips only REAL newlines, csvEsc sees nothing to quote, and debullet()
// below keys off WHITESPACE before a bullet — which an escape is not, so it never fires.
// It reached the DB verbatim and the vendor card, which renders whitespace-pre-line,
// printed "on shoots\n-she's described as" as literal text (reported 2026-08-04; the rows
// already written are repaired by migration 0031).
// This is REPAIRED, not rejected: the row is otherwise fine and the fix is unambiguous,
// so failing the whole upload over it would be pure friction. The count is reported below
// so a run that produces a lot of them is still visible.
const ESCAPES = /\\{1,2}[rnt]/;
// "Quote only" and its family — the retired price_text sentinel for a vendor that
// publishes nothing (Kiara, 2026-08-07). It was wrong twice over: asserted even on
// entries that DID state a number, which contradicts itself on the card ("Quote only but
// The Knot says $8k" — if we have a number we have a price data point), and read as a
// category label rather than as something a couple would say. Rows already in the DB were
// rewritten by migration 0036; the drafting contract now asks for plain wordings.
// Handled in two halves, exactly as that migration split them:
//   - wording alone       -> REPAIRED at insert by plainQuoteOnly() below, because the
//                            fix is unambiguous and failing an upload over a word choice
//                            would be pure friction (same call as ESCAPES).
//   - wording + a figure  -> HARD GATE here. What that headline should say instead is an
//                            editorial decision (lead with the number, in the entry's own
//                            voice), and a script amputating the clause would hide a
//                            drafting error rather than fix it. The migration had to do
//                            it mechanically only because legacy rows have no drafter to
//                            send back to.
// Keep both regexes in lockstep with pipeline.mjs, which counts them at the cheap
// pre-check so neither first surfaces here.
const QUOTE_ONLY = /(?:(?:pricing|price|prices|rates?|available|custom|by|on|via|per)\s+)*quotes?[\s-]+only|only\s+(?:available\s+)?(?:by|upon|on|via)\s+quotes?/i;
// Twin of MONEY in lib/recon-sort.ts and of the money pattern in migration 0036.
const MONEY = /\$\s*\d|\d\s*\$|\d\s*(?:dollars|usd)\b/i;
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
  const tell = text.match(PROCESS);
  if (tell) errors.push(`${at}: process-tell "${tell[0]}" — rephrase as a person would (never reference scraping, batches, or how this entry was produced)`);
  const artifact = text.match(RESEARCH);
  if (artifact) errors.push(`${at}: research-artifact narration "${artifact[0]}" — say what's true of the VENDOR ("they don't post pricing"), not what the source material looked like`);
  if (EMDASH.test(text)) errors.push(`${at}: em/en dash in entry text — use a comma, period, or hyphen`);
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
