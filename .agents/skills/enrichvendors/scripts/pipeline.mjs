// One CLI for /enrichvendors batch mechanics. Replaces the throwaway orchestrator
// scripts that previously burned a turn each (assign/coverage/repair/verify/state).
// All commands accept --type <venue|photographer|caterer|music|flowers|dress|planner|hairmakeup|hotelblocks> (default venue).
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
// usage: node --env-file=.env.local .agents/skills/enrichvendors/scripts/pipeline.mjs <workdir> <cmd> [flags]
//   batch:      --region ST --roster <path> --size N --batch <id> [--per-call 25] [--only "Name A;Name B"] [--exclude "..."] [--supplemental]
//               [--mode api|harness]  api (DEFAULT): call files carry a no-tools delivery
//               override (JSON lines in the response body + a final {"_flags": ...} line)
//               and go to the Batch API via draft.mjs. harness: plain call files for
//               draft-worker agents (the no-key fallback).
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
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { norm, parseCSV, argValue, selectAll } from '../../launchvendors/scripts/lib.mjs';
import { etype, researchDirs, filterVocab } from './etype.mjs';
// ONE definition of every prose gate, shared with upload.mjs and the reconcile writers
// (see the header of prose-gate.mjs for why the three hand-kept copies were retired).
import { BANNED, EMDASH, ESCAPES, QUOTE_ONLY, MONEY, toolingTell, dossierMarker, priceContradiction } from '../../../../scripts/reconcile/prose-gate.mjs';
// The chain/region-basis rule for tags, shared with the reconcile writers (plan item 15).
import { tagBasisProblem } from '../../../../scripts/reconcile/evidence.mjs';
import {
  slugOf, parseCallFile, contaminationHits, siteUnread, absenceClaims, identityBlocked,
  planDateMoves, reviewsFromHarvest, harvestCeiling, workdirDocFreq, dossierBackground, BOT_CAP,
} from './provenance.mjs';

const workdir = process.argv[2];
const cmd = process.argv[3];
const CMDS = ['batch', 'status', 'merge', 'verify', 'photos-map', 'health'];
if (!workdir || workdir.startsWith('--') || !CMDS.includes(cmd)) {
  console.error(`usage: pipeline.mjs <workdir> <${CMDS.join('|')}> [--type venue|photographer|caterer|music|flowers|dress|planner|hairmakeup|hotelblocks] [flags]`); process.exit(1);
}
const profile = etype();
const req = (k) => { const v = argValue(k); if (!v) { console.error(`--${k} is required for ${cmd}`); process.exit(1); } return v; };
const needEnv = () => { for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) if (!process.env[k]) { console.error(`${k} missing — run with --env-file=.env.local`); process.exit(1); } };
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Per-type CSV shape: venue = the original 11 columns; photos appends service_region
// LAST so every venue column index is untouched. First column is named 'venue' for all
// types (historical; it holds the vendor name).
const HEADERS = profile.headers;
// The prose gates (BANNED, EMDASH, PROCESS + RESEARCH via toolingTell, QUOTE_ONLY, MONEY,
// ESCAPES) are imported from scripts/reconcile/prose-gate.mjs, the single definition
// upload.mjs also uses, so `status` fails on exactly what the upload gate fails on.
// (2026-07-29: status lacked PROCESS entirely, so 21 process-tells sailed through it and
// surfaced only at the upload dry-run, after the CSV had been built.) Two are counted here
// but REPAIRED at insert rather than gated, because the fix is unambiguous: literal
// line-break ESCAPES (2026-08-04) and the retired "Quote only" wording on its own
// (2026-08-07; next to a money figure in the same field it IS a gate).
// NO bullet-style check, deliberately: Kiara, 2026-07-29, "the bullets are okay and
// encouraged, the variety is good." Do not re-add.
//
// Gates that need the RESEARCH, not just the text (date floor, absence claims on an unread
// site, cross-vendor contamination) live in ./provenance.mjs, shared with upload.mjs and
// the live-corpus remediation sweep.
// A dossier's SOURCE text length: everything except dossier.mjs's own scaffolding
// (marker lines, section headings, `[site: ...]` / `--- [rdN]` labels, `[rN ...]` /
// `[dN ...]` ids, `[rest ... omitted]` notes). Feeds entryCountFor in batch.
const SCAFFOLD_LINE = /^(IDENTITY CHECK|NO WEBSITE ON FILE|SITE CRAWL FAILED|SITE TEXT THIN|SITE PAGES UNREAD|OTHER ACTS EXCLUDED|SOURCE TRUNCATED|## |\[site: |\[other pricing|\[rest of |\[price passage cut|--- \[rd)/;
const sourceChars = (t) => String(t || '').split('\n').filter((l) => !SCAFFOLD_LINE.test(l))
  .map((l) => l.replace(/\[(?:rest of [^\]]*|rest omitted)\]/g, '').replace(/^- \[(?:r|d|rd)\d+[^\]]*\]\s*/, '')).join('\n').length;
