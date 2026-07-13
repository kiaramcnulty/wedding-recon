// Drafting via the Anthropic Message Batches API (metered key, ~50% off standard
// prices) instead of harness draft-worker agents. Companion to pipeline.mjs: consumes
// the call files `pipeline.mjs batch --mode api` writes, produces the same
// drafts/<batch>-worker-NN.jsonl files the rest of the pipeline reads. See
// docs/anthropic-batch-drafting.md for the why; SKILL.md for where this sits in the run.
//
// usage: node --env-file=.env.local .claude/skills/enrichvendors/scripts/draft.mjs <workdir> <cmd> --batch <id> [flags]
//   submit    glob drafts/<batch>-call-*.md, print a cost
//             estimate, gate on --max-cost, create ONE message batch, and record its id in
//             drafts/<batch>-batchapi.json (resumable — nothing else is in memory).
//             [--calls "02,05"] submit only those call files (targeted re-drafting)
//             [--model claude-sonnet-5] [--max-tokens 16000] [--effort low|medium|high]
//             [--max-cost 5] (USD, worst-case gate) [--dry-run] (estimate only, no submit)
//   status    print processing_status + request counts; [--wait] poll every 60s until ended
//   collect   write succeeded results → drafts/<batch>-worker-NN.jsonl and flags →
//             drafts/<batch>-flags.json; report failures/truncations with the exact
//             resubmit command; print ACTUAL token usage + cost. Refuses results whose
//             stop_reason isn't end_turn (a max_tokens truncation would corrupt the JSONL).
//             [--results-file <jsonl>] offline mode for testing: read {custom_id, result}
//             lines from a file instead of the API.
//
// Auth: ANTHROPIC_BATCH_API_KEY in .env.local — deliberately NOT ANTHROPIC_API_KEY, which
// would shadow Claude Code's subscription auth if it leaked into a shell environment.
// Rates: defaults are Claude Sonnet 5 BATCH sticker prices ($1.50/$7.50 per MTok);
// intro pricing through 2026-08-31 is $1.00/$5.00 — override with --in-rate/--out-rate.
// Estimates are for the gate only; collect prints actuals from result usage.
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { argValue } from '../../launchvendors/scripts/lib.mjs';

const workdir = process.argv[2];
const cmd = process.argv[3];
const CMDS = ['submit', 'status', 'collect'];
if (!workdir || workdir.startsWith('--') || !CMDS.includes(cmd)) {
  console.error(`usage: draft.mjs <workdir> <${CMDS.join('|')}> --batch <id> [flags] (see file header)`); process.exit(1);
}
const req = (k) => { const v = argValue(k); if (!v) { console.error(`--${k} is required for ${cmd}`); process.exit(1); } return v; };
const batch = req('batch');
const draftsDir = path.join(workdir, 'drafts');
const statePath = path.join(draftsDir, `${batch}-batchapi.json`);
const flagsPath = path.join(draftsDir, `${batch}-flags.json`);

const MODEL = argValue('model') || 'claude-sonnet-5';
const MAX_TOKENS = parseInt(argValue('max-tokens') || '16000', 10);
const IN_RATE = parseFloat(argValue('in-rate') || '1.50');   // $/MTok, batch input
const OUT_RATE = parseFloat(argValue('out-rate') || '7.50'); // $/MTok, batch output
const usd = (nIn, nOut) => (nIn / 1e6) * IN_RATE + (nOut / 1e6) * OUT_RATE;

const client = () => {
  const key = process.env.ANTHROPIC_BATCH_API_KEY;
  if (!key) {
    console.error('ANTHROPIC_BATCH_API_KEY missing — add it to .env.local and run with --env-file=.env.local.');
    console.error('(Deliberately not ANTHROPIC_API_KEY: that name would shadow Claude Code\'s own auth.)');
    process.exit(1);
  }
  return new Anthropic({ apiKey: key });
};
const loadState = () => (fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { model: MODEL, max_tokens: MAX_TOKENS, submissions: [] });
// custom_id ↔ files: "<batch>-call-02" → call file "<batch>-call-02.md", output "<batch>-worker-02.jsonl"
const outFileFor = (customId) => `${customId.replace(/-call(-\d+)?$/, (_, n) => `-worker${n || ''}`)}.jsonl`;

