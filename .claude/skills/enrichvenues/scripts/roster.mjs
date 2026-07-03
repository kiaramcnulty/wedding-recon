// Region status for /enrichvenues: which venues exist, which already have bot
// recon, how rich each venue's sources look (Places reviews if harvested, Reddit
// mentions in archived threads), and per-bot entry counts for the state roster.
// Read-only. Use this to pick the next batch and to check roster headroom.
// usage: node --env-file=.env.local .claude/skills/enrichvenues/scripts/roster.mjs <workdir> --region <ST>
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { norm, argValue } from '../../launchvenues/scripts/lib.mjs';

const workdir = process.argv[2];
const region = argValue('region');
if (!workdir || workdir.startsWith('--') || !region) { console.error('usage: roster.mjs <workdir> --region <ST>'); process.exit(1); }
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[k]) { console.error(`${k} missing — run with --env-file=.env.local from the repo root`); process.exit(1); }
}
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: venues, error } = await supabase
  .from('vendors').select('id, name, city, website, google_place_id')
  .eq('vendor_type', 'venue').eq('region', region).order('name');
if (error) { console.error('DB read failed:', error.message); process.exit(1); }

const { data: botProfiles } = await supabase.from('profiles').select('id, username').eq('is_bot', true);
const botIds = (botProfiles || []).map((b) => b.id);
const { data: botEntries } = botIds.length
  ? await supabase.from('recon_entries').select('vendor_id, author_id').in('author_id', botIds)
  : { data: [] };
const entriesPerVendor = new Map(), entriesPerBot = new Map();
for (const e of botEntries || []) {
  entriesPerVendor.set(e.vendor_id, (entriesPerVendor.get(e.vendor_id) || 0) + 1);
  entriesPerBot.set(e.author_id, (entriesPerBot.get(e.author_id) || 0) + 1);
}

// Reddit mentions: count archived threads (this workdir + the launchvenues one) that name each venue.
const redditDirs = [path.join(workdir, 'research'), path.join('data/launchvenues', path.basename(workdir), 'research')];
const threads = [];
for (const dir of redditDirs) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((f) => f.startsWith('reddit-') && f.endsWith('.txt'))) {
    threads.push({ file: `${path.basename(dir) === 'research' ? dir : dir}/${f}`, text: norm(fs.readFileSync(path.join(dir, f), 'utf8')) });
  }
}
const redditMentions = (name) => {
  const n = norm(name).replace(/\b(the|at|by|of|a)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (n.length < 5) return 0;
  return threads.filter((t) => t.text.includes(n)).length;
};

// Places review count, if this venue was already harvested.
const reviewCount = (name) => {
  const hf = path.join(workdir, 'research', norm(name).replace(/ /g, '-').slice(0, 60), 'harvest.json');
  if (!fs.existsSync(hf)) return null;
  try { return JSON.parse(fs.readFileSync(hf, 'utf8')).google?.reviews?.length ?? 0; } catch { return null; }
};

let enriched = 0;
const rows = venues.map((v) => {
  const done = entriesPerVendor.get(v.id) || 0;
  if (done) enriched++;
  const rm = redditMentions(v.name);
  const rc = reviewCount(v.name);
  // Richness: reddit threads are the strongest signal, then Places reviews, then having a website.
  const score = rm * 3 + (rc ?? (v.google_place_id ? 1 : 0)) + (v.website ? 1 : 0);
  return { v, done, rm, rc, score };
});

console.log(`${region} venues: ${venues.length} | already enriched: ${enriched} | reddit threads on file: ${threads.length}`);
console.log(`bots (${(botProfiles || []).length}): ${(botProfiles || []).map((b) => `${b.username}=${entriesPerBot.get(b.id) || 0}`).join(', ') || '—'}`);
console.log('\nUNENRICHED, richest first (score = 3×reddit-threads + places-reviews + website):');
for (const r of rows.filter((r) => !r.done).sort((a, b) => b.score - a.score)) {
  console.log(`  ${String(r.score).padStart(3)}  ${r.v.name} (${r.v.city || '?'})${r.rm ? ` | reddit×${r.rm}` : ''}${r.rc != null ? ` | ${r.rc} reviews` : ''}${r.v.website ? '' : ' | NO WEBSITE'}`);
}