const nameKey = (s) => norm(s).replace(/\b(the|at|by|of|a)\b/g, ' ').replace(/\s+/g, ' ').trim();
const csvEsc = (s) => (/[",\n]/.test(s ?? '') ? `"${String(s).replace(/"/g, '""')}"` : (s ?? ''));
const draftsDir = path.join(workdir, 'drafts');

// --mode api: call files go to the Message Batches API via draft.mjs instead of
// harness draft-worker agents. The reference header's delivery contract (Write tool +
// reply line) doesn't exist there, so API-mode call files carry this override as the
// FINAL block. Keep the flag vocabulary in sync with references/common/draft-contract.md
// (the two wrong-type tiers) + references/<type>/type-rules.md.
const API_FOOTER = `
=== API MODE — DELIVERY OVERRIDE (no tools) ===
You are running as a plain API call. There is no Write tool and no separate reply
channel, so the delivery instructions above (ONE Write call, one-line reply) do NOT
apply. Instead:
- Your ENTIRE response must be JSON Lines: one JSON object per row, one object per line.
- No markdown fences, no preamble, no commentary — nothing before, between, or after rows.
- After the last row, emit exactly ONE final line carrying the reply-line flags defined
  above (same vocabulary, space-separated; the strong wrong-type tier keeps its trailing
  "!"): {"_flags": "NOTAVENUE!: slug0 NOTAVENUE: slug1 THIN: slug2, slug3 SHORT: slug4 IDENTITY: slug5"}
  If there are no flags, end with {"_flags": ""}.
- The OUTPUT FILE line above is bookkeeping for the collector script — do not mention it.
`;

function loadManifest(batch) {
  const p = path.join(draftsDir, `${batch}-manifest.json`);
  if (!fs.existsSync(p)) { console.error(`${p} not found — run batch first`); process.exit(1); }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
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
  const filters = [];   // {vendor_id, filters} from each vendor's entry-1 row; side-channel, see draft-contract.md
  for (const f of files) {
    const rows = [], problems = [];
    fs.readFileSync(path.join(draftsDir, f), 'utf8').split('\n').forEach((l, idx) => {
      const t = l.trim();
      if (!t) return;
      try {
        const o = JSON.parse(t);
        if (o && typeof o === 'object' && '_flags' in o) return; // API-mode flags line (draft.mjs collects these)
        rows.push(HEADERS.map((h) => String(o[h] ?? '').replace(/\r?\n/g, ' ').trim()));
        // The `filters` object rides on a vendor's first row only; it is NOT a
        // HEADERS column, so it stays out of the CSV and travels in filters.jsonl.
        if (o.vendor_id && o.filters && typeof o.filters === 'object') filters.push({ vendor_id: o.vendor_id, filters: o.filters });
      } catch { problems.push(`${f}:${idx + 1}: unparseable JSON line`); }
    });
    perFile.push({ file: f, rows, problems });
  }
  return { perFile, filters };
}
// --type must match the type the batch was DRAFTED with. The profile decides the CSV
// columns and whether service_region is required, so a mismatch is silent: the 2026-07
// supplemental runs were drafted with --type photographer etc. (the worker JSONL carries
// service_region) but merged and uploaded without --type, so the venue profile's 11
// columns dropped every region and upload never ran its service_region gate. 185 live
// service-area entries have none. New manifests record `type`; for older ones the call
// file's block label (=== PHOTOGRAPHER: ...) says the same thing.
function checkBatchType(batch, manifest) {
  let drafted = manifest.find((m) => m.type)?.type;
  let label = null;
  if (!drafted) {
    const f = fs.existsSync(draftsDir) && fs.readdirSync(draftsDir).find((x) => x.startsWith(`${batch}-call-`) && x.endsWith('.md'));
    const m = f && /^=== ([^:\n]+): .*\| vendor_id=/m.exec(fs.readFileSync(path.join(draftsDir, f), 'utf8'));
    label = m ? m[1].trim() : null;
  }
  if ((drafted && drafted !== profile.key) || (label && label !== profile.label)) {
    console.error(`TYPE MISMATCH: batch "${batch}" was drafted as ${drafted ? `--type ${drafted}` : `"${label}" blocks`}, but this run resolved --type ${profile.key} (${profile.label}). Re-run with the batch's --type; a mismatched profile silently drops columns such as service_region.`);
    process.exit(1);
  }
}

// Per-vendor research for a manifest, read once: harvest.json (dated reviews, harvest
// month) and dossier.md (site-unread markers, non-review background).
function loadResearch(manifest) {
  const out = new Map();
  for (const m of manifest) {
    if (out.has(m.vendor_id)) continue;
    const dir = path.join(workdir, 'research', m.slug);
    const read = (f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8') : null);
    let harvest = null;
    try { harvest = JSON.parse(read('harvest.json') || 'null'); } catch { harvest = null; }
    const dossier = read('dossier.md') || '';
    out.set(m.vendor_id, { name: m.name, harvest, dossier, identity: identityBlocked(dossier, dir), taken: m.taken_dates || [] });
  }
  return out;
}

// The date-floor context planDateMoves() needs, from the research loaded above. The
// document-frequency corpus is every harvested review in the workdir (workdirDocFreq).
function dateContext(research) {
  const docFreq = workdirDocFreq(workdir);
  return {
    docFreq,
    reviewsFor: (vid) => reviewsFromHarvest(research.get(vid)?.harvest),
    ceilingFor: (vid) => harvestCeiling(research.get(vid)?.harvest),
    backgroundFor: (vid) => `${research.get(vid)?.name || ''}\n${dossierBackground(research.get(vid)?.dossier)}`,
    takenFor: (vid) => research.get(vid)?.taken || [],
  };
}
const rowText = (r, i) => `${r[i('price_text')] ?? ''} ${r[i('price_details')] ?? ''} ${r[i('notes')] ?? ''}`;

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
  // 25 vendors/call. Sized in 2026-07 for ~600-token dossiers (photographer avg ~410), so
  // files ran ~14-18k tokens. The 2026-10 dossier rewrite (plan item 4) keeps fee tables,
  // event pages and whole reviews: measured over the 2,450 CO vendors that have both, mean
  // ~5,950 chars (~1,500 tokens; median 5,673, p95 11,844) vs 2,664 before, so a 25-vendor
  // call is now ~45-50k input tokens (~37k of dossiers + a ~9k-token rules header). Still
  // well inside one request, and drafting is output-bound (max-tokens in draft.mjs), so
  // the per-call count was left alone. Watch the "largest call file" line below; lower
  // --per-call if it nears ~60k.
  const perCall = parseInt(argValue('per-call') || '25', 10);
  // API drafting is the DEFAULT (Kiara 2026-07-18) — pass --mode harness for draft-worker
  // call files (no delivery override). draft.mjs refuses harness-mode files, so a mix-up
  // fails loudly at submit, not silently at collect.
  const apiMode = (argValue('mode') || 'api') !== 'harness';
  const supabase = db();

  const { data: venues, error } = await selectAll(() => supabase.from('vendors')
    // Split types (music → dj|band) draft across all their vendor_types in one run.
    .select('id, name, city, website, google_place_id').in('vendor_type', profile.vendorTypes ?? [profile.vendorType]).eq('region', region).order('name'));
  if (error) { console.error('DB read failed:', error.message); process.exit(1); }
  // Exclude venues with ANY recon — bot OR human. (roster.mjs only counts bot recon;
  // the product rule for backfills is "no recon of any kind".)
  const { data: allRecon, error: rErr } = await selectAll(() => supabase.from('recon_entries').select('id, vendor_id').order('id'));
  if (rErr) { console.error('DB read failed:', rErr.message); process.exit(1); }
  const hasRecon = new Set((allRecon || []).map((e) => e.vendor_id));
  // --supplemental: keep vendors that ALREADY have recon, to add ONE further entry
  // carrying newly-found intel (e.g. reddit passages matched after the original run).
  // Default behaviour stays "no recon of any kind" — the right rule for a fresh region,
  // but it makes topping up an enriched region impossible without this escape hatch.
  const supplemental = process.argv.includes('--supplemental');
  // Which bot already wrote for which vendor: a bot must never get two entries on the
  // same vendor (upload validates this), and a supplemental run is exactly where that
  // would otherwise happen, since bot assignment below is a roster round-robin that
  // knows nothing about what is already published.
  const { data: authored, error: aErr } = await selectAll(() => supabase
    .from('recon_entries').select('vendor_id, author_id, status, profiles!inner(username, is_bot)').order('id'));
  if (aErr) { console.error('DB read failed:', aErr.message); process.exit(1); }
  const botsOnVendor = new Map();
  const liveBots = new Map();   // vendor_id -> count of ACTIVE bot entries (the BOT_CAP base)
  for (const r of (authored || [])) {
    const u = r.profiles?.username; if (!u) continue;
    if (!botsOnVendor.has(r.vendor_id)) botsOnVendor.set(r.vendor_id, new Set());
    botsOnVendor.get(r.vendor_id).add(u);
    if (r.profiles?.is_bot && r.status === 'active') liveBots.set(r.vendor_id, (liveBots.get(r.vendor_id) || 0) + 1);
  }

  // reddit mentions (same signal as roster.mjs) for ordering
  const threads = [];
  for (const dir of researchDirs(workdir, profile.key)) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.startsWith('reddit-') && f.endsWith('.txt')))
      threads.push(norm(fs.readFileSync(path.join(dir, f), 'utf8')));
  }
  // Zero threads is legitimate for a region nobody pasted about, but it is far more often
  // a workdir-naming mismatch (see researchDirs). Say so rather than silently ranking
  // every vendor on Places data alone.
  if (!threads.length) console.log('NOTE: 0 reddit threads found for richness ranking — if a launch run archived pastes for this region, the enrich workdir name may not match the launch one (see researchDirs in etype.mjs).');
  const redditScore = (name) => { const n = nameKey(name); return n.length < 5 ? 0 : threads.filter((t) => t.includes(n)).length; };
  const score = (v) => redditScore(v.name) * 3 + (v.google_place_id ? 1 : 0) + (v.website ? 1 : 0);

  const excluded = new Set((argValue('exclude') || '').split(';').map((s) => norm(s)).filter(Boolean));
  // --only restricts the batch to named vendors. Selection is otherwise region-wide over
  // everything unreconned, which is right for a fresh region but wrong for a targeted run
  // (adding a handful of newly-seeded vendors, or re-drafting a specific set) — without
  // it the batch pulls in unrelated vendors and then fails on their missing dossiers.
  const only = new Set((argValue('only') || '').split(';').map((s) => norm(s)).filter(Boolean));
  const candidates = venues.filter((v) => (supplemental ? hasRecon.has(v.id) : !hasRecon.has(v.id)) && !excluded.has(norm(v.name)) && (!only.size || only.has(norm(v.name))));
  // BOT_CAP counts LIVE bot entries, not just this run: a supplemental top-up on a vendor
  // that already has three bot entries is how 37 vendors reached 4-6 (2026-10 audit).
  const capped = candidates.filter((v) => (liveBots.get(v.id) || 0) >= BOT_CAP);
  if (capped.length) console.log(`SKIPPED ${capped.length} vendor(s) already at the ${BOT_CAP}-bot-entry cap: ${capped.slice(0, 15).map((v) => v.name).join('; ')}${capped.length > 15 ? ' ...' : ''}`);
  const pool = candidates.filter((v) => (liveBots.get(v.id) || 0) < BOT_CAP)
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
  const seen = new Set(); const uniq = [];
  for (const v of pool) { const k = norm(v.name); if (seen.has(k)) continue; seen.add(k); uniq.push(v); } // same-named twins defer
  // Name-hygiene guard: a vendor named like a filename/handle/url (e.g. "briadair.jpeg",
  // an image credit that slipped through seeding — caught live in the 2026-07 toy run)
  // would ship that junk as the public-facing name on every entry, and no downstream
  // validator checks name plausibility. Skip + report — fix the vendors row, then re-run.
  const JUNK_NAME = /\.(jpe?g|png|gif|webp|heic|pdf|mp4)$|^[@#]|https?:\/\/|\bwww\./i;
  const junkNamed = uniq.filter((v) => JUNK_NAME.test(v.name.trim()));
  if (junkNamed.length) {
    console.error(`SKIPPED ${junkNamed.length} implausible vendor name(s) (filename/handle/url — fix the vendors row's name, then re-run): ${junkNamed.map((v) => `"${v.name}" (${v.city || '?'}, ${v.id})`).join('; ')}`);
    for (const v of junkNamed) uniq.splice(uniq.indexOf(v), 1);
  }
  // Twin-collision guard: research dirs are slugged by NAME, so a venue sharing a name
  // with an ALREADY-HARVESTED different vendor would silently reuse the wrong research.
  // Skip those with a warning — they need manual handling (e.g. a city-suffixed rename).
  // Identity guard (plan item 7): a dossier marked `IDENTITY CHECK: FAILED` (or whose
  // identity.json is flagged) was built from a site that likely belongs to a different
  // business or a non-Colorado one (Fairmount Cemetery's row pointed at a Newark, NJ
  // cemetery). Never assign it entries; fix the vendors row (website/name) or remove it.
  const picked = []; const collided = []; const idBlocked = [];
  for (const v of uniq) {
    if (picked.length >= size) break;
    const rdir = path.join(workdir, 'research', slugOf(v.name));
    const dp = path.join(rdir, 'dossier.md');
    if (fs.existsSync(dp)) {
      const text = fs.readFileSync(dp, 'utf8');
      if (!text.split('\n', 1)[0].includes(`vendor_id=${v.id}`)) { collided.push(v); continue; }
      const why = identityBlocked(text, rdir);
      if (why) { idBlocked.push({ v, why }); continue; }
    }
    picked.push(v);
  }
  if (collided.length) console.error(`SKIPPED ${collided.length} twin-collision venue(s) (research dir belongs to a same-named different vendor — handle manually): ${collided.map((v) => `${v.name} (${v.city})`).join('; ')}`);
  if (idBlocked.length) console.error(`SKIPPED ${idBlocked.length} vendor(s) failing the IDENTITY CHECK (the crawled site likely belongs to another business; fix the vendors row's website/name or remove the vendor, then re-run dossier.mjs):\n  ${idBlocked.map(({ v, why }) => `${v.name} (${v.city || '?'}, ${v.id}): ${why}`).join('\n  ')}`);
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
  //
  // The fifth term was `dossierText.length > 2200`, calibrated on the old ~2.7k-char
  // dossiers. The 2026-10 rewrite more than doubled them (mean ~5,950, median 5,673), so
  // raw length would have fired on nearly every vendor and pushed the 1-entry share from
  // 15% to 5%. It now measures SOURCE text only (sourceChars: no marker lines, section
  // headings, source labels or "[rest ... omitted]" notes), so a dossier long only because
  // it carries SOURCE TRUNCATED / SITE PAGES UNREAD warnings gains nothing. Threshold 5000
  // is the value whose distribution on the new dossiers matches the old rule on the old
  // ones, measured over the 2,450 CO vendors with both (2026-10-02):
  //   old rule, old dossiers   1-entry 364 | 2-entry 876 | 3-entry 1,210
  //   old rule, new dossiers   1-entry 132 | 2-entry 959 | 3-entry 1,359   (inflated)
  //   this rule, new dossiers  1-entry 362 | 2-entry 836 | 3-entry 1,252   (2,170 agree per vendor)
  // Content counts (priced lines, review chars, source ids) were tried and matched worse
  // (best: priced lines >= 3 or review chars >= 3000, 2,126 agree).
  const entryCountFor = (dossierText) => {
    const score = (/\$\s?\d/.test(dossierText) ? 1 : 0)
      + (/^## google reviews/m.test(dossierText) ? 1 : 0)
      + (/^## reddit/m.test(dossierText) ? 2 : 0)
      + (/^## region pricing digests/m.test(dossierText) ? 1 : 0)
      + (sourceChars(dossierText) > 5000 ? 1 : 0);
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

  // --supplemental: the vendor's EXISTING active entries (any author) go into its call
  // block, so the drafter adds only facts none of them states, or writes nothing. The
  // 2026-07 supplemental passes drafted blind to the first entry and retold its anecdote
  // as a "different couple" (Colorado Photography Squad: the same Kate / under-$2k reddit
  // comment twice; d'Anelli: the Elena mother's-dress story twice). Read here, in the batch
  // step that already holds the DB client; status/merge stay filesystem-only.
  const existingByVid = new Map();
  if (supplemental) {
    for (let k = 0; k < picked.length; k += 100) {
      const ids = picked.slice(k, k + 100).map((v) => v.id);
      const { data, error: xErr } = await selectAll(() => supabase.from('recon_entries')
        .select('id, vendor_id, price_text, price_details, notes, service_region, recon_collected_month, recon_collected_year')
        .eq('status', 'active').in('vendor_id', ids).order('id'));
      if (xErr) { console.error('DB read failed (existing entries):', xErr.message); process.exit(1); }
      for (const e of data || []) {
        if (!existingByVid.has(e.vendor_id)) existingByVid.set(e.vendor_id, []);
        existingByVid.get(e.vendor_id).push(e);
      }
    }
  }

  // Manifest is FLAT: one row per (vendor, entry) slot. A vendor's entries get DISTINCT
  // bots (global round-robin keeps load even) and distinct collected-dates, and all live
  // in the same call file (the dossier is inlined once, extra entries only cost output).
  const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  const manifest = [];
  let botPtr = 0;
  picked.forEach((v, i) => {
    const call = Math.floor(i / perCall) + 1;
    const dossierText = fs.readFileSync(path.join(workdir, 'research', slugOf(v.name), 'dossier.md'), 'utf8');
    // A supplemental run adds exactly ONE entry — it is topping up, not re-enriching.
    // Either way the vendor's total live bot entries stay within BOT_CAP.
    const headroom = BOT_CAP - (liveBots.get(v.id) || 0);
    const n = Math.min(supplemental ? 1 : entryCountFor(dossierText), roster.length, headroom);
    const taken = botsOnVendor.get(v.id) || new Set();
    // Distinct collected-dates per sibling entry: the 18-month hash space collides ~1-in-18,
    // and two "independent" couples sharing month AND anecdotes reads as one author
    // (caught live in the 2026-07 toy run). Re-derive with a nudged seed until unique.
    // Live siblings count too (a supplemental entry must not land on an existing entry's
    // month); they ride in the manifest as taken_dates so merge's date-floor move honours
    // them without a DB read.
    const takenDates = (existingByVid.get(v.id) || []).map((e) => `${e.recon_collected_month}/${e.recon_collected_year}`);
    const usedDates = new Set(takenDates);
    for (let e = 0; e < n; e++) {
      let d = dateFor(`${v.id}#${e}`), nudge = 0;
      while (usedDates.has(`${d.month}/${d.year}`)) d = dateFor(`${v.id}#${e}~${++nudge}`);
      usedDates.add(`${d.month}/${d.year}`);
      // Advance past any bot that already authored for this vendor.
      let bi = (botPtr + e) % roster.length, guard = 0;
      while (taken.has(roster[bi].username) && guard++ < roster.length) bi = (bi + 1) % roster.length;
      // `type` lets status/merge refuse a mismatched --type: the 2026-07 supplemental runs
      // were merged and uploaded WITHOUT --type, so the venue profile's 11 columns
      // silently dropped every drafted service_region (185 live service-area entries
      // lack one) and upload skipped the service_region gate entirely.
      manifest.push({ type: profile.key, name: v.name, vendor_id: v.id, slug: slugOf(v.name), city: v.city, bot: roster[bi].key, month: d.month, year: d.year, entry: e + 1, entries: n, call, ...(takenDates.length ? { taken_dates: takenDates } : {}) });
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
  // Resolved from THIS file's location, not from cwd and not hardcoded to a
  // tree. The skill is mirrored -- one copy per agent runtime -- and each mirror
  // ships its own complete references/ dir, so hardcoding either tree's path
  // made one mirror silently read the OTHER one's drafting rules. That worked
  // only because both trees coexist in this repo, and would have drifted the
  // moment one mirror's rules changed. Also survives being run from a subdir.
  // Mirrors are generated: see scripts/sync-codex-mirrors.mjs.
  const refDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'references');
  const header = [
    profile.refs.map((f) => fs.readFileSync(path.join(refDir, f), 'utf8')).join('\n\n---\n\n'),
    filterVocab(profile.key),   // the tag keys + values the worker may emit; see draft-contract.md "Filter tags"
  ].filter(Boolean).join('\n\n---\n\n');
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
      const existing = existingByVid.get(m.vendor_id) || [];
      const published = existing.length ? `\n\n## ALREADY PUBLISHED for this vendor (${existing.length} live entr${existing.length === 1 ? 'y' : 'ies'}, by other couples)\n`
        + existing.map((e, k) => `[published ${k + 1}, ${e.recon_collected_month}/${e.recon_collected_year}] ${e.price_text || ''} | ${e.price_details || ''} | ${(e.notes || '').replace(/\s*\n\s*/g, ' ')}${e.service_region ? ` | region: ${e.service_region}` : ''}`).join('\n')
        + `\nSUPPLEMENTAL RULE: write this vendor's row ONLY if the dossier holds a fact that NONE of the published entries above states (a new price, policy, logistics detail, or a review/reddit story they do not tell). Never retell, reword or re-source a story or figure they already carry; never refer to them. If there is nothing new, write NO row for this vendor and flag SHORT:${m.slug}.` : '';
      return `\n\n=== ${profile.label}: ${m.name} | vendor_id=${m.vendor_id} | slug=${m.slug} | entries=${ms.length} | ${assign} ===\n${dossier}${published}`;
    });
    const out = `${header}${blocks.join('')}\n\nOUTPUT FILE: ${draftsDir}/${batch}-worker-${String(c).padStart(2, '0')}.jsonl\n${apiMode ? API_FOOTER : ''}`;
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
  if (apiMode) console.log(`API mode: submit with draft.mjs — node --env-file=.env.local .agents/skills/enrichvendors/scripts/draft.mjs ${workdir} submit --batch ${batch}`);
  else console.log(`spawn one draft-worker agent per drafts/${batch}-call-NN.md`);
}

// ── status ────────────────────────────────────────────────────────────────────
// Exits 1 when any defect the upload gate HARD-FAILS on is present, so a scripted loop
// can stop on it. Date-floor moves are reported, not failed: merge applies them.
function cmdStatus() {
  const batch = req('batch');
  const manifest = loadManifest(batch);   // flat: one row per (vendor, entry) slot
  checkBatchType(batch, manifest);
  const wantIds = new Set(manifest.map((m) => m.vendor_id));
  const wantPairs = new Set(manifest.map((m) => `${m.vendor_id}|${m.bot}`));
  const { perFile, filters } = readWorkerRows(`${batch}-worker-`);
  const research = loadResearch(manifest);
  const i = (n) => HEADERS.indexOf(n);
  const drafted = new Set(); let total = 0, malformed = 0, badVid = 0, badBot = 0, noPrice = 0, banned = 0, dashes = 0, noRegion = 0;
  let tells = 0, research_ = 0, escapes = 0, quoteOnly = 0, quoteOnlyPriced = 0, absence = 0, contaminated = 0;
  let identity = 0, markers = 0, contradictions = 0;
  const tellRows = [], quoteRows = [], absenceRows = [], contamRows = [], regionRows = [];
  const identityRows = [], markerRows = [], contradictionRows = [];
  const dated = [];   // rows for the date-floor plan
  for (const { file: f, rows, problems } of perFile) {
    malformed += problems.length;
    // The call file this worker answered: its sibling blocks are the contamination pool.
    const callPath = path.join(draftsDir, f.replace('-worker-', '-call-').replace(/\.jsonl$/, '.md'));
    const call = fs.existsSync(callPath) ? parseCallFile(fs.readFileSync(callPath, 'utf8')) : null;
    rows.forEach((r, idx) => {
      total++;
      const vid = (r[i('vendor_id')] ?? '').trim();
      const pair = `${vid}|${(r[i('bot')] ?? '').trim()}`;
      if (!wantIds.has(vid)) badVid++;
      else if (!wantPairs.has(pair)) badBot++;   // bot not assigned to this vendor (merge repairs)
      else drafted.add(pair);
      if (!(r[i('price_text')] ?? '').trim() || !(r[i('price_details')] ?? '').trim()) noPrice++;
      if (profile.serviceRegionRequired && !(r[i('service_region')] ?? '').trim()) { noRegion++; if (regionRows.length < 8) regionRows.push(r[i('venue')]); }
      const text = rowText(r, i);
      if (BANNED.test(text)) banned++;
      if (EMDASH.test(text)) dashes++;
      const t = toolingTell(text);
      if (t) {
        tells++;
        if (t.kind === 'research-artifact narration') research_++;
        if (tellRows.length < 8) tellRows.push(`${r[i('venue')]} ("${t.match}")`);
      }
      if (ESCAPES.test(text)) escapes++;
      // A dossier label or marker echoed onto the card ("[rest of review omitted]", "[r3]").
      const mk = dossierMarker(text) || (i('service_region') >= 0 ? dossierMarker(r[i('service_region')] || '') : null);
      if (mk) { markers++; if (markerRows.length < 8) markerRows.push(`${r[i('venue')]} ("${mk}")`); }
      // A figure in the price fields while some field says no price is posted (Et Voila).
      const pc = priceContradiction({ price_text: r[i('price_text')], price_details: r[i('price_details')], notes: r[i('notes')] });
      if (pc) { contradictions++; if (contradictionRows.length < 8) contradictionRows.push(`${r[i('venue')]}: ${pc}`); }
      // Identity gate (plan item 7): no row may be drafted from a wrong-business site.
      const idWhy = research.get(vid)?.identity;
      if (idWhy) { identity++; if (identityRows.length < 8) identityRows.push(`${r[i('venue')]} (${idWhy})`); }
      // Checked per FIELD, not per entry: a headline that says the quote-only phrase
      // while its own text also states a figure is the contradiction. A plain "no quote
      // found" headline over a price_details that cites a third-party number is fine.
      for (const col of ['price_text', 'price_details']) {
        const v = r[i(col)] ?? '';
        if (!QUOTE_ONLY.test(v)) continue;
        quoteOnly++;
        if (MONEY.test(v)) {
          quoteOnlyPriced++;
          if (quoteRows.length < 8) quoteRows.push(`${r[i('venue')]} ${col} ("${v.slice(0, 60)}")`);
        }
      }
      // Absence claims on a site nobody read (plan item 6): see provenance.mjs.
      const unread = siteUnread(research.get(vid)?.dossier);
      if (unread) {
        const claims = absenceClaims(text);
        if (claims.length) { absence++; if (absenceRows.length < 8) absenceRows.push(`${r[i('venue')]} [${unread}] ("${claims[0].match}")`); }
      }
      // Cross-vendor contamination (plan item 17b).
      const own = call?.blocks.find((b) => b.vendor_id === vid);
      if (own) {
        const hits = contaminationHits(text, own.text, call.blocks.filter((b) => b !== own), call.header);
        if (hits.length) { contaminated++; if (contamRows.length < 12) contamRows.push(`${r[i('venue')]}: ${hits.map((h) => `"${h.phrase}" (only in ${h.siblings.join(', ')})`).join('; ')}`); }
      }
      dated.push({ key: `${f}:${idx + 1}`, venue: r[i('venue')], vendor_id: vid, month: r[i('month')], year: r[i('year')], text });
    });
    console.log(`  ${f}: ${rows.length} rows${problems.length ? ` | ${problems.length} unparseable JSON lines` : ''}${call ? '' : ' | (no call file: contamination not checked)'}`);
  }
  const plan = planDateMoves(dated.filter((d) => wantIds.has(d.vendor_id)), dateContext(research));
  const missing = manifest.filter((m) => !drafted.has(`${m.vendor_id}|${m.bot}`));
  // Tag basis (plan item 15), the same rule upload.mjs gateFilters enforces: a tag whose
  // quote or sentence is brand/chain-level, or leans on reddit when the vendor's reddit
  // excerpts are all region/chain-level, may not set a property tag.
  const basisRows = [];
  const proseOf = new Map();
  for (const { rows } of perFile) for (const r of rows) {
    const vid = (r[i('vendor_id')] ?? '').trim();
    proseOf.set(vid, `${proseOf.get(vid) || ''}\n${rowText(r, i)}`);
  }
  for (const f of filters) {
    const m = manifest.find((x) => x.vendor_id === f.vendor_id);
    if (!m) continue;
    const rs = path.join(workdir, 'research', m.slug, 'reddit-slice.txt');
    const redditSlice = fs.existsSync(rs) ? fs.readFileSync(rs, 'utf8') : null;
    for (const [key, spec] of Object.entries(f.filters || {})) {
      const quote = spec && typeof spec === 'object' ? spec.quote : null;
      if (!quote) continue;   // upload rejects a quote-less tag; this check is about basis
      const why = tagBasisProblem(quote, { prose: proseOf.get(f.vendor_id), redditSlice });
      if (why) basisRows.push(`${m.name} [${key}]: ${why}`);
    }
  }
  console.log(`\ndrafted ${drafted.size}/${manifest.length} entry slots | rows ${total} | malformed ${malformed} | bad vendor_id ${badVid} | bot mismatch ${badBot}`);
  console.log(`missing price fields ${noPrice} | banned phrases ${banned} | em-dashes ${dashes}${profile.serviceRegionRequired ? ` | missing service_region ${noRegion}` : ''}`);
  console.log(`process-tells ${tells} (of which research-artifact narration ${research_}) | literal line-break escapes ${escapes}${escapes ? ' (repaired at insert, not a gate)' : ''}`);
  console.log(`quote-only wording ${quoteOnly}${quoteOnly ? ' (repaired at insert)' : ''} | of those, stating a price anyway ${quoteOnlyPriced}${quoteOnlyPriced ? ' (UPLOAD GATE — redraft the headline to lead with the number)' : ''}`);
  console.log(`identity-check failures ${identity} | dossier markers in prose ${markers} | figure + "no price posted" contradictions ${contradictions} | tags on brand/region-level basis ${basisRows.length}`);
  console.log(`absence claims on an unread site ${absence} | cross-vendor contamination ${contaminated} | date floor: ${plan.moves.length} entr${plan.moves.length === 1 ? 'y' : 'ies'} dated before a source they use (merge moves them forward)${plan.conflicts.length ? `, ${plan.conflicts.length} cannot get a distinct sibling month` : ''}`);
  // All of these are failures the upload gate HARD-FAILS on. Fix them here, before merge.
  if (tellRows.length) console.log(`  tells e.g.: ${tellRows.join('; ')}`);
  if (quoteRows.length) console.log(`  quote-only-with-a-price e.g.: ${quoteRows.join('; ')}`);
  if (regionRows.length) console.log(`  missing service_region e.g.: ${regionRows.join('; ')}`);
  if (absenceRows.length) console.log(`  absence claims e.g. (the dossier never read a site, so say nothing about what it lacks): ${absenceRows.join('; ')}`);
  if (identityRows.length) console.log(`  IDENTITY CHECK failed (drop these rows; batch should have skipped the vendor): ${identityRows.join('; ')}`);
  if (markerRows.length) console.log(`  dossier markers copied into prose e.g.: ${markerRows.join('; ')}`);
  if (contradictionRows.length) console.log(`  price contradictions e.g.:\n    ${contradictionRows.join('\n    ')}`);
  if (basisRows.length) console.log(`  tag basis e.g. (drop the tag, or source it from the property itself):\n    ${basisRows.slice(0, 8).join('\n    ')}`);
  if (contamRows.length) console.log(`  contamination (a fact found only in ANOTHER vendor's block of the same call file):\n    ${contamRows.join('\n    ')}`);
  for (const mv of plan.moves.slice(0, 8)) {
    const d = dated.find((x) => x.key === mv.key);
    console.log(`  date ${mv.from.month}/${mv.from.year} -> ${mv.to.month}/${mv.to.year}: ${d?.venue} (${mv.evidence.join('; ')})`);
  }
  if (missing.length) console.log(`MISSING SLOTS (SHORT/THIN-flagged ones are intentional): ${missing.map((m) => `${m.name} (${m.bot})`).join('; ')}`);
  const gateFailures = malformed + noPrice + banned + dashes + (profile.serviceRegionRequired ? noRegion : 0) + tells + quoteOnlyPriced + absence + contaminated
    + identity + markers + contradictions + basisRows.length;
  if (gateFailures) { console.log(`\nSTATUS: ${gateFailures} upload-gate failure(s) — fix the flagged rows in the worker JSONL, then re-run status`); process.exitCode = 1; }
}

// ── merge ─────────────────────────────────────────────────────────────────────
function cmdMerge() {
  const batch = req('batch');
  const manifest = loadManifest(batch);   // flat: one row per (vendor, entry) slot
  checkBatchType(batch, manifest);
  const idByName = new Map(manifest.map((m) => [norm(m.name), m.vendor_id]));
  const wantIds = new Set(manifest.map((m) => m.vendor_id));
  const botsByVid = new Map();            // vid → assigned bots in entry order
  for (const m of manifest) {
    if (!botsByVid.has(m.vendor_id)) botsByVid.set(m.vendor_id, []);
    botsByVid.get(m.vendor_id).push(m.bot);
  }
  const { perFile, filters } = readWorkerRows(`${batch}-worker-`);
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

  // Date floor (plan item 2; Kiara 2026-10-02: move dates forward automatically). The
  // collected date was pre-assigned blind to the sources, so an entry can be dated before
  // the review it quotes. Move it to the newest source month it uses, never past the
  // harvest month, keeping siblings (incl. live ones on a supplemental run) distinct.
  // Every move is logged here and in drafts/<batch>-date-moves.jsonl.
  const iMonth = HEADERS.indexOf('month'), iYear = HEADERS.indexOf('year');
  const ix = (n) => HEADERS.indexOf(n);
  const research = loadResearch(manifest);
  const plan = planDateMoves(out.slice(1).map((r, k) => ({ key: k + 1, vendor_id: (r[1] ?? '').trim(), month: r[iMonth], year: r[iYear], text: rowText(r, ix) })), dateContext(research));
  for (const mv of plan.moves) {
    const r = out[mv.key];
    r[iMonth] = String(mv.to.month); r[iYear] = String(mv.to.year);
    console.log(`  date moved ${mv.from.month}/${mv.from.year} -> ${mv.to.month}/${mv.to.year}: ${r[0]} [${r[iBot]}] (${mv.evidence.join('; ')})`);
  }
  for (const c of plan.conflicts) console.log(`  WARNING date ${c.to.month}/${c.to.year} for ${out[c.key][0]} shares a month with a sibling: no distinct month between its source floor and the harvest month`);
  for (const c of plan.clamped) console.log(`  NOTE ${out[c.key][0]}: names a source dated ${c.floor}, after the harvest month; held at ${c.ceiling}`);
  const movesPath = path.join(draftsDir, `${batch}-date-moves.jsonl`);
  if (plan.moves.length) fs.writeFileSync(movesPath, plan.moves.map((mv) => JSON.stringify({ venue: out[mv.key][0], vendor_id: mv.vendor_id, bot: out[mv.key][iBot], from: mv.from, to: mv.to, evidence: mv.evidence })).join('\n') + '\n');
  else if (fs.existsSync(movesPath)) fs.rmSync(movesPath);

  const csvName = `recons-${batch}.csv`;
  const text = out.map((row) => row.map(csvEsc).join(',')).join('\n') + '\n';
  fs.writeFileSync(path.join(workdir, csvName), text);
  fs.writeFileSync(path.join(workdir, `recons-${batch}.backup.csv`), text);

  // Filter tags travel beside the CSV, keyed to only the vendors that survived the
  // merge above (a filter row for a dropped/renamed vendor is discarded). upload.mjs
  // gates each tag against the vendor's inserted recon prose before writing it.
  const keptVids = new Set(out.slice(1).map((r) => (r[1] ?? '').trim()));
  const filterRows = filters.filter((f) => keptVids.has(f.vendor_id));
  const fPath = path.join(workdir, `filters-${batch}.jsonl`);
  if (filterRows.length) {
    fs.writeFileSync(fPath, filterRows.map((f) => JSON.stringify(f)).join('\n') + '\n');
    console.log(`filter tags: ${filterRows.length} vendors -> ${path.basename(fPath)}`);
  } else if (fs.existsSync(fPath)) {
    fs.rmSync(fPath); // stale from a prior run
  }

  const { recons } = loadCsvRecons(csvName);
  // "States a price" is the MONEY test over BOTH price columns — the same question
  // hasPriceQuote() asks in the app when it sorts priced entries above unpriced ones, so
  // this number predicts where the batch will land in the list. It used to be "price_text
  // does not start with the words quote only", which counted the sentinel rather than the
  // content: an entry whose details cited a real figure under a quote-only headline was
  // reported as unpriced, and any other wording for the same emptiness was reported as
  // priced. Both directions were wrong, and the sentinel is retired besides.
  const priced = recons.filter((r) => MONEY.test(r.price_text) || MONEY.test(r.price_details)).length;
  const nVendors = new Set(recons.map((r) => r.vendor_id)).size;
  console.log(`merged ${recons.length}/${manifest.length} entry slots (${nVendors} vendors) → ${csvName} (backup saved) | repaired ${repaired} | dates moved forward ${plan.moves.length} | states a price ${priced} | no price stated ${recons.length - priced}`);
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
  // Read the media rows in CHUNKS, paginated, and CHECK THE ERROR. All three matter:
  //  - one `.in()` over every entry id builds the whole UUID list into the query STRING;
  //    at 484 entries that is a ~17KB URL and the request fails outright;
  //  - the old code destructured `{ data: media }` with no error check, so that failure
  //    silently yielded an empty media set;
  //  - PostgREST also caps an unpaginated select at 1000 rows, and recon_media passed 1000
  //    during the 2026-07-29 CO hotel run.
  // Any of the three makes verify believe the photos it just wrote do not exist. That is
  // not a cosmetic miscount: `--fix-gaps` below DELETES every gapped entry for upload to
  // re-insert, so a bad read makes verify destroy and rebuild live, correctly-photographed
  // entries on every pass and never converge. It reported exactly 35 gaps for the 35
  // photo-bearing rows — the tell that it was seeing zero media, not partial media.
  const media = [];
  for (let i = 0; i < mine.length; i += 100) {
    const ids = mine.slice(i, i + 100).map((e) => e.id);
    const { data, error: mErr } = await selectAll(() =>
      supabase.from('recon_media').select('recon_entry_id, thumb_path').order('id').in('recon_entry_id', ids));
    if (mErr) { console.error(`recon_media read failed: ${mErr.message}`); process.exit(1); }
    media.push(...(data || []));
  }
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
  // NOTE the anchored NN: `keep-batch-.*\.json` also matches sidecars like
  // `keep-batch-01.raw.json`, so a backup left beside the real file silently wins the
  // sort and gets read instead (cost a debugging cycle on 2026-07-29).
  for (const f of fs.readdirSync(screenDir).filter((f) => /^keep-batch-\d+\.json$/.test(f)).sort()) {
    for (const [slug, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(screenDir, f), 'utf8')))) {
      // Screeners have emitted both shapes: a bare keeper array, and {keep:[...],drop:[...]}.
      // Accept either rather than throwing an opaque "(arr || []).slice is not a function".
      const arr = Array.isArray(v) ? v : (v && Array.isArray(v.keep) ? v.keep : []);
      if (!Array.isArray(v) && !(v && Array.isArray(v.keep))) console.log(`  ! ${slug}: unrecognized screener shape, treated as zero keepers`);
      keepers[slug] = arr.slice(0, profile.photoCap ?? 2);
    }
  }
  // Screeners occasionally name files that were never downloaded (2026-07-29: one claimed
  // 5 keepers for a vendor that has exactly 1 photo on disk). A hallucinated filename is
  // that screener's error, not a reason to block the whole map — DROP the phantom, report
  // it, and keep the real keepers. Only a slug whose entire keeper list evaporates is
  // worth a second look, and that just means the vendor ships photo-less.
  const missing = [];
  for (const [slug, arr] of Object.entries(keepers)) {
    keepers[slug] = arr.filter((fn) => {
      const full = path.join(workdir, 'photos', slug, fn);
      const ok = fs.existsSync(full) && fs.existsSync(full.replace(/\.jpg$/, '_thumb.jpg'));
      if (!ok) missing.push(`${slug}/${fn}`);
      return ok;
    });
  }
  if (missing.length) console.log(`  dropped ${missing.length} screener-named file(s) not on disk: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ', …' : ''}`);

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
