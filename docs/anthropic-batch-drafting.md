# Move enrichment drafting to the Anthropic Batch API

**Status: BUILT (2026-07-13) — pending Kiara's local toy-batch test before first real run.**
Kiara approved metered billing and created a Console key (`ANTHROPIC_BATCH_API_KEY` in her
local `.env.local`). Implemented as specced, plus review hardenings (see "As built" below):
`draft.mjs` (submit/status/collect, cost-gated, resumable), `pipeline.mjs --mode api`
call files, and the `_flags` skip in `readWorkerRows`. SKILL.md Phase 2 documents the flow.
The original proposal below is kept for context.

## As built — deltas from the proposal

- **Delivery override, not just a flags line.** The reference headers' delivery contract
  (Write tool + reply line) doesn't exist on the API, so `--mode api` appends a full
  "API MODE — DELIVERY OVERRIDE" footer: JSON lines in the response body, no fences/
  commentary, final `{"_flags": ...}` line. `draft.mjs submit` refuses harness-mode call
  files (missing override marker).
- **Resumable subcommands** instead of one blocking script: batch ids persist in
  `drafts/<batch>-batchapi.json`; `submit --calls "NN"` does targeted resubmits (later
  submissions win per custom_id); `custom_id` = `<batch>-call-NN` (not a bare number).
- **Cost controls:** `submit` prints expected + worst-case cost and aborts above
  `--max-cost` (default $5); `--dry-run` previews; `collect` prints actual usage + $.
  Defaults are Sonnet 5 batch sticker rates ($1.50/$7.50 per MTok; intro $1/$5 through
  2026-08-31) — override with `--in-rate/--out-rate`. Layer on Console-side controls:
  small prepaid balance (no auto-reload) and a workspace spend limit.
- **Result hygiene:** `collect` refuses non-`end_turn` results (a `max_tokens`
  truncation would corrupt the JSONL), strips fences/chatter defensively, warns when a
  response lacks its `_flags` line, and handles errored/canceled/expired with the exact
  resubmit command. Because a refused truncation forces a resubmit and thus **double-bills**
  (you pay for the truncated attempt too), `max_tokens` **defaults to 96000**. The real JSONL
  output is small — measured ~6-9k tokens for a full 25-vendor call (CO caterer run,
  2026-07). The ceiling is headroom for the model INTERMITTENTLY prepending a long reasoning
  preamble ahead of the JSON: `collect` strips the preamble, but if preamble+JSON exceeds the
  ceiling the message stops with `stop_reason=max_tokens` and is refused. History: that run
  truncated 7/9 calls at 32k and every one came back whole at 64k (caterers then ran 48k);
  96k gives entry-dense multi-entry calls wide margin. The worst-case cost gate scales with
  max_tokens, so the default `--max-cost` rises to **12** — otherwise a ~12-call 300-vendor
  run self-blocks. If `collect` still reports a truncation, resubmit just those calls with
  `--max-tokens 120000 --max-cost 15`.
