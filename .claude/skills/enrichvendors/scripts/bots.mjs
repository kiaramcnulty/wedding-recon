// Create (or reuse) curator bot accounts for /enrichvenues uploads.
// Reads <workdir>/bots.json: [{ "username": "..." }, ...] — usernames must be
// user-approved before running. Writes the created user ids back into bots.json.
// Idempotent: an existing profile with the same username is reused, never duplicated.
// usage: node --env-file=.env.local .claude/skills/enrichvenues/scripts/bots.mjs <workdir> [--apply]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { argValue } from '../../launchvendors/scripts/lib.mjs';

const workdir = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!workdir || workdir.startsWith('--')) { console.error('usage: bots.mjs <workdir> [--roster <path>] [--apply]'); process.exit(1); }
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[k]) { console.error(`${k} missing — run with --env-file=.env.local from the repo root`); process.exit(1); }
}

// Rosters are per-state; bots never cross states but ARE reused across vendor types.
const file = argValue('roster') || path.join(workdir, 'bots.json');
if (!fs.existsSync(file)) { console.error(`${file} not found — write the approved bot roster first`); process.exit(1); }
const bots = JSON.parse(fs.readFileSync(file, 'utf8'));
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

for (const bot of bots) {
  if (!/^[a-z0-9_]{2,30}$/.test(bot.username)) { console.error(`bad username "${bot.username}" (lowercase a-z0-9_ only, 2-30 chars)`); process.exit(1); }
  const { data: existing } = await supabase.from('profiles').select('id, is_bot').ilike('username', bot.username).maybeSingle();
  if (existing) {
    bot.user_id = existing.id;
    console.log(`${bot.username}: exists (${existing.id})${existing.is_bot ? '' : ' — WARNING: not flagged is_bot'}`);
    continue;
  }
  if (!APPLY) { console.log(`${bot.username}: would create`); continue; }
  const email = `bots+${bot.username}@weddingrecon.invalid`;
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomBytes(24).toString('base64url'), // never stored; bots are only written to via service role
  });
  if (error) { console.error(`${bot.username}: createUser failed — ${error.message}`); process.exit(1); }
  bot.user_id = created.user.id;
  // The signup trigger already inserted a placeholder profile row; claim it.
  const { error: pErr } = await supabase.from('profiles')
    .update({ username: bot.username, tos_accepted_at: new Date().toISOString(), is_bot: true })
    .eq('id', bot.user_id);
  if (pErr) { console.error(`${bot.username}: profile update failed — ${pErr.message}`); process.exit(1); }
  console.log(`${bot.username}: created (${bot.user_id})`);
}

fs.writeFileSync(file, JSON.stringify(bots, null, 2));
console.log(APPLY ? `\nroster saved with user ids → ${file}` : '\nDRY RUN — re-run with --apply after the usernames are approved.');
