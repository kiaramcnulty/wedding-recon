#!/usr/bin/env node
/**
 * Apply the gated corrections - the one REPLACE in this whole system.
 *
 *   node scripts/reconcile/apply-corrections.mjs --work co-all           (dry run)
 *   node scripts/reconcile/apply-corrections.mjs --work co-all --apply
 *
 * Dry run by default. Resumable via applied-fix.jsonl.
 *
 * Reads the LIVE field, not the snapshot, and replaces `old` in it. So an
 * append this run's Direction-A pass already added elsewhere in the entry is
 * preserved, and if `old` is no longer present - the clause was already edited
 * away, or another process changed it - the correction is skipped and reported
 * rather than forced.
 *
 * GUARDS (2026-10-02, plan item 1), re-checked here against the LIVE card
 * because the gate only saw the export:
 *   - the replacement must be backed by a verbatim quote from a harvested
 *     source. A correction is built from a tag's published quote, and the tag
 *     is not proof of itself, so that quote counts only if it is actually found
 *     in the vendor's harvested pages (evidence.mjs correctionEvidence). Every
 *     number in the replacement must appear in the evidence.
 *   - shared prose gates, and no MONEY + "no price posted" contradiction: the
 *     Et Voila card had its headline rewritten to "$65 to $85 per person" while
 *     its details still said the site "has no rate sheet" (2026-08-11).
 *   - snapshot of every touched entry from a fresh read, in the MAIN checkout,
 *     before the first write; every field write in its audit.jsonl. Undo with
 *     restore.mjs --work <name> --run <run id> --apply.
 */

import { join } from "node:path";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { serviceClient, workdir, readJsonl, writeJsonl, arg, has } from "./lib.mjs";
import { WriteRun, auditNote } from "./audit.mjs";
import { reviewProseChange, correctionEvidence } from "./evidence.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: apply-corrections.mjs --work <name> [--apply]");
  process.exit(1);
}
const APPLY = has("apply");
const dir = workdir(WORK);

const accepted = readJsonl(join(dir, "accepted-fix.jsonl"));
const vendors = new Map(readJsonl(join(dir, "vendors.jsonl")).map((v) => [v.id, v]));
const exported = new Map();
for (const v of vendors.values()) for (const e of v.entries) exported.set(e.id, { ...e, vendor: v });

const logPath = join(dir, "applied-fix.jsonl");
const done = new Set(
  existsSync(logPath)
    ? readFileSync(logPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).entry_id)
    : [],
);
if (done.size) console.log(`Resuming: ${done.size} corrections already applied\n`);

const todo = accepted.filter((c) => !done.has(c.entry_id));
const db = APPLY ? serviceClient() : null;
const run = new WriteRun({ work: WORK, script: "apply-corrections", apply: APPLY, db });
await run.snapshot("recon_entries", todo.map((c) => c.entry_id));

let fixed = 0;
let missing = 0;
const rejected = [];

for (const c of todo) {
  const ex = exported.get(c.entry_id);
  const v = ex?.vendor ?? vendors.get(c.vendor_id);
  // Live text in apply (the snapshot read), the export in a dry run. is_bot
  // comes from the export, which is the only place author identity was read.
  const live = APPLY ? run.row("recon_entries", c.entry_id) : ex;
  if (!live || !ex) {
    console.error(`  ${c.entry_id}: not in export or gone - skipped`);
    continue;
  }
  const current = live[c.field] ?? "";

  // The clause has to still be there. If it is not, do not force a rewrite -
  // report it and move on. This is what makes a replace safe to run after the
  // appends and alongside anything else.
  if (!current.includes(c.old)) {
    console.log(`  SKIP ${c.entry_id}: "old" no longer present - reporting, not forcing`);
    missing++;
    continue;
  }

  const card = { notes: live.notes ?? "", price_text: live.price_text ?? "", price_details: live.price_details ?? "" };
  const rv = reviewProseChange({
    vendorId: v.id,
    entry: { ...ex, ...card },
    card,
    change: { kind: "replace", field: c.field, old: c.old, text: c.new, evidence: correctionEvidence(v.filters, c) },
  });
  if (rv.errors.length) {
    rejected.push({ ...c, name: v.name, errors: rv.errors });
    auditNote(run, { op: "rejected", entry_id: c.entry_id, field: c.field, new: c.new, errors: rv.errors });
    continue;
  }
  const next = rv.after[c.field];

  if (!APPLY) {
    console.log(`  ${v.name} .${c.field}  [${c.fact}]`);
    console.log(`    - ${c.old}`);
    console.log(`    + ${c.new}`);
    for (const q of rv.verified) console.log(`      evidence [${q.source}]: "${q.quote}"`);
  } else {
    const { error: upErr } = await run.update(
      "recon_entries",
      c.entry_id,
      { [c.field]: next, updated_at: new Date().toISOString() },
      { evidence: rv.verified, reason: `correction: ${c.fact ?? ""}` },
    );
    if (upErr) {
      console.error(`  ${c.entry_id}: ${upErr.message}`);
      continue;
    }
    appendFileSync(logPath, JSON.stringify({ entry_id: c.entry_id, run_id: run.runId }) + "\n");
  }
  fixed++;
}

writeJsonl(join(dir, "apply-fix-rejected.jsonl"), rejected);
for (const r of rejected) console.log(`  REJECT ${r.name} .${r.field}: ${r.errors.join("; ")}`);

console.log(
  [
    "",
    APPLY ? "APPLIED" : "DRY RUN - nothing written",
    `  clauses corrected: ${fixed}`,
    `  skipped (clause gone): ${missing}`,
    `  rejected by guards: ${rejected.length}  (apply-fix-rejected.jsonl)`,
    "",
    run.where(),
  ].join("\n"),
);
