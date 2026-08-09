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
 * rather than forced. restore.mjs --work <name> still undoes it, because the
 * export snapshot holds the pre-correction text.
 */

import { join } from "node:path";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { serviceClient, workdir, readJsonl, arg, has } from "./lib.mjs";

const WORK = arg("work");
if (!WORK) {
  console.error("Usage: apply-corrections.mjs --work <name> [--apply]");
  process.exit(1);
}
const APPLY = has("apply");
const db = serviceClient();
const dir = workdir(WORK);

const accepted = readJsonl(join(dir, "accepted-fix.jsonl"));
const logPath = join(dir, "applied-fix.jsonl");
const done = new Set(
  existsSync(logPath)
    ? readFileSync(logPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).entry_id)
    : [],
);
if (done.size) console.log(`Resuming: ${done.size} corrections already applied\n`);

let fixed = 0;
let missing = 0;

for (const c of accepted) {
  if (done.has(c.entry_id)) continue;

  const { data: live, error } = await db
    .from("recon_entries")
    .select(c.field)
    .eq("id", c.entry_id)
    .single();
  if (error) {
    console.error(`  ${c.entry_id}: ${error.message}`);
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
  const next = current.replace(c.old, c.new);

  if (!APPLY) {
    console.log(`  ${c.vendor_id} .${c.field}  [${c.fact}]`);
    console.log(`    - ${c.old}`);
    console.log(`    + ${c.new}`);
  } else {
    const { error: upErr } = await db
      .from("recon_entries")
      .update({ [c.field]: next, updated_at: new Date().toISOString() })
      .eq("id", c.entry_id);
    if (upErr) {
      console.error(`  ${c.entry_id}: ${upErr.message}`);
      continue;
    }
    appendFileSync(logPath, JSON.stringify({ entry_id: c.entry_id }) + "\n");
  }
  fixed++;
}

console.log(
  [
    "",
    APPLY ? "APPLIED" : "DRY RUN - nothing written",
    `  clauses corrected: ${fixed}`,
    `  skipped (clause gone): ${missing}`,
    APPLY ? "" : "\nRe-run with --apply to write. restore.mjs --work " + WORK + " undoes it.",
  ].join("\n"),
);