function callFiles() {
  const all = fs.existsSync(draftsDir) ? fs.readdirSync(draftsDir) : [];
  const re = new RegExp(`^${batch}-call-\\d+\\.md$`);
  let files = all.filter((f) => re.test(f)).sort();
  const only = argValue('calls');
  if (only) {
    const want = new Set(only.split(',').map((s) => s.trim().padStart(2, '0')));
    files = files.filter((f) => want.has((f.match(/-call-(\d+)\.md$/) || [])[1]));
  }
  if (!files.length) { console.error(`no matching call files in ${draftsDir} — run pipeline.mjs batch --mode api first`); process.exit(1); }
  return files;
}

// ── submit ────────────────────────────────────────────────────────────────────
async function cmdSubmit() {
  const files = callFiles();
  const effort = argValue('effort');
  const reqs = files.map((f) => {
    const text = fs.readFileSync(path.join(draftsDir, f), 'utf8');
    if (!text.includes('API MODE — DELIVERY OVERRIDE')) {
      console.error(`${f} is a harness-mode call file (no API delivery override) — rebuild with pipeline.mjs batch --mode api`); process.exit(1);
    }
    return {
      custom_id: f.replace(/\.md$/, ''),
      file: f,
      inTok: Math.round(text.length / 4),
      vendors: (text.match(/^=== \w+: /gm) || []).length, // "=== VENUE: ..." block labels only (not the API MODE footer)
      params: { model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content: text }], ...(effort ? { output_config: { effort } } : {}) },
    };
  });

  const inTok = reqs.reduce((s, r) => s + r.inTok, 0);
  const vendors = reqs.reduce((s, r) => s + r.vendors, 0);
  const expOut = vendors * 350; // measured rows run ~200-300 output tokens + flags line
  const worstOut = reqs.length * MAX_TOKENS;
  console.log(`${reqs.length} call file(s), ~${vendors} vendors | est input ${inTok} tok`);
  console.log(`cost estimate: expected ≈ $${usd(inTok, expOut).toFixed(2)} | worst case (every request maxes ${MAX_TOKENS} out) ≈ $${usd(inTok, worstOut).toFixed(2)}  [rates $${IN_RATE}/$${OUT_RATE} per MTok]`);

  const maxCost = parseFloat(argValue('max-cost') || '5');
  if (usd(inTok, worstOut) > maxCost) {
    console.error(`worst case exceeds --max-cost $${maxCost.toFixed(2)} — raise it explicitly if intended`); process.exit(1);
  }
  if (process.argv.includes('--dry-run')) { console.log('dry run — nothing submitted'); return; }

  const created = await client().messages.batches.create({ requests: reqs.map(({ custom_id, params }) => ({ custom_id, params })) });
  const state = loadState();
  state.model = MODEL; state.max_tokens = MAX_TOKENS;
  state.submissions.push({ id: created.id, created_at: created.created_at, custom_ids: reqs.map((r) => r.custom_id) });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(`submitted batch ${created.id} (${created.processing_status}) — id saved to ${statePath}`);
  console.log(`next: draft.mjs ${workdir} status --batch ${batch} --wait, then collect`);
}