- **Key naming:** `ANTHROPIC_BATCH_API_KEY`, deliberately not `ANTHROPIC_API_KEY` (which
  would shadow Claude Code's subscription auth if it leaked into a shell env).
- **Knobs for the quality A/B:** `--model` (try `claude-haiku-4-5`) and `--effort`
  (Sonnet 5 runs adaptive thinking by default; `--effort low` is the cheap lever) —
  judge via the validator AND a human voice read, side-by-side with harness output.
- Offline test hook: `collect --results-file <jsonl>` (used by the repo's offline
  end-to-end test; also handy for replaying saved results).

## First-run checklist (local, Kiara's machine)

1. `pipeline.mjs <workdir> batch ... --size 2 --batch toy1 --mode api` (2-vendor toy batch)
2. `draft.mjs <workdir> submit --batch toy1 --dry-run` → sanity-check the estimate
3. `submit` → `status --wait` → `collect` → `pipeline.mjs status/merge` → `upload.mjs` dry-run
4. Read the two entries against a harness-drafted sample: voice, hedging, no process-tell
5. Note actual $ from `collect` vs the estimate; then clear for full-size runs

---

*Original proposal (2026-07-10), kept for context:*

## TL;DR

`/enrichvendors` drafts bot recon entries by spawning `draft-worker` subagents inside the
Claude Code harness. That works, but it bills the drafting to Kiara's Claude
**subscription**, costs a harness round-trip per worker, and is vulnerable to session
usage limits mid-run. The proposal: a small script (`draft.mjs`) that submits the same
call files to the Anthropic **Message Batches API** on a metered key instead. Estimated
cost: **~$1–1.50 per 300-vendor run**. Blocked only on Kiara creating an API key
(a billing-model decision, hers to make).

## What already happened (don't redo)

Measured on the first live photographer run (Colorado, 313 vendors, 2026-07-09/10):

| draw | ~tokens | resolution |
|---|---|---|
| CSV repair/retry agents (workers wrote corrupt CSVs) | ~460k | **FIXED** — workers now emit JSON Lines (PR #16); failure class is gone |
| Draft workers (21 + retries + RICH) | ~820k | Intended content cost, but paid at harness rates on the subscription |
| Harness overhead | large | 21 spawns + ~50 notification-driven orchestrator turns; 2 session-limit outages forced respawns |

Already landed independently of this proposal (PRs #14–#16): JSONL worker output,
`--per-call 25` (fewer spawns), no-minimum-length concision rule, voice-card one-line
rule, per-type photo caps. **This doc covers only the remaining lever: who runs the
drafting model and on whose bill.**

## The proposal

The enrichment pipeline already produces **self-contained call files** —
`data/enrichvendors/<workdir>/drafts/<batch>-call-NN.md`, each holding every rule, the
bot voices, and N vendor dossiers, with an `OUTPUT FILE:` footer naming
`drafts/<batch>-worker-NN.jsonl`. A draft worker's entire job is: read that one file,
emit JSON lines. Nothing about that requires the agent harness.

`draft.mjs` (new, ~100 lines, lives in `.claude/skills/enrichvendors/scripts/`):

1. Glob `drafts/<batch>-call-*.md`.
2. Submit ONE batch: `client.messages.batches.create({ requests })` — one request per
   call file, `custom_id` = the call number, `params` = `{ model, max_tokens: 96000,
   messages: [{ role: "user", content: <call file text> }] }`.
3. Poll `client.messages.batches.retrieve(id)` until `processing_status === "ended"`
   (most batches finish well under an hour; 24h max).
4. Stream `client.messages.batches.results(id)`; **results arrive in any order — key by
   `custom_id`, never position**. For each succeeded result, write the text to
   `drafts/<batch>-worker-NN.jsonl`. Errored/expired requests: report and resubmit just
   those.
5. Everything downstream is unchanged: `pipeline.mjs status/merge`, `upload.mjs`
   dry-run/apply, `verify`.

One contract tweak: harness workers reply with a one-line message carrying
`RICH:`/`THIN:`/`NOTPHOTOG:` flags. API responses have no separate reply channel, so for
API mode the call-file footer should say: *emit only the JSON lines, then one final line*
`{"_flags": "RICH: slug1 THIN: slug2"}`. `draft.mjs` strips `_flags` lines into
`drafts/<batch>-flags.json`; `readWorkerRows()` in `pipeline.mjs` must skip objects
containing `_flags` (2-line change). The orchestrating session then processes flags from
that file exactly as it processed reply lines.

## Billing findings (verified 2026-07-10 against the claude-api reference)

- **Separate account surface.** API keys come from the Anthropic Developer Console
  (platform.claude.com) with **usage-metered billing** (prepaid credits or invoicing).
  Kiara's Claude Code subscription is untouched — no plan change, purely additive.
- **Batch API = 50% off standard prices.** Up to 100k requests/batch; all Messages
  features supported; results retained 29 days. First-party API only (fine — no
  Bedrock/Vertex here).
- **Model + rates** (re-check current pricing when picking this up):
  Claude Sonnet 5 (`claude-sonnet-5`) $3/M input, $15/M output — intro $2/$10 through
  2026-08-31. Batch halves those.
- **Cost estimate per 300-vendor run:** ~13 calls × ~14–18k in + ~4k out ≈ 400k in /
  120k out ⇒ **$1.00–1.50 batch** ($2–3 non-batch). RICH pass adds pennies.
- **Cheaper still, maybe:** Haiku 4.5 ($1/$5) would roughly third the cost — but voice
  quality is unproven for this task. A/B ONE call file (Haiku vs Sonnet) through the
  full validator before committing.
- Setup: Console account → add billing → create key → `ANTHROPIC_API_KEY=` in
  `.env.local` (never committed; `.env.local` is gitignored).

## What it buys

1. **Drafting leaves the subscription entirely** — the largest single component of an
   enrichment run. No more session-limit deaths mid-run (happened twice on 2026-07-09).
2. **Orchestrator shrinks to ~3 thin turns** (submit → collect → validate) instead of
   N spawns + N completion notifications.
3. 50% batch discount on the moved tokens.

## Recommendation

Adopt before the next multi-state or multi-type enrichment wave; skip if enrichment
stays occasional (the harness path works and is already hardened). The build is small
(~1–2h including the flags tweak and an end-to-end test on a 2-vendor toy batch).

**Decision needed from Kiara first:** create the Console key and accept metered billing
(~$1–3/run). Do not build against her subscription OAuth token as a workaround.

## Pointers for the pickup agent

- Skill + scripts: `.claude/skills/enrichvendors/` (SKILL.md is the playbook;
  `scripts/pipeline.mjs` builds call files; worker contract lives in
  `references/<type>/draft-call-header.md`).
- Cost doctrine + measured budgets: SKILL.md § Cost doctrine.
- Example artifacts from the live run: `data/enrichvendors/photos-colorado/drafts/`
  (gitignored, on Kiara's machine).
- SDK examples for batches: the `claude-api` skill (`/claude-api`), § Message Batches;
  TypeScript/Node shapes in its `typescript/claude-api/batches.md`.
- History: PRs #11–#16 tell the full enrichment-pipeline story; the token post-mortem
  is in the project memory (`photographer-expansion-decisions`).