// ── status ────────────────────────────────────────────────────────────────────
async function cmdStatus() {
  const state = loadState();
  if (!state.submissions.length) { console.error(`no submissions recorded in ${statePath}`); process.exit(1); }
  const c = client();
  const wait = process.argv.includes('--wait');
  for (;;) {
    let allEnded = true;
    for (const s of state.submissions) {
      const b = await c.messages.batches.retrieve(s.id);
      const rc = b.request_counts;
      console.log(`${s.id}: ${b.processing_status} | processing ${rc.processing} succeeded ${rc.succeeded} errored ${rc.errored} canceled ${rc.canceled} expired ${rc.expired}`);
      if (b.processing_status !== 'ended') allEnded = false;
    }
    if (allEnded) { console.log('all ended — run collect'); return; }
    if (!wait) process.exit(1);
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

// ── collect ───────────────────────────────────────────────────────────────────
// Later submissions win per custom_id (resubmits overwrite the failed attempt).
function parseResponseText(text) {
  const rows = []; let flags = null; let chatter = 0;
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (!l || /^```/.test(l)) continue;
    try {
      const o = JSON.parse(l);
      if (o && typeof o === 'object' && '_flags' in o) { flags = String(o._flags ?? ''); continue; }
      rows.push(l);
    } catch { chatter++; }
  }
  return { rows, flags, chatter };
}

async function cmdCollect() {
  const resultsFile = argValue('results-file');
  const state = loadState();
  let expected = state.submissions.flatMap((s) => s.custom_ids);
  if (!expected.length) {
    if (!resultsFile) { console.error(`no submissions recorded in ${statePath}`); process.exit(1); }
    expected = callFiles().map((f) => f.replace(/\.md$/, '')); // offline mode without a state file
  }
  expected = [...new Set(expected)];

  const byId = new Map();
  if (resultsFile) {
    for (const l of fs.readFileSync(resultsFile, 'utf8').split('\n')) if (l.trim()) { const r = JSON.parse(l); byId.set(r.custom_id, r.result); }
  } else {
    const c = client();
    for (const s of state.submissions) {
      const b = await c.messages.batches.retrieve(s.id);
      if (b.processing_status !== 'ended') { console.error(`${s.id} is ${b.processing_status} — wait for ended (status --wait)`); process.exit(1); }
      for await (const r of await c.messages.batches.results(s.id)) byId.set(r.custom_id, r.result);
    }
  }

  const flagsAll = fs.existsSync(flagsPath) ? JSON.parse(fs.readFileSync(flagsPath, 'utf8')) : {};
  const failed = []; let usageIn = 0, usageOut = 0, written = 0;
  for (const id of expected) {
    const result = byId.get(id);
    if (!result) { failed.push({ id, why: 'no result returned' }); continue; }
    if (result.type !== 'succeeded') { failed.push({ id, why: `${result.type}${result.error ? `: ${result.error.type ?? ''} ${result.error.message ?? ''}`.trimEnd() : ''}` }); continue; }
    const msg = result.message;
    usageIn += msg.usage?.input_tokens ?? 0; usageOut += msg.usage?.output_tokens ?? 0;
    if (msg.stop_reason !== 'end_turn') { failed.push({ id, why: `stop_reason=${msg.stop_reason} (truncated/refused — not written)` }); continue; }
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    const { rows, flags, chatter } = parseResponseText(text);
    if (!rows.length) { failed.push({ id, why: 'no JSON rows in response' }); continue; }
    const out = outFileFor(id);
    fs.writeFileSync(path.join(draftsDir, out), rows.join('\n') + '\n');
    if (flags !== null) flagsAll[id] = flags;
    written++;
    console.log(`  ${out}: ${rows.length} rows${flags ? ` | flags: ${flags}` : ''}${flags === null ? ' | WARNING: no _flags line' : ''}${chatter ? ` | ${chatter} non-JSON line(s) dropped` : ''}`);
  }
  fs.writeFileSync(flagsPath, JSON.stringify(flagsAll, null, 2));

  console.log(`\ncollected ${written}/${expected.length} | flags → ${flagsPath}`);
  const activeFlags = Object.entries(flagsAll).filter(([, v]) => v);
  if (activeFlags.length) console.log(`ACTION FLAGS:\n${activeFlags.map(([k, v]) => `  ${k}: ${v}`).join('\n')}`);
  console.log(`actual usage: ${usageIn} in / ${usageOut} out ≈ $${usd(usageIn, usageOut).toFixed(2)}  [rates $${IN_RATE}/$${OUT_RATE} per MTok]`);
  if (failed.length) {
    console.error(`\nFAILED ${failed.length}:\n${failed.map((f) => `  ${f.id} — ${f.why}`).join('\n')}`);
    const nums = failed.map((f) => (f.id.match(/-call-(\d+)$/) || [])[1]).filter(Boolean);
    if (nums.length) console.error(`resubmit: draft.mjs ${workdir} submit --batch ${batch} --calls "${nums.join(',')}"`);
    process.exit(1);
  }
  console.log(`next: pipeline.mjs ${workdir} status --batch ${batch}`);
}

if (cmd === 'submit') await cmdSubmit();
else if (cmd === 'status') await cmdStatus();
else if (cmd === 'collect') await cmdCollect();
